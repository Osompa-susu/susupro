# PHASE 9 REPORT — Withdrawals & Approvals

## 1. What was built
Two-step withdrawal workflow: request (validates balance including other pending requests on the same account, checks account/customer are active) → pending → admin decides (re-verifies the real balance at THIS moment, not the request-time snapshot) → approve creates an atomic ledger entry + audit record, or reject with no financial effect. No withdrawal limits or thresholds invented — every withdrawal currently requires approval, flagged in code comments as pending the owner's actual answer (`docs/unresolved-questions.md` #3).

## 2. Files created
`backend/src/validators/withdrawalValidators.js`, `backend/src/controllers/withdrawalsController.js`, `backend/tests/phase9-withdrawals.test.js`.

## 3. Files modified
`backend/src/services/ledgerService.js` (added `requestWithdrawal`, `decideWithdrawal`, `listWithdrawals`, `myWithdrawalRequests`), `backend/src/controllers/transactionsController.js` (`mine` now includes withdrawal requests too), `backend/src/routes/withdrawals.js`, `backend/src/app.js`, two frontend pages. **Bug found and fixed during this phase:** `withdrawalRoutes` was initially mounted at `/api/transactions/withdrawals`, nesting it inside `transactions.js`'s own auth middleware — every withdrawal request silently passed through two auth checks. Not a security hole, but a real architectural smell caught by re-reading the master prompt's explicit endpoint list, which specifies `/api/withdrawals` as its own top-level path. Fixed by remounting and updating both frontend pages that referenced the old path.

## 4. Database changes
None — Phase 3's `withdrawal_requests`/`approvals` tables already supported everything.

## 5. API changes
`POST /api/withdrawals/request`, `POST /api/withdrawals/:id/decide`, `GET /api/withdrawals` — real now, at the corrected top-level path.

## 6. Tests performed
11 integration tests: unauthorized approval (worker approving their own request), insufficient balance, inactive-account withdrawal, full approve/reject flows, duplicate approval, concurrent double-approval of the *same* request, concurrent approval of *two different* requests on the same account that would jointly overdraw (the write-skew scenario), a balance-changed-between-request-and-approval race, and parameter tampering.

## 7. Tests passed / 8. Tests failed
**NOT TESTED (blocked by environment)** — written and syntax-verified, not yet run against a real database.

## 9. Security issues discovered
The route-mounting issue in #3 — caught and fixed within this phase.

## 10. Problems encountered
The mounting bug above; standing no-database limitation for execution.

## 11. Remaining work
Run the test suite for real, paying particular attention to the two concurrency tests.

## 12. Exact next phase
**Phase 10 — Audit Logging.**
