# Local Streamer

Personal media server application for streaming local video files through a web interface. Built with React Router v7 and pure Bun runtime.

## Features

- 🎬 Stream local video files through web browser
- 🔐 User authentication and session management
- 📁 File management with preparation and library folders
- 🔒 XOR encryption for video file protection
- 🎨 YouTube-inspired UI for video browsing
- ⚡ Pure Bun runtime for maximum performance

## Getting Started

### Development

```bash
# Install dependencies
bun install

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

- `./data` - Application data and JSON files
- `./incoming` - Video upload staging area

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

Create `.env` file for customization (optional):

```bash
cp .env.example .env
```

## Technology Stack

- **Frontend**: React Router v7 with SSR
- **Runtime**: Bun (pure Bun, no Node.js)
- **Styling**: TailwindCSS v4
- **Database**: JSON files with async write queue
- **Video**: FFmpeg for thumbnails and streaming
- **Encryption**: XOR encryption for file protection

---

Built with ❤️ using React Router and Bun.