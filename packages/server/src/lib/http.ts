import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";
import { logger } from "./logger.js";

export class HttpError extends Error {
  constructor(public status: number, public code: string, message = code) {
    super(message);
  }
}

export const asyncHandler = (handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (request, response, next) => { void Promise.resolve(handler(request, response, next)).catch(next); };

export function errorHandler(error: unknown, request: Request, response: Response, _next: NextFunction) {
  if (error instanceof ZodError) return response.status(400).json({ code: "VALIDATION_ERROR", issues: error.issues });
  if (error instanceof HttpError) return response.status(error.status).json({ code: error.code, message: error.message });
  if (typeof error === "object" && error !== null && "name" in error && error.name === "UnauthorizedError") {
    return response.status(401).json({ code: "UNAUTHORIZED" });
  }
  logger.error({ err: error, path: request.path }, "Unhandled request error");
  return response.status(500).json({ code: "INTERNAL_ERROR" });
}
