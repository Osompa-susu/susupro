# SusuPro — Unresolved Business Questions

Per Section 24 of the master prompt: "When a requirement is unclear, identify it, mark it as unresolved, continue only where safe." Nothing below has been silently assumed anywhere in the code or other docs — where a placeholder decision was unavoidable to keep scaffolding moving, it's noted as such, not treated as final.

## Resolved (confirmed directly with the business owner)

1. ~~Can workers register customers unsupervised?~~ **RESOLVED: Yes.** Workers are the ones who go around the community collecting savings, so they register customers themselves as part of that visit — no separate admin step required. This matches the permission already granted in `customers.js` from Phase 7; the code needed no change, only this confirmation.

2. ~~What withdrawal approval workflow / limits does the business use?~~ **RESOLVED, fully.** No maximum deposit or withdrawal amount exists. **Every account must always retain a minimum balance of GHS 50** — a customer can never withdraw their balance below that floor, even if requesting less than their full balance would otherwise be technically valid. Implemented in `ledgerService.js` (`MINIMUM_BALANCE_RETAINED = 50`), enforced at both withdrawal-request time and admin-approval time, and covered by dedicated tests in `phase9-withdrawals.test.js`. **And: every withdrawal, regardless of amount, requires explicit admin approval — there is no threshold below which a withdrawal is auto-approved.** This matches the two-person control already built (the worker requests, the admin decides; no code path exists that creates a completed withdrawal without an admin's explicit `decide` action) — confirmed as the actual intended business rule, not a placeholder default. No code change was needed, only this confirmation.

## Still Open

3. **What is the exact password policy?** "Strong password policy" is specified; a specific minimum length/complexity rule beyond the current 10-character minimum is not confirmed.
4. **What does "secure password reset" mean operationally for a worker with no active session and a forgotten password?** SMS OTP to the registered phone is a plausible mechanism given tablet-based workers, but nothing has been decided, and no SMS provider has been chosen or costed.
5. **What information belongs on a customer record beyond name/phone/community/plan?** The master prompt says "appropriate information such as," which is a floor, not an exhaustive list — anything beyond it needs confirmation.
6. **Device management specifics (Section 19):** how are tablets physically provisioned and handed to workers? Is device registration self-service or admin-only? What happens operationally when a tablet is lost (beyond the technical session-revocation capability)?
7. **Backup storage location and provider (Phase 14):** not yet chosen; depends on where the production database ends up hosted (Phase 15), which itself hasn't been decided.
8. **Whether offline mode (Phase 18) is genuinely required at all.** The master prompt is explicit that this phase should not be built unless there's a real need — that need hasn't been established one way or the other yet, and shouldn't be assumed just because tablets are involved.
9. **Multi-location/multi-branch support.** Nothing in the master prompt asks for it, but nothing rules it out either as a future need.

These are tracked here rather than resolved by guessing, per Section 24. Each will be revisited at the start of whichever phase first depends on the answer.
