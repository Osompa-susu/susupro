# SusuPro — Digital Savings & Collection Management System

A clean, from-scratch project. Built in numbered phases; each phase is completed, tested, and reported on before the next begins — see `docs/phase-reports/` once later phases exist.

## Structure

```
susupro/
├── frontend/     React + Tailwind (Phase 4 builds the actual UI; Phase 1 only scaffolds it)
├── backend/      Node.js + Express (Phase 5 builds the actual API; Phase 1 only scaffolds it)
├── database/     PostgreSQL migrations (Phase 3 builds the actual schema)
├── docs/         Architecture, workflows, security requirements, phase reports
└── scripts/      Development/operational scripts, added as phases need them
```

## Ground rules (from the master prompt, kept here so they don't get lost)

- Frontend never talks to PostgreSQL directly — everything goes through the backend API.
- The backend is authoritative for balances, transaction amounts, permissions, customer IDs, transaction IDs, withdrawal decisions, and audit records.
- No Firebase. PostgreSQL only.
- No invented business rules — anything not explicitly specified is logged in `docs/unresolved-questions.md` instead of guessed at.
- Demo data only until a real production decision is made; no real customer data during development.

## Status

Phase 1 — Requirements, Architecture & Project Foundation. See `docs/phase-reports/phase-1.md` for the full report.
