# Changelog

All notable changes to the Ferie Portal are documented in this file.

## [0.2.0] - 28 July 2026

### Added

- Preferred interface language mirrored from Employee Directory: the portal opens in each employee's
  own language, the header control switches language for the current tab only, and a profile setting
  changes the durable preference. The directory stays authoritative — the change is written there
  through `PATCH /api/v1/time-off-directory/employees/{id}/preferred-language` and mirrored locally
  only once it is accepted, so a rejected write reports an error instead of silently reverting. A sync
  that fetched its pages before such a write keeps the newer local value instead of mirroring stale
  data back, and the following run reconciles from the directory again. Where no directory is
  configured the setting is disabled rather than failing on use.

- Development wiring for a local Employee Directory: `ED_DEV_UNAUTHENTICATED` reads a directory that runs with its own authentication escape hatch instead of requesting an Auth0 machine-to-machine token, and `DEV_SUPERUSER_EMAILS` grants administration roles on every sync so a directory without application roles cannot lock the portal out.
- `MAIL_REDIRECT_TO` delivers every notification to one mailbox and to nobody else. It is mandatory outside production as soon as a SES sender is configured, and refused in production.
- Demo identity switcher backed by `GET /api/demo-identities`, listing every synchronized employee instead of five hard-coded subjects. It also renders on the "identity not found" screen, so a stale stored subject can be changed after a sync.
- `DEV_DB_PORT` publishes the development database on a configurable host port so parallel checkouts can each run their own.

### Fixed

- `pnpm db:seed` loads the environment file, so the documented setup sequence works without exporting `DATABASE_URL` by hand.

## [0.1.0] - 21 July 2026

### Added

- Bilingual, responsive employee portal built with React, Mantine, Express, Prisma, and PostgreSQL.
- Auth0 authentication and current-directory authorization with scoped Employee Directory synchronization.
- Ferie and hourly permesso requests, previews, balance allocation, approval, escalation, revision, cancellation, and audit history.
- Personal and department calendars with configurable visibility for sensitive absence types.
- Calendar picker metadata for holidays, closures, non-working days, approved requests, and pending requests, including localized tooltips.
- Imported-balance projections, future-absence imports, reconciliation cases, and administrator adjustments.
- HR-managed date-only entries for sickness, Legge 104, and parental leave.
- Notification outbox processing with pg-boss and plain-text AWS SES delivery.
- Docker Compose deployment and Cloudflare Tunnel integration configuration.
- GitHub Actions validation for migrations, typecheck, tests, and production builds.

### Changed

- Standardized human-readable dates as `DD MMMM YYYY`, with localized month names.
- Pending requests now reserve balance availability while the approved-only projection remains visible separately.
- Hourly permission requests can span unpaid schedule breaks and deduct only scheduled working minutes.
- Documented that scheduled working dates count as whole days regardless of FTE, while hourly permissions follow ED intervals.
- Future-absence files now validate completely and commit atomically, with row-level errors and no partial imports.

### Fixed

- Serialized employee request writes to prevent concurrent overlap and balance double-spend races.
- Added optimistic status guards for withdrawals, cancellations, approvals, and revision-parent transitions.
- Prevented HR-created sensitive absences from overlapping active requests, including concurrent submissions.
- Validated custom holiday rules and protected seeded national, local, and centre rules from administrative overwrite.
- Kept all authorized administration and integration destinations reachable from mobile navigation.
- Removed the production PostgreSQL host-port binding; the database is accessible only on the internal container network.
- Redacted absence and administration routes, query strings, credentials, and raw protected-route errors from technical HTTP logs.
- Recorded audit actor roles from the current Employee Directory mirror instead of potentially stale JWT claims.
- Made emailed request links open an authorized request detail with workflow history and available actions.
- Enabled Auth0 sign-out and preserved request deep links through the authentication redirect.
- Removed per-request follow-up queries from personal request lists and approval inboxes.
- Avoided displaying a missing imported balance as zero.
- Reduced the long-running production image to production dependencies and compiled artifacts, with migrations handled by a separate one-shot image.
- Limited directory reassignment notifications to recipients added by an actual approver change.
- Refused demo authentication in production, required complete Auth0 JWT configuration, and mapped JWT failures to HTTP 401.

[0.1.0]: https://github.com/villaitatti/ferie/releases/tag/v0.1.0
