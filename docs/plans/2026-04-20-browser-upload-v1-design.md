# Browser Upload V1 Replacement Spec

Status: Historical design record for the implemented browser upload V1 rollout
Date: 2026-04-20
Owner: Codex planning pass
Scope: Replace the current folder-scan intake flow with a browser-based single-file upload flow in the active application structure.

Do not use this document as the current-state source of truth. Use `docs/roadmap/current-refactor-status.md` and the verification docs for live behavior.

## 1. Summary

This spec replaces the current `storage/uploads` + scan + pending-review intake model with a browser-first upload experience at `/add-videos`.

V1 is intentionally narrow:

- one file per upload session
- browser file picker plus drag-and-drop
- upload starts immediately after file selection
- upload and library commit remain separate steps
- no compatibility layer for folder scanning
- no resumable upload, queue manager, or multi-file batching

The page should feel like a real web upload flow, not an operator-facing server scan tool.

## 2. Scope

### In scope

- redefine `/add-videos` as a browser upload page
- remove folder-scan behavior from the active product flow
- preserve a deliberate `Add to Library` boundary
- keep route adapters thin and ingest-owned logic in the active module/composition structure
- keep the flow small enough to ship as a focused V1

### Out of scope

- multi-file upload
- resumable upload
- pause/resume/cancel upload manager
- folder upload
- background server folder watching
- compatibility support for dropping files into `storage/uploads`
- persistent pending-upload product behavior on home
- automatic library commit immediately after upload
- new metadata automation features
- playlist assignment during upload

## 3. Chosen Direction

The selected product direction is a **single-screen staged uploader**.

Flow:

1. The owner opens `/add-videos`.
2. The page presents a browser file picker and drag-and-drop target.
3. Selecting one file starts upload immediately.
4. A single upload card becomes the working surface for that file.
5. The owner reviews metadata and encoding options.
6. The owner explicitly clicks `Add to Library`.
7. The ingest pipeline processes the staged file into the library.

Rejected alternatives:

- **Two-screen wizard**: rejected because V1 does not need extra navigation overhead.
- **Auto-ingest immediately after upload**: rejected because metadata and encoding review still need an explicit pre-commit boundary.

## 4. Core Product Contract

### 4.1 Route meaning

`/add-videos` changes from:

- “scan the server uploads folder and add pending files”

to:

- “upload a video from the browser and then add it to the library”

### 4.2 Single-file rule

V1 supports exactly one selected file at a time.

Rules:

- if an active session exists, the page must not silently queue another file
- selecting or dropping multiple files at once is rejected with a clear validation message
- the active upload card remains the only working surface until the session completes or is removed

### 4.3 Upload and library commit are separate

Uploading a file to the server does **not** add it to the library.

`Add to Library` remains the only action that commits the staged upload into the ingest pipeline.

This distinction must be visible in UI status, action hierarchy, and error handling.

### 4.4 Metadata timing

Rules:

- upload starts immediately after file selection
- metadata fields may appear as soon as the upload card appears
- title, tags, description, and encoding options may be edited during upload as draft values
- `Add to Library` stays disabled until upload is complete and required metadata is valid

Required metadata validity means:

- `title` is required and must be non-empty after trimming
- `tags` are optional
- `description` is optional
- `encoding options` are required, but V1 may satisfy that requirement by pre-filling a default selection that the owner can change before commit

### 4.5 Accepted files

V1 accepts:

- `.mp4`
- `.avi`
- `.mkv`
- `.mov`
- `.webm`
- `.m4v`
- `.flv`
- `.wmv`

V1 supports files up to 4 GB.

The same limits must be shown in the UI and enforced on the server.

## 5. User Needs And Journey

### 5.1 User needs

- As the owner, I can choose one video from my computer and see upload begin immediately.
- As the owner, I can understand the allowed file types and size limit before upload starts.
- As the owner, I can review and edit metadata and encoding options before I commit the file into the library.
- As the owner, I can recover from an upload failure through a clear retry path.
- As the owner, I can retry `Add to Library` after a commit failure without re-uploading the file.
- As the owner, I can remove the current upload session and know that the staged file has been discarded.
- As the owner, I can understand why I cannot start a second upload while one active single-file session already exists.

### 5.2 Journey overview

The V1 journey is a single-screen transactional flow.

1. **Start**: the owner lands on `/add-videos` and sees a browser-first upload entry point.
2. **Choose**: the owner selects or drops one file and upload starts immediately.
3. **Upload**: the owner sees progress and may start drafting metadata while upload is still in progress.
4. **Review**: the owner continues or completes metadata review once the file is available in staging.
5. **Commit**: the owner chooses `Add to Library` only when upload is complete and required metadata is valid.
6. **Recover or finish**: if upload or add fails, the owner sees the correct retry path; if it succeeds, the owner gets confirmation and can begin a new session.

This journey is linear but **not** a wizard.

### 5.3 Journey acceptance criteria

- At start, the page clearly reads as browser upload, not server folder scan.
- Before upload starts, the owner can see accepted formats and the 4 GB limit.
- After file selection, upload starts immediately and visible feedback appears in the same working area.
- During upload, the owner can tell the file is not yet in the library.
- During upload, metadata drafting is allowed, but the file is not presented as ready for final commit.
- After upload succeeds, the owner can see why `Add to Library` is enabled or disabled.
- `Add to Library` stays disabled until upload completion and metadata validity are both satisfied.
- Upload failure presents `Retry Upload`.
- Add-to-library failure presents `Retry Add to Library`.
- Removing the session returns the page to a clean start state.
- Attempting multiple files produces a clear single-file-limit response instead of silent queueing.

### 5.4 User-story boundary

This spec intentionally does **not** lock down:

- final microcopy
- exact visual hierarchy
- exact spacing
- exact breakpoint layout
- detailed component choreography
- wizard-style progress navigation

The purpose of the journey layer is to orient implementation around user intent, not to replace detailed UI design work.

## 6. Screen Contract

This section defines the minimum screen-level contract needed to implement the page without inventing core UI behavior.

### 6.1 Page regions

The `/add-videos` page uses:

- **shell chrome**: existing page shell, navigation, and header context
- **page intro and status region**: title, short explanatory copy, and page-level status when needed
- **primary working surface**: one canonical surface showing either the empty upload entry state or the active upload/review state

The page must not split the flow across multiple panels, modals, or wizard steps in V1.

### 6.2 Region order

Within main content, the order is:

1. page title and brief explanatory copy
2. page-level status area when needed
3. one primary working surface

The working surface shows either:

- the empty upload entry state, or
- the active upload/review card

It must not show both as equal competing surfaces at the same time.

### 6.3 Action hierarchy

Each state has one visually primary action.

- **Empty state**: `Choose Video`
- **Uploading**: no commit action is primary; `Remove` remains secondary/destructive
- **Upload failed**: `Retry Upload`
- **Review / ready to add**: `Add to Library`
- **Add failed**: `Retry Add to Library`
- **Completed**: begin a new upload session

Pages with multiple equally strong calls to action violate the V1 contract.

### 6.4 State-to-surface presentation

- **Idle**: empty upload entry surface with `Choose Video`, drag-and-drop, and visible file constraints
- **Uploading**: one upload card with filename, progress indicator, transfer status, and metadata area in draft mode
- **Reviewing / ready to add**: same card, upload completion status inline, metadata editable, commit action near the form it submits
- **Upload failed**: same card in an error state with inline recovery action
- **Add failed**: same card in an error state, staged context preserved, inline retry for final commit
- **Completed**: success confirmation in the same working area, then the page is ready for a new single-file session

### 6.5 Feedback placement

- file-specific progress, error, retry, and success feedback belongs inside the active upload/review card
- page-level status is reserved for information that affects the whole page or session
- the UI must not rely on toast-only feedback for critical recovery actions

### 6.6 Layout flexibility boundary

This contract intentionally does not fix:

- exact grid columns
- exact iconography
- exact breakpoint layout
- exact microcopy

It does fix:

- which surface is primary
- which action is primary in each state
- where critical feedback must live
- that commit actions stay close to the form/state they operate on

## 7. State Model

### 7.1 Upload lifecycle

- `idle`
- `uploading`
- `upload_failed`
- `uploaded`

### 7.2 Ingest lifecycle

- `reviewing`
- `ready_to_add`
- `adding_to_library`
- `add_failed`
- `completed`

### 7.3 Required transitions

- `idle -> uploading`
- `uploading -> uploaded`
- `uploading -> upload_failed`
- `uploaded -> reviewing`
- `reviewing -> ready_to_add`
- `ready_to_add -> adding_to_library`
- `adding_to_library -> completed`
- `adding_to_library -> add_failed`

### 7.4 User-visible state meanings

- `reviewing`: upload finished but required metadata is incomplete or invalid
- `ready_to_add`: upload finished, required metadata is valid, commit action becomes enabled
- `add_failed`: upload is still valid, staged artifact still exists, primary recovery action becomes `Retry Add to Library`

### 7.5 State discipline

Upload state and ingest state are separate concerns.

The product must not behave as if:

- upload progress
- staged-file validity
- metadata validity
- library-ingest progress

are the same state.

### 7.6 Single-session rule

While any non-completed session exists, V1 disables new file selection and drag-and-drop. The only way to start another upload is to complete or remove the current session.

## 8. Failure And Recovery Contract

### 8.1 Validation timing

Validation occurs at two different points:

- upload acceptance validation
- add-to-library validation

These must be communicated separately.

### 8.2 Upload failure

Examples:

- unsupported file type
- rejected upload request
- interrupted upload

Rules:

- upload failures belong to the upload stage, not the ingest stage
- `Retry Upload` is the primary recovery action
- partial staged bytes are deleted immediately on upload failure
- retry starts a fresh protected upload attempt for the current single-file session
- upload retry creates a new staging identifier and does not reuse the failed upload identifier
- oversize or unsupported files should be rejected client-side when detectable, and must always be rejected server-side with a clear validation response

### 8.3 Add-to-library failure

Examples:

- missing title
- processing failure
- metadata write failure
- workspace/finalization failure

Rules:

- add-to-library failures belong to the ingest stage, not the transport stage
- `Retry Add to Library` is the primary recovery action
- the staged artifact is preserved and reused for retry
- add-to-library is idempotent by staging identifier
- if the first commit actually succeeded but the client did not observe the success, a retry must not create a duplicate library entry
- the idempotent retry path may return the already-created library video as a successful result for the same staging identifier

### 8.4 Remove and reset

- removing during upload cancels the upload and deletes staged bytes for that session
- removing after upload deletes the staged artifact and returns the page to the empty state
- if `Add to Library` fails, the staged artifact remains until the owner removes it or retries
- the UI must not imply that remove only clears local form state while leaving staged bytes behind

### 8.5 Success

On success:

- the page confirms that the video was added
- the current upload card is cleared or replaced by a success state
- the owner can start a new single-file session from the same page

### 8.6 Abandoned-session behavior

V1 does not guarantee browser-session recovery across reloads, tab closure, or browser restart.

Rules:

- a page reload or browser/tab close abandons the client-side session
- abandoned staged uploads are cleaned up server-side by a deterministic expiration policy
- the implementation plan must define that expiration as a TTL-based reaper, not as manual cleanup
- once the TTL expires, the staged artifact is invalid and cannot be committed
- after abandonment, the owner is expected to start a fresh upload session rather than rehydrate the old one in V1

## 9. Architecture And Replacement Boundaries

### 9.1 Route and module ownership

- `app/routes/*` stays thin
- `/add-videos` remains a route shell
- upload-specific server logic stays inside active ingest ownership:
  - `app/modules/ingest/*`
  - `app/composition/server/ingest.ts`
- upload and add-to-library write paths remain protected by the shared-password session boundary

### 9.2 Staged-upload identity contract

V1 replaces the old filename-driven intake contract with a staged-upload identifier contract.

Rules:

- browser-to-server upload is a protected single-request `multipart/form-data` upload
- the upload endpoint accepts exactly one file per request
- browser upload creates a staged upload artifact on the server
- the server returns a server-issued staging identifier
- `Add to Library` references the staged upload by that identifier, not by filename or path in `storage/uploads`
- duplicate filenames must not be used as the primary identity mechanism

The `Add to Library` request is a separate protected write request that submits:

- the staging identifier
- metadata fields
- encoding options

### 9.3 Wire contract

V1 fixes the high-level API shape so implementation does not need to invent it.

Protected upload request:

- `POST /api/uploads`
- content type: `multipart/form-data`
- one file field only

Protected upload success response:

- `success: true`
- `stagingId`
- `filename`
- `size`

Protected upload failure response:

- `success: false`
- machine-readable error code
- human-readable error message

Protected add-to-library request:

- `POST /api/uploads/:stagingId/commit`
- JSON body with:
  - `title`
  - `tags`
  - `description`
  - `encodingOptions`

Protected add-to-library success response:

- `success: true`
- `videoId`

Protected add-to-library retry behavior:

- if the same `stagingId` was already committed successfully, the endpoint returns a successful idempotent result for that same `videoId`
- the commit path must not create duplicate library entries for repeated requests using the same `stagingId`

### 9.4 Storage contract

The implementation plan may define exact paths later, but these rules are fixed:

- browser-uploaded bytes land in a server-owned staging location
- the staging location is not a user-managed drop folder
- each staged artifact has a server-issued identifier
- upload, staged-artifact lookup, and finalization remain behind protected owner session checks
- cancelled, removed, abandoned, and failed sessions clean up staged bytes deterministically
- abandoned cleanup uses a server-side TTL reaper policy

### 9.5 Replacement boundaries

The following are replacement or deletion targets, not compatibility surfaces:

- scan-incoming route and flow
- folder-scan ingest ports/adapters/use cases
- pending upload snapshot model built around scanned files
- upload-folder thumbnail enrichment designed around scanned files
- `Refresh`-based upload discovery UI
- page copy that instructs users to use the uploads folder
- home pending-upload indicator/count driven by the old model
- legacy scan-based API surfaces

The following active surfaces are expected to be deleted or fully rewritten around the new staged-upload contract:

- scan-incoming route path
- scan-incoming use case and scan adapter chain
- pending snapshot reader chain built for scanned uploads
- home pending-upload product behavior
- uploads-folder instructional copy in the add-videos UI
- `/api/scan-incoming` as a supported route contract

The future implementation plan must classify each affected surface as:

- delete
- replace
- rewrite around the staged-upload contract

The old scan-based route contract must not survive as a hidden supported API beside the new staged-upload contract.

### 9.6 Home and navigation behavior

V1 removes the product-level concept of pending uploads from the home page.

Therefore:

- the home pending-upload badge/count is removed
- the home page does not summarize staged uploads
- `/add-videos` becomes the only owner-facing upload workspace
- home composition must stop depending on ingest pending-upload services rather than merely hiding the badge

Navigation may continue to expose `/add-videos`, but its label and surrounding copy should reflect browser upload rather than server scanning.

## 10. Verification, Test Hygiene, And Documentation

### 10.1 Required verification posture

This is a browser-visible, runtime-sensitive change.

The future implementation plan must require:

- base verification bundle
  - `bun run lint`
  - `bun run typecheck`
  - `bun run test`
  - `bun run build`
- Docker CI-like verification for runtime-sensitive behavior
- browser-visible verification for the new upload flow

Browser coverage must explicitly include:

- selecting a file from the browser
- seeing upload progress or success feedback
- entering metadata during or after upload
- successfully adding the video to the library
- observing a clear failure state when upload or add-to-library fails

The implementation plan must not assume the current smoke set already covers upload, and must replace stale browser assertions or fixture setup that still encode the old pending-upload home behavior.

### 10.2 Hermetic test-data rules

Upload verification must remain hermetic.

Rules:

- do not rely on repo-local uploaded files
- do not rely on ambient `.env`
- do not rely on ignored `storage/` artifacts as the browser-upload fixture source
- use tracked fixtures or generated temporary test-owned assets
- use isolated runtime state for browser-visible upload verification
- ensure staged-upload identifiers and staged files are unique per test run or fully cleaned up between runs

### 10.3 Documentation follow-up

When implemented, update:

- current product state docs
- verification/testing docs if commands or expectations change
- README and operator-facing setup text that still mention the upload folder flow
- historical notes that describe the old intake contract without a clear historical label

## 11. Future Posture

V1 is deliberately small, but it should not block later additions such as:

- multi-file uploads
- richer upload queue state
- resumable upload
- background retry

To preserve that future safely, V1 already fixes:

- separate upload state and ingest state
- a distinct staged-upload artifact
- an explicit final library commit step

These are future-facing allowances, not current scope.

## 12. Implementation Acceptance Criteria

The future implementation plan should only count as complete if all of the following are true:

- the owner can upload one video directly from the browser at `/add-videos`
- upload starts immediately after selection or drop
- the owner can review metadata during or after upload, while final commit remains blocked until upload is complete
- `Add to Library` remains the explicit final commit step
- the old folder-scan flow is not reachable through active product paths
- active docs and tests no longer describe browser upload as if it were folder scanning
- the upload flow is covered by browser-visible verification
