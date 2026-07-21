import cors from "cors";
import express from "express";
import path from "node:path";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";
import { authMiddleware, extractActor } from "./middleware/auth.js";
import { api } from "./routes.js";
import { errorHandler } from "./lib/http.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: config.WEB_ORIGIN, credentials: true }));
  app.use(pinoHttp({ logger }));
  app.use(express.json({ limit: "1mb" }));
  app.get("/api/health", (_request, response) => response.json({ status: "ok", service: "ferie-portal" }));
  app.use("/api", rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: "draft-7", legacyHeaders: false }), authMiddleware, extractActor, api);
  if (config.NODE_ENV === "production") {
    const webRoot = path.join(process.cwd(), "packages/web/dist");
    app.use(express.static(webRoot));
    app.get(/^\/(?!api(?:\/|$)).*/, (_request, response) => response.sendFile(path.join(webRoot, "index.html")));
  }
  app.use(errorHandler);
  return app;
}
