# Changelog

All notable changes to the Ferie Portal are documented in this file.

## [0.1.0] - 21 July 2026

### Added

- Bilingual, responsive employee portal built with React, Mantine, Express, Prisma, and PostgreSQL.
- Auth0 authentication and current-directory authorization with scoped Employee Directory synchronization.
- Ferie and hourly permesso requests, previews, balance allocation, approval, escalation, revision, cancellation, and audit history.
- Personal and department calendars with configurable visibility for sensitive absence types.
- Calendar picker metadata for holidays, closures, non-working days, approved requests, and pending requests, including localized tooltips.
- Imported-balance projections, future-absence imports, reconciliation cases, and administrator adjustments.
- HR-managed date-only entries for sickness, Legge 104, and parental leave.
- Notification outbox processing with pg-boss and AWS SES/MJML support.
- Docker Compose deployment and Cloudflare Tunnel integration configuration.

### Changed

- Standardized human-readable dates as `DD MMMM YYYY`, with localized month names.
- Pending requests now reserve balance availability while the approved-only projection remains visible separately.
- Hourly permission requests can span unpaid schedule breaks and deduct only scheduled working minutes.

### Fixed

- Serialized employee request writes to prevent concurrent overlap and balance double-spend races.
- Added optimistic status guards for withdrawals, cancellations, approvals, and revision-parent transitions.
- Limited directory reassignment notifications to recipients added by an actual approver change.
- Refused demo authentication in production, required complete Auth0 JWT configuration, and mapped JWT failures to HTTP 401.

[0.1.0]: https://github.com/villaitatti/ferie/releases/tag/v0.1.0
