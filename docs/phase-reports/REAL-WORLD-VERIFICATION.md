# REAL-WORLD VERIFICATION — First Live Test Execution

This is the update the `FINAL-VERIFICATION.md` report said was still needed: the test suite, run for real, against a real PostgreSQL 18 instance, on a real Windows machine — not reasoned about, not simulated. This document records exactly what happened, including the bugs it found, because that's the entire point of running it.

## Result

**61/61 tests passing, 7/7 test suites passing, `npm audit`: 0 vulnerabilities.**

This is the first time any of this project's financial-integrity, RBAC, concurrency, audit-trail, and withdrawal-approval claims have real executed evidence behind them, rather than code review and static analysis.

## What Was Actually Found (and Fixed) By Running It For Real

### 1. Critical `npm audit` vulnerability in `bcrypt`'s dependency chain
`bcrypt`'s native-binary installer (`@mapbox/node-pre-gyp`) depends on a version of `tar` with multiple published CVEs (path traversal, arbitrary file write, DoS). `npm audit fix` and `npm audit fix --force` both failed to resolve it — the vulnerable dependency is baked into how the package installs itself. **Fix:** replaced `bcrypt` with `bcryptjs` everywhere (`authService.js`, `workerService.js`, `tests/testHelpers.js`, `package.json`) — a pure-JavaScript implementation of the identical algorithm, with zero native compilation and zero dependency on `tar`. Verified functionally identical (`hashSync`/`compare` behave the same; hash format is interchangeable).

### 2. A genuine, previously-undetectable schema bug
`ledgerService.js`'s `decideWithdrawal()` function writes `decided_by` and `decided_at` onto a `withdrawal_requests` row when an admin approves or rejects it. **Migration 005 never actually created those two columns.** This passed 20 phases of design, code review, and a systematic red-team pass — because none of those methods actually execute a real INSERT/UPDATE against a real schema. The very first live withdrawal-approval test caught it in under a minute. Fixed via `009_fix_withdrawal_decided_columns.sql`.

### 3. A flawed test, not a flawed app
One test ("balance dropping below the request amount between request and approval") asserted a `422` for a scenario that was actually mathematically safe: two withdrawal requests (40 + 60) exactly equal to a 100 balance are not an overdraft, and the app correctly allowed the second approval. The test's own arithmetic was wrong, not the app's logic. Rewritten to use a genuine balance-reducing event (an admin correction) to actually exercise the intended race condition.

### 4. A test-environment interaction, not a bug
The dedicated login/MFA rate limiters (correctly protecting against brute-force in production) were also firing during the test run itself, since 61 tests from one process hit the same endpoints dozens of times in quick succession — causing unrelated tests to fail with `429` instead of their real expected result. Fixed by making all three custom rate limiters skip themselves when `JEST_WORKER_ID` is set (Jest sets this automatically; no manual toggle needed, and production behavior is completely unaffected).

## Why This Matters More Than the Number 61

Every one of these four issues is exactly the category of thing that only real execution — not more code review, not another red-team pass, not more phases — can surface. This is the concrete argument for why the Final Verification report refused to call this project "controlled pilot ready" on code review alone, and why that refusal was correct: two of these four issues (the schema bug and the vulnerable dependency) would have been discovered by an actual pilot user, potentially with a real customer's withdrawal silently failing at the worst possible moment.

## Outstanding After This Round

- `mfa.test.js` has not yet been run against this corrected environment (it existed in the codebase before this session but wasn't part of the batch just executed — the zip being tested predates the MFA work). This is the next thing to run.
- The backup/restore drill (Phase 14) still hasn't been performed for real.
- PWA/browser verification (manifest, install prompt, service worker) still hasn't been checked on a real device.
- `docs/unresolved-questions.md` still needs the actual business owner's answers.
