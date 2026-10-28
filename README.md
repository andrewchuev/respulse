# ResPulse — Modern Uptime & Synthetic Monitoring Service

> High-performance, lightweight uptime and synthetic monitoring platform built with **Rust (Axum)**, **React**, **Tailwind CSS**, and **shadcn/ui**.

[![Rust](https://img.shields.io/badge/Rust-1.82-orange.svg?logo=rust)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg?logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com/)
[![shadcn/ui](https://img.shields.io/badge/UI-shadcn%2Fui-black.svg)](https://ui.shadcn.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?logo=docker)](https://www.docker.com/)
[![HTTPS](https://img.shields.io/badge/HTTPS-respulse.wsl.local-green.svg)](https://respulse.wsl.local)

---

## 🌟 Key Features

### 1. Multi-Protocol Probing Engine
* **HTTP / HTTPS Monitoring:**
  * Checks HTTP status codes (default `200` or custom status).
  * Measures latency across stages (DNS, Connect, TLS, TTFB).
  * Supports custom HTTP methods (`GET`, `POST`, `HEAD`, `PUT`) and custom JSON/text request bodies.
  * Custom headers support (e.g., Bearer tokens, custom user-agents).
  * Keyword matching: verifies the presence or absence of specific keywords in the response body.
* **HTTP Basic Authentication:**
  * First-class support via dedicated UI fields in the monitor creation modal.
  * Supports credentials embedded in URLs: `https://username:password@domain.com`.
  * Automatically injects standard `Authorization: Basic <base64>` headers.
* **SSL/TLS Certificate Tracking:**
  * Validates certificate chains using `rustls` and `webpki-roots`.
  * Monitors certificate expiration dates with advance warnings.
* **TCP Port Checks:**
  * Validates network sockets and connectivity for databases (PostgreSQL, MySQL, Redis), mail servers (SMTP, IMAP), and custom microservice ports.
* **Advanced Heartbeat Monitoring (Healthchecks.io-grade Dead Man's Switch):**
  * Push-based monitoring for cron jobs, background workers, CI/CD pipelines, and backup scripts.
  * **Signals Hierarchy:**
    * **Success (`/api/heartbeat/<TOKEN>` or `/api/ping/<PING_KEY>/<SLUG>`):** Confirms task finished successfully.
    * **Start (`.../start`):** Initiates task execution timer; measures exact duration (`duration_ms`) upon task completion.
    * **Fail (`.../fail`):** Immediately transitions monitor to **DOWN**, opens an active incident, and dispatches multi-channel alerts without waiting for timeout intervals.
    * **Exit Code Evaluation (`.../<exit_code>`):** Pass shell exit codes directly (e.g. `curl .../$?`). Code `0` signals success; non-zero codes trigger immediate alerts with code attribution and captured output.
    * **Diagnostic Logs (`.../log`):** Records informational execution logs without altering UP/DOWN states.
  * **Cron Schedules & Timezone Support:**
    * 5-field standard cron expressions (e.g. `0 3 * * 1-5`, `*/15 * * * *`).
    * Full IANA timezone support (`Europe/Kyiv`, `America/New_York`, `UTC`, `Asia/Tokyo`, etc.) via `chrono-tz` and `croner`.
    * Precomputes `next_expected_at` timestamps for fast, indexed overdue detection.
  * **Human-Readable Slugs & Auto-Provisioning (`?create=1`):**
    * Ping using team-scoped Ping Keys and clean readable slugs: `https://respulse.online/api/ping/pk_live_enterprise.../nightly-backup`.
    * Dynamic on-the-fly provisioning: pinging any unregistered slug with `?create=1` automatically provisions and initializes the monitor in one request.
  * **Payload & STDERR Capture:** Attach command outputs, crash logs, or stack traces (up to 64KB via POST body). Logs are stored and displayed directly in the dashboard and incident post-mortems.
  * **Configurable Grace Period (`grace_seconds`):** Define allowed execution buffers (e.g. 5m, 15m, 1h) beyond base intervals or scheduled cron deadlines to eliminate false alerts during heavy workloads.
  * **Hung / Stuck Job Detection:** Proactively flags and alerts on background jobs that started but exceeded their execution timeout window.
  * **Public SVG Status Badges:** Shields.io-compatible vector status badges (`/api/badge/<TOKEN>.svg` or `/api/badge/<PING_KEY>/<SLUG>.svg`) with real-time `up`, `late` (within grace window), `down`, and `paused` indicators for embedding in GitHub READMEs and dashboards.
  * **Prometheus Metrics Exporter:** Dedicated `/metrics` (and `/api/metrics`) endpoint exporting standard Prometheus gauge metrics for monitor statuses, latencies, heartbeat durations, and active incident counts.

### 2. Interactive Real-Time Dashboard
* **Live WebSocket Streaming:**
  * Updates status, response time, and incident state in real time without refreshing the page.
* **30-Check Uptime Timeline & Micro-interactions:**
  * Color-coded status bars (operational, down, paused).
  * Smooth hover scale transitions (`hover:scale-y-125 hover:brightness-125`) with animated floating glass tooltips displaying exact timestamp, HTTP status code, and latency in milliseconds.
* **Response Time Analytics & Brand Neon Glow:**
  * Interactive area charts built with `Recharts` showing latency history with dual-stop emerald/cyan gradients and luminous ambient glow auras.
  * Calculates rolling 24-hour, 7-day, and 30-day uptime percentages.
* **Perceived Performance & Skeleton UI:**
  * Zero-layout-shift shimmering skeleton loaders during initial data fetching across KPI metrics, filter bars, and 30-bar timelines.
* **Quick Management Actions:**
  * **Edit Monitor Parameters:** Fine-tune target URLs, check frequencies, HTTP methods/expected status/basic auth, TCP ports, heartbeat slugs, cron patterns/timezones, grace buffers, folders, and tags at any time with full RBAC protection and live WebSocket synchronization.
  * **Test Now:** Trigger an immediate probe on demand.
  * **Pause / Resume:** Suspend monitoring during maintenance.
  * **Search & Filters:** Instant search by name or target URL, with filters for status and monitor type.

### 3. Enterprise Scalability: Bulk Actions, Folders & Tags
* **Multi-Select & Bulk Actions Toolbar:**
  * Multi-select checkboxes on every monitor card with "Select Page" and "Select All Matching" helpers.
  * Floating quick action bar for mass operations:
    * ⏸ **Bulk Pause / ▶ Bulk Resume**
    * ⚡ **Bulk Test Now** (simultaneous async probes)
    * 📁 **Bulk Move to Folder / Group**
    * 🏷 **Bulk Tag Assignment**
    * 🗑 **Bulk Delete** with confirmation safeguard
* **Hierarchical Folders & Groups:**
  * Group monitors into logical departments (e.g., *Websites*, *Core APIs*, *Infrastructure*, *Background Workers*).
  * **Folder View mode:** Collapsible accordion sections displaying folder-level health counters (e.g. `2/2 Operational`) and 1-click select for the entire folder.
* **Tagging System & Dynamic Tag Cloud:**
  * Assign multiple tags (`#prod`, `#ecommerce`, `#api`, `#dns`) to each monitor.
  * Horizontal scrollable tag filter bar showing count badges for instant 1-click filtering.
* **High-Density Compact View Mode:**
  * Dedicated 1-click **Compact View toggle** (persisted in `localStorage`).
  * Compresses monitors into sleek single-line rows (~46px height), allowing DevOps & NOC engineers to supervise dozens of endpoints simultaneously on a single viewport without scrolling.
* **Pagination & Controls:**
  * Configurable page sizes (`5`, `10`, `25`, `50`, `100` targets per page).
  * Page jump navigation (`<<`, `<`, numbered buttons with ellipsis, `>`, `>>`).

### 4. Public Status Page
* Built-in public status page accessible via the header navigation or directly.
* Displays system-wide operational banners (*"All Systems Fully Operational"* or *"Experiencing Service Disruptions"*).
* Shows 90-day SLA calculations, active incident notices, and individual component history.
* **Categorized Component Blocks:** Organizes public status items into distinct category sections with group health badges (*Websites*, *Core APIs*, *Infrastructure*).

### 5. Alerting & Notification Delivery System
* **Supported Channels:**
  * **Telegram Bot API:** Instant direct messages or alerts to group chats and channels via Bot Token and Chat ID.
  * **Discord Webhooks:** Rich visual embeds with color-coded severity (Red for DOWN, Green for RECOVERY) and incident details.
  * **Slack Incoming Webhooks:** Formatted incident notifications posted directly to dedicated `#incidents` or `#sre` channels.
  * **Custom Webhooks:** JSON payloads dispatched to internal webhooks, PagerDuty, Opsgenie, or custom automation endpoints.
* **Incident Lifecycle Automation:**
  * Probe scheduler automatically dispatches alerts on state transitions (`UP → DOWN` and `DOWN → UP / RESOLVED`).
  * Calculates and delivers total downtime duration upon service recovery.
* **Tag-Based Alert Routing (`filter_tags`):**
  * Route alerts specifically to teams or channels subscribed to particular tags (e.g. send `#payments` alerts to a dedicated billing webhook/Slack channel).
  * Channels configured with empty `filter_tags` act as catch-all notification sinks for the entire organization.
* **Delivery Diagnostics & Audit Trail:**
  * Real-time test dispatch button for any channel with immediate network/API diagnostics.
  * Detailed delivery history table logging timestamps, event types (`DOWN`, `RESOLVED`, `TEST`), target monitors, HTTP status codes, and error responses.
  * Aggregated delivery metrics (total configured, alerts dispatched, success delivery rate).

### 6. Incident Management, Live Timelines & Post-Mortems (RCA)
* **Incident Lifecycle & Timeline Stages:**
  * Auto-generates friendly incident titles and initial investigation logs upon probe failure.
  * Timeline stages track real-time operational response: `INVESTIGATING` → `IDENTIFIED` → `MONITORING` → `RESOLVED`.
  * Engineers and SREs can post chronological live updates with author attribution and custom messages.
  * Auto-resolves incidents and records exact recovery timestamp when targets come back online.
* **Root Cause Analysis (RCA) & Post-Mortem Editor:**
  * Dedicated Post-Mortem editor with 1-click **Insert Standard SRE Template** (Executive Summary, Impact, Timeline, Root Cause, Mitigating Actions, Action Items).
  * Toggle public visibility (`is_published`) to control disclosure to end-users.
* **Manual Outage & Scheduled Maintenance Declaration:**
  * Proactively declare planned maintenance windows or unplanned service disruptions before automated probes fire.
  * Supports custom severity ratings: `CRITICAL`, `MAJOR`, `MINOR`, and `MAINTENANCE`.
* **Public Status Page Integration:**
  * Active incidents display real-time chronological updates and current stage badges directly on the public status page.
  * **Past Incidents & Post-Mortems (Past 7 Days):** Expandable cards displaying the complete incident timeline and formatted Post-Mortem report.
* **Incident Management Dashboard:**
  * Dedicated "Incidents & RCA" workspace view with MTTR (Mean Time to Resolution) tracking, active outage banners, and comprehensive incident history table.

### 7. Multi-User Teams & Role-Based Access Control (RBAC)
* **Enterprise 4-Tier Role Model:**
  * 👑 **OWNER:** Full administrative control, organization management, member invitations, role promotions/demotions, organization deletion.
  * 🛡️ **ADMIN:** Monitor & channel management, incident management, member invitations and role management (except Owner role).
  * 🛠️ **ENGINEER:** Synthetic monitoring CRUD, on-demand probes (*Test Now*), pause/resume, bulk actions, declare incidents, publish RCA post-mortems, configure alert channels. Cannot manage team members.
  * 👁️ **VIEWER:** Read-only access to dashboards, latency analytics, incident history, and delivery audit logs. Strict server-side `403 Forbidden` defense-in-depth on all mutations.
* **Interactive Permissions Matrix:**
  * Transparent visual matrix displaying exact capabilities across 11 granular permissions (monitors, bulk actions, alerts, incidents, post-mortems, team management).
* **Team & Organization Workspace:**
  * Dedicated **Team & RBAC** management view with member rosters, role dropdown selectors, member deletion, and *Invite Member* modal dialogs.
* **Instant B2B Demo Persona Switcher (`DEMO_MODE=true` only):**
  * Profile dropdown in the top header allows instant switching between pre-seeded enterprise accounts (Owner, Admin, Engineer, Viewer) for live stakeholder demonstrations.
  * Disabled by default: without `DEMO_MODE` the switcher, the 1-click sandbox login and the seeded demo passwords are all off.
* **Context-Aware UI Safeguards:**
  * Prominent yellow *"Viewer Mode (Read-Only)"* banner automatically alerts non-privileged users.
  * Interactive action buttons (Add Monitor, Declare Incident, Add Channel, Pause/Resume, Delete) are gracefully disabled with informative tooltips explaining role requirements.

### 8. Product Promo & Tour Landing Page
* **High-Impact SaaS Showcase:**
  * Accessible directly via `https://respulse.online?view=promo` (or local `https://respulse.wsl.local?view=promo`) or via the **Product Tour** navigation button in the top header.
  * **Hero Section:** Systems-grade synthetic monitoring value proposition, primary CTAs for registration and live console exploration, and animated real-time browser console mockup with simulated probes.
  * **Interactive Multi-Protocol Playground:** Tabbed live explorer covering HTTP/REST APIs, TCP sockets & databases, TLS certificate tracking, asynchronous worker heartbeats, and multi-channel alerts with executable curl examples.
  * **Architectural Deep Dive (Why Rust?):** Benchmark comparison matrix comparing ResPulse (Rust Axum + Tokio) against legacy NodeJS/Python engines (memory, zero GC jitter, thread concurrency, rustls memory safety).
  * **Free Open Beta (current mode):** `BILLING_ENABLED=false` hides prices and checkout. Every team gets the Free limits: **25 monitors, 30-second minimum interval, 30-day history, solo workspace**, heartbeat/cron monitoring, multi-channel alerts and SVG badges. Pro-only features (10-second probes, up to 100 monitors, 10 team members, Prometheus exporter, 90-day history) are planned for a possible paid plan and are not offered during the beta.
  * **Paid plan (dormant):** with `BILLING_ENABLED=true` the Pro plan ($8/month: up to 100 monitors, 10-second probes, 10 team members, Prometheus exporter, 90-day history) and the checkout below come back.
  * **FastSpring Payment & Subscription Integration:**
    * Native self-service checkout for the Pro Plan ($8.00 USD / month).
    * Processed securely via **FastSpring** (Merchant of Record, store `reslab`).
    * Supports in-app **FastSpring Store Builder Library (SBL) popup modal**, hosted web checkout (`https://reslab.test.onfastspring.com/respulse-pro-plan`), credit/debit cards, Apple Pay, Google Pay, wire transfers, automated VAT compliance, and real-time webhook order fulfillment (`/api/payments/fastspring/webhook`).
  * **Interactive FAQ & Social Proof:** Expandable accordions answering technical architecture, VPC self-hosting, heartbeat monitoring, and role permissions.

### 9. Production Server Deployment (respulse.online)
* **Cloud Architecture & Security Hardening:**
  * Hosted at `/opt/respulse` on Debian 13 (Trixie) x86_64 (`respulse.online`, `46.225.23.41`).
  * **Reverse Proxy:** Dockerized Caddy (`caddy:2-alpine`) orchestrating automated Let's Encrypt / ZeroSSL TLS certificates with HTTP/2, HTTP/3 (QUIC), and canonical `www` to apex domain 301 redirects. Responses carry HSTS and a strict `Content-Security-Policy` (same-origin only, plus FastSpring's checkout script/iframe and the avatar hosts); the policy was verified against the real app including the Recharts views and the FastSpring popup.
  * **Zero Direct Exposure:** PostgreSQL, Rust API, and Nginx containers reside on an isolated internal Docker bridge network (`respulse-net`). Only ports `80` (HTTP) and `443` (HTTPS TCP/UDP) are published to the host.
  * **Strict Permissions:** `/opt/respulse` is locked down to `dev:docker` with `0750` permissions, and `.env` credentials are restricted to `0600`.
  * **Host Hardening:** UFW firewall configured (`deny incoming`, allow `22`, `80`, `443`), SSH accepts public keys only (`PasswordAuthentication no`), `fail2ban` guards it against brute-force attacks, and `docker.service` enabled on boot with automatic restart policies (`restart: unless-stopped`).

### 10. Self-Service Registration & JWT Authentication
* **Enterprise Identity & Password Security:**
  * **Public Self-Service Registration (`POST /api/auth/register`):** Visitors can create their own organization workspace, team slug, and owner account in one step.
  * **Email Confirmation (optional):** with `REQUIRE_EMAIL_VERIFICATION=true` a new account cannot sign in until the emailed single-use link (24 h) is opened; only a SHA-256 hash of the token is stored, resend is rate-limited, and pre-existing accounts are grandfathered as confirmed. Sign-in answers `403 EMAIL_NOT_VERIFIED` only after a correct password.
  * **Password Hashing:** Passwords securely hashed with `bcrypt` (10 rounds).
  * **Cryptographically Signed JWT Tokens:** Stateless JWT tokens issued via `jsonwebtoken` (HS256) valid for 7 days, carrying identity, organization ID, and role.
  * **Login Endpoint (`POST /api/auth/login`):** Validates credentials, updates login timestamp, and issues JWT tokens.
  * **Glassmorphic Auth Modal (`AuthModal.tsx`):** Seamless sign in / registration dialog with brand glow, error alerts, password reveal, and 1-click sandbox access.
  * **Strict Authentication:** Every API call except the public ones (health, status page, badges, heartbeat pings, `/api/auth/*`) requires `Authorization: Bearer <JWT>`; missing, forged or expired tokens get `401`. The server refuses to start without a `JWT_SECRET` of at least 32 characters.
  * **Abuse Protection:** `POST /api/auth/login` allows 10 attempts per IP and then one every 6 seconds, `POST /api/auth/register` 3 signups per IP and then one every 20 minutes; excess requests get `429` with `Retry-After`. The client IP comes from the last `X-Forwarded-For` entry set by the reverse proxy, and only when the TCP peer is an internal address.
  * **SSRF Guard:** Monitor targets and webhook URLs may not resolve to private, loopback, link-local, CGNAT, multicast or reserved ranges (IPv4, IPv6 and IPv6-embedded IPv4). Hostnames are re-checked at connect time (DNS rebinding), redirects are vetted per hop, and creating such a monitor or channel returns `400`. Set `ALLOW_PRIVATE_TARGETS=true` for self-hosted setups that monitor internal services.
  * **Session Management:** The JWT is kept in `localStorage`; any `401` clears it and returns the user to the sign-in dialog. The WebSocket stream authenticates with the same token in its first frame and only delivers events of the user's own team.

---

## 🛠 Tech Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Backend** | [Rust 1.82](https://www.rust-lang.org/) | Systems-grade performance, low memory footprint, zero garbage collection pauses |
| **Web Framework** | [Axum 0.7](https://github.com/tokio-rs/axum) | Async HTTP & WebSocket framework built on `tokio` and `tower` |
| **Concurrency** | [Tokio](https://tokio.rs/) | Multi-threaded async runtime with background probe scheduling |
| **Database** | [PostgreSQL 16](https://www.postgresql.org/) | Relational database with [SQLx](https://github.com/launchbadge/sqlx) connection pooling |
| **HTTP Client** | [Reqwest](https://github.com/seanmonstar/reqwest) + [Rustls](https://github.com/rustls/rustls) | Asynchronous client with TLS certificate validation |
| **Frontend** | [React 18](https://react.dev/) + [Vite](https://vitejs.dev/) | Fast build tool and modern client application |
| **Styling & UI** | [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) | Dark mode design system based on Radix UI primitives |
| **Data Viz** | [Recharts](https://recharts.org/) | Responsive SVG charts for latency and uptime visualization |
| **Reverse Proxy** | [Caddy 2](https://caddyserver.com/) | Automated local TLS certificate issuance for `*.wsl.local` |

---

## 📁 Repository Structure

```
respulse/
├── backend/
│   ├── Cargo.toml               # Rust package manifest & dependencies
│   ├── Dockerfile               # Multi-stage build (Rust builder → Debian Trixie runtime, non-root)
│   ├── migrations/              # SQLx database migrations
│   │   ├── 0001_initial.sql     # Monitors, results, incidents, channels
│   │   ├── 0002_basic_auth.sql  # Basic auth schema extension
│   │   ├── 0003_alert_logs.sql  # Alert delivery logs table
│   │   ├── 0004_tags_and_groups.sql # Tags and folders schema extension
│   │   ├── 0005_incident_management.sql # Incident details, timeline & post-mortem schema
│   │   ├── 0006_rbac_teams.sql  # Multi-user teams, users & seeded enterprise accounts
│   │   ├── 0007_tenant_isolation.sql # Tenant isolation across monitors, incidents & channels
│   │   ├── 0008_update_public_status_monitors.sql # Clean public status monitor seeds
│   │   ├── 0009_heartbeat_enhancements.sql # Grace period, start timer & payload logging schema
│   │   ├── 0010_cron_slugs_and_tag_routing.sql # Cron expressions, ping keys, slugs & tag routing schema
│   │   └── 0011_team_plans.sql      # Team subscription plans (Free vs Pro) & limits schema
│   └── src/
│       ├── main.rs              # App entrypoint, state & router setup
│       ├── db.rs                # Database connection & migration runner
│       ├── auth.rs              # Axum authentication extractor & role permission guards
│       ├── models.rs            # Core data types, DTOs & permission models
│       ├── api/                 # REST & WebSocket handlers
│       │   ├── mod.rs
│       │   ├── auth.rs          # Current user, demo user switcher & available personas
│       │   ├── team.rs          # Multi-user team management & member invitations
│       │   ├── monitors.rs      # Monitor CRUD, pause/resume, test (RBAC-guarded)
│       │   ├── heartbeat.rs     # Push heartbeat endpoint, slug routing & auto-provisioning
│       │   ├── badge.rs         # Dynamic SVG status badges (Shields.io-compatible)
│       │   ├── metrics.rs       # Prometheus /metrics exporter
│       │   ├── incidents.rs     # Incident management, timeline updates & post-mortems (RBAC-guarded)
│       │   ├── notifications.rs # Channels CRUD, test alert & audit logs (RBAC-guarded)
│       │   ├── stats.rs         # Global metrics & status page data
│       │   └── ws.rs            # Real-time WebSocket hub
│       ├── notifier/            # Alert dispatch engine
│       │   ├── mod.rs           # Multi-channel dispatcher & router
│       │   ├── telegram.rs      # Telegram Bot API integration
│       │   ├── discord.rs       # Discord Rich Embeds webhook
│       │   ├── slack.rs         # Slack Incoming Webhook
│       │   └── webhook.rs       # Custom JSON webhook dispatcher
│       └── probe/               # Network probe engines
│           ├── mod.rs
│           ├── http.rs          # HTTP/HTTPS & Basic Auth engine
│           ├── tcp.rs           # TCP port connection engine
│           ├── ssl.rs           # SSL/TLS certificate validator
│           └── runner.rs        # Async probe scheduler loop & incident alerts
├── deploy/                      # Production deployment manifests
│   ├── Caddyfile                # Production reverse proxy configuration with automatic TLS
│   ├── docker-compose.yml       # Production Docker Compose orchestration
│   └── .env.example             # Environment credentials template
├── frontend/
│   ├── package.json             # NPM dependencies & scripts
│   ├── vite.config.ts           # Vite configuration
│   ├── tailwind.config.js       # Tailwind CSS configuration & theme
│   ├── Dockerfile               # Multi-stage build (Node builder → Nginx 1.30 runtime)
│   ├── nginx.conf               # Nginx server block & SPA routing
│   └── src/
│       ├── App.tsx              # Root component & WebSocket listener
│       ├── api/client.ts        # Fetch client & WebSocket connection
│       ├── components/          # UI components
│       │   ├── Header.tsx       # Navigation, user profile & persona switcher dropdown
│       │   ├── StatsOverview.tsx# Glowing KPI metrics & system health cards
│       │   ├── SkeletonDashboard.tsx # Shimmering zero-layout-shift loading state
│       │   ├── MonitorList.tsx  # Multi-select, bulk operations & high-density view
│       │   ├── MonitorCard.tsx  # Live status, uptime bars, latency charts & actions
│       │   ├── MonitorDetailModal.tsx
│       │   ├── AddMonitorModal.tsx
│       │   ├── NotificationChannels.tsx # Channels dashboard & delivery logs
│       │   ├── AddChannelModal.tsx      # Modal for Telegram, Discord, Slack, Webhook
│       │   ├── IncidentManagement.tsx   # Incidents & RCA dashboard
│       │   ├── EditIncidentModal.tsx    # Modal for timeline updates & Post-Mortem editor
│       │   ├── DeclareIncidentModal.tsx # Proactive incident/maintenance declaration
│       │   ├── TeamManagement.tsx       # Team roster, roles matrix & member invitations
│       │   ├── PromoLandingPage.tsx     # High-impact SaaS promo & interactive product tour
│       │   ├── StatusPage.tsx           # Public status page with live incidents & RCA
│       │   └── ui/              # shadcn/ui components (button, dialog, input, card, badge)
│       └── types/index.ts       # TypeScript definitions & RBAC models
├── docker-compose.yml           # Compose specification for Postgres, API & Web
├── Makefile                     # Shortcut commands for operations
└── README.md                    # Project documentation
```

---

## 🚀 Quick Start (Docker)

### Prerequisites
* Docker Engine 24+ & Docker Compose v2+
* Caddy Reverse Proxy attached to the shared `proxy` network (for local `*.wsl.local` HTTPS access)

### 1. Launch Services
Run the following command from the repository root:

```bash
make up
```

This starts:
* `respulse-db`: PostgreSQL 16 database with health check.
* `respulse-backend`: Rust Axum API & Probe Scheduler.
* `respulse-frontend`: Nginx serving the compiled React SPA.

### 2. Seed Sample Monitors
Populate the database with pre-configured monitors (Google, GitHub API, Cloudflare DNS, SSL checks, and Heartbeat):

```bash
make seed
```

### 3. Open in Browser
Access the application locally via HTTPS:

👉 **[https://respulse.wsl.local](https://respulse.wsl.local)**

*(TLS certificates are automatically provisioned and managed by Caddy's internal local CA).*

### 4. Pre-Seeded Enterprise Demo Personas
ResPulse comes pre-configured with a default enterprise organization (`Acme Global Operations`) and four seeded demo accounts to showcase the RBAC engine without setup overhead:

| Avatar | Name | Email | Role | Capabilities |
| :---: | :--- | :--- | :---: | :--- |
| 👑 | **Alice Vance** | `alice@respulse.internal` | `OWNER` | Full enterprise control, team invitations, role changes, organization deletion |
| 🛡️ | **Bob Chen** | `bob@respulse.internal` | `ADMIN` | Infrastructure, alert channels, incident management & member invitations |
| 🛠️ | **Charlie Davis** | `charlie@respulse.internal` | `ENGINEER` | Synthetic monitoring, on-demand probes, RCA post-mortems, bulk actions |
| 👁️ | **Dana Scully** | `dana@respulse.internal` | `VIEWER` | Read-only dashboards, latency charts, incident history (mutations return `403`) |

> [!TIP]
> Demo personas are only available when the backend runs with `DEMO_MODE=true` (the default in the local `docker-compose.yml`, off in `deploy/`). Use the profile dropdown in the top-right header to switch between them in one click and observe the dynamic UI changes and server permission enforcement. The seeded accounts accept the demo password `password123` in this mode only.

---

## 🚢 Release & Deployment

Images are built **locally** (no CI runners needed), pushed to GitHub Container Registry and pulled by the server:

1. One-time: `docker login ghcr.io` locally with a PAT that has `write:packages`; on the server log in with a read-only `read:packages` PAT.
2. `make release` builds `ghcr.io/andrewchuev/respulse-{backend,frontend}` (override with `REGISTRY=`), tags them with the commit SHA and `latest`, and pushes them. The Dockerfiles are multi-stage, so no local Rust/Node toolchain output is involved and `Cargo.lock` pins the dependencies.
3. `make deploy` syncs `deploy/docker-compose.yml` and `Caddyfile` to `/opt/respulse`, writes `IMAGE_TAG` into the server's `.env`, pulls and restarts the stack.
4. Roll back with `make deploy TAG=<older sha>`.

Without a registry login, `make deploy-direct` does steps 2-3 in one go by shipping the images over SSH (the previous tag must still exist on the server for rollbacks).

**Backups:** `deploy/backup.sh` runs from the server's cron daily at 03:17 UTC, writes validated `pg_dump -Fc` files to `/opt/respulse/backups/` and keeps the last 14. Run `make backup-pull` regularly for an off-host copy. Restore with `docker exec -i respulse-db pg_restore -U <user> -d <db> --clean --if-exists < db-<ts>.dump`.

The server `.env` needs `POSTGRES_*`, `JWT_SECRET`, `FASTSPRING_WEBHOOK_SECRET` (see `deploy/.env.example`).

---

## 📊 Operator Report

Emails listed in `ADMIN_EMAILS` see a **Report** tab (`/admin`) with aggregate numbers to judge whether the service is worth developing: signups per day, the activation funnel (signed up → created a monitor → connected an alert channel → active in the last 7 days), weekly cohorts, demand signals (teams near or at their limits, teams using fast probes), monitors by type and server load (checks per day, probes per second, database size). It shows team names but never user emails, and excludes the seeded demo organization.

---

## 🛠 Makefile Commands

| Command | Description |
| :--- | :--- |
| `make up` | Build and start all containers in detached mode |
| `make down` | Stop and remove running containers |
| `make restart` | Restart all application containers |
| `make logs` | Stream live logs from all containers |
| `make build` | Rebuild Docker images |
| `make ps` | Show container health and port statuses |
| `make release` | Build both images locally, tag them with the git SHA and `latest`, push to the registry (needs a clean tree and `docker login ghcr.io`) |
| `make backup-pull` | Copy the server's daily DB dumps to `~/backups/respulse` (off-host copy) |
| `make deploy-direct` | Registry-free alternative: build locally, stream the images to the server over SSH (`docker save \| ssh docker load`) and roll out |
| `make deploy` | Copy `deploy/` configs to the server, set `IMAGE_TAG`, `docker compose pull` and `up -d` (`TAG=<sha>` rolls back to an older release) |
| `make seed` | Log in (`SEED_EMAIL`/`SEED_PASSWORD`, default demo owner) and populate the database with sample monitors |

---

## 📡 REST API Reference

All API routes are served under the `/api` prefix. Authenticated routes require `Authorization: Bearer <JWT>` obtained from `/api/auth/login` or `/api/auth/register`; requests without a valid token get `401`. Public routes: `/api/health`, `/api/auth/*`, `/api/status-page`, badges and heartbeat/ping endpoints.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Healthcheck endpoint (`OK`) |
| `POST` | `/api/auth/register` | Self-service registration (creates organization workspace + Owner with bcrypt password); with `REQUIRE_EMAIL_VERIFICATION=true` it answers `{"status":"verification_required"}` and emails a confirmation link instead of returning a token |
| `POST` | `/api/auth/verify-email` | Redeem the emailed confirmation token (`{"token": ...}`) and sign in; single use, `400` if invalid or expired |
| `POST` | `/api/auth/resend-verification` | Send a fresh confirmation link (`{"email": ...}`); always answers `200` so addresses cannot be probed, rate-limited per IP |
| `POST` | `/api/auth/login` | Authenticate with email/password and obtain signed JWT token |
| `GET` | `/api/auth/me` | Current authenticated user profile, team details & permissions (Bearer JWT) |
| `GET` | `/api/auth/config` | Public capabilities used by the UI: `demo_mode`, `billing_enabled` and the plan limits |
| `GET` | `/api/auth/users` | List the members of the caller's team (persona switcher in demo mode) |
| `POST` | `/api/auth/switch-user` | Passwordless login as a seeded demo persona (`DEMO_MODE=true` only, otherwise `404`) |
| `GET` | `/api/team/members` | List all team members of the active enterprise organization |
| `POST` | `/api/team/members` | Invite a new team member with role (`OWNER`/`ADMIN` required) |
| `PUT` | `/api/team/members/:id/role` | Update a team member's role (`OWNER`/`ADMIN` required) |
| `DELETE` | `/api/team/members/:id` | Remove a member from the team (`OWNER`/`ADMIN` required) |
| `POST`/`PUT` | `/api/team/plan` | Change plan (`OWNER`/`ADMIN`); downgrade to `FREE` always, upgrade to `PRO` only in demo mode (otherwise use checkout) |
| `GET` | `/api/payments/fastspring/config` | Get FastSpring checkout configuration ($8/mo) for store `reslab` |
| `POST` | `/api/payments/fastspring/confirm` | Report whether the Pro upgrade has landed (`200` if PRO, `409` while the webhook is pending); never upgrades by itself |
| `POST` | `/api/payments/fastspring/webhook` | FastSpring webhook; requires a valid `X-FS-Signature` HMAC-SHA256 (base64) over the raw body (`503` if `FASTSPRING_WEBHOOK_SECRET` is unset). Events are deduplicated by event id, only the `respulse-pro-plan` product counts, and the team is matched by stored subscription id, checkout `team_id` tag/`referrer`, or the buyer's email (owner/admin). `order.completed`, `subscription.activated`, `subscription.charge.completed` keep the team on Pro; `subscription.canceled` marks it canceled (Pro until the period ends); `subscription.deactivated` drops it to Free; `return.created` (subscribe to it in FastSpring) marks the original payment `PARTIALLY_REFUNDED`/`REFUNDED` and tracks the refunded amount without touching the plan. Failures answer `5xx` so FastSpring retries |
| `GET` | `/api/payments/history` | List payment transaction history and invoices for team |
| `GET` | `/api/monitors` | List all monitors with 24h/7d/30d uptime & history bars |
| `POST` | `/api/monitors` | Create a new monitor (HTTP, PORT, SSL, HEARTBEAT) |
| `POST` | `/api/monitors/bulk` | Bulk operations (pause, resume, test, delete, set_group, add_tag) |
| `GET` | `/api/monitors/:id` | Get detailed monitor statistics & latency history |
| `PUT` | `/api/monitors/:id` | Update an existing monitor configuration |
| `DELETE` | `/api/monitors/:id` | Delete a monitor and its history |
| `POST` | `/api/monitors/:id/pause` | Pause active probing for a monitor |
| `POST` | `/api/monitors/:id/resume` | Resume active probing |
| `POST` | `/api/monitors/:id/test` | Trigger an immediate test probe |
| `GET` | `/api/notifications` | List all configured notification channels (with `filter_tags`) |
| `POST` | `/api/notifications` | Register a new notification channel (Telegram, Discord, Slack, Webhook, with optional `filter_tags`) |
| `PUT` | `/api/notifications/:id` | Update notification channel configuration, tags or active status |
| `DELETE` | `/api/notifications/:id` | Delete a notification channel |
| `POST` | `/api/notifications/:id/test` | Trigger an immediate test alert to verify channel connectivity |
| `GET` | `/api/notifications/logs` | Fetch audit logs and diagnostics of alert deliveries |
| `GET` | `/api/incidents` | List incident logs with root-cause diagnostic information & timeline updates |
| `POST` | `/api/incidents` | Declare a manual incident or scheduled maintenance window |
| `GET` | `/api/incidents/:id` | Get incident details and full chronological timeline |
| `PUT` | `/api/incidents/:id` | Update incident metadata, severity, stage, RCA post-mortem & publication |
| `POST` | `/api/incidents/:id/updates` | Append a new live status update to the incident timeline |
| `GET` | `/api/admin/access` | Whether the caller may open the operator report (`ADMIN_EMAILS`) |
| `GET` | `/api/admin/report` | Operator report: signups, activation funnel, cohorts, demand signals, load (admins only, `403` otherwise) |
| `GET` | `/api/stats` | Global metrics (total, operational, down, average latency) |
| `GET` | `/api/status-page` | Public status page data |
| `GET` | `/api/metrics` / `/metrics` | Prometheus scrape endpoint scoped to one team; send `Authorization: Bearer <team Ping Key or JWT>` (`respulse_monitors_total`, statuses, latencies, incidents) |
| `GET` | `/api/badge/:token[.svg]` | Vector SVG status badge by monitor UUID or heartbeat token |
| `GET` | `/api/badge/:ping_key/:slug[.svg]` | Vector SVG status badge by team Ping Key and monitor slug (supports `?label=...`) |
| `GET`/`POST` | `/api/heartbeat/:token` | Push endpoint: signal task success / heartbeat ping |
| `GET`/`POST` | `/api/heartbeat/:token/start` | Push endpoint: signal task start; activates duration measurement |
| `GET`/`POST` | `/api/heartbeat/:token/fail` | Push endpoint: explicitly signal task failure; triggers instant DOWN & alerts |
| `GET`/`POST` | `/api/heartbeat/:token/:code` | Push endpoint: exit code ping (`0` = OK, `>0` = DOWN with code & payload) |
| `GET`/`POST` | `/api/heartbeat/:token/log` | Push endpoint: record diagnostic log without changing UP/DOWN state |
| `GET`/`POST` | `/api/ping/:ping_key/:slug` | Slug push endpoint: human-readable ping (append `?create=1` to auto-provision) |
| `GET`/`POST` | `/api/ping/:ping_key/:slug/:action` | Slug push endpoint: lifecycle actions (`start`, `fail`, `0`, `1`, `log`) |
| `GET` | `/ws` | WebSocket stream for live events; first frame must be `{"type":"auth","token":"<JWT>"}` (closed with `1008` otherwise), events are filtered to the caller's team |

---

## 🔒 Environment Variables

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgres://respulse:respulse@respulse-db:5432/respulse` | PostgreSQL connection string |
| `PORT` | `8080` | Port on which the Rust Axum API listens |
| `RUST_LOG` | `respulse_api=debug,tower_http=info` | Logging filter level |
| `JWT_SECRET` | *required* | HS256 signing key, at least 32 characters (`openssl rand -hex 32`); the server exits if missing or short |
| `DEMO_MODE` | `false` | Enables demo persona switching, 1-click sandbox login and seeded demo passwords |
| `BILLING_ENABLED` | `false` | Shows prices, upgrade buttons and checkout; leave off during the free open beta |
| `REQUIRE_EMAIL_VERIFICATION` | `false` | New signups must confirm their email (single-use link, valid 24 h) before they can sign in; needs the `SMTP_*` settings, the server refuses to start without them |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_TLS` | *unset* / provider default / `starttls` | SMTP relay for outgoing email; `SMTP_TLS` is `starttls` (587), `tls` (implicit TLS, 465) or `none` (local test servers only) |
| `SMTP_USERNAME` / `SMTP_PASSWORD` / `SMTP_FROM` | *unset* | SMTP credentials and the sender address, e.g. `ResPulse <noreply@respulse.online>` |
| `APP_URL` | `http://localhost:8080` | Public base URL used in emailed links |
| `ADMIN_EMAILS` | *unset* | Comma-separated emails that can open the operator report at `/admin` (aggregates only, demo org excluded) |
| `ALLOW_PRIVATE_TARGETS` | `false` | Lets monitors and webhooks reach private, loopback and link-local addresses; leave off on a public server (SSRF guard) |
| `CORS_ALLOWED_ORIGINS` | *unset* | Comma-separated origins allowed to call the API cross-origin; unset means same-origin only (the bundled SPA needs nothing) |
| `RETENTION_FREE_DAYS` / `RETENTION_PRO_DAYS` | `30` / `90` | How long probe history (`check_results`) is kept per plan; pruned daily in batches |
| `FASTSPRING_WEBHOOK_SECRET` | *unset* | HMAC SHA256 secret configured on the FastSpring webhook; webhooks are rejected without it |
| `FASTSPRING_LIVE_MODE` | `false` | Use the live FastSpring storefront and ignore non-live (test) orders |
| `APP_URL` | — | Public base URL of the deployment |
| `APP_USER_AGENT` | `ResPulse/1.0 (+https://respulse.online)` | User-Agent sent by HTTP probes |
