.PHONY: up down restart logs build ps seed clean release deploy deploy-direct backup-pull tauri-dev tauri-build tauri-android-init tauri-android-build tauri-android-release tauri-android-bundle tauri-android-install

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

# --- Release: build images locally, push to the registry, pull on the server ---
# Needs `docker login ghcr.io` locally (PAT with write:packages) and a read:packages login on the server.
REGISTRY ?= ghcr.io/andrewchuev
PROD_HOST ?= dev@respulse.online
PROD_DIR ?= /opt/respulse
TAG ?= $(shell git rev-parse --short=12 HEAD)

# Refuses a dirty tree so an image tag always maps to exactly one commit.
release:
	@test -z "$$(git status --porcelain)" || { echo "Working tree is dirty: commit or stash first"; exit 1; }
	docker build -t $(REGISTRY)/respulse-backend:$(TAG) -t $(REGISTRY)/respulse-backend:latest backend
	docker build -t $(REGISTRY)/respulse-frontend:$(TAG) -t $(REGISTRY)/respulse-frontend:latest frontend
	docker push $(REGISTRY)/respulse-backend:$(TAG)
	docker push $(REGISTRY)/respulse-backend:latest
	docker push $(REGISTRY)/respulse-frontend:$(TAG)
	docker push $(REGISTRY)/respulse-frontend:latest
	@echo "Released $(TAG). Run: make deploy TAG=$(TAG)"

# Syncs configs, pins IMAGE_TAG in the server .env and restarts the stack; $(1) runs before `up` (e.g. a pull).
rollout = scp deploy/docker-compose.yml deploy/Caddyfile deploy/backup.sh $(PROD_HOST):$(PROD_DIR)/ \
	&& ssh $(PROD_HOST) 'cd $(PROD_DIR) \
		&& { grep -q "^IMAGE_TAG=" .env && sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$(TAG)/" .env || echo "IMAGE_TAG=$(TAG)" >> .env; } \
		&& $(1) docker compose up -d --remove-orphans \
		&& docker compose exec -T respulse-caddy caddy reload --config /etc/caddy/Caddyfile \
		&& docker compose ps'

# Rolls the server to TAG (default: current commit); use an older TAG to roll back.
deploy:
	$(call rollout,docker compose pull &&)

# Registry-free variant: builds locally and streams the images to the server over SSH.
deploy-direct:
	@test -z "$$(git status --porcelain)" || { echo "Working tree is dirty: commit or stash first"; exit 1; }
	docker build -t $(REGISTRY)/respulse-backend:$(TAG) backend
	docker build -t $(REGISTRY)/respulse-frontend:$(TAG) frontend
	docker save $(REGISTRY)/respulse-backend:$(TAG) $(REGISTRY)/respulse-frontend:$(TAG) | gzip | ssh $(PROD_HOST) 'gunzip | docker load'
	$(call rollout,)

# Off-host copy of the server's DB dumps (cron on the server writes them daily at 03:17 UTC).
BACKUP_LOCAL ?= $(HOME)/backups/respulse

backup-pull:
	@mkdir -p -m 700 $(BACKUP_LOCAL)
	scp -p $(PROD_HOST):$(PROD_DIR)/backups/db-*.dump $(BACKUP_LOCAL)/
	@ls -1t $(BACKUP_LOCAL)/db-*.dump | head -3

# --- Tauri 2 Cross-Platform Desktop & Mobile ---
tauri-dev:
	PATH="$(HOME)/.cargo/bin:$$PATH" npx @tauri-apps/cli dev

tauri-build:
	PATH="$(HOME)/.cargo/bin:$$PATH" npx @tauri-apps/cli build

tauri-android-init:
	PATH="/home/dev/android-ndk-r26d/toolchains/llvm/prebuilt/linux-x86_64/bin:$(HOME)/.cargo/bin:$$PATH" ANDROID_HOME="/home/dev/android-sdk" NDK_HOME="/home/dev/android-ndk-r26d" npx @tauri-apps/cli android init --ci --skip-targets-install

ANDROID_TARGET ?= aarch64

tauri-android-build:
	PATH="/home/dev/android-ndk-r26d/toolchains/llvm/prebuilt/linux-x86_64/bin:$(HOME)/.cargo/bin:$$PATH" ANDROID_HOME="/home/dev/android-sdk" NDK_HOME="/home/dev/android-ndk-r26d" npx @tauri-apps/cli android build --debug --target $(ANDROID_TARGET) --apk

tauri-android-release:
	PATH="/home/dev/android-ndk-r26d/toolchains/llvm/prebuilt/linux-x86_64/bin:$(HOME)/.cargo/bin:$$PATH" ANDROID_HOME="/home/dev/android-sdk" NDK_HOME="/home/dev/android-ndk-r26d" npx @tauri-apps/cli android build --target $(ANDROID_TARGET) --apk

tauri-android-bundle:
	PATH="/home/dev/android-ndk-r26d/toolchains/llvm/prebuilt/linux-x86_64/bin:$(HOME)/.cargo/bin:$$PATH" ANDROID_HOME="/home/dev/android-sdk" NDK_HOME="/home/dev/android-ndk-r26d" npx @tauri-apps/cli android build --target $(ANDROID_TARGET) --aab

tauri-android-install:
	cmd.exe /c "cd /d C:\Users\andre && C:\Users\andre\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r \\\\wsl.localhost\\Debian$(CURDIR)\\src-tauri\\gen\\android\\app\\build\\outputs\\apk\\universal\\release\\app-universal-release.apk" < /dev/null


