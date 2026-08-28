# Discord 2

A Discord clone built with Go (backend) + Electron + React (frontend) with PostgreSQL and LiveKit (self-hosted or Cloud) for voice.

## Architecture

```
discord2/
├── backend/          # Go API + WebSocket server
│   ├── cmd/server/   # Entry point
│   ├── internal/     # Private packages
│   │   ├── auth/     # JWT + Google OAuth
│   │   ├── db/       # Database connection & migrations
│   │   ├── ws/       # WebSocket hub
│   │   ├── api/      # REST API handlers
│   │   └── middleware/
│   └── Dockerfile
├── frontend/         # Electron + React + TypeScript
│   ├── src/
│   │   ├── main/     # Electron main process
│   │   ├── preload/  # Secure IPC bridge
│   │   └── renderer/ # React application
│   └── Dockerfile
├── docker-compose.yml
└── docker-compose.prod.yml
```

## Features

- **Authentication**: Email/password + Google OAuth 2.0
- **Real-time messaging**: WebSocket-based chat with optimistic updates
- **Servers & Channels**: Create/join servers, text/voice channels, categories
- **Direct Messages**: 1:1 and group DMs
- **Voice channels**: Join/leave with real-time presence (broadcast over the app WebSocket) plus LiveKit audio (self-hosted or Cloud). Mic mute/unmute via the in-call control bar.
- **Desktop App**: Electron with native menus, tray, notifications
- **Modern UI**: Discord-like design with Tailwind CSS

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Go 1.27+ (for local development)
- Node.js 20+ (for frontend development)
- LiveKit server — either self-hosted via the `livekit` Docker Compose service, or a LiveKit Cloud project (for voice)

### Development

1. Clone and configure:
```bash
cp .env.example .env
# Edit .env with your credentials
```

2. Start with Docker Compose:
```bash
docker-compose up -d
```

This starts:
- PostgreSQL on port 5432
- Backend API on port 8080
- Frontend dev server on port 5173
- LiveKit server on port 7880 (signaling/WS) + 7882/udp (media) — required for voice

3. Access the app:
- Frontend: http://localhost:5173
- API: http://localhost:8080
- Health check: http://localhost:8080/health

### Local Development (without Docker)

#### Backend
```bash
cd backend
go mod download
# Requires PostgreSQL running locally
go run cmd/server/main.go
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Production Deployment

1. Configure production environment:
```bash
cp .env.example .env.prod
# Edit with production values
```

2. Deploy:
```bash
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_HOST` | PostgreSQL host | Yes |
| `DATABASE_PORT` | PostgreSQL port | Yes |
| `DATABASE_USER` | PostgreSQL user | Yes |
| `DATABASE_PASSWORD` | PostgreSQL password | Yes |
| `DATABASE_NAME` | Database name | Yes |
| `JWT_SECRET` | JWT signing secret (32+ chars) | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | For OAuth |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | For OAuth |
| `LIVEKIT_API_KEY` | LiveKit API key | For voice |
| `LIVEKIT_API_SECRET` | LiveKit API secret | For voice |
| `LIVEKIT_WS_URL` | LiveKit WebSocket URL (e.g. `ws://localhost:7880` self-hosted, or `wss://*.livekit.cloud`) | For voice |
| `LIVEKIT_API_URL` | LiveKit API URL (optional, for Cloud management) | No |
| `FRONTEND_URL` | Frontend URL for CORS | Yes |

## Voice / LiveKit Setup

Voice uses LiveKit. The backend mints per-user access tokens at `POST /api/v1/voice/token`
(room `voice-<channelId>`) and the frontend connects directly to the LiveKit server for audio.
Two options:

**Option A — Self-hosted (default in `docker-compose.yml`)**

The `livekit` service is included. Set in `.env`:

```
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_WS_URL=ws://localhost:7880
LIVEKIT_API_URL=http://localhost:7880
```

Ports `7880` (signaling/WS) and `7882/udp` (media) are published.

**Option B — LiveKit Cloud**

1. Create a project at [LiveKit Cloud](https://cloud.livekit.io)
2. Copy the API Key and Secret from project settings into `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`
3. Set `LIVEKIT_WS_URL` to the project's WebSocket URL (e.g. `wss://your-project.livekit.cloud`)
4. Configure environment variables

> Webhooks are not required for in-app voice; the token endpoint handles auth.

## Database Migrations

Migrations are in `backend/internal/db/migrations/` and run automatically on startup.

To create a new migration:
```bash
cd backend
migrate create -ext sql -dir internal/db/migrations -seq migration_name
```

## Project Structure Details

### Backend Packages

- `internal/auth` - JWT tokens, bcrypt, Google OAuth
- `internal/db` - PostgreSQL connection pool, migrations
- `internal/ws` - WebSocket hub, client management, broadcasting
- `internal/api` - REST handlers for servers, channels, messages, DMs, and LiveKit voice tokens
- `internal/middleware` - Auth, CORS, logging, rate limiting

### Frontend Structure

```
src/renderer/
├── components/
│   ├── layout/      # Sidebar, ChannelList, ChatArea, MemberList
│   ├── chat/        # Message, MessageList, MessageInput
│   ├── server/      # ServerIcon, CreateServerModal
│   ├── channel/     # ChannelItem, CreateChannelModal
│   ├── voice/       # VoiceChannelView, VoiceRoom (LiveKit audio UI)
│   ├── auth/        # LoginForm, RegisterForm
│   └── common/      # Button, Modal, Avatar, Dropdown
├── hooks/           # Custom React hooks
├── services/        # API client, WebSocket client
├── store/           # Zustand stores
├── pages/           # Page components
├── types/           # TypeScript types
└── utils/           # Helpers
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Go 1.27, Gin, Gorilla WebSocket, pgx, sqlc |
| Database | PostgreSQL 16 |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Desktop | Electron 28 |
| Real-time | WebSockets (chat + voice presence), LiveKit (voice audio, self-hosted or Cloud) |
| Auth | JWT, bcrypt, Google OAuth 2.0 |
| State | Zustand |
| Deployment | Docker, Docker Compose, Nginx |

## License

MIT
