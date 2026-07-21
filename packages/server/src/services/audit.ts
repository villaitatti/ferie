import type { Request } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export async function audit(
  request: Request,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  await prisma.auditEvent.create({
    data: {
      actorSubject: request.actor.subject,
      actorRole: request.actor.roles[0],
      action,
      entityType,
      entityId,
      requestId: entityType === "AbsenceRequest" ? entityId : undefined,
      ipAddress: request.ip,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}
