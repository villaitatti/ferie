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
  const directoryActor = await prisma.employeeMirror.findUnique({
    where: { auth0Subject: request.actor.subject },
    select: { roles: true },
  });
  const actorRoles = directoryActor?.roles ?? [];

  await prisma.auditEvent.create({
    data: {
      actorSubject: request.actor.subject,
      actorRole: actorRoles[0] ?? null,
      action,
      entityType,
      entityId,
      requestId: entityType === "AbsenceRequest" ? entityId : undefined,
      ipAddress: request.ip,
      metadata: { ...metadata, actorRoles } as Prisma.InputJsonValue,
    },
  });
}
