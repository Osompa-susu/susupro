# PHASE 3 REPORT — PostgreSQL Database

## 1. What was built
Eight numbered migrations plus a demo-data seed file, implementing: granular RBAC (roles/permissions/role_permissions), users (with force-password-change and MFA fields built in from the start), customers/accounts, an immutable append-only financial ledger with derived balances and idempotency support, withdrawal requests + approvals, append-only audit logs and security events, and sessions + devices for future tablet support.

## 2. Files created
`database/migrations/001_roles_permissions.sql` through `008_least_privilege_role.sql`, `database/seed_demo_data.sql`.

## 3. Files modified
None.

## 4. Database changes
Full schema as described above. Key design decisions, made correctly from the start based on lessons from a prior project rather than repeating its mistakes:
- `customer_code` and `transaction_code` generated via `SEQUENCE` + column `DEFAULT`, never `COUNT(*)+1` (avoids a real concurrency bug the prior project shipped and had to fix).
- The negative-balance trigger checks **any** completed entry with a negative amount (withdrawal or correction), not just `entry_type='withdrawal'` — the prior project's narrower version had a real gap where a correction could retroactively overdraw an account; started correct here.
- `idempotency_key UNIQUE` on `ledger_entries` from the start.
- `devices`/`sessions.device_id` modeled now, so Phase 16 doesn't require a schema migration later.

## 5. API changes
None — Phase 3 is database only.

## 6. Tests performed
- Parenthesis-balance check across all SQL files (a basic sanity check, not a substitute for actually running them).
- Manual review of every foreign key, constraint, and trigger against the design intent.
- **Not tested:** actually running these migrations against a real PostgreSQL instance — no database server exists in this environment. This is the same limitation as Phase 1's npm install gap, and is equally important to close before trusting this schema further.

## 7. Tests passed
The static checks above.

## 8. Tests failed
None run could fail; see "not tested" above for what's outstanding.

## 9. Security issues discovered
None new — this migration set deliberately incorporates the two real fixes discovered in the prior project's security review (customer-code race condition, correction-can-go-negative gap) as day-one design decisions rather than later patches.

## 10. Problems encountered
No live PostgreSQL instance available to actually apply and verify these migrations in this environment.

## 11. Remaining work
Apply `database/migrations/*.sql` in order against a real PostgreSQL database, then run `seed_demo_data.sql` (after replacing the placeholder password hashes with real bcrypt output) and confirm the demo customers/workers appear correctly with zero balances.

## 12. Exact next phase
**Phase 4 — React + Tailwind Frontend.**
