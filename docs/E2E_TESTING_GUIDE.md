# End-to-End Testing Guide

This guide defines the current test layers for Local Streamer.

`bun run test` is the default full-suite command. It runs:

- the Vitest suite
- the dev auth smoke
- the built Bun auth smoke

The default `bun run test*` verification commands are env-scrubbed by design. Bun `.env` autoloading is disabled and Vite env-file loading is disabled for the test-facing entrypoints. Unit, integration, and Bun smoke tests must not depend on an ambient local `.env`; any required env must be seeded explicitly inside the test or the test-local helper.

## Prerequisites

1. **Configure auth**
   ```bash
   cp .env.example .env
   ```

2. **Start Development Server**
   ```bash
   bun run dev
   ```
   The application will be available at `http://localhost:5173`

## CI-Like Verification

For auth, playback, route wiring, or other runtime-sensitive changes, prefer a Docker verification pass that matches GitHub Actions more closely than the host shell:

```bash
docker run --rm --user "$(id -u):$(id -g)" -e CI=true -e GITHUB_ACTIONS=true -v "$PWD":/workspace -w /workspace oven/bun:1.3.10 bash -lc 'bun install && bun run test'
```

Use `--user "$(id -u):$(id -g)"` so the container does not leave root-owned files behind in the bind-mounted repository. If you forget this, local `bun run dev`, `bun run typecheck`, or `bun run build` may fail until ownership is fixed for `.react-router/`, `build/`, or `node_modules/.vite/`.

When debugging CI-only failures:

- reproduce the exact failing command inside Docker before changing production code
- assume host-only passing results are insufficient for runtime-sensitive work
- treat host-specific absolute paths and leaked local env vars as test bugs
- treat leaked ambient `.env` values as test bugs in unit, integration, and Bun smoke layers
- prefer tests that seed their own temp storage and configuration explicitly

## Test Layers

### 1. Module Tests

```bash
bun run test:modules
```

Use for:

- policies
- use cases
- small infrastructure tests that do not require the full app surface

### 2. Integration Tests

```bash
bun run test:integration
```

Use for:

- route adapters
- auth/session flows
- cookie behavior
- media access denial / response headers
- temporary compatibility bridges

### 3. Legacy Regression Tests

```bash
bun run test:legacy
```

Use for legacy modules and repositories that still protect current behavior during migration.

### 4. Bun Runtime Smoke

```bash
bun run test:smoke:bun-auth
```

Use for:

- built server startup under Bun
- shared-password login
- protected page redirect
- playback token access
- protected thumbnail access

This layer exists because Vitest runs in Node while production runs in Bun.

### 5. Dev Runtime Smoke

```bash
bun run test:smoke:dev-auth
```

Use for:

- shared-password login under `bun run dev`
- catching dev-only loader/runtime regressions such as unsupported `bun:` imports
- validating that the local development server can complete the basic auth happy path

### 6. Browser Verification

Use Playwright when API checks are not enough.

Required for:

- login UI
- logout UI
- player surface
- DRM / token / thumbnail flows that need browser cookies and real navigation

## Testing Tools

### Primary Tool: cURL or fetch

- Use HTTP-level checks for API and auth verification first
- Prefer this layer for deterministic checks

### Secondary Tool: Playwright

- Use Playwright for user-visible flows and browser state
- Prefer locator-based assertions and web-first waits

## Test Credentials

The app no longer uses the legacy setup/login flow for Phase 1 validation.

Use:

- **Shared Password:** value from `AUTH_SHARED_PASSWORD`

## Test Assets

### Video Files

- Seeded library videos under `storage/data/videos/`
- Upload fixtures under `storage/data/test-videos/`

Before running Playwright playback checks against the built server, refresh the known playback fixtures so the test environment does not rely on stale HEVC-only packages:

```bash
bun run backfill:browser-playback-fixtures
```

## Important Notes

- **Security:** All video content is encrypted with AES-128
- **Authentication:** Page access, token issuance, and thumbnail access must all be protected by the shared-password session
- **Runtime split:** Node/Vitest passing does not prove Bun runtime correctness
- **Browser checks:** Use Playwright for playback and UI flows after the lower layers pass
- **Playback triage:** When `/player/:id` fails in-browser, inspect the browser console and confirm the request mix includes manifest, video, and audio segment requests. Missing video requests usually indicates a codec/package compatibility issue, while missing manifest or token requests points to auth/session wiring.
