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

### 3. Public Status Page
* Built-in public status page accessible via the header navigation or directly.
* Displays system-wide operational banners (*"All Systems Fully Operational"* or *"Experiencing Service Disruptions"*).
* Shows 90-day SLA calculations, active incident notices, and individual component history.

### 4. Automated Incident Lifecycle
* Detects state transitions (`UP → DOWN`) and registers active incidents with root-cause diagnostic error messages.
* Automatically resolves incidents upon recovery (`DOWN → UP`) and records total downtime duration in seconds.

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
alivemon/
├── backend/
│   ├── Cargo.toml               # Rust package manifest & dependencies
│   ├── Dockerfile               # Production container image (Debian Trixie)
│   ├── migrations/              # SQLx database migrations
│   │   ├── 0001_initial.sql     # Monitors, results, incidents, channels
│   │   └── 0002_basic_auth.sql  # Basic auth schema extension
│   └── src/
│       ├── main.rs              # App entrypoint, state & router setup
│       ├── db.rs                # Database connection & migration runner
│       ├── models.rs            # Core data types & DTOs
│       ├── api/                 # REST & WebSocket handlers
│       │   ├── mod.rs
│       │   ├── monitors.rs      # Monitor CRUD, pause/resume, test
│       │   ├── heartbeat.rs     # Push heartbeat endpoint
│       │   ├── incidents.rs     # Incident history
│       │   ├── stats.rs         # Global metrics & status page data
│       │   └── ws.rs            # Real-time WebSocket hub
│       └── probe/               # Network probe engines
│           ├── mod.rs
│           ├── http.rs          # HTTP/HTTPS & Basic Auth engine
│           ├── tcp.rs           # TCP port connection engine
│           ├── ssl.rs           # SSL/TLS certificate validator
│           └── runner.rs        # Async probe scheduler loop
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
│       │   ├── StatusPage.tsx
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
| `GET` | `/api/monitors/:id` | Get detailed monitor statistics & latency history |
| `PUT` | `/api/monitors/:id` | Update an existing monitor configuration |
| `DELETE` | `/api/monitors/:id` | Delete a monitor and its history |
| `POST` | `/api/monitors/:id/pause` | Pause active probing for a monitor |
| `POST` | `/api/monitors/:id/resume` | Resume active probing |
| `POST` | `/api/monitors/:id/test` | Trigger an immediate test probe |
| `GET` | `/api/incidents` | List incident logs with root-cause diagnostic information |
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
