# Storage Cutover and Demo Seed Plan

**Goal:** Finish the storage rearchitecture by removing legacy storage datasets and one-time migration paths, then provide a small reproducible demo seed for new developer setups.

**Decision:** Legacy local data is test data, not production data that must be fully recovered. Missing legacy media directories should not block the final architecture. The project should keep only the new primary storage model and generate demo data from small source fixtures.

**Non-negotiable constraint:** Do not delete `playtime` test media. It may remain available for heavier test scenarios, but it must not be used as the default demo seed.

## Target Runtime Model

Runtime storage must use only:

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
```

The app must not read runtime data from:

```text
storage/data/auth.sqlite
storage/data/video-metadata.sqlite
storage/data/playlists.json
storage/data/playlist-items.json
storage/data/videos/
storage/data/staging/
```

## Success Conditions

- Existing legacy runtime datasets under `storage/data/*` are no longer required for normal development.
- New developer setup can create demo data without copying old local storage.
- Demo data uses a tiny fixture suitable for git and fast local setup.
- `playtime` and other larger test media are preserved for tests, not used as default demo seed.
- Runtime code no longer supports legacy DB or JSON storage paths.
- Runtime config no longer uses `AUTH_SQLITE_PATH` or `VIDEO_METADATA_SQLITE_PATH`.
- One-time migration/import/cleanup scripts are removed after they are no longer needed.
- Legacy compatibility tests are removed or rewritten as new-primary-storage tests.
- Generated data remains generated: `storage/db.sqlite`, `storage/videos/*`, and `storage/staging/*` are not committed.
- Final verification passes with the new storage model only:
  - `bun run verify:base`
  - `bun run verify:ci-worktree:docker`
  - Playwright MCP browser QA for login, seeded library display, tag filtering, playback, protected DASH requests, and data integrity.
  - Subagent review finds no blocking issues.

## Demo Seed Strategy

Demo seed is for humans opening the app locally, not for preserving old datasets.

The seed path should:

1. Start from an extremely small source video fixture.
2. Create or migrate `storage/db.sqlite` using the primary schema.
3. Produce generated media under `storage/videos/:videoId`.
4. Insert canonical video metadata, taxonomy assignments, tags, and ready media asset rows.
5. Be idempotent enough for local development.
6. Fail loudly on broken generated output instead of hiding partial data.

The preferred implementation is a script:

```text
scripts/seed-demo-storage.ts
```

with package script:

```text
bun run storage:seed-demo
```

The seed script should generate a tiny source MP4 with FFmpeg lavfi, then run the same ingest/media-preparation path used by browser uploads. This keeps the demo realistic without committing generated DB or DASH output.

Recommended source generation:

```text
testsrc=size=160x90:rate=15:duration=1
sine=frequency=440:duration=1
H.264 + AAC, yuv420p, +faststart
```

This mirrors the existing hermetic ingest media fixture strategy while keeping the demo source reproducible and small.

## Test Fixture Strategy

Use two classes of media fixtures:

- **Demo fixture:** tiny, git-safe, fast, used by `storage:seed-demo`.
- **Test fixture:** may be larger, used by targeted tests and media QA only.

`tests/fixtures/upload/smoke-upload.mp4` is currently 25 KB and remains useful for browser upload smoke tests. The demo seed should prefer reproducible FFmpeg generation over treating that checked-in file as the canonical demo source. Existing playback fixtures are much larger and should not become the default demo seed source.

`playtime` media must not be deleted. If it is too large for git or routine CI, keep it as an optional/heavier test fixture path rather than a default local seed.

## Removal Scope

Remove or rewrite:

- `scripts/storage-import-legacy.ts`
- `scripts/storage-cleanup-legacy.ts`
- legacy migration/import/cleanup package scripts
- `getLegacyStorageSourceConfig`
- runtime fallback to `storage/data/*`
- legacy JSON playlist storage paths if no runtime or tests use them
- tests whose only purpose is to prove legacy import/cleanup behavior
- docs that present legacy import as current workflow

Keep:

- primary schema migration code needed for `storage/db.sqlite`
- data integrity verification code if it checks the new primary model
- primary SQLite repositories and adapters
- tests that prove the new storage model is correct

## Implementation Order

1. Add tests for the demo seed script contract.
2. Implement the smallest demo seed path that creates a playable primary-storage demo dataset.
3. Verify a fresh `storage/` generated by the seed shows demo content in `bun dev`.
4. Remove legacy import/cleanup scripts and package scripts.
5. Remove legacy storage config and runtime references.
6. Rewrite or delete legacy-only tests.
7. Run targeted tests after each removal cluster.
8. Run full verification and browser QA.
9. Run subagent review for data integrity, runtime architecture, and test coverage.

## Risks

- Removing legacy tests too aggressively could hide coverage for primary schema behavior. Replace behavior-level coverage before deleting implementation-specific legacy tests.
- Demo seed should not commit generated DB or media output.
- Playback QA needs `AUTH_SHARED_PASSWORD`, `VIDEO_MASTER_ENCRYPTION_SEED`, and `VIDEO_JWT_SECRET`.
- If seed uses the full ingest pipeline, it may require FFmpeg/Shaka binaries. This is acceptable for realistic demo generation but less ideal for quick onboarding unless the script documents prerequisites or downloads tools.
