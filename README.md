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
* **Heartbeat Monitoring (Dead Man's Switch / Push Monitoring):**
  * Push-based monitoring for cron jobs, background workers, and backup scripts.
  * Generates unique webhook URLs:
    ```bash
    curl -X POST https://respulse.wsl.local/api/heartbeat/<TOKEN>
    ```
  * Automatically flags endpoints as **DOWN** if an expected heartbeat is missed.

### 2. Interactive Real-Time Dashboard
* **Live WebSocket Streaming:**
  * Updates status, response time, and incident state in real time without refreshing the page.
* **30-Check Uptime Timeline:**
  * Color-coded status bars (operational, down, paused).
  * Interactive tooltips displaying exact timestamp, status code, and latency for each check.
* **Response Time Analytics:**
  * Interactive area charts built with `Recharts` showing latency history.
  * Calculates rolling 24-hour, 7-day, and 30-day uptime percentages.
* **Quick Management Actions:**
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
* **Pagination & High-Density Display:**
  * Configurable page sizes (`5`, `10`, `25`, `50`, `100` targets per page).
  * Page jump navigation (`<<`, `<`, numbered buttons with ellipsis, `>`, `>>`).
  * **Compact Density Mode toggle:** tightens padding and heights, allowing engineers to supervise 100+ endpoints simultaneously.

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
│   ├── Dockerfile               # Production container image (Debian Trixie)
│   ├── migrations/              # SQLx database migrations
│   │   ├── 0001_initial.sql     # Monitors, results, incidents, channels
│   │   ├── 0002_basic_auth.sql  # Basic auth schema extension
│   │   ├── 0003_alert_logs.sql  # Alert delivery logs table
│   │   ├── 0004_tags_and_groups.sql # Tags and folders schema extension
│   │   └── 0005_incident_management.sql # Incident details, timeline & post-mortem schema
│   └── src/
│       ├── main.rs              # App entrypoint, state & router setup
│       ├── db.rs                # Database connection & migration runner
│       ├── models.rs            # Core data types & DTOs
│       ├── api/                 # REST & WebSocket handlers
│       │   ├── mod.rs
│       │   ├── monitors.rs      # Monitor CRUD, pause/resume, test
│       │   ├── heartbeat.rs     # Push heartbeat endpoint
│       │   ├── incidents.rs     # Incident management, timeline updates & post-mortems
│       │   ├── notifications.rs # Channels CRUD, test alert & audit logs
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
├── frontend/
│   ├── package.json             # NPM dependencies & scripts
│   ├── vite.config.ts           # Vite configuration
│   ├── tailwind.config.js       # Tailwind CSS configuration & theme
│   ├── Dockerfile               # Nginx 1.27 production container
│   ├── nginx.conf               # Nginx server block & SPA routing
│   └── src/
│       ├── App.tsx              # Root component & WebSocket listener
│       ├── api/client.ts        # Fetch client & WebSocket connection
│       ├── components/          # UI components
│       │   ├── Header.tsx
│       │   ├── StatsOverview.tsx
│       │   ├── MonitorList.tsx
│       │   ├── MonitorCard.tsx
│       │   ├── MonitorDetailModal.tsx
│       │   ├── AddMonitorModal.tsx
│       │   ├── NotificationChannels.tsx # Channels dashboard & delivery logs
│       │   ├── AddChannelModal.tsx      # Modal for Telegram, Discord, Slack, Webhook
│       │   ├── IncidentManagement.tsx   # Incidents & RCA dashboard
│       │   ├── EditIncidentModal.tsx    # Modal for timeline updates & Post-Mortem editor
│       │   ├── DeclareIncidentModal.tsx # Proactive incident/maintenance declaration
│       │   ├── StatusPage.tsx           # Public status page with live incidents & RCA
│       │   └── ui/              # shadcn/ui components (button, dialog, input, card, badge)
│       └── types/index.ts       # TypeScript definitions
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
| `make seed` | Populate database with sample monitors |

---

## 📡 REST API Reference

All API routes are served under the `/api` prefix.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Healthcheck endpoint (`OK`) |
| `GET` | `/api/monitors` | List all monitors with 24h/7d/30d uptime & history bars |
| `POST` | `/api/monitors` | Create a new monitor (HTTP, PORT, SSL, HEARTBEAT) |
| `POST` | `/api/monitors/bulk` | Bulk operations (pause, resume, test, delete, set_group, add_tag) |
| `GET` | `/api/monitors/:id` | Get detailed monitor statistics & latency history |
| `PUT` | `/api/monitors/:id` | Update an existing monitor configuration |
| `DELETE` | `/api/monitors/:id` | Delete a monitor and its history |
| `POST` | `/api/monitors/:id/pause` | Pause active probing for a monitor |
| `POST` | `/api/monitors/:id/resume` | Resume active probing |
| `POST` | `/api/monitors/:id/test` | Trigger an immediate test probe |
| `GET` | `/api/notifications` | List all configured notification channels |
| `POST` | `/api/notifications` | Register a new notification channel (Telegram, Discord, Slack, Webhook) |
| `PUT` | `/api/notifications/:id` | Update notification channel configuration or active status |
| `DELETE` | `/api/notifications/:id` | Delete a notification channel |
| `POST` | `/api/notifications/:id/test` | Trigger an immediate test alert to verify channel connectivity |
| `GET` | `/api/notifications/logs` | Fetch audit logs and diagnostics of alert deliveries |
| `GET` | `/api/incidents` | List incident logs with root-cause diagnostic information & timeline updates |
| `POST` | `/api/incidents` | Declare a manual incident or scheduled maintenance window |
| `GET` | `/api/incidents/:id` | Get incident details and full chronological timeline |
| `PUT` | `/api/incidents/:id` | Update incident metadata, severity, stage, RCA post-mortem & publication |
| `POST` | `/api/incidents/:id/updates` | Append a new live status update to the incident timeline |
| `GET` | `/api/stats` | Global metrics (total, operational, down, average latency) |
| `GET` | `/api/status-page` | Public status page data |
| `POST` | `/api/heartbeat/:token` | Push endpoint for cron jobs / dead man's switch |
| `GET` | `/ws` | WebSocket stream for live events and status updates |

---

## 🔒 Environment Variables

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgres://respulse:respulse@respulse-db:5432/respulse` | PostgreSQL connection string |
| `PORT` | `8080` | Port on which the Rust Axum API listens |
| `RUST_LOG` | `respulse_api=debug,tower_http=info` | Logging filter level |
