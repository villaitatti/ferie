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

export async function enqueueNotification(requestId: string, recipient: string, template: string) {
  const outbox = await prisma.notificationOutbox.upsert({
    where: { dedupeKey: `${requestId}:${recipient}:${template}` },
    create: { dedupeKey: `${requestId}:${recipient}:${template}`, recipient, template, payload: { requestId } },
    update: {},
  });
  try {
    await (await queue()).send(QUEUE, { outboxId: outbox.id }, { singletonKey: outbox.id });
  } catch (error) {
    logger.error({ err: error, outboxId: outbox.id }, "Notification queued in outbox but pg-boss enqueue failed");
  }
}

async function deliver(outboxId: string) {
  const outbox = await prisma.notificationOutbox.findUnique({ where: { id: outboxId } });
  if (!outbox || outbox.sentAt) return;
  const link = `${config.APP_BASE_URL}/requests/${String((outbox.payload as { requestId?: string }).requestId ?? "")}`;
  const subject = outbox.template.includes("REQUIRED") ? "Azione richiesta nel portale assenze" : "Aggiornamento richiesta di assenza";
  const body = `È disponibile un aggiornamento nel portale assenze. Accedi in modo sicuro: ${link}\n\nAn update is available in the absence portal. Sign in securely: ${link}`;
  try {
    if (config.SES_FROM_EMAIL) {
      await new SESClient({ region: config.AWS_REGION }).send(new SendEmailCommand({
        Source: config.SES_FROM_EMAIL,
        Destination: { ToAddresses: [outbox.recipient] },
        Message: { Subject: { Data: subject, Charset: "UTF-8" }, Body: { Text: { Data: body, Charset: "UTF-8" } } },
      }));
    } else logger.info({ recipient: outbox.recipient, template: outbox.template }, "SES disabled; recording demo notification");
    await prisma.notificationOutbox.update({ where: { id: outbox.id }, data: { sentAt: new Date(), attempts: { increment: 1 }, lastError: null } });
  } catch (error) {
    await prisma.notificationOutbox.update({ where: { id: outbox.id }, data: { attempts: { increment: 1 }, lastError: error instanceof Error ? error.message.slice(0, 500) : "SEND_FAILED" } });
    throw error;
  }
}

export async function registerNotificationWorker() {
  const instance = await queue();
  await instance.work<{ outboxId: string }>(QUEUE, { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) await deliver(job.data.outboxId);
  });
  const pending = await prisma.notificationOutbox.findMany({ where: { sentAt: null }, select: { id: true } });
  for (const item of pending) await instance.send(QUEUE, { outboxId: item.id }, { singletonKey: item.id });
}

export async function stopQueue() {
  if (!bossPromise) return;
  const instance = await bossPromise;
  await instance.stop({ graceful: true, timeout: 10_000 });
  bossPromise = null;
}
