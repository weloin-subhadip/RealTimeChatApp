# RealTimeChatWithRedis

A WhatsApp-style real-time chat app — 1-1 & group chat, online/offline presence,
typing indicators, delivery/read receipts, real-time notifications, and media
messages (images, PDFs, voice notes).

**Stack:** TypeScript · Express · Socket.IO · Redis · MongoDB (backend) · React + Vite (frontend)

## Monorepo layout

```
RealTimeChatWithRedis/
├── server/   # Express + Socket.IO API (TypeScript)
├── client/   # React SPA (Vite + TypeScript) + nginx (prod image)
└── docker-compose.yml   # full stack: mongo + redis + server + client
```

## Run with Docker (whole stack, one command)

The entire app runs in containers — Mongo, Redis, the Node server, and the
client (built and served by nginx, which also proxies the API + WebSocket).

```bash
cp .env.example .env          # set JWT secrets; adjust CLIENT_PORT if you like
docker compose up --build
```

Then open **http://localhost:8080**. Health check: `curl http://localhost:8080/api/health`.

Stop with `docker compose down` (add `-v` to also wipe Mongo/Redis data and
uploaded media).

> Served over plain HTTP, so `COOKIE_SECURE=false` (set in compose). Behind
> HTTPS, set `COOKIE_SECURE=true` and point `CLIENT_URL` at your public origin.

## Run locally without Docker (hot reload)

Useful while developing. Infra in Docker, apps on the host with hot reload:

```bash
docker compose up -d mongo redis     # just the datastores

cd server && cp .env.example .env && npm install && npm run dev   # :4000
cd client && npm install && npm run dev                            # :5173
```

Open http://localhost:5173 (Vite dev server; proxies API/WS to :4000).

## How the pieces fit

- **Express (REST)** — auth, paginated message history, media upload, group management.
- **Socket.IO** — live events (new messages, typing, presence, receipts, notifications) over rooms keyed by conversation.
- **MongoDB** — persistence: users, conversations, messages.
- **Redis** — Socket.IO pub/sub adapter, presence (TTL keys), typing state, unread counts, refresh-token storage.

## Build roadmap — all phases complete ✅

| Phase | Feature | Status |
|-------|---------|--------|
| 0 | Scaffold + infra | ✅ |
| 1 | Auth (JWT access + refresh) | ✅ |
| 2 | 1-1 chat (real-time) | ✅ |
| 3 | Presence + typing indicators | ✅ |
| 4 | Delivery / read receipts | ✅ |
| 5 | Media (images, PDF, voice notes) | ✅ |
| 6 | Group chat | ✅ |
| 7 | Real-time notifications + unread badges | ✅ |
| 8 | Polish (search, infinite scroll, optimistic send, reconnection) | ✅ |

## Features

- **Auth** — register / login, JWT access token (in memory) + refresh token (httpOnly cookie, rotated), session restore.
- **1-1 & group chat** — real-time messaging over Socket.IO rooms; create groups with admins, add/remove members, self-leave.
- **Presence & typing** — Redis-backed online/offline (multi-device aware) + "typing…" indicators.
- **Receipts** — sent / delivered / read ticks; group-correct (flips only when *all* members are covered).
- **Media** — images, PDFs, and in-browser voice notes (`multer` uploads to local disk).
- **Notifications** — per-conversation unread counts (Redis), unread badges, tab-title count, and OS notifications when the tab is hidden.
- **Polish** — message search, infinite-scroll history, optimistic send, and reconnection refresh.
