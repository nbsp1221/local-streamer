# Runtime Documentation Alignment Implementation Plan

Status: Completed implementation record
Last reviewed: 2026-05-01

> This document records the plan used for the runtime documentation alignment pass.
> Do not treat it as a fresh execution directive. Use
> `docs/current-runtime-documentation-spec.md`,
> `docs/roadmap/current-refactor-status.md`, and
> `docs/verification-contract.md` for current project guidance.

**Goal:** Align environment examples, deployment configuration, and current-facing documentation with the runtime contract frozen in `docs/current-runtime-documentation-spec.md`.

**Architecture:** This is a documentation and configuration alignment pass, not a feature build. Keep current runtime behavior intact, except for deployment files that currently express stale assumptions such as GPU-required Docker startup, retired storage directories, and missing Shaka Packager provisioning. Prefer precise status banners over rewriting historical plans.

**Tech Stack:** Bun 1.3.5, React Router v7, TypeScript, SQLite/libsql, FFmpeg/ffprobe, Shaka Packager, Docker Compose, Markdown documentation.

---

## 1. Pre-Implementation Audit Snapshot

The codebase was re-surveyed on 2026-04-30 before writing and executing this plan.

Primary source of truth:

- `docs/current-runtime-documentation-spec.md`

Current implementation facts:

- Storage paths are resolved by `app/modules/storage/infrastructure/config/storage-config.server.ts`.
- `STORAGE_DIR` defaults to `storage/`.
- `DATABASE_SQLITE_PATH` defaults to `storage/db.sqlite`.
- committed media lives under `storage/videos`.
- staged uploads live under `storage/staging`.
- playback token config uses `VIDEO_JWT_SECRET` and a default 15 minute expiry in `app/shared/config/playback.server.ts`.
- `VIDEO_MASTER_ENCRYPTION_SEED` is presence-checked, not format-checked, in playback and thumbnail key derivation code.
- media tool lookup uses `app/shared/config/video-tools.server.ts`, preferring explicit env paths, then project-local `binaries/*`, then system commands where available.

High-signal mismatches found before the alignment work:

- `.env.example:8-15` still documents `AUTH_SQLITE_PATH` and a required 64-character hex encryption seed.
- `README.md:63-68` documents only `./storage` as the Docker volume model and omits `STORAGE_DIR` from the optional env list.
- `Dockerfile:18-19` still sets NVIDIA/NVENC capabilities.
- `Dockerfile:37-38` downloads FFmpeg only, while production ingest also needs Shaka Packager.
- `Dockerfile:60-62` creates retired `data` and `incoming` directories instead of `storage`, `storage/videos`, and `storage/staging`.
- `docker-compose.yaml:16-18` sets `STORAGE_DIR=./storage` inside the container and hard-codes a bind mount.
- `docker-compose.yaml:27-33` reserves an NVIDIA GPU despite current CPU-first media preparation.
- `CLAUDE.md:565-576` shows `JWT_SECRET`, a 1 hour playback token, and `data/videos` in a copyable security example.
- `docs/roadmap/current-refactor-status.md:4` is stale and `docs/roadmap/current-refactor-status.md:34` still says staged upload exposes encoding option selection.
- `docs/architecture/personal-video-vault-target-architecture.md:130-154` omits `app/modules/thumbnail`.
- `docs/architecture/personal-video-vault-target-architecture.md:157-208` has no thumbnail module ownership entry.
- `docs/verification-contract.md:3-28` defines the base bundle as four individual commands instead of `bun run verify:base`, omitting the hermetic input guard from the headline contract.
- `docs/verification-contract.md:14-20` does not require `bun run verify:data-integrity` for storage-sensitive DB/media changes.
- `docs/playlist-add-to-playlist-notes.md:28-31` says changing playlist persistence away from JSON is a non-goal, even though playlist persistence is now primary SQLite.
- several dated plan documents still read as current drafts or ready-to-run plans after their implementation or supersession.

Out of scope:

- Do not add new owner-facing product features.
- Do not redesign runtime architecture.
- Do not reintroduce legacy compatibility layers.
- Do not implement GPU/NVENC support.
- Do not enforce `VIDEO_MASTER_ENCRYPTION_SEED` format or randomness at runtime.
- Do not rewrite every historical document body. Add clear status banners first.

## 2. Task List

### Task 1: Align `.env.example`

**Files:**

- Modify: `.env.example:1-21`

**Step 1: Replace retired auth DB config**

Remove:

```env
# Optional auth session persistence path
AUTH_SQLITE_PATH=./storage/data/auth.sqlite
```

Add:

```env
# Optional unified storage root
STORAGE_DIR=./storage

# Optional primary SQLite database path
DATABASE_SQLITE_PATH=./storage/db.sqlite
```

**Step 2: Fix required secret examples**

Change required secrets so copied public placeholders are not mistaken for secure production values.

Use blank values for required deployment secrets:

```env
AUTH_SHARED_PASSWORD=
VIDEO_MASTER_ENCRYPTION_SEED=
VIDEO_JWT_SECRET=
```

Keep comments that explain intent:

```env
# Required shared password for unlocking the site.
# Generate and store a deployment-specific value before starting the app.

# Required free-form secret used to derive per-video encryption keys.
# Use a cryptographically strong random value. This does not need to be hex.

# Required signing secret for protected playback tokens.
# Use a cryptographically strong random value.
```

Keep:

```env
AUTH_OWNER_ID=site-owner
AUTH_OWNER_EMAIL=owner@local
AUTH_SESSION_TTL_MS=604800000
KEY_SALT_PREFIX=local-streamer-video-v1
```

**Step 3: Add Docker mount source example**

Add a Compose-only variable near the storage section:

```env
# Docker Compose storage mount source.
# Leave as a named volume for managed Docker storage, or set to ./storage for a host bind mount.
LOCAL_STREAMER_STORAGE_MOUNT=local-streamer-storage
```

**Step 4: Verify text**

Run:

```bash
rg -n "AUTH_SQLITE_PATH|64-character|64 char|hex string|storage/data/auth.sqlite" .env.example
```

Expected: no output.

Run:

```bash
rg -n "STORAGE_DIR|DATABASE_SQLITE_PATH|LOCAL_STREAMER_STORAGE_MOUNT|VIDEO_MASTER_ENCRYPTION_SEED|VIDEO_JWT_SECRET" .env.example
```

Expected: all current env names are present.

### Task 2: Align Docker production config

**Files:**

- Modify: `.dockerignore`
- Modify: `Dockerfile:5-19`
- Modify: `Dockerfile:37-62`
- Modify: `Dockerfile:70-72`
- Modify: `docker-compose.yaml:13-33`
- Modify: `docker-compose.yaml:43-45`

**Step 1: Remove default GPU/NVENC assumptions**

Remove from `Dockerfile`:

```dockerfile
# Set NVIDIA driver capabilities environment variable for NVENC access
ENV NVIDIA_DRIVER_CAPABILITIES=all
```

Remove from `docker-compose.yaml`:

```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: 1
          capabilities: [gpu, video]
```

**Step 2: Provision all required media tools**

Change the Docker build step from:

```dockerfile
# Download FFmpeg binaries during build
RUN bash scripts/download-ffmpeg.sh
```

To:

```dockerfile
# Download media tool binaries during build
RUN bash scripts/download-ffmpeg.sh && bash scripts/download-shaka-packager.sh
```

Keep copying `/app/binaries` into the production image, but update the comment to mention media tools, not FFmpeg only.

**Step 3: Create current storage directories**

Replace:

```dockerfile
RUN mkdir -p data incoming incoming/thumbnails && \
    chown -R bun:bun data incoming
```

With:

```dockerfile
RUN mkdir -p storage/videos storage/staging && \
    chown -R bun:bun storage
```

Add:

```dockerfile
ENV STORAGE_DIR=/app/storage
```

near the existing production `ENV NODE_ENV=production` and `ENV PORT=3000` values.

**Step 4: Exclude generated media tool binaries from the Docker context**

Add to `.dockerignore`:

```text
# Generated media tool binaries (download inside Docker builds)
binaries/
.ffmpeg-download-temp/
.shaka-download-temp/
```

This keeps the production image from depending on ignored local binaries or temporary
download state.

**Step 5: Make Docker storage backing selectable**

Change compose env from:

```yaml
environment:
  - NODE_ENV=production
  - PORT=3000
  - STORAGE_DIR=./storage
volumes:
  - ./storage:/app/storage
```

To mapping style:

```yaml
environment:
  NODE_ENV: production
  PORT: "3000"
  STORAGE_DIR: /app/storage
volumes:
  - ${LOCAL_STREAMER_STORAGE_MOUNT:-local-streamer-storage}:/app/storage
```

Add a top-level named volume:

```yaml
volumes:
  local-streamer-storage:
```

Keep the existing bridge network.

**Step 6: Verify compose shape**

Run:

```bash
docker compose config --quiet --no-env-resolution
docker compose config --no-env-resolution
```

Expected:

- command exits 0
- service environment includes `STORAGE_DIR: /app/storage`
- no NVIDIA/GPU device reservation appears
- top-level `local-streamer-storage` volume appears

If Docker Compose is unavailable in the environment, record that explicitly in the handoff and still run the text checks below. Avoid printing resolved local `.env` secrets in logs.

Run:

```bash
rg -n "NVIDIA|NVENC|capabilities: \\[gpu|incoming|mkdir -p data|STORAGE_DIR=\\.\\/storage" Dockerfile docker-compose.yaml
```

Expected: no output.

Run:

```bash
rg -n "download-shaka-packager|storage/videos|storage/staging|LOCAL_STREAMER_STORAGE_MOUNT|/app/storage|binaries/" .dockerignore Dockerfile docker-compose.yaml
```

Expected: all current deployment concepts are present.

### Task 3: Align README deployment and env docs

**Files:**

- Modify: `README.md:41-123`

**Step 1: Clarify required secrets**

Keep the existing required env list, but add short generation guidance after it.

Use wording like:

```markdown
Generate deployment-specific secret values before starting the full vault path. The
encryption seed and playback JWT secret are free-form strings, but they should be
cryptographically random. They do not need to be hex-encoded.
```

Add generation examples:

```bash
openssl rand -base64 32
bun -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

**Step 2: Add `STORAGE_DIR` to optional env docs**

Add to the optional list:

```markdown
- `STORAGE_DIR`: override the unified storage root for `db.sqlite`, committed media, and staged uploads
```

Keep `DATABASE_SQLITE_PATH`, but clarify that it overrides only the primary DB path and does not move media artifacts.

**Step 3: Rewrite Docker volumes section**

Replace the current `./storage`-only volume description with:

```markdown
The app writes to `/app/storage` inside the container.

By default, Docker Compose can back that path with the named volume
`local-streamer-storage`. If you want the files to appear in the repository checkout,
set `LOCAL_STREAMER_STORAGE_MOUNT=./storage` in `.env` before running Compose.
```

Then describe both options:

- named volume: Docker-managed, fewer host permission issues
- bind mount: host-visible files, but host ownership and write permissions matter

List the storage layout:

```text
storage/db.sqlite
storage/videos/
storage/staging/
```

**Step 4: Mention media tool requirements**

In Docker deployment notes, state that the production image provisions FFmpeg, ffprobe, and Shaka Packager. For non-Docker production, keep the existing `FFMPEG_PATH`, `FFPROBE_PATH`, and `SHAKA_PACKAGER_PATH` env docs.

**Step 5: Verify README**

Run:

```bash
rg -n "AUTH_SQLITE_PATH|64-character|hex string|GPU|NVENC|storage/data|data/videos|playlists\\.json|playlist-items\\.json" README.md
```

Expected: no output except unrelated historical text if explicitly marked historical. For this file, expected is no output.

Run:

```bash
rg -n "STORAGE_DIR|DATABASE_SQLITE_PATH|LOCAL_STREAMER_STORAGE_MOUNT|/app/storage|Shaka Packager|cryptographically random" README.md
```

Expected: current deployment concepts are present.

### Task 4: Align agent guidance examples

**Files:**

- Modify: `CLAUDE.md:565-576`
- Modify: `AGENTS.md:16-20`

**Step 1: Fix playback token example**

In `CLAUDE.md`, replace the copyable anti-pattern example so it does not use retired env names.

Change:

```typescript
process.env.JWT_SECRET,
{ expiresIn: '1h' }
```

To either:

```typescript
playbackConfig.jwtSecret,
{ expiresIn: playbackConfig.jwtExpiry }
```

or, if the example must remain short:

```typescript
process.env.VIDEO_JWT_SECRET,
{ expiresIn: '15m' }
```

Prefer the config-object example because the runtime contract already lives in `app/shared/config/playback.server.ts`.

Change:

```typescript
path.join('data/videos', params.videoId, 'manifest.mpd')
```

To:

```typescript
path.join(getStoragePaths().videosDir, params.videoId, 'manifest.mpd')
```

If adding imports inside the example would make the snippet noisy, add a one-line note that examples should resolve media through storage path helpers, not hard-coded filesystem paths.

**Step 2: Align base verification guidance in `AGENTS.md`**

Replace the sentence that says the required verification bundle is the individual command list with a sentence that names `bun run verify:base` as the required base authority.

Keep the individual commands as explanatory subcommands if useful, but do not present them as a substitute for `verify:base` because `verify:base` includes `verify:hermetic-inputs`.

**Step 3: Verify agent docs**

Run:

```bash
rg -n "JWT_SECRET\\b|data/videos|AUTH_SQLITE_PATH|storage/data/auth.sqlite" CLAUDE.md AGENTS.md
```

Expected: no current-facing copyable references. Any remaining match must be explicitly marked as historical or an anti-pattern that cannot be copied into real code.

Run:

```bash
rg -n "verify:base|verify:hermetic-inputs|VIDEO_JWT_SECRET|getStoragePaths" CLAUDE.md AGENTS.md
```

Expected: current examples and verification contract are present.

### Task 5: Refresh current roadmap

**Files:**

- Modify: `docs/roadmap/current-refactor-status.md:3-36`
- Modify: `docs/roadmap/current-refactor-status.md:63-82`
- Modify: `docs/roadmap/current-refactor-status.md:95-102`

**Step 1: Update review date**

Change:

```markdown
Last updated: 2026-04-19
```

To:

```markdown
Last updated: 2026-04-30
```

**Step 2: Replace stale upload wording**

Change:

```markdown
- encoding option selection during staged upload review
```

To:

```markdown
- codec-aware automatic media preparation during staged upload commit
```

Do not reintroduce H.264/H.265/CPU/GPU owner-facing option selection.

**Step 3: Expand runtime contract section**

Under `Active-owned SQLite persistence`, mention that primary SQLite covers:

- auth sessions
- library metadata
- taxonomy and tags
- ingest upload/media asset records
- playlists

Add the active storage layout:

```text
storage/db.sqlite
storage/videos/
storage/staging/
```

**Step 4: Add documentation alignment as next work**

Under `Recommended Next Work`, add one item for finishing current documentation and deployment example alignment against `docs/current-runtime-documentation-spec.md`.

Keep playlist polish as product work, but do not make it part of this alignment pass.

**Step 5: Verify roadmap**

Run:

```bash
rg -n "encoding option selection|Last updated: 2026-04-19|storage/data|AUTH_SQLITE_PATH|VIDEO_METADATA_SQLITE_PATH" docs/roadmap/current-refactor-status.md
```

Expected: no output.

Run:

```bash
rg -n "codec-aware|storage/db.sqlite|storage/videos|storage/staging|auth sessions|media asset records" docs/roadmap/current-refactor-status.md
```

Expected: current contract details are present.

### Task 6: Update target architecture with thumbnail ownership

**Files:**

- Modify: `docs/architecture/personal-video-vault-target-architecture.md:130-154`
- Modify: `docs/architecture/personal-video-vault-target-architecture.md:157-208`

**Step 1: Add thumbnail to target module tree**

Add:

```text
    thumbnail/
      domain/
      application/
      infrastructure/
```

under `modules/`.

**Step 2: Add a supporting technical module section**

Add a section after `storage` or after the bounded-context list:

```markdown
### `thumbnail`

- active technical module for protected thumbnail encryption, decryption, and finalization
- supports ingest and playback flows
- does not own user-facing library behavior
- does not own playback authorization policy
- does not own storage persistence policy
```

If the document keeps the heading `Bounded Contexts`, either describe `thumbnail` as a supporting technical module inside the text or add a separate `Supporting Technical Modules` heading so readers do not confuse it with a user-facing domain context.

**Step 3: Verify architecture doc**

Run:

```bash
rg -n "thumbnail|protected thumbnail|technical module" docs/architecture/personal-video-vault-target-architecture.md
```

Expected: thumbnail ownership is visible in the target architecture.

### Task 7: Fix playlist follow-up note

**Files:**

- Modify: `docs/playlist-add-to-playlist-notes.md:28-31`

**Step 1: Replace stale JSON non-goal**

Change:

```markdown
- changing playlist persistence away from JSON
```

To:

```markdown
- changing the current primary-SQLite playlist persistence model
```

or:

```markdown
- reopening playlist persistence decisions; playlist persistence is already primary SQLite
```

**Step 2: Verify playlist note**

Run:

```bash
rg -n "JSON|playlists\\.json|playlist-items\\.json" docs/playlist-add-to-playlist-notes.md
```

Expected: no stale JSON persistence claim.

### Task 8: Align verification contract

**Files:**

- Modify: `docs/verification-contract.md:3-28`
- Modify: `docs/verification-contract.md:49-70`
- Modify: `docs/verification-contract.md:72-84`

**Step 1: Make `verify:base` the base authority**

Change the opening section to say:

```markdown
The base verification authority is:

- `bun run verify:base`
```

Then list the expanded sequence:

```text
bun run verify:hermetic-inputs
bun run lint
bun run typecheck
bun run test
bun run build
```

**Step 2: Update matrix rows**

Change documentation-only and pure module rows from individual commands to:

```markdown
| Documentation-only | `bun run verify:base` |
| Pure module or non-runtime-sensitive server logic | `bun run verify:base` |
```

Add a row:

```markdown
| Storage schema, media asset records, ingest commit visibility, media artifact paths, artifact deletion, or data-integrity reporting | `bun run verify:base` + `bun run verify:data-integrity` |
```

Keep Docker CI-like verification for broader runtime-sensitive auth/playback/route/storage behavior. If a change is both storage-sensitive and Docker-sensitive, run both `verify:data-integrity` and the Docker gate.

**Step 3: Clarify raw Docker command status**

Remove the raw Docker command from the authoritative command bullet list.

Keep it, if still useful, under a short `Diagnostic reference only` paragraph that says it is not equivalent to:

- `bun run verify:ci-faithful:docker`
- `bun run verify:ci-worktree:docker`

because those scripts own the current hermetic and browser-smoke contract.

**Step 4: Update CI contract**

Change:

```markdown
`test` should run the hermetic input guard before `bun run test`.
```

To:

```markdown
CI and local base verification should use `bun run verify:base` so the hermetic input guard cannot be skipped.
```

**Step 5: Verify verification docs**

Run:

```bash
rg -n "Documentation-only \\| `bun run lint|Pure module .*bun run lint|The base verification bundle is:|docker run --rm .*authoritative" docs/verification-contract.md
```

Expected: no stale base-bundle authority language.

Run:

```bash
rg -n "verify:base|verify:hermetic-inputs|verify:data-integrity|Diagnostic reference only|verify:ci-faithful:docker|verify:ci-worktree:docker" docs/verification-contract.md
```

Expected: the current command authority is explicit.

### Task 9: Add status banners to stale plan documents

**Files:**

- Modify: `docs/plans/2026-04-27-ingest-media-preparation-design.md:1-6`
- Modify: `docs/plans/2026-04-27-ingest-media-preparation-implementation-plan.md:1-10`
- Modify: `docs/plans/2026-04-27-ingest-media-preparation-test-scenarios.md:1-7`
- Modify: `docs/plans/2026-04-27-data-storage-management-design.md:1-8`
- Modify: `docs/plans/2026-04-28-data-storage-management-test-scenarios.md:1-6`
- Modify: `docs/plans/2026-04-28-storage-cutover-demo-seed-plan.md:1-8`
- Modify: `docs/plans/2026-04-24-video-metadata-implementation-plan.md:1-10`
- Inspect: `docs/plans/2026-04-24-video-metadata-simplification-review.md:1-12`

**Step 1: Mark implemented ingest docs historical**

For these files:

- `docs/plans/2026-04-27-ingest-media-preparation-design.md`
- `docs/plans/2026-04-27-ingest-media-preparation-implementation-plan.md`
- `docs/plans/2026-04-27-ingest-media-preparation-test-scenarios.md`

Add or replace the status banner with:

```markdown
Status: Historical implementation record
Last reviewed: 2026-04-30

> This document records the implemented codec-aware ingest media preparation work.
> Do not treat it as a fresh execution plan. Use
> `docs/current-runtime-documentation-spec.md` and
> `docs/roadmap/current-refactor-status.md` for the current runtime contract.
```

Keep the body intact unless a top-level sentence directly says the work is still pending.

**Step 2: Mark data storage design pre-cutover**

In `docs/plans/2026-04-27-data-storage-management-design.md`, replace:

```markdown
Status: Ready for implementation planning
```

With:

```markdown
Status: Historical pre-cutover design
Last reviewed: 2026-04-30

> This document predates the accepted primary SQLite cutover.
> Use it as design history only. Current storage runtime contracts live in
> `docs/current-runtime-documentation-spec.md` and
> `docs/roadmap/current-refactor-status.md`.
```

Rename `## 2. Problem` only if necessary. Do not rewrite the historical inventory.

**Step 3: Mark data storage test scenarios superseded where legacy migration is required**

In `docs/plans/2026-04-28-data-storage-management-test-scenarios.md`, replace:

```markdown
Status: Draft after subagent review
```

With:

```markdown
Status: Superseded test scenario draft
Last reviewed: 2026-04-30

> This file contains useful storage-testing principles, but scenarios that require
> legacy import/apply/cleanup flows are superseded by the primary SQLite cutover and
> demo seed direction. Current storage confidence should focus on primary schema,
> demo seed, data integrity, and runtime wiring.
```

Do not delete useful testing principles.

**Step 4: Mark storage cutover demo seed plan accepted/implemented**

At the top of `docs/plans/2026-04-28-storage-cutover-demo-seed-plan.md`, add:

```markdown
Status: Accepted cutover direction / implementation reference
Last reviewed: 2026-04-30

> This is the accepted direction for the primary storage cutover and demo seed work.
> It should not be read as an unstarted proposal.
```

**Step 5: Mark video metadata implementation plan historical**

At the top of `docs/plans/2026-04-24-video-metadata-implementation-plan.md`, add:

```markdown
Status: Historical implementation plan
Last reviewed: 2026-04-30

> This plan predates the primary SQLite storage cutover. Use it as implementation
> history, not as the current code map for persistence or storage paths.
```

**Step 6: Inspect video metadata simplification review before changing status**

Before changing `docs/plans/2026-04-24-video-metadata-simplification-review.md`, inspect whether its accepted follow-up items are complete.

Run:

```bash
rg -n "replaceSearchFilters|HomeAppliedFiltersBar|HomeFilterSurface|derive|filter" app/widgets/home-library app/features app/entities app/shared tests/ui tests/integration
```

If the listed simplification work is clearly complete, add:

```markdown
Status: Historical completed simplification review
Last reviewed: 2026-04-30
```

If it is not clearly complete, keep `Status: Accepted follow-up plan` and add:

```markdown
Last reviewed: 2026-04-30

> Some follow-up items may still be open. Do not use this review as current
> persistence or storage architecture guidance.
```

**Step 7: Verify plan statuses**

Run:

```bash
rg -n "Status: Draft design for review|Status: Draft test scenario specification|Status: Ready for implementation planning|Status: Draft after subagent review" docs/plans/2026-04-27-ingest-media-preparation-design.md docs/plans/2026-04-27-ingest-media-preparation-test-scenarios.md docs/plans/2026-04-27-data-storage-management-design.md docs/plans/2026-04-28-data-storage-management-test-scenarios.md
```

Expected: no output.

Run:

```bash
rg -n "Historical|Superseded|Last reviewed: 2026-04-30|current-runtime-documentation-spec" docs/plans/2026-04-27-ingest-media-preparation-design.md docs/plans/2026-04-27-ingest-media-preparation-implementation-plan.md docs/plans/2026-04-27-ingest-media-preparation-test-scenarios.md docs/plans/2026-04-27-data-storage-management-design.md docs/plans/2026-04-28-data-storage-management-test-scenarios.md docs/plans/2026-04-28-storage-cutover-demo-seed-plan.md docs/plans/2026-04-24-video-metadata-implementation-plan.md docs/plans/2026-04-24-video-metadata-simplification-review.md
```

Expected: each touched file has a clear status.

### Task 10: Optional test infrastructure hygiene follow-up

**Files:**

- Modify: `tests/support/create-playlist-runtime-test-workspace.ts:191-237`

**Why this is separate:**

This is not part of the documentation mismatch cleanup. It is a small test infrastructure fix identified during the audit. Do it only if the implementation pass is allowed to touch test support code.

**Step 1: Preserve previous env values**

Before mutating `process.env`, capture previous values:

```typescript
const previousEnv = {
  AUTH_OWNER_EMAIL: process.env.AUTH_OWNER_EMAIL,
  AUTH_OWNER_ID: process.env.AUTH_OWNER_ID,
  AUTH_SHARED_PASSWORD: process.env.AUTH_SHARED_PASSWORD,
  DATABASE_SQLITE_PATH: process.env.DATABASE_SQLITE_PATH,
  STORAGE_DIR: process.env.STORAGE_DIR,
  VIDEO_JWT_SECRET: process.env.VIDEO_JWT_SECRET,
  VIDEO_MASTER_ENCRYPTION_SEED: process.env.VIDEO_MASTER_ENCRYPTION_SEED,
};
```

**Step 2: Restore instead of deleting blindly**

In `cleanup`, restore each value to its previous state:

```typescript
function restoreEnvValue(key: keyof typeof previousEnv): void {
  const value = previousEnv[key];
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
```

Then call `restoreEnvValue(...)` for each captured key before `workspace.cleanup()`.

**Step 3: Add or update a focused test**

If a test file already covers this helper, update it. Otherwise create:

- Test: `tests/integration/playlist/create-playlist-runtime-test-workspace.test.ts`

Expected behavior:

- setting ambient `VIDEO_JWT_SECRET` and `VIDEO_MASTER_ENCRYPTION_SEED` before helper creation is restored after cleanup
- helper-specific auth/storage env is also restored or deleted according to prior state

**Step 4: Verify focused test**

Run:

```bash
bun run test:integration -- tests/integration/playlist/create-playlist-runtime-test-workspace.test.ts
```

Expected: pass.

## 3. Final Verification

Run these after the alignment work.

**Required for the full pass:**

```bash
bun run verify:base
```

Expected: hermetic input guard, lint, typecheck, tests, and build all pass.

**Required because Dockerfile and Compose changed:**

```bash
docker compose config --quiet --no-env-resolution
docker compose config --no-env-resolution
docker build --target production .
```

Expected:

- Compose config renders with `/app/storage`
- no GPU/NVENC reservation appears in the default service
- production image build downloads both FFmpeg/ffprobe and Shaka Packager
- production image creates current storage directories

If Docker is unavailable, report that explicitly and run all text-level Docker checks from Task 2.

**Recommended post-cleanup stale-reference scan:**

```bash
rg -n "AUTH_SQLITE_PATH|VIDEO_METADATA_SQLITE_PATH|JWT_SECRET\\b|data/videos|storage/data|users\\.json|vault@local|playlists\\.json|playlist-items\\.json|encoding option selection|NVIDIA|NVENC|capabilities: \\[gpu|64-character hex" .env.example README.md CLAUDE.md AGENTS.md Dockerfile docker-compose.yaml docs
```

Expected:

- no current-facing stale references
- remaining matches appear only in clearly historical, superseded, compatibility-test, or anti-pattern contexts

**Optional if Task 10 is implemented:**

```bash
bun run test:integration -- tests/integration/playlist/create-playlist-runtime-test-workspace.test.ts
```

Expected: pass.

## 4. Commit Guidance

Use small commits if implementing this plan manually:

1. `📝 Align runtime env and Docker docs`
2. `🐳 Align Docker runtime defaults`
3. `📝 Refresh current architecture and verification docs`
4. `📝 Mark superseded planning docs historical`
5. Optional: `🧪 Restore playlist runtime test env`

Do not commit generated `binaries/`, `build/`, `.react-router/`, `storage/`, or local `.env` files.
