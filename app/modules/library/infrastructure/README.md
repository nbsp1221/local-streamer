# Library Infrastructure

This directory now contains the active SQLite-backed canonical video metadata infrastructure.

The current compatibility shape is:

- durable video metadata lives in SQLite under
  `app/modules/library/infrastructure/sqlite`
- local file persistence uses the single `@libsql/client` adapter path in
  `libsql-video-metadata.database.ts`
- active composition now depends on library-owned adapters:
  - `sqlite-canonical-video-metadata.adapter.ts`
  - `sqlite-library-video-mutation.adapter.ts`
  - `storage/filesystem-library-video-artifact-removal.adapter.ts`
- `app/legacy/repositories/SqliteVideoRepository.ts` remains only as a
  compatibility consumer of the same canonical SQLite metadata source while
  `app/legacy` still exists

`videos.json` is now a bootstrap input for migration compatibility, not the
canonical metadata source of truth.
