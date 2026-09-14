# PHASE 18 REPORT — Offline Mode

The master prompt is explicit: **"Do NOT implement this phase unless offline operation is genuinely required. First design the offline architecture. If approved, implement..."** No approval has been given — `docs/unresolved-questions.md` item 9 has flagged since Phase 1 that whether offline mode is genuinely needed was never established, and nothing since has changed that. This phase is design-only, as instructed.

## 1. What was built
A design (below), and nothing else. No code, no database changes.

## Why This Matters Enough to Design Anyway

Workers use tablets in the field, where connectivity can plausibly be patchy — that's a real reason offline mode *might* eventually be needed, which is why a design exists rather than nothing. But "might be needed" is not "is needed," and building it speculatively would violate the master prompt's own instruction as well as its Section 42 quality standard ("do not create unnecessary complexity").

## Offline Architecture (design only, not built)

If genuinely required, the shape would be:

1. **Encrypted local storage** on the device for a small queue of pending deposit submissions — never withdrawal requests, which the master prompt's own online-first-by-default stance and the two-person-approval model make a poor fit for offline queuing (approval fundamentally requires reaching the server).
2. **Idempotency**, reusing the exact mechanism already built in Phase 8 — a queued deposit would carry the same client-generated `idempotencyKey` it would have used online, so a sync after reconnecting is safe to retry.
3. **Replay protection** — a queued transaction includes a timestamp and is rejected by the server if the referenced customer/account state makes it invalid (e.g., customer deactivated since queuing).
4. **Conflict resolution** — this is the hard part, and the reason NOT to build this casually: if a customer's balance changed on the server while a deposit was queued offline, the deposit should almost always still apply (deposits are additive and don't depend on reading a fresh balance first) — but any operation that *does* depend on a fresh balance (a withdrawal) must never be queued offline at all.
5. **Server reconciliation** — on reconnect, the queue syncs one item at a time, in order, waiting for each server confirmation before sending the next, so the ledger's ordering guarantees aren't violated by out-of-order sync.
6. **Auditability** — every synced transaction records that it was queued offline and the original queue timestamp, in the `note` field already available on `ledger_entries`, so an auditor can see the gap between when money was actually collected and when the system recorded it.
7. **Stale balance handling** — the UI must show a clear "last synced at X" indicator whenever displaying a balance from local cache, never presenting stale data as if it were current.

## What Would Need to Be True Before Implementing This For Real

- The owner confirms field connectivity is actually unreliable enough to matter (not assumed from "workers use tablets").
- The owner accepts that withdrawals remain online-only regardless (a business-process implication, not just a technical one).
- A decision on how long a device can stay offline before its queue is considered stale/rejected.

## 6-11. Tests / Problems / Remaining work
Not applicable — no implementation exists to test. This design should be revisited if and when the owner confirms offline capability is actually needed; until then, treat it as intentionally unbuilt, not overlooked.

## 12. Exact next phase
**Phase 19 — Final Red Team Security Assessment.**
