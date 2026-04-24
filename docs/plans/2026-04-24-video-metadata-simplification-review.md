# Video Metadata Simplification Review

Date: 2026-04-24
Status: Accepted follow-up plan
Scope: Recently changed video metadata, tag/search/filter UI, persistence, and tests

## 1. Purpose

This document records a behavior-preserving simplification review after the video metadata/search/tag implementation.

The feature is considered functionally implemented and verified. This review is not a product redesign and must not change behavior. Its goal is to make the next safe edit easier by reducing drift risk, duplicated decision logic, and overloaded local responsibilities.

## 2. Review Method

Three read-only subagent reviews were run with the `code-simplifier` criteria:

- frontend filter and metadata UI flow
- backend/domain/persistence metadata flow
- changed tests and verification surface

The findings below are the parent synthesis after validating evidence in the repository. Style-only feedback, speculative redesign, and changes that would broaden architecture beyond a simplification pass were excluded or downgraded.

## 3. Accepted Simplification Work

### 3.1 Centralize home filter operations

Priority: High

Evidence:

- `app/widgets/home-library/ui/HomeLibraryWidget.tsx` reconstructs next filters for URL sync while also calling hook-specific mutators.
- `app/widgets/home-library/model/useHomeLibraryView.ts` exposes both `replaceSearchFilters` and specialized filter mutators.
- Active filter counting and reset semantics are repeated in `HomeLibraryWidget`, `HomeAppliedFiltersBar`, and `HomeFilterSurface`.

Problem:

The same filter intent is represented in multiple places:

- apply new filters
- count active filters
- clear all filters
- clear only non-query filters
- serialize filters to URL parameters
- adapt widget filters to domain matcher filters

This makes future filter additions risky because every new filter dimension must be threaded through several local interpretations.

Recommended fix:

Add small model-level helpers in `app/widgets/home-library/model/home-library-filters.ts`:

- `getHomeLibraryActiveFilterCount(filters)`
- `hasHomeLibraryActiveFilters(filters)`
- `clearHomeLibraryFilters(filters, { preserveQuery })`
- `toLibraryHomeFilters(filters)` delegating to `createLibraryHomeFilters`
- `writeHomeLibraryFiltersToSearchParams(searchParams, filters)`

Then simplify callers:

- `HomeLibraryWidget` should use one local `applyFilters(nextFilters, { replace })` path that updates hook state and URL state together.
- `useHomeLibraryView` should stop manually constructing `LibraryHomeFilters` inline and use `toLibraryHomeFilters`.
- Remove unused hook filter mutators after confirming tests do not depend on them.

Behavior to preserve:

- search query remains `q`
- include tags remain repeated `tag`
- exclude tags remain repeated `notTag`
- content type remains `type`
- genres remain repeated `genre`
- include tag filtering remains AND
- exclude tag filtering remains ANY
- mobile reset continues preserving query where it currently does

Suggested verification:

- `bun run test:modules -- app/modules/library/domain/library-home-filters.test.ts`
- `bun run test:ui-dom -- tests/ui/home/home-library-widget.test.tsx tests/ui/home/home-shell-contract.test.tsx tests/ui/home/home-library-surface.test.tsx`

### 3.2 Make desktop/mobile filter surface state boundaries explicit

Priority: Medium

Evidence:

- `app/features/home-tag-filter/ui/HomeFilterSurface.tsx` uses live updates for desktop and draft/apply behavior for mobile inside one component.
- The shared `FilterFields` component is correct, but the desktop and mobile commit semantics are not named clearly.

Problem:

The UX difference is intentional, but the code makes readers infer it from state wiring. This increases risk when editing filter layout, reset behavior, or drawer/sheet behavior.

Recommended fix:

Keep the behavior unchanged, but expose the phases locally:

- extract `DesktopFilterSheet` and `MobileFilterDrawer`, or keep one file and add explicit helpers such as `applyDraftFilters` and `resetDraftAndApply`
- keep `FilterFields` as the shared field renderer
- do not introduce a new primitive or change shadcn internals

Behavior to preserve:

- desktop sheet changes apply immediately
- mobile drawer changes apply only through `Apply`
- mobile reset continues to clear metadata filters while preserving the current query

Suggested verification:

- `bun run test:ui-dom -- tests/ui/home/home-shell-contract.test.tsx tests/ui/home/home-library-widget.test.tsx`

### 3.3 Collapse duplicated SQLite create INSERT branches

Priority: High

Evidence:

- `app/modules/library/infrastructure/sqlite/sqlite-library-video-metadata.repository.ts` has two full `INSERT INTO library_videos` branches in `create()`.
- The branches differ only in whether `sort_index` is explicit or computed.

Problem:

Every future metadata column must be added to two column lists and two parameter lists. This is an avoidable drift point in persistent data code.

Recommended fix:

Use one insert statement with a nullable explicit sort index:

```sql
COALESCE(?, COALESCE((SELECT MAX(sort_index) FROM library_videos), 0) + 1)
```

Pass `sortIndex ?? null` as the first argument for that expression.

Behavior to preserve:

- an explicit numeric `sortIndex` is used as-is
- omitted `sortIndex` still appends after the current maximum
- all metadata fields persist exactly as they do now

Suggested verification:

- `bun run test:integration -- tests/integration/composition/sqlite-canonical-video-metadata.adapter.test.ts tests/integration/composition/sqlite-library-video-mutation.adapter.test.ts`
- `bun run test:modules -- app/modules/library/infrastructure/sqlite/libsql-video-metadata.database.test.ts app/modules/library/infrastructure/sqlite/sqlite-library-video-metadata.repository.test.ts`

### 3.4 Name and contain update patch semantics

Priority: Medium

Evidence:

- `app/routes/api.update.$id.ts`, `app/modules/library/application/use-cases/update-library-video.usecase.ts`, `app/modules/library/infrastructure/sqlite/sqlite-library-video-mutation.adapter.ts`, and `app/modules/library/infrastructure/sqlite/sqlite-library-video-metadata.repository.ts` all participate in the same rule:
  omitted structured fields preserve existing metadata, explicit `null` clears content type, and explicit `[]` clears genres.

Problem:

The rule is currently correct, but easy to break because each layer uses local `Object.hasOwn` handling without a named contract.

Recommended fix:

Prefer a small helper over a broad abstraction:

- add a local helper near the update use case or mutation adapter to copy only own patch fields
- name the rule explicitly, for example `copyPresentStructuredMetadataFields`
- keep route JSON-boundary parsing, use-case sanitization, and repository persistence responsibilities separate
- do not remove the repository-level preservation logic, because it is the final data safety boundary

Avoid:

- blindly replacing every layer with one generic patch abstraction
- changing the public update API shape
- weakening tests around omitted versus explicit clear semantics

Behavior to preserve:

- omitted `contentTypeSlug` preserves the existing value
- explicit `contentTypeSlug: null` clears the value
- omitted `genreSlugs` preserves the existing value
- explicit `genreSlugs: []` clears all genres

Suggested verification:

- `bun run test:modules -- app/modules/library/application/use-cases/update-library-video.usecase.test.ts`
- `bun run test:integration -- tests/integration/composition/sqlite-library-video-mutation.adapter.test.ts tests/integration/library/home-write-route-library-slice.test.ts`

### 3.5 Reuse taxonomy/tag list normalization

Priority: Low

Evidence:

- `app/modules/library/domain/video-taxonomy.ts` delegates single taxonomy slug normalization to `normalizeVideoTag`.
- `normalizeTaxonomySlugs` repeats the ordered unique normalization loop already present in tag normalization.

Problem:

The two functions intentionally share the same slug shape, but their list normalization logic can drift if tag canonicalization changes later.

Recommended fix:

Make `normalizeTaxonomySlugs(rawSlugs)` delegate to `normalizeVideoTags(rawSlugs)` unless a future taxonomy rule intentionally diverges.

Behavior to preserve:

- taxonomy slugs keep the same canonical format as tags
- ordering and dedupe behavior stay unchanged

Suggested verification:

- `bun run test:modules -- app/modules/library/domain/video-tag.test.ts app/modules/library/domain/video-taxonomy.test.ts`

### 3.6 Reuse upload commit command typing

Priority: Low

Evidence:

- `app/routes/api.uploads.$stagingId.commit.ts` repeats the upload commit command shape inline.
- `app/modules/ingest/application/use-cases/commit-staged-upload-to-library.usecase.ts` owns the actual command contract.

Problem:

Metadata fields added to the commit command must be kept in sync manually between the route and use case type.

Recommended fix:

Export `CommitStagedUploadToLibraryCommand` from the use case, or type the route service as a narrow `Pick<CommitStagedUploadToLibraryUseCase, 'execute'>` equivalent.

Behavior to preserve:

- route validation and defaulting remain unchanged
- route stays thin
- no public API shape changes

Suggested verification:

- `bun run test:integration -- tests/integration/ingest/upload-commit-route.test.ts`
- `bun run test:modules -- app/modules/ingest/application/use-cases/commit-staged-upload-to-library.usecase.test.ts`

### 3.7 Reduce changed-test fixture noise

Priority: Low

Evidence:

- `app/modules/library/application/use-cases/update-library-video.usecase.test.ts` repeats full `LibraryVideo` fixtures and use-case wiring.
- `app/modules/library/domain/library-home-filters.test.ts` repeats full video objects for matcher cases.
- `tests/ui/add-videos/add-videos-view-parity.test.tsx` repeats full upload session and metadata literals.
- `tests/integration/composition/library-composition.test.ts` and `tests/integration/routes/add-videos-route.test.tsx` repeat vocabulary arrays.

Problem:

These tests still assert useful behavior, but fixture repetition makes future metadata field changes noisy and increases the chance of unrelated edits.

Recommended fix:

Add local test helpers only inside the relevant test files:

- `createLibraryVideo(overrides)`
- `setupUseCase({ existingVideo, updatedVideo })`
- `createHomeFilterVideo(overrides)`
- `createSession(overrides)`
- `createMetadata(overrides)`
- local `contentTypesFixture`, `genresFixture`, or `vocabularyFixture`

Keep behavior-specific input and expected mutation payloads inline. Do not introduce global test factories unless repetition spreads further.

Behavior to preserve:

- tests should still make title/tag/content type/genre assertions explicit
- omitted versus explicit clear semantics must stay directly asserted
- UI tests should remain user-facing, not implementation-coupled

Suggested verification:

- `bun run test:modules -- app/modules/library/application/use-cases/update-library-video.usecase.test.ts app/modules/library/domain/library-home-filters.test.ts`
- `bun run test:ui-dom -- tests/ui/add-videos/add-videos-view-parity.test.tsx`
- `bun run test:integration -- tests/integration/composition/library-composition.test.ts tests/integration/routes/add-videos-route.test.tsx`

## 4. Downgraded Or Excluded Findings

### 4.1 Split vocabulary loading into a separate port

Decision: Downgraded to advisory.

Reason:

The observation is real: catalog loading and vocabulary-only loading both call `listActiveContentTypes()` and `listActiveGenres()`. However, splitting `LibraryVideoSourcePort` into a new vocabulary port is an architecture boundary change, not a small behavior-preserving simplification. It may be worth doing later if more vocabulary categories or non-library consumers appear.

Allowed smaller version:

- extract a tiny `loadActiveVideoMetadataVocabulary(source)` helper if duplication starts growing
- do not split ports during the first simplification pass

### 4.2 Broad shared patch abstraction across route, use case, adapter, and repository

Decision: Partially excluded.

Reason:

The repeated omitted-versus-clear semantics are valid simplification pressure, but a single generic abstraction across all layers would blur responsibilities. The route owns JSON-boundary shape, the use case owns sanitization, and the repository owns final persistence safety.

Allowed smaller version:

- add named local helpers for copying own structured metadata fields
- keep layer-specific responsibilities visible

## 5. Recommended Execution Order

1. Centralize home filter operations and URL serialization.
2. Clarify `HomeFilterSurface` desktop/mobile state boundaries.
3. Collapse SQLite create INSERT duplication.
4. Name and contain update patch semantics.
5. Reuse taxonomy/tag list normalization.
6. Reuse upload commit command typing.
7. Reduce changed-test fixture noise.

This order starts with the highest future-edit risk, then moves into persistence drift, then low-risk cleanup.

## 6. Completion Gate

After implementing the accepted simplifications, run:

- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `bun run build`

If any runtime-visible filter or upload behavior changes during simplification, also run:

- `bun run verify:e2e-smoke`

If route/storage/runtime wiring changes beyond local type/helper simplification, also run:

- `bun run verify:ci-worktree:docker`

