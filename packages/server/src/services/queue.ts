import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import PgBoss from "pg-boss";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";

const QUEUE = "absence-notification";
let bossPromise: Promise<PgBoss> | null = null;

async function queue(): Promise<PgBoss> {
  if (bossPromise) return bossPromise;
  bossPromise = (async () => {
    const instance = new PgBoss({
      connectionString: config.DATABASE_URL,
      schema: "pgboss",
      retryLimit: 4,
      retryDelay: 60,
      expireInSeconds: 23 * 60 * 60,
      archiveCompletedAfterSeconds: 7 * 24 * 60 * 60,
    });
    instance.on("error", (error) => logger.error({ err: error }, "pg-boss error"));
    await instance.start();
    await instance.createQueue(QUEUE);
    return instance;
  })().catch((error) => {
    bossPromise = null;
    throw error;
  });
  return bossPromise;
}

export interface NotificationRecipient {
  email: string;
  sourceId: string;
}

export async function enqueueNotification(requestId: string, recipient: NotificationRecipient, template: string, dedupeDiscriminator?: string) {
  // Deduplicated by the person (directory source id), not the address, so an email change in the
  // directory neither re-notifies nor duplicates. The address is stored as it was at enqueue time
  // for the audit trail; delivery resolves the current one from the mirror by source id.
  const dedupeKey = [requestId, recipient.sourceId, template, dedupeDiscriminator].filter(Boolean).join(":");
  const outbox = await prisma.notificationOutbox.upsert({
    where: { dedupeKey },
    create: { dedupeKey, recipient: recipient.email, template, payload: { requestId, recipientSourceId: recipient.sourceId } },
    update: {},
  });
  try {
    await (await queue()).send(QUEUE, { outboxId: outbox.id }, { singletonKey: outbox.id });
  } catch (error) {
    logger.error({ err: error, outboxId: outbox.id }, "Notification queued in outbox but pg-boss enqueue failed");
  }
}

export interface DirectorDelegation {
  recipientIsDirector: boolean;
  delegateEmail: string | null;
}

export type DeliveryPlan = { send: true; to: string; subject: string } | { send: false; reason: "DIRECTOR_WITHOUT_DELEGATE" };

const NO_DELEGATION: DirectorDelegation = { recipientIsDirector: false, delegateEmail: null };

/**
 * An INACTIVE delegate counts as absent — the caller suppresses rather than deliver to a mailbox
 * nobody reads, and never falls back to the director herself.
 */
export function delegationFor(recipient: { isDirector: boolean } | null, delegate: { email: string; status: string } | null): DirectorDelegation {
  if (!recipient?.isDirector) return NO_DELEGATION;
  return { recipientIsDirector: true, delegateEmail: delegate?.status === "ACTIVE" ? delegate.email : null };
}

/**
 * The mirror learns who the director is only from a successful sync against a director-aware
 * (≥ 1.1.0) directory contract; the upgrade migration backfills every row with isDirector = false.
 * Sending anything before such a sync exists could hand the director her own mail, so when a
 * directory is configured the worker refuses instead — mail is delayed, never leaked. pg-boss
 * retries the refused job, and every successful sync re-drains the outbox.
 */
export function deliveryGate(directoryConfigured: boolean, directorMetadataSynced: boolean): { open: true } | { open: false; reason: "DIRECTOR_METADATA_NOT_SYNCED" } {
  if (directoryConfigured && !directorMetadataSynced) return { open: false, reason: "DIRECTOR_METADATA_NOT_SYNCED" };
  return { open: true };
}

// Once a director-aware sync has succeeded the condition can never become false again, so the
// database is asked at most until the first confirmation.
let directorMetadataConfirmed = false;
async function directorMetadataSynced(): Promise<boolean> {
  if (directorMetadataConfirmed) return true;
  // Only runs against the 1.1.0+ contract record a version, and their schema validation required
  // the director fields — so any such SUCCEEDED run proves the mirror carries director metadata.
  directorMetadataConfirmed = Boolean(await prisma.directorySyncRun.findFirst({ where: { status: "SUCCEEDED", contractVersion: { not: null } }, select: { id: true } }));
  return directorMetadataConfirmed;
}

/**
 * The outbox identifies the intended recipient by directory source id, and both the current address
 * and the director flag are resolved from the mirror here, at delivery time — so a director email
 * change while a notification sits unsent can never leave a stale, undelegated address in the queue.
 * Rows enqueued before source ids were recorded (or whose person has left the mirror entirely) fall
 * back to matching the stored address against the director rows, case-insensitively, so the
 * never-send rule still holds for them.
 */
async function resolveRecipient(sourceId: string | null, storedEmail: string): Promise<{ email: string; delegation: DirectorDelegation }> {
  const select = { email: true, isDirector: true, directorMailDelegateSourceId: true } as const;
  const mirror = sourceId ? await prisma.employeeMirror.findUnique({ where: { sourceId }, select }) : null;
  const recipient = mirror ?? await prisma.employeeMirror.findFirst({ where: { isDirector: true, email: { equals: storedEmail, mode: "insensitive" } }, select });
  const delegate = recipient?.isDirector && recipient.directorMailDelegateSourceId
    ? await prisma.employeeMirror.findUnique({ where: { sourceId: recipient.directorMailDelegateSourceId }, select: { email: true, status: true } })
    : null;
  return { email: mirror?.email ?? storedEmail, delegation: delegationFor(recipient, delegate) };
}

/**
 * Delegation first: the director never receives mail — her messages go to the delegate with the
 * intended recipient in the subject, or nowhere at all when no active delegate exists. Then, when a
 * redirect mailbox is configured, every message that would be sent goes there and nowhere else,
 * again with the intended recipient moved into the subject — so a development database still
 * simulates suppression instead of masking it. The outbox row keeps the real recipient so the
 * notification audit trail stays truthful.
 */
export function mailDelivery(recipient: string, subject: string, redirectTo: string, delegation: DirectorDelegation = NO_DELEGATION): DeliveryPlan {
  if (delegation.recipientIsDirector && !delegation.delegateEmail) return { send: false, reason: "DIRECTOR_WITHOUT_DELEGATE" };
  const to = delegation.recipientIsDirector && delegation.delegateEmail ? delegation.delegateEmail : recipient;
  const delegatedSubject = delegation.recipientIsDirector ? `[per ${recipient}] ${subject}` : subject;
  if (!redirectTo) return { send: true, to, subject: delegatedSubject };
  return { send: true, to: redirectTo, subject: `[dev → ${to}] ${delegatedSubject}` };
}

async function deliver(outboxId: string) {
  const outbox = await prisma.notificationOutbox.findUnique({ where: { id: outboxId } });
  if (!outbox || outbox.sentAt || outbox.suppressedAt) return;
  const gate = deliveryGate(Boolean(config.ED_BASE_URL), config.ED_BASE_URL ? await directorMetadataSynced() : false);
  if (!gate.open) {
    await prisma.notificationOutbox.update({ where: { id: outbox.id }, data: { lastError: gate.reason } });
    throw new Error(gate.reason);
  }
  const payload = outbox.payload as { requestId?: string; recipientSourceId?: string };
  const { email: recipient, delegation } = await resolveRecipient(payload.recipientSourceId ?? null, outbox.recipient);
  const link = `${config.APP_BASE_URL}/requests/${String(payload.requestId ?? "")}`;
  const subject = outbox.template.includes("REQUIRED") ? "Azione richiesta nel portale assenze" : "Aggiornamento richiesta di assenza";
  const body = `È disponibile un aggiornamento nel portale assenze. Accedi in modo sicuro: ${link}\n\nAn update is available in the absence portal. Sign in securely: ${link}`;
  const delivery = mailDelivery(recipient, subject, config.MAIL_REDIRECT_TO, delegation);
  if (!delivery.send) {
    logger.warn({ recipient, template: outbox.template, reason: delivery.reason }, "Director notification suppressed: no active mail delegate in the directory mirror");
    await prisma.notificationOutbox.update({ where: { id: outbox.id }, data: { suppressedAt: new Date() } });
    return;
  }
  try {
    if (config.SES_FROM_EMAIL) {
      if (delivery.to !== recipient) logger.info({ intended: recipient, to: delivery.to, template: outbox.template }, "Notification rerouted away from the intended recipient");
      await new SESClient({ region: config.AWS_REGION }).send(new SendEmailCommand({
        Source: config.SES_FROM_EMAIL,
        Destination: { ToAddresses: [delivery.to] },
        Message: { Subject: { Data: delivery.subject, Charset: "UTF-8" }, Body: { Text: { Data: body, Charset: "UTF-8" } } },
      }));
    } else logger.info({ recipient: outbox.recipient, template: outbox.template }, "SES disabled; recording demo notification");
    await prisma.notificationOutbox.update({ where: { id: outbox.id }, data: { sentAt: new Date(), attempts: { increment: 1 }, lastError: null } });
  } catch (error) {
    await prisma.notificationOutbox.update({ where: { id: outbox.id }, data: { attempts: { increment: 1 }, lastError: error instanceof Error ? error.message.slice(0, 500) : "SEND_FAILED" } });
    throw error;
  }
}

/**
 * Re-sends every unsent outbox row to the queue. Runs at worker start and after each successful
 * directory sync, so mail held back by the delivery gate flows as soon as the director metadata
 * arrives even if pg-boss has exhausted its retries. The singleton key keeps a re-send from
 * duplicating a job that is still queued, and `deliver` skips rows already sent or suppressed.
 */
export async function enqueuePendingNotifications() {
  const instance = await queue();
  const pending = await prisma.notificationOutbox.findMany({ where: { sentAt: null, suppressedAt: null }, select: { id: true } });
  for (const item of pending) await instance.send(QUEUE, { outboxId: item.id }, { singletonKey: item.id });
}

export async function registerNotificationWorker() {
  const instance = await queue();
  await instance.work<{ outboxId: string }>(QUEUE, { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) await deliver(job.data.outboxId);
  });
  await enqueuePendingNotifications();
}

export async function stopQueue() {
  if (!bossPromise) return;
  const instance = await bossPromise;
  await instance.stop({ graceful: true, timeout: 10_000 });
  bossPromise = null;
}
