import { config } from "../config.js";
import { HttpError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";

export interface DevIdentity {
  auth0Subject: string;
  employeeNumber: string;
  displayName: string;
  email: string;
  departmentName: string;
  roles: string[];
}

/**
 * Demo authentication accepts any Employee Directory subject through the `x-demo-subject` header,
 * but the browser cannot know which subjects exist after a directory sync replaces the seeded rows.
 * This projection lets the identity switcher offer every synchronized employee. It is unavailable
 * whenever JWT authentication is active, so it can never widen access in production.
 */
export async function listDevIdentities(): Promise<{ identities: DevIdentity[] }> {
  if (!config.AUTH_DISABLED) throw new HttpError(404, "DEMO_IDENTITIES_UNAVAILABLE");
  const employees = await prisma.employeeMirror.findMany({
    where: { status: "ACTIVE" },
    include: { department: true },
    orderBy: { displayName: "asc" },
  });
  return {
    identities: employees.map((employee) => ({
      auth0Subject: employee.auth0Subject,
      employeeNumber: employee.employeeNumber,
      displayName: employee.displayName,
      email: employee.email,
      departmentName: employee.department.name,
      roles: employee.roles,
    })),
  };
}
