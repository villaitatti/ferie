# Ferie Portal

Internal bilingual absence-management portal for Villa I Tatti staff in Florence. The portal owns requests, approvals, imported balances, calendars, reconciliation, notifications, and audit history. Employee Directory remains authoritative for identity, employment status, schedules, departments, approval relationships, and application roles.

## Stack

- React 19, Vite, TypeScript, Tailwind CSS 4, shadcn/ui on Base UI, TanStack Query, i18next, FullCalendar
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

Open `http://localhost:5173`. Development defaults to demo authentication. The profile menu switches between staff, pre-approver, department head, HR/final approver, and IT identities, and between every synchronized employee once a directory sync has run.

The Prisma CLI and the seed script read `packages/server/.env`; link it to the repository root file with `ln -s ../../.env packages/server/.env`. `DEV_DB_PORT` moves the published database port when another checkout already uses `5433`; change the port in `DATABASE_URL` to match, because neither value is derived from the other and a mismatch connects the portal to whatever still listens on the old port. `PORT` moves the API when another checkout already uses `3000`, and the Vite dev proxy follows it.

### Interface

The interface is Tailwind CSS 4 plus [shadcn/ui](https://ui.shadcn.com) on Base UI primitives, which
is what shadcn installs by default. `components.json` pins `"style": "base-vega"`; a `shadcn add` run
with a different style would pull the Radix build of the same component instead. Nothing reaches for
the browser's own form chrome: dropdowns, date pickers, file pickers, numeric fields and tooltips are
all portal components, because native controls cannot be styled consistently and look different on
every platform.

- `src/index.css` holds the token set — the Villa I Tatti forest-green scale, plus the six status tones
  that absence states, balances and reconciliation cases share. Components read tokens, never literal
  colours; `src/lib/tone.ts` names the status mapping once.
- `src/components/ui` is the generated shadcn layer. Files added by `pnpm dlx shadcn@latest add` are
  kept as generated except where noted in a comment, so a later re-add is a readable diff. Several carry
  local fixes, each commented in place and worth re-checking after an upgrade: `tabs` (its orientation
  classes target `data-horizontal`, but Base UI emits `data-orientation`), `tooltip` (Base UI ships the
  popup without `role`) and `calendar`, which needed four — its day button never attaches the focus ref
  it creates, its navigation bar covers the caption and swallows clicks meant for it, its component
  overrides were built inline, so every render remounted the grid and could drop a click, and its month
  dropdown showed the raw month index because `items` was never passed to the select. `dialog`, `sheet`
  and `spinner` replace hardcoded English accessibility text with translations, and `button` adds a
  Mantine-style `loading` prop.
- The local additions are the controls shadcn does not ship: `segmented-control`, `number-field`,
  `file-field`, `date-field`, `combobox-field`, `stepper`, `form-field`, and `picker-surface`, which is
  the dropdown-versus-sheet switch every picker uses.
- `src/styles.css` carries only what utility classes cannot express — page and shell structure, and the
  calendar day markers, which sit on elements react-day-picker owns.
- Month and year navigation inside a calendar uses a Base UI select (`CalendarDropdown` in
  `ui/calendar.tsx`); shadcn's default keeps the trigger styled but still opens the operating system's
  own list.
- Base UI takes a slot element through `render` rather than Radix's `asChild`, and its state
  attributes are `data-open`/`data-closed`/`data-checked` rather than `data-state="…"`.

### Local Employee Directory

Point the portal at a locally running Employee Directory instead of an Auth0 tenant:

```bash
ED_BASE_URL=http://localhost:55031
ED_DEV_UNAUTHENTICATED=true
DEV_SUPERUSER_EMAILS=you@itatti.harvard.edu
MAIL_REDIRECT_TO=you@itatti.harvard.edu
```

`ED_DEV_UNAUTHENTICATED` skips the machine-to-machine token, because a local directory accepts unauthenticated calls through its own development escape hatch. It applies to the preferred-language write as well as the read, so a local directory that only exempts reads will sync correctly while language changes fail. A sync deactivates every mirror row the directory does not return and a real directory carries no Ferie application roles, so `DEV_SUPERUSER_EMAILS` grants `STAFF_IT`, `FERIE_PORTAL_ADMIN`, and `FERIE_FINAL_APPROVER` to the listed addresses on every sync. `MAIL_REDIRECT_TO` sends every notification to a single mailbox with the intended recipient in the subject, and the outbox keeps the real recipient for the audit trail; the server refuses to start outside production when a SES sender is configured without it. All three are rejected when `NODE_ENV=production`.

The identity switcher reads `GET /api/demo-identities`, which is available only while demo authentication is active.

The seeded default identity (Andrea) uses an early schedule starting at 07:30 (07:30–12:00 and 12:30–15:30). Marco and Giulia use the standard 09:00–13:00 / 13:30–17:00 day. In production, permesso time options come from each employee's ED work intervals. Seed balances are authoritative imports as of 30 June 2026. Do not use demo authentication in production.

Day-based absences follow the employee's ED schedule: each scheduled working date counts as one day regardless of FTE. FTE is mirrored and snapshotted for context and audit, but does not prorate request quantities or imported entitlements. Hourly permissions deduct only minutes covered by ED work intervals, so HR must maintain the actual working days and intervals for part-time employees in ED. Permesso cannot cover a full working day: at least 30 minutes of scheduled work must remain (so a 7.5-hour day allows at most 7 hours of permesso).

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

### Interface language

Employee Directory owns each employee's preferred language, so the portal opens in it. The header control switches language for the current browser tab only; the profile menu changes the stored preference, which the portal writes to the directory before mirroring it locally. A directory that rejects the write leaves the preference unchanged and the interface reports the failure, so the two never drift apart. Where no directory is configured the preference cannot be changed at all: the control is disabled rather than failing on use, because a local-only value would be a second source of truth.

Preferred language is the only field the portal writes back. It needs the `write:time-off-directory` scope in addition to read access, so a deployment that upgrades to this version must widen the machine-to-machine grant; language changes fail with `502` until it does. A sync that fetched its pages before a language write keeps the newer local value rather than mirroring the stale one back, and the following run reconciles from the directory again.

### Deployment order

`preferredLanguage` is required on every synchronized employee, and there is deliberately no fallback: a directory that does not yet serve the field fails the whole sync rather than guessing a language. Employee Directory must therefore ship the field and the write endpoint **before** this portal version is deployed. Until it does, `POST /api/it/directory-sync` and the scheduled sync fail with `ED_FETCH_404`, the mirror keeps its previous contents, and no employee data is lost.

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
