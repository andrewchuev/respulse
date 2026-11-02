# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

ResPulse is a synthetic monitoring SaaS (HTTP, TCP port, SSL and push heartbeat monitors) at respulse.online. Rust/Axum API + probe scheduler (`backend/`), React/Vite/Tailwind SPA (`frontend/`), Tauri desktop/Android wrapper around the same SPA (`src-tauri/`), PostgreSQL 16. `README.md` has the feature list, REST API table and the full env var table.

## Commands

Dev stack (Docker; containers `respulse-db`, `respulse-backend`, `respulse-frontend`, compose project pinned to `respulse` by `name:` in `docker-compose.yml`). Nothing is published on host ports: the app is reached through the shared Caddy `proxy` network at `https://respulse.wsl.local`; from the host use the container IP on `respulse-network`.

```bash
make up | down | logs | ps
docker compose up -d --build respulse-backend respulse-frontend   # apply code changes
```

The frontend container is nginx serving a built bundle, so there is no HMR and `docker compose restart` does not pick up source changes; rebuild the image.

Backend (`cd backend`): tests are inline `#[cfg(test)]` modules.

```bash
cargo test                      # all
cargo test uptime_is_computed   # single test by name substring
cargo clippy --all-targets      # ~50 pre-existing warnings; only check what you touched
```

Frontend (`cd frontend`): there is no lint or test script, only the type check and build.

```bash
npx tsc --noEmit -p .
npm run build                   # tsc -b && vite build
```

Versioning: `make hooks` enables `.githooks/pre-commit`, which bumps the patch version in `VERSION`, `package.json`, `Cargo.toml/lock`, `tauri.conf.json` and `sitemap.xml` and re-adds them on every commit (it prints "version bumped to X"). `SKIP_VERSION_BUMP=1` skips it.

## Release and production

- Prod is `dev@respulse.online:/opt/respulse` (Caddy, mailserver, db, backend, frontend from `deploy/docker-compose.yml`). Secrets and `IMAGE_TAG` live in the server's `.env`, which is not in the repo; new env vars must be added there by hand (e.g. `CONTACT_EMAIL`).
- `make deploy-direct` builds both images locally, streams them over SSH and restarts the stack (tag = 12-char commit sha; refuses a dirty tree, so commit first). Use it while pushing to ghcr is blocked by the GitHub quota (October 2026); once it resets try `make release` then `make deploy`.
- Prod DB: `ssh dev@respulse.online 'cd /opt/respulse && docker compose exec -T respulse-db psql -U respulse -d respulse'`. Take a `pg_dump -Fc` before any destructive change. Nightly dumps come from `deploy/backup.sh`; `make backup-pull` copies them.
- `mail_credentials.txt` in the repo root holds local SMTP credentials and is git-ignored.

## Backend architecture

- `main.rs` wires `AppState` (pool, WS broadcast channel, rate limiters, settings, mailer, WayForPay config) and spawns background loops: probe scheduler, retention pruning, plan enforcement. Routes live in `api/mod.rs` (`create_router`, nested under `/api`); `/metrics`, `/badge/*` and `/ws` are also mounted at the root.
- Probes: `probe/runner.rs` polls the DB every 2 s (max 50 due monitors per pass) and dispatches to `probe/{http,tcp,ssl}.rs`. `HEARTBEAT` monitors are push-based (`/api/heartbeat/:token`, `/api/ping/:ping_key/:slug[/start|fail|log|<exit code>]`, `?create=1` auto-provisions) and the same scheduler marks them DOWN when overdue. Scheduling precision is seconds, not milliseconds.
- All probes and webhooks go through `net_guard.rs` (SSRF guard; private targets only with `ALLOW_PRIVATE_TARGETS`). `notifier/` sends Telegram/Discord/Slack/Webhook alerts and writes `alert_logs`.
- Multi-tenant: every query is scoped by `team_id`; roles are OWNER/ADMIN/ENGINEER/VIEWER (`auth.rs`, JWT).
- Plans: `plans.rs` constants (Free/Pro) are synced into the `plan_limits` table at startup and read by DB triggers; `plan_enforcement.rs` applies downgrade grace. Pro-only features (cron schedules, tag routing, Prometheus export, 64 KB heartbeat output, 10 s intervals) are also checked in the handlers by team plan. Prod runs with `BILLING_ENABLED=true` (WayForPay); the free-beta mode hides all of it.
- Primary team: `teams.is_primary` (at most one, set in SQL) is the operator's own organization. The public `/status` page lists only that team's monitors that have `is_public = true` (nothing is public by default; non-primary teams cannot publish), and the operator report (`api/admin.rs`, access by `ADMIN_EMAILS`) excludes it from customer figures.
- Migrations in `backend/migrations` run on startup; never edit an applied one (checksums). `Monitor` and `Team` are loaded with `SELECT *` + `FromRow`, so a new column needs the struct field, and the dummy `Monitor` in `notifier/mod.rs` must be updated too. `0006` still seeds a demo team and users on fresh databases.
- Public unauthenticated endpoints (`/auth/*`, `/status-page`, `/badge/*`, heartbeat pings, `/contact`) are rate limited in `rate_limit.rs`.

## Frontend architecture

- Single SPA without a router library: `App.tsx` keeps a `view` state and maps paths to views. A new client route must also be added to the route regex in `frontend/nginx.conf`, otherwise nginx returns 404.
- Two HTML entry points: `index.html` is the crawlable landing page (the only indexable HTML, also holds static SEO copy, `sitemap.xml`, `llms.txt`); `app.html` is the noindex shell served for every other route. `/terms`, `/privacy`, `/refund` are served `noindex, nofollow` and linked only from the landing page.
- `src/api/client.ts` is the API layer; `src/types/index.ts` mirrors backend JSON (keep them in sync). The Tauri apps reuse this SPA (`isTauri()`), the SSH console exists only there.
- `PromoLandingPage.tsx` makes concrete product claims; keep them matching what the backend really does (previous drift: latency breakdown, SSL expiry alert tiers, 90-day uptime).
