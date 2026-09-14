# SusuPro — System Architecture

## High-level flow

```
React Frontend (Phase 4)
        |
        v   HTTPS + JSON, bearer token
Node.js / Express Backend (Phase 5)
        |
        v   parameterized queries only
PostgreSQL (Phase 3)
```

The frontend never queries PostgreSQL directly. Every financial value the frontend displays or submits is validated, authorized, and computed by the backend. The backend is the single authoritative source for balances, transaction amounts, permissions, customer IDs, transaction IDs, withdrawal decisions, and audit records — the frontend's job is presentation and input collection only.

## Layering inside the backend

```
Route (HTTP concerns: path, method, which middleware applies)
  -> Validator (express-validator chains: is this input well-formed?)
  -> Controller (thin: pull validated input, call a service, shape the response)
  -> Service (business logic: what does a deposit actually DO?)
  -> Database (src/db/pool.js — parameterized queries, transactions)
```

This separation exists so that business rules (e.g., "a withdrawal needs admin approval") live in exactly one place (a service function) rather than being duplicated across multiple route handlers, and so that testing a business rule doesn't require spinning up an HTTP server — a service function can be tested directly.

## Multi-platform support (Section 3 of the master prompt)

The same backend API serves:
1. The admin web dashboard
2. The worker web interface
3. A future installable PWA for tablets (Phase 16)
4. A future Android application (Phase 17)

All four share one authentication system, one set of permissions, one set of business rules, and one database. Nothing platform-specific is allowed to implement its own copy of, for example, "can this amount be withdrawn" — that logic exists once, in the backend, and every client calls the same endpoint to get an answer.

## Why PostgreSQL, not Firebase

The master prompt is explicit: no Firebase. PostgreSQL's ACID transactions, `CHECK`/`UNIQUE`/foreign-key constraints, and trigger support are what make it realistic to enforce "a balance can never go negative" and "a completed transaction can never be silently edited" at the database layer itself — as a second, independent line of defense beneath the application code. Firestore-style document databases can approximate this with Cloud Functions and security rules, but that moves the same guarantees into application code that has to be gotten right every time, rather than a constraint the database itself refuses to violate. Given this system's entire purpose is financial record integrity, that tradeoff favors PostgreSQL.

## Deployment topology (elaborated in Phase 15)

Conceptually: a reverse proxy (TLS termination, serves the built frontend, proxies `/api/*` to the backend) → the Express process (never directly internet-facing) → PostgreSQL (reachable only from the backend's host). Tablets and browsers only ever talk to the reverse proxy over HTTPS.
