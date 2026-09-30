# Сервер тренажёра (NestJS)

Telegram-бот, ежедневные напоминания и Web Push для PWA. Прогресс обучения здесь не хранится:
только настройки напоминаний и дата последнего занятия.

- **Бот** (`nestjs-telegraf`, вебхук): `/start`, `/time 19:30`, `/on`, `/off`, `/evening`, `/status`.
- **Напоминания** (`@nestjs/schedule`, каждую минуту): в выбранное время по часовому поясу пользователя,
  если сегодня ещё не занимались; вечером в 21:00 — «ещё не поздно» (можно выключить).
- **Web Push**: VAPID-ключи генерируются при первом запуске и хранятся в БД.
- **Авторизация**: Mini App — `Authorization: tma <initData>` (проверка подписи); PWA — `X-Device-Id: <uuid>`.

## Локально

```bash
cp .env.example .env          # впишите TELEGRAM_BOT_TOKEN, если нужен бот
docker compose up -d db       # Postgres на localhost:5433
npm install
npm run dev                   # http://localhost:3000, без PUBLIC_URL бот работает через polling
npm test                      # проверки подписи Telegram и расписания напоминаний
```

Или всё в контейнерах: `docker compose up --build`.

Во фронтенде укажите адрес API в `.env.local`: `VITE_API_URL=http://localhost:3000`.

## API

| Метод | Путь | Что делает |
|---|---|---|
| GET | `/health` | проверка живости |
| GET | `/api/push/vapid` | публичный VAPID-ключ |
| GET/PATCH | `/api/me` | настройки напоминаний (`remindEnabled`, `remindTime`, `eveningNudge`, `tz`) |
| POST | `/api/activity` | `{ date: 'YYYY-MM-DD' }` — «сегодня занимался(ась)» |
| POST/DELETE | `/api/push/subscribe` | подписка устройства на push |
| POST | `/api/reminders/test` | прислать тестовое напоминание |
| POST | `/tg/webhook` | вебхук Telegram (с секретным заголовком) |

## Деплой на Railway

1. New Project → Deploy from GitHub repo, **Root Directory: `server`** (сборка по `Dockerfile`, настройки в `railway.json`).
2. Add → Database → **PostgreSQL**. В сервисе сервера добавьте переменную `DATABASE_URL=${{Postgres.DATABASE_URL}}`.
3. Переменные сервиса: `TELEGRAM_BOT_TOKEN`, `WEBAPP_URL` (адрес фронтенда на Vercel).
4. Settings → Networking → **Generate Domain**. Railway передаст его в `RAILWAY_PUBLIC_DOMAIN`, и сервер сам зарегистрирует вебхук.
5. Во фронтенде (Vercel) задайте `VITE_API_URL=https://<домен сервера>` и передеплойте.

Миграции применяются автоматически при старте. Реплика должна быть одна — иначе напоминания задублируются.
