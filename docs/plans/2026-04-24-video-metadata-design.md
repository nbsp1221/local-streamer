# Video Metadata Design

Date: 2026-04-24
Status: Approved design
Owner: Project maintainer

## 1. Goal

Define a metadata model for the personal video vault before changing search, tags, or browsing UX.

The design must support:

- a mixed personal vault with both private recordings and entertainment content
- search-first discovery
- powerful tag filtering, including include and exclude logic
- future taxonomy changes without code edits

## 2. Product Direction

This library is a mixed personal vault.

It should support:

- personal recordings
- downloaded or archived videos
- movies
- episodic content
- animation
- documentaries

The primary discovery model is:

- text search
- tags

Structured metadata exists to improve organization over time, but it must not create friction during upload.

## 3. Metadata Principles

### 3.1 Separate metadata by purpose

The system uses three distinct descriptive axes:

- `contentType`
  - structural kind of video
- `genre`
  - entertainment-oriented content genre
- `tags`
  - personal labels used for search and filtering

These axes must not collapse into one field.

### 3.2 Keep upload lightweight

Only `title` is required at upload time.

All other descriptive fields are optional:

- `description`
- `contentType`
- `genre`
- `tags`

### 3.3 Prefer stable internal keys

Structured taxonomies are stored and referenced by stable `slug` values, not by display labels and not by database ids in video rows.

### 3.4 Treat taxonomy as data, not code

`contentType` and `genre` are reference data managed in the database.

Code may provide bootstrap defaults, but ongoing operation must not depend on changing code constants.

## 4. Video Metadata Model

### 4.1 Required descriptive fields

- `title`

### 4.2 Optional descriptive fields

- `description`
- `contentTypeSlug`
- `genreSlugs[]`
- `tagSlugs[]`

### 4.3 Existing system and technical fields remain separate

Existing fields such as:

- `id`
- `duration`
- `thumbnailUrl`
- `videoUrl`
- `createdAt`

remain outside the descriptive metadata design and continue to exist as system or technical fields.

### 4.4 Semantic meaning of each field

- `contentType`
  - answers: what kind of video is this structurally?
  - examples: movie, episode, home video, clip

- `genre`
  - answers: what entertainment genre does this belong to?
  - examples: action, drama, documentary
  - may be empty for personal recordings

- `tags`
  - answers: what personal labels should help me find or exclude this later?
  - examples: family, japan_trip, favorite, watch_later

## 5. Structured Vocabulary Model

### 5.1 Vocabulary-backed fields

The following fields are vocabulary-backed:

- `contentType`
- `genre`

Each vocabulary item has at least:

- `slug`
- `label`
- `active`
- `sortOrder`

### 5.2 Video-side storage

Videos store structured values by `slug`.

Examples:

- `contentTypeSlug = "movie"`
- `genreSlugs = ["action", "drama"]`

This avoids coupling video records to mutable row ids and keeps label changes safe.

### 5.3 Empty values are valid

If `contentType` or `genre` is not provided:

- the field may remain empty
- the UI may treat it as unclassified or unknown
- the system must not silently coerce it to `other`

This preserves the difference between:

- deliberately classified as `other`
- not classified yet

## 6. Bootstrap Reference Data

### 6.1 Bootstrap strategy

The system should provide initial reference values as bootstrap data.

This bootstrap data is:

- part of the initial application setup
- code-defined
- intended only to create the first usable taxonomy state

It is not:

- sample media data
- something the app should reapply on every run
- something that should overwrite operator-managed values later

### 6.2 Bootstrap rules

Bootstrap must be safe for first-time setup, but it must respect ongoing manual operation.

That means:

- it may create missing vocabulary rows during initialization
- it must not overwrite edited rows
- it must not recreate deleted defaults behind the operator's back during normal runtime

### 6.3 Initial content type bootstrap values

- `movie`
- `episode`
- `home_video`
- `clip`
- `other`

### 6.4 Initial genre bootstrap values

- `action`
- `drama`
- `comedy`
- `documentary`
- `animation`
- `other`

These lists are intentionally small and should be treated as initial defaults, not permanent product truth.

## 7. Tag Model

### 7.1 Tag role

Tags are the primary flexible discovery system.

They support:

- personal labeling
- search matching
- include filtering
- exclude filtering

### 7.2 Canonical storage rule

Tags are stored in canonical internal form.

Canonical normalization rules:

- convert uppercase letters to lowercase
- convert spaces to `_`
- keep `-`
- allow only:
  - `a-z`
  - `0-9`
  - `_`
  - `-`

Examples:

- `magic` -> `magic`
- `Good Boy-comedy` -> `good_boy-comedy`

### 7.3 Duplicate handling

Duplicate tags are deduplicated using canonical values.

This means any tags that normalize to the same canonical form are treated as the same tag.

### 7.4 Display rule

The stored canonical value is the source of truth.

For UI display:

- replace `_` with a space
- keep `-` visible

Example:

- stored: `good_boy-comedy`
- displayed: `good boy-comedy`

### 7.5 URL rule

When tags appear in URL-carried filter state, the URL value must use the canonical internal tag value.

Display labels must never be used as the URL source of truth.

Example:

- stored tag: `good_boy-comedy`
- URL value: `good_boy-comedy`
- displayed label: `good boy-comedy`

## 8. Search Rules

### 8.1 Search target

Search only matches:

- `title`
- `tags`

Search does not match:

- `description`
- `contentType`
- `genre`

### 8.2 Why description is excluded

Descriptions are for understanding content, not for driving broad retrieval behavior in this MVP.

Excluding descriptions keeps search:

- faster to reason about
- more predictable
- better aligned with the tag-first model

## 9. Filter State Model

The minimum filter state is:

- `query`
- `includeTags[]`
- `excludeTags[]`
- `contentTypeSlug?`
- `genreSlugs[]`

### 9.1 Query behavior

`query` is free text search over `title + tags`.

### 9.2 Include tag behavior

Included tags use `AND` semantics.

If multiple include tags are selected, a video must contain all of them.

### 9.3 Exclude tag behavior

Excluded tags use `ANY` semantics.

If a video contains any excluded tag, it is removed from the result set.

### 9.4 Combined evaluation

Conceptually, a result must:

1. match the query
2. satisfy all included tags
3. contain none of the excluded tags

### 9.5 Structured metadata filter semantics

Structured metadata filters use these rules:

- `contentTypeSlug`
  - single-select
  - exact match when present
- `genreSlugs[]`
  - multi-select
  - `ANY`
  - a video matches when it has at least one selected genre

This is intentionally different from include-tag semantics.

Reasoning:

- tags are the precision tool, so include-tags stay strict with `AND`
- genre is a browsing aid, so multi-select genre should broaden the result set rather than collapse it too aggressively

## 10. Home Discovery UX

### 10.1 Primary discovery entry points

The home library uses:

- a persistent top search input
- a separate `Filters` entry point
- an applied-filters summary bar above results

Search and filters remain composable, but they are not merged into one overloaded control.

### 10.2 Layout direction

- desktop
  - top search input remains visible
  - `Filters` opens a right-side `Sheet`
- mobile
  - top search input remains visible
  - `Filters` opens a bottom `Drawer`

This keeps the mental model consistent across breakpoints while matching common responsive filter patterns.

### 10.3 Browse navigation policy

The existing browse sidebar links that imply unsupported genre filtering should not survive unchanged.

Until real metadata-backed browse filters exist, misleading browse affordances should be removed or replaced.

The system must not present navigation that changes the URL without changing the actual result set.

## 11. Filter Panel UX

### 11.1 Panel structure

The filter panel contains:

1. `Require tags`
2. `Exclude tags`
3. `Content type`
4. `Genre`

Search remains outside the panel as the primary query entry point.

### 11.2 Require tags

`Require tags` means:

- videos must contain all selected tags
- input is freeform
- selected values display as chips
- existing tag suggestions may be offered, but freeform input is always allowed

### 11.3 Exclude tags

`Exclude tags` means:

- videos with any selected excluded tag are hidden
- input uses the same mechanics as required tags
- UI styling should clearly distinguish exclusion from inclusion

### 11.4 Content type and genre inputs

- `contentType`
  - single-select
  - vocabulary-backed
  - optional
- `genre`
  - multi-select
  - vocabulary-backed
  - optional
  - uses `ANY` matching when filtering

### 11.4.1 Empty versus `other`

The UI must preserve the distinction between:

- no selected value
- explicitly selected `other`

That means:

- `contentType` must support a true empty state
- `contentType` must be clearable back to no value
- `genre` must support an empty set
- clearing values must not silently coerce them to `other`
- `other` remains a normal explicit vocabulary option with its own real slug

### 11.5 Interaction model

- desktop applies filter changes immediately
- mobile uses `Apply` and `Reset` actions in the drawer footer
- `Filters` is a structured editing surface, not a tiny transient popover

## 12. Applied Filters and Empty States

### 12.1 Applied filters bar

The result area should show an applied-filters bar whenever active discovery constraints exist.

It summarizes:

- query
- required tags
- excluded tags
- future `contentType`
- future `genre`

Each constraint should be removable individually, and the bar should also expose `Clear all`.

### 12.2 Visible semantics

Filter chips should encode meaning explicitly.

Examples:

- `Query: playtime`
- `Has: magic`
- `Not: spoiler`
- `Type: movie`
- `Genre: drama`

The UI must not force users to guess whether a tag chip means include or exclude.

### 12.3 Empty result policy

An empty result is a recoverable state, not just a dead end.

The empty state should:

- explain that no videos match the current constraints
- expose recovery actions such as:
  - `Clear query`
  - `Clear excluded tags`
  - `Clear required tags`
  - `Clear all`

## 13. Upload and Edit Metadata UX

### 13.1 Upload flow inputs

The upload page keeps a low-friction order:

1. `Title`
2. `Tags`
3. `Content type`
4. `Genre`
5. `Description`

Only `Title` is required.

### 13.2 Edit flow inputs

Quick view edit uses the same order and mental model as upload.

This avoids teaching users two different metadata models.

### 13.2.1 Structured selector storage rules

For both upload and edit:

- no selected `contentType` stores no `contentTypeSlug`
- no selected `genre` stores an empty `genreSlugs[]`
- selecting `other` stores the literal `other` slug

### 13.3 Component strategy

The UI should prefer existing shadcn source components and composition over bespoke controls.

Priority order:

1. existing installed shadcn components in `app/shared/ui`
2. new shadcn-generated components added through the project CLI workflow
3. mature external libraries with strong adoption if shadcn alone does not cover the behavior cleanly
4. thin custom glue only where earlier options do not satisfy the need

Examples of expected component usage:

- `Sheet`
- `Drawer`
- `Command`
- `Badge`
- `Button`
- `Input`
- `Separator`
- `Combobox`

The only likely custom surface is the freeform multi-tag input layer on top of these primitives, and even that should first be checked against mature library options before local glue is introduced.

For the first implementation pass, the dependency decision is:

- add missing shadcn-managed source as needed
- do not adopt a dedicated external tag-input library
- implement tag entry as a thin local composition over approved shadcn primitives

## 14. UX Implications

This design intentionally prioritizes:

- discoverability through tags
- low-friction upload
- explicit include and exclude semantics
- responsive filter UX
- future taxonomy evolution without schema redesign

## 15. Non-Goals

This design does not define:

- external metadata sync
- cast, director, studio, or provider metadata
- advanced series or franchise modeling
- a taxonomy editing admin UI
- runtime automatic re-seeding of operator-managed vocabulary values
- a custom design system outside shadcn and the current Tailwind token model

Those may be added later if the product proves they are necessary.

## 16. Decision Closure

For the first implementation pass, this design is closed.

That means:

- no further product-level metadata fields need to be invented before implementation starts
- no further home discovery UX decisions are required before implementation starts
- remaining questions are implementation and dependency-selection details, not product-spec gaps

Any future changes should be treated as explicit product changes, not as open ambiguity in this design.
