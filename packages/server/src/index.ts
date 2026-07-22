import cron from "node-cron";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { syncDirectory } from "./services/directory.js";
import { registerNotificationWorker, stopQueue } from "./services/queue.js";

const server = createApp().listen(config.PORT, () => logger.info({ port: config.PORT }, "Ferie API listening"));

registerNotificationWorker().catch((error) => logger.error({ err: error }, "Notification worker did not start"));
if (config.ED_BASE_URL) {
  void syncDirectory().catch(() => undefined);
  cron.schedule("*/15 * * * *", () => { void syncDirectory().catch(() => undefined); });
}

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  server.close();
  await stopQueue().catch(() => undefined);
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
process.on("SIGINT", () => { void shutdown("SIGINT"); });
