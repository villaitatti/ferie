import { z } from "zod";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { enqueueNotification } from "./queue.js";

const employeeSchema = z.object({
  id: z.string(),
  employeeNumber: z.string(),
  auth0Subject: z.string(),
  workEmail: z.string().email(),
  displayName: z.string(),
  title: z.string().nullable(),
  department: z.object({ id: z.string(), name: z.string(), updatedAt: z.string().datetime() }),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  fte: z.number().positive(),
  schedule: z.array(z.object({ weekday: z.number().int().min(1).max(7), start: z.string(), end: z.string() })),
  roles: z.array(z.enum(["FERIE_FINAL_APPROVER", "FERIE_PORTAL_ADMIN", "STAFF_IT"])),
  approvers: z.array(z.object({ employeeSourceId: z.string(), role: z.enum(["PRE_APPROVER", "RESPONSABILE", "SUBSTITUTE_RESPONSABILE"]) })),
  updatedAt: z.string().datetime(),
});

const pageSchema = z.object({ items: z.array(employeeSchema), nextCursor: z.string().nullable().optional() });
let cachedToken: { value: string; expiresAt: number } | null = null;

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
      const response = await fetch(url, { headers: { authorization: `Bearer ${await token()}` } });
      if (!response.ok) throw new Error(`ED_FETCH_${response.status}`);
      const page = pageSchema.parse(await response.json());
      items.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const department = await tx.departmentMirror.upsert({
          where: { sourceId: item.department.id },
          create: { sourceId: item.department.id, name: item.department.name, sourceUpdatedAt: new Date(item.department.updatedAt) },
          update: { name: item.department.name, sourceUpdatedAt: new Date(item.department.updatedAt), syncedAt: new Date() },
        });
        await tx.employeeMirror.upsert({
          where: { sourceId: item.id },
          create: { sourceId: item.id, employeeNumber: item.employeeNumber, auth0Subject: item.auth0Subject, email: item.workEmail, displayName: item.displayName, title: item.title, departmentId: department.id, status: item.status, fte: item.fte, schedule: item.schedule, roles: item.roles, sourceUpdatedAt: new Date(item.updatedAt) },
          update: { employeeNumber: item.employeeNumber, auth0Subject: item.auth0Subject, email: item.workEmail, displayName: item.displayName, title: item.title, departmentId: department.id, status: item.status, fte: item.fte, schedule: item.schedule, roles: item.roles, sourceUpdatedAt: new Date(item.updatedAt), syncedAt: new Date() },
        });
      }
      const returnedIds = items.map((item) => item.id);
      await tx.employeeMirror.updateMany({ where: { sourceId: { notIn: returnedIds } }, data: { status: "INACTIVE" } });
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
    const pending = await prisma.absenceRequest.findMany({
      where: { status: { in: ["PENDING_APPROVAL", "CANCELLATION_REQUESTED"] } },
      include: { employee: { include: { subjects: { include: { approver: true } } } } },
    });
    for (const request of pending) {
      const preApprovers = request.employee.subjects.filter((assignment) => assignment.role === "PRE_APPROVER");
      const assignments = preApprovers.length ? preApprovers : request.employee.subjects.filter((assignment) => assignment.role === "RESPONSABILE");
      for (const recipient of new Set(assignments.map((assignment) => assignment.approver.email))) await enqueueNotification(request.id, recipient, "APPROVAL_REASSIGNED");
    }
    const [finalPending, finalApprovers] = await Promise.all([
      prisma.absenceRequest.findMany({ where: { status: "PENDING_FINAL_APPROVAL" }, select: { id: true } }),
      prisma.employeeMirror.findMany({ where: { roles: { has: "FERIE_FINAL_APPROVER" }, status: "ACTIVE" }, select: { email: true } }),
    ]);
    for (const request of finalPending) for (const final of finalApprovers) await enqueueNotification(request.id, final.email, "FINAL_APPROVAL_REASSIGNED");
    await prisma.directorySyncRun.update({ where: { id: run.id }, data: { status: "SUCCEEDED", employeeCount: items.length, finishedAt: new Date() } });
    return { runId: run.id, employeeCount: items.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    await prisma.directorySyncRun.update({ where: { id: run.id }, data: { status: "FAILED", errorCode: message.split(":")[0], errorMessage: message.slice(0, 500), finishedAt: new Date() } });
    logger.error({ err: error, runId: run.id }, "Employee Directory sync failed");
    throw error;
  }
}

export async function integrationHealth() {
  const [lastSync, unsentNotifications, failedImports] = await Promise.all([
    prisma.directorySyncRun.findFirst({ orderBy: { startedAt: "desc" } }),
    prisma.notificationOutbox.count({ where: { sentAt: null } }),
    prisma.importBatch.count({ where: { status: "REJECTED" } }),
  ]);
  return {
    directory: { configured: Boolean(config.ED_BASE_URL), lastSync },
    auth0: { configured: !config.AUTH_DISABLED && Boolean(config.AUTH0_DOMAIN), mode: config.AUTH_DISABLED ? "demo" : "jwt" },
    email: { configured: Boolean(config.SES_FROM_EMAIL), pending: unsentNotifications },
    imports: { rejected: failedImports },
  };
}
