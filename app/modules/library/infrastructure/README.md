# Library Infrastructure

This directory now contains the SQLite-backed canonical video metadata store.

The current compatibility shape is:

- durable video metadata lives in SQLite under `app/modules/library/infrastructure/sqlite`
- `app/legacy/repositories/SqliteVideoRepository.ts` adapts that store to the
  existing `VideoRepository` interface so legacy update/delete/playback flows
  keep using the same source of truth
- `app/composition/server/canonical-video-metadata-legacy-store.ts` still
  depends on `getVideoRepository()`, but that repository is no longer the JSON
  implementation

`videos.json` is now a bootstrap input for migration compatibility, not the
canonical metadata source of truth.
