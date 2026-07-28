import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1).default("postgresql://ferie:ferie@localhost:5433/ferie"),
  AUTH_DISABLED: z.enum(["true", "false"]).transform((value) => value === "true"),
  AUTH0_DOMAIN: z.string().trim().default(""),
  AUTH0_AUDIENCE: z.string().trim().default(""),
  AUTH0_ROLES_CLAIM: z.string().default("https://itatti.harvard.edu/roles"),
  ED_BASE_URL: z.string().default(""),
  ED_CLIENT_ID: z.string().default(""),
  ED_CLIENT_SECRET: z.string().default(""),
  ED_AUDIENCE: z.string().default(""),
  ED_DEV_UNAUTHENTICATED: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  AWS_REGION: z.string().default("eu-south-1"),
  SES_FROM_EMAIL: z.string().default(""),
  MAIL_REDIRECT_TO: z.string().trim().default(""),
  DEV_SUPERUSER_EMAILS: z.string().trim().default(""),
  APP_BASE_URL: z.string().default("http://localhost:5173"),
});

export function parseConfig(environment: NodeJS.ProcessEnv) {
  const values = schema.parse({
    ...environment,
    AUTH_DISABLED: environment.AUTH_DISABLED ?? (environment.NODE_ENV === "production" ? "false" : "true"),
  });
  if (values.NODE_ENV === "production" && values.AUTH_DISABLED) {
    throw new Error("AUTH_DISABLED_NOT_ALLOWED_IN_PRODUCTION");
  }
  if (!values.AUTH_DISABLED && (!values.AUTH0_DOMAIN || !values.AUTH0_AUDIENCE)) {
    throw new Error("AUTH0_CONFIGURATION_REQUIRED");
  }
  if (values.NODE_ENV === "production" && values.ED_DEV_UNAUTHENTICATED) {
    throw new Error("ED_DEV_UNAUTHENTICATED_NOT_ALLOWED_IN_PRODUCTION");
  }
  if (values.NODE_ENV === "production" && values.DEV_SUPERUSER_EMAILS) {
    throw new Error("DEV_SUPERUSER_EMAILS_NOT_ALLOWED_IN_PRODUCTION");
  }
  if (values.NODE_ENV === "production" && values.MAIL_REDIRECT_TO) {
    throw new Error("MAIL_REDIRECT_NOT_ALLOWED_IN_PRODUCTION");
  }
  // Outside production every notification must be redirected to a single mailbox, so a development
  // database full of real Employee Directory addresses can never send mail to actual employees.
  if (values.NODE_ENV !== "production" && values.SES_FROM_EMAIL && !values.MAIL_REDIRECT_TO) {
    throw new Error("MAIL_REDIRECT_REQUIRED_OUTSIDE_PRODUCTION");
  }
  if (values.MAIL_REDIRECT_TO && !values.MAIL_REDIRECT_TO.includes("@")) {
    throw new Error("MAIL_REDIRECT_TO_INVALID");
  }
  return values;
}

export const config = parseConfig(process.env);

// Prisma reads DATABASE_URL directly instead of consuming the parsed config.
process.env.DATABASE_URL ??= config.DATABASE_URL;
