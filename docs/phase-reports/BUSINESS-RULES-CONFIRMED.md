# BUSINESS RULES CONFIRMED — Real Owner Input, Real Implementation

Two of the ten items open since Phase 1's `docs/unresolved-questions.md` have now been answered directly by the actual business owner, not guessed at. Both are implemented in code, not just documentation.

## 1. Workers register customers unsupervised

**Confirmed:** workers are the ones who physically visit the community to collect savings, so registering a new customer happens as part of that same visit — no separate admin step.

**Implementation:** no code change was needed — `customers.js` already granted `requireRole('admin', 'worker')` on the registration route as a PROPOSED default in Phase 7, and it turned out to match the confirmed real rule exactly. This is a good example of why the assumption was labeled PROPOSED rather than silently hardened into something else: it was safe to keep because it happened to be right, not because it was assumed to be right.

## 2. No withdrawal limit, except a mandatory GHS 50 minimum balance

**Confirmed:** there is no maximum amount a customer can deposit or withdraw — but every account must always retain at least GHS 50. A customer cannot empty their account to zero.

**This one required a real code change**, since nothing like it existed before. Implemented in `ledgerService.js`:

- A named constant, `MINIMUM_BALANCE_RETAINED = 50`, not a magic number scattered across files.
- Enforced at **withdrawal request time**: a request is rejected if it (combined with any other pending requests on the same account) would leave less than GHS 50.
- Enforced **again at approval time**: since the balance can change between when a worker requests a withdrawal and when an admin actually approves it (another withdrawal, a correction), the same floor is re-checked against the real balance at the moment of approval — the same defense-in-depth pattern already used for the basic sufficient-balance check.
- The floor is **inclusive** — a withdrawal that leaves exactly GHS 50 is allowed; leaving GHS 49.99 is not.
- An account already sitting at or below the floor gets a distinct, clearer error message ("no withdrawal is currently possible") rather than the generic insufficient-balance message.

**Tests added/updated:** three new dedicated tests in `phase9-withdrawals.test.js` verify the floor is rejected-below, allowed-at-exactly, and blocks all withdrawals once already at the floor. Several existing tests needed their dollar amounts adjusted, since numbers that were valid under the old "any amount up to the full balance" assumption are not all valid under the new floor — this was done carefully, scenario by scenario, rather than by loosening the new rule to make old numbers pass.

**Frontend:** the withdrawal request page now shows "Maximum withdrawable" (balance minus GHS 50) alongside the raw balance, and states the floor rule explicitly, so a worker sees this before submitting rather than only after a rejection.

## Still Open

Per `unresolved-questions.md`'s updated item 10: whether **all** withdrawals require admin approval, or only some (e.g., above a certain amount), was not part of this confirmation and remains a proposed default, not a confirmed rule.
