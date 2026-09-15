# REAL-WORLD DEPLOYMENT — First Live Cloud Verification

Backend deployed to Render (web service + managed PostgreSQL), code on GitHub.

## Result
Successful — a real login token was obtained from the live cloud database, reachable from anywhere on the internet.

## Issues found and fixed during deployment
1. DATABASE_URL was malformed (copy-paste error) — re-copied correctly from Render's database page.
2. No SSL configuration for the production database connection — added conditionally for NODE_ENV=production in db/pool.js.
3. Express didn't trust Render's reverse proxy — added app.set('trust proxy', 1) for production in app.js, needed for accurate rate limiting.

## Open items
- Free-tier database expires in 30 days unless upgraded.
- CORS_ORIGIN is still set to wildcard (*) — needs locking down once the frontend has a real deployed address.
- Frontend has not yet been deployed — only the backend and database are live so far.