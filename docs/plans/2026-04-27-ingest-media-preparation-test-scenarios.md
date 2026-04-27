# Ingest Media Preparation Test Scenario Specification

Status: Draft test scenario specification
Date: 2026-04-27
Owner: Codex planning pass
Related design: [Ingest Media Preparation Design](./2026-04-27-ingest-media-preparation-design.md)

## 1. Purpose

This document defines the test scenarios for the ingest media preparation redesign before implementation begins.

The product intent is not to build a general-purpose encoding platform. The owner wants a personal encrypted video vault that avoids unnecessary encoding, preserves common source codecs, and still produces protected DASH playback assets.

The core test contract is:

- H.264 and H.265/HEVC video should be preserved when preparation succeeds.
- AAC audio should be preserved.
- Non-AAC audio should be converted to AAC without video transcoding when the video is allowlisted.
- Non-allowlisted video should fall back to H.264.
- Failed preserve preparation should retry once with H.264/AAC fallback.
- Failed commits must not leave visible broken library records.
- User-provided legacy encoder options must not choose output codecs.

These tests are expected to be treated as product assets. They should document behavior in a way that a human maintainer or AI agent can read without reverse-engineering implementation details.

## 2. Testing Principles

### 2.1 Test contracts, not implementation mechanics

Tests should verify observable product contracts:

- selected preparation strategy
- generated output facts
- commit success or failure
- library visibility
- staged upload retryability
- playback request and player success

Tests should not couple to incidental internals such as private helper names, exact FFmpeg argument order beyond the externally meaningful flags, temporary variable names, or route implementation structure.

### 2.2 Keep test data relevant and explicit

Fixture builders should hide repetitive setup while keeping the facts that matter visible in each test. For example, a test should make it clear that the input is `hevc + ac3`, not hide that fact behind a generic "sample video" helper.

Good scenario names should read like requirements:

```text
preserves HEVC video and converts AC3 audio to AAC
falls back to H.264 when preserve packaging fails
ignores stale cpu-h265 option for an H.264 source
```

Bad scenario names describe implementation plumbing:

```text
calls buildCopyArgs
uses adapter option 2
returns strategy enum value
```

### 2.3 Cover realistic equivalence classes and edge paths

The test matrix should not only cover one happy-path MP4. It should cover already-compatible files, non-MP4 containers, audio-only differences, missing audio, non-allowlisted video, malformed metadata, stale request payloads, fallback paths, and late failure behavior.

The goal is not to test every codec in the world. The goal is to cover the meaningful decision boundaries in this product policy.

### 2.4 Layer tests by confidence and cost

Use fast pure tests for policy decisions. Use integration tests for repository, staged upload, workspace, FFmpeg/Shaka, metadata, and rollback contracts. Use browser/runtime tests only for behavior that cannot be proven without a real browser/player path.

The desired pyramid for this change is:

```text
many pure policy/parser tests
some infrastructure and commit integration tests
few browser/runtime playback smoke tests
Docker CI-like verification for runtime-sensitive ingest/playback behavior
```

### 2.5 Use hermetic fixtures

Tests must not depend on ignored local `storage/` media. Fixtures should be generated deterministically or checked in under a test-owned tracked surface.

The fixture suite should prefer tiny media files, for example 1-2 seconds at low resolution, so tests remain practical while still exercising real codecs and containers.

## 3. External Testing Guidance Used

This spec applies the following external guidance:

- Testing Library's guiding principle: tests should resemble how the software is used. See [Testing Library Guiding Principles](https://testing-library.com/docs/guiding-principles/).
- Testing Library recommends accessible/user-facing queries before test IDs for UI tests. See [Testing Library query priority](https://testing-library.com/docs/queries/about/#priority).
- Playwright recommends testing user-visible behavior, isolating tests, controlling database state, and preferring resilient user-facing locators. See [Playwright best practices](https://playwright.dev/docs/best-practices).
- Playwright fixtures encapsulate isolated setup and teardown. See [Playwright fixtures](https://playwright.dev/docs/test-fixtures).
- Playwright API testing can prepare server-side state and validate server-side postconditions without loading a page. See [Playwright API testing](https://playwright.dev/docs/api-testing).
- Vitest guidance emphasizes realistic edge cases, boundaries, mocking only slow or side-effecting dependencies, and writing regression tests that fail before the fix. See [Vitest testing in practice](https://main.vitest.dev/guide/learn/testing-in-practice).
- Google Testing Blog recommends including only details relevant to the test while hiding noise. See [Include Only Relevant Details In Tests](https://testing.googleblog.com/2023/10/include-only-relevant-details-in-tests.html).

## 4. Test Layers

### 4.1 Pure policy tests

Purpose:

- prove allowlist/fallback decisions without invoking FFmpeg, Shaka, filesystem, database, or HTTP
- make the source-codec product policy hard to accidentally change

Primary subject:

- the pure media preparation decision function

Assertions:

- selected strategy
- whether video is preserved or transcoded
- whether audio is preserved, transcoded, synthesized, or absent
- whether the input is rejected
- that legacy `encodingOptions` do not affect the selected output codec

Do not assert:

- exact FFmpeg args
- file paths
- adapter method call counts
- private helper invocation order

### 4.2 ffprobe analysis parser tests

Purpose:

- convert raw ffprobe JSON into the minimal analysis model used by the policy
- prevent malformed or incomplete ffprobe output from becoming false preserve eligibility

Primary subject:

- ffprobe JSON parser or adapter-level parser seam

Assertions:

- first video stream is selected
- first usable audio stream is selected
- missing audio is represented deliberately
- missing video causes policy rejection
- missing duration, missing codec names, and malformed JSON are handled predictably

### 4.3 FFmpeg/Shaka command contract tests

Purpose:

- prove each selected strategy maps to the intended external tool behavior
- keep command construction testable without running expensive media jobs for every case

Primary subject:

- argument builders or infrastructure adapter seams

Assertions:

- preserve/remux uses stream copy for allowlisted video
- audio-only transcode copies video and encodes audio to AAC
- silent-audio strategy copies allowlisted video and synthesizes AAC audio
- full fallback transcode encodes video with H.264 and audio with AAC
- copied AAC is normalized for MP4-family output when needed
- Shaka Packager receives raw-key CENC packaging inputs
- attempt output paths are isolated or cleaned before fallback

Do not assert:

- every argument's exact array index unless the external tool requires positional order for correctness
- internal function names

### 4.4 Infrastructure media fixture tests

Purpose:

- prove the real FFmpeg/Shaka path works for representative tiny fixtures
- catch integration bugs that pure command tests cannot catch

Primary subject:

- media preparation adapter using real generated fixtures and real local media tools

Assertions:

- expected output files exist
- manifest, key, init segments, and media segments are created
- ffprobe facts for prepared/packageable intermediate match the expected contract
- fallback output facts are H.264/AAC when fallback is expected
- preserve output facts keep H.264 or HEVC video when preserve is expected

These tests may be slower and can be grouped under focused integration commands if they require downloaded FFmpeg/Shaka binaries.

### 4.5 Commit use-case integration tests

Purpose:

- verify the full application workflow across staged upload, media analysis, media preparation, metadata writing, staged cleanup, and rollback

Primary subject:

- `CommitStagedUploadToLibraryUseCase` or the narrow composition-backed commit service

Assertions:

- successful commits create visible library metadata only after packaging succeeds
- staged upload is deleted or finalized only after success
- failed preparation restores staged upload retryability
- failed preparation removes partial workspace output
- late failure after media preparation does not leave a visible broken library row
- legacy `encodingOptions` are accepted but ignored for output policy

### 4.6 HTTP/API tests

Purpose:

- verify route-level request parsing, auth boundary, and compatibility behavior without opening a browser

Primary subject:

- upload commit route and protected playback asset routes

Assertions:

- unauthenticated commit is rejected
- authenticated commit accepts request bodies without `encodingOptions`
- authenticated commit tolerates stale valid `encodingOptions`
- malformed `encodingOptions` cannot crash the route or select output codec
- protected manifest, segment, and license routes still require the existing auth/token model

### 4.7 Browser/runtime tests

Purpose:

- prove that at least one newly uploaded and newly prepared video actually plays in the browser through the protected path

Primary subject:

- `/add-videos` upload flow and player route

Assertions:

- owner can upload a tracked/generated fixture
- commit completes
- player opens the newly created video
- playback token, manifest, license, audio, and video requests occur as expected
- player reports no fatal error
- `currentTime` advances

Browser tests should use user-facing locators and web-first assertions. They should not depend on CSS classes or private DOM structure.

## 5. Fixture Catalog

All media fixtures should be deterministic, tiny, and generated from tracked scripts when practical. Each fixture should document expected ffprobe facts.

| Fixture ID | Input facts | Purpose | Expected first strategy |
| --- | --- | --- | --- |
| `h264_aac_mp4` | MP4, H.264 video, AAC audio | primary preserve happy path | `remux_then_package` |
| `h264_aac_mkv` | MKV, H.264 video, AAC audio | container normalization without encoding | `remux_then_package` |
| `hevc_aac_mp4` | MP4, HEVC video, AAC audio | HEVC preserve happy path | `remux_then_package` |
| `hevc_aac_mkv` | MKV, HEVC video, AAC audio | HEVC preserve with remux | `remux_then_package` |
| `h264_ac3_mkv` | H.264 video, AC3 audio | audio-only transcode | `copy_video_transcode_audio` |
| `hevc_ac3_mkv` | HEVC video, AC3 audio | HEVC preserve plus audio-only transcode | `copy_video_transcode_audio` |
| `h264_no_audio_mp4` | H.264 video, no audio | silent AAC synthesis | `copy_video_synthesize_audio` |
| `hevc_no_audio_mp4` | HEVC video, no audio | HEVC preserve plus silent AAC synthesis | `copy_video_synthesize_audio` |
| `vp9_aac_webm_or_mkv` | VP9 video, AAC or Opus audio | non-allowlisted video fallback | `transcode_video_copy_audio` or `full_transcode` |
| `av1_aac_mp4` | AV1 video, AAC audio | non-allowlisted modern codec fallback | `transcode_video_copy_audio` |
| `xvid_mp3_avi` | Xvid-style video, MP3 audio | legacy download fallback | `full_transcode` |
| `audio_only_aac` | audio stream, no video | reject missing video | `reject` |
| `invalid_bytes` | not media | reject unreadable media | `reject` |

If generating AV1 or Xvid fixtures is too expensive or unreliable in CI, keep one representative non-allowlisted video fixture and record the skipped codec variants as follow-up test debt.

## 6. Policy Decision Matrix

### 6.1 Accepted video and accepted audio

Scenario: H.264 + AAC source.

- Given ffprobe reports primary video `h264` and primary audio `aac`
- When the policy chooses a strategy
- Then video should be preserved
- And audio should be preserved
- And the strategy should prepare/package without full video transcode

Scenario: HEVC + AAC source.

- Given ffprobe reports primary video `hevc` and primary audio `aac`
- When the policy chooses a strategy
- Then video should be preserved
- And audio should be preserved
- And the strategy should prepare/package without full video transcode

Scenario: accepted video in a non-MP4 container.

- Given ffprobe reports `h264` or `hevc` video with `aac` audio in MKV/MOV-like input
- When the policy chooses a strategy
- Then the strategy should remux/package instead of full transcode

### 6.2 Accepted video and non-AAC audio

Scenario: H.264 + AC3 source.

- Given ffprobe reports primary video `h264` and primary audio `ac3`
- When the policy chooses a strategy
- Then video should be preserved
- And audio should be transcoded to AAC

Scenario: HEVC + DTS source.

- Given ffprobe reports primary video `hevc` and primary audio `dts`
- When the policy chooses a strategy
- Then video should be preserved
- And audio should be transcoded to AAC

Scenario: accepted video with FLAC audio.

- Given ffprobe reports primary video `h264` or `hevc` and primary audio `flac`
- When the policy chooses a strategy
- Then video should be preserved
- And audio should be transcoded to AAC

### 6.3 Accepted video and missing audio

Scenario: H.264 video with no audio.

- Given ffprobe reports primary video `h264`
- And no usable audio stream exists
- When the policy chooses a strategy
- Then video should be preserved
- And silent AAC should be synthesized

Scenario: HEVC video with no audio.

- Given ffprobe reports primary video `hevc`
- And no usable audio stream exists
- When the policy chooses a strategy
- Then video should be preserved
- And silent AAC should be synthesized

### 6.4 Non-allowlisted video

Scenario: VP9 + AAC source.

- Given ffprobe reports primary video `vp9`
- And primary audio `aac`
- When the policy chooses a strategy
- Then video should fall back to H.264
- And AAC audio may be copied or normalized

Scenario: AV1 + AAC source.

- Given ffprobe reports primary video `av1`
- And primary audio `aac`
- When the policy chooses a strategy
- Then video should fall back to H.264
- And AAC audio may be copied or normalized

Scenario: Xvid + MP3 source.

- Given ffprobe reports a legacy non-allowlisted video codec and non-AAC audio
- When the policy chooses a strategy
- Then full H.264/AAC transcode should be selected

Scenario: unknown video codec.

- Given ffprobe reports a video codec that is not `h264` or `hevc`
- When the policy chooses a strategy
- Then source video should not be preserved
- And fallback output should be H.264/AAC if preparation succeeds

### 6.5 Missing or malformed analysis

Scenario: no video stream.

- Given ffprobe reports audio streams but no video stream
- When the policy chooses a strategy
- Then the commit should be rejected
- And no media workspace should become visible in the library

Scenario: missing video codec name.

- Given ffprobe reports a primary video stream without `codec_name`
- When the policy chooses a strategy
- Then preserve eligibility should be false
- And the strategy should reject or choose fallback according to implementation policy

Scenario: malformed ffprobe JSON.

- Given the analysis adapter receives invalid JSON
- When parsing analysis
- Then parsing should fail with a controlled error
- And commit failure handling should leave the staged upload retryable

Scenario: missing duration.

- Given ffprobe reports valid streams but missing duration
- When parsing analysis
- Then strategy selection should still be possible if stream facts are valid
- And metadata duration behavior should be explicit rather than silently wrong

## 7. Legacy Encoder Option Scenarios

The old upload UI and clients may still send `encodingOptions`. Those values are compatibility input only; they must not choose output codec.

Scenario: stale `cpu-h265` with H.264 source.

- Given the source video is H.264
- And the commit request includes `encodingOptions.encoder = "cpu-h265"`
- When commit runs
- Then the output video should preserve H.264
- And the request option should not force HEVC output

Scenario: stale `cpu-h264` with HEVC source.

- Given the source video is HEVC
- And the commit request includes `encodingOptions.encoder = "cpu-h264"`
- When commit runs
- Then the output video should preserve HEVC if preserve preparation succeeds
- And the request option should not force H.264 fallback

Scenario: stale `gpu-h264` with non-allowlisted source.

- Given the source video is VP9, AV1, Xvid, or another non-allowlisted codec
- And the commit request includes `encodingOptions.encoder = "gpu-h264"`
- When commit runs
- Then the output video should be fallback H.264
- And hardware acceleration must not be assumed unless a later explicit policy adds it

Scenario: malformed `encodingOptions`.

- Given the commit request includes malformed or unexpected `encodingOptions`
- When the route parses the request
- Then the request should not crash from unsafe casts
- And output policy should still be derived from source media analysis

Scenario: missing `encodingOptions`.

- Given the commit request omits `encodingOptions`
- When commit runs
- Then behavior should be identical to the same source with ignored legacy options

## 8. Fallback And Failure Scenarios

Scenario: preserve remux fails before packaging.

- Given an allowlisted H.264 or HEVC input
- And FFmpeg remux/preparation fails
- When commit runs
- Then the system should attempt one H.264/AAC fallback transcode
- And partial preserve output should not be mixed with fallback output

Scenario: Shaka packaging fails after preserve preparation.

- Given preserve preparation succeeds
- And Shaka Packager fails
- When commit runs
- Then the system should clean or isolate the failed attempt
- And attempt one H.264/AAC fallback transcode and package

Scenario: fallback transcode fails.

- Given preserve preparation fails
- And fallback H.264/AAC transcode also fails
- When commit returns
- Then no visible library row should exist
- And the staged upload should remain retryable
- And partial workspace output should be removed or isolated from later retry

Scenario: failure after packaging before metadata write.

- Given media assets have been created
- And a later pre-metadata finalization step fails
- When commit returns
- Then no visible library row should exist
- And staged upload retryability should be preserved

Scenario: failure after metadata write.

- Given metadata has become visible
- And a later commit step fails
- When commit returns
- Then the visible library row should be rolled back or the state should be idempotently retryable according to the selected implementation strategy

Scenario: retry after failed commit.

- Given a previous commit attempt failed after creating partial workspace output
- When the owner retries the same staged upload
- Then the retry should not collide with stale output
- And the final result should match the same contract as a clean first attempt

## 9. Output Contract Scenarios

Scenario: preserved H.264 output.

- Given an H.264/AAC source succeeds through preserve preparation
- When output is inspected
- Then packaged video should remain H.264
- And packaged audio should be AAC
- And DASH/CENC assets should exist in the stable output layout

Scenario: preserved HEVC output.

- Given a HEVC/AAC source succeeds through preserve preparation
- When output is inspected
- Then packaged video should remain HEVC
- And packaged audio should be AAC
- And DASH/CENC assets should exist in the stable output layout

Scenario: audio-only conversion output.

- Given an allowlisted video source with non-AAC audio
- When output is inspected
- Then video should remain H.264 or HEVC according to source
- And audio should be AAC

Scenario: fallback output.

- Given a non-allowlisted video source succeeds through fallback
- When output is inspected
- Then video should be H.264
- And audio should be AAC

Scenario: no direct source exposure.

- Given commit succeeds for any supported source
- When storage is inspected
- Then protected DASH output should be present
- And playback should use manifest, segment, token, and license routes rather than direct source-file serving

## 10. Browser Playback Scenarios

Scenario: newly uploaded H.264 preserve video plays.

- Given the owner uploads an H.264/AAC fixture through the browser flow
- When commit succeeds and the owner opens the player route
- Then the player should request token, manifest, license, video, and audio resources
- And playback should advance without a fatal player error

Scenario: newly uploaded HEVC preserve video plays on target Chromium.

- Given the owner uploads a HEVC/AAC fixture through the browser flow
- When commit succeeds and the owner opens the player route in target Chromium/Edge
- Then playback should advance without a fatal player error

Scenario: newly uploaded fallback video plays.

- Given the owner uploads a non-allowlisted video fixture
- When commit succeeds through H.264/AAC fallback
- Then the player should play the newly prepared output

Scenario: browser-visible upload UI no longer exposes codec selection.

- Given the owner opens the add-videos flow
- When the upload form is visible
- Then it should not ask the owner to choose H.264, H.265, CPU, or GPU
- And metadata controls should remain available

## 11. Security And Auth Scenarios

Scenario: unauthenticated commit is rejected.

- Given no valid owner session exists
- When a client posts to the upload commit route
- Then the request should be rejected
- And no media preparation should run

Scenario: protected manifest access requires auth/token contract.

- Given a video has been prepared
- When a client requests the manifest without the expected auth/token context
- Then access should be denied according to the existing playback security model

Scenario: ClearKey license route remains protected.

- Given a player requests the license for a prepared video
- When the request lacks the expected authenticated playback context
- Then the license should not be exposed

Scenario: encrypted output contract remains intact.

- Given media preparation succeeds
- When output files are inspected
- Then `manifest.mpd`, `key.bin`, init segments, and media segments should exist
- And the source upload should not become a directly served library asset

## 12. Test Data And Helper Design

Fixture helpers should make relevant media facts explicit:

```ts
fixture("hevc_ac3_mkv")
```

is preferable to:

```ts
fixture("sample2")
```

Scenario helper names should describe contracts:

```ts
expectPreparedVideoCodec(result, "hevc")
expectPreparedAudioCodec(result, "aac")
expectCommitLeftNoVisibleLibraryRow()
expectStagedUploadRetryable()
```

Helpers should hide:

- temporary directory creation
- fixture generation boilerplate
- auth seeding boilerplate
- repetitive ffprobe invocation
- cleanup

Helpers should not hide:

- source codec facts
- expected strategy
- expected output codec facts
- expected commit visibility and retry behavior

## 13. Required Verification Gates

Documentation-only changes still follow the repository verification contract before handoff when practical:

```bash
bun run lint
bun run typecheck
bun run test
bun run build
```

Implementation of this feature is runtime-sensitive because it touches storage, ingest route behavior, FFmpeg/Shaka packaging, and protected playback assets. Before implementation handoff, run:

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run verify:ci-faithful:docker
```

or:

```bash
bun run verify:ci-worktree:docker
```

When the browser-visible upload flow or player flow changes, also run:

```bash
bun run verify:e2e-smoke
```

Escalate to Playwright MCP or equivalent isolated browser QA when HTTP checks and the standard smoke suite cannot directly prove the playback success condition.

## 14. First Implementation Test Order

Recommended order:

1. Add pure policy tests first.
2. Add ffprobe parser tests.
3. Add command contract tests for each strategy.
4. Add fixture generation or tracked tiny fixtures.
5. Add infrastructure media fixture tests for preserve, audio-only, no-audio, fallback, and failure cleanup.
6. Add commit use-case integration tests for success, failure, rollback, and retry.
7. Add route/API tests for request compatibility and auth boundaries.
8. Add browser/runtime smoke for newly prepared playback.
9. Remove or simplify encoder UI after backend behavior is protected by tests.

This order forces the architecture to expose stable seams for policy, analysis, media preparation, and commit state transitions before UI changes hide the old encoder choices.

## 15. Explicit Non-Goals For The Test Suite

- Do not test every codec, container, or browser in existence.
- Do not add brittle tests for private helper names or exact internal call order.
- Do not rely on local personal media files.
- Do not require long high-resolution fixtures.
- Do not make Playwright prove every policy branch when faster module or integration tests can prove the same contract.
- Do not treat code coverage percentage as a substitute for meaningful scenario coverage.

## 16. Scenario Checklist

- [ ] H.264 + AAC preserve
- [ ] HEVC + AAC preserve
- [ ] H.264 + AAC non-MP4 remux
- [ ] HEVC + AAC non-MP4 remux
- [ ] H.264 + non-AAC audio converts audio only
- [ ] HEVC + non-AAC audio converts audio only
- [ ] H.264 without audio synthesizes silent AAC
- [ ] HEVC without audio synthesizes silent AAC
- [ ] VP9 or AV1 video falls back to H.264
- [ ] legacy Xvid-style input falls back to H.264/AAC
- [ ] audio-only input rejects
- [ ] invalid bytes reject
- [ ] missing codec name does not create false preserve eligibility
- [ ] malformed ffprobe output fails safely
- [ ] missing `encodingOptions` works
- [ ] stale `cpu-h265` does not force HEVC
- [ ] stale `cpu-h264` does not force H.264 for HEVC source
- [ ] malformed `encodingOptions` is ignored safely
- [ ] preserve remux failure falls back once
- [ ] Shaka packaging failure after preserve falls back once
- [ ] fallback failure leaves no visible library row
- [ ] staged upload remains retryable after failure
- [ ] retry cleans or isolates stale partial output
- [ ] successful output keeps protected DASH/CENC layout
- [ ] unauthenticated commit is rejected
- [ ] protected playback assets remain protected
- [ ] newly uploaded H.264 preserve video plays in browser smoke
- [ ] newly uploaded HEVC preserve video plays in target browser smoke or documented target-browser QA
- [ ] newly uploaded fallback video plays in browser smoke
- [ ] upload UI no longer exposes codec selection
