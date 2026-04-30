# Video Metadata Implementation Plan

Status: Historical implementation plan
Last reviewed: 2026-04-30

> This plan predates the primary SQLite storage cutover. Use it as implementation
> history, not as the current code map for persistence or storage paths.

**Goal:** Introduce the approved metadata model and discovery UX for the personal video vault without increasing upload friction or regressing current add/watch flows.

**Architecture:** Extend the current library, ingest, and home-route ownership boundaries around three approved metadata axes: `contentType`, `genre`, and canonical `tags`. Keep taxonomy in SQLite reference tables, keep routes thin, and prefer shadcn-managed source or mature external libraries over bespoke controls.

**Tech Stack:** React Router v7, React 19, Bun, TypeScript, SQLite/libsql, shadcn/ui source components, Tailwind CSS v4, Vitest, Playwright.

---

## 1. Decision Status

This plan assumes the product and UX decisions are already approved.

Closed decisions:

- metadata axes are `contentType`, `genre`, and `tags`
- only `title` is required
- taxonomy fields are DB-backed reference data
- tags use canonical internal storage and prettified display labels
- search targets `title + tags`
- filters use:
  - `query`
  - `includeTags[]` with `AND`
  - `excludeTags[]` with `ANY`
- home discovery UX uses:
  - persistent search input
  - `Filters` entry point
  - applied filters bar
  - desktop `Sheet`
  - mobile `Drawer`
- misleading browse links should be removed until they are backed by real metadata filters

There are no remaining product or UX questions for the first implementation pass. Any remaining decisions are dependency-selection or execution details.

## 2. Global Guardrails

### 2.1 Reuse and dependency ladder

Every implementation choice must follow this order:

1. reuse existing project owners, helpers, and adapters
2. add missing shadcn-managed source through the shadcn workflow
3. evaluate mature external libraries with strong adoption and maintenance
4. write a thin composition wrapper around approved primitives or libraries
5. write bespoke functionality only if all earlier options are rejected in writing

This rule applies to both frontend and backend work.

### 2.2 Hard prohibitions

Do not:

- hand-edit generated shadcn primitive internals in `app/shared/ui/*`
- build a bespoke primitive first and search for a library later
- introduce a new compatibility layer or legacy namespace
- keep the current fake browse navigation alive while metadata filters are still unsupported
- duplicate canonical tag logic in multiple layers

### 2.3 Library selection bar

A new dependency is allowed only if it clears this bar:

- actively maintained
- already used by many developers
- strong npm download activity and/or strong GitHub adoption
- TypeScript support is first-class
- compatible with React 19 and the current bundling/runtime model
- headless or easily composable with shadcn/Tailwind styling
- smaller long-term maintenance burden than writing and owning the behavior ourselves
- no overlap with capabilities already covered by current dependencies or shadcn additions

If a candidate fails this bar, reject it and continue down the ladder instead of forcing it in.

### 2.4 Current library stance for this feature

Expected default choices:

- add missing shadcn-managed source for `sheet`, `drawer`, `popover`, and `command`
- treat `combobox` as a shadcn composition pattern over `Popover + Command`, not as a hand-rolled primitive
- investigate external tag-input libraries before building custom glue

Current investigation focus for freeform tag entry:

- `react-tag-input`
- `react-tag-input-component`
- `emblor`

These must be rechecked at implementation time against the library bar above. If none meet both the adoption bar and the integration bar, the fallback is not a full bespoke widget. The fallback is a thin local composition over approved primitives.

### 2.6 Task 0 decision record

Task 0 was executed on 2026-04-24.

Confirmed existing project state:

- the repo already had shadcn-managed source for:
  - `badge`
  - `button`
  - `dialog`
  - `input`
  - `separator`
  - `textarea`
  - `alert`
  - `empty`
- Task 0 added shadcn-managed source for:
  - [app/shared/ui/sheet.tsx](/home/retn0/repositories/nbsp1221/local-streamer/app/shared/ui/sheet.tsx)
  - [app/shared/ui/drawer.tsx](/home/retn0/repositories/nbsp1221/local-streamer/app/shared/ui/drawer.tsx)
  - [app/shared/ui/popover.tsx](/home/retn0/repositories/nbsp1221/local-streamer/app/shared/ui/popover.tsx)
  - [app/shared/ui/command.tsx](/home/retn0/repositories/nbsp1221/local-streamer/app/shared/ui/command.tsx)
- shadcn-managed dependency additions landed in [package.json](/home/retn0/repositories/nbsp1221/local-streamer/package.json):
  - `cmdk`
  - `vaul`

External tag-input investigation result:

- `react-tag-input`
  - active enough and React 19-compatible
  - rejected for v1 because it pulls in `react-dnd` and `react-dnd-html5-backend`, adds drag-and-drop behavior we do not need, and is not a clean headless fit for the approved shadcn-first composition path
- `react-tag-input-component`
  - rejected for v1 because it is stale, has much weaker adoption, and only declares React 16-18 support
- `emblor`
  - promising and visually close to shadcn
  - rejected for v1 because it still declares React 18 peer dependencies and brings overlapping pinned UI dependencies (`@radix-ui/react-dialog`, `@radix-ui/react-popover`, `cmdk`) that increase integration risk inside this codebase

Task 0 final decision:

- do not adopt an external tag-input library for v1
- use shadcn-managed source plus thin local composition for:
  - freeform tag input
  - metadata selectors
- do not hand-edit shadcn primitive internals while doing this

This decision is now fixed unless a later explicit re-evaluation finds a library that clearly beats the current path against the bar in section 2.3.

### 2.5 Session constraints

Execution under this plan must respect the current owner instructions:

- do not create commits unless the owner explicitly asks
- do not create worktrees unless the owner explicitly asks

## 3. Current Code Map

### 3.1 Home discovery ownership

- [app/routes/_index.tsx](/home/retn0/repositories/nbsp1221/local-streamer/app/routes/_index.tsx)
  - home route loader and search-param bootstrap
- [app/pages/home/ui/HomePage.tsx](/home/retn0/repositories/nbsp1221/local-streamer/app/pages/home/ui/HomePage.tsx)
  - page shell ownership
- [app/widgets/home-library/ui/HomeLibraryWidget.tsx](/home/retn0/repositories/nbsp1221/local-streamer/app/widgets/home-library/ui/HomeLibraryWidget.tsx)
  - current home composition owner
- [app/widgets/home-library/model/useHomeLibraryView.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/widgets/home-library/model/useHomeLibraryView.ts)
  - current client-side filter and quick-view state owner
- [app/widgets/home-library/model/home-library-filters.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/widgets/home-library/model/home-library-filters.ts)
  - current `query + tags` filter model
- [app/features/home-tag-filter/ui/HomeTagFilter.tsx](/home/retn0/repositories/nbsp1221/local-streamer/app/features/home-tag-filter/ui/HomeTagFilter.tsx)
  - current positive-tag-only filter summary
- [app/widgets/home-shell/ui/HomeShell.tsx](/home/retn0/repositories/nbsp1221/local-streamer/app/widgets/home-shell/ui/HomeShell.tsx)
  - search field placement, sidebar, and mobile nav dialog
- [app/entities/home-shell/model/home-navigation.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/entities/home-shell/model/home-navigation.ts)
  - current misleading browse navigation
- [app/features/home-search/ui/HomeSearchField.tsx](/home/retn0/repositories/nbsp1221/local-streamer/app/features/home-search/ui/HomeSearchField.tsx)
  - current search input primitive usage layer

### 3.2 Upload and edit ownership

- [app/pages/add-videos/ui/AddVideosPage.tsx](/home/retn0/repositories/nbsp1221/local-streamer/app/pages/add-videos/ui/AddVideosPage.tsx)
  - upload page owner
- [app/widgets/add-videos/model/useAddVideosView.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/widgets/add-videos/model/useAddVideosView.ts)
  - upload metadata state and commit request assembly
- [app/widgets/add-videos/ui/AddVideosView.tsx](/home/retn0/repositories/nbsp1221/local-streamer/app/widgets/add-videos/ui/AddVideosView.tsx)
  - staged upload form UI
- [app/features/home-quick-view/ui/HomeQuickViewDialog.tsx](/home/retn0/repositories/nbsp1221/local-streamer/app/features/home-quick-view/ui/HomeQuickViewDialog.tsx)
  - quick-view surface and edit entry point
- [app/features/home-quick-view/ui/EditHomeVideoForm.tsx](/home/retn0/repositories/nbsp1221/local-streamer/app/features/home-quick-view/ui/EditHomeVideoForm.tsx)
  - current edit form owner

### 3.3 Backend metadata ownership

- [app/modules/library/domain/library-video.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/modules/library/domain/library-video.ts)
  - current canonical library video shape
- [app/modules/library/domain/library-home-filters.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/modules/library/domain/library-home-filters.ts)
  - current normalized home-filter helper
- [app/modules/library/application/use-cases/update-library-video.usecase.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/modules/library/application/use-cases/update-library-video.usecase.ts)
  - current update input sanitization
- [app/modules/library/application/ports/library-video-mutation.port.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/modules/library/application/ports/library-video-mutation.port.ts)
  - current update contract
- [app/modules/library/application/ports/library-video-source.port.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/modules/library/application/ports/library-video-source.port.ts)
  - current catalog read contract
- [app/modules/library/infrastructure/sqlite/libsql-video-metadata.database.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/modules/library/infrastructure/sqlite/libsql-video-metadata.database.ts)
  - SQLite schema owner
- [app/modules/library/infrastructure/sqlite/sqlite-library-video-metadata.repository.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/modules/library/infrastructure/sqlite/sqlite-library-video-metadata.repository.ts)
  - current storage mapping
- [app/modules/library/infrastructure/sqlite/sqlite-canonical-video-metadata.adapter.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/modules/library/infrastructure/sqlite/sqlite-canonical-video-metadata.adapter.ts)
  - ingest writer and library source adapter
- [app/modules/library/infrastructure/sqlite/sqlite-library-video-mutation.adapter.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/modules/library/infrastructure/sqlite/sqlite-library-video-mutation.adapter.ts)
  - mutation adapter
- [app/modules/ingest/application/use-cases/commit-staged-upload-to-library.usecase.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/modules/ingest/application/use-cases/commit-staged-upload-to-library.usecase.ts)
  - current upload commit normalization boundary
- [app/routes/api.uploads.$stagingId.commit.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/routes/api.uploads.$stagingId.commit.ts)
  - upload commit HTTP boundary
- [app/routes/api.update.$id.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/routes/api.update.$id.ts)
  - edit/update HTTP boundary
- [app/composition/server/library.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/composition/server/library.ts)
  - library composition root

## 4. Execution Order

The safest execution order is:

1. dependency gate and primitive inventory
2. domain contracts and pure helpers
3. SQLite schema and repository expansion
4. write-path normalization
5. read-path vocabulary exposure
6. route and URL contract evolution
7. home discovery UI replacement
8. upload/edit form evolution
9. browser-visible verification

Do not start the UI refactor before the filter contract and canonical tag helpers are locked in tests.

## 5. Detailed Task Breakdown

### Task 0: Record dependency decisions before coding the new controls

**Purpose:** Prevent accidental bespoke UI work.

**Files to inspect:**

- [package.json](/home/retn0/repositories/nbsp1221/local-streamer/package.json)
- [app/shared/ui](/home/retn0/repositories/nbsp1221/local-streamer/app/shared/ui)
- this plan document

**Steps:**

1. Confirm which shadcn primitives already exist.
2. Add missing shadcn-managed source for `sheet`, `drawer`, `popover`, and `command` through the existing `bun run ui:add ...` workflow if needed.
3. Re-evaluate external tag-input candidates against the library bar in section 2.3.
4. Record one explicit decision:
   - `Adopt library X`
   - or `Use thin composition over shadcn primitives because no library met the bar`
5. Do not proceed to tag-input implementation until that decision is written down.

**Expected outcome:** The project has an explicit dependency choice before any new filter or metadata input control is written.

**Status:** Completed on 2026-04-24. See section 2.6 for the fixed decision record.

### Task 1: Lock canonical metadata contracts in pure domain code

**Reuse first:**

- extend [app/modules/library/domain/library-home-filters.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/modules/library/domain/library-home-filters.ts)
- extend [app/modules/library/domain/library-video.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/modules/library/domain/library-video.ts)

**Likely new files:**

- `app/modules/library/domain/video-tag.ts`
- `app/modules/library/domain/video-taxonomy.ts`

**Tests to add or update:**

- `app/modules/library/domain/library-home-filters.test.ts`
- new colocated tests for canonical tag and taxonomy helpers

**Steps:**

1. Add one canonical tag helper module that owns:
   - normalization
   - deduplication
   - display-label derivation
2. Add one taxonomy helper module that owns bootstrap vocabulary shapes and stable slug lists.
3. Extend `LibraryVideo` to include:
   - `contentTypeSlug?`
   - `genreSlugs`
   - canonical `tags`
4. Extend the library-home filter domain model to include:
   - `includeTags`
   - `excludeTags`
   - optional `contentTypeSlug`
   - `genreSlugs`
5. Lock the approved semantics in pure tests before touching adapters or UI.

**Expected outcome:** One shared domain source of truth exists for metadata and filter semantics.

### Task 2: Expand SQLite schema for vocabulary-backed metadata

**Files to modify:**

- [app/modules/library/infrastructure/sqlite/libsql-video-metadata.database.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/modules/library/infrastructure/sqlite/libsql-video-metadata.database.ts)

**Files likely to add:**

- a small vocabulary bootstrap module in `app/modules/library/infrastructure/sqlite/`

**Tests to update or add:**

- [app/modules/library/infrastructure/sqlite/libsql-video-metadata.database.test.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/modules/library/infrastructure/sqlite/libsql-video-metadata.database.test.ts)
- [app/modules/library/infrastructure/sqlite/sqlite-library-video-metadata.repository.test.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/modules/library/infrastructure/sqlite/sqlite-library-video-metadata.repository.test.ts)

**Steps:**

1. Add vocabulary tables or an equivalent typed vocabulary schema for `contentType` and `genre`.
2. Add columns or join-table storage needed for:
   - `content_type_slug`
   - `genre_slugs_json`
   - canonical `tags_json`
3. Add first-time bootstrap logic for the approved default vocabulary rows.
4. Ensure bootstrap does not overwrite edited or deleted operator-managed rows.
5. Verify existing video rows remain readable.

**Expected outcome:** SQLite can persist the approved metadata model and initial taxonomy reference data safely.

### Task 3: Extend repository and adapter mapping

**Files to modify:**

- [app/modules/library/infrastructure/sqlite/sqlite-library-video-metadata.repository.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/modules/library/infrastructure/sqlite/sqlite-library-video-metadata.repository.ts)
- [app/modules/library/infrastructure/sqlite/sqlite-canonical-video-metadata.adapter.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/modules/library/infrastructure/sqlite/sqlite-canonical-video-metadata.adapter.ts)
- [app/modules/library/infrastructure/sqlite/sqlite-library-video-mutation.adapter.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/modules/library/infrastructure/sqlite/sqlite-library-video-mutation.adapter.ts)
- [app/modules/library/application/ports/library-video-source.port.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/modules/library/application/ports/library-video-source.port.ts)
- [app/modules/library/application/ports/library-video-mutation.port.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/modules/library/application/ports/library-video-mutation.port.ts)

**Tests to update or add:**

- [tests/integration/composition/sqlite-canonical-video-metadata.adapter.test.ts](/home/retn0/repositories/nbsp1221/local-streamer/tests/integration/composition/sqlite-canonical-video-metadata.adapter.test.ts)
- [tests/integration/composition/sqlite-library-video-mutation.adapter.test.ts](/home/retn0/repositories/nbsp1221/local-streamer/tests/integration/composition/sqlite-library-video-mutation.adapter.test.ts)

**Steps:**

1. Update repository row mapping to include structured metadata fields.
2. Ensure read paths return the new metadata shape without breaking existing consumers.
3. Extend mutation/update input contracts to carry `contentTypeSlug` and `genreSlugs`.
4. Keep all canonicalization in the shared domain helper, not inside SQL mapping code.

**Expected outcome:** Storage adapters understand the new metadata shape and keep canonical rules centralized.

### Task 4: Normalize every write boundary

**Files to modify:**

- [app/modules/ingest/application/use-cases/commit-staged-upload-to-library.usecase.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/modules/ingest/application/use-cases/commit-staged-upload-to-library.usecase.ts)
- [app/modules/library/application/use-cases/update-library-video.usecase.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/modules/library/application/use-cases/update-library-video.usecase.ts)
- [app/routes/api.uploads.$stagingId.commit.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/routes/api.uploads.$stagingId.commit.ts)
- [app/routes/api.update.$id.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/routes/api.update.$id.ts)

**Tests to update or add:**

- [app/modules/ingest/application/use-cases/commit-staged-upload-to-library.usecase.test.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/modules/ingest/application/use-cases/commit-staged-upload-to-library.usecase.test.ts)
- [app/modules/library/application/use-cases/update-library-video.usecase.test.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/modules/library/application/use-cases/update-library-video.usecase.test.ts)
- [tests/integration/ingest/upload-commit-route.test.ts](/home/retn0/repositories/nbsp1221/local-streamer/tests/integration/ingest/upload-commit-route.test.ts)
- [tests/integration/library/home-write-route-library-slice.test.ts](/home/retn0/repositories/nbsp1221/local-streamer/tests/integration/library/home-write-route-library-slice.test.ts)

**Steps:**

1. Replace ad hoc tag trimming with the shared canonical helper.
2. Accept optional `contentTypeSlug` and `genreSlugs` on ingest commit.
3. Accept optional `contentTypeSlug` and `genreSlugs` on video update.
4. Preserve `title` as the only required field.

**Expected outcome:** Upload and edit write paths now produce consistent metadata regardless of entry point.

### Task 5: Expose active vocabulary to the UI through composition

**Files to modify:**

- [app/composition/server/library.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/composition/server/library.ts)
- [app/modules/library/application/ports/library-video-source.port.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/modules/library/application/ports/library-video-source.port.ts)

**Likely new files:**

- a small vocabulary read use case under `app/modules/library/application/use-cases/`

**Tests to update or add:**

- [tests/integration/composition/library-composition.test.ts](/home/retn0/repositories/nbsp1221/local-streamer/tests/integration/composition/library-composition.test.ts)
- [tests/integration/composition/home-library-page-composition.test.ts](/home/retn0/repositories/nbsp1221/local-streamer/tests/integration/composition/home-library-page-composition.test.ts)

**Steps:**

1. Add a read contract for active `contentType` items.
2. Add a read contract for active `genre` items.
3. Expose these through the existing composition root rather than by direct repository construction in routes.

**Expected outcome:** Frontend metadata controls can be driven by server-provided vocabulary rather than hardcoded lists.

### Task 6: Evolve the home route URL contract

**Files to modify:**

- [app/routes/_index.tsx](/home/retn0/repositories/nbsp1221/local-streamer/app/routes/_index.tsx)
- [app/widgets/home-library/model/home-library-filters.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/widgets/home-library/model/home-library-filters.ts)

**Tests to update or add:**

- [tests/ui/home/home-route-bootstrap.test.tsx](/home/retn0/repositories/nbsp1221/local-streamer/tests/ui/home/home-route-bootstrap.test.tsx)
- [tests/integration/library/home-route-library-slice.test.ts](/home/retn0/repositories/nbsp1221/local-streamer/tests/integration/library/home-route-library-slice.test.ts)
- [tests/e2e/home-library-owner-smoke.spec.ts](/home/retn0/repositories/nbsp1221/local-streamer/tests/e2e/home-library-owner-smoke.spec.ts)

**Steps:**

1. Replace the current single positive tag bootstrap with the approved filter model.
2. Decide and lock the final query-string keys before UI work.
3. Preserve direct-navigation bootstrap behavior.
4. Keep `shouldRevalidate` honest for query-only navigation changes.

**Expected outcome:** The home route can round-trip the approved filter state in the URL.

### Task 7: Refactor home view state before replacing UI

**Files to modify:**

- [app/widgets/home-library/model/useHomeLibraryView.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/widgets/home-library/model/useHomeLibraryView.ts)
- [app/widgets/home-library/model/home-library-filters.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/widgets/home-library/model/home-library-filters.ts)

**Tests to update or add:**

- [tests/ui/home/home-library-widget.test.tsx](/home/retn0/repositories/nbsp1221/local-streamer/tests/ui/home/home-library-widget.test.tsx)

**Steps:**

1. Upgrade the filter state shape to the approved model.
2. Move matching logic to the approved semantics:
   - query on `title + tags`
   - include tags with `AND`
   - exclude tags with `ANY`
3. Extend local state updates so tag clicks add to `includeTags`.
4. Keep quick-view state behavior stable while changing only discovery state.

**Expected outcome:** The state owner can drive the new UX without mixing semantics into render code.

### Task 8: Replace the current filter summary with an applied-filters bar

**Files to modify or replace:**

- [app/features/home-tag-filter/ui/HomeTagFilter.tsx](/home/retn0/repositories/nbsp1221/local-streamer/app/features/home-tag-filter/ui/HomeTagFilter.tsx)
- [app/widgets/home-library/ui/HomeLibraryWidget.tsx](/home/retn0/repositories/nbsp1221/local-streamer/app/widgets/home-library/ui/HomeLibraryWidget.tsx)

**Likely new files:**

- an applied-filters UI component under `app/features/home-tag-filter/ui/` or a renamed replacement in the same slice

**Tests to update or add:**

- [tests/ui/home/home-library-widget.test.tsx](/home/retn0/repositories/nbsp1221/local-streamer/tests/ui/home/home-library-widget.test.tsx)
- [tests/ui/home/home-library-surface-contract.test.tsx](/home/retn0/repositories/nbsp1221/local-streamer/tests/ui/home/home-library-surface-contract.test.tsx)

**Steps:**

1. Remove the current positive-tag-only chip bar.
2. Render explicit chip semantics:
   - `Query:`
   - `Has:`
   - `Not:`
   - later `Type:` and `Genre:`
3. Add individual chip removal.
4. Add `Clear all`.
5. Replace the dead-end empty state with recovery actions.

**Expected outcome:** The home page visibly explains why results are filtered and how to recover.

### Task 9: Rework the home shell around search plus filters

**Files to modify:**

- [app/widgets/home-shell/ui/HomeShell.tsx](/home/retn0/repositories/nbsp1221/local-streamer/app/widgets/home-shell/ui/HomeShell.tsx)
- [app/entities/home-shell/model/home-navigation.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/entities/home-shell/model/home-navigation.ts)
- [app/features/home-search/ui/HomeSearchField.tsx](/home/retn0/repositories/nbsp1221/local-streamer/app/features/home-search/ui/HomeSearchField.tsx)

**Tests to update or add:**

- [tests/ui/home/home-shell-contract.test.tsx](/home/retn0/repositories/nbsp1221/local-streamer/tests/ui/home/home-shell-contract.test.tsx)
- [tests/ui/home/home-library-surface.test.tsx](/home/retn0/repositories/nbsp1221/local-streamer/tests/ui/home/home-library-surface.test.tsx)

**Steps:**

1. Keep search visible in the header.
2. Add a `Filters` trigger next to search.
3. Remove browse entries that pretend `genre` filtering already exists.
4. Keep library/manage navigation entries that still reflect real routes.
5. Add clear affordance to the search field.

**Expected outcome:** The shell matches the approved discovery model and no longer lies about available filters.

### Task 10: Build the desktop sheet and mobile drawer filter surfaces

**Dependencies first:**

- use shadcn-managed `sheet`, `drawer`, `popover`, and `command`
- use the library decision from Task 0 for freeform tags

**Files to modify or add:**

- [app/widgets/home-library/ui/HomeLibraryWidget.tsx](/home/retn0/repositories/nbsp1221/local-streamer/app/widgets/home-library/ui/HomeLibraryWidget.tsx)
- new filter-surface components under `app/features/home-tag-filter/ui/` or a more appropriate feature slice

**Tests to update or add:**

- [tests/ui/home/home-library-widget.test.tsx](/home/retn0/repositories/nbsp1221/local-streamer/tests/ui/home/home-library-widget.test.tsx)

**Steps:**

1. Add desktop `Sheet`.
2. Add mobile `Drawer`.
3. Add `Require tags`.
4. Add `Exclude tags`.
5. Add `Content type` selector.
6. Add `Genre` selector.
7. Make desktop apply immediately.
8. Make mobile use explicit `Apply` and `Reset`.

**Expected outcome:** Search and filters are separated cleanly and work on both desktop and mobile.

### Task 11: Extend upload metadata input without increasing friction

**Files to modify:**

- [app/widgets/add-videos/model/useAddVideosView.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/widgets/add-videos/model/useAddVideosView.ts)
- [app/widgets/add-videos/ui/AddVideosView.tsx](/home/retn0/repositories/nbsp1221/local-streamer/app/widgets/add-videos/ui/AddVideosView.tsx)
- [app/routes/api.uploads.$stagingId.commit.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/routes/api.uploads.$stagingId.commit.ts)

**Tests to update or add:**

- [tests/ui/add-videos/use-add-videos-view.test.tsx](/home/retn0/repositories/nbsp1221/local-streamer/tests/ui/add-videos/use-add-videos-view.test.tsx)
- [tests/ui/add-videos/add-videos-view-parity.test.tsx](/home/retn0/repositories/nbsp1221/local-streamer/tests/ui/add-videos/add-videos-view-parity.test.tsx)
- [tests/integration/ingest/upload-commit-route.test.ts](/home/retn0/repositories/nbsp1221/local-streamer/tests/integration/ingest/upload-commit-route.test.ts)
- [tests/e2e/add-videos-owner-upload-smoke.spec.ts](/home/retn0/repositories/nbsp1221/local-streamer/tests/e2e/add-videos-owner-upload-smoke.spec.ts)

**Steps:**

1. Keep `title` as the only required input.
2. Replace comma-only tags entry with the approved tag-input control.
3. Add optional `contentType` selector.
4. Add optional `genre` selector.
5. Keep `description` optional and below the structured metadata fields.
6. Preserve the current single-file browser upload flow.

**Expected outcome:** Upload stays lightweight while supporting the approved metadata model.

### Task 12: Extend quick-view edit metadata input to match upload

**Files to modify:**

- [app/features/home-quick-view/ui/EditHomeVideoForm.tsx](/home/retn0/repositories/nbsp1221/local-streamer/app/features/home-quick-view/ui/EditHomeVideoForm.tsx)
- [app/features/home-quick-view/ui/HomeQuickViewDialog.tsx](/home/retn0/repositories/nbsp1221/local-streamer/app/features/home-quick-view/ui/HomeQuickViewDialog.tsx)
- [app/routes/api.update.$id.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/routes/api.update.$id.ts)

**Tests to update or add:**

- [tests/ui/home/home-library-widget.test.tsx](/home/retn0/repositories/nbsp1221/local-streamer/tests/ui/home/home-library-widget.test.tsx)
- [tests/ui/home/home-library-surface.test.tsx](/home/retn0/repositories/nbsp1221/local-streamer/tests/ui/home/home-library-surface.test.tsx)
- [tests/integration/library/home-write-route-library-slice.test.ts](/home/retn0/repositories/nbsp1221/local-streamer/tests/integration/library/home-write-route-library-slice.test.ts)

**Steps:**

1. Match the upload field order:
   - title
   - tags
   - content type
   - genre
   - description
2. Replace comma-string parsing with the same approved tag-input path used in upload.
3. Keep save/cancel behavior and error handling unchanged.

**Expected outcome:** Upload and edit share the same metadata mental model.

### Task 13: Final pass on composition wiring and route boundaries

**Files to review and adjust:**

- [app/composition/server/library.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/composition/server/library.ts)
- [app/routes/_index.tsx](/home/retn0/repositories/nbsp1221/local-streamer/app/routes/_index.tsx)
- [app/routes/api.uploads.$stagingId.commit.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/routes/api.uploads.$stagingId.commit.ts)
- [app/routes/api.update.$id.ts](/home/retn0/repositories/nbsp1221/local-streamer/app/routes/api.update.$id.ts)

**Tests to update or add:**

- [tests/integration/composition/library-write-composition.test.ts](/home/retn0/repositories/nbsp1221/local-streamer/tests/integration/composition/library-write-composition.test.ts)
- [tests/integration/composition/ingest-composition.test.ts](/home/retn0/repositories/nbsp1221/local-streamer/tests/integration/composition/ingest-composition.test.ts)
- [tests/integration/library/home-read-route-ownership-boundary.test.ts](/home/retn0/repositories/nbsp1221/local-streamer/tests/integration/library/home-read-route-ownership-boundary.test.ts)
- [tests/integration/library/home-write-route-ownership-boundary.test.ts](/home/retn0/repositories/nbsp1221/local-streamer/tests/integration/library/home-write-route-ownership-boundary.test.ts)

**Steps:**

1. Confirm routes still only orchestrate parsing and HTTP translation.
2. Confirm composition owns new services and adapters.
3. Confirm no UI component reaches into storage concerns directly.

**Expected outcome:** The refactor stays aligned with the repo’s current architecture instead of leaking implementation detail across slices.

## 6. Testing Strategy

### 6.1 Pure domain tests

Lock these first:

- canonical tag normalization
- display label derivation
- tag deduplication
- taxonomy bootstrap constants
- include/exclude filter semantics

### 6.2 Integration tests

Use integration tests to prove:

- SQLite schema boots cleanly
- vocabulary bootstrap is first-run safe
- video persistence keeps structured metadata intact
- routes serialize and parse the new filter shape correctly
- composition exposes the new vocabulary services

### 6.3 UI DOM tests

Use jsdom + React Testing Library for:

- applied filters bar semantics
- search clear behavior
- filter sheet/drawer interactions
- empty-state recovery actions
- upload metadata controls
- quick-view edit controls

These tests should assert visible behavior, not implementation internals.

### 6.4 Browser smoke and QA

Because this is browser-visible and changes search/filter flows:

- run the base verification bundle
- run the required Docker CI-like verification gate
- run the required browser smoke path
- run isolated browser QA for rendered owner workflows per the repo browser-QA contract

Browser-visible checks should confirm:

- login still lands on home correctly
- direct URL bootstrap still works
- search changes the visible result set
- include/exclude filters visibly change results
- desktop `Filters` opens a right-side `Sheet` and applies changes immediately
- mobile `Filters` opens a bottom `Drawer` and uses `Apply` and `Reset`
- misleading browse navigation is absent or any remaining browse entry changes the actual result set
- upload still succeeds with optional metadata present
- upload metadata controls accept optional tags, `contentType`, and `genre` in a real browser
- quick-view edit still updates visible metadata

## 7. Verification Commands

### Base verification

```bash
bun run lint
bun run typecheck
bun run test
bun run build
```

### Required Docker CI-like verification

```bash
bun run verify:ci-faithful:docker
```

### Focused verification loops

```bash
bun run test:modules
bun run test:integration
bun run test:ui-dom
```

### Required browser smoke

```bash
bun run verify:e2e-smoke
```

## 8. Risk Controls

Primary risks:

- slipping into bespoke UI instead of library-first composition
- letting frontend filter semantics drift from approved backend semantics
- reintroducing fake browse affordances
- scattering canonical tag logic across routes, hooks, and forms
- making the upload flow heavier than the approved design

Controls:

- finish Task 0 before writing the new controls
- lock pure domain tests before UI work
- reuse current route/page/widget ownership boundaries
- keep one canonical tag helper as the only source of truth
- keep `title` as the only required field throughout every entry point

## 9. Expected End State

When this plan is complete:

- the backend persists vocabulary-backed metadata safely
- taxonomy can evolve through DB-managed reference data
- the home route reflects honest search and filtering behavior
- the shell no longer exposes fake browse navigation
- upload and edit flows share the same metadata model and field order
- the implementation uses existing code, shadcn-managed source, or proven libraries before any thin local glue is introduced

## 9.1 Acceptance Criteria and Exit Gates

This section defines the explicit completion gates for this feature. The work is not done merely because code exists or because a subset of tests passes.

### Gate A: Metadata and behavior conformance

All of the following must be true:

- the implementation matches the approved metadata model:
  - `title` required
  - `contentType`, `genre`, and `tags` optional
- `contentType` and `genre` are DB-backed vocabulary, not hardcoded runtime product enums
- tags are stored canonically and displayed with the approved prettified label rule
- search matches only `title + tags`
- filter semantics match the approved contract:
  - `includeTags` uses `AND`
  - `excludeTags` uses `ANY`
- structured metadata filter semantics match the approved contract:
  - `contentTypeSlug` is a single exact-match filter
  - `genreSlugs` uses `ANY`
- URL-carried tag filter values use canonical tag values, not display labels
- selector UX preserves the difference between no value and explicit `other`
- upload and edit flows use the approved field order:
  - `Title`
  - `Tags`
  - `Content type`
  - `Genre`
  - `Description`
- misleading browse navigation is removed or replaced with honest behavior

### Gate B: Required system verification

The required base verification bundle must pass:

- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `bun run build`

Because this work is browser-visible and also touches runtime-sensitive behavior such as routes, storage, metadata persistence, and owner flows, the required browser and CI-like gates must also pass:

- `bun run verify:e2e-smoke`
- `bun run verify:ci-faithful:docker` or the repo-authoritative equivalent Docker CI-like verification gate

### Gate C: Required feature-level evidence

The implementation must have evidence across the following layers:

- pure domain evidence
  - canonical tag behavior
  - vocabulary bootstrap constants
  - filter semantics
- integration evidence
  - SQLite schema and bootstrap behavior
  - persistence of structured metadata
  - route parsing and serialization
  - composition wiring
- UI DOM evidence
  - applied filters bar
  - clear and recovery actions
  - filter panel behavior
  - upload metadata controls
  - edit metadata controls
- browser evidence
  - home discovery flow works in a real browser
  - desktop filter `Sheet` behavior is verified directly
  - mobile filter `Drawer` behavior is verified directly
  - fake browse affordances are absent or honestly wired in a real browser
  - upload flow still succeeds with optional metadata present
  - optional tags, `contentType`, and `genre` can be entered in a real browser and survive commit visibly
  - quick-view edit flow updates visible metadata

### Gate D: Required browser QA

Browser-visible success conditions must be verified directly, not inferred from route changes or HTTP responses alone.

At minimum:

- the required hermetic browser smoke path must pass
- because this feature changes rendered owner workflows, Playwright MCP or equivalent isolated browser QA must be run before completion
- the QA report must include:
  - which flows were exercised
  - whether Playwright MCP or fallback QA was used
  - which user-visible success conditions were directly observed
  - which tracked fixtures or hermetic seed paths were used
  - whether any blocker or unresolved mismatch remains

### Gate E: Required spec-to-code review

Before final completion, a read-heavy review pass must confirm that the approved design and the implemented behavior are aligned.

This review must explicitly check:

- design document versus implementation behavior
- implementation plan versus actual changed files and tests
- unresolved mismatches between frontend semantics and backend semantics

If this review finds an unresolved mismatch, the work is not complete.

### Gate F: Required synthesis and no-open-gap rule

Final completion requires one parent synthesis step that evaluates all evidence together.

The final synthesis must conclude all of the following:

- no unresolved spec mismatch remains
- no required verification gate remains unrun
- no browser-visible success condition remains unverified
- no critical TODO or placeholder remains in the shipped path
- the implementation is ready for owner review without further hidden work

## 10. Autonomous Execution Contract

### 10.1 Contract purpose

This contract exists to remove unnecessary human bottlenecks after design approval.

At this point:

- the product direction is approved
- the metadata model is approved
- the frontend discovery UX is approved
- the implementation strategy is approved

That means the remaining work is execution, not product discovery.

### 10.2 Default execution mode

After this plan is approved, implementation should proceed in autonomous task bundles without waiting for human approval between normal steps.

The engineer or coding agent should:

- choose the next task from this plan
- execute it end-to-end
- run the required focused verification for that task bundle
- continue to the next task bundle if no stop condition is triggered

Normal progress updates should be informational, not approval requests.

### 10.3 What is already delegated

The project owner has already delegated these decisions:

- the product intent of the mixed personal video vault
- the approved metadata model
- the approved home discovery UX
- the approved upload and edit metadata UX
- the reuse-first and library-first implementation philosophy
- the rule that direct implementation is the final fallback, not the starting point

The owner does not need to re-approve these decisions during implementation unless the implementation reveals a true contradiction with the approved design.

### 10.4 What the agent may do without asking

The engineer or coding agent may proceed without additional approval for:

- modifying files already identified by this plan
- adding or updating tests required by this plan
- adding missing shadcn-managed source components through the project workflow
- introducing thin local composition layers on top of approved primitives
- extending SQLite schema and adapters in line with the approved metadata design
- refactoring local code to preserve clarity and ownership boundaries while staying inside approved scope
- running focused verification commands
- running the base verification bundle before final handoff

### 10.5 Dependency decision authority

External dependencies do not require per-step human approval if they satisfy the approved library bar and stay inside the already-approved problem scope.

An external dependency may be adopted autonomously only if all of the following are true:

- the need is not already solved by existing repo code
- the need is not already solved by adding or composing shadcn-managed source
- the dependency is actively maintained
- the dependency has first-class TypeScript support
- the dependency is compatible with the repo's current major versions and runtime model
- the dependency is composable with the current architecture and styling approach
- the dependency is well-adopted by the ecosystem
- the dependency reduces maintenance burden relative to local implementation

For this project, "well-adopted" means strong public evidence such as:

- at least roughly 500 GitHub stars, or
- at least roughly 100k monthly npm downloads,

with preference for dependencies that satisfy both signals.

If a candidate is materially below those thresholds, has stale peer dependency ranges, or brings unnecessary overlapping infrastructure, it should be rejected or escalated.

### 10.6 Mandatory stop conditions

Implementation must pause and ask for human input only when one of these conditions is hit:

- the work requires changing the approved product behavior or UX model
- the approved plan is insufficient or contradictory
- a dependency is needed but does not clearly satisfy the library bar
- an action would be destructive or hard to reverse
- the work would modify or revert user changes that are not clearly part of this task
- a security, privacy, or data-integrity risk appears that is outside the approved scope
- required verification fails in a way that suggests the plan or design is wrong, not just the current patch
- the next step would require a commit, push, worktree, or other explicitly owner-controlled action

### 10.7 Explicit non-autonomous actions

The engineer or coding agent must not do the following without explicit owner approval:

- create a git commit
- push to a remote
- create or switch to a git worktree
- use destructive git commands
- overwrite shadcn primitive internals to force a fit
- add speculative features outside the approved design

### 10.8 Progress reporting cadence

Progress should be reported at bundle boundaries, not at every micro-step.

Recommended bundle cadence:

- one update after a meaningful task bundle completes
- one update when a mandatory stop condition is triggered
- one update at final handoff with verification results

Progress updates should summarize:

- what bundle was completed
- what files or areas changed
- what verification was run
- what remains next

They should not ask for approval unless a stop condition applies.

### 10.9 Verification contract for autonomous work

Autonomous execution is only valid if verification scales with risk.

For each task bundle:

- run focused tests for the touched area
- confirm the bundle leaves the workspace in a clean, understandable state

Before final handoff:

- run `bun run lint`
- run `bun run typecheck`
- run `bun run test`
- run `bun run build`
- run `bun run verify:ci-faithful:docker`

When the change is browser-visible and runtime-sensitive:

- run `bun run verify:e2e-smoke`
- run Playwright MCP or equivalent isolated browser QA for the rendered owner workflows covered by this plan

### 10.10 Working-state discipline

Each task bundle should leave artifacts that make the next bundle easy to continue.

That means:

- no half-migrated state without notes in the code or plan
- no duplicated unfinished experiments left in the tree
- no undocumented divergence between frontend and backend semantics
- no "I'll fix it later" placeholders in critical behavior paths unless they are explicitly tracked in this plan

The plan itself acts as the harness contract for continuation. The agent should use it the same way a long-running harness uses feature lists, progress notes, and verification checkpoints.
