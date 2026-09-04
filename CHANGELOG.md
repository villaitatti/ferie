# Changelog

All notable changes to the Ferie Portal are documented in this file.

## [0.5.0] - 26 August 2026

Establishes the email notification ground rules (docs/email-notification-rules.md): outside
production every notification goes to a single development mailbox and never to a real user, and in
production the director never receives portal mail — her notifications are delivered to the
designated substitute approver instead. Other substitute approvers remain outside every
notification audience, as before.

### Added

- Director mail delegation, driven by Employee Directory (time-off contract 1.1.0): the sync
  mirrors `isDirector` and `directorMailDelegate`, and at delivery time every notification
  addressed to the director is rerouted to the delegate's current mirrored email with the intended
  recipient noted in the subject (`[per …]`). The outbox row keeps the intended recipient, so the
  notification audit trail stays truthful.
- Fail-safe suppression: when the director has no delegate — or the delegate is inactive in the
  mirror — her mail is suppressed rather than delivered (never falling back to the director), the
  outbox records `suppressedAt`, and the AWS SES tile on the Integrations page turns to Attention
  with the reason and a suppressed-notification count.
- Delivery gate for the deployment window: whenever a directory is configured, the notification
  worker sends nothing until at least one sync has succeeded against the director-aware contract
  (recorded as `contractVersion` on the sync run). Without it, the upgrade deployment could drain
  queued mail to the director while every mirror row still said `isDirector = false`. Held mail is
  delayed, never lost: pg-boss retries, and each successful sync re-drains the outbox.
- Notifications now identify their recipient by directory source id, resolving the current email
  and the director flag from the mirror at delivery time — so a director email change while a
  notification sits unsent can no longer bypass delegation through a stale address. Legacy outbox
  rows without an id fall back to matching the stored address against the director rows.
- Employee overview for HR ("Situazione dipendenti"): final approvers and portal administrators see
  the whole roster with each employee's remaining balances per account (ferie, ex festività,
  permessi), pending amounts, and stale-snapshot warnings. The table is sortable (name, department,
  each balance), searchable by name/number/department, filterable by department and active status,
  and paginated at 50 rows with a 25/50/100/All selector and a result count. Balances are computed
  with the same snapshot-watermark semantics as the personal dashboard, in five set-wide queries
  for the whole roster. Adjustments from this view come later.

### Changed

- The copy introduced by the employee overview and the Integrations page (filters, paging, empty
  states, tile statuses and counts, the delegate warnings) moved from inline bilingual ternaries
  into i18next translation keys, gaining proper singular/plural forms for the integration counts.

## [0.4.0] - 25 August 2026

Implements the HR/CFO decisions of 25 August 2026 (docs/hr-cfo-open-questions.md, questions 1, 2, 4).

### Changed

- Department calendar privacy now follows the decided model: colleagues see the employee's name with
  a generic "Assente"/"Absent" and no absence type, while the employee's responsabile (or substitute)
  and HR (final approver or portal administrator roles) see the exact type. Everyone still sees their
  own entries in full. The per-type visibility setting in Administration keeps working as the
  baseline: EXACT re-broadens a type for all colleagues, HIDDEN removes it from the department
  calendar for every viewer, with no exception for HR. All seeded absence types now default to the
  generic level, and a data migration moves existing EXACT rows to the same baseline on upgrade.
  The sensitivity flag is masked together with the label, because the calendar colours sensitive
  entries differently and a truthful flag would tell colleagues a generic "absent" is health- or
  family-related.
- The 37.5-hour full-time week (question 1) and manual HR entry of sickness with no INPS delegation
  (question 4) are confirmed as decided and recorded in the research and launch-gates notes; neither
  changes portal behavior, which already worked this way.

## [0.3.1] - 25 August 2026

### Fixed

- The main content area no longer shrinks to the width of its own content: inside the sidebar layout
  the page was exempt from the flexbox stretch because of its centring margins, so on large monitors
  it huddled, tiny, in the middle of the screen. The page now always fills the available width, and
  its cap grows with the viewport — 1440px on laptops, up to 1840px on desktop displays such as a
  27-inch Studio Display — so tables never stretch absurdly wide either.

## [0.3.0] - 24 August 2026

This release aligns the portal with Libra's stack so the two apps stay easy to maintain together.

### Added

- The I Tatti wordmark sits at the centre of the header, exactly as in Libra: crimson mark, theme-aware
  lettering, hidden on phones where the header carries the Ferie brand instead.
- Dark mode. The header gains a theme toggle next to the language switch; the choice persists across
  visits and, on first visit, follows the operating system preference. Every design token — the shadcn
  set, the sidebar, the charts and the seven status tones — has a dark counterpart, so status chips,
  the toasts, the request calendar markers and the department calendar all repaint. The theme is
  applied before first paint by an external bootstrap script, so a reload never flashes the wrong
  theme, and the browser chrome colour follows along.
- The navigation is now the shadcn sidebar shared with Libra: collapsible to an icon rail from the
  header toggle or with Cmd/Ctrl+B, resizable by dragging its edge, and remembered across visits. On
  desktop the brand moved from the header into the sidebar; phones keep the bottom tab bar and get the
  same sidebar as a drawer.

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
- The toolchain now matches Libra's: Vite 8 (Rolldown), Base UI 1.7, i18next 26, Zod 4, Prisma 7 with
  the Postgres driver adapter (no more native engines — the Docker image drops the engine-copying
  step and its openssl dependency, and the Prisma CLI reads the root `.env` through `prisma.config.ts`
  so database commands work from any directory), Express 5, express-rate-limit 8 and jwks-rsa 4.
- Biome now lints the whole repository (the same lint-only configuration as Libra) and CI runs it
  between the migrations and the typecheck. The request-picker legend became a real list element and
  a handful of implicitly-typed variables and hook dependencies were tightened along the way.

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
