# ResPulse — Modern Uptime & Synthetic Monitoring Service

> Высокопроизводительный сервис мониторинга доступности сайтов, API, портов и SSL-сертификатов на стеке **Rust (Axum)** + **React** + **Tailwind CSS** + **shadcn/ui**.

## 🚀 Возможности

- **Многопротокольный мониторинг:**
  - **HTTP(S):** Проверка кодов ответа, поиск ключевых слов в теле, методы (GET, POST, HEAD, PUT), кастомные заголовки.
  - **SSL/TLS Certificates:** Мониторинг срока истечения сертификата и своевременные предупреждения.
  - **TCP Port:** Мониторинг баз данных (PostgreSQL, MySQL, Redis) и сетевых портов.
  - **Heartbeat (Dead Man's Switch):** Push-мониторинг для крон-джобов, бэкапов и воркеров.
- **Интерактивный дашборд (React + shadcn/ui):**
  - Живое обновление по **WebSocket** без необходимости обновлять страницу.
  - 30-полосные таймлайн-графики аптайма с детальными тултипами.
  - Графики латентности (Recharts) с метриками отклика.
  - Мгновенный ручной тест любой точки (ручной запуск проверки).
- **Публичная Status Page:**
  - Доступна в один клик по переключателю в шапке.
  - Отображение статуса сервисов, активных инцидентов и глобального SLA.
- **Локальный доступ по HTTPS:**
  - Доступно по адресу: **`https://respulse.wsl.local`** (через Caddy reverse proxy с автоматическим SSL).

## 🛠 Технологический стек

- **Backend:** Rust 1.82, Axum 0.7, Tokio (async), SQLx, Reqwest, Rustls, WebPki.
- **Frontend:** React 18, Vite, Tailwind CSS, shadcn/ui, Radix UI primitives, Recharts, Lucide Icons.
- **Database:** PostgreSQL 16.
- **Reverse Proxy & SSL:** Caddy 2 с локальным корневым центром сертификации.

## 📦 Быстрый запуск под Docker

```bash
# Запуск контейнеров (PostgreSQL, Rust Backend, React Frontend)
make up

# Наполнение тестовыми мониторами
make seed

# Просмотр логов
make logs
```

После запуска сервис сразу доступен в браузере по адресу:
👉 **[https://respulse.wsl.local](https://respulse.wsl.local)**
