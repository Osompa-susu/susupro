# Services

Phase 5+ adds business logic here (e.g. depositService.js, withdrawalService.js) — the layer that actually talks to the database via src/db/pool.js. Controllers call services; services never touch req/res directly.
