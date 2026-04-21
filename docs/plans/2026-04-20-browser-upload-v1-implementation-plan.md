# Browser Upload V1 Implementation Plan

Status: Historical execution record for the completed browser upload V1 rollout

Do not use this document as the live current-state source of truth. Use `docs/roadmap/current-refactor-status.md` and the verification docs for the implemented behavior.

**Goal:** Replace the current folder-scan upload intake with a browser-first single-file staged upload flow at `/add-videos`, while removing the old pending-upload model from active product paths.

**Architecture:** Keep route adapters thin and move the new upload lifecycle into the active ingest module. Persist staging metadata in an ingest-owned table inside the existing video-metadata SQLite file so commit bookkeeping and canonical library writes can share one transaction boundary, keep staged bytes on the filesystem in a server-owned staging area, and keep `/add-videos` as a single-screen client workflow that separates upload from final library commit.

**Tech Stack:** React Router 7, React 19, Bun, TypeScript, existing ingest module, filesystem storage, SQLite, shadcn-based shared UI, Playwright, Vitest.

---

## Planning Outcome

This plan intentionally locks down a few implementation decisions so the later coding pass does not need to invent contracts mid-flight.

### Locked decisions

1. **Staging metadata is persisted in an ingest-owned table inside the existing video-metadata SQLite file.**
   - Chosen: add an ingest-owned repository/table that uses the same physical SQLite file as canonical video metadata, while remaining a separate repository and table from `library_videos`.
   - Why: commit bookkeeping and canonical library row creation need one transaction boundary, but staged uploads should still remain ingest-owned state rather than library-owned domain state.
   - Rejected: `pending.json` evolution, because it cannot safely support idempotent commit, TTL cleanup, and duplicate-safe retry without recreating an ad hoc database.
   - Rejected: a second SQLite file, because it would force cross-database compensation for `videoId` reservation and duplicate-safe retry.

2. **Staged bytes live in a dedicated server-owned staging directory, not `storage/uploads`.**
   - Chosen: a new staging subtree under `storage/data/` or another ingest-owned storage path returned by `getStoragePaths()`.
   - Rejected: preserving `storage/uploads`, because the spec explicitly removes the user-managed drop-folder model.

3. **Successful commit keeps the staging record but deletes staged bytes immediately.**
   - Chosen: retain the record for idempotent retry by `stagingId`, with `videoId` stored on the staging row.
   - Rejected: deleting the row immediately, because repeated commit requests could create duplicate library entries.

4. **TTL cleanup is lazy and request-triggered in V1.**
   - Chosen: run a reaper from ingest-owned service paths such as upload start, commit, and delete, using a fixed TTL.
   - Rejected: background worker or cron, because the repo has no scheduler surface today.

5. **V1 drops pre-commit thumbnail preview instead of rebuilding the old scan-era thumbnail chain.**
   - Chosen: the upload card shows filename, size, type, state, and metadata form without a preview image.
   - Rejected: rebuilding `filename`-based preview routes for staged uploads, because that would reintroduce the wrong identity boundary and widen scope.

6. **Client upload transport uses `XMLHttpRequest` for the upload request only.**
   - Chosen: `XMLHttpRequest` in the add-videos widget model or a widget-local helper so progress can be observed without adding a new shared abstraction prematurely.
   - Rejected: `fetch` for upload progress, because reliable upload progress events are not available in the current browser support surface.
   - Additional rule: while upload is in flight, `Remove` means `XMLHttpRequest.abort()` plus server-side cleanup of request-scoped temporary bytes. The delete route is only used after a persisted `stagingId` exists.

7. **V1 reuses existing shared UI primitives and does not add a shared `Dropzone` or `Progress` primitive.**
   - Chosen: use existing `Card`, `Empty`, `Alert`, `Button`, `Input`, `Textarea`, `Badge`, `Label`, `Separator`, `Skeleton`, plus local upload-card markup.
   - Rejected: expanding `app/shared/ui` first, because the flow is still single-page and feature-specific.

8. **The home page fully stops depending on ingest pending-upload services.**
   - Chosen: remove pending-upload data from home composition, shell, and tests.
   - Rejected: hiding only the badge while leaving server composition intact, because that preserves the coupling the spec explicitly removes.

9. **Server upload intake is streaming and never uses `request.formData()` for video bytes.**
   - Chosen: stream the single multipart `file` part directly to a request-scoped temp file while counting bytes, reject past `4 GB`, and promote to the persisted staged-upload store only after the full file lands successfully.
   - Rejected: `request.formData()` for video uploads, because buffering a 4 GB file in memory is not an acceptable V1 server strategy.

10. **Browser failure-state QA uses network interception, not product-only fault hooks.**
   - Chosen: automated smoke covers the happy path with a tracked upload fixture, while Playwright MCP or equivalent isolated browser QA simulates upload and commit failures through network interception.
   - Rejected: introducing production route params or hidden app switches solely to force upload failure states in the product surface.

### Fixed constants for V1

- Single-file session only
- Browser-supported formats from the spec
- Max size: `4 GB`
- Staging TTL for abandoned non-committed uploads: `24 hours`
- Protected API surface:
  - `POST /api/uploads`
  - `DELETE /api/uploads/:stagingId`
  - `POST /api/uploads/:stagingId/commit`
- Delete legacy API surface:
  - `/api/scan-incoming`
  - `/api/add-to-library`

### Persisted staging state machine

- No persisted row exists while the browser upload request is still streaming.
- Persisted row states are:
  - `uploaded`
  - `committing`
  - `committed`
- Upload failure or upload abort leaves no row behind.
- Commit failure returns the row to `uploaded` and records the last error code/message for observability only.
- Successful commit keeps the row in `committed` with the final `videoId`.
- Delete is allowed only for `uploaded`.
- Delete against `committing` returns `409 COMMIT_IN_PROGRESS`.
- Completed sessions are cleared client-side only; the server keeps the `committed` row for idempotent commit replay and does not expose a remove action for completed uploads.

### Commit bookkeeping rule

- The staging row stores a reserved `videoId` before processing starts.
- Retries for the same `stagingId` reuse that reserved `videoId`.
- The canonical `library_videos` insert and the staging-row transition to `committed` happen in one SQLite transaction against the shared video-metadata database file.
- If commit processing fails before that transaction, the row returns to `uploaded` and keeps the same reserved `videoId` for retry.

## API Diff

### New active API contract

**`POST /api/uploads`**

- Auth: protected owner session
- Request: `multipart/form-data`
- Exactly one file field named `file`
- Upload streams the single `file` part into a request-scoped temporary file first
- The server counts bytes during the stream and rejects above `4 GB` without promoting the temp file
- `stagingId` is created and returned only after the full file is accepted and promoted into the persisted staged-upload store
- Success `200`:
  - `success: true`
  - `stagingId`
  - `filename`
  - `size`
  - `mimeType`
- Failure:
  - `401` unauthorized session gate
  - `400` `MULTIPLE_FILES_NOT_ALLOWED`
  - `413` `FILE_TOO_LARGE`
  - `415` `UNSUPPORTED_FILE_TYPE`
  - `500` `UPLOAD_UNAVAILABLE`

**`DELETE /api/uploads/:stagingId`**

- Auth: protected owner session
- Effect: remove staged bytes if present and clear the staging row
- Success:
  - `204 No Content`
- Idempotent behavior:
  - deleting an already-removed or expired row still returns `204`
- Conflict behavior:
  - deleting a `committing` row returns `409 COMMIT_IN_PROGRESS`
  - the UI must not expose delete/remove for `committed` rows

### Upload cancellation contract

- While the upload request is still in flight, there is no persisted `stagingId` yet.
- `Remove` during upload is implemented as:
  - client-side `XMLHttpRequest.abort()`
  - server-side deletion of the partially written request-scoped temp file in the upload handler cleanup path
- `DELETE /api/uploads/:stagingId` is only for already-persisted staged uploads after a successful upload response.
- Upload failure and upload cancellation must leave no persisted staging row and no partial bytes behind.

**`POST /api/uploads/:stagingId/commit`**

- Auth: protected owner session
- Request JSON:
  - `title`
  - `tags`
  - `description`
  - `encodingOptions`
- Success `200`:
  - `success: true`
  - `videoId`
- Failure:
  - `400` `COMMIT_VALIDATION_FAILED`
  - `404` `STAGING_NOT_FOUND`
  - `410` `STAGING_EXPIRED`
  - `409` `COMMIT_IN_PROGRESS`
  - `500` `COMMIT_UNAVAILABLE`
- Idempotent behavior:
  - if the same `stagingId` already committed successfully, return `200` with the same `videoId`

### Legacy surface disposition

- Delete `app/routes/api.scan-incoming.ts`
- Delete the scan-incoming route contract from tests and docs
- Delete `app/routes/api.add-to-library.ts`
- Replace its behavior with the staged commit route

## Error Mapping Contract

| Stage | Code | HTTP | Retry path | Notes |
| --- | --- | --- | --- | --- |
| auth | `UNAUTHORIZED` | 401 | log in again | route-level protected session gate |
| upload | `UPLOAD_ABORTED` | client-side only | choose file again | request never reached committed staging row state |
| upload | `MULTIPLE_FILES_NOT_ALLOWED` | 400 | choose one file | client should usually prevent this first |
| upload | `FILE_TOO_LARGE` | 413 | choose a smaller file | client may pre-check when file size is available |
| upload | `UNSUPPORTED_FILE_TYPE` | 415 | choose a supported file | enforce client and server |
| upload | `UPLOAD_UNAVAILABLE` | 500 | `Retry Upload` | upload attempt creates a new `stagingId` |
| commit | `COMMIT_VALIDATION_FAILED` | 400 | fix metadata and retry commit | title missing or malformed payload |
| commit | `STAGING_NOT_FOUND` | 404 | start over | row missing and no reusable staged artifact exists |
| commit | `STAGING_EXPIRED` | 410 | start over | TTL reaper already removed the staged upload |
| commit | `COMMIT_IN_PROGRESS` | 409 | wait or retry later | another commit already holds the row |
| commit | `COMMIT_UNAVAILABLE` | 500 | `Retry Add to Library` | staged artifact remains available |

## File Inventory

### Delete

- `app/routes/api.scan-incoming.ts`
- `app/modules/ingest/application/use-cases/scan-incoming-videos.usecase.ts`
- `app/modules/ingest/application/ports/ingest-upload-scan.port.ts`
- `app/modules/ingest/application/ports/ingest-pending-thumbnail-enricher.port.ts`
- `app/modules/ingest/application/ports/ingest-pending-video-reader.port.ts`
- `app/modules/ingest/infrastructure/scan/filesystem-ingest-upload-scan.adapter.ts`
- `app/modules/ingest/infrastructure/thumbnail/ffmpeg-ingest-pending-thumbnail-enricher.adapter.ts`
- `app/modules/ingest/infrastructure/pending/json-ingest-pending-video-reader.adapter.ts`
- `tests/integration/ingest/add-to-library-ownership-boundary.test.ts`
- `tests/integration/composition/ingest-library-intake-composition.test.ts`
- any pending-upload-only tests and docs listed in task breakdown below

### Rewrite

- `app/composition/server/ingest.ts`
- `app/modules/ingest/application/ports/ingest-library-intake.port.ts`
- `app/modules/ingest/application/use-cases/add-video-to-library.usecase.ts`
- `app/modules/ingest/infrastructure/workspace/filesystem-ingest-prepared-video-workspace.adapter.ts`
- `app/shared/config/storage-paths.server.ts`
- `app/pages/add-videos/ui/AddVideosPage.tsx`
- `app/pages/home/ui/HomePage.tsx`
- `app/widgets/add-videos/model/useAddVideosView.ts`
- `app/widgets/add-videos/ui/AddVideosView.tsx`
- `app/widgets/add-videos-shell/ui/AddVideosShell.tsx`
- `app/composition/server/home-library-page.ts`
- `app/routes/_index.tsx`
- `app/widgets/home-library/ui/HomeLibraryWidget.tsx`
- `app/widgets/home-shell/ui/HomeShell.tsx`
- relevant tests, smoke specs, and runtime workspace helpers

### Create

- `app/routes/api.uploads.ts`
- `app/routes/api.uploads.$stagingId.ts`
- `app/routes/api.uploads.$stagingId.commit.ts`
- `app/modules/ingest/domain/staged-upload.ts`
- `app/modules/ingest/application/ports/ingest-staged-upload-repository.port.ts`
- `app/modules/ingest/application/ports/ingest-staged-upload-storage.port.ts`
- `app/modules/ingest/infrastructure/upload/bun-streaming-multipart-upload.adapter.ts`
- `app/modules/ingest/application/use-cases/start-staged-upload.usecase.ts`
- `app/modules/ingest/application/use-cases/remove-staged-upload.usecase.ts`
- `app/modules/ingest/application/use-cases/reap-expired-staged-uploads.usecase.ts`
- `app/modules/ingest/infrastructure/staging/sqlite-ingest-staged-upload-repository.adapter.ts`
- `app/modules/ingest/infrastructure/staging/filesystem-ingest-staged-upload-storage.adapter.ts`
- `tests/integration/ingest/bun-streaming-multipart-upload.adapter.test.ts`
- new route, use-case, integration, UI, and e2e tests listed below

## Task Sequence

### Task 1: Lock the staging model and storage contract

**Files:**
- Modify: `app/shared/config/storage-paths.server.ts`
- Modify: `app/shared/config/video-metadata.server.ts`
- Create: `app/modules/ingest/domain/staged-upload.ts`
- Create: `app/modules/ingest/application/ports/ingest-staged-upload-repository.port.ts`
- Create: `app/modules/ingest/application/ports/ingest-staged-upload-storage.port.ts`
- Test: `tests/integration/shared/storage-paths.server.test.ts`
- Test: `app/modules/ingest/domain/staged-upload.test.ts`

**Step 1: Write failing tests for the new storage contract**

- Add a storage-paths test proving the app exposes a dedicated staging directory while keeping the shared video-metadata SQLite path as the physical DB location for canonical rows and staged-upload bookkeeping.
- Add a domain test that validates the staged-upload row shape:
  - `stagingId`
  - `filename`
  - `mimeType`
  - `size`
  - `storagePath`
  - `status`
  - `createdAt`
  - `expiresAt`
  - `committedVideoId?`

**Step 2: Run the failing tests**

Run:

```bash
bun run test:integration -- tests/integration/shared/storage-paths.server.test.ts
bun run test:modules -- app/modules/ingest/domain/staged-upload.test.ts
```

Expected:

- current tests fail because storage paths still expose `pending.json` and `uploads`
- staged-upload domain file does not exist yet

**Step 3: Write the minimal implementation**

- Add staging-focused fields to `getStoragePaths()`, for example:
  - `stagingDir`
  - `stagingTempDir`
- Define a staged-upload domain type with explicit statuses such as:
  - `uploaded`
  - `committing`
  - `committed`
- Clarify in code comments or docs that `uploading` is request-local only and never a persisted row state.
- Define repository/storage ports around `stagingId`, not filename.

**Step 4: Re-run the focused tests**

Run the same commands and make sure they pass.

**Step 5: Commit**

```bash
git add app/shared/config/storage-paths.server.ts app/shared/config/video-metadata.server.ts app/modules/ingest/domain/staged-upload.ts app/modules/ingest/application/ports/ingest-staged-upload-repository.port.ts app/modules/ingest/application/ports/ingest-staged-upload-storage.port.ts tests/integration/shared/storage-paths.server.test.ts app/modules/ingest/domain/staged-upload.test.ts
git commit -m "♻️ Define ingest staging contract"
```

### Task 2: Build ingest-owned staging persistence and TTL reaper

**Files:**
- Create: `app/modules/ingest/infrastructure/staging/sqlite-ingest-staged-upload-repository.adapter.ts`
- Create: `app/modules/ingest/infrastructure/staging/filesystem-ingest-staged-upload-storage.adapter.ts`
- Create: `app/modules/ingest/infrastructure/upload/bun-streaming-multipart-upload.adapter.ts`
- Create: `app/modules/ingest/application/use-cases/reap-expired-staged-uploads.usecase.ts`
- Test: `tests/integration/ingest/sqlite-ingest-staged-upload-repository.adapter.test.ts`
- Test: `tests/integration/ingest/filesystem-ingest-staged-upload-storage.adapter.test.ts`
- Test: `tests/integration/ingest/bun-streaming-multipart-upload.adapter.test.ts`
- Test: `app/modules/ingest/application/use-cases/reap-expired-staged-uploads.usecase.test.ts`

**Step 1: Write failing tests**

- Repository tests for create/load/update/delete by `stagingId`
- Repository tests for storing `committedVideoId`
- Repository tests for reserving and reusing the same `videoId` across retries
- Storage tests for writing staged bytes under the new staging directory
- Multipart upload adapter tests for:
  - streaming one file part to a temp path
  - rejecting oversized streams during write
  - cleaning temp bytes on abort/error
- Reaper tests for removing expired non-committed rows and bytes while preserving committed rows

**Step 2: Run the failing tests**

Run:

```bash
bun run test:integration -- tests/integration/ingest/sqlite-ingest-staged-upload-repository.adapter.test.ts tests/integration/ingest/filesystem-ingest-staged-upload-storage.adapter.test.ts tests/integration/ingest/bun-streaming-multipart-upload.adapter.test.ts
bun run test:modules -- app/modules/ingest/application/use-cases/reap-expired-staged-uploads.usecase.test.ts
```

Expected:

- adapter files and reaper use case do not exist yet

**Step 3: Write the minimal implementation**

- Implement a SQLite-backed staging repository in the same physical SQLite file as canonical video metadata, but with an ingest-owned table and repository boundary.
- Implement filesystem staging write/delete helpers that never depend on `storage/uploads`.
- Implement a Bun-compatible streaming multipart adapter that writes to request-scoped temp files and never uses `request.formData()` for video bytes.
- Implement a reaper use case that:
  - lists expired non-committed rows
  - removes their bytes
  - deletes those rows

**Step 4: Re-run focused tests**

Use the same commands and make them pass.

**Step 5: Commit**

```bash
git add app/modules/ingest/infrastructure/staging app/modules/ingest/infrastructure/upload/bun-streaming-multipart-upload.adapter.ts app/modules/ingest/application/use-cases/reap-expired-staged-uploads.usecase.ts tests/integration/ingest/sqlite-ingest-staged-upload-repository.adapter.test.ts tests/integration/ingest/filesystem-ingest-staged-upload-storage.adapter.test.ts tests/integration/ingest/bun-streaming-multipart-upload.adapter.test.ts app/modules/ingest/application/use-cases/reap-expired-staged-uploads.usecase.test.ts
git commit -m "✨ Add staged upload persistence"
```

### Task 3: Replace scan-based ingest use cases with upload, remove, and commit flows

**Files:**
- Create: `app/modules/ingest/application/use-cases/start-staged-upload.usecase.ts`
- Create: `app/modules/ingest/application/use-cases/remove-staged-upload.usecase.ts`
- Modify: `app/modules/ingest/application/ports/ingest-library-intake.port.ts`
- Modify: `app/modules/ingest/application/use-cases/add-video-to-library.usecase.ts`
- Modify: `app/modules/ingest/infrastructure/workspace/filesystem-ingest-prepared-video-workspace.adapter.ts`
- Delete: `app/modules/ingest/application/use-cases/scan-incoming-videos.usecase.ts`
- Delete: `app/modules/ingest/application/use-cases/load-pending-upload-snapshot.usecase.ts`
- Test: `app/modules/ingest/application/use-cases/start-staged-upload.usecase.test.ts`
- Test: `app/modules/ingest/application/use-cases/remove-staged-upload.usecase.test.ts`
- Test: `app/modules/ingest/application/use-cases/add-video-to-library.usecase.test.ts`
- Test: `tests/integration/modules/ingest/filesystem-ingest-prepared-video-workspace.adapter.test.ts`

**Step 1: Write failing tests**

- `start-staged-upload`:
  - validates file type and size
  - writes the file to staging
  - creates a row with `uploaded` status
  - deletes partial request-scoped temp bytes when the upload aborts or fails before promotion
- `remove-staged-upload`:
  - removes staged bytes and row
  - is idempotent
- `add-video-to-library`:
  - accepts `stagingId` instead of `filename`
  - returns the same `videoId` for repeated successful commit
  - reserves the `videoId` on the staging row before processing and reuses it on retry
  - preserves the staged artifact on `COMMIT_UNAVAILABLE`
- workspace adapter:
  - prepares from `stagingId`-resolved source path, not `uploadsDir`

**Step 2: Run the failing tests**

Run:

```bash
bun run test:modules -- app/modules/ingest/application/use-cases/start-staged-upload.usecase.test.ts app/modules/ingest/application/use-cases/remove-staged-upload.usecase.test.ts app/modules/ingest/application/use-cases/add-video-to-library.usecase.test.ts
bun run test:integration -- tests/integration/modules/ingest/filesystem-ingest-prepared-video-workspace.adapter.test.ts
```

Expected:

- current use cases still speak `filename`, scan, and pending snapshot

**Step 3: Write the minimal implementation**

- Keep `AddVideoToLibraryUseCase` file name for V1, but rewrite the command shape around `stagingId`.
- Resolve staged source path through the staging repository/storage layer.
- Use the shared video-metadata SQLite transaction surface so the canonical library row insert and staging-row `committed` update succeed or fail together.
- On successful commit:
  - mark the staging row `committed`
  - store `videoId`
  - delete staged bytes
- On commit retry:
  - short-circuit if the row is already committed and return the stored `videoId`
- On commit failure:
  - keep the row and staged bytes

**Step 4: Re-run focused tests**

Run the same commands until they pass.

**Step 5: Commit**

```bash
git add app/modules/ingest/application/use-cases/start-staged-upload.usecase.ts app/modules/ingest/application/use-cases/remove-staged-upload.usecase.ts app/modules/ingest/application/ports/ingest-library-intake.port.ts app/modules/ingest/application/use-cases/add-video-to-library.usecase.ts app/modules/ingest/infrastructure/workspace/filesystem-ingest-prepared-video-workspace.adapter.ts app/modules/ingest/application/use-cases/*.test.ts tests/integration/modules/ingest/filesystem-ingest-prepared-video-workspace.adapter.test.ts
git commit -m "♻️ Rewrite ingest flow around staging ids"
```

### Task 4: Replace route wiring and composition root ownership

**Files:**
- Modify: `app/composition/server/ingest.ts`
- Create: `app/routes/api.uploads.ts`
- Create: `app/routes/api.uploads.$stagingId.ts`
- Create: `app/routes/api.uploads.$stagingId.commit.ts`
- Delete: `app/routes/api.scan-incoming.ts`
- Delete: `app/routes/api.add-to-library.ts`
- Test: `tests/integration/composition/ingest-composition.test.ts`
- Create: `tests/integration/ingest/uploads-route.test.ts`
- Create: `tests/integration/ingest/upload-remove-route.test.ts`
- Create: `tests/integration/ingest/upload-commit-route.test.ts`

**Step 1: Write failing route and composition tests**

- composition root exposes:
  - `startStagedUpload`
  - `removeStagedUpload`
  - `addVideoToLibrary`
  - `reapExpiredStagedUploads`
- upload route:
  - requires auth
  - rejects multi-file payloads
  - rejects unsupported file types and oversized files
  - returns `stagingId`
- delete route:
  - requires auth
  - returns `204`
- commit route:
  - requires auth
  - preserves error codes
  - is idempotent

**Step 2: Run the failing tests**

Run:

```bash
bun run test:integration -- tests/integration/composition/ingest-composition.test.ts tests/integration/ingest/uploads-route.test.ts tests/integration/ingest/upload-remove-route.test.ts tests/integration/ingest/upload-commit-route.test.ts
```

Expected:

- existing composition root still exposes scan/pending services
- new route files do not exist

**Step 3: Write the minimal implementation**

- Rebuild `createServerIngestServices()` around the new repository, storage adapter, reaper, upload start, remove, and commit use cases.
- Keep all routes thin:
  - auth gate first
  - route-level payload decoding only
  - business logic delegated into ingest services
- Run the reaper at the start of protected write paths.

**Step 4: Re-run the focused tests**

Use the same command and make it pass.

**Step 5: Commit**

```bash
git add app/composition/server/ingest.ts app/routes/api.uploads.ts app/routes/api.uploads.$stagingId.ts app/routes/api.uploads.$stagingId.commit.ts tests/integration/composition/ingest-composition.test.ts tests/integration/ingest/uploads-route.test.ts tests/integration/ingest/upload-remove-route.test.ts tests/integration/ingest/upload-commit-route.test.ts
git commit -m "✨ Add staged upload API routes"
```

### Task 5: Remove home-page pending-upload coupling

**Files:**
- Modify: `app/composition/server/home-library-page.ts`
- Modify: `app/routes/_index.tsx`
- Modify: `app/pages/home/ui/HomePage.tsx`
- Modify: `app/widgets/home-library/ui/HomeLibraryWidget.tsx`
- Modify: `app/widgets/home-library/model/useHomeLibraryView.ts`
- Modify: `app/widgets/home-shell/ui/HomeShell.tsx`
- Modify: `app/shared/ui/route-error-view.tsx`
- Modify: `app/pages/playlist-detail/ui/PlaylistDetailPage.tsx`
- Modify: `app/pages/playlists/ui/PlaylistsPage.tsx`
- Delete: `app/features/home-pending-indicator/ui/HomePendingIndicator.tsx`
- Test: `tests/integration/composition/home-library-page-composition.test.ts`
- Test: `tests/integration/library/home-route-library-slice.test.ts`
- Test: `tests/ui/home/home-route-bootstrap.test.tsx`
- Test: `tests/ui/home/home-shell-contract.test.tsx`
- Test: `tests/ui/home/home-page-bootstrap.test.tsx`
- Test: `tests/ui/home/home-library-surface.test.tsx`
- Test: `tests/ui/home/home-library-widget.test.tsx`
- Test: `tests/ui/home/home-library-surface-contract.test.tsx`
- Test: `tests/ui/playlists/playlist-detail-page.test.tsx`
- Test: `tests/ui/playlists/playlists-page.test.tsx`

**Step 1: Write failing tests**

- home loader returns only library data
- home composition no longer calls ingest pending services
- shell no longer renders pending count/badge
- widget no longer accepts `pendingVideos`
- all `HomeShell` consumers compile without `pendingCount`
- playlist pages and route error view stop threading dead pending-count props

**Step 2: Run the failing tests**

Run:

```bash
bun run test:integration -- tests/integration/composition/home-library-page-composition.test.ts tests/integration/library/home-route-library-slice.test.ts
bun run test:ui-dom -- tests/ui/home/home-route-bootstrap.test.tsx tests/ui/home/home-shell-contract.test.tsx tests/ui/home/home-page-bootstrap.test.tsx tests/ui/home/home-library-surface.test.tsx tests/ui/home/home-library-widget.test.tsx tests/ui/home/home-library-surface-contract.test.tsx tests/ui/playlists/playlist-detail-page.test.tsx tests/ui/playlists/playlists-page.test.tsx
```

Expected:

- current home flow still depends on `pendingVideos`

**Step 3: Write the minimal implementation**

- Remove pending-upload loading from home composition.
- Remove `pendingVideos` from the home route loader shape.
- Remove `pendingCount` from `HomeShell`.
- Remove dead `pendingCount` threading from `RouteErrorView`, `PlaylistDetailPage`, and `PlaylistsPage`.
- Keep `/add-videos` as the only owner-facing upload workspace link in navigation.

**Step 4: Re-run focused tests**

Use the same commands and make them pass.

**Step 5: Commit**

```bash
git add app/composition/server/home-library-page.ts app/routes/_index.tsx app/pages/home/ui/HomePage.tsx app/widgets/home-library/ui/HomeLibraryWidget.tsx app/widgets/home-library/model/useHomeLibraryView.ts app/widgets/home-shell/ui/HomeShell.tsx app/shared/ui/route-error-view.tsx app/pages/playlist-detail/ui/PlaylistDetailPage.tsx app/pages/playlists/ui/PlaylistsPage.tsx tests/integration/composition/home-library-page-composition.test.ts tests/integration/library/home-route-library-slice.test.ts tests/ui/home/home-route-bootstrap.test.tsx tests/ui/home/home-shell-contract.test.tsx tests/ui/home/home-page-bootstrap.test.tsx tests/ui/home/home-library-surface.test.tsx tests/ui/home/home-library-widget.test.tsx tests/ui/home/home-library-surface-contract.test.tsx tests/ui/playlists/playlist-detail-page.test.tsx tests/ui/playlists/playlists-page.test.tsx
git commit -m "♻️ Remove home pending upload coupling"
```

### Task 6: Rebuild the add-videos widget model around a single staged-upload session

**Files:**
- Modify: `app/pages/add-videos/ui/AddVideosPage.tsx`
- Modify: `app/widgets/add-videos/model/useAddVideosView.ts`
- Create: `app/widgets/add-videos/model/upload-browser-file.ts`
- Test: `tests/ui/add-videos/use-add-videos-view.test.tsx`

**Step 1: Write failing tests**

- idle state has no automatic `Refresh`
- selecting one file starts upload immediately
- selecting multiple files yields a single-file validation error
- upload progress updates state
- title is required before enabling commit
- upload retry creates a fresh session upload path
- commit retry preserves the same `stagingId`
- remove clears the session and calls the delete route when needed

**Step 2: Run the failing tests**

Run:

```bash
bun run test:ui-dom -- tests/ui/add-videos/use-add-videos-view.test.tsx
```

Expected:

- current hook still fetches `/api/scan-incoming` and manages `pendingFiles[]`

**Step 3: Write the minimal implementation**

- Replace array/mapping state with a single session object:
  - selected file summary
  - `stagingId?`
  - `uploadState`
  - `ingestState`
  - `progress`
  - metadata draft
  - validation state
  - inline session error
  - completed `videoId?`
- Use `XMLHttpRequest` in a widget-local helper for upload progress.
- Treat `Remove` differently by phase:
  - during upload: abort the XHR and rely on server upload-handler cleanup
  - after upload success: call `DELETE /api/uploads/:stagingId`
- Do not expose `Remove` in the completed state; completed sessions clear client-side only.
- Keep `fetch` for delete and commit.

**Step 4: Re-run the focused test**

Use the same command and make it pass.

**Step 5: Commit**

```bash
git add app/pages/add-videos/ui/AddVideosPage.tsx app/widgets/add-videos/model/useAddVideosView.ts app/widgets/add-videos/model/upload-browser-file.ts tests/ui/add-videos/use-add-videos-view.test.tsx
git commit -m "✨ Add staged upload view model"
```

### Task 7: Rewrite the add-videos screen around one working surface

**Files:**
- Modify: `app/widgets/add-videos/ui/AddVideosView.tsx`
- Modify: `app/widgets/add-videos-shell/ui/AddVideosShell.tsx`
- Modify: `app/features/add-videos-encoding/ui/AddVideosEncodingOptions.tsx`
- Test: `tests/ui/add-videos/add-videos-view-parity.test.tsx`
- Test: `tests/ui/add-videos/add-videos-shell.test.tsx`

**Step 1: Write failing tests**

- idle state shows:
  - `Choose Video`
  - drag-and-drop hint
  - allowed formats
  - 4 GB limit
- active state shows a single card only
- file-specific errors render inline inside that card
- `Add to Library` is the only primary action in the ready state
- description uses `Textarea`
- upload success and add success are not conflated

**Step 2: Run the failing tests**

Run:

```bash
bun run test:ui-dom -- tests/ui/add-videos/add-videos-view-parity.test.tsx tests/ui/add-videos/add-videos-shell.test.tsx
```

Expected:

- current view still renders refresh controls and pending-file lists

**Step 3: Write the minimal implementation**

- Reuse existing shared UI primitives.
- Do not add a shared progress/dropzone primitive in V1.
- Keep `AddVideosEncodingOptions`, but remove unnecessary card-in-card weight if a light section variant is enough.
- Remove any add-videos-shell pending badge affordance that still implies the old pending-upload model.
- Keep all file-specific feedback inline inside the active card.

**Step 4: Re-run focused tests**

Use the same command and make it pass.

**Step 5: Commit**

```bash
git add app/widgets/add-videos/ui/AddVideosView.tsx app/widgets/add-videos-shell/ui/AddVideosShell.tsx app/features/add-videos-encoding/ui/AddVideosEncodingOptions.tsx tests/ui/add-videos/add-videos-view-parity.test.tsx tests/ui/add-videos/add-videos-shell.test.tsx
git commit -m "🎨 Rebuild add videos screen for browser upload"
```

### Task 8: Replace stale ingest and UI tests with staging-based coverage

**Files:**
- Delete/Rewrite:
  - `tests/integration/ingest/scan-incoming-route.test.ts`
  - `tests/integration/composition/ingest-scan-incoming-composition.test.ts`
  - `tests/integration/ingest/scan-incoming-ownership-boundary.test.ts`
  - `app/modules/ingest/application/use-cases/scan-incoming-videos.usecase.test.ts`
  - `app/modules/ingest/application/use-cases/load-pending-upload-snapshot.usecase.test.ts`
  - `tests/integration/composition/ingest-pending-upload-composition.test.ts`
  - `tests/integration/ingest/json-ingest-pending-video-reader.adapter.test.ts`
  - `tests/integration/ingest/filesystem-ingest-upload-scan.adapter.test.ts`
  - `tests/integration/ingest/ffmpeg-ingest-pending-thumbnail-enricher.adapter.test.ts`
  - `tests/integration/ingest/add-to-library-route.test.ts`
  - `tests/integration/ingest/add-to-library-ownership-boundary.test.ts`
  - `tests/integration/composition/ingest-library-intake-composition.test.ts`

**Step 1: Write the replacement test list**

Create or rewrite tests so coverage now proves:

- upload auth gate
- upload abort leaves no persisted row and no partial bytes
- upload type/size validation
- single-file rejection
- staging row creation
- commit idempotency by `stagingId`
- commit failure preserves staged artifact
- delete route cleanup
- TTL reaper cleanup

**Step 2: Run focused integration and module suites**

Run:

```bash
bun run test:modules
bun run test:integration
```

Expected:

- several stale tests fail until the old scan surfaces are removed or replaced

**Step 3: Implement the minimal test rewrites**

- Remove scan/pending assertions completely.
- Rewrite ownership-boundary tests so they protect the staged-upload contract instead.
- Keep tests narrow and contract-based, not implementation-coupled.

**Step 4: Re-run focused suites**

Use the same commands until green.

**Step 5: Commit**

```bash
git add app/modules/ingest/application/use-cases tests/integration/ingest tests/integration/composition
git commit -m "✅ Replace scan-based ingest tests"
```

### Task 9: Replace browser smoke and runtime workspace seeding

**Files:**
- Modify: `tests/support/create-runtime-test-workspace.ts`
- Modify: `tests/integration/smoke/create-runtime-test-workspace.test.ts`
- Create: `tests/fixtures/upload/smoke-upload.mp4`
- Create: `tests/e2e/add-videos-owner-upload-smoke.spec.ts`
- Modify: `tests/e2e/home-library-owner-smoke.spec.ts`
- Modify: `package.json`

**Step 1: Write failing tests/spec updates**

- runtime test workspace should no longer seed `pending.json` or `uploads/thumbnails`
- browser upload smoke should use the tracked source fixture at `tests/fixtures/upload/smoke-upload.mp4`
- new browser smoke should cover:
  - login
  - navigate to `/add-videos`
  - choose the tracked upload fixture
  - observe upload progress or completion
  - enter metadata
  - commit successfully
- home smoke should stop expecting pending-upload UI

**Step 2: Run the failing browser and workspace checks**

Run:

```bash
bun run test:integration -- tests/integration/smoke/create-runtime-test-workspace.test.ts
bun run test:e2e -- tests/e2e/home-library-owner-smoke.spec.ts tests/e2e/add-videos-owner-upload-smoke.spec.ts
```

Expected:

- old runtime workspace and smoke surface still encode scan-era assumptions

**Step 3: Write the minimal implementation**

- Update runtime workspace seeding so upload tests use the tracked fixture at `tests/fixtures/upload/smoke-upload.mp4` instead of repo-local uploads.
- Lock the hermetic upload input strategy to the tracked fixture at `tests/fixtures/upload/smoke-upload.mp4`; do not defer this choice to implementation.
- Update `verify:e2e-smoke` to include the new upload smoke and remove stale pending-upload assertions.

**Step 4: Re-run focused checks**

Use the same commands until green.

**Step 5: Commit**

```bash
git add tests/support/create-runtime-test-workspace.ts tests/integration/smoke/create-runtime-test-workspace.test.ts tests/fixtures/upload/smoke-upload.mp4 tests/e2e/add-videos-owner-upload-smoke.spec.ts tests/e2e/home-library-owner-smoke.spec.ts package.json
git commit -m "🚦 Replace browser smoke for upload flow"
```

### Task 10: Update active documentation and run full verification

**Files:**
- Modify: `docs/roadmap/current-refactor-status.md`
- Modify: `docs/verification-contract.md`
- Modify: `docs/E2E_TESTING_GUIDE.md`
- Review: `docs/plans/2026-04-20-browser-upload-v1-design.md`
- Review: `docs/plans/2026-04-20-browser-upload-v1-implementation-plan.md`

**Step 1: Update docs after code is green**

- current state docs should no longer describe home pending-upload visibility or folder-scan upload
- verification docs should mention the upload smoke and updated runtime-sensitive browser path
- keep the design spec aligned with the final implementation choices if naming drift occurred

**Step 2: Run the base verification bundle**

Run:

```bash
bun run lint
bun run typecheck
bun run test
bun run build
```

Expected:

- all four pass

**Step 3: Run runtime-sensitive verification**

Run:

```bash
bun run verify:e2e-smoke
bun run verify:ci-faithful:docker
```

If the worktree is dirty and Docker must validate that exact state:

```bash
bun run verify:ci-worktree:docker
```

**Step 4: Run browser QA escalation**

- Use Playwright MCP or equivalent isolated browser QA to directly observe:
  - file selection
  - upload progress/success
  - add-to-library success
  - upload failure recovery via browser-level network interception
  - commit failure recovery via browser-level network interception
  - session removal

**Step 5: Commit**

```bash
git add docs/roadmap/current-refactor-status.md docs/verification-contract.md docs/E2E_TESTING_GUIDE.md docs/plans/2026-04-20-browser-upload-v1-design.md docs/plans/2026-04-20-browser-upload-v1-implementation-plan.md
git commit -m "📝 Document browser upload rollout"
```

## Completion Checklist

Do not call implementation complete unless all of the following are true:

- `/add-videos` no longer calls `/api/scan-incoming`
- no active product path depends on `pending.json` or `storage/uploads`
- the home route does not load ingest pending-upload data
- upload, delete, and commit routes all use `stagingId`
- commit is idempotent and returns the same `videoId` on repeated success
- non-committed staged uploads are cleaned by a TTL reaper
- delete/remove is idempotent and clears server-side staged bytes
- the add-videos screen uses one primary working surface and existing shared UI primitives
- stale scan-era tests and docs have been deleted or rewritten
- browser-visible verification covers the new upload flow

## Execution Handoff

Plan complete and saved to `docs/plans/2026-04-20-browser-upload-v1-implementation-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
