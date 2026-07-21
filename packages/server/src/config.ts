import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1).default("postgresql://ferie:ferie@localhost:5433/ferie"),
  AUTH_DISABLED: z.enum(["true", "false"]).default(process.env.NODE_ENV === "production" ? "false" : "true").transform((value) => value === "true"),
  AUTH0_DOMAIN: z.string().default(""),
  AUTH0_AUDIENCE: z.string().default(""),
  AUTH0_ROLES_CLAIM: z.string().default("https://itatti.harvard.edu/roles"),
  ED_BASE_URL: z.string().default(""),
  ED_CLIENT_ID: z.string().default(""),
  ED_CLIENT_SECRET: z.string().default(""),
  ED_AUDIENCE: z.string().default(""),
  AWS_REGION: z.string().default("eu-south-1"),
  SES_FROM_EMAIL: z.string().default(""),
  APP_BASE_URL: z.string().default("http://localhost:5173"),
});

export const config = schema.parse(process.env);

// Prisma reads DATABASE_URL directly instead of consuming the parsed config.
process.env.DATABASE_URL ??= config.DATABASE_URL;
