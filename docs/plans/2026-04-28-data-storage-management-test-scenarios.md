# Data Storage Management Test Scenarios

Status: Superseded test scenario draft
Last reviewed: 2026-04-30
Date: 2026-04-28
Owner: Codex planning pass
Source spec: `docs/plans/2026-04-27-data-storage-management-design.md`

> This file contains useful storage-testing principles, but scenarios that require
> legacy import/apply/cleanup flows are superseded by the primary SQLite cutover and
> demo seed direction. Current storage confidence should focus on primary schema,
> demo seed, data integrity, and runtime wiring.

## 1. Purpose

This document defines the test scenarios required before implementing the data storage management design.

The owner intent is clear:

- tests are durable product assets, not afterthoughts
- tests should verify contracts and observable behavior, not incidental implementation details
- tests should cover realistic paths, edge cases, migration paths, and failure paths before runtime data is trusted
- unit tests alone are insufficient because this feature is mostly about database, filesystem, migration, and runtime wiring boundaries

The goal is to make future storage refactors rare, deliberate, and safe.

## 2. External Testing Practices Used

This test plan follows these practices:

- The Practical Test Pyramid recommends different test granularities, with many focused fast tests and fewer high-level tests. It specifically calls out databases and filesystems as integration boundaries that need integration tests. Source: [The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html).
- Vitest guidance recommends testing behavior over implementation details, using Arrange/Act/Assert structure, descriptive test names, one behavior per test, and explicit edge-case coverage. Source: [Vitest Testing in Practice](https://main.vitest.dev/guide/learn/testing-in-practice).
- Testing Library's guiding principle is that tests should resemble the way the software is used. This applies to browser-visible owner flows and supports using user-level route/UI tests only where they provide confidence beyond module tests. Source: [Testing Library Guiding Principles](https://testing-library.com/docs/guiding-principles/).
- SQLite exposes `PRAGMA integrity_check` and `PRAGMA foreign_key_check`, and foreign key enforcement must be enabled per connection. These are part of the storage integrity contract. Sources: [SQLite PRAGMA statements](https://www.sqlite.org/pragma.html) and [SQLite foreign key support](https://www.sqlite.org/foreignkeys.html).

## 3. Test Quality Rules

Every test added for this storage migration should follow these rules:

- Test public contracts: repository behavior, migration results, filesystem layout contracts, command outputs, route behavior, and user-visible outcomes.
- Do not test private helpers or incidental call order unless that order is itself a documented contract.
- Prefer real SQLite databases in temporary directories for persistence tests.
- Prefer real temporary filesystem trees for storage layout and integrity tests.
- Use mocks only for slow or non-deterministic boundaries that cannot be made local.
- Keep fixtures hermetic. Do not read ignored repo-local `storage/` as a test fixture.
- Use Arrange/Act/Assert shape, even when not explicitly commented.
- Use names that describe behavior, such as `rejects ready media assets without manifest path`, not `calls validateReadyAsset`.
- Keep one behavior per test. If a test name needs "and", split it unless the behavior is a single transaction contract.
- Verify failure paths with precise error/report codes, not only generic thrown errors.
- For implementation work, write the relevant test first and verify it fails for the expected reason before adding production code.

### 3.1 Environment Independence Rules

Storage-management tests must be hermetic. A test that only passes on one developer machine is a test bug.

- Do not depend on ambient `.env` files or shell-only environment values. Seed required env vars inside the test or through a test-local helper.
- Do not read or mutate the developer's repo-local `storage/` directory. Use `mkdtemp`/temporary workspaces for DB and filesystem tests.
- Do not assert host-specific absolute paths such as `/home/...` or `/tmp/...`. Assert storage-root-relative paths or normalize paths through the same resolver the application uses.
- Do not assert OS-specific path separators in persisted values. Durable persisted paths should use the documented relative path contract.
- Do not use the wall clock directly for expiry, cleanup, or migration ordering tests. Inject a fixed reference time.
- Do not rely on local timezone or locale. Runtime-sensitive verification should use explicit `TZ`, `LANG`, and `LC_ALL`, matching `docs/verification-contract.md`.
- Do not require locally installed FFmpeg, Shaka Packager, browser codecs, or browser profiles in unit/integration tests unless the test command explicitly provisions them. Storage tests should prefer small filesystem fixtures and mocked media-tool boundaries.
- Do not make HEVC/browser-codec playback a required CI assertion unless the verification command provisions a deterministic browser/runtime that supports it.
- Do not simulate permission failures solely with `chmod` when that behavior can differ under root, Docker, or non-POSIX filesystems. Prefer injected filesystem adapters for permission-denied branches, and reserve real permission tests for capability-guarded integration coverage.
- Do not create interactive tests. Owner approval flows must be tested through explicit flags, confirmation tokens, or injected confirmation providers.
- Do not rely on network access in tests. Required reusable fixtures must be checked in or generated deterministically inside a temporary workspace.
- If SQLite `STRICT` support differs by runtime, tests must verify the portable constraint contract first and only assert `STRICT` when the runtime capability is detected.

## 4. Test Layers

Scenario priority:

- P0 scenarios are required for the first implementation to be considered complete.
- P1 scenarios should be implemented before broad storage cleanup or destructive migration commands.
- P2 scenarios are backlog coverage that should be added when the related behavior changes.
- Final cleanup scenarios are required before the storage-management project can be called complete. First migration apply preserves legacy sources for safety, but cleanup is not optional long-term drift.
- The scenario tables below are a contract catalog, not a demand to implement every edge case before the first safe migration exists.

Minimum P0 slice:

- schema migration creates the target database and enforces core constraints
- legacy import dry-run reports counts, blocking findings, and planned file operations without mutation
- legacy import apply preserves old stores, runs offline or under maintenance lock, and blocks on data-loss risks
- taxonomy migration dedupes tags/genres and preserves unknown vocabulary as inactive rows
- auth sessions import into the primary DB
- playlist import preserves valid playlists and blocks broken references or case-insensitive name conflicts
- media asset records distinguish DB readiness from filesystem playability
- integrity command reports missing ready media, orphan directories, inconsistent committed uploads, unsafe paths, and expired staged uploads
- route/composition tests prove runtime uses `DATABASE_SQLITE_PATH`, not legacy DB paths

### 4.1 Domain Unit Tests

Location:

```text
app/modules/**/domain/*.test.ts
```

Purpose:

- Prove pure rules without touching SQLite or filesystem.
- Keep these tests fast and broad across edge cases.

Scenario catalog:

| ID | Contract | Scenarios |
| --- | --- | --- |
| DU-01 | Tag slug canonicalization remains stable | `ABC`, `aBC`, `abc` all become `abc`; whitespace becomes underscores; unsupported characters are removed; empty or symbol-only input is rejected. |
| DU-02 | Tag list normalization prevents duplicates | `['abc', 'ABC', '#abc']` produces one canonical tag when inputs normalize to the same slug. |
| DU-03 | Taxonomy slug normalization matches tag rules | content type and genre slugs normalize consistently with tag slugs. |
| DU-04 | Media layout resolver is deterministic | the same `videoId` and layout version always produce the same relative paths. |
| DU-05 | Media layout resolver rejects unsafe IDs | path traversal, empty IDs, absolute paths, and separator-containing IDs are rejected before filesystem access. |
| DU-06 | Ingest upload status transitions are explicit | allowed transitions pass; invalid transitions such as `committed -> uploading` fail. |
| DU-07 | Media asset readiness rule is stable | `ready` requires manifest, key, thumbnail, prepared timestamp, and required media segments; `preparing` and `failed` allow nullable paths where specified. |
| DU-08 | Playlist normalized names preserve duplicate policy | owner-specific playlist names normalize case-insensitively and reject same-owner duplicates while allowing different owners. |

Non-goal:

- Do not assert exact SQL, table creation strings, private helper names, or specific class decomposition.

### 4.2 SQLite Schema Contract Tests

Location:

```text
app/modules/storage/infrastructure/sqlite/*.test.ts
```

Purpose:

- Prove the database schema enforces the design contract even if application code has a bug.

Scenario catalog:

| ID | Contract | Scenarios |
| --- | --- | --- |
| DB-01 | A clean database initializes from migrations | empty temp database reaches the latest schema version and records all applied migrations exactly once. |
| DB-02 | Migrations are idempotent | running the migration runner twice leaves schema and migration rows unchanged. |
| DB-03 | Foreign keys are enforced per connection | a new connection rejects invalid FK inserts after initialization. |
| DB-04 | `videos.content_type_slug` references vocabulary | valid slug inserts; null inserts; unknown slug rejects unless migration-created inactive vocabulary row exists. |
| DB-05 | `video_tags` prevents duplicate assignments | same `(video_id, tag_slug)` cannot be inserted twice. |
| DB-06 | `video_genre_assignments` prevents duplicate assignments | same `(video_id, genre_slug)` cannot be inserted twice. |
| DB-07 | `video_tags` cascades on video deletion | deleting a video removes its tag assignments without deleting the shared tag row. |
| DB-08 | `video_genre_assignments` cascades on video deletion | deleting a video removes genre assignments without deleting the genre vocabulary row. |
| DB-09 | `video_genres` delete is restricted while assigned | assigned genre cannot be deleted silently. |
| DB-10 | `video_media_assets.ready` requires paths | `ready` without manifest/key/thumbnail/prepared timestamp is rejected. |
| DB-11 | `video_media_assets.failed` requires failure timestamp | failed asset without `failed_at` is rejected. |
| DB-12 | `video_media_assets.preparing` permits nullable paths | preparing rows can exist before files are created. |
| DB-13 | `ingest_uploads.reserved_video_id` has no FK | upload reservation can be stored before video row exists. |
| DB-14 | `ingest_uploads.committed_video_id` has FK | committed link rejects non-existent video IDs. |
| DB-15 | playlist names are case-insensitively unique per owner | `Movies` and `movies` conflict for the same owner and do not conflict across owners. |
| DB-16 | playlist items cannot dangle | playlist item insert rejects missing playlist or missing video. |
| DB-17 | required indexes exist for documented query paths | expected indexes are present via `PRAGMA index_list` or equivalent schema introspection. |
| DB-18 | SQLite integrity pragmas are clean after fixture operations | `PRAGMA integrity_check` returns clean and `PRAGMA foreign_key_check` returns no rows. |
| DB-19 | auth sessions live in the primary DB | valid sessions insert, expired/revoked sessions preserve their state, and session IDs remain unique. |
| DB-20 | playlist item positions are constrained | zero is accepted, negative positions are rejected, and duplicate positions within one playlist are rejected. |
| DB-21 | playlist item cascade behavior is explicit | deleting a playlist deletes its items; deleting a video deletes playlist items that reference that video. |
| DB-22 | unsafe durable paths are rejected | absolute paths, `..`, and separator-containing IDs or committed relative paths are rejected by schema or repository contract. |
| DB-23 | ingest upload status invariants are enforced | committed rows require `committed_video_id` and `committed_at`; failed rows require failure metadata; expired rows cannot point at a committed video. |
| DB-24 | vocabulary rows are not silently deleted | assigned content types and genres cannot be deleted to erase existing classifications; they must be marked inactive instead. |
| DB-25 | strict typing is enforced where supported | invalid SQLite-affinity values are rejected by `STRICT` tables or equivalent `typeof()` checks. |

Schema introspection is acceptable here because the schema is the product contract.

### 4.3 Legacy Migration Tests

Location:

```text
tests/integration/storage/
```

Purpose:

- Prove old runtime data can be imported into the new `storage/db.sqlite` model without silent loss or invalid references.

Fixture catalog:

| Fixture | Contents |
| --- | --- |
| LM-F01 empty legacy state | no auth DB, no metadata DB, no playlist JSON, no media dirs |
| LM-F02 normal legacy state | auth sessions, videos, tags JSON, genre JSON, content type, playlists, media dirs |
| LM-F03 duplicate taxonomy values | repeated tags and genres with case differences and invalid characters |
| LM-F04 unknown taxonomy values | content type or genre slug not in bootstrap vocabulary |
| LM-F05 drifted media state | video rows missing dirs and dirs without rows |
| LM-F06 staged uploads | committed rows, active uploaded rows with source file, active uploaded rows missing source file |
| LM-F07 playlist drift | playlist items referencing missing videos and duplicate playlist names by case |

Scenario catalog:

| ID | Contract | Scenarios |
| --- | --- | --- |
| LM-01 | Empty legacy state creates a valid empty target DB | target schema exists, migrations recorded, integrity checks pass. |
| LM-02 | Legacy import dry-run is read-only | dry-run reports source paths, target paths, counts, planned file copies, blocking findings, and does not mutate DB or filesystem. |
| LM-03 | Normal legacy videos import into `videos` | IDs, title, description, duration, timestamps, and content type are preserved. |
| LM-04 | Legacy sort collisions repair deterministically | duplicate or missing legacy sort indexes are renumbered by legacy `sort_index`, then `created_at`, then `id`, and the repair is reported. |
| LM-05 | Legacy `tags_json` imports into normalized tables | tags are canonicalized, inserted once, and assigned once per video. |
| LM-06 | Legacy duplicate tags collapse deterministically | `['abc', 'ABC', '#abc']` produces one tag assignment and reports deduplication. |
| LM-07 | Legacy `genre_slugs_json` imports into assignments | genre assignments are canonicalized, deduped, and FK-valid. |
| LM-08 | Unknown legacy genre is preserved as inactive vocabulary | assignment is preserved and migration summary reports the inactive vocabulary insertion. |
| LM-09 | Unknown legacy content type is preserved as inactive vocabulary | video keeps its content type and migration summary reports it. |
| LM-10 | Auth sessions import into the primary DB | valid, expired, and revoked sessions retain their behavior after runtime switches to `DATABASE_SQLITE_PATH`. |
| LM-11 | Committed staged upload rows are pruned | old committed staged rows do not remain in `ingest_uploads`. |
| LM-12 | Active staged rows with files are migrated | uploaded/committing rows remain retryable and use relative staging paths. |
| LM-13 | Active staged rows without files are reported | missing source files do not silently become valid retry state. |
| LM-14 | Playlist JSON imports into relational tables | playlist owner, public flag, `added_by`, metadata, and item order are preserved when references are valid. |
| LM-15 | Playlist item with missing video blocks apply-mode migration | dry-run reports the broken reference; apply mode fails before writing partial playlist data. |
| LM-16 | Case-insensitive playlist name conflicts block apply-mode migration | dry-run reports the conflict; apply mode fails until the owner resolves or explicitly prunes the conflict in a future cleanup command. |
| LM-17 | Committed video with missing media blocks apply-mode migration | dry-run reports the missing media; apply mode fails rather than importing a broken playable row. |
| LM-18 | Orphan media directories are preserved and reported | orphan directories are not deleted and do not block apply unless they conflict with a committed target video. |
| LM-19 | Old/new media layout conflicts block apply-mode migration | apply fails for conflicting target directories instead of selecting arbitrary data. |
| LM-20 | Symlinks are reported as unsafe paths | migration does not follow symlinks under committed media or staging paths. |
| LM-21 | Migration can resume after a failed attempt | transaction rollback plus filesystem copy journal prevents partially migrated state from being treated as complete. |
| LM-22 | Legacy path variables are migration inputs only | importer can read `AUTH_SQLITE_PATH` and `VIDEO_METADATA_SQLITE_PATH`; runtime configuration does not continue using them after migration. |

Decision:

- Migration apply mode must fail on playlist conflicts and missing playlist item video references. Silent playlist data loss is not allowed. A later cleanup command may add explicit owner-approved pruning, but that is outside the first migration contract.
- Migration apply mode must run while the app is offline or under a maintenance lock.
- Migration apply mode preserves legacy databases, playlist JSON, and old media directories. Destructive cleanup is a later owner-approved command, and that command is a required final phase before this storage-management effort is complete.

### 4.4 Repository And Use Case Integration Tests

Location:

```text
tests/integration/storage/
tests/integration/library/
tests/integration/ingest/
tests/integration/playlist/
```

Purpose:

- Prove application use cases behave correctly against real SQLite and temporary filesystem state.

Scenario catalog:

| ID | Contract | Scenarios |
| --- | --- | --- |
| RI-01 | Creating a video writes normalized taxonomy atomically | video row, tags, tag assignments, genre assignments, and content type are all committed together. |
| RI-02 | Failed taxonomy write rolls back the whole video creation | invalid genre/content type does not leave a partial video row. |
| RI-03 | Updating metadata replaces assignments intentionally | removing a tag or genre removes only that assignment and leaves shared vocabulary intact. |
| RI-04 | Updating tags dedupes through the same contract as create | mixed-case duplicate update results in one assignment. |
| RI-05 | Deleting a video cleans dependent DB rows | media asset, tag assignments, genre assignments, playlist items, and committed upload link behavior match schema contract. |
| RI-06 | Deleting a video removes or reports media directory according to use case contract | filesystem cleanup behavior is explicit and test-owned temp dirs prove it. |
| RI-07 | Commit staged upload is atomic | video metadata, media asset record, staged upload status, and files either all commit or all roll back/report consistently. |
| RI-08 | Commit recovery handles DB/filesystem mismatch | DB-committed/files-missing and files-present/DB-rolled-back states are reported by integrity checks and never exposed as playable. |
| RI-09 | Commit failure does not expose playable video | failed media preparation or missing artifacts cannot create a ready playable catalog entry. |
| RI-10 | Active staged upload cleanup respects expiry | expired uncommitted uploads are reported or removed according to cleanup command contract. |
| RI-11 | Runtime database path resolves consistently | default path is `storage/db.sqlite`; override path uses `DATABASE_SQLITE_PATH`; conflicting legacy env vars fail fast after migration. |

### 4.5 Filesystem Layout And Media Asset Tests

Location:

```text
tests/integration/storage/
tests/integration/playback/
tests/integration/ingest/
```

Purpose:

- Prove the database and media directory agree.

Scenario catalog:

| ID | Contract | Scenarios |
| --- | --- | --- |
| FS-01 | New committed media goes under `storage/videos/:videoId` | no new committed artifacts are written under `storage/data/videos`. |
| FS-02 | Resolver reads old and new layout during migration | old-only, new-only, and both-present cases resolve deterministically. |
| FS-03 | Both-present layout conflict is reported | conflicting old/new media dirs do not silently pick arbitrary data. |
| FS-04 | Copy/verify/cutover preserves ready assets | files are copied, checks verify required files, and old location is not deleted before verification. |
| FS-05 | Ready media asset with missing manifest is reported | DB row remains detectable as inconsistent. |
| FS-06 | Ready media asset with missing key is reported | encryption material absence is not silently ignored. |
| FS-07 | Ready media asset with missing thumbnail is reported | catalog display artifact absence is detected. |
| FS-08 | Ready media asset with no segments is reported | manifest/path presence alone is insufficient. |
| FS-09 | Ready media asset missing video init is reported | video init absence has a distinct finding code. |
| FS-10 | Ready media asset missing video segment is reported | video media segment absence has a distinct finding code. |
| FS-11 | Ready media asset missing audio init is reported | audio init absence has a distinct finding code. |
| FS-12 | Ready media asset missing audio segment is reported | audio media segment absence has a distinct finding code. |
| FS-13 | Preparing or failed media asset may have no committed files | integrity report distinguishes expected incomplete state from ready corruption. |
| FS-14 | Host-specific absolute paths are not persisted | committed rows store relative paths or derivable layout data only. |
| FS-15 | Symlinks are not followed as committed media | symlinked media or staging entries are reported as unsafe rather than traversed. |

### 4.6 Integrity Command Tests

Location:

```text
tests/integration/storage/
tests/smoke/
```

Purpose:

- Prove `bun run verify:data-integrity` or its underlying module can be trusted before cleanup or migration commands mutate data.

Required report contract:

```ts
interface DataIntegrityReport {
  ok: boolean;
  checkedAt: string;
  databasePath: string;
  storageRoot: string;
  findings: Array<{
    code: string;
    severity: 'error' | 'warning';
    message: string;
    subjectType: string;
    subjectId?: string;
    path?: string;
  }>;
}
```

Scenario catalog:

| ID | Contract | Scenarios |
| --- | --- | --- |
| IC-01 | Clean dataset reports `ok: true` | no findings for a complete database and filesystem. |
| IC-02 | SQLite corruption/check failure reports error | failed `integrity_check` produces machine-readable finding. |
| IC-03 | FK violation reports error | `foreign_key_check` rows become findings. |
| IC-04 | Orphan media dir reports warning or error | directory without video row is visible in report. |
| IC-05 | Missing ready media file reports error | each required file type has distinct finding code. |
| IC-06 | Duplicate assignment cannot exist through schema | attempts fail before integrity command; test documents DB as first defense. |
| IC-07 | Expired staged upload is reported | non-committed expired rows do not disappear silently in read-only mode. |
| IC-08 | Command is read-only | before/after database rows and filesystem tree are unchanged. |
| IC-09 | Report is deterministic enough for CI | findings sort by severity, code, subject type, subject id, and path. |
| IC-10 | Committed ingest upload without committed video is reported | inconsistent upload state has a machine-readable finding code. |
| IC-11 | Temporary intermediate files in ready directories are reported | ready media directories cannot contain leftover preparation files without a finding. |

### 4.7 Legacy Cleanup Command Tests

Location:

```text
tests/integration/storage/
tests/smoke/
```

Purpose:

- Prove the final cleanup phase can remove superseded legacy sources only after verified cutover and explicit owner approval.
- Prevent the project from silently keeping old DB/JSON/media stores as ambiguous runtime-looking sources forever.

Required scenarios:

| ID | Scenario | Contract |
| --- | --- | --- |
| LC-01 | Cleanup dry-run lists all legacy sources | reports old auth DB, old video metadata DB, playlist JSON, old media dirs, old staging dirs, and old temp dirs without deleting anything. |
| LC-02 | Cleanup refuses to run before successful primary integrity check | deletion is blocked when primary DB/media integrity is not proven. |
| LC-03 | Cleanup refuses to run while runtime still points at legacy paths | `AUTH_SQLITE_PATH`, `VIDEO_METADATA_SQLITE_PATH`, or old media runtime paths block cleanup unless used only as explicit cleanup inputs. |
| LC-04 | Cleanup requires explicit owner approval | apply mode fails without a confirmation flag or approval token. |
| LC-05 | Cleanup deletes only planned legacy paths | no files outside the dry-run plan or storage root are removed. |
| LC-06 | Cleanup does not follow symlinks | symlinked paths are reported as unsafe and are not traversed. |
| LC-07 | Cleanup preserves explicitly retained paths | owner-approved retention entries remain and are reported as retained, not forgotten. |
| LC-08 | Cleanup is idempotent | running cleanup again after success reports no remaining planned deletions and does not fail. |
| LC-09 | Post-cleanup integrity check passes | primary DB and `storage/videos` remain valid after old sources are removed. |
| LC-10 | Project completion gate fails when legacy sources remain without retention | final verification reports incomplete cleanup if old DB/JSON/media sources remain and are not explicitly retained. |

### 4.8 Route And Composition Tests

Location:

```text
tests/integration/composition/
tests/integration/routes/
```

Purpose:

- Prove the application is wired to the new storage module without relying on old databases or JSON playlist stores.

Scenario catalog:

| ID | Contract | Scenarios |
| --- | --- | --- |
| RC-01 | Home library loader reads from primary DB | route composition uses `DATABASE_SQLITE_PATH` and returns videos with tags, genres, and content type from normalized tables. |
| RC-02 | Add-videos commit route writes primary DB | upload commit path writes video, media asset, taxonomy assignments, and ingest state into one DB. |
| RC-03 | Playlist routes use SQLite playlists | create/list/detail/update/reorder/delete no longer read or write playlist JSON. |
| RC-04 | Playback catalog resolves from media asset records | player route only serves videos with ready media assets and required files. |
| RC-05 | Legacy env vars are not runtime dependencies | app startup fails fast after migration when legacy DB path vars conflict with primary DB path. |
| RC-06 | Auth runtime uses the primary DB | login, session resolution, and logout read/write `auth_sessions` from `DATABASE_SQLITE_PATH`. |

### 4.9 Browser And E2E Smoke Tests

Location:

```text
tests/e2e/
```

Purpose:

- Prove user-visible owner workflows still work after storage is consolidated.

Scenario catalog:

| ID | Contract | Scenarios |
| --- | --- | --- |
| E2E-01 | Owner can log in and see library from primary DB | no hidden repo-local storage is required. |
| E2E-02 | Owner can upload and commit a video | resulting video appears in library with title, tags, genres, content type, and thumbnail. |
| E2E-03 | Owner can edit metadata | tag and genre changes persist after reload and do not duplicate. |
| E2E-04 | Owner can open playback for a ready video | manifest/key/segment requests succeed through browser-visible route wiring. |
| E2E-05 | Owner can create and view playlist | playlist data persists in SQLite after reload. |

Execution rule:

- Storage changes are runtime-sensitive. Before handoff, the base verification bundle and Docker CI-like verification are required by `docs/verification-contract.md`.
- Browser-visible storage changes that affect library, upload, playlist, or playback routes require `bun run verify:e2e-smoke`.
- Use Playwright MCP or equivalent isolated browser QA when HTTP and automated smoke cannot prove a rendered or browser-only success condition.

## 5. Negative And Edge Case Matrix

These cases must be represented across the test layers above:

| Area | Edge cases |
| --- | --- |
| Empty data | no videos, no playlists, no staged uploads, no media dirs |
| Single record | one video with no tags, no genres, no content type |
| Many records | many videos sharing the same tag and genre |
| Duplicate tags | same raw tag repeated, mixed case, punctuation variants |
| Invalid tags | empty strings, whitespace, symbol-only, path-like strings |
| Unknown taxonomy | unknown legacy content type, unknown legacy genre |
| Null taxonomy | video without content type and without genres |
| Playlist names | same name with different case, different owners, empty/whitespace names |
| Media layout | old layout only, new layout only, both present, neither present |
| Media completeness | missing manifest, key, thumbnail, init segment, or media segment |
| Staging | committed legacy row, active row with file, active row without file, expired row |
| Migration | clean run, second run, failed mid-run, interrupted before migration row insert |
| Env config | no env vars, only `DATABASE_SQLITE_PATH`, legacy vars only, conflicting vars |
| Filesystem safety | absolute paths, path traversal, symlinks reported as unsafe, permission errors |
| SQLite safety | FK disabled by accidental connection, constraint violation, migration ordering error |

## 6. Test Data And Fixture Rules

- Use temporary directories for all DB and media filesystem tests.
- Use tracked fixtures only for reusable legacy DB/JSON/media samples.
- Do not rely on the developer's current `storage/` directory.
- Keep legacy fixture data intentionally small but behavior-rich.
- Prefer fixture builders over large opaque fixture files when the scenario is easier to understand in code.
- Use checked-in binary media fixtures only when the test must exercise real media tooling or browser playback.
- For migration tests, fixture names should describe the business condition, not implementation details.

Suggested fixture layout:

```text
tests/fixtures/storage-migration/
  empty-legacy/
  normal-legacy/
  duplicate-taxonomy/
  unknown-taxonomy/
  drifted-media/
  staged-uploads/
  playlist-drift/
```

## 7. Required Test Implementation Order

The implementation should proceed test-first in this order:

1. Domain tests for slug normalization, path resolution, and status readiness contracts.
2. SQLite schema contract tests for clean database creation and constraints.
3. Migration tests for legacy metadata, taxonomy, staged uploads, and playlists.
4. Repository/use-case integration tests for create/update/delete/commit behavior.
5. Filesystem layout and media asset integrity tests.
6. Integrity command tests.
7. Route/composition tests.
8. E2E/browser smoke tests for owner-visible flows.

This order keeps early failures precise and prevents broad browser tests from becoming the only signal for database design bugs. Implement P0 scenarios first, then add P1/P2 scenarios as each related behavior becomes part of the implementation plan.

## 8. Minimum Acceptance Gate

Before the first storage management implementation can be considered complete:

- all P0 tests selected for the implementation slice must fail for the expected reason before implementation
- all P0 tests selected for the implementation slice must pass after implementation
- `bun run lint` must pass
- `bun run typecheck` must pass
- `bun run test` must pass
- `bun run build` must pass
- Docker CI-like verification must pass because this is storage/runtime-sensitive work
- `bun run verify:e2e-smoke` must pass if route-visible owner flows are changed
- Playwright MCP or equivalent browser QA must be used when the changed flow cannot be proven by HTTP or smoke tests alone

The broader scenario catalog remains the backlog for the implementation plan. It should not be used to block an incremental, non-destructive first migration slice when the P0 contracts are already covered.

## 9. Explicit Non-Tests

Do not add tests that only prove:

- a private helper was called
- a repository called a specific SQL builder function
- a function used a particular loop, map, transaction helper, or adapter class
- a UI component has a particular internal component tree when the user-visible result is unchanged
- a migration file contains a specific string when schema behavior can be proven through SQLite introspection or behavior

Implementation details can change. The storage contract should not.
