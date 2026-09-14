# PHASE 15 REPORT — Production Deployment

## 1. What was built
Deployment topology and configs: Nginx reverse proxy (TLS termination, serves the built frontend, proxies `/api/*` to the backend, HTTP→HTTPS redirect, HSTS), a systemd unit running the backend as an unprivileged `susupro-app` user with filesystem hardening (`ProtectSystem=strict`, `NoNewPrivileges`), and a production checklist.

## 2. Files created
`deploy/nginx.conf`, `deploy/susupro-backend.service`, this report.

## Production Checklist
- [ ] HTTPS enforced (config above does this)
- [ ] `CORS_ORIGIN` set to the real frontend domain, not the `localhost:5173` dev default
- [ ] Database reachable only from the backend's host (firewall/security group)
- [ ] Backend runs as an unprivileged OS user (systemd unit above does this)
- [ ] `.env` permissions restricted (`chmod 600`)
- [ ] `npm audit` actually run and resolved (never done in this project — no network access existed at any point)
- [ ] Nightly backups running (Phase 14 scripts), and the test-restore drill actually performed
- [ ] MFA enabled for admin before real customer data enters the system
- [ ] Least-privilege database role created (see `database/migrations/008` — commented, run manually)

## 6-8. Tests / 9. Security issues
None applicable to config files themselves; the checklist above is the verification mechanism.

## 10. Problems encountered
No real server to deploy to and verify against in this environment — every item above is prepared, not executed.

## 11. Remaining work
Actually deploy to a real environment and work through the checklist item by item, checking each box only once genuinely verified — not by assumption.

## 12. Exact next phase
**Phase 16 — Worker PWA & Android Tablet.**
