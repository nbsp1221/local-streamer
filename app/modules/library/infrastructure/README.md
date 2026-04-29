# Library Infrastructure

This directory now contains the active SQLite-backed canonical video metadata infrastructure.

The current runtime shape is:

- durable video metadata lives in SQLite under
  `app/modules/library/infrastructure/sqlite`
- local file persistence uses the primary storage SQLite adapter under
  `app/modules/storage/infrastructure/sqlite`
- active composition now depends on library-owned adapters:
  - `sqlite-canonical-video-metadata.adapter.ts`
  - `sqlite-library-video-mutation.adapter.ts`
  - `storage/filesystem-library-video-artifact-removal.adapter.ts`

SQLite is the only runtime source of canonical video metadata.
