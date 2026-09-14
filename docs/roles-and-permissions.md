# SusuPro — User Roles & Permissions

## Roles (minimum, per the master prompt)

### ADMIN
Full authorized access: manage workers, register/manage customers, view all accounts/deposits/withdrawals/balances/transaction history, approve/reject withdrawals, view reports, view worker activity, view audit logs, manage devices, manage security settings, monitor system activity.

### WORKER
Only authorized collection/customer functions: log in, search customers, register customers (**CONFIRMED with the business owner: workers register customers unsupervised, since they're the ones visiting the community** — see unresolved-questions.md), view customer information, record deposits, initiate withdrawals (subject to the two-person approval workflow), view relevant transaction history, view their own collection activity, use the system from an Android tablet.

## Enforcement principle

Authorization is a backend concern, full stop. The frontend hiding a button or not rendering a page is a UX convenience, never a security boundary. Every backend route independently re-checks the authenticated user's role before doing anything — a worker manually constructing an HTTP request to an admin-only endpoint must be rejected by the backend regardless of what the frontend would have shown them. Phase 6 builds and tests this explicitly (including the specific test: "a worker cannot access admin APIs even if they manually construct requests").

## Anticipated permission granularity

The master prompt lists a `permissions` table alongside `roles` in the database entities (Section 17), which signals that ADMIN/WORKER may not stay a flat binary forever — a `role_permissions` join table (rather than hard-coding "if role === admin" everywhere) is the intended design so a future role (e.g., a supervisor who can approve withdrawals but not manage workers) doesn't require restructuring the whole authorization system. This is a Phase 3 (database) and Phase 6 (enforcement) concern — noted here so the intent is on record before either phase begins.

## Device-level access (Section 19)

Beyond user roles, the master prompt introduces device-level control for tablets: a device can be registered, assigned to a specific worker, deactivated, or reactivated, and an admin can revoke sessions tied to a device. This is a second axis of control alongside user roles — a valid worker login from an unassigned or deactivated device should be rejected. This is Phase 16 work, flagged here so the roles model is designed with it in mind rather than retrofitted.
