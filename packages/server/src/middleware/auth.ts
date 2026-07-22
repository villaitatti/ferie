import type { NextFunction, Request, Response } from "express";
import { expressjwt } from "express-jwt";
import jwksRsa from "jwks-rsa";
import { config } from "../config.js";

declare global {
  namespace Express {
    interface Request {
      auth?: Record<string, unknown>;
      actor: { subject: string; roles: string[]; email?: string; displayName?: string };
    }
  }
}

function demoAuth(req: Request, _response: Response, next: NextFunction) {
  const subject = req.header("x-demo-subject") ?? "auth0|demo-employee";
  req.auth = { sub: subject };
  next();
}

const jwtAuth = expressjwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${config.AUTH0_DOMAIN}/.well-known/jwks.json`,
  }) as jwksRsa.GetVerificationKey,
  audience: config.AUTH0_AUDIENCE,
  issuer: `https://${config.AUTH0_DOMAIN}/`,
  algorithms: ["RS256"],
});

export const authMiddleware = config.AUTH_DISABLED ? demoAuth : jwtAuth;

export function extractActor(req: Request, _response: Response, next: NextFunction) {
  const auth = req.auth ?? {};
  req.actor = {
    subject: typeof auth.sub === "string" ? auth.sub : "",
    roles: Array.isArray(auth[config.AUTH0_ROLES_CLAIM]) ? auth[config.AUTH0_ROLES_CLAIM] as string[] : [],
    email: typeof auth.email === "string" ? auth.email : undefined,
    displayName: typeof auth.name === "string" ? auth.name : undefined,
  };
  next();
}
