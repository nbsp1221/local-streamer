# End-to-End Testing Guide

This guide defines the current test layers for Local Streamer.

`bun run test` is the default full-suite command. It runs:

- the Vitest suite
- the dev auth smoke
- the built Bun auth smoke

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

## Important Notes

- **Security:** All video content is encrypted with AES-128
- **Authentication:** Page access, token issuance, and thumbnail access must all be protected by the shared-password session
- **Runtime split:** Node/Vitest passing does not prove Bun runtime correctness
- **Browser checks:** Use Playwright for playback and UI flows after the lower layers pass
