# SusuPro — Major Security Requirements

Documented now so Phase 12 (security hardening) is a verification pass against a known standard, not the first time these requirements are written down.

## Authentication
- Argon2id or bcrypt password hashing; never plaintext.
- Strong password policy (minimum length at minimum; exact policy TBD — see unresolved questions).
- Secure sessions with expiration and server-side invalidation (logout, and forced revocation, must take effect immediately — not "eventually, when the token expires").
- Brute-force and rate-limit protection on login specifically, tighter than the general API rate limit.
- Secure password reset process (mechanism TBD — see unresolved questions; likely needs an out-of-band channel like SMS for workers who forget a password with no active session).
- Session fixation protection: a new session is always issued on login, never reused from a pre-auth state.

## Authorization
- Server-side RBAC on every route, with no exceptions. Frontend UI hiding is never treated as a control.
- Every object-level access (e.g., "view this specific customer") is checked against the authenticated user's actual permissions, not inferred from a client-supplied ID alone (IDOR/BOLA prevention).

## Data protection
- Parameterized queries exclusively — no string-built SQL anywhere, ever.
- Output encoding wherever user-supplied text is rendered, to prevent XSS.
- CSRF protection if cookie-based sessions are ever used (bearer-token APIs are not subject to CSRF in the same way, but this must be re-verified if the auth mechanism changes).
- Mass-assignment protection: every write explicitly lists the fields it accepts from the client; nothing is spread wholesale from a request body into a database write.
- No secrets in frontend source code, ever — all secrets live in backend environment variables (see `backend/.env.example`).

## Financial-integrity-specific
- No balance is ever a directly writable field — always derived from the transaction ledger.
- Every balance-affecting operation happens inside a single atomic database transaction alongside its audit log entry.
- Idempotency protection against duplicate submissions (double-click, network retry) on financial-write endpoints.
- Concurrent-request protection (row locking and/or serializable isolation) so two simultaneous operations on the same account can't both succeed if only one should.
- Completed financial transactions are never edited or deleted — corrections/reversals are new, linked records.

## Error handling
- Generic error messages to the client; full detail only in server-side logs. No stack traces, no raw database error text, no internal implementation detail reaches a response body.

## Audit
- Append-only audit log, enforced at both the application layer (no mutating endpoint exists) and, once implemented, the database layer (a trigger rejects direct mutation attempts too).

## Device/session security (once Phase 16 exists)
- A tablet's session must be revocable independently of the worker's own password — losing a tablet should not require also assuming the worker's credentials are compromised, and vice versa.

This document will be referenced, not rewritten, in Phase 12 — that phase's job is to test each of these against the actual implementation and report PASS/FAIL per item, not to re-derive the list.
