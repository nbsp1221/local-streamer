# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Claude Interaction Guidelines

**Language Policy:** All decision-making, reasoning, and internal communication must be conducted in English. This includes:
- All thinking and reasoning processes
- Internal analysis and planning
- Technical discussions and problem-solving
- Code comments and documentation

**Output Policy:** Only the final response to the user should be provided in Korean (한국어). This ensures consistent technical communication while maintaining user-friendly Korean output.

## Project Overview

Local Streamer is a personal media server application built with React Router v7. It allows users to stream their local video files through a web interface without complex setup. The project consists of a web frontend (React Router SSR app) and a backend PC agent that manages video files and streaming.

## Development Commands

- `bun run dev` - Start development server with HMR at http://localhost:5173
- `bun run build` - Create production build
- `bun run start` - Start production server with built files
- `bun run typecheck` - Run TypeScript type checking with React Router type generation
- `bun run lint` - Run ESLint to check code quality and style
- `bun run lint:fix` - Run ESLint with auto-fix for correctable issues
- `bun run test` - Run test suite with Vitest

## Technology Stack

- **Frontend Framework**: React Router v7 with SSR enabled
- **Styling**: TailwindCSS v4 with Vite plugin
- **Language**: TypeScript with strict mode
- **Build Tool**: Vite
- **Package Manager**: Bun
- **Runtime**: Bun (pure Bun runtime, deployable with Docker)

## Architecture

### File Structure
- `app/` - React Router application code
  - `root.tsx` - Root layout with global styles and error boundary
  - `routes.ts` - Route configuration (comprehensive routing with API, auth, HLS endpoints)
  - `routes/` - Route components and API handlers
  - `welcome/` - Welcome page components (unused, home.tsx serves as index)
- `build/` - Production build output (client and server)
- `public/` - Static assets

### Key Configuration Files
- `react-router.config.ts` - React Router configuration (SSR enabled)
- `vite.config.ts` - Vite configuration with React Router, TailwindCSS, and TypeScript paths
- `tsconfig.json` - TypeScript configuration with path mapping (`~/*` → `./app/*`)

### Product Requirements
The PRD.md outlines a comprehensive video streaming platform with:
- File management system with incoming/ folder and data/videos/ library
- UUID-based file identification with HLS streaming and AES-128 encryption
- JWT token-based authentication for secure video access
- YouTube-inspired UI/UX for library browsing and video playback
- @vidstack/react player with HLS support
- Docker deployment with Bun runtime for optimal performance

## Development Notes

- Project uses React Router v7's file-based routing system
- TypeScript paths are configured with `~/*` alias pointing to `app/`
- TailwindCSS is integrated via Vite plugin
- The app includes proper error boundaries and meta/link functions
- Font loading uses Google Fonts (Inter)
- **HLS Implementation**: All local videos use HLS streaming with AES-128 encryption
- **Authentication**: JWT-based session management with Argon2 password hashing
- **File Processing**: FFmpeg for video conversion and thumbnail generation
- **Data Storage**: JSON-based repositories with async write queue for concurrency safety

### Language Policy
- **Web UI and source code**: English only (user-facing text, component names, variable names, comments)
- **Documentation files**: Korean is acceptable (PRD.md, implementation plans, etc.)

## Git Commit Convention

This project uses **Gitmoji** for commit messages. All commits must follow the gitmoji convention with English language only.

### Gitmoji Format
```
<emoji> <description>
```

### Commonly Used Gitmojis
- 🎨 `:art:` - Improve structure/format of the code
- ⚡️ `:zap:` - Improve performance
- 🔥 `:fire:` - Remove code or files
- 🐛 `:bug:` - Fix a bug
- 🚑️ `:ambulance:` - Critical hotfix
- ✨ `:sparkles:` - Introduce new features
- 📝 `:memo:` - Add or update documentation
- 🚀 `:rocket:` - Deploy stuff
- 💄 `:lipstick:` - Add or update UI and style files
- 🎉 `:tada:` - Begin a project
- ✅ `:white_check_mark:` - Add, update, or pass tests
- 🔒️ `:lock:` - Fix security or privacy issues
- 🔖 `:bookmark:` - Release/Version tags
- 🚨 `:rotating_light:` - Fix compiler/linter warnings
- 🚧 `:construction:` - Work in progress
- 💚 `:green_heart:` - Fix CI build
- ⬆️ `:arrow_up:` - Upgrade dependencies
- ⬇️ `:arrow_down:` - Downgrade dependencies
- 📌 `:pushpin:` - Pin dependencies to specific versions
- ➕ `:heavy_plus_sign:` - Add a dependency
- ➖ `:heavy_minus_sign:` - Remove a dependency
- 🔧 `:wrench:` - Add or update configuration files
- 🔨 `:hammer:` - Add or update development scripts
- ♻️ `:recycle:` - Refactor code
- 🏷️ `:label:` - Add or update types
- 🗑️ `:wastebasket:` - Deprecate code that needs cleanup
- ⚰️ `:coffin:` - Remove dead code

### Rules
- Use English only for all commit messages
- One emoji per commit (if multiple intentions, split into separate commits)
- Keep descriptions concise and descriptive
- Use unicode format (🎨) or shortcode format (:art:)

For complete gitmoji reference: https://gitmoji.dev/

## Deployment

The project is designed for Docker deployment with Bun runtime. The build process creates both client-side assets and server-side code for production deployment. Key deployment features:

- **Container**: Docker with Bun runtime for optimal performance
- **Security**: Non-root user with minimal capabilities 
- **Health monitoring**: Auto-restart on failure
- **Persistent storage**: data/ and incoming/ volumes preserved
- **Port**: Default 3000 (configurable via PORT environment variable)