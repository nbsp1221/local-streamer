# Local Streamer

Personal media server application for streaming local video files through a web interface. Built with React Router v7 and pure Bun runtime.

## Features

- 🎬 Stream local video files through web browser
- 🔐 Shared-password auth gate with httpOnly site sessions
- 📁 File management with preparation and library folders
- 🔒 Protected DASH playback with JWT tokens, ClearKey, and encrypted media packaging
- 🎨 YouTube-inspired UI for video browsing
- ⚡ Pure Bun runtime for maximum performance

## Getting Started

### Development

```bash
# Install dependencies
bun install

# Configure the shared password gate
cp .env.example .env

# Start development server
bun dev
```

Access at http://localhost:5173

### Production

```bash
# Build application
bun run build

# Start production server
bun start
```

For local auth-only investigation, `AUTH_SHARED_PASSWORD` is sufficient.
For protected playback routes, also set `VIDEO_JWT_SECRET`.
For ingest and encrypted playback packaging, also set `VIDEO_MASTER_ENCRYPTION_SEED`.

## Docker Deployment

### Quick Start

```bash
# Start the application
docker-compose up -d

# Access at http://localhost:3000
```

### Features

✅ **Pure Bun runtime** - Fast, modern JavaScript runtime  
✅ **Security hardened** - Non-root user, minimal capabilities  
✅ **Health monitoring** - Auto-restart on failure  
✅ **Persistent storage** - Data and videos preserved  

### Volumes

- `./storage` - Unified storage directory containing all application data
  - `storage/data/` - Application data and JSON files
  - `storage/uploads/` - Video upload staging area

### Commands

```bash
# Start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Update
docker-compose pull && docker-compose up -d
```

### Environment

Create `.env` file before starting the app:

```bash
cp .env.example .env
```

Required for the full vault feature set:

- `AUTH_SHARED_PASSWORD`: shared password for unlocking the site
- `VIDEO_JWT_SECRET`: signing secret for protected playback token issuance
- `VIDEO_MASTER_ENCRYPTION_SEED`: master seed for deriving per-video encryption keys

Optional:

- `KEY_SALT_PREFIX`: salt prefix used during playback key derivation
- `VIDEO_METADATA_SQLITE_PATH`: override path for canonical video metadata SQLite storage
- `AUTH_SQLITE_PATH`: path for the Bun SQLite auth/session database
- `AUTH_CLIENT_COOKIE_NAME`: override the client identity cookie name
- `AUTH_SESSION_COOKIE_NAME`: override the auth session cookie name
- `AUTH_SESSION_TTL_MS`: session lifetime in milliseconds
- `AUTH_OWNER_ID`: optional config-owned site owner id override (`site-owner` by default)
- `AUTH_OWNER_EMAIL`: optional config-owned site owner email override (`owner@local` by default)
- `AUTH_TRUST_PROXY_HEADERS`: trust forwarded client IP headers for rate limiting
- `AUTH_FAILED_LOGIN_BLOCK_DURATION_MS`: failed-login block duration
- `AUTH_FAILED_LOGIN_DELAY_MS`: invalid-login response delay
- `AUTH_FAILED_LOGIN_WINDOW_MS`: failed-login tracking window
- `AUTH_MAX_FAILED_LOGIN_ATTEMPTS`: failed-login threshold before blocking
- `FFMPEG_PATH`: override the FFmpeg binary path
- `FFPROBE_PATH`: override the ffprobe binary path
- `SHAKA_PACKAGER_PATH`: override the Shaka Packager binary path

Notes:

- Use `/login` for the site auth flow.
- Auth-only startup and home-library access can work with `AUTH_SHARED_PASSWORD` alone.
- The site owner identity is config-owned through `AUTH_OWNER_ID` and `AUTH_OWNER_EMAIL`.
- The protected playback path issues `/videos/:videoId/token`, resolves `/videos/:videoId/manifest.mpd`, and serves `/videos/:videoId/clearkey` for the browser license flow.

## Architecture And Refactor Context

For the current architecture and repo state, start here:

- `docs/roadmap/current-refactor-status.md`
- `docs/roadmap/personal-video-vault-rearchitecture-phases.md`
- `docs/architecture/personal-video-vault-target-architecture.md`

## Technology Stack

- **Frontend**: React Router v7 with SSR
- **Runtime**: Bun (pure Bun, no Node.js)
- **Styling**: TailwindCSS v4
- **Metadata/Auth Persistence**: SQLite for auth sessions and canonical video metadata, plus active-owned JSON persistence for playlists
- **Video**: FFmpeg for thumbnails and streaming
- **Streaming**: DASH with JWT token issuance, ClearKey license delivery, and encrypted media packaging

## Testing

The test suite is split by scope:

- `bun run test:modules`: colocated module and policy tests
- `bun run test:integration`: route and auth integration tests
- `bun run test:ui-dom`: jsdom + React Testing Library component tests
- `bun run vitest:ui`: interactive Vitest UI for local debugging only
- `bun run test:run`: all Vitest projects
- `bun run test:smoke:dev-auth`: dev-server auth smoke against `bun run dev`
- `bun run test:smoke:bun-auth`: Bun runtime smoke against the built server
- `bun run verify:base`: hermetic lint + typecheck + Vitest + Bun smoke + build
- `bun run verify:e2e-smoke`: required browser smoke command

Why the smoke layers exist:

- Vitest runs in Node for this repo
- `bun run dev` and `bun run start` do not execute route code the same way
- runtime-only regressions, such as unsupported module schemes, must be caught separately

Smoke split:

- `test:smoke:dev-auth`: shared-password login must work under the dev server
- `test:smoke:bun-auth`: built Bun server must still protect token and thumbnail routes correctly

Browser verification remains a separate step for UI and playback flows. See [docs/E2E_TESTING_GUIDE.md](docs/E2E_TESTING_GUIDE.md).

If Playwright playback fixtures need to be rebuilt for the browser-safe H.264 policy, refresh them with:

```bash
bun run backfill:browser-playback-fixtures
```

The script rebuilds only the known Playwright fixture video IDs and leaves already-compatible manifests untouched.

---

Built with ❤️ using React Router and Bun.
