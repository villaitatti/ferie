# Changelog

All notable changes to the Ferie Portal are documented in this file.

## Unreleased

### Changed

- Rebuilt the interface on Tailwind CSS 4 and shadcn/ui, replacing Mantine. Every control is now a
  Base UI primitive styled from one token set, and no browser-native form chrome ships: the dropdowns,
  the date pickers, the file pickers, the numeric fields and the tooltips are all portal components.
  The forest-green palette, spacing and copy are unchanged.
- Base UI rather than Radix, which is what shadcn/ui installs by default as of July 2026. Radix is not
  deprecated and remains supported upstream; Base UI was chosen while the portal has no users, rather
  than later with a live installed base. It also removed hand-written code: the numeric field and the
  filtering employee picker are now library primitives, which retired the `cmdk` dependency.
- The segmented control is a radio group rather than a toggle group, so a mutually exclusive choice
  announces as `radiogroup`/`radio` instead of a row of independently pressed buttons.
- The request date picker keeps its behaviour exactly: the same progressive range selection (click a
  second time on one day for a single day), holiday, closure, non-working, approved and pending day
  markers, the localized day summaries on hover, the legend, the conflict and unavailable notices, and
  a dropdown on a pointer device against a full-screen sheet on a phone. Month navigation gains back
  the month and year grid behind the caption, on a Base UI select rather than the operating system's.
- The department calendar is driven by portal buttons; FullCalendar's own toolbar is no longer rendered.
- Controls that open a panel rather than hold a value — the date pickers, the comboboxes, the file
  fields — now name themselves with `aria-labelledby`, because a `<label for>` does not name a button.
  The accessible name includes the current value, and a field's help text and validation error are
  announced on focus through `aria-describedby`.
- The production build groups React by module path rather than package name, so the framework chunk
  actually contains `react-dom`'s code and stays cached across deploys instead of being re-downloaded
  with every application change.

### Fixed

- Hovering a marked day in the request picker shows its summary reliably. Tracking the pointer across
  every cell re-rendered the grid and cancelled the tooltip before it opened; the hover band is now
  only tracked while a range is half-open.
- The request picker dismisses itself once a period is settled — both a range and the same date clicked
  twice — and stays open when the selection is refused, so the next pick can be made straight away.
- Clicking the month caption opens the month and year grid. The day-picker navigation bar is absolutely
  positioned across the whole top strip and was swallowing the click meant for the caption beneath it.
- A second click could be lost while picking a period. The generated calendar builds its component
  overrides inline, so every render handed React new component types and remounted the grid; a remount
  between mousedown and mouseup means the browser never fires a click. Hoisting them also lets the day
  summaries open while a range is half-open, which the remount had made impossible.
- Closed selects show the selected option's label again rather than its raw value — the language picker
  read "IT" instead of "Italiano", the administration selects showed bare codes such as "MALATTIA", and
  the calendar's month dropdown showed a month index. Base UI resolves the closed trigger's text from an
  `items` list on the root, because the options themselves are unmounted while the popup is shut.
- Reopening the request picker no longer paints a leftover preview band. Completing a range closes the
  panel before any pointer-leave can fire, so the last hovered day survived the close and the next
  half-open range drew a band out to it.
- Buttons that start a server operation show a spinner while it runs, as they did before the migration —
  saving, importing and committing balances, approving, declining and withdrawing. The `Button`
  component takes a `loading` prop that disables it and leads with the spinner.
- Screen-reader text ships in the interface language: the dialog and sheet close buttons announced the
  English "Close" regardless of language, the spinner hardcoded "Loading", and the year arrows in the
  month-and-year grid announced only the bare target year rather than the action.
- The administration tab list grows in height when its five tabs wrap on a narrow screen, instead of
  keeping a single-row height and letting the wrapped tabs slide under the active panel.
- The mobile picker dialog is bounded to the viewport and scrolls internally, so a phone held in
  landscape can still reach the close button and every calendar row.
- Administration date fields reach any year the server accepts. The month-and-year dropdown gave them
  an incidental ±5-year window, which cut off valid historical records; the window is now generous and
  always stretches to cover the field's value and explicit bounds.
- Local corrections to generated components, each commented where it is applied: the tab list
  styled its orientation against an attribute Base UI does not emit, which laid the panels out beside
  the tabs instead of below them; the calendar's day button never attached the ref it focuses, so
  arrow-key navigation did not move; and the tooltip popup shipped without a `role`.

### Added

- The Vite dev proxy follows the API's configured `PORT`, so parallel checkouts each reach their own
  server instead of whichever one claimed 3000 first.

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
