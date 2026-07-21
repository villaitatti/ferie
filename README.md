# Ferie Portal

Internal bilingual absence-management portal for Villa I Tatti staff in Florence. The portal owns requests, approvals, imported balances, calendars, reconciliation, notifications, and audit history. Employee Directory remains authoritative for identity, employment status, schedules, departments, approval relationships, and application roles.

## Stack

- React 19, Vite, TypeScript, Mantine, TanStack Query, i18next, FullCalendar
- Express, Prisma, PostgreSQL 17, Auth0 JWT validation
- pg-boss notification queue and AWS SES
- pnpm 10 monorepo with shared Zod contracts and domain rules
- Docker Compose deployment behind the existing Cloudflare Tunnel network

## Local development

Node 22, pnpm 10.32.1, and Docker are required.

```bash
cp .env.example .env
pnpm install
pnpm dev:db
pnpm db:deploy
pnpm db:seed
pnpm dev
```

Open `http://localhost:5173`. Development defaults to demo authentication. The profile menu switches between staff, pre-approver, department head, HR/final approver, and IT identities.

The seeded schedule is Monday-Friday, 09:00-13:00 and 13:30-17:00. Seed balances are authoritative imports as of 30 June 2026. Do not use demo authentication in production.

Day-based absences follow the employee's ED schedule: each scheduled working date counts as one day regardless of FTE. FTE is mirrored and snapshotted for context and audit, but does not prorate request quantities or imported entitlements. Hourly permissions deduct only minutes covered by ED work intervals, so HR must maintain the actual working days and intervals for part-time employees in ED.

Normal approval is a single peer decision, not a pre-approver-to-responsabile chain. All configured pre-approvers are notified, or all responsabili when no pre-approver exists; either group and any configured substitute may decide, while substitutes are not part of the default notification audience.

## Production configuration

Set `AUTH_DISABLED=false`, Auth0 domain/audience values, ED M2M credentials, a strong database password, the SES sender, and the public application URL. Register that application origin in Auth0 as an allowed callback URL, logout URL, and web origin. The server refuses to start in production with demo authentication or incomplete Auth0 JWT configuration. The frontend Auth0 values are Docker build arguments because Vite embeds them at build time.

Production PostgreSQL is reachable only from the Compose `internal` network. Port `5433` is published by `docker-compose.dev.yml` for local development only.

HTTP technical logs exclude request and response bodies, credentials, cookies, query strings, and identifying subpaths for request, calendar, approval, and administration endpoints. Detailed absence access remains in the application audit log rather than infrastructure logs.

The Compose migration service runs `prisma migrate deploy` and must complete successfully before the portal starts:

```bash
docker compose up -d --build
```

Employee Directory must implement [the minimal OpenAPI projection](docs/employee-directory-openapi.yaml) and [the Auth0 role synchronization design](docs/ed-role-sync.md). Ferie synchronizes the projection every 15 minutes and authorizes every object operation against the current local mirror.

## Imports

Balance imports accept CSV/XLSX columns `employeeNumber`, `accountCode`, `amount`, and `asOf`; the commit also requires an explicit cutoff date. Use [the balance template](docs/zucchetti-import-template.csv).

Opening future absences accept CSV/XLSX rows grouped by `externalReference`, permitting ferie/ex-festività splits across multiple rows. The entire file is validated and committed in one transaction; if any row fails, no absences are imported and the UI reports the row errors. Use [the future-absence template](docs/zucchetti-future-absences-template.csv). Both flows match employees only by ED employee number.

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build
```

Key behavior is covered by unit tests for Italian/Easter holiday rules, working-day and hourly calculations, allocation validation, and the approval state machine. Server tests cover health and baseline security headers. Live smoke testing should use a disposable PostgreSQL database because request and import workflows intentionally create audit records.

GitHub Actions runs migrations, typecheck, the complete test suite, and the production build for every pull request and every push to `main`.
