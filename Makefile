.PHONY: up down restart logs build ps seed clean

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f

build:
	docker compose build

ps:
	docker compose ps

SEED_EMAIL ?= alice@respulse.internal
SEED_PASSWORD ?= password123
SEED_URL ?= https://respulse.wsl.local

# Logs in first: the API no longer accepts anonymous requests. The demo password only works with DEMO_MODE=true.
seed:
	@echo "Seeding initial monitors..."
	@TOKEN=$$(curl -sk -X POST $(SEED_URL)/api/auth/login \
		-H "Content-Type: application/json" \
		-d '{"email":"$(SEED_EMAIL)","password":"$(SEED_PASSWORD)"}' | sed -n 's/.*"token":"\([^"]*\)".*/\1/p'); \
	if [ -z "$$TOKEN" ]; then echo "Login failed: check SEED_EMAIL / SEED_PASSWORD (demo accounts need DEMO_MODE=true)"; exit 1; fi; \
	post() { curl -sk -X POST $(SEED_URL)/api/monitors -H "Authorization: Bearer $$TOKEN" -H "Content-Type: application/json" -d "$$1" > /dev/null && echo "✔ $$2"; }; \
	post '{"name":"Google Search","url":"https://www.google.com","monitor_type":"HTTP","interval_seconds":30,"timeout_seconds":5}' "Google Search monitor created"; \
	post '{"name":"GitHub API","url":"https://api.github.com","monitor_type":"HTTP","interval_seconds":30,"timeout_seconds":5}' "GitHub API monitor created"; \
	post '{"name":"Cloudflare DNS","url":"1.1.1.1","monitor_type":"PORT","port":53,"interval_seconds":10,"timeout_seconds":3}' "Cloudflare DNS (Port 53) monitor created"; \
	post '{"name":"GitHub SSL Cert","url":"github.com","monitor_type":"SSL","port":443,"interval_seconds":60,"timeout_seconds":5}' "GitHub SSL Certificate monitor created"; \
	post '{"name":"Nightly Backup Cron","url":"heartbeat://push","monitor_type":"HEARTBEAT","interval_seconds":60,"timeout_seconds":10}' "Nightly Backup Cron (Heartbeat) created"
	@echo "Done seeding sample monitors!"
