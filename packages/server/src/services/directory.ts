import { type AppRole, type Language, LANGUAGES } from "@ferie/shared";
import { z } from "zod";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { enqueueNotification, enqueuePendingNotifications, type NotificationRecipient } from "./queue.js";

// Version of docs/employee-directory-openapi.yaml this sync validates against. Recorded on every
// successful run so the notification worker's delivery gate can tell director-aware syncs (which
// populated isDirector and the mail delegate) from runs that predate the field.
export const DIRECTORY_CONTRACT_VERSION = "1.1.0";

const employeeSchema = z.object({
  id: z.string(),
  employeeNumber: z.string(),
  auth0Subject: z.string(),
  workEmail: z.email(),
  displayName: z.string(),
  title: z.string().nullable(),
  department: z.object({ id: z.string(), name: z.string(), updatedAt: z.iso.datetime() }),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  fte: z.number().positive(),
  schedule: z.array(z.object({ weekday: z.number().int().min(1).max(7), start: z.string(), end: z.string() })),
  roles: z.array(z.enum(["FERIE_FINAL_APPROVER", "FERIE_PORTAL_ADMIN", "STAFF_IT"])),
  preferredLanguage: z.enum(LANGUAGES),
  approvers: z.array(z.object({ employeeSourceId: z.string(), role: z.enum(["PRE_APPROVER", "RESPONSABILE", "SUBSTITUTE_RESPONSABILE"]) })),
  isDirector: z.boolean(),
  directorMailDelegate: z.object({ employeeSourceId: z.string() }).nullable(),
  updatedAt: z.iso.datetime(),
});

const pageSchema = z.object({ items: z.array(employeeSchema), nextCursor: z.string().nullable().optional() });
let cachedToken: { value: string; expiresAt: number } | null = null;

type PendingStage = "NORMAL" | "FINAL";
interface PendingRecipientSet {
  requestId: string;
  stage: PendingStage;
  recipients: NotificationRecipient[];
}

function uniqueRecipients(rows: NotificationRecipient[]): NotificationRecipient[] {
  return [...new Map(rows.map((row) => [row.sourceId, { email: row.email, sourceId: row.sourceId }])).values()].sort((a, b) => a.sourceId.localeCompare(b.sourceId));
}

/**
 * Compared by person (directory source id), not address: an approver whose email merely changed is
 * not newly assigned and must not be re-notified.
 */
export function newlyAssignedRecipients(previous: NotificationRecipient[], current: NotificationRecipient[]): NotificationRecipient[] {
  const previousIds = new Set(previous.map((recipient) => recipient.sourceId));
  return uniqueRecipients(current).filter((recipient) => !previousIds.has(recipient.sourceId));
}

async function pendingRecipientSets(): Promise<Map<string, PendingRecipientSet>> {
  const [normalPending, finalPending, finalApprovers] = await Promise.all([
    prisma.absenceRequest.findMany({
      where: { status: { in: ["PENDING_APPROVAL", "CANCELLATION_REQUESTED"] } },
      include: { employee: { include: { subjects: { include: { approver: true } } } } },
    }),
    prisma.absenceRequest.findMany({ where: { status: "PENDING_FINAL_APPROVAL" }, select: { id: true } }),
    prisma.employeeMirror.findMany({ where: { roles: { has: "FERIE_FINAL_APPROVER" }, status: "ACTIVE" }, select: { email: true, sourceId: true } }),
  ]);
  const result = new Map<string, PendingRecipientSet>();
  for (const request of normalPending) {
    const preApprovers = request.employee.subjects.filter((assignment) => assignment.role === "PRE_APPROVER");
    const assignments = preApprovers.length ? preApprovers : request.employee.subjects.filter((assignment) => assignment.role === "RESPONSABILE");
    const entry = { requestId: request.id, stage: "NORMAL" as const, recipients: uniqueRecipients(assignments.map((assignment) => assignment.approver)) };
    result.set(`${entry.stage}:${entry.requestId}`, entry);
  }
  const finalRecipients = uniqueRecipients(finalApprovers);
  for (const request of finalPending) {
    const entry = { requestId: request.id, stage: "FINAL" as const, recipients: finalRecipients };
    result.set(`${entry.stage}:${entry.requestId}`, entry);
  }
  return result;
}

export function directoryConfigured(): boolean {
  return Boolean(config.ED_BASE_URL);
}

export function superuserEmails(value: string): string[] {
  return value.split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean);
}

/**
 * A real Employee Directory carries no Ferie application roles yet, and a sync deactivates every
 * mirror row it does not return. Without a local grant the first successful sync would leave nobody
 * holding STAFF_IT or FERIE_PORTAL_ADMIN, locking administration out until the database is reseeded.
 */
export function grantedRoles(email: string, roles: AppRole[], granted: string[]): AppRole[] {
  if (!granted.includes(email.trim().toLowerCase())) return roles;
  return [...new Set<AppRole>([...roles, "STAFF_IT", "FERIE_PORTAL_ADMIN", "FERIE_FINAL_APPROVER"])];
}

/**
 * A sync fetches every page before opening its transaction, so a preferred-language change made in
 * that window would otherwise be overwritten with the value the directory held at fetch time. The
 * directory has already accepted the newer value, so the local column is the fresher of the two.
 *
 * Expressed as a filter rather than a read-then-decide, so the database evaluates it while holding
 * the row lock: a write that commits first is seen and skipped, and one that commits later waits and
 * then lands on top. Either ordering keeps the newest value. The following run starts after the write
 * and mirrors the directory again, so the exception clears itself.
 */
export function languageNotWrittenSince(sourceId: string, syncStartedAt: Date) {
  return {
    sourceId,
    OR: [{ preferredLanguageUpdatedAt: null }, { preferredLanguageUpdatedAt: { lt: syncStartedAt } }],
  };
}

async function token(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const response = await fetch(`https://${config.AUTH0_DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id: config.ED_CLIENT_ID, client_secret: config.ED_CLIENT_SECRET, audience: config.ED_AUDIENCE, grant_type: "client_credentials" }),
  });
  if (!response.ok) throw new Error(`ED_TOKEN_${response.status}`);
  const payload = z.object({ access_token: z.string(), expires_in: z.number() }).parse(await response.json());
  cachedToken = { value: payload.access_token, expiresAt: Date.now() + payload.expires_in * 1_000 };
  return cachedToken.value;
}

/**
 * Local Employee Directory instances run with their own development escape hatch, so no Auth0 tenant
 * is needed to exercise the integration end to end. This covers every directory call, the
 * preferred-language write included, so a local directory has to accept unauthenticated writes too.
 * `parseConfig` refuses to start with this enabled in production.
 */
async function directoryHeaders(): Promise<Record<string, string>> {
  if (config.ED_DEV_UNAUTHENTICATED) return {};
  return { authorization: `Bearer ${await token()}` };
}

export async function syncDirectory() {
  const run = await prisma.directorySyncRun.create({ data: { status: "RUNNING" } });
  try {
    if (!config.ED_BASE_URL) throw new Error("ED_NOT_CONFIGURED");
    const items: z.infer<typeof employeeSchema>[] = [];
    let cursor: string | undefined;
    do {
      const url = new URL("/api/v1/time-off-directory/employees", config.ED_BASE_URL);
      if (cursor) url.searchParams.set("cursor", cursor);
      url.searchParams.set("limit", "100");
      const response = await fetch(url, { headers: await directoryHeaders() });
      if (!response.ok) throw new Error(`ED_FETCH_${response.status}`);
      const page = pageSchema.parse(await response.json());
      items.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);

    const recipientsBefore = await pendingRecipientSets();
    const granted = superuserEmails(config.DEV_SUPERUSER_EMAILS);
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const roles = grantedRoles(item.workEmail, item.roles, granted);
        const department = await tx.departmentMirror.upsert({
          where: { sourceId: item.department.id },
          create: { sourceId: item.department.id, name: item.department.name, sourceUpdatedAt: new Date(item.department.updatedAt) },
          update: { name: item.department.name, sourceUpdatedAt: new Date(item.department.updatedAt), syncedAt: new Date() },
        });
        await tx.employeeMirror.upsert({
          where: { sourceId: item.id },
          create: { sourceId: item.id, employeeNumber: item.employeeNumber, auth0Subject: item.auth0Subject, email: item.workEmail, displayName: item.displayName, title: item.title, departmentId: department.id, status: item.status, fte: item.fte, schedule: item.schedule, roles, preferredLanguage: item.preferredLanguage, isDirector: item.isDirector, directorMailDelegateSourceId: item.directorMailDelegate?.employeeSourceId ?? null, sourceUpdatedAt: new Date(item.updatedAt) },
          update: { employeeNumber: item.employeeNumber, auth0Subject: item.auth0Subject, email: item.workEmail, displayName: item.displayName, title: item.title, departmentId: department.id, status: item.status, fte: item.fte, schedule: item.schedule, roles, isDirector: item.isDirector, directorMailDelegateSourceId: item.directorMailDelegate?.employeeSourceId ?? null, sourceUpdatedAt: new Date(item.updatedAt), syncedAt: new Date() },
        });
        // Separate conditional write, so a language change made while this sync was fetching survives.
        await tx.employeeMirror.updateMany({
          where: languageNotWrittenSince(item.id, run.startedAt),
          data: { preferredLanguage: item.preferredLanguage },
        });
      }
      const returnedIds = items.map((item) => item.id);
      // A row the directory no longer returns also loses the director marker and its delegation,
      // so a stale row can never shadow the current director in the delivery-time lookup.
      await tx.employeeMirror.updateMany({ where: { sourceId: { notIn: returnedIds } }, data: { status: "INACTIVE", isDirector: false, directorMailDelegateSourceId: null } });
      await tx.approverAssignment.deleteMany();
      const employees = await tx.employeeMirror.findMany({ select: { id: true, sourceId: true } });
      const bySourceId = new Map(employees.map((employee) => [employee.sourceId, employee.id]));
      for (const item of items) {
        for (const assignment of item.approvers) {
          const employeeId = bySourceId.get(item.id);
          const approverId = bySourceId.get(assignment.employeeSourceId);
          if (employeeId && approverId) await tx.approverAssignment.create({ data: { employeeId, approverId, role: assignment.role } });
        }
      }
    });
    const recipientsAfter = await pendingRecipientSets();
    for (const [key, previous] of recipientsBefore) {
      const current = recipientsAfter.get(key);
      if (!current) continue;
      const template = current.stage === "FINAL" ? "FINAL_APPROVAL_REASSIGNED" : "APPROVAL_REASSIGNED";
      for (const recipient of newlyAssignedRecipients(previous.recipients, current.recipients)) {
        await enqueueNotification(current.requestId, recipient, template, run.id);
      }
    }
    await prisma.directorySyncRun.update({ where: { id: run.id }, data: { status: "SUCCEEDED", employeeCount: items.length, contractVersion: DIRECTORY_CONTRACT_VERSION, finishedAt: new Date() } });
    // Mail may be waiting on the delivery gate for exactly this sync (or have exhausted its pg-boss
    // retries while waiting), so drain the outbox now rather than at the next server start. A drain
    // failure must not turn the recorded SUCCEEDED run into a FAILED one.
    try {
      await enqueuePendingNotifications();
    } catch (error) {
      logger.error({ err: error, runId: run.id }, "Directory sync succeeded but re-enqueueing pending notifications failed");
    }
    return { runId: run.id, employeeCount: items.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    await prisma.directorySyncRun.update({ where: { id: run.id }, data: { status: "FAILED", errorCode: message.split(":")[0], errorMessage: message.slice(0, 500), finishedAt: new Date() } });
    logger.error({ err: error, runId: run.id }, "Employee Directory sync failed");
    throw error;
  }
}

/**
 * Employee Directory owns the preferred language, so a portal change is written there first and
 * mirrored only when the directory accepts it. The next sync then reports the same value back.
 */
export async function updateDirectoryPreferredLanguage(employeeSourceId: string, language: Language): Promise<void> {
  if (!config.ED_BASE_URL) throw new Error("ED_NOT_CONFIGURED");
  const url = new URL(`/api/v1/time-off-directory/employees/${encodeURIComponent(employeeSourceId)}/preferred-language`, config.ED_BASE_URL);
  const response = await fetch(url, {
    method: "PATCH",
    headers: { ...await directoryHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ preferredLanguage: language }),
  });
  if (!response.ok) throw new Error(`ED_LANGUAGE_UPDATE_${response.status}`);
}

export type DirectorDelegateHealth = "NONE" | "CONFIGURED" | "MISSING" | "INACTIVE";

/**
 * "NONE" (no director in the mirror) is a healthy state — a demo database has no director at all.
 * "MISSING" and "INACTIVE" are not: the portal is suppressing the director's mail rather than
 * delivering it, and only Employee Directory can resolve that, so the tile has to say so.
 */
async function directorDelegateHealth(): Promise<DirectorDelegateHealth> {
  const director = await prisma.employeeMirror.findFirst({ where: { isDirector: true }, select: { directorMailDelegateSourceId: true } });
  if (!director) return "NONE";
  if (!director.directorMailDelegateSourceId) return "MISSING";
  const delegate = await prisma.employeeMirror.findUnique({ where: { sourceId: director.directorMailDelegateSourceId }, select: { status: true } });
  return delegate?.status === "ACTIVE" ? "CONFIGURED" : "INACTIVE";
}

export async function integrationHealth() {
  const [lastSync, unsentNotifications, suppressedNotifications, failedImports, directorDelegate] = await Promise.all([
    prisma.directorySyncRun.findFirst({ orderBy: { startedAt: "desc" } }),
    prisma.notificationOutbox.count({ where: { sentAt: null, suppressedAt: null } }),
    prisma.notificationOutbox.count({ where: { suppressedAt: { not: null } } }),
    prisma.importBatch.count({ where: { status: "REJECTED" } }),
    directorDelegateHealth(),
  ]);
  return {
    directory: { configured: Boolean(config.ED_BASE_URL), lastSync },
    auth0: { configured: !config.AUTH_DISABLED && Boolean(config.AUTH0_DOMAIN), mode: config.AUTH_DISABLED ? "demo" : "jwt" },
    email: { configured: Boolean(config.SES_FROM_EMAIL), pending: unsentNotifications, suppressed: suppressedNotifications, directorDelegate },
    imports: { rejected: failedImports },
  };
}
