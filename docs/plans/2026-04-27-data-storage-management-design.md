# Data Storage Management Design

Status: Historical pre-cutover design
Last reviewed: 2026-04-30
Date: 2026-04-27
Owner: Codex planning pass
Scope: Define the long-term data and media storage model for Local Streamer before operating on durable personal video data.

Review state: Updated after third-party read-only review and owner decisions on 2026-04-28.

> This document predates the accepted primary SQLite cutover.
> Use it as design history only. Current storage runtime contracts live in
> `docs/current-runtime-documentation-spec.md` and
> `docs/roadmap/current-refactor-status.md`.

## 1. Summary

Local Streamer should keep using SQLite. A server-managed RDBMS would add operational cost that does not match this personal video vault.

The storage model should become simpler and more explicit:

- one primary SQLite database for durable application state
- filesystem storage for large media artifacts
- versioned schema migrations instead of ad hoc `CREATE TABLE IF NOT EXISTS` drift
- explicit media asset records that describe what exists on disk
- integrity commands that prove the database and media directory agree
- a mandatory final cleanup phase that removes superseded legacy stores after verified cutover
- a future backup contract, intentionally deferred from the first implementation

The goal is not to over-engineer the project. The goal is to avoid expensive future rewrites after real videos have accumulated.

The most important design decision is that the project should define its durable data boundaries now:

- one SQLite database owns durable relational state
- `storage/videos/:videoId` owns committed media bytes
- `storage/staging/*` owns upload state before commit
- tags, genres, and content type/category are normalized as database data, not stored as ad hoc JSON arrays

## 2. Problem

The current project works, but durable state is split across several surfaces:

- `storage/data/auth.sqlite`
- `storage/data/video-metadata.sqlite`
- `storage/data/playlists.json`
- `storage/data/playlist-items.json`
- `storage/data/videos/:videoId/*`

This split was acceptable during the rearchitecture, but it creates long-term migration risk:

- there is no single system of record for application data
- playlists are outside SQLite and cannot use relational constraints
- media artifact completeness is inferred from files on disk rather than recorded in the database
- schema evolution is handled by table creation and narrow column repair, not ordered migrations
- backup and restore are not defined yet for future operation
- orphaned DB rows and orphaned media directories are possible

The owner is most concerned about future migration cost. This design treats that as the primary risk.

## 3. Goals

- Keep SQLite as the only database technology.
- Consolidate durable relational application state into one primary SQLite file.
- Keep large video/audio/media files on the filesystem.
- Make the database the authoritative catalog of videos, playlists, ingest state, and media artifact metadata.
- Make the filesystem layout deterministic from stable IDs.
- Track media layout versions so future repackaging or migration can target specific cohorts.
- Introduce explicit migration versioning before more durable data accumulates.
- Add integrity checks that detect DB/filesystem drift.
- Make legacy DB/JSON/media cleanup a required final phase after verified migration and cutover.
- Define the future backup and restore contract without implementing it in the first storage migration pass.

## 4. Non-Goals

- Introduce PostgreSQL, MySQL, hosted database services, or a separate DB server.
- Store full video files or DASH segments as SQLite BLOBs.
- Build enterprise-grade media asset management.
- Build multi-user authorization or sharing.
- Add cloud object storage in the first pass.
- Preserve all historical test artifacts in the current local `storage/` directory.
- Create a generic migration framework for other projects.

## 5. External Facts Used

This design relies on these facts from SQLite documentation and media-storage practice:

- SQLite is suitable as an application file format with many tables, constraints, indexes, and cross-references in one file. See [SQLite as an application file format](https://www.sqlite.org/appfileformat.html).
- SQLite's own BLOB guidance suggests small BLOBs can work well in SQLite, but larger BLOBs are often better as external files. Video segments are large media artifacts, so they should stay on the filesystem. See [SQLite internal versus external BLOBs](https://www.sqlite.org/intern-v-extern-blob.html).
- SQLite supports `UNIQUE`, `NOT NULL`, `CHECK`, and `FOREIGN KEY` constraints in `CREATE TABLE`. See [SQLite CREATE TABLE](https://www.sqlite.org/lang_createtable.html).
- SQLite foreign key enforcement must be enabled per connection with `PRAGMA foreign_keys = ON`. See [SQLite foreign key support](https://www.sqlite.org/foreignkeys.html).
- SQLite exposes database-level version metadata such as `user_version`; applications can also use their own schema migration table. See [SQLite database file format](https://www.sqlite.org/fileformat.html).
- Copying a live SQLite database file directly can be unsafe, especially with journals or WAL files. Safe backups should use the backup API, `VACUUM INTO`, or an equivalent safe process. See [SQLite backup API](https://www.sqlite.org/backup.html) and [How to corrupt an SQLite database](https://www.sqlite.org/howtocorrupt.html).

## 6. Pre-Cutover State Snapshot

### 6.1 Current Durable Stores

Current runtime state is distributed across these storage surfaces:

```text
storage/
  data/
    auth.sqlite
    video-metadata.sqlite
    playlists.json
    playlist-items.json
    videos/
      :videoId/
        manifest.mpd
        key.bin
        thumbnail.jpg
        video/
          init.mp4
          segment-0001.m4s
        audio/
          init.mp4
          segment-0001.m4s
    staging/
      :stagingId/
        uploaded-source-file
      temp/
        :temporaryUploadId/
```

### 6.2 Current SQLite Tables

`auth.sqlite` contains:

- `auth_sessions`

`video-metadata.sqlite` contains:

- `library_videos`
- `ingest_staged_uploads`
- `video_content_types`
- `video_genres`
- `video_metadata_bootstrap_state`
- historical local table: `library_video_metadata_state`

### 6.3 Current File Ownership

The current canonical media artifact directory is:

```text
storage/data/videos/:videoId/
  manifest.mpd
  key.bin
  thumbnail.jpg
  video/init.mp4
  video/segment-*.m4s
  audio/init.mp4
  audio/segment-*.m4s
```

This layout is a good basis. It should be kept conceptually, but the target namespace is simplified to `storage/videos/:videoId`.

### 6.4 Current Data Drift Observed Locally

The current local `storage/` directory contains test and historical artifacts. A read-only inspection found:

- `library_videos`: 22 rows
- `storage/data/videos`: 29 top-level video directories
- metadata rows with missing media directories
- media directories without matching metadata rows
- committed staged upload rows still present

This does not necessarily indicate production corruption because the local directory has been used for testing and migration work. It does show why an integrity checker is needed before treating the current storage directory as durable owner data.

## 7. Chosen Direction

Use one primary SQLite database as the application system of record, and use the filesystem for media bytes.

Target durable layout:

```text
storage/
  db.sqlite
  videos/
    :videoId/
      manifest.mpd
      key.bin
      thumbnail.jpg
      video/
        init.mp4
        segment-0001.m4s
      audio/
        init.mp4
        segment-0001.m4s
  staging/
    :stagingId/
      source
    temp/
      :requestId/
        uploaded-bytes
```

The database should store stable IDs, metadata, status, codec facts, and relative paths or layout versions. The filesystem should store large media files. The database should not store full video content as BLOBs.

Naming decisions:

- `storage/` remains the top-level runtime-owned directory because it naturally contains both durable and managed transient application files.
- `db.sqlite` is preferred over a project-name-specific filename. The enclosing directory already scopes the file, and the shorter name avoids future product rename churn.
- `videos/` is directly under `storage/`; a `media/videos/` layer is not needed until the product has more first-class media types.
- `staging/` remains under `storage/` because staged uploads are managed application state, not arbitrary scratch files.
- `staging/temp/` is request-scoped upload scratch used before a file is promoted into a staged upload. There is no separate top-level `storage/tmp/` contract in this design.

Closed review decisions:

- Use one primary SQLite database for auth sessions, videos, ingest state, playlists, taxonomy, and media asset records.
- Use `DATABASE_SQLITE_PATH` as the new canonical database path override. Existing `AUTH_SQLITE_PATH` and `VIDEO_METADATA_SQLITE_PATH` are legacy migration inputs, not long-term runtime configuration.
- Keep `reserved_video_id` as a reservation value without a foreign key; add a separate `committed_video_id` foreign key after the video row exists.
- Allow `video_media_assets` path columns to be nullable until the asset reaches `ready`.
- Preserve current case-insensitive playlist name uniqueness with an explicit normalized name column.
- Treat `storage/videos/:videoId` as the target layout, but require a compatibility resolver and tested copy/verify/cutover migration before moving existing `storage/data/videos/:videoId` artifacts.
- Prune committed legacy staged upload rows during migration unless an active row still needs retry support.
- Do not implement backup in the first storage migration pass. Backup remains a later operational feature.
- When backup is implemented later, require a backup/maintenance lock before snapshotting SQLite and media files together.
- Normalize tags, genres, and content type/category in the first storage migration because these are shared catalog values where duplicates should be impossible by database constraint.
- Keep string canonicalization at the domain boundary: values such as `ABC`, `aBC`, and `abc` normalize to the same slug before insertion, and relational primary keys prevent duplicate assignments such as `#abc, #abc`.

## 8. Data Ownership Rules

- The SQLite database is the source of truth for videos, playlists, ingest state, sessions, taxonomy, and media asset records.
- The media filesystem is the source of truth for large bytes only.
- A playable video requires both a committed video row and a complete media asset record.
- A media directory without a database row is an orphan.
- A committed database row without required media files is an integrity error.
- Application code should compute canonical media paths from `videoId` and layout version instead of storing absolute paths.
- Absolute host paths should not be stored in long-lived database rows unless they point to temporary staging files.
- All durable data changes must be expressible as migrations.
- Durable IDs and persisted relative paths must reject absolute paths, path traversal, and path separators at the domain/repository boundary. Schema-level `CHECK`s should enforce the subset that SQLite can express clearly.

## 9. Proposed SQLite Schema Shape

This is a design-level schema, not the final migration SQL.

Target migrations should use SQLite `STRICT` tables where supported by the runtime database driver. If a target runtime cannot use `STRICT`, migrations should add explicit `CHECK (typeof(...) = ...)` constraints for durable scalar columns that must not rely on SQLite affinity.

### 9.1 `videos`

Primary owner-facing video record.

```sql
CREATE TABLE videos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description TEXT,
  duration_seconds REAL NOT NULL CHECK (duration_seconds >= 0),
  content_type_slug TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sort_index INTEGER NOT NULL UNIQUE,
  FOREIGN KEY (content_type_slug)
    REFERENCES video_content_types(slug)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);
```

Notes:

- This replaces or evolves the current `library_videos` table.
- `video_url` and `thumbnail_url` should not need to be persisted if they are deterministic from `videoId`.
- `duration` should use a clear unit in the column name.
- Tags and genres are intentionally excluded from this table. They live in join tables so duplicate assignments are impossible and future filtering/rename behavior does not require rewriting JSON arrays.
- Content type/category rows should not be deleted to change availability. They should be marked inactive. This prevents silent loss of existing video classification.

### 9.2 `video_media_assets`

Playback artifact record for a video.

```sql
CREATE TABLE video_media_assets (
  video_id TEXT PRIMARY KEY,
  layout_version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('preparing', 'ready', 'failed')),
  preparation_strategy TEXT NOT NULL,
  source_filename TEXT,
  source_container TEXT,
  source_video_codec TEXT,
  source_audio_codec TEXT,
  output_video_codec TEXT,
  output_audio_codec TEXT,
  manifest_relpath TEXT,
  key_relpath TEXT,
  thumbnail_relpath TEXT,
  prepared_at TEXT,
  failed_at TEXT,
  failure_message TEXT,
  CHECK (
    status != 'ready'
    OR (
      manifest_relpath IS NOT NULL
      AND key_relpath IS NOT NULL
      AND thumbnail_relpath IS NOT NULL
      AND prepared_at IS NOT NULL
    )
  ),
  CHECK (
    status != 'failed'
    OR failed_at IS NOT NULL
  ),
  FOREIGN KEY (video_id)
    REFERENCES videos(id)
    ON DELETE CASCADE
);
```

Notes:

- This table is the bridge between metadata and files.
- `layout_version` makes future media directory changes tractable.
- Codec facts should be limited to values already produced by the current media preparation pipeline. Do not add speculative codec or repackaging analytics in this storage migration.
- Paths are nullable while media is `preparing` or `failed`; they become required only when the asset is `ready`.
- Database `ready` means the preparation pipeline recorded a completed media asset. It is not, by itself, proof that every file still exists on disk. Playability requires both a `ready` media asset row and the filesystem checks defined in the integrity contract.

### 9.3 `ingest_uploads`

Staged upload and commit lifecycle.

```sql
CREATE TABLE ingest_uploads (
  staging_id TEXT PRIMARY KEY,
  reserved_video_id TEXT UNIQUE,
  committed_video_id TEXT UNIQUE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  storage_relpath TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('uploading', 'uploaded', 'committing', 'committed', 'failed', 'expired')
  ),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  committed_at TEXT,
  failure_message TEXT,
  CHECK (
    status != 'committed'
    OR (committed_video_id IS NOT NULL AND committed_at IS NOT NULL)
  ),
  CHECK (
    status != 'failed'
    OR failure_message IS NOT NULL
  ),
  CHECK (
    status != 'expired'
    OR committed_video_id IS NULL
  ),
  FOREIGN KEY (committed_video_id)
    REFERENCES videos(id)
    ON DELETE RESTRICT
);
```

Notes:

- This evolves current `ingest_staged_uploads`.
- `reserved_video_id` intentionally has no foreign key because the upload flow reserves a future video ID before a durable video row exists.
- `committed_video_id` is the relational link after the video row exists.
- Committed uploads restrict referenced video deletion because `ON DELETE SET NULL` would contradict the committed-row invariant. Cleanup/import logic may explicitly prune obsolete operational rows, but the database should not silently detach a committed upload from its video.
- Legacy committed staged rows should be pruned during migration by default. These rows are operational retry state, not durable audit history. Active uploaded or committing rows may be migrated if their staged source file still exists.
- Temporary files should remain in filesystem staging; DB stores only stable relative paths.

### 9.4 Tags, Genres, And Content Type

The first implementation should normalize tags, genre assignments, and content type/category instead of keeping them as JSON arrays.

This is database normalization, not only text normalization. Text normalization still happens first in the domain layer, where raw values are canonicalized into stable slugs. Database normalization then stores shared values once and uses join tables to prevent duplicate assignments.

```sql
CREATE TABLE video_content_types (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  active INTEGER NOT NULL CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL
);

CREATE TABLE video_genres (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  active INTEGER NOT NULL CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL
);

CREATE TABLE tags (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE video_tags (
  video_id TEXT NOT NULL,
  tag_slug TEXT NOT NULL,
  PRIMARY KEY (video_id, tag_slug),
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_slug) REFERENCES tags(slug) ON DELETE CASCADE
);

CREATE TABLE video_genre_assignments (
  video_id TEXT NOT NULL,
  genre_slug TEXT NOT NULL,
  PRIMARY KEY (video_id, genre_slug),
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  FOREIGN KEY (genre_slug) REFERENCES video_genres(slug) ON DELETE RESTRICT
);
```

Notes:

- `video_content_types` represents the category-like one-to-one classification currently exposed as `contentTypeSlug`.
- `video_genres` is a controlled vocabulary, and `video_genre_assignments` is the many-to-many relationship between videos and genres.
- `tags` stores user-created tag slugs once, and `video_tags` is the many-to-many relationship between videos and tags.
- `PRIMARY KEY (video_id, tag_slug)` prevents assigning the same tag to the same video twice.
- `PRIMARY KEY (video_id, genre_slug)` prevents assigning the same genre to the same video twice.
- Insert or update flows must normalize slugs before database writes and then upsert shared rows or validate vocabulary references inside the same transaction.
- Existing legacy `tags_json` values should be migrated into `tags` and `video_tags` after applying the current tag normalizer and de-duplicating per video.
- Existing legacy `genre_slugs_json` values should be migrated into `video_genre_assignments` after applying the current taxonomy normalizer and de-duplicating per video.
- If a legacy content type or genre slug is not present in the bootstrap vocabulary, the migration should preserve it by creating an inactive vocabulary row and reporting it in the migration summary. This avoids silent data loss while keeping the target schema relational.

### 9.5 Playlists

Playlists should move from JSON into SQLite.

```sql
CREATE TABLE playlists (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  is_public INTEGER NOT NULL CHECK (is_public IN (0, 1)),
  thumbnail_url TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (owner_id, name_normalized)
);

CREATE TABLE playlist_items (
  playlist_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  added_at TEXT NOT NULL,
  added_by TEXT NOT NULL,
  episode_metadata_json TEXT,
  PRIMARY KEY (playlist_id, video_id),
  UNIQUE (playlist_id, position),
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);
```

Notes:

- This removes dangling video references after video deletion.
- `position` is zero-based to match the current playlist mutation contract. `position` uniqueness makes reorder behavior explicit.
- `name_normalized` preserves the current case-insensitive duplicate-name behavior during the JSON-to-SQLite migration.
- `owner_id`, `is_public`, and `added_by` preserve the current playlist data shape. The storage migration must not introduce new sharing, ACL, or multi-user product behavior.
- The same video remains forbidden from appearing twice in one playlist. This matches the current use-case contract and is enforced by `PRIMARY KEY (playlist_id, video_id)`.

### 9.6 Auth Sessions

Auth sessions should live in the same SQLite database.

```sql
CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip_address TEXT,
  is_revoked INTEGER NOT NULL DEFAULT 0 CHECK (is_revoked IN (0, 1)),
  last_accessed_at TEXT NOT NULL,
  user_agent TEXT
);
```

Notes:

- Combining auth sessions into the primary database simplifies backup.
- The target runtime should not keep a separate `auth.sqlite`.
- Existing `AUTH_SQLITE_PATH` remains only as a legacy migration input during transition.

### 9.7 Required Indexes

The schema should add explicit indexes for read paths that are not already covered by primary keys or unique constraints.

```sql
CREATE INDEX idx_videos_content_type_slug
  ON videos(content_type_slug);

CREATE INDEX idx_video_tags_tag_slug
  ON video_tags(tag_slug);

CREATE INDEX idx_video_genre_assignments_genre_slug
  ON video_genre_assignments(genre_slug);

CREATE INDEX idx_playlist_items_video_id
  ON playlist_items(video_id);

CREATE INDEX idx_ingest_uploads_status_expires_at
  ON ingest_uploads(status, expires_at);
```

Notes:

- These indexes support library filtering, reverse tag/genre lookup, video deletion checks, and staged-upload cleanup.
- Do not add broad indexes speculatively. Add new indexes when a concrete query path exists.

### 9.8 Runtime Database Configuration

The target runtime uses one canonical SQLite path:

```text
DATABASE_SQLITE_PATH
```

Resolution rules:

1. If `DATABASE_SQLITE_PATH` is set, use it.
2. Otherwise use `storage/db.sqlite`.
3. Treat `AUTH_SQLITE_PATH` and `VIDEO_METADATA_SQLITE_PATH` as legacy source paths for migration tooling only.
4. After migration, runtime startup should fail fast if legacy DB path variables are set in a way that conflicts with `DATABASE_SQLITE_PATH`.

This keeps the long-term runtime simple while still giving migration code enough information to import existing data safely.

## 10. Migration Model

The project should stop relying on implicit schema repair as the long-term strategy.

Recommended schema migration model:

```text
app/modules/storage/infrastructure/sqlite/migrations/
  0001_initial.sql
```

Use either:

- `PRAGMA user_version`, or
- a `schema_migrations` table

Preferred first pass:

```sql
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
```

Migration rules:

- Apply migrations in a transaction when SQLite allows it.
- Avoid destructive migrations unless they are explicitly approved owner decisions or a backup/safety strategy exists.
- Never mutate `sqlite_schema` directly.
- Do not rely on startup code silently creating divergent schemas.
- Keep migration files checked into git.
- Add tests that build a database from scratch and upgrade a fixture old schema.
- Enable `PRAGMA foreign_keys = ON` for every SQLite connection.

Legacy import is not a SQL migration. It spans old SQLite databases, JSON playlist files, and filesystem media artifacts, so it should be implemented as a TypeScript command with explicit dry-run and apply modes.

Proposed commands:

```bash
bun run storage:migrate:schema
bun run storage:import-legacy -- --dry-run
bun run storage:import-legacy -- --apply
```

Dry-run must be read-only and report:

- source auth/video metadata database paths
- source playlist JSON paths
- target `storage/db.sqlite` path
- target `storage/videos` path
- counts for auth sessions, videos, tags, genres, playlists, playlist items, staged uploads, and media directories
- unknown taxonomy values that would become inactive vocabulary rows
- committed staged upload rows that would be pruned
- active staged uploads that can or cannot be migrated
- media rows missing directories
- orphan media directories
- old/new media layout conflicts
- playlist conflicts and broken playlist item references
- estimated file copy count and byte count
- blocking findings that prevent apply mode

Apply mode rules:

- The app must be offline or protected by a maintenance lock before apply begins.
- While apply is running, ingest commits, video deletion, staged-upload reaping, playlist mutations, and media layout migration must be rejected or paused.
- Apply must not delete legacy databases, playlist JSON, or old media directories in the first implementation.
- Schema migration must complete before legacy import.
- Legacy import should write a migration journal or checkpoint records for filesystem copy/cutover steps that cannot be rolled back by SQLite transactions.
- Old media layout remains authoritative until the target copy is verified and the cutover is recorded.
- Filesystem copy should be idempotent and verify at least file existence, size, and relative path set before cutover.
- If a copied media directory conflicts with an existing target directory, apply mode must block for that video rather than choosing a winner.
- Rows for committed videos with missing required media directories block apply mode because importing them as playable would be unsafe.
- Orphan media directories are reported and preserved in place; they do not block apply mode unless they conflict with a target committed video.
- Legacy sort order collisions should be repaired deterministically by sorting by legacy `sort_index`, then `created_at`, then `id`, assigning new unique `sort_index` values, and reporting the repair.
- Existing auth sessions should be imported so active browser sessions can continue when possible.

## 11. Media Filesystem Layout Contract

The media layout should be deterministic and versioned.

V1 layout:

```text
storage/videos/:videoId/
  manifest.mpd
  key.bin
  thumbnail.jpg
  video/
    init.mp4
    segment-0001.m4s
  audio/
    init.mp4
    segment-0001.m4s
```

Rules:

- `:videoId` is the only directory key.
- The app should not store host-specific absolute paths for committed media.
- Temporary intermediates must not remain in a ready media directory.
- A ready media asset must have at least:
  - manifest
  - key
  - thumbnail
  - video init segment
  - one video media segment
  - audio init segment
  - one audio media segment
- Future layout changes must increment `video_media_assets.layout_version`.

## 12. Integrity Check Contract

Add a read-only integrity command before data cleanup commands.

Proposed command:

```bash
bun run verify:data-integrity
```

Checks:

- SQLite `PRAGMA integrity_check`
- SQLite `PRAGMA foreign_key_check`
- every ready `video_media_assets` row has required files
- every media directory has a matching video row or is reported as orphaned
- every tag assignment references an existing tag and has no duplicate assignment for the same video
- every genre assignment references an existing genre and has no duplicate assignment for the same video
- every video `content_type_slug`, when set, references an existing content type
- every playlist item references an existing playlist and video
- every committed ingest upload has a committed video or is reported as inconsistent
- no temporary intermediate media files remain in ready directories
- no expired non-committed staged upload remains without being reported

The first version should only report. A later cleanup command must perform owner-approved cleanup after migration, cutover, and integrity checks are proven. This is not optional project polish; the full storage-management effort is incomplete until superseded legacy DBs, playlist JSON files, and old media directories are either removed or explicitly retained by a documented owner decision.

## 13. Backup And Restore Contract

Backups are not part of the first storage migration implementation.

When implemented later, backups must treat SQLite and media files as one logical dataset. They must not copy a live WAL-mode SQLite database file as the only backup method. They should use SQLite backup API, `VACUUM INTO`, or an equivalent safe database snapshot, and they should hold a maintenance lock while snapshotting the database and media directory.

The first storage migration should avoid requiring a full backup feature by preserving legacy databases, playlist JSON, and old media directories. Destructive cleanup of old storage belongs in a later owner-approved command, but that command is a required final phase of this storage-management project. Preserving old data is a safety step during migration, not the final desired state.

## 14. Transition Strategy

This design should be implemented in phases.

### Phase 1: Document And Inspect

- Add this design.
- Add a read-only data inventory command.
- Add a read-only integrity report.
- Do not mutate current owner data.

### Phase 2: Migration Foundation

- Introduce the primary SQLite database path.
- Introduce migration runner and migration tests.
- Introduce `DATABASE_SQLITE_PATH` and legacy DB import path handling.
- Preserve current runtime behavior.

### Phase 3a: Consolidate Auth Sessions

- Move auth sessions into the primary DB.

### Phase 3b: Consolidate Library Metadata And Taxonomy

- Move videos into the primary DB.
- Move tags and genre assignments from JSON arrays into normalized tables.
- Keep content type/category as a foreign-keyed vocabulary reference.

### Phase 3c: Consolidate Playlists

- Move playlists from JSON into SQLite.

### Phase 3d: Add Media Asset Records

- Add media asset records.

### Phase 4: Storage Layout Cleanup

- Add a storage layout resolver that can read both `storage/data/videos/:videoId` and `storage/videos/:videoId` during migration.
- Migrate to `storage/videos/:videoId` with an explicit copy, verify, and cutover command.
- Run integrity checks before and after migration.

### Phase 5: Backup/Restore

- Add backup command after the storage migration foundation is stable.
- Add restore verification.
- Document operational runbook.

### Phase 6: Legacy Source Cleanup And Finalization

- Require a successful integrity report against the primary DB and `storage/videos`.
- Require the application runtime to use only `DATABASE_SQLITE_PATH`, `storage/videos`, and `storage/staging`.
- Require a cleanup dry-run that lists every legacy DB, JSON file, old media directory, old staging directory, and old temporary directory to remove.
- Require explicit owner approval before deletion.
- Delete or archive superseded legacy sources according to the approved cleanup plan.
- Run integrity checks after cleanup.

This phase is part of the success criteria. The storage-management project is not complete if legacy DBs, playlist JSON files, or old media directories remain as ambiguous runtime-looking sources without an explicit retention decision.

## 15. Open Questions

No open owner decisions remain for the first storage migration planning pass.

Closed owner decisions:

- Backup is out of scope for the first implementation and can be considered later.
- Old committed staged upload rows should be discarded during migration.
- Tags, genres, and content type/category should be normalized in the first storage migration because duplicate assignments and invalid references should be impossible at the database layer.
- Legacy import is a TypeScript dry-run/apply command, not SQL-only migration files.
- Runtime legacy DB path conflicts should fail fast after migration. Legacy path variables are accepted only by migration/import tooling.
- Storage migration apply mode must run offline or under a maintenance lock.
- Old media directories and legacy databases are preserved during the first migration; destructive cleanup is deferred only to the mandatory final cleanup phase, not removed from the project scope.
- Symlinks under committed media or staging paths are not followed during migration. They are reported as unsafe paths.
- Duplicate videos in one playlist remain forbidden, matching the current playlist use-case contract.
- Existing auth sessions are imported into the primary DB.
- Legacy sort index collisions are repaired deterministically and reported.

## 16. Recommended Decisions

Recommended first-pass decisions:

- Use one primary SQLite DB: `storage/db.sqlite`.
- Keep media bytes on the filesystem.
- Use `storage/videos/:videoId` as the target committed media layout.
- Keep `storage/staging/:stagingId` for uploaded but uncommitted files.
- Keep upload scratch under `storage/staging/temp/:requestId`; do not add a top-level `storage/tmp`.
- Use `DATABASE_SQLITE_PATH` as the new canonical DB override.
- Keep legacy DB path variables only as migration-source inputs.
- Use nullable `video_media_assets` paths with readiness checks instead of fake paths.
- Keep `reserved_video_id` FK-free and use `committed_video_id` for relational linkage.
- Preserve case-insensitive playlist names with `name_normalized`.
- Normalize tags, genres, and content type/category into relational tables in the first storage migration.
- Separate schema migrations from legacy data import commands.
- Require dry-run before apply for legacy import and storage layout migration.
- Require app-offline or maintenance-lock apply mode.
- Leave backup command implementation for a later phase.
- Treat legacy source cleanup as a required final phase, not optional future work.
- Add `video_media_assets` before any large new ingest behavior.
- Move playlists to SQLite before adding more playlist features.
- Add migration versioning before any further schema changes.
- Add read-only integrity reports before cleanup or migration commands.

This keeps the project simple while making future migrations deliberate and testable. It also prevents the migration from ending in a permanently ambiguous state where old and new storage layouts coexist indefinitely.
