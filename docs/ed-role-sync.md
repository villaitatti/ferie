# Employee Directory role synchronization

Employee Directory owns the `FERIE_FINAL_APPROVER` and `FERIE_PORTAL_ADMIN` assignments. Its application-role table stores the Auth0 role ID; HR assigns the application role to an employee, while IT manages only the mapping.

Each role-assignment transaction writes an outbox event in the same database transaction. A worker aggregates the employee's desired Auth0 roles, calls the Auth0 Management API to add and remove mapped roles, and records attempts, last error, and synchronized timestamp. Failed calls retry with bounded exponential backoff. A nightly reconciliation compares desired ED assignments with Auth0 and emits new outbox work for drift.

ED changes remain valid if Auth0 is temporarily unavailable. Ferie authorizes requests against its current ED mirror and relationship assignments, so a stale Auth0 token or delayed role removal never grants object-level access. Role changes appear in Auth0 claims only after a new token is issued; production API access-token lifetime should therefore be kept short.
