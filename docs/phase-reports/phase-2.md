# PHASE 2 — Threat Model & Security Architecture

## Threat Model

| Threat | Affected Component | Likelihood | Impact | Risk | Mitigation | Testing Approach |
|---|---|---|---|---|---|---|
| Stolen worker credentials | Auth | Medium | High | High | bcrypt hashing, rate limiting, account lockout, short session TTL, revocable sessions | Phase 6 tests: brute-force attempt, lockout after N failures |
| Malicious/dishonest worker | Deposits, customer registration | Medium | Medium-High | High | Least-privilege RBAC (no admin functions reachable), immutable ledger (can't hide a bad transaction), audit trail | Phase 6/7 authorization tests; process-level: owner reviews new registrations periodically (not a technical control) |
| Compromised admin account | Everything | Low-Medium | Critical | Critical | Strong password policy, session revocation, (future) MFA — flagged as a gap, same as the prior project's finding | Phase 12 review; MFA implementation tracked as an open item, not silently skipped |
| IDOR/BOLA | Any endpoint taking an ID | Medium | High | High | Every query scopes by the authenticated user's permissions, never trusts a client-supplied ID alone for authorization | Phase 6/7 tests: attempt to access another user's/customer's data by guessing IDs |
| SQL injection | Any DB query | Low (mitigated by design) | Critical | Critical (if unmitigated) | Parameterized queries exclusively, enforced by code review discipline from Phase 5 onward | Phase 12: direct code audit (grep for string-built SQL), manual injection attempts against a running instance |
| XSS | Any rendered user input | Low-Medium | High | Medium-High | React's default escaping; explicit escaping if raw HTML rendering is ever used (avoided) | Phase 12: attempt script injection via customer name, notes fields |
| CSRF | Any state-changing endpoint | Low (bearer-token API) | Medium | Low-Medium | Bearer tokens in Authorization header, not ambient cookies — CSRF requires an ambient credential the browser sends automatically, which this design doesn't use | Re-verify if cookie-based auth is ever introduced |
| Brute force | Login endpoint | Medium | High | High | Dedicated login rate limiter (tighter than general API limiter), account lockout after repeated failures | Phase 6 test: repeated failed logins |
| Session attacks (fixation/hijacking) | Sessions | Low-Medium | High | Medium-High | New session issued on every login, server-side revocable sessions, short TTL | Phase 6 test: logout revokes token immediately |
| Privilege escalation | Any write endpoint | Low (mitigated) | Critical | High | No route ever trusts a client-supplied role/permission field; role always derived from the server-side session | Phase 6/12 test: attempt to submit a role field in a registration/update request |
| Authentication bypass | Auth middleware | Low (mitigated) | Critical | High | requireAuth checked before requireRole on every protected route, no route skips it | Phase 6 test: unauthenticated request to a protected route |
| API abuse (scripted overuse) | All endpoints | Medium | Medium | Medium | General rate limiter (Phase 1) + endpoint-specific limiters where risk is higher (login, withdrawal creation) | Phase 12/13: load test against rate limits |
| Parameter tampering | Any endpoint with amounts/IDs | Medium | High | High | Server-side validation and re-verification of every financial parameter, never trusting a client-echoed value (e.g., balance) | Phase 8/9 tests: submit tampered amounts, mismatched IDs |
| Mass assignment | Any create/update endpoint | Low (mitigated) | Medium-High | Medium | Every write explicitly destructures accepted fields; nothing is spread wholesale from request body | Phase 12: attempt to inject unexpected fields (role, status) into a registration request |
| Duplicate financial submissions | Deposits, withdrawal requests | Medium-High (real-world network retries) | Medium-High | High | Idempotency keys on financial-write endpoints | Phase 8 tests: identical request retried, concurrent identical requests |
| Concurrent transactions / race conditions | Deposits, withdrawal approvals | Medium | Critical | Critical | Row locking (`FOR UPDATE`) + SERIALIZABLE isolation with retry-on-conflict | Phase 8/9/13 concurrency tests |
| Balance manipulation | Ledger | Low (mitigated by design) | Critical | Critical | No balance column exists anywhere to manipulate; balance is always derived; DB trigger blocks any negative-resulting entry | Phase 3/8/9 tests: attempt direct balance edit, attempt overdraft |
| Audit-log tampering | Audit logs | Low (mitigated) | Critical | High | Append-only at both application layer (no mutating route) and database layer (trigger) | Phase 10 test: attempt direct UPDATE/DELETE on audit_logs |
| Lost/stolen tablet | Device sessions | Medium | High | High | Device-scoped, independently revocable sessions (Phase 16) — losing a tablet doesn't require assuming the worker's password is compromised | Phase 16 test: revoke a device's session, confirm the worker's other sessions remain valid |
| Database compromise | PostgreSQL | Low | Critical | Critical | Least-privilege application DB role, network-restricted DB access, encrypted backups | Phase 15 deployment checklist |
| Backup compromise | Backup storage | Low | High | Medium-High | Backups encrypted at rest, stored off the primary server, access-restricted | Phase 14 |
| Information disclosure via error messages | Any endpoint | Low (mitigated, Phase 1) | Medium | Low-Medium | Centralized error handler returns generic messages; detail logged server-side only | Already implemented in Phase 1; re-verified in Phase 12 |

## Security Architecture Decisions Made Now

1. **Authorization model:** RBAC via `roles` + `permissions` + `role_permissions` join table (Phase 3), enforced by backend middleware on every route (Phase 6), never by frontend rendering.
2. **Session model:** server-side `sessions` table referenced by a bearer JWT holding only a session ID — the JWT itself carries no authorization claims, so revoking the session row is sufficient to kill access immediately, without needing short-lived tokens with constant re-issuance.
3. **Financial integrity model:** immutable ledger (append-only, DB-trigger-enforced), derived balances (no writable balance column), idempotency keys on write endpoints, SERIALIZABLE isolation with conflict retry for concurrent financial operations.
4. **Device model (Phase 16 forward):** device identity is separate from user identity — a `devices` table with its own status, and `device_sessions` linking a session to the device it originated from, so device-level revocation doesn't require touching user credentials.

## What Phase 2 does NOT do

No code changes in this phase beyond documentation — Phase 3 builds the schema these decisions inform, and Phase 6 builds the enforcement. This phase's job is to have the threat model on record before either of those starts, per the master prompt's phase discipline.
