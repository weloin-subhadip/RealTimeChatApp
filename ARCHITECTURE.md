# Architecture

A WhatsApp-style real-time chat app: 1-1 & group chat, presence, typing,
delivery/read receipts, media (images/PDF/voice), notifications, and search.

- **Backend:** TypeScript · Express · Socket.IO · Mongoose (MongoDB) · ioredis (Redis)
- **Frontend:** React · Vite · TypeScript · Zustand · Tailwind · socket.io-client
- **Infra:** Docker Compose (mongo + redis + server + nginx-served client)

---

## 1. The big picture

```
                         ┌───────────────────────── nginx (client container, :8080) ─────────────────────────┐
  Browser  ──HTTP/WS──▶  │  serves built React SPA (static)                                                   │
                         │  proxies  /api/*  /uploads/*  → server:4000   |   /socket.io (WebSocket) → server   │
                         └───────────────────────────────────────┬──────────────────────────────────────────┘
                                                                  │
                                          ┌───────────────────────▼───────────────────────┐
                                          │  server (Node, :4000)                           │
                                          │  ┌─────────────┐        ┌──────────────────┐    │
                                          │  │ Express REST│        │ Socket.IO        │    │
                                          │  │ auth, convo,│        │ message/typing/  │    │
                                          │  │ msgs, upload│        │ receipt/focus    │    │
                                          │  │ , search    │        │ + presence       │    │
                                          │  └──────┬──────┘        └────────┬─────────┘    │
                                          │         │   services / models    │              │
                                          └─────────┼────────────────────────┼──────────────┘
                                                    ▼                        ▼
                                              MongoDB (persist)        Redis (pub/sub adapter,
                                            users/convos/messages       presence, typing relay,
                                                                        unread, focus, refresh tokens)
```

**Two channels, one origin.** Request/response work (login, history, uploads,
search) goes over **REST**. Everything live (new messages, typing, presence,
receipts, notifications) goes over **Socket.IO**. In production the browser only
ever talks to nginx on `:8080`; nginx serves the SPA and reverse-proxies both
channels to the server, so there's one origin and no CORS in play.

**Why Redis (beyond a cache):** (1) the **Socket.IO Redis adapter** lets events
fan out across multiple server instances — horizontal scaling with no code
change; (2) **presence**, **typing relay context**, **unread counts**, **focus**,
and the **refresh-token whitelist** all live in Redis as fast, ephemeral state.

---

## 2. Folder structure

### Folders at a glance (directories only)

```
RealTimeChatWithRedis/
├── server/                      # Backend — Express + Socket.IO + Mongo + Redis (ESM TypeScript)
│   ├── uploads/                 # local media storage (Docker volume)
│   └── src/
│       ├── config/              # env validation, Mongo + Redis connections
│       ├── models/              # Mongoose schemas + DTO mappers
│       ├── middleware/          # auth guard, body validation, file upload, error handling
│       ├── routes/              # Express routers (path + guards → controller)
│       ├── controllers/         # HTTP request/response glue
│       ├── services/            # business logic (shared by REST + sockets)
│       ├── redis/               # presence / unread / refresh-token helpers
│       ├── sockets/             # Socket.IO server, lifecycle, auth, rooms
│       │   └── handlers/        # one file per real-time feature
│       └── utils/               # jwt, logger, async wrapper
│
└── client/                      # Frontend — React + Vite + TypeScript
    └── src/
        ├── api/                 # REST clients (axios)
        ├── socket/              # socket.io client + emit helpers
        ├── store/               # Zustand state stores
        ├── hooks/               # React hooks (auth bootstrap, socket, focus, recorder)
        ├── pages/               # route-level pages (Login, Register, Chat)
        ├── components/          # UI components
        ├── utils/               # formatting + notification helpers
        └── types/               # shared TypeScript types
```

### Every file (annotated)

```
RealTimeChatWithRedis/
├── docker-compose.yml          # 4 services: mongo, redis, server, client (nginx). Healthcheck-gated startup.
├── .env                        # compose secrets (JWT_*, CLIENT_PORT). git-ignored.
├── .env.example                # template for the above — `cp .env.example .env`
├── .gitignore
├── README.md                   # how to run (Docker + local dev)
├── ARCHITECTURE.md             # this file
│
├── server/                     # ── Backend: Express + Socket.IO + Mongo + Redis (ESM TypeScript) ──
│   ├── Dockerfile              # multi-stage: tsc build → slim runtime (node dist/server.js)
│   ├── .dockerignore
│   ├── .env / .env.example     # PORT, MONGO_URI, REDIS_URL, JWT_*, COOKIE_SECURE, TTLs
│   ├── package.json            # scripts: dev (tsx watch), build (tsc), start (node dist)
│   ├── package-lock.json
│   ├── tsconfig.json           # ESM, module=NodeNext, strict
│   ├── uploads/                # local media storage (volume in Docker); .gitkeep only in git
│   └── src/
│       ├── server.ts           # ENTRYPOINT. bootstrap(): connect Mongo → Redis → build app → init Socket.IO → listen
│       ├── app.ts              # builds the Express app: cors, json, cookies, /uploads static, mounts routers, error handlers
│       │
│       ├── config/
│       │   ├── env.ts          # Zod-validated process.env (fails fast on missing/invalid). Exports typed `env`.
│       │   ├── db.ts           # connectMongo() via mongoose
│       │   └── redis.ts        # shared ioredis client + createPubSubClients() (dedicated pair for the SIO adapter)
│       │
│       ├── models/             # Mongoose schemas + DTO mappers (never leak internal/hash fields)
│       │   ├── user.model.ts           # User (name,email,passwordHash[select:false],status,lastSeen) + toPublicUser
│       │   ├── conversation.model.ts   # Conversation (type,participants,name,admins,createdBy,lastMessage) + toPublicConversation
│       │   └── message.model.ts        # Message (type,text,media,status,deliveredTo,readBy) + MediaInfo + toPublicMessage
│       │
│       ├── middleware/
│       │   ├── authJwt.ts      # REST guard: verifies Bearer access token → sets req.userId
│       │   ├── validate.ts     # validateBody(zodSchema) → 400 on bad input, replaces req.body with parsed
│       │   ├── upload.ts        # multer disk storage (UUID filenames, type filter, 10MB cap) + UPLOAD_DIR
│       │   └── errorHandler.ts # AppError class, notFound (404), errorHandler (AppError/Multer/500)
│       │
│       ├── routes/             # thin Express routers → controllers (all auth-gated except /auth/{register,login,refresh})
│       │   ├── auth.routes.ts          # POST register/login/refresh/logout, GET me
│       │   ├── user.routes.ts          # GET / (list other users)
│       │   ├── conversation.routes.ts  # list/create direct, create group, rename, add/remove member, GET history
│       │   ├── upload.routes.ts        # POST / (multer single file)
│       │   └── search.routes.ts        # GET / (message search)
│       │
│       ├── controllers/        # HTTP request/response glue (parse, call service, set status/cookies, emit socket events)
│       │   ├── auth.controller.ts          # sets/clears the httpOnly refresh cookie (secure ← COOKIE_SECURE)
│       │   ├── user.controller.ts
│       │   ├── conversation.controller.ts  # also does socket room join/leave + conversation:* events on group ops
│       │   ├── upload.controller.ts
│       │   └── search.controller.ts
│       │
│       ├── services/           # business logic (no HTTP/socket types — reusable from REST and sockets)
│       │   ├── auth.service.ts         # register/login/refresh(rotate)/logout/getMe; bcrypt; issues token pairs
│       │   ├── conversation.service.ts # direct get-or-create, group create/add/remove/rename, admin checks, room-id lookup
│       │   ├── message.service.ts      # createMessage (+lastMessage preview), paginated getHistory, searchMessages
│       │   ├── presence.service.ts     # onUserConnected/Disconnected → Redis presence + DB status/lastSeen
│       │   └── receipt.service.ts      # markDelivered/markRead — aggregate flips only when ALL recipients covered
│       │
│       ├── redis/              # typed helpers over the shared ioredis client
│       │   ├── tokens.ts       # refresh-token whitelist (rotation + revocation)
│       │   ├── presence.ts     # per-user connection counter + online set + isOnline
│       │   └── unread.ts       # unread hash (per conversation) + focus key (the chat you're viewing)
│       │
│       ├── sockets/
│       │   ├── index.ts        # creates io, attaches Redis adapter, runs auth middleware, owns the connection lifecycle
│       │   ├── io.ts            # setIO/getIO — lets REST controllers emit/join rooms
│       │   ├── rooms.ts        # room-name helpers: userRoom(id), conversationRoom(id)
│       │   ├── socketAuth.ts   # handshake JWT check → socket.userId (rejects unauthenticated)
│       │   └── handlers/       # per-feature event handlers (registered synchronously on connect)
│       │       ├── message.handler.ts  # message:send → persist → broadcast message:new (+delivered status, +unread/notify)
│       │       ├── typing.handler.ts   # typing:start/stop relay (room-membership authorized, no DB hit)
│       │       ├── receipt.handler.ts  # message:read handler + deliverBacklogOnConnect sweep
│       │       └── focus.handler.ts    # conversation:focus → set/clear focus key + reset unread
│       │
│       └── utils/
│           ├── jwt.ts          # sign/verify access & refresh tokens, getTokenTtlSeconds
│           ├── asyncHandler.ts # wraps async route handlers so rejections hit the error middleware
│           └── logger.ts       # tiny timestamped console logger
│
└── client/                     # ── Frontend: React SPA (Vite + TypeScript) ──
    ├── Dockerfile              # multi-stage: vite build → nginx serves dist + proxies API/WS
    ├── .dockerignore
    ├── nginx.conf              # SPA fallback + reverse proxy for /api, /uploads, /socket.io (WS upgrade)
    ├── index.html              # Vite HTML entry (#root)
    ├── package.json / package-lock.json
    ├── tsconfig.json           # bundler resolution, strict
    ├── vite.config.ts          # dev server + proxy (/api, /uploads, /socket.io) → :4000  (DEV ONLY; nginx replaces it in prod)
    ├── tailwind.config.js / postcss.config.js
    └── src/
        ├── main.tsx            # React root render
        ├── App.tsx             # bootstraps auth + React Router (login/register public, chat protected)
        ├── index.css           # Tailwind directives
        │
        ├── types/index.ts      # shared TS types: User, Participant, Conversation, Message, MediaInfo, statuses
        │
        ├── api/                # REST layer (axios)
        │   ├── client.ts       # axios instance (baseURL /api, withCredentials) + request token + 401-refresh interceptor
        │   ├── auth.ts         # register/login/logout/fetchMe
        │   ├── users.ts        # listUsers
        │   ├── conversations.ts# listConversations(+unread), create direct/group, add/remove member, getHistory(before)
        │   ├── upload.ts        # uploadFile (multipart) + mediaTypeFromMime
        │   └── search.ts       # searchMessages
        │
        ├── socket/socket.ts    # singleton socket.io client + emit helpers (send, sendMedia, typing, read, focus)
        │
        ├── store/              # Zustand state (no Redux)
        │   ├── authStore.ts        # user + access token (memory only) + status
        │   ├── chatStore.ts        # conversations, activeId, messages+pagination per convo, optimistic reconcile, receipts
        │   ├── presenceStore.ts    # set of online user ids
        │   ├── typingStore.ts      # who is typing, per conversation
        │   └── unreadStore.ts      # unread counts per conversation
        │
        ├── hooks/
        │   ├── useBootstrapAuth.ts # on load: refresh cookie → access token → fetchMe (restores session); StrictMode-guarded
        │   ├── useChatSocket.ts    # connects socket; routes ALL live events into stores; reconnection refresh
        │   ├── useFocusTracking.ts # emits conversation:focus from (activeId + tab visibility); clears local unread
        │   └── useVoiceRecorder.ts # MediaRecorder wrapper → Blob + duration
        │
        ├── pages/
        │   ├── LoginPage.tsx
        │   ├── RegisterPage.tsx
        │   └── ChatPage.tsx     # the app shell: sidebar (search, new chat, list) + ChatWindow; owns socket + data load
        │
        ├── components/
        │   ├── ProtectedRoute.tsx   # gate on auth status (loading/authenticated/unauthenticated)
        │   ├── SearchBar.tsx        # debounced message search; click result → open conversation
        │   ├── NewChat.tsx          # start a direct chat OR create a group (multi-select + name)
        │   ├── ConversationList.tsx # sidebar list: title, last-message preview, online dot, unread badge
        │   ├── ChatWindow.tsx       # header (presence/typing or group info) + message list (infinite scroll) + composer
        │   ├── MessageBubble.tsx    # one message: text/image/pdf/voice body + time + ticks (sending/✓/✓✓)
        │   ├── MessageComposer.tsx  # text input (optimistic send) + 📎 attach + 🎤 record; emits typing
        │   ├── GroupInfo.tsx        # member list, add/remove (admin), leave group
        │   └── Avatar.tsx           # initials circle + optional presence dot
        │
        └── utils/
            ├── conversation.ts # otherParticipant() + conversationTitle()
            ├── notify.ts       # messagePreview(), browser Notification permission + show
            └── time.ts         # formatTime(), formatDuration()
```

---

## 3. Layering (backend)

Requests flow **route → controller → service → model/redis**, and each layer has
one job:

- **routes** — declare the path, attach `authJwt` + `validateBody`, point at a controller.
- **controllers** — translate HTTP (read `req`, set status/cookies, JSON out). For group ops they also drive socket side-effects (`socketsJoin/Leave`, emit `conversation:*`).
- **services** — the actual logic; take/return plain data so both REST controllers *and* socket handlers can call them (e.g. `createMessage` is used by the socket handler; `markRead` by both a socket event and the connect sweep).
- **models** — Mongoose schemas + `toPublic*` mappers that produce the exact DTOs the client receives (never the password hash, never raw `_id` typing).

The same split exists for real-time: **sockets/index.ts** owns the lifecycle and
delegates to **handlers/** (one file per feature), which call the same services.

---

## 4. How each feature works

### Auth (JWT, `services/auth.service.ts`, `api/client.ts`)
- Passwords hashed with bcrypt. Login/register issue an **access token** (15m, returned in JSON, held in memory by Zustand) and a **refresh token** (7d, set as an **httpOnly cookie** scoped to `/api/auth`).
- Every refresh token's `jti` is whitelisted in Redis (`redis/tokens.ts`). **Refresh rotates**: the old jti is revoked and a new one issued — a stolen refresh token dies as soon as the real client refreshes. Logout deletes the jti.
- The client keeps the access token **in memory only** (XSS-safer). On page load `useBootstrapAuth` calls `/auth/refresh` (cookie-based) to mint a new access token and restore the session. The axios interceptor transparently refreshes-and-retries once on any `401`.
- `COOKIE_SECURE` env controls the cookie `Secure` flag so the same production build runs over plain HTTP locally (false) or HTTPS in prod (true).

### Real-time messaging (`sockets/`, `chatStore.ts`)
- On connect, `socketAuth` verifies the access token from the handshake, then the socket **joins a room per conversation** (`conversation:<id>`) plus a personal room (`user:<id>`). Handlers are registered **synchronously before any await** (a bug we hit: an async gap dropped events sent immediately after connect).
- `message:send` → validate (Zod, text *or* media union) → authorize (sender ∈ participants) → persist → **broadcast `message:new` to the conversation room**. The sender is in that room too, so its own message renders from the broadcast (reconciled with the optimistic placeholder via `clientId`).

### Presence & typing (`redis/presence.ts`, `services/presence.service.ts`, `handlers/typing.handler.ts`)
- Presence is a **per-user connection counter** + an online set in Redis. A user only flips online on the *first* socket and offline on the *last* — so multiple tabs/devices don't cause flapping. Offline stamps `lastSeen` in Mongo. New sockets get a `presence:state` snapshot; others get `presence:online`/`presence:offline`.
- Typing is a pure broadcast (`typing:start/stop`) to the conversation room, authorized by **in-memory room membership** (no DB hit per keystroke). Not persisted; the receiver auto-clears after 4s in case a stop is missed.

### Receipts (`services/receipt.service.ts`, `handlers/receipt.handler.ts`)
- **Delivered is server-driven**: a message is born `delivered` if all other participants are online at send time; otherwise a **connect-time sweep** marks it delivered when a recipient comes online.
- **Read is client-driven**: opening/viewing a conversation emits `message:read`.
- **Group-correct**: each message tracks `deliveredTo[]` and `readBy[]`; the aggregate `status` advances to `delivered`/`read` only when *every* other participant is covered. (For 1-1, that's just the one other person.) Changes fan out as `receipt:update` carrying the exact `messageIds`.

### Media (`middleware/upload.ts`, `handlers/message.handler.ts`)
- `POST /api/upload` (multer, disk, UUID names, type-filtered, 10MB) returns `{url, filename, mimeType, size}`. The client then sends a `message:send` with `type` + `media`. The server validates the `media.url` matches `/uploads/...` so a message can't point at an external URL. Voice notes are recorded in-browser (`useVoiceRecorder` → MediaRecorder) and uploaded like any file with a measured `durationSec`.

### Groups (`conversation.service.ts`, `conversation.controller.ts`, `GroupInfo.tsx`)
- A group is a `Conversation` with `type:"group"`, a `name`, `admins[]`, and `createdBy`. Messaging/typing/receipts already work via rooms regardless of type.
- Member management is admin-gated (self-leave allowed). The controller drives the **socket room choreography**: `socketsJoin` to onboard, `socketsLeave` to evict, and `conversation:new` / `conversation:updated` / `conversation:removed` events so every client's list stays live.

### Notifications & unread (`redis/unread.ts`, `handlers/focus.handler.ts`, `useFocusTracking.ts`)
- The client reports a **focus** signal = the open conversation *while the tab is visible* (`conversation:focus`, or `null`). The server stores it per user.
- On send, for each recipient **not focused** on that chat, the server bumps an unread counter (Redis hash) and emits `notification:new` with the new count. The client shows a badge, a tab-title count, and — only when the tab is hidden and permission was granted — an OS notification. One signal cleanly covers "chat open" (nothing), "chat closed" (badge+notify), and "open but backgrounded" (notify).

### Search (`message.service.searchMessages`, `SearchBar.tsx`)
- `GET /api/search?q=` does a case-insensitive, regex-escaped match across the user's conversations (text messages). Debounced in the UI; clicking a result opens that conversation.

### Polish (`chatStore.ts`, `ChatWindow.tsx`, `useChatSocket.ts`)
- **Optimistic send**: a placeholder (`status: "sending"`, temp `clientId`) appears instantly; when the server echoes the message with that `clientId`, it's swapped for the real one (or marked `failed`).
- **Infinite scroll**: history loads 30 at a time via a `before` cursor; scrolling to the top prepends older pages while **preserving viewport position** (only genuinely new messages auto-stick to the bottom).
- **Reconnection**: on socket reconnect, the client refreshes conversations + unread + the open chat's history and re-asserts focus, so nothing missed while offline lingers.

---

## 5. Data models (MongoDB)

```
User          { name, email(unique), passwordHash(hidden), avatarUrl?, status, lastSeen, timestamps }
Conversation  { type:"direct"|"group", participants[User], name?, avatarUrl?, admins[User]?,
                createdBy?, lastMessage?{text,senderId,type,createdAt}, timestamps }
Message       { conversationId, senderId, type:"text"|"image"|"pdf"|"voice", text?,
                media?{url,filename,mimeType,size,durationSec?}, status:"sent"|"delivered"|"read",
                deliveredTo[User], readBy[{userId,readAt}], timestamps }
```
Indexes: `Message {conversationId, createdAt}` (paginated history), `Conversation {participants, updatedAt}` (your list).

---

## 6. Socket.IO event contract

| Event | Direction | Purpose |
|-------|-----------|---------|
| `message:send` (ack) | client→server | Send text/media; ack returns the saved message |
| `message:new` | server→room | A new message (carries `clientId` for the sender to reconcile) |
| `message:read` | client→server | "I viewed this conversation" |
| `receipt:update` | server→room | `{messageIds, status, by}` — delivered/read advanced |
| `typing:start` / `typing:stop` | both | Relayed to the conversation room |
| `presence:state` | server→socket | Online snapshot on connect |
| `presence:online` / `presence:offline` | server→all | Presence change (+`lastSeen` on offline) |
| `conversation:focus` | client→server | `{conversationId|null}` — drives unread/notifications |
| `notification:new` | server→user | `{conversationId, unread, message}` for an unfocused chat |
| `conversation:new` / `:updated` / `:removed` | server→clients | Conversation lifecycle (incl. groups) |

Rooms: `user:<userId>` (cross-conversation events) and `conversation:<conversationId>` (per-chat events).

---

## 7. Redis keys

| Key | Type | Purpose |
|-----|------|---------|
| `refresh:<userId>:<jti>` | string (TTL) | Refresh-token whitelist (rotation/revocation) |
| `presence:count:<userId>` | int | Live connection count (online while > 0) |
| `presence:online` | set | All currently-online user ids |
| `unread:<userId>` | hash | conversationId → unread count |
| `focus:<userId>` | string | Conversation the user is actively viewing |
| Socket.IO adapter keys | — | Cross-instance pub/sub fan-out |

---

## 8. Running it

**Docker (whole stack):** `cp .env.example .env` → `docker compose up --build` → open `http://localhost:8080`.
Compose starts mongo → redis (healthchecked) → server (healthchecked) → client (nginx). Only `:8080` is published; `uploads_data` volume persists media. Stop with `docker compose down` (`-v` to wipe data).

**Local dev (hot reload):** `docker compose up -d mongo redis`, then `npm run dev` in `server/` (:4000) and `client/` (:5173, Vite proxies to :4000).

See `README.md` for the short version.
