# SusuPro — Core Workflows (documented ahead of implementation)

These are documented now, per Section 1's requirement, so later phases (7–10) implement against an agreed design rather than an implicit one. None of this is built yet — Phase 1 is documentation and scaffolding only.

## Customer Workflow

1. Worker or admin registers a customer: full name, phone, address/community (where necessary), savings plan (if applicable).
2. Backend generates a unique Customer ID (`SUS-000001` style) — server-side, not user-supplied, not editable afterward.
3. Backend creates the customer record and an associated account record in the same atomic operation (a customer never exists without an account).
4. Customer becomes searchable by ID, phone, or name.
5. Customer profile shows: current balance, total deposited, total withdrawn, transaction history, status.

**Open question folded in here:** whether workers can register customers unsupervised, or only admins — see `unresolved-questions.md`.

## Deposit Workflow

```
Worker logs in
  -> Search customer
  -> Open customer account (view current balance)
  -> Enter deposit amount
  -> Backend validates (positive, non-zero, sane upper bound)
  -> Show confirmation (previous balance, deposit, new balance, customer, worker, timestamp)
  -> Worker confirms
  -> Backend re-authenticates/re-authorizes the request
  -> Atomic database transaction: create transaction record + update derived balance + create audit log
  -> Transaction ID generated
  -> Confirmation/receipt returned
```

The balance is never a value the application "sets" — it is derived from the sum of that account's transaction records, so there is no code path that can update a balance without a corresponding transaction existing. This is the same design principle used successfully in the earlier prototype work and is being carried forward as a design decision here, not copied code.

## Withdrawal Workflow

```
Worker initiates withdrawal request
  -> pending
  -> Admin/supervisor reviews
  -> Approve or reject
  -> If approved: atomic transaction (verify balance again at THIS moment, not just at request time) -> create transaction -> update balance -> audit log
  -> If rejected: request marked rejected, no financial effect
```

The master prompt explicitly says: **do not invent specific withdrawal limits or approval thresholds** — the business owner has since confirmed there is no maximum withdrawal amount, but every account must always retain a minimum balance of GHS 50 (implemented in `ledgerService.js`, enforced at both request and approval time). The two-step (request → approve) shape itself is taken as given by the master prompt ("must be configurable according to actual business rules"); whether ALL withdrawals need admin approval or only some remains unconfirmed — see `unresolved-questions.md` item 10.

## Audit Workflow

Every sensitive action (listed in full in `security-requirements.md`) writes an audit record containing: actor, action, entity type, entity ID, relevant metadata, timestamp, result/status. Audit records are append-only — no route, for any role, ever updates or deletes one. This is enforced at both the application layer (no such endpoint exists) and, once Phase 3 builds the schema, at the database layer (a trigger rejects the mutation even if application code tried).
