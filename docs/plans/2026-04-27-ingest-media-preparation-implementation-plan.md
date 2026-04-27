# Ingest Media Preparation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace always-transcode ingest with a test-first media preparation pipeline that preserves H.264/HEVC video when possible, preserves AAC audio, converts only what is needed, and falls back to H.264/AAC when preserve preparation fails.

**Architecture:** Keep the commit route thin and move product policy into ingest application/domain code. FFprobe analysis produces stream facts once, a pure policy selects a preparation strategy, and the FFmpeg/Shaka infrastructure executes that strategy with one H.264/AAC fallback retry. The upload UI stops exposing codec choices; legacy request options are accepted only for compatibility and cannot choose output codecs.

**Tech Stack:** Bun 1.3.5, TypeScript strict mode, React Router v7, Vitest, Playwright, FFmpeg/ffprobe, Shaka Packager, SQLite/libsql, dash.js/ClearKey playback.

---

## 1. Source Artifacts

Read these before implementation:

- `docs/plans/2026-04-27-ingest-media-preparation-design.md`
- `docs/plans/2026-04-27-ingest-media-preparation-test-scenarios.md`
- `docs/verification-contract.md`
- `docs/browser-qa-contract.md`
- `docs/E2E_TESTING_GUIDE.md`
- `docs/clearkey-investigation.md`

Primary implementation intent:

- H.264 and H.265/HEVC video are preserve-allowlisted.
- AAC audio is preserve-allowlisted.
- Non-AAC audio is converted to AAC while preserving allowlisted video.
- Non-allowlisted video falls back to H.264.
- Preserve preparation failure retries once with H.264/AAC fallback.
- Legacy `encodingOptions` must not choose output codec.
- The normal upload UI must not ask the owner to choose H.264, H.265, CPU, GPU, bitrate, CRF, or segment settings.

## 2. Codebase Survey

### 2.1 Current ingest flow

- `app/routes/api.uploads.ts`
  - `createUploadsAction` streams one multipart upload into staging.
- `app/routes/api.uploads.$stagingId.commit.ts`
  - `createUploadCommitAction` validates the protected API session, parses metadata, unsafe-casts `encodingOptions`, and calls the commit use case.
- `app/composition/server/ingest.ts`
  - `createServerIngestServices` wires staged upload repository/storage, ffprobe analysis, metadata writer, and FFmpeg processing.
- `app/modules/ingest/application/use-cases/commit-staged-upload-to-library.usecase.ts`
  - acquires a commit lease, reserves `videoId`, analyzes duration, processes video, writes metadata, marks staged upload committed, deletes staged source, and finalizes the thumbnail.
  - failure cleanup removes the video workspace and restores staged status to `uploaded`.
- `app/modules/ingest/infrastructure/analysis/ffprobe-ingest-video-analysis.adapter.ts`
  - already runs ffprobe with `-show_format -show_streams` but returns only `{ duration }`.
- `app/modules/ingest/infrastructure/processing/ffmpeg-ingest-video-processing.adapter.ts`
  - maps current encoder options into transcoder input and delegates to `FfmpegVideoTranscoderAdapter`.
- `app/modules/ingest/infrastructure/processing/ffmpeg-video-transcoder.adapter.ts`
  - always creates `intermediate.mp4` by encoding video and AAC audio, then runs Shaka Packager and verifies output.
- `app/modules/ingest/infrastructure/processing/ingest-processing-encoding-policy.ts`
  - currently lets stale `cpu-h265`/`gpu-h265` choose H.265 output; this conflicts with the new contract.

### 2.2 Current upload UI/API surface

- `app/widgets/add-videos/model/useAddVideosView.ts`
  - stores `metadata.encodingOptions`, exposes `handleEncodingOptionsChange`, and always sends `encodingOptions` in the commit body.
- `app/widgets/add-videos/ui/AddVideosView.tsx`
  - renders `AddVideosEncodingOptions` after metadata fields.
- `app/pages/add-videos/ui/AddVideosPage.tsx`
  - wires `handleEncodingOptionsChange` into `AddVideosView`.
- `app/features/add-videos-encoding/*`
  - owns the four-card H.264/H.265 CPU/GPU picker.

### 2.3 Current tests and reusable helpers

- Pure/module tests live under `app/modules/**/*.{test,spec}.ts`.
- Integration tests live under `tests/integration/**`.
- UI DOM tests live under `tests/ui/**`.
- Browser smoke lives under `tests/e2e/**`.
- `tests/e2e/add-videos-owner-upload-smoke.spec.ts` uploads and commits `tests/fixtures/upload/smoke-upload.mp4` but does not open the newly created player route.
- `tests/e2e/player-playback-compatibility.spec.ts` proves seeded packaged playback fixtures can play but does not prove newly uploaded/prepared media can play.
- `tests/support/create-runtime-test-workspace.ts` creates isolated runtime storage and seeds packaged playback fixtures.
- `scripts/verify-hermetic-test-inputs.ts` rejects hidden fixture coupling to ignored repo-local `storage/`.

## 3. Closed Design Decisions

These are implementation decisions closed by the design, test spec, repository structure, or best practice. Do not reopen them during implementation unless a failing test proves the decision is impossible.

1. **Legacy encoder options are ignored.**
   - Keep accepting stale request payloads for compatibility, but do not forward them into output policy.
   - The route may parse them defensively, but source media analysis owns strategy selection.

2. **Delete the normal encoder picker UI.**
   - Remove `app/features/add-videos-encoding/*` unless a compiler reference remains.
   - Do not replace it with an advanced drawer.

3. **Use a pure allowlist policy.**
   - Place the policy in ingest domain/application code.
   - Do not put source-codec product decisions inside the FFmpeg adapter.

4. **Avoid complex profile/pixel-format gates in v1.**
   - Policy uses `codec_name` for H.264/HEVC preserve eligibility.
   - Add deeper gates only later with real failing fixtures.

5. **Use cleanup-before-retry for preparation attempts.**
   - Because each `videoId` owns a fresh workspace, a simple workspace-output cleanup before fallback is enough.
   - Do not introduce attempt directories unless cleanup proves insufficient.

6. **Use compensating metadata rollback.**
   - Extend the ingest metadata writer port with a delete method and call it if failure occurs after metadata becomes visible.
   - The underlying SQLite repository already exposes delete behavior, so this is the smallest reliable rollback mechanism.
   - Rollback must be best-effort and must not mask the original commit failure or prevent staged upload restoration.

7. **Keep real media fixture generation tiny and hermetic.**
   - Generated fixtures must come from tracked scripts/helpers and temporary output paths.
   - Do not depend on ignored local media in `storage/`.

8. **Backend HEVC preservation is required; browser HEVC playback is not a CI requirement unless approved.**
   - Backend tests must prove HEVC preserve behavior in a CI-faithful way.
   - If generated HEVC fixtures cannot be made reliable in Docker, add a tiny tracked HEVC fixture instead of making the behavior optional.
   - Browser HEVC playback remains a target-browser QA concern unless the owner explicitly approves it as a required CI smoke assertion.

9. **UI simplification lands after backend behavior is protected.**
   - Remove the encoder picker only after policy, adapter, fallback, rollback, and newly uploaded playback tests are green.
   - This keeps stale request compatibility independently verifiable while backend behavior changes.

## 4. Human-Gated Decisions

These require owner confirmation before or during implementation.

1. **Should HEVC browser playback be required in the CI smoke suite?**
   - Recommendation: do not make HEVC browser playback a required Docker CI gate initially because CI Chromium may not have reliable HEVC decode support.
   - Instead, require H.264 newly uploaded playback in `verify:e2e-smoke`, and document HEVC target-browser QA as a manual/Playwright-MCP check on the owner's machines.

2. **Should generated fixture files be committed or generated on demand?**
   - Recommendation: generate on demand for the broad media matrix to avoid binary bloat.
   - Keep the existing tracked `tests/fixtures/upload/smoke-upload.mp4` for the baseline upload smoke unless HEVC smoke becomes required.

3. **Should hardware acceleration remain completely out of scope?**
   - Recommendation: yes. Treat GPU behavior as out of scope for this implementation and remove current GPU-facing UI semantics.

## 5. Target File Map

### Create

- `app/modules/ingest/application/ports/ingest-video-analysis.port.ts`
- `app/modules/ingest/application/ports/ingest-media-preparation.port.ts`
- `app/modules/ingest/domain/media-preparation-policy.ts`
- `app/modules/ingest/domain/media-preparation-policy.test.ts`
- `app/modules/ingest/infrastructure/processing/ffmpeg-media-preparation.adapter.ts`
- `app/shared/lib/server/shaka-packager-playback-assets.server.ts`
- `tests/support/ingest-media-fixtures.ts`

### Modify

- `app/composition/server/ingest.ts`
- `app/modules/ingest/application/ports/ingest-video-metadata-writer.port.ts`
- `app/modules/ingest/application/use-cases/commit-staged-upload-to-library.usecase.ts`
- `app/modules/ingest/application/use-cases/commit-staged-upload-to-library.usecase.test.ts`
- `app/modules/ingest/infrastructure/analysis/ffprobe-ingest-video-analysis.adapter.ts`
- `app/modules/library/infrastructure/sqlite/sqlite-canonical-video-metadata.adapter.ts`
- `app/modules/playback/infrastructure/backfill/browser-compatible-playback-backfill.ts`
- `app/routes/api.uploads.$stagingId.commit.ts`
- `app/widgets/add-videos/model/useAddVideosView.ts`
- `app/widgets/add-videos/ui/AddVideosView.tsx`
- `app/pages/add-videos/ui/AddVideosPage.tsx`
- `tests/integration/ingest/upload-commit-route.test.ts`
- `tests/integration/modules/ingest/ffprobe-ingest-video-analysis.adapter.test.ts`
- `tests/integration/modules/ingest/ffmpeg-ingest-video-processing.adapter.test.ts`
- `tests/integration/modules/ingest/ffmpeg-video-transcoder.adapter.test.ts`
- `tests/ui/add-videos/use-add-videos-view.test.tsx`
- `tests/ui/add-videos/add-videos-view-parity.test.tsx`
- `tests/e2e/add-videos-owner-upload-smoke.spec.ts`
- `package.json`

### Delete after migration if unused

- `app/features/add-videos-encoding/model/add-videos-encoding-option-metadata.ts`
- `app/features/add-videos-encoding/model/add-videos-encoding-options.ts`
- `app/features/add-videos-encoding/ui/AddVideosEncodingOptions.tsx`
- `app/modules/ingest/infrastructure/processing/ingest-processing-encoding-policy.ts`
- `app/modules/ingest/infrastructure/processing/ffmpeg-ingest-video-processing.adapter.ts`
- `app/modules/ingest/infrastructure/processing/ingest-video-transcoder.ts`
- `app/modules/ingest/infrastructure/processing/ffmpeg-video-transcoder.adapter.ts`
- `app/modules/ingest/application/ports/ingest-video-processing.port.ts`
- stale tests that only assert encoder-option mapping, after their behavioral replacement tests are green

## 6. Implementation Tasks

### Task 1: Add the pure media preparation policy

**Files:**

- Create: `app/modules/ingest/domain/media-preparation-policy.ts`
- Create: `app/modules/ingest/domain/media-preparation-policy.test.ts`

**Step 1: Write failing policy tests**

Cover these cases:

- `h264 + aac` selects `remux_then_package`
- `hevc + aac` selects `remux_then_package`
- `h264 + ac3` selects `copy_video_transcode_audio`
- `hevc + dts` selects `copy_video_transcode_audio`
- `h264` with no audio selects `copy_video_synthesize_audio`
- `hevc` with no audio selects `copy_video_synthesize_audio`
- `vp9 + aac` selects `transcode_video_copy_audio`
- `av1 + aac` selects `transcode_video_copy_audio`
- `xvid + mp3` selects `full_transcode`
- missing video selects `reject`
- missing video codec does not create preserve eligibility

Suggested contract shape:

```ts
export interface IngestMediaAnalysis {
  containerFormat?: string;
  duration: number;
  primaryAudio?: {
    codecName?: string;
    streamIndex: number;
  };
  primaryVideo?: {
    codecName?: string;
    height?: number;
    streamIndex: number;
    width?: number;
  };
}

export type IngestMediaPreparationStrategy =
  | 'remux_then_package'
  | 'copy_video_transcode_audio'
  | 'copy_video_synthesize_audio'
  | 'transcode_video_copy_audio'
  | 'full_transcode'
  | 'reject';

export function selectIngestMediaPreparationStrategy(
  analysis: IngestMediaAnalysis,
): IngestMediaPreparationStrategy;
```

`IngestMediaAnalysis` is domain-owned in this module. Application ports may import or re-export it, but they must not redefine a duplicate shape.

**Step 2: Run the focused test and verify it fails**

```bash
bun run test:modules -- app/modules/ingest/domain/media-preparation-policy.test.ts
```

Expected before implementation: tests fail because the module does not exist.

**Step 3: Implement the minimal policy**

Rules:

- lower-case codec names before comparing
- accepted video codecs: `h264`, `hevc`
- accepted audio codecs: `aac`
- missing video or missing video codec: `reject`
- accepted video + missing audio: `copy_video_synthesize_audio`
- accepted video + AAC audio: `remux_then_package`
- accepted video + non-AAC audio: `copy_video_transcode_audio`
- non-allowlisted video + AAC audio: `transcode_video_copy_audio`
- non-allowlisted video + non-AAC or missing audio: `full_transcode`

**Step 4: Run focused tests**

```bash
bun run test:modules -- app/modules/ingest/domain/media-preparation-policy.test.ts
```

Expected: policy tests pass.

### Task 2: Extend ffprobe analysis to stream facts

**Files:**

- Create: `app/modules/ingest/application/ports/ingest-video-analysis.port.ts`
- Modify: `app/modules/ingest/infrastructure/analysis/ffprobe-ingest-video-analysis.adapter.ts`
- Modify: `tests/integration/modules/ingest/ffprobe-ingest-video-analysis.adapter.test.ts`

**Step 1: Write failing parser tests**

Add tests for:

- duration + first video + first audio stream
- no audio returns `primaryAudio: undefined`
- first usable audio skips non-audio streams
- no video keeps `primaryVideo: undefined`
- invalid JSON throws a readable parse error
- missing or non-finite duration throws or returns explicit controlled behavior consistent with current duration contract

Example assertion:

```ts
await expect(adapter.analyze('/workspace/video.mkv')).resolves.toEqual({
  containerFormat: 'matroska,webm',
  duration: 120.25,
  primaryAudio: {
    codecName: 'aac',
    streamIndex: 1,
  },
  primaryVideo: {
    codecName: 'hevc',
    height: 720,
    streamIndex: 0,
    width: 1280,
  },
});
```

**Step 2: Add the analysis port**

Create `app/modules/ingest/application/ports/ingest-video-analysis.port.ts` as the application-facing analyzer contract and import the domain-owned `IngestMediaAnalysis` type.

```ts
import type { IngestMediaAnalysis } from '~/modules/ingest/domain/media-preparation-policy';

export interface IngestVideoAnalysisPort {
  analyze(inputPath: string): Promise<IngestMediaAnalysis>;
}
```

The use case and adapter should stop using an inline `{ duration: number }` interface.

**Step 3: Implement parsing**

Parse ffprobe JSON fields:

- `format.duration`
- `format.format_name`
- `streams[].index`
- `streams[].codec_type`
- `streams[].codec_name`
- `streams[].width`
- `streams[].height`

Keep parsing minimal. Do not add profile, pixel format, field order, HDR metadata, or level in v1.

**Step 4: Run focused tests**

```bash
bun run test:integration -- tests/integration/modules/ingest/ffprobe-ingest-video-analysis.adapter.test.ts
```

Expected: parser tests pass.

### Task 3: Make legacy encoding options accepted but ignored

**Files:**

- Modify: `app/routes/api.uploads.$stagingId.commit.ts`
- Modify: `app/modules/ingest/application/use-cases/commit-staged-upload-to-library.usecase.ts`
- Modify: `tests/integration/ingest/upload-commit-route.test.ts`
- Modify: `app/modules/ingest/application/use-cases/commit-staged-upload-to-library.usecase.test.ts`

**Step 1: Write failing route tests**

Add tests:

- unauthenticated commit returns the auth response and does not call the commit use case
- request without `encodingOptions` forwards metadata and succeeds
- request with stale valid `encodingOptions` succeeds but does not forward options to the use case
- request with malformed `encodingOptions` succeeds and does not throw

Expected use-case command after route parsing should not include `encodingOptions`.

**Step 2: Update route parser**

Remove unsafe cast:

```ts
if (
  body.encodingOptions &&
  typeof body.encodingOptions === 'object' &&
  'encoder' in body.encodingOptions
) {
  command.encodingOptions = body.encodingOptions as CommitStagedUploadToLibraryCommand['encodingOptions'];
}
```

Replace with defensive ignore:

```ts
// Legacy clients may still send encodingOptions. Output policy is source-codec based.
void body.encodingOptions;
```

or omit any handling entirely after documenting route test coverage.

**Step 3: Remove command-level output control**

Remove `encodingOptions` from `CommitStagedUploadToLibraryCommand` once processing no longer needs it. If this causes too much churn before Task 4, leave the property temporarily but do not set it from the route.

**Step 4: Run focused tests**

```bash
bun run test:integration -- tests/integration/ingest/upload-commit-route.test.ts
bun run test:modules -- app/modules/ingest/application/use-cases/commit-staged-upload-to-library.usecase.test.ts
```

Expected: route/use-case tests pass.

### Task 4: Wire strategy selection through the application use case

**Files:**

- Create: `app/modules/ingest/application/ports/ingest-media-preparation.port.ts`
- Modify: `app/modules/ingest/application/use-cases/commit-staged-upload-to-library.usecase.ts`
- Modify: `app/composition/server/ingest.ts`
- Modify: `app/modules/ingest/application/use-cases/commit-staged-upload-to-library.usecase.test.ts`

**Step 1: Define the application preparation port**

Product strategy selection belongs in the application flow, not inside the FFmpeg adapter. Create the port in the application layer and have infrastructure implement it later.

```ts
import type {
  IngestMediaAnalysis,
  IngestMediaPreparationStrategy,
} from '~/modules/ingest/domain/media-preparation-policy';

export interface PrepareIngestMediaCommand {
  analysis: IngestMediaAnalysis;
  sourcePath: string;
  strategy: IngestMediaPreparationStrategy;
  title: string;
  videoId: string;
  workspaceRootDir?: string;
}

export type IngestMediaPreparationResult =
  | {
    data: {
      manifestPath: string;
      thumbnailPath: string;
      videoId: string;
    };
    success: true;
  }
  | {
    error: Error;
    success: false;
  };

export interface FinalizeSuccessfulPreparedMediaCommand {
  title: string;
  videoId: string;
}

export interface IngestMediaPreparationPort {
  finalizeSuccessfulMedia(command: FinalizeSuccessfulPreparedMediaCommand): Promise<void>;
  prepare(command: PrepareIngestMediaCommand): Promise<IngestMediaPreparationResult>;
}
```

**Step 2: Write failing use-case tests for analysis and strategy wiring**

Add tests that assert:

- one analysis result is passed to media preparation
- the same analysis duration is used for metadata
- H.264/AAC analysis causes `strategy: 'remux_then_package'`
- HEVC/AAC analysis causes `strategy: 'remux_then_package'`
- VP9/AAC analysis causes `strategy: 'transcode_video_copy_audio'`
- missing video analysis rejects without calling media preparation
- preparation failure restores the staged upload and removes the workspace

**Step 3: Update the use case**

Replace the old `videoProcessing` dependency with `mediaPreparation: IngestMediaPreparationPort`.

```ts
const analysis = await this.deps.videoAnalysis.analyze(stagedUpload.storagePath);
const strategy = selectIngestMediaPreparationStrategy(analysis);

if (strategy === 'reject') {
  return this.createUnavailableResult({
    message: 'Uploaded file does not contain a usable video stream',
    stagingId: command.stagingId,
    workspaceRootDir,
  });
}

const prepared = await this.deps.mediaPreparation.prepare({
  analysis,
  sourcePath: stagedUpload.storagePath,
  strategy,
  title: trimmedTitle,
  videoId,
  workspaceRootDir,
});
```

**Step 4: Update composition**

Wire the new port to the FFmpeg/Shaka implementation added in Task 5. During TDD, a test fake can satisfy the port before the concrete adapter exists.

**Step 5: Remove stale processing port usage**

After the use case and composition depend on `IngestMediaPreparationPort`, remove references to:

- `IngestVideoProcessingPort`
- `ProcessPreparedVideoCommand`
- `IngestEncodingOptions`
- `resolveIngestProcessingEncodingPolicy`

**Step 6: Run focused tests**

```bash
bun run test:modules -- app/modules/ingest/application/use-cases/commit-staged-upload-to-library.usecase.test.ts
bun run test:integration -- tests/integration/composition/ingest-composition.test.ts
```

Expected: use-case and composition tests pass with the new application port.

### Task 5: Implement FFmpeg/Shaka strategy execution and fallback retry

**Files:**

- Create/modify: `app/modules/ingest/infrastructure/processing/ffmpeg-media-preparation.adapter.ts`
- Create/modify: `app/shared/lib/server/shaka-packager-playback-assets.server.ts`
- Modify if shared helper is extracted: `app/modules/playback/infrastructure/backfill/browser-compatible-playback-backfill.ts`
- Modify/replace: `tests/integration/modules/ingest/ffmpeg-video-transcoder.adapter.test.ts`

**Step 1: Rename the test file when practical**

Prefer:

- `tests/integration/modules/ingest/ffmpeg-media-preparation.adapter.test.ts`

If keeping the old test file temporarily reduces churn, rename after behavior is green.

**Step 2: Add command-contract tests**

Tests should verify command intent, not every incidental argument position.

Required command assertions:

- `remux_then_package` runs FFmpeg with `-c copy`
- `copy_video_transcode_audio` runs `-c:v copy` and `-c:a aac`
- `copy_video_synthesize_audio` includes `anullsrc`, maps source video and synthetic audio, and uses `-shortest`
- `transcode_video_copy_audio` uses `libx264` for video and copies/normalizes AAC audio
- `full_transcode` uses `libx264` and AAC
- `full_transcode` synthesizes silent AAC when `analysis.primaryAudio` is absent
- copied AAC normalization is represented with `aac_adtstoasc` or an explicitly tested conditional equivalent when remuxing AAC into MP4-family output
- HEVC preserve remux uses an MP4-compatible HEVC tag such as `hvc1` when required by the selected FFmpeg output
- Shaka Packager args preserve current `video/init.mp4`, `audio/init.mp4`, segment template, raw-key CENC, and manifest layout
- failed preserve packaging triggers one fallback full transcode
- failed preserve preparation that returns `{ success: false }` and failed preserve preparation that throws both trigger fallback
- fallback cleanup removes previous manifest/key/video/audio/intermediate output before retry
- failed fallback returns `success: false`

**Step 3: Implement workspace cleanup helper**

Suggested helper:

```ts
async function cleanPreparationAttemptOutputs(workspace: WorkspacePaths): Promise<void> {
  await Promise.all([
    rm(workspace.manifestPath, { force: true }),
    rm(workspace.keyPath, { force: true }),
    rm(workspace.intermediatePath, { force: true }),
    rm(workspace.videoDir, { force: true, recursive: true }),
    rm(workspace.audioDir, { force: true, recursive: true }),
  ]);
}
```

Do not remove `workspace.rootDir` inside the adapter. The use case owns full workspace cleanup on commit failure.

**Step 4: Implement FFmpeg arg builders**

Keep these as small pure helpers inside the adapter file or a local `ffmpeg-media-preparation-args.ts` if the file becomes hard to read.

Remux:

```text
-i <source>
-map 0:v:0
-map 0:a:0
-c copy
-bsf:a aac_adtstoasc    # when AAC copy needs ADTS-to-ASC normalization for MP4 output
-tag:v hvc1             # when preserving HEVC into MP4-family output
-movflags +faststart
-f mp4
-y <intermediate.mp4>
```

Audio-only transcode:

```text
-i <source>
-map 0:v:0
-map 0:a:0
-c:v copy
-c:a aac
-b:a 128k
-ac 2
-ar 44100
-movflags +faststart
-f mp4
-y <intermediate.mp4>
```

Silent audio:

```text
-i <source>
-f lavfi
-i anullsrc=channel_layout=stereo:sample_rate=44100
-map 0:v:0
-map 1:a:0
-c:v copy
-c:a aac
-b:a 128k
-shortest
-movflags +faststart
-f mp4
-y <intermediate.mp4>
```

Video transcode with AAC copy/normalization:

```text
-i <source>
-map 0:v:0
-map 0:a:0
-c:v libx264
-crf 20
-preset slow
-profile:v high
-level 4.1
-pix_fmt yuv420p
-c:a copy
-bsf:a aac_adtstoasc    # when copied AAC needs MP4-family normalization
-movflags +faststart
-f mp4
-y <intermediate.mp4>
```

Full fallback transcode:

```text
-i <source>
-map 0:v:0
-map 0:a:0?
-c:v libx264
-crf 20
-preset slow
-profile:v high
-level 4.1
-pix_fmt yuv420p
-c:a aac
-b:a 128k
-ac 2
-ar 44100
-movflags +faststart
-f mp4
-y <intermediate.mp4>
```

If the full fallback receives no audio, use the silent-audio input shape instead of relying on optional audio mapping to produce an audio stream. This keeps the existing audio output layout stable for both allowlisted and non-allowlisted no-audio sources.

**Step 5: Implement fallback orchestration**

Pseudocode:

```ts
const firstStrategy = request.strategy;
const fallbackStrategy = 'full_transcode';

const firstResult = await runAttempt(firstStrategy).catch(error => ({
  error: error instanceof Error ? error : new Error(String(error)),
  success: false as const,
}));

if (firstResult.success) {
  return firstResult;
}

if (isPreserveStrategy(firstStrategy)) {
  await cleanPreparationAttemptOutputs(workspace);
  return runAttempt(fallbackStrategy);
}

return firstResult;
```

Only preserve/audio-only/silent preserve paths should retry. Non-allowlisted video strategies already produce H.264 and should fail the commit if they fail.

**Step 6: Preserve existing packaging and verification behavior**

Move forward these current behaviors:

- key derivation through `derivePlaybackEncryptionKey`
- key ID through `generatePlaybackKeyId`
- raw-key CENC Shaka args
- `normalizeClearKeyManifest`
- `verifyPackagedPlaybackAssets`
- fallback thumbnail generation
- remove `intermediate.mp4` after successful verification

Extract a narrow shared helper for Shaka raw-key playback packaging args and packaged asset verification if it keeps ingest and playback backfill from diverging. If extraction becomes too large, explicitly add a drift test that compares the ingest and backfill packager contracts for manifest/key/segment layout.

**Step 7: Run focused tests**

```bash
bun run test:integration -- tests/integration/modules/ingest/ffmpeg-media-preparation.adapter.test.ts
```

Expected: strategy execution and fallback tests pass.

### Task 6: Add metadata rollback and late-failure safety

**Files:**

- Modify: `app/modules/ingest/application/use-cases/commit-staged-upload-to-library.usecase.ts`
- Modify: `app/modules/ingest/application/ports/ingest-video-metadata-writer.port.ts`
- Modify: `app/modules/library/infrastructure/sqlite/sqlite-canonical-video-metadata.adapter.ts`
- Modify: `app/composition/server/ingest.ts`
- Modify: `app/modules/ingest/application/use-cases/commit-staged-upload-to-library.usecase.test.ts`

**Step 1: Write failing use-case tests**

Add tests:

- processing failure restores staged upload to `uploaded` and removes workspace
- metadata write failure restores staged upload and removes workspace
- staged update failure after metadata write calls metadata rollback
- staged source deletion failure after metadata write calls metadata rollback
- thumbnail/finalization failure after metadata write does not leave a broken visible row
- metadata rollback failure does not mask the original failure and does not prevent staged upload restoration/workspace cleanup
- retry after failure can reuse the staged upload

**Step 2: Extend metadata writer port**

Suggested minimal change:

```ts
export interface IngestVideoMetadataWriterPort {
  deleteVideoRecord(videoId: string): Promise<void>;
  writeVideoRecord(record: IngestVideoRecord): Promise<void>;
}
```

Implement `deleteVideoRecord` in `SqliteCanonicalVideoMetadataAdapter` by delegating to the existing library metadata repository `delete(id)`.

**Step 3: Update commit use case**

Track whether metadata became visible:

```ts
let metadataWritten = false;

try {
  const analysis = await this.deps.videoAnalysis.analyze(stagedUpload.storagePath);
  const strategy = selectIngestMediaPreparationStrategy(analysis);
  const prepared = await this.deps.mediaPreparation.prepare({
    analysis,
    sourcePath: stagedUpload.storagePath,
    strategy,
    title: trimmedTitle,
    videoId,
    workspaceRootDir,
  });

  // write metadata
  await this.deps.videoMetadataWriter.writeVideoRecord(...);
  metadataWritten = true;

  // update staged row, delete staged source, finalize thumbnail
}
catch (error) {
  if (metadataWritten) {
    await this.deps.videoMetadataWriter.deleteVideoRecord(videoId);
  }
  return this.createUnavailableResult(...);
}
```

The rollback pseudocode above must be implemented as best-effort, not as a direct `await` that can replace the original error:

```ts
const originalMessage = error instanceof Error ? error.message : 'Failed to commit staged upload';

if (metadataWritten) {
  try {
    await this.deps.videoMetadataWriter.deleteVideoRecord(videoId);
  }
  catch {
    // Preserve the original failure path. Add logging only if the use case gains a logger dependency.
  }
}

return this.createUnavailableResult({
  message: originalMessage,
  stagingId: command.stagingId,
  workspaceRootDir,
});
```

Do not let rollback failure prevent workspace cleanup or staged status restoration.

**Step 4: Run focused tests**

```bash
bun run test:modules -- app/modules/ingest/application/use-cases/commit-staged-upload-to-library.usecase.test.ts
bun run test:integration -- tests/integration/composition/ingest-composition.test.ts
```

Expected: use-case and composition tests pass.

### Task 7: Remove encoder UI and request payload coupling

Do not execute this task until Tasks 8, 9, and 10 have protected backend behavior with fixture support, real media coverage, and newly uploaded playback proof. It is documented here as a distinct UI slice, but its execution order is intentionally after backend verification.

**Files:**

- Modify: `app/widgets/add-videos/model/useAddVideosView.ts`
- Modify: `app/widgets/add-videos/ui/AddVideosView.tsx`
- Modify: `app/pages/add-videos/ui/AddVideosPage.tsx`
- Delete: `app/features/add-videos-encoding/model/add-videos-encoding-option-metadata.ts`
- Delete: `app/features/add-videos-encoding/model/add-videos-encoding-options.ts`
- Delete: `app/features/add-videos-encoding/ui/AddVideosEncodingOptions.tsx`
- Modify: `tests/ui/add-videos/use-add-videos-view.test.tsx`
- Modify: `tests/ui/add-videos/add-videos-view-parity.test.tsx`
- Modify: `tests/ui/add-videos/add-videos-shell.test.tsx` if it imports affected props

**Step 1: Write/update failing UI tests**

Update tests so:

- `FileMetadataState` no longer has `encodingOptions`
- `useAddVideosView` commit body no longer includes `encodingOptions`
- `AddVideosView` no longer requires `onEncodingOptionsChange`
- rendered UI does not contain `Browser Playback Encoding`, `CPU H.264`, `GPU H.264`, `CPU H.265`, or `GPU H.265`

**Step 2: Update hook**

Remove:

- `AddVideosEncodingOptions` imports
- `metadata.encodingOptions`
- `handleEncodingOptionsChange`
- `encodingOptions` in commit JSON

**Step 3: Update view and page wiring**

Remove:

- encoding props
- rendered `<AddVideosEncodingOptions />`
- page-level handler forwarding

**Step 4: Delete the feature slice if unused**

Run:

```bash
rg "add-videos-encoding|AddVideosEncodingOptions|encodingOptions" app tests
```

Delete the encoding feature files only after references are gone or migrated.

**Step 5: Run focused tests**

```bash
bun run test:ui-dom -- tests/ui/add-videos
bun run typecheck
```

Expected: UI tests and typecheck pass.

### Task 8: Add hermetic media fixture support

**Files:**

- Create: `tests/support/ingest-media-fixtures.ts`
- Modify: `tests/integration/smoke/browser-smoke-fixture-contract.test.ts`
- Modify: `scripts/verify-hermetic-test-inputs.ts` only if new required tracked fixture files are added
- Modify: `package.json`

**Step 1: Decide fixture mode**

Default plan:

- keep broad media matrix generated on demand in temporary directories
- do not commit generated HEVC/VP9/AV1/Xvid binaries unless a test command requires tracked files
- reuse existing `tests/fixtures/upload/smoke-upload.mp4` for required baseline upload smoke
- make backend HEVC preservation CI-faithful, either through deterministic generation in Docker or a tiny tracked HEVC fixture

**Step 2: Add fixture helper**

The helper should:

- create a temp directory
- expose fixture paths by semantic ID
- generate tiny 1-2 second files with FFmpeg
- skip non-core optional fixtures when a codec generator is unavailable, but do not skip the core H.264, HEVC, AAC, non-AAC audio, no-audio, and fallback coverage in the required media-preparation gate
- cleanup temp output after tests

Suggested helper API:

```ts
export type IngestMediaFixtureId =
  | 'h264_aac_mp4'
  | 'h264_aac_mkv'
  | 'hevc_aac_mp4'
  | 'hevc_aac_mkv'
  | 'h264_ac3_mkv'
  | 'hevc_ac3_mkv'
  | 'h264_no_audio_mp4'
  | 'hevc_no_audio_mp4'
  | 'vp9_aac_mkv'
  | 'invalid_bytes';

export async function createIngestMediaFixtureWorkspace(): Promise<{
  cleanup: () => Promise<void>;
  getFixturePath: (id: IngestMediaFixtureId) => Promise<string>;
}>;
```

**Step 3: Keep generation separate from policy tests**

Do not make pure policy tests invoke FFmpeg. Use the fixture helper only for real media integration/runtime tests.

### Task 9: Add real media integration coverage

**Files:**

- Modify/create: `tests/integration/modules/ingest/ffmpeg-media-preparation.adapter.test.ts`
- Use: `tests/support/ingest-media-fixtures.ts`

**Step 1: Add focused real-media tests**

Add a small test set:

- H.264/AAC preserve creates DASH/CENC output
- HEVC/AAC preserve creates DASH/CENC output in the required media-preparation gate
- H.264 + non-AAC audio preserves video and outputs AAC
- no-audio allowlisted video produces audio output
- non-allowlisted video produces H.264/AAC fallback
- non-allowlisted video without audio produces H.264 video and silent AAC audio
- preserve failure for no-audio input falls back to H.264 plus silent AAC
- copied AAC from a non-MP4/ADTS-like source is normalized for MP4-family preparation

Use ffprobe after preparation to assert output codec facts where practical.

**Step 2: Add an explicit required media-preparation command**

Real FFmpeg/Shaka tests may be too tool-dependent for plain `bun run test`, because base Vitest runs before `verify:e2e-smoke` downloads media tools. Close that gap explicitly.

Add a script such as:

```json
"test:media-prep": "bun run download:ffmpeg && bun run download:shaka && LOCAL_STREAMER_DISABLE_VITE_ENV_FILES=true bun --no-env-file ./scripts/run-vitest.ts run --project integration tests/integration/modules/ingest/ffmpeg-media-preparation.adapter.test.ts"
```

Then include `bun run test:media-prep` in the final runtime-sensitive verification plan. If the implementation instead keeps these tests in default `bun run test`, document that choice and remove the extra script from this task.

**Step 3: Run focused tests**

```bash
bun run download:ffmpeg
bun run download:shaka
bun run test:media-prep
```

Expected: real media integration tests pass on local tooling.

### Task 10: Prove newly uploaded playback in browser smoke

**Files:**

- Modify: `tests/e2e/add-videos-owner-upload-smoke.spec.ts`
- Possibly modify: `tests/e2e/player-playback-compatibility.spec.ts`
- Possibly modify: `package.json`

**Step 1: Extend add-videos smoke**

After the uploaded video appears in the library:

- click/open the uploaded video card or navigate to its player route if the route is discoverable from the card
- observe tokenized manifest/audio/video requests
- start playback
- assert no player error
- assert `currentTime > 0`

Reuse the request-observation pattern from `tests/e2e/player-playback-compatibility.spec.ts`.

**Step 2: Keep HEVC browser playback separate unless approved**

Do not make HEVC playback a required CI smoke assertion until the owner confirms that CI environment HEVC support is acceptable. Add a documented manual/target-browser QA checklist if needed.

**Step 3: Run focused browser smoke**

```bash
bun run verify:e2e-smoke
```

Expected: required smoke passes and newly uploaded H.264 prepared playback is observed.

### Task 11: Remove old transcoder/encoding policy code

**Files:**

- Delete after migration if unused:
  - `app/modules/ingest/infrastructure/processing/ingest-processing-encoding-policy.ts`
  - `app/modules/ingest/infrastructure/processing/ffmpeg-ingest-video-processing.adapter.ts`
  - `app/modules/ingest/infrastructure/processing/ingest-video-transcoder.ts`
  - `app/modules/ingest/infrastructure/processing/ffmpeg-video-transcoder.adapter.ts`
- Delete/update stale tests:
  - `tests/integration/modules/ingest/ingest-processing-encoding-policy.test.ts`
  - `tests/integration/modules/ingest/ffmpeg-video-transcoder.adapter.test.ts`

**Step 1: Search references**

```bash
rg "ingest-processing-encoding-policy|FfmpegIngestVideoProcessingAdapter|IngestVideoProcessingPort|IngestVideoTranscoder|FfmpegVideoTranscoderAdapter|codecFamily|useGpu|cpu-h265|gpu-h265" app tests
```

**Step 2: Delete only when references are gone**

Do not leave dead slices or compatibility wrappers unless a focused test proves they are still needed.

**Step 3: Run typecheck**

```bash
bun run typecheck
```

Expected: no stale imports remain.

### Task 12: Final verification

**Files:**

- No planned source edits, verification only.

**Step 1: Run base verification**

```bash
bun run lint
bun run typecheck
bun run test
bun run build
```

Expected: all pass.

**Step 2: Run runtime-sensitive verification**

Because this change touches ingest route behavior, storage, FFmpeg/Shaka packaging, and protected playback assets, run one Docker CI-like gate:

```bash
bun run test:media-prep
bun run verify:ci-faithful:docker
```

or, if verifying a dirty worktree:

```bash
bun run test:media-prep
bun run verify:ci-worktree:docker
```

Expected: media-preparation tests and Docker CI-like verification pass.

**Step 3: Run browser smoke**

```bash
bun run verify:e2e-smoke
```

Expected: upload smoke, player layout, and protected playback smoke pass. The upload smoke must directly prove newly uploaded/prepared playback.

**Step 4: Manual or Playwright MCP QA for HEVC**

If HEVC browser playback is not in CI:

- upload a tiny HEVC/AAC file on the owner target browser
- commit it
- open the new player route
- verify tokenized manifest/license/audio/video requests
- verify playback advances
- report browser, OS, GPU, and result

## 7. Review Checklist For Implementers

Execute backend behavior first, then UI:

```text
Task 1 -> Task 2 -> Task 3 -> Task 4 -> Task 5 -> Task 6 -> Task 8 -> Task 9 -> Task 10 -> Task 7 -> Task 11 -> Task 12
```

Task 7 is intentionally delayed because the backend media path should be proven before removing the old UI choice surface.

- [ ] Policy tests describe behavior, not implementation calls.
- [ ] FFprobe stream facts are parsed once and reused.
- [ ] Legacy `encodingOptions` cannot choose output codec.
- [ ] UI no longer exposes encoder options.
- [ ] H.264 and HEVC preserve paths avoid video encoding.
- [ ] Non-AAC audio can be converted without video encoding.
- [ ] Missing audio produces silent AAC.
- [ ] Non-allowlisted video falls back to H.264.
- [ ] Preserve failure retries once with cleanup.
- [ ] Fallback failure leaves no visible library row.
- [ ] Metadata rollback covers failures after metadata write.
- [ ] Existing protected playback output layout is unchanged.
- [ ] Newly uploaded/prepared media is proven playable.
- [ ] Docker CI-like verification is run before handoff.
