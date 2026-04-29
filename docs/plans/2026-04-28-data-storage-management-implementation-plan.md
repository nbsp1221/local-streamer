# Data Storage Management Implementation Plan

> **Status:** Superseded by `docs/plans/2026-04-28-storage-cutover-demo-seed-plan.md`.
> This file is historical context only. Do not execute it as an implementation plan.
> Legacy import, cleanup, and migration-script tasks below are obsolete and must not be reintroduced from this document.
> The accepted cutover direction is to keep the new primary storage model, remove retired legacy import/cleanup/shim code, and provide reproducible demo seed data instead of preserving old test datasets.

**Goal:** Move runtime persistence to one primary SQLite database at `storage/db.sqlite` and one clear media layout under `storage/videos/:videoId`, while preserving legacy data during migration, keeping the application shippable after each step, and finishing with a mandatory cleanup phase that removes or explicitly retains superseded legacy sources after verified cutover.

**Architecture:** Add a storage bounded context that owns primary database creation, schema migrations, legacy inventory/import, filesystem path resolution, and integrity reporting. Existing auth, library, ingest, playback, and playlist contexts keep their domain/use-case ownership, but their infrastructure adapters are rewired to the primary storage services through the server composition root.

**Tech Stack:** Bun 1.3.5, TypeScript strict mode, React Router v7, Vitest, Playwright, SQLite via `@libsql/client`, filesystem media storage, DASH/ClearKey playback, existing FFmpeg/Shaka ingest pipeline.

---

## 1. Source Artifacts

Read these before implementation:

- `docs/plans/2026-04-27-data-storage-management-design.md`
- `docs/plans/2026-04-28-data-storage-management-test-scenarios.md`
- `docs/roadmap/current-refactor-status.md`
- `docs/architecture/personal-video-vault-target-architecture.md`
- `docs/verification-contract.md`
- `docs/browser-qa-contract.md`
- `docs/E2E_TESTING_GUIDE.md`

Primary implementation intent:

- runtime uses `DATABASE_SQLITE_PATH`, defaulting to `storage/db.sqlite`
- legacy `AUTH_SQLITE_PATH` and `VIDEO_METADATA_SQLITE_PATH` are import inputs only
- new committed media goes under `storage/videos/:videoId`
- staging goes under `storage/staging/:stagingId`
- old stores and old media are preserved during the first migration
- final cleanup of superseded legacy DB/JSON/media sources is required before the storage-management project is complete
- tags, genres, content types, playlist items, auth sessions, staged uploads, and media assets are first-class relational data
- integrity checks prove whether persisted data and filesystem artifacts still agree

## 2. Codebase Survey

### 2.1 Current architecture shape

The active backend already follows the target modular-monolith structure:

- `app/routes/*` are route adapters.
- `app/composition/server/*` is the server-side composition root.
- `app/modules/*/{domain,application,infrastructure}` owns bounded contexts.
- Frontend code is feature-sliced under `app/pages`, `app/widgets`, `app/features`, `app/entities`, and `app/shared`.
- The old `app/legacy` tree is gone and must not be recreated.

The persistence change should keep these boundaries. The new storage module should not absorb business rules from auth, library, ingest, playback, or playlist. It should provide the shared database, path, migration, import, and integrity primitives those contexts need.

### 2.2 Current persistence layout

Runtime state is currently split across multiple files:

- `app/shared/config/video-metadata.server.ts`
  - default: `storage/data/video-metadata.sqlite`
  - override: `VIDEO_METADATA_SQLITE_PATH`
- `app/shared/config/auth.server.ts`
  - default: `storage/data/auth.sqlite`
  - override: `AUTH_SQLITE_PATH`
- `app/modules/playlist/infrastructure/json/playlist-storage-paths.server.ts`
  - default JSON files:
    - `storage/data/playlists.json`
    - `storage/data/playlist-items.json`
- `app/shared/config/storage-paths.server.ts`
  - committed media default: `storage/data/videos`
  - staging default: `storage/data/staging`
- `app/modules/playback/infrastructure/storage/playback-storage-paths.server.ts`
  - independently resolves playback media to `storage/data/videos`

The current split is operationally understandable, but it creates future migration cost because the owner must reason about multiple databases, JSON stores, and duplicated path resolvers.

### 2.3 Existing reusable SQLite code

The strongest existing SQLite foundation is:

- `app/modules/library/infrastructure/sqlite/libsql-video-metadata.database.ts`

It already provides:

- an async `SqliteDatabaseAdapter`
- `exec`, `prepare().get/all/run`, and `transaction`
- `@libsql/client`
- WAL setup
- directory creation
- testable `CreateSqliteDatabase` dependency injection

This should be promoted into a storage-owned primary SQLite adapter instead of introducing another SQLite abstraction. Auth currently uses `bun:sqlite`/`node:sqlite` through:

- `app/modules/auth/infrastructure/sqlite/bun-sqlite.database.ts`
- `app/modules/auth/infrastructure/sqlite/sqlite-database.adapter.ts`

Because auth repository methods are already async, auth can move to the same async primary SQLite adapter without changing its application port.

### 2.4 Current library metadata model

Library metadata is stored in `library_videos` with JSON columns:

- `tags_json`
- `genre_slugs_json`

Vocabulary tables already exist:

- `video_content_types`
- `video_genres`

Reusable domain utilities already exist:

- `normalizeVideoTag`
- `normalizeVideoTags`
- `normalizeTaxonomySlug`
- `normalizeTaxonomySlugs`
- `DEFAULT_VIDEO_CONTENT_TYPES`
- `DEFAULT_VIDEO_GENRES`

The implementation should reuse those normalization functions during import and write paths, then replace JSON tag/genre storage with join tables:

- `tags`
- `video_tags`
- `video_genre_assignments`

### 2.5 Current ingest and media model

The active ingest flow is:

- `app/routes/api.uploads.ts`
- `app/routes/api.uploads.$stagingId.commit.ts`
- `app/composition/server/ingest.ts`
- `CommitStagedUploadToLibraryUseCase`
- `SqliteIngestStagedUploadRepositoryAdapter`
- `FilesystemIngestStagedUploadStorageAdapter`
- `FfmpegMediaPreparationAdapter`

Staged uploads already have a DB-backed state machine with:

- `uploaded`
- `committing`
- `committed`

The staging repository currently creates its own `ingest_staged_uploads` table inside the video metadata DB. The first implementation should migrate this table into the primary DB as `ingest_uploads`, preserving the existing application port semantics so the ingest use cases do not need a broad rewrite.

Media preparation already writes the correct DASH/ClearKey shape:

```text
manifest.mpd
key.bin
thumbnail.jpg
video/
audio/
```

The storage migration should change the root from `storage/data/videos/:videoId` to `storage/videos/:videoId`, not redesign DASH packaging.

### 2.6 Current playlist model

Playlist business logic is active-owned under `app/modules/playlist`, but persistence is still JSON:

- `JsonPlaylistRepository`
- `json-write-queue`
- `playlists.json`
- `playlist-items.json`

The repository already enforces duplicate-video prevention at the domain/repository boundary. The SQLite implementation should preserve that behavior with both code-level checks and database constraints:

- `UNIQUE(owner_id, lower(name))` equivalent behavior for owner playlist names
- `UNIQUE(playlist_id, video_id)` for duplicate video prevention
- zero-based item `position`

### 2.7 Current playback/filesystem assumptions

Playback services directly resolve files from `getPlaybackStoragePaths().videosDir`:

- manifest: `manifest.mpd`
- key: `key.bin`
- segments: `video/:filename`, `audio/:filename`

The migration should centralize path resolution and keep playback route behavior unchanged from the user's perspective. During import, old media remains authoritative until copy verification and cutover are recorded.

### 2.8 Current test support

Existing useful test infrastructure:

- `tests/support/create-runtime-test-workspace.ts`
- `tests/support/create-playlist-runtime-test-workspace.ts`
- `tests/support/seed-library-video-metadata.ts`
- `tests/support/copy-playback-fixture.ts`
- `tests/fixtures/*`
- module tests under `app/modules/**/*.{test,spec}.ts`
- integration tests under `tests/integration/**`
- E2E smoke under `tests/e2e/**`

Runtime tests currently seed `storage/data/video-metadata.sqlite`, playlist JSON files, and `storage/data/videos`. These helpers must be updated or duplicated for the primary storage layout so tests do not keep old layout assumptions alive.

## 3. Implementation Strategy

### 3.1 Add storage as an infrastructure-owning bounded context

Create:

```text
app/modules/storage/
  domain/
  application/
  infrastructure/
```

The storage module owns:

- primary DB path resolution
- database adapter creation
- schema migration runner
- legacy source inventory
- legacy import dry-run/apply
- filesystem copy/cutover helpers
- integrity report generation

It does not own:

- auth session business rules
- library filtering/search rules
- ingest commit policy
- playlist permissions and validation
- playback authorization

### 3.2 Use one async SQLite abstraction

Promote the existing libsql adapter pattern into storage:

```text
app/modules/storage/infrastructure/sqlite/sqlite-database.adapter.ts
app/modules/storage/infrastructure/sqlite/primary-sqlite.database.ts
app/modules/storage/infrastructure/sqlite/migrations.ts
```

Implementation rules:

- use `@libsql/client`
- set `PRAGMA journal_mode = WAL`
- set `PRAGMA foreign_keys = ON` for every connection
- expose `exec`, `prepare().get/all/run`, and `transaction`
- reject nested transactions
- keep `CreateSqliteDatabase` injection available for tests
- move table creation out of individual repositories and into schema migrations

The existing `libsql-video-metadata.database.ts` should become a compatibility wrapper temporarily or be replaced after every caller moves to storage-owned database creation.

### 3.3 Keep schema migration separate from legacy import

Add scripts:

```json
{
  "storage:migrate:schema": "bun --no-env-file ./scripts/storage-migrate-schema.ts",
  "storage:import-legacy": "bun --no-env-file ./scripts/storage-import-legacy.ts",
  "storage:cleanup-legacy": "bun --no-env-file ./scripts/storage-cleanup-legacy.ts",
  "verify:data-integrity": "bun --no-env-file ./scripts/verify-data-integrity.ts"
}
```

Command behavior:

- `storage:migrate:schema`
  - creates or upgrades the primary DB only
  - is idempotent
  - does not read legacy stores
  - does not copy media
- `storage:import-legacy -- --dry-run`
  - inventories old stores and target DB
  - writes no database rows
  - copies no files
  - prints a deterministic report
- `storage:import-legacy -- --apply`
  - requires offline/maintenance lock
  - imports legacy DB/JSON data
  - copies media into the new layout only after conflict checks
  - records copy/cutover checkpoints
  - never deletes legacy sources
- `verify:data-integrity`
  - reads the primary DB and filesystem
  - reports missing required media, orphan directories, committed upload mismatches, unsafe paths, expired staging rows, and layout conflicts
- `storage:cleanup-legacy -- --dry-run`
  - lists superseded legacy DBs, playlist JSON files, old media directories, old staging directories, and old temp directories
  - deletes nothing
- `storage:cleanup-legacy -- --apply`
  - requires successful primary integrity verification
  - requires runtime cutover to the primary DB and new media layout
  - requires explicit owner approval
  - removes only paths listed by dry-run or records explicitly retained paths

### 3.4 Use SQL migrations, not repository bootstrap

Create SQL migrations under:

```text
app/modules/storage/infrastructure/sqlite/migrations/
  0001_primary_storage.sql
```

Use a `schema_migrations` table:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);
```

The runner should:

- run migrations in lexical order
- wrap each migration in a transaction
- insert the migration version only after success
- be idempotent
- enable foreign keys before applying migrations

Use explicit `CHECK` constraints for important type/status rules. Add `STRICT` only if the current SQLite runtime supports it cleanly in both Bun and Docker verification. If strict-mode support is inconsistent, the explicit constraints are the portability baseline.

### 3.5 Store relative paths in DB

Filesystem paths inside persisted rows should be storage-root-relative, not absolute:

- good: `videos/:videoId/manifest.mpd`
- good: `staging/:stagingId/source.mp4`
- bad: `/home/.../storage/videos/:videoId/manifest.mpd`

Resolvers should join relative paths against `getStoragePaths().storageDir` at runtime. This keeps the database movable with the `storage/` directory and makes migration reports easier to review.

### 3.6 Preserve compatibility until cutover is proven

During migration implementation:

- runtime initially may keep reading old stores
- migration tests must prove new stores are correct before composition switches
- after runtime switches to `DATABASE_SQLITE_PATH`, legacy env vars are import-only
- old files remain on disk and are not cleaned up in this implementation
  until the migration/cutover phases are proven
- old files must not remain indefinitely as ambiguous runtime-looking sources; the final cleanup phase is a required completion gate

Do not add symlink-following behavior. Treat symlinks under media or staging paths as unsafe report findings.

## 4. Target File Map

### 4.1 Create

- `app/modules/storage/domain/storage-path.ts`
- `app/modules/storage/domain/storage-integrity.ts`
- `app/modules/storage/domain/legacy-import-report.ts`
- `app/modules/storage/application/use-cases/run-schema-migration.usecase.ts`
- `app/modules/storage/application/use-cases/inspect-legacy-storage.usecase.ts`
- `app/modules/storage/application/use-cases/import-legacy-storage.usecase.ts`
- `app/modules/storage/application/use-cases/verify-storage-integrity.usecase.ts`
- `app/modules/storage/infrastructure/config/storage-config.server.ts`
- `app/modules/storage/infrastructure/sqlite/sqlite-database.adapter.ts`
- `app/modules/storage/infrastructure/sqlite/primary-sqlite.database.ts`
- `app/modules/storage/infrastructure/sqlite/schema-migration-runner.ts`
- `app/modules/storage/infrastructure/sqlite/migrations/0001_primary_storage.sql`
- `app/modules/storage/infrastructure/legacy/legacy-storage-inventory.adapter.ts`
- `app/modules/storage/infrastructure/legacy/legacy-storage-importer.adapter.ts`
- `app/modules/storage/infrastructure/filesystem/storage-filesystem.adapter.ts`
- `app/modules/storage/infrastructure/integrity/sqlite-storage-integrity.repository.ts`
- `app/composition/server/storage.ts`
- `scripts/storage-migrate-schema.ts`
- `scripts/storage-import-legacy.ts`
- `scripts/storage-cleanup-legacy.ts`
- `scripts/verify-data-integrity.ts`
- `tests/support/create-primary-storage-test-workspace.ts`

### 4.2 Modify

- `package.json`
- `app/shared/config/storage-paths.server.ts`
- `app/shared/config/video-metadata.server.ts`
- `app/shared/config/auth.server.ts`
- `app/modules/library/infrastructure/sqlite/libsql-video-metadata.database.ts`
- `app/modules/library/infrastructure/sqlite/sqlite-library-video-metadata.repository.ts`
- `app/modules/library/infrastructure/sqlite/sqlite-canonical-video-metadata.adapter.ts`
- `app/modules/library/infrastructure/sqlite/sqlite-library-video-mutation.adapter.ts`
- `app/modules/auth/infrastructure/sqlite/sqlite-session.repository.ts`
- `app/modules/ingest/infrastructure/staging/sqlite-ingest-staged-upload-repository.adapter.ts`
- `app/modules/ingest/infrastructure/staging/filesystem-ingest-staged-upload-storage.adapter.ts`
- `app/modules/ingest/application/use-cases/commit-staged-upload-to-library.usecase.ts`
- `app/modules/playback/infrastructure/storage/playback-storage-paths.server.ts`
- `app/modules/playback/infrastructure/catalog/playback-video-catalog.adapter.ts`
- `app/modules/playlist/infrastructure/video/sqlite-playlist-video-catalog.adapter.ts`
- `app/composition/server/auth.ts`
- `app/composition/server/library.ts`
- `app/composition/server/ingest.ts`
- `app/composition/server/playback.ts`
- `app/composition/server/playlist.ts`
- `tests/support/create-runtime-test-workspace.ts`
- `tests/support/create-playlist-runtime-test-workspace.ts`
- `tests/support/seed-library-video-metadata.ts`
- existing path/config/composition/integration tests that assert old `storage/data` runtime paths

### 4.3 Add tests

- `app/modules/storage/domain/storage-path.test.ts`
- `app/modules/storage/domain/storage-integrity.test.ts`
- `app/modules/storage/infrastructure/sqlite/primary-sqlite.database.test.ts`
- `app/modules/storage/infrastructure/sqlite/schema-migration-runner.test.ts`
- `tests/integration/storage/storage-schema-migration.test.ts`
- `tests/integration/storage/legacy-storage-dry-run.test.ts`
- `tests/integration/storage/legacy-storage-import.test.ts`
- `tests/integration/storage/storage-integrity-report.test.ts`
- `tests/integration/storage/storage-path-resolution.test.ts`
- `tests/integration/composition/storage-composition.test.ts`
- `tests/integration/composition/auth-primary-db-composition.test.ts`
- `tests/integration/composition/library-primary-db-composition.test.ts`
- `tests/integration/composition/ingest-primary-db-composition.test.ts`
- `tests/integration/composition/playlist-primary-db-composition.test.ts`
- `tests/integration/playback/playback-primary-storage-layout.test.ts`

### 4.4 Delete only after replacement is green

Do not delete these first. Replace their usage, then remove only when `rg` proves no runtime/test references remain:

- `app/modules/auth/infrastructure/sqlite/bun-sqlite.database.ts`
- `app/modules/auth/infrastructure/sqlite/sqlite-database.adapter.ts`
- `app/modules/auth/infrastructure/sqlite/in-memory-auth-session.database.ts`
- `app/modules/playlist/infrastructure/json/json-playlist.repository.ts`
- `app/modules/playlist/infrastructure/json/json-write-queue.ts`
- `app/modules/playlist/infrastructure/json/playlist-storage-paths.server.ts`

Legacy runtime config files may stay as import-source config until the migration CLI is stable:

- `app/shared/config/video-metadata.server.ts`
- `app/shared/config/auth.server.ts`

## 5. Primary Schema Shape

The first migration should create these tables:

- `schema_migrations`
- `videos`
- `video_content_types`
- `video_genres`
- `tags`
- `video_tags`
- `video_genre_assignments`
- `video_media_assets`
- `ingest_uploads`
- `playlists`
- `playlist_items`
- `auth_sessions`
- `storage_import_runs`
- `storage_import_checkpoints`

### 5.1 `videos`

Stores canonical library metadata:

- `id TEXT PRIMARY KEY`
- `title TEXT NOT NULL`
- `description TEXT`
- `duration_seconds REAL NOT NULL CHECK (duration_seconds >= 0)`
- `content_type_slug TEXT REFERENCES video_content_types(slug) ON DELETE RESTRICT`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- `sort_index INTEGER NOT NULL UNIQUE`

Runtime `LibraryVideo.videoUrl` should be derived as `/videos/:id/manifest.mpd`, not stored as a mutable absolute value.
Thumbnail and manifest locations belong to `video_media_assets`, not `videos`, so library metadata can evolve independently from filesystem layout.

### 5.2 Taxonomy and tags

- `video_content_types`
  - seeded from `DEFAULT_VIDEO_CONTENT_TYPES`
  - unknown imported values are preserved as inactive
- `video_genres`
  - seeded from `DEFAULT_VIDEO_GENRES`
  - unknown imported values are preserved as inactive
- `tags`
  - one row per canonical tag slug
- `video_tags`
  - `PRIMARY KEY (video_id, tag_slug)`
- `video_genre_assignments`
  - `PRIMARY KEY (video_id, genre_slug)`

The existing normalization utilities are the source of truth for slug generation.

### 5.3 `video_media_assets`

Stores media preparation facts separately from library metadata:

- `video_id TEXT PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE`
- `layout_version INTEGER NOT NULL`
- `status TEXT NOT NULL CHECK (status IN ('preparing', 'ready', 'failed'))`
- `preparation_strategy TEXT NOT NULL`
- `source_filename TEXT`
- `source_container TEXT`
- `source_video_codec TEXT`
- `source_audio_codec TEXT`
- `output_video_codec TEXT`
- `output_audio_codec TEXT`
- `manifest_relpath TEXT`
- `key_relpath TEXT`
- `thumbnail_relpath TEXT`
- `prepared_at TEXT`
- `failed_at TEXT`
- `failure_message TEXT`
- `CHECK` requiring `manifest_relpath`, `key_relpath`, `thumbnail_relpath`, and `prepared_at` only when `status = 'ready'`
- `CHECK` requiring `failed_at` when `status = 'failed'`

DB `ready` means the preparation pipeline reached a ready state. It does not alone prove filesystem playability; `verify:data-integrity` proves the files still exist and match the contract.
Paths remain nullable while media is `preparing` or `failed`; fake paths are not allowed as placeholders.

### 5.4 `ingest_uploads`

Replaces `ingest_staged_uploads`:

- `staging_id TEXT PRIMARY KEY`
- `reserved_video_id TEXT UNIQUE`
- `committed_video_id TEXT UNIQUE REFERENCES videos(id) ON DELETE RESTRICT`
- `filename TEXT NOT NULL`
- `mime_type TEXT NOT NULL`
- `size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0)`
- `storage_relpath TEXT NOT NULL`
- `status TEXT NOT NULL CHECK (status IN ('uploading', 'uploaded', 'committing', 'committed', 'failed', 'expired'))`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- `expires_at TEXT NOT NULL`
- `committed_at TEXT`
- `failure_message TEXT`
- `CHECK` requiring `committed_video_id` and `committed_at` when `status = 'committed'`
- `CHECK` requiring `failure_message` when `status = 'failed'`
- `CHECK` requiring no `committed_video_id` when `status = 'expired'`

`reserved_video_id` intentionally has no FK because it may exist before the video row is committed.
Committed uploads restrict referenced video deletion because nulling `committed_video_id` would violate the committed-row invariant. Cleanup/import logic may prune old operational upload rows explicitly, but the schema must not silently detach a committed upload from its video.

### 5.5 Playlists

`playlists` stores playlist metadata:

- `id TEXT PRIMARY KEY`
- `name TEXT NOT NULL`
- `name_key TEXT NOT NULL`
- `description TEXT`
- `type TEXT NOT NULL`
- `owner_id TEXT NOT NULL`
- `is_public INTEGER NOT NULL CHECK (is_public IN (0, 1))`
- `thumbnail_path TEXT`
- `metadata_json TEXT`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- `UNIQUE(owner_id, name_key)`

`playlist_items` stores item order and episode metadata:

- `playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE`
- `video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE`
- `position INTEGER NOT NULL CHECK (position >= 0)`
- `added_at TEXT NOT NULL`
- `added_by TEXT NOT NULL`
- `episode_metadata_json TEXT`
- `PRIMARY KEY (playlist_id, video_id)`
- `UNIQUE(playlist_id, position)`

Positions are zero-based in the DB.

### 5.6 Auth sessions

Reuse the current auth session contract:

- `id TEXT PRIMARY KEY`
- `created_at TEXT NOT NULL`
- `expires_at TEXT NOT NULL`
- `ip_address TEXT`
- `is_revoked INTEGER NOT NULL DEFAULT 0 CHECK (is_revoked IN (0, 1))`
- `last_accessed_at TEXT NOT NULL`
- `user_agent TEXT`

## 6. Task Plan

### Task 1: Lock primary storage path/config contract

Files:

- create `app/modules/storage/infrastructure/config/storage-config.server.ts`
- update path tests

Implementation:

- add `getPrimaryStorageConfig()`
- default `databasePath` to `storage/db.sqlite`
- respect `DATABASE_SQLITE_PATH`
- keep `STORAGE_DIR`
- resolve primary `videosDir` to `storage/videos`
- resolve primary `stagingDir` to `storage/staging`
- expose legacy source paths for migration commands only
- do not cut over existing runtime helpers in this task; `getStoragePaths()`, auth config, video metadata config, playback paths, ingest paths, and thumbnail paths remain on current legacy runtime locations until their dedicated migration/cutover tasks
- defer fail-fast legacy env var enforcement until normal runtime composition is switched to the primary DB

Tests:

- default paths
- `STORAGE_DIR` override
- `DATABASE_SQLITE_PATH` override
- legacy env vars are visible only through legacy import config
- old `storage/data/videos` is returned only by existing legacy runtime helpers or explicit legacy source config, not by the new primary storage config

Acceptance:

- the new primary storage config exposes `storage/db.sqlite`, `storage/videos`, and `storage/staging`
- current runtime behavior remains unchanged until the later migration/cutover tasks
- legacy auth/video metadata path variables are not consumed by the new primary storage config

### Task 2: Add primary SQLite adapter and migration runner

Files:

- create storage SQLite adapter files
- create migration runner
- create `0001_primary_storage.sql`
- update `package.json` with `storage:migrate:schema`
- add `scripts/storage-migrate-schema.ts`

Implementation:

- promote libsql adapter into storage module
- enable WAL and foreign keys
- add migration table
- run SQL migrations in order
- seed default content types and genres through migration or a deterministic post-migration seed transaction
- make migration idempotent

Tests:

- creates all primary tables
- second run is no-op
- foreign keys are enforced on a new connection
- constraints reject invalid statuses, duplicate tags, duplicate playlist videos, invalid positions, and invalid booleans

Acceptance:

- `bun run storage:migrate:schema` creates `storage/db.sqlite`
- direct repository bootstrap no longer owns schema creation

### Task 3: Move library metadata to normalized primary DB

Files:

- modify library SQLite repository and adapters
- add or update library repository tests
- update metadata seed helpers

Implementation:

- read/write `videos`
- read/write `tags` and `video_tags`
- read/write `video_genre_assignments`
- read `video_content_types` and `video_genres`
- derive `videoUrl` from `video.id`
- keep current `LibraryVideo` domain shape unchanged
- preserve existing search/filter behavior

Tests:

- create/update/delete video
- tags dedupe through normalized `tags`
- genres dedupe through join table
- content type FK rejects unknown active runtime values unless importer explicitly preserves them first
- sort order remains deterministic
- repository returns the same domain shape routes expect today

Acceptance:

- home/library composition can read from `DATABASE_SQLITE_PATH`
- tag and genre JSON columns are no longer used by runtime writes

### Task 4: Move auth sessions to primary DB

Files:

- modify `SqliteSessionRepository`
- modify `app/composition/server/auth.ts`
- add auth primary DB integration tests

Implementation:

- make auth repository use the storage-owned async SQLite adapter
- keep `AuthSessionRepository` port unchanged
- preserve `save`, `findById`, `touch`, and `revoke`
- keep cookie/session policy untouched

Tests:

- login creates session in primary DB
- session resolution reads primary DB
- logout revokes primary DB row
- expired/revoked behavior is unchanged
- `AUTH_SQLITE_PATH` is not used by runtime composition after cutover

Acceptance:

- auth runtime uses `DATABASE_SQLITE_PATH`
- old auth SQLite path remains import-only

### Task 5: Move playlists from JSON to SQLite

Files:

- create `app/modules/playlist/infrastructure/sqlite/sqlite-playlist.repository.ts`
- modify `app/composition/server/playlist.ts`
- add playlist SQLite repository tests

Implementation:

- implement `PlaylistRepositoryPort`
- store playlist metadata JSON only for flexible nested metadata
- store item order in `playlist_items`
- keep duplicate video prevention
- store DB positions zero-based
- map existing route/use-case response behavior unchanged

Tests:

- create/update/delete playlist
- owner name conflict
- add/remove/reorder videos
- duplicate video rejected
- position persistence is deterministic
- playlist detail resolves videos from primary DB

Acceptance:

- playlist runtime has no JSON write path
- JSON files remain import-only

### Task 6: Move ingest staging and media asset registration

Files:

- modify staged upload repository
- modify staged upload storage adapter
- modify commit use case only where needed for media asset registration
- add media asset repository or writer under ingest/storage infrastructure

Implementation:

- persist staged uploads in `ingest_uploads`
- store relative staging source paths
- write committed media to `storage/videos/:videoId`
- create/update `video_media_assets`
- keep current ingest status semantics
- keep current FFmpeg/Shaka preparation behavior
- keep staged upload retry/idempotency behavior

Tests:

- start upload writes `ingest_uploads`
- commit reserves video ID and writes video/media rows consistently
- commit failure restores `uploaded`
- successful commit deletes staged bytes
- new committed media uses `storage/videos/:videoId`
- no new committed media appears under `storage/data/videos`

Acceptance:

- ingest runtime uses the primary DB and new media layout
- DASH/ClearKey output shape stays unchanged under the new root

### Task 7: Move playback path/catalog resolution

Files:

- modify playback path resolver
- modify playback catalog adapter
- modify playlist video catalog adapter
- add playback primary storage tests

Implementation:

- resolve media paths from storage module
- read video catalog from primary DB
- keep manifest, segment, and ClearKey route response contracts unchanged
- during import implementation, allow compatibility reads only where explicitly needed by migration/integrity tooling, not by normal playback runtime after cutover

Tests:

- player video lookup reads normalized primary DB rows
- manifest/key/segment routes read from `storage/videos/:videoId`
- missing manifest/key/segments still map to existing error contracts

Acceptance:

- playback runtime does not depend on `storage/data/videos`

### Task 8: Implement legacy dry-run inventory

Files:

- create legacy inventory adapter
- create import report domain types
- add `scripts/storage-import-legacy.ts`

Implementation:

- read old video metadata SQLite
- read old auth SQLite
- read old playlist JSON files
- inspect old `storage/data/videos`
- inspect old `storage/data/staging`
- inspect target primary DB
- report conflicts and counts
- do not write DB/filesystem in dry-run

Tests:

- dry-run is read-only
- reports source/target paths
- reports counts
- reports unknown taxonomy
- reports committed staged rows to prune
- reports active staged rows
- reports missing media
- reports orphan dirs
- reports layout conflicts
- reports playlist conflicts
- reports planned copy counts/bytes

Acceptance:

- owner can run dry-run and understand exactly what apply would do

### Task 9: Implement legacy apply import

Files:

- create legacy importer adapter
- add filesystem copy/checkpoint helpers
- extend import CLI apply mode

Implementation:

- require offline/maintenance lock
- run schema migration before import
- block on conflicts that could lose data
- import auth sessions
- import library metadata
- normalize tags/genres/content types
- preserve unknown taxonomy as inactive
- import playlists and playlist items
- import staged uploads according to spec
- copy media only after checks
- verify copied files before cutover
- record checkpoints
- preserve old stores and old media

Tests:

- imports valid legacy dataset
- sort collisions repaired deterministically
- broken playlist references block
- playlist name conflicts block
- missing committed media blocks
- orphan media preserved and reported
- layout conflict blocks
- symlinks are unsafe and not followed
- failed copy can resume without duplicate rows

Acceptance:

- apply can migrate a realistic legacy workspace without deleting old data

### Task 10: Implement integrity verification

Files:

- create integrity use case/repository
- add `scripts/verify-data-integrity.ts`
- add integrity tests

Implementation:

- check primary DB rows
- check media directories
- check required DASH/ClearKey files
- check staging rows
- check orphan directories
- check unsafe paths
- check old layout leftovers separately from active-layout errors
- return deterministic findings with severity and remediation hint

Tests:

- clean dataset reports no blocking findings
- missing manifest/key/thumbnail/video/audio files reported
- ready DB row without files is reported
- orphan dirs reported
- committed upload mismatch reported
- expired staging rows reported
- symlink paths reported unsafe

Acceptance:

- `bun run verify:data-integrity` becomes the operational check before and after migration

### Task 11: Update runtime/E2E helpers and verification docs

Files:

- update test workspace helpers
- update smoke tests if path assumptions changed
- update docs if script names or runtime env names change during implementation

Implementation:

- seed primary DB in runtime tests
- copy playback fixtures into `storage/videos`
- remove old JSON seeding for runtime playlist tests after SQLite playlist repo is active
- keep hermetic fixture rules intact

Tests:

- existing smoke and E2E tests pass from an isolated workspace
- hermetic input guard still rejects repo-local `storage/` fixture coupling

Acceptance:

- test infrastructure no longer keeps old storage layout alive

### Task 12: Implement mandatory legacy source cleanup

Files:

- create `scripts/storage-cleanup-legacy.ts`
- create cleanup use case under `app/modules/storage/application/use-cases/cleanup-legacy-storage.usecase.ts`
- create cleanup filesystem adapter under `app/modules/storage/infrastructure/filesystem/legacy-storage-cleanup.adapter.ts`
- add cleanup tests under `tests/integration/storage/`

Implementation:

- provide dry-run and apply modes
- require a successful primary integrity report before apply
- require runtime config to point at `DATABASE_SQLITE_PATH`, `storage/videos`, and `storage/staging`
- require explicit owner approval before deletion
- delete only legacy paths listed by dry-run
- never follow symlinks
- support explicit retention entries when the owner intentionally keeps a legacy source
- run integrity verification after cleanup

Tests:

- dry-run lists legacy auth DB, video metadata DB, playlist JSON, old media dirs, old staging dirs, and old temp dirs
- apply refuses to run before integrity passes
- apply refuses to run while runtime still uses legacy paths
- apply refuses to run without explicit approval
- apply deletes only planned legacy paths
- symlinks are not traversed
- retained paths remain and are reported as retained
- cleanup is idempotent
- completion gate fails when legacy sources remain without retention

Acceptance:

- superseded legacy DBs, playlist JSON files, and old media directories are removed or explicitly retained
- a post-cleanup integrity report passes
- the storage-management project is not considered complete before this task passes

## 7. Rollout Order

Use this order to keep the project shippable:

1. Path/config contract and tests.
2. Primary DB adapter and schema migration.
3. Library normalized repository.
4. Auth primary DB repository.
5. Playlist SQLite repository.
6. Ingest staging/media assets/new media root.
7. Playback path/catalog update.
8. Legacy dry-run inventory.
9. Legacy apply import.
10. Integrity verification.
11. Runtime/E2E helper cleanup and final verification.
12. Mandatory legacy source cleanup after verified cutover.

Do not switch a runtime composition root until its replacement adapter has contract tests and integration tests.
Do not mark the storage-management project complete while superseded legacy DB/JSON/media sources remain without an explicit retention decision.

## 8. Verification Plan

For each task:

- run the focused test file first
- run the affected integration project when available
- run `bun run lint`
- run `bun run typecheck`

Before handoff of the full implementation:

- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `bun run build`
- `bun run verify:e2e-smoke`
- `bun run verify:ci-faithful:docker` or `bun run verify:ci-worktree:docker`

Because this change touches storage, route composition, auth, playback, and browser-visible upload/playback flows, Docker CI-like verification and browser smoke are required before implementation is considered complete.

## 9. Risks and Mitigations

### Risk: migration code becomes more dangerous than the old layout

Mitigation:

- dry-run first
- apply requires lock
- no destructive cleanup during import apply
- destructive cleanup only in the mandatory final cleanup phase after integrity and owner approval
- checkpoint file copies
- block conflicts instead of guessing

### Risk: one DB adapter rewrite creates broad regressions

Mitigation:

- promote the existing libsql adapter pattern instead of inventing a new one
- keep application ports stable
- switch one bounded context at a time
- use composition tests as cutover gates

### Risk: normalized metadata changes route-visible behavior

Mitigation:

- keep domain shapes unchanged
- add repository contract tests around tags, genres, content type, sort order, and search
- update route integration tests before switching composition

### Risk: filesystem and DB diverge

Mitigation:

- store relative paths
- record media assets explicitly
- add integrity command
- treat DB `ready` and filesystem playability as separate facts

### Risk: old path assumptions survive in tests

Mitigation:

- update runtime workspace helpers early
- add `rg` checks for `storage/data/videos`, `video-metadata.sqlite`, `auth.sqlite`, `playlists.json`, and `playlist-items.json`
- allow old paths only in legacy import tests and docs

## 10. Out of Scope For The First Migration Apply

The first migration apply must not include:

- backup/restore automation
- cloud/object storage
- multi-user authorization
- playlist UI redesign
- playback packaging redesign
- storage cleanup UI

Deleting old legacy DBs, playlist JSON files, and old media directories is intentionally excluded from the first migration apply, but it is included as Task 12 and is required before the storage-management project is complete. The exclusion is about ordering and safety, not about making cleanup optional.

## 11. Human Review Gates

No owner decision is currently blocking implementation.

The following are deliberate later decisions, not blockers for the first migration apply:

- when to add backup/restore automation
- whether to expose integrity findings in the UI
- exactly when to run the mandatory cleanup after cutover verification
- which legacy paths, if any, the owner explicitly retains instead of deleting
