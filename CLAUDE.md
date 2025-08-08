# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Local Streamer is a personal media server application built with React Router v7. It allows users to stream their local video files through a web interface without complex setup. The project consists of a web frontend (React Router SSR app) and a backend PC agent that manages video files and streaming.

## Development Commands

- `bun run dev` - Start development server with HMR at http://localhost:5173
- `bun run build` - Create production build
- `bun run start` - Start production server with built files
- `bun run typecheck` - Run TypeScript type checking with React Router type generation

## Technology Stack

- **Frontend Framework**: React Router v7 with SSR enabled
- **Styling**: TailwindCSS v4 with Vite plugin
- **Language**: TypeScript with strict mode
- **Build Tool**: Vite
- **Package Manager**: Bun
- **Runtime**: Node.js (deployable with Docker)

## Architecture

### File Structure
- `app/` - React Router application code
  - `root.tsx` - Root layout with global styles and error boundary
  - `routes.ts` - Route configuration (currently just index route)
  - `routes/` - Route components
  - `welcome/` - Welcome page components and assets
- `build/` - Production build output (client and server)
- `public/` - Static assets

### Key Configuration Files
- `react-router.config.ts` - React Router configuration (SSR enabled)
- `vite.config.ts` - Vite configuration with React Router, TailwindCSS, and TypeScript paths
- `tsconfig.json` - TypeScript configuration with path mapping (`~/*` → `./app/*`)

### Product Requirements
The PRD.md outlines a comprehensive video streaming platform with:
- File management system with preparation folder and library folder
- UUID-based file identification and XOR encryption for protection
- YouTube-inspired UI/UX for library browsing and video playback
- Docker deployment with backend service for file management

## Development Notes

- Project uses React Router v7's file-based routing system
- TypeScript paths are configured with `~/*` alias pointing to `app/`
- TailwindCSS is integrated via Vite plugin
- The app includes proper error boundaries and meta/link functions
- Font loading uses Google Fonts (Inter)

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

The project is designed for Docker deployment as specified in the README. The build process creates both client-side assets and server-side code for production deployment.