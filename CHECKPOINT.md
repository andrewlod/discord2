# Discord 2 - Implementation Checkpoint (Updated)

**Date**: 2026-08-26  
**Status**: Phase 1 Complete - Foundation Built & Tested ✓

---

## What's Working (Verified)

### Backend (Go) ✓
- **Database**: PostgreSQL with migrations (all tables created)
- **Auth**: JWT (access + refresh tokens), bcrypt, Google OAuth 2.0
  - Register: ✓
  - Login: ✓ (requires email_verified=true)
  - Refresh tokens: ✓
- **Servers**: Create, List ✓
- **Channels**: Create, List ✓
- **WebSocket Hub**: Running on `/api/v1/ws`
- **Health check**: `GET /health` → `{"status":"ok"}`

### Database Schema (All tables created)
- `users`, `servers`, `server_members`, `channels`, `channel_permissions`
- `messages`, `message_attachments`, `message_reactions`
- `dm_channels`, `dm_participants`
- `roles`, `invites`, `voice_states`, `call_history`
- `refresh_tokens`, `email_verification_tokens`

### Frontend (React + Vite) ✓
- Accessible at http://localhost:5173
- Vite dev server with HMR
- Tailwind CSS configured

### Docker Compose ✓
```bash
docker compose up --build -d
```
- PostgreSQL (healthy)
- Backend (Go + air hot reload)
- Frontend (Vite dev server)

---

## Tested API Endpoints

| Endpoint | Method | Status |
|----------|--------|--------|
| `/health` | GET | ✓ |
| `/api/v1/auth/register` | POST | ✓ |
| `/api/v1/auth/login` | POST | ✓ |
| `/api/v1/auth/me` | GET | ✓ |
| `/api/v1/servers` | GET | ✓ |
| `/api/v1/servers` | POST | ✓ |
| `/api/v1/servers/:id/channels` | GET | ✓ |
| `/api/v1/servers/:id/channels` | POST | ✓ |

---

## Fixed Issues

1. **Config parsing**: Added `mapstructure` tags to all config structs for proper YAML snake_case → CamelCase mapping
2. **Env var precedence**: Env vars (DATABASE_HOST=postgres) now override config.yaml (localhost)
3. **Timestamp scanning**: Fixed `timestamptz` scanning by using `time.Time` + RFC3339 format
4. **Nil slice serialization**: Initialize slices as `[]Type{}` to return `[]` not `null`
5. **Gin validation**: Removed `binding:"required"` from `Type` field to avoid field name vs json tag conflict

---

## Environment Variables (Working)

```bash
# Backend (in docker-compose.yml)
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=discord2
DATABASE_SSLMODE=disable
DATABASE_MAX_OPEN_CONNS=25
DATABASE_MAX_IDLE_CONNS=5
DATABASE_MAX_CONN_LIFETIME=5m
JWT_SECRET=dev-secret-change-me-in-production
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=168h
FRONTEND_URL=http://localhost:5173
```

---

## Next Steps (Phases 2-3)

### Phase 2: LiveKit Voice/Video (3 weeks)
| Week | Tasks |
|------|-------|
| 1 | LiveKit client + token service, voice channel join/leave, VoiceTile/Grid |
| 2 | 1:1 & group calls (ringing UI), screen share (desktopCapturer), Go Live |
| 3 | Video quality settings, device picker, noise suppression, connection quality |

**Backend additions needed**:
- `internal/livekit/{client,token,webhook,service,types,config}.go`
- WebSocket opcodes: VOICE_STATE_UPDATE, CALL_INCOMING, CALL_ACTION, STREAM_START
- REST: `/voice/token`, `/calls/*`, `/live/*`

**Frontend additions needed**:
- `components/voice/` - VoiceChannelButton, VoiceConnection, VoiceTile, VoiceGrid, VoiceControls, VideoSettings, ScreenSharePicker, IncomingCallModal, CallToolbar, ParticipantList, GoLiveIndicator
- `@livekit/components-react` integration
- Video quality selector (360p/480p/720p/1080p)
- Electron preload: `screen.getSources()`

### Phase 3: Polish & Features (2 weeks)
- DMs: list, create, messages
- Reactions (add/remove, picker)
- File upload (attachments)
- Message editing/deletion
- Server roles + permissions basics
- Invite system
- Search (PostgreSQL tsvector or Meilisearch)

### Phase 4: Electron Desktop App (2 weeks)
- Native menus, system tray, notifications
- Auto-updater (electron-updater)
- Keyboard shortcuts (Cmd/Ctrl+K, etc.)
- Build: macOS (DMG), Windows (NSIS), Linux (AppImage)
- Code signing / notarization

### Phase 5: Production (2 weeks)
- Rate limiting, security headers
- Logging (zerolog), metrics (Prometheus)
- Load testing WebSocket connections
- CI/CD (GitHub Actions)
- Documentation

---

## To Resume

```bash
# Start dev environment
cd /home/andre/projects/discord2
docker compose up --build -d

# Test endpoints
curl http://localhost:8080/health
curl http://localhost:5173

# Backend logs
docker logs discord2-backend-1 -f
```