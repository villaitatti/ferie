# Email notification ground rules

Decided by Andrea Caselli on 25 August 2026. These rules govern who may ever receive an email from
the Ferie Portal, in every environment. The delivery mechanics live in
`packages/server/src/services/queue.ts` (`mailDelivery`) and the guards in
`packages/server/src/config.ts`.

## Rule 1 — Outside production, only Andrea receives mail

On local checkouts and on the dev instance, every notification goes to
**acaselli@itatti.harvard.edu** and never to a real user, regardless of who the intended recipient
is. The intended recipient is preserved in the subject (`[dev → …]`) and in the outbox row for the
audit trail.

Enforcement: `MAIL_REDIRECT_TO=acaselli@itatti.harvard.edu` must be set in every non-production
`.env`. The server refuses to start outside production when `SES_FROM_EMAIL` is set without a
redirect mailbox (`MAIL_REDIRECT_REQUIRED_OUTSIDE_PRODUCTION`), and refuses the redirect in
production (`MAIL_REDIRECT_NOT_ALLOWED_IN_PRODUCTION`), so the rule cannot be silently skipped in
either direction.

## Rule 2 — In production, the director never receives mail

The director (**Alina Payne**) must never receive an email from the portal. Every notification that
would be addressed to her is delivered instead to her designated substitute approver, **Susan
Bates**, who approves on the director's behalf. The subject notes the intended recipient
(`[per …]`) and the outbox row keeps the director as the recorded recipient.

Enforcement: Employee Directory is authoritative. ED marks the director (`isDirector`) and, only on
her, an optional mail delegate (`directorMailDelegate.employeeSourceId`) in the time-off projection
(contract 1.1.0, `docs/employee-directory-openapi.yaml`); HR manages the delegate in ED, and the
portal mirrors both fields on every sync. Every outbox row records the intended recipient by
directory source id, and at delivery time the portal resolves the recipient's **current** email,
the director flag, and the delegate's current email from the mirror — so a director email change
while a notification sits unsent cannot leave a stale, undelegated address in the queue. Rows
enqueued before source ids were recorded fall back to matching the stored address against the
director rows, case-insensitively.

Deployment gate: the mirror only knows who the director is after the first successful sync against
the director-aware contract (recorded as `contractVersion` on `DirectorySyncRun`). Whenever a
directory is configured, the notification worker refuses to send **anything** until such a run
exists — otherwise the upgrade deployment could drain queued mail to the director while every
mirror row still says `isDirector = false`. Held mail is delayed, never lost: pg-boss retries the
refused job, and every successful sync re-drains the outbox.

Fail safe: when the director has no delegate, or the delegate is INACTIVE in the mirror, the
portal **suppresses** the director's mail instead of delivering it — never falling back to the
director herself. Suppressed notifications are recorded on the outbox row (`suppressedAt`, final:
they are not retried once a delegate appears, because by then they would be stale) and surfaced as
a warning on the Integrations page until ED is fixed.

This covers every notification path: approval requests where the director is the responsabile,
final-approval fan-out if she holds `FERIE_FINAL_APPROVER`, reassignment notices from directory
sync, and outcome mail on her own requests.

## Rule 3 — Other substitute approvers receive nothing

Besides Susan Bates there are two further substitute approvers. They may decide requests in the
portal but are **not** part of any notification audience. This is the existing model
(`SUBSTITUTE_RESPONSABILE` assignments are never selected as recipients — see
`approverRecipients()` in `packages/server/src/services/portal.ts` and README "Normal approval"
notes); do not add substitutes to any recipient list without a new decision recorded here.

Susan Bates receives the director's mail through Rule 2's delegation, not by being a notification
recipient in her own right.
