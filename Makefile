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

seed:
	@echo "Seeding initial monitors..."
	@curl -s -k -X POST https://respulse.wsl.local/api/monitors \
		-H "Content-Type: application/json" \
		-d '{"name":"Google Search","url":"https://www.google.com","monitor_type":"HTTP","interval_seconds":30,"timeout_seconds":5}' > /dev/null && echo "✔ Google Search monitor created"
	@curl -s -k -X POST https://respulse.wsl.local/api/monitors \
		-H "Content-Type: application/json" \
		-d '{"name":"GitHub API","url":"https://api.github.com","monitor_type":"HTTP","interval_seconds":30,"timeout_seconds":5}' > /dev/null && echo "✔ GitHub API monitor created"
	@curl -s -k -X POST https://respulse.wsl.local/api/monitors \
		-H "Content-Type: application/json" \
		-d '{"name":"Cloudflare DNS","url":"1.1.1.1","monitor_type":"PORT","port":53,"interval_seconds":10,"timeout_seconds":3}' > /dev/null && echo "✔ Cloudflare DNS (Port 53) monitor created"
	@curl -s -k -X POST https://respulse.wsl.local/api/monitors \
		-H "Content-Type: application/json" \
		-d '{"name":"GitHub SSL Cert","url":"github.com","monitor_type":"SSL","port":443,"interval_seconds":60,"timeout_seconds":5}' > /dev/null && echo "✔ GitHub SSL Certificate monitor created"
	@curl -s -k -X POST https://respulse.wsl.local/api/monitors \
		-H "Content-Type: application/json" \
		-d '{"name":"Nightly Backup Cron","url":"heartbeat://push","monitor_type":"HEARTBEAT","interval_seconds":60,"timeout_seconds":10}' > /dev/null && echo "✔ Nightly Backup Cron (Heartbeat) created"
	@echo "Done seeding sample monitors!"
