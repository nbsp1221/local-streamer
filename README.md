# Local Streamer

Personal media server application for streaming local video files through a web interface. Built with React Router v7 and pure Bun runtime.

## Features

- 🎬 Stream local video files through web browser
- 🔐 Shared-password auth gate with httpOnly site sessions
- 📁 File management with preparation and library folders
- 🔒 DASH streaming with AES-128 encryption
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

`AUTH_SHARED_PASSWORD` is required in both development and production.

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

Required:

- `AUTH_SHARED_PASSWORD`: shared password for unlocking the site

Optional:

- `AUTH_SQLITE_PATH`: path for the Bun SQLite auth/session database
- `AUTH_SESSION_TTL_MS`: session lifetime in milliseconds

Notes:

- Phase 1 no longer uses the legacy setup/account-creation flow. `/setup` now redirects to `/login`.
- Legacy playlist compatibility still exists temporarily. The shared-password session is mapped to an existing legacy admin when available, falls back to the first legacy user if needed, and creates a `vault@local` compatibility admin on clean installs.

## Technology Stack

- **Frontend**: React Router v7 with SSR
- **Runtime**: Bun (pure Bun, no Node.js)
- **Styling**: TailwindCSS v4
- **Metadata/Auth Persistence**: Bun SQLite for auth sessions, JSON legacy storage during migration
- **Video**: FFmpeg for thumbnails and streaming
- **Streaming**: DASH with AES-128 encryption

## Testing

The test suite is split by scope:

- `bun run test:modules`: colocated module and policy tests
- `bun run test:integration`: route and auth integration tests
- `bun run test:ui-dom`: jsdom + React Testing Library component tests
- `bun run test:legacy`: legacy module and repository coverage that still protects current behavior
- `bun run test:run`: all Vitest projects
- `bun run test:smoke:dev-auth`: dev-server auth smoke against `bun run dev`
- `bun run test:smoke:bun-auth`: Bun runtime smoke against the built server

Why the smoke layers exist:

- Vitest runs in Node for this repo
- `bun run dev` and `bun run start` do not execute route code the same way
- runtime-only regressions, such as unsupported module schemes, must be caught separately

Smoke split:

- `test:smoke:dev-auth`: shared-password login must work under the dev server
- `test:smoke:bun-auth`: built Bun server must still protect token and thumbnail routes correctly

Browser verification remains a separate step for UI and playback flows. See [docs/E2E_TESTING_GUIDE.md](docs/E2E_TESTING_GUIDE.md).

---

Built with ❤️ using React Router and Bun.
