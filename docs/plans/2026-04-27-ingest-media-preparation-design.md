# Ingest Media Preparation Design

Status: Historical implementation record
Last reviewed: 2026-04-30
Date: 2026-04-27
Owner: Codex planning pass
Scope: Replace the current always-transcode ingest behavior with allowlist-based media preparation while preserving the existing protected DASH playback model.

> This document records the implemented codec-aware ingest media preparation work.
> Do not treat it as a fresh execution plan. Use
> `docs/current-runtime-documentation-spec.md` and
> `docs/roadmap/current-refactor-status.md` for the current runtime contract.

## 1. Summary

The current ingest path treats every committed upload as a transcoding job. That is simple to reason about, but it is unnecessarily slow for common owner uploads that are already close to the target browser format.

This design changes the product contract from "choose an encoder" to "preserve accepted playback codecs when possible, otherwise fall back to a safe browser format."

The first-pass preservation policy is:

- preserve video when the primary video codec is H.264 or H.265/HEVC
- preserve audio when the primary audio codec is AAC
- fall back to H.264 video and AAC audio when the source is outside the allowlist or preparation fails
- delivery: DASH
- protection: CENC/ClearKey with the existing authenticated token, manifest, segment, and license routes

The owner should not choose between H.264, H.265, VP9, AV1, CPU, GPU, CRF, bitrates, or DASH segment settings in the first pass. More options increase the supported state space and the test matrix. This project should prefer a small source-codec allowlist with a predictable fallback.

## 2. Problem

The browser upload flow currently lets the owner choose one of four encoder options:

- CPU H.264
- GPU H.264
- CPU H.265
- GPU H.265

The default is CPU H.264, but the implementation still runs every committed upload through FFmpeg transcoding before Shaka Packager creates the DASH/CENC assets.

That means a file that is already H.264 video with AAC audio can still pay the cost of a full lossy video encode. For a personal vault, this is a poor default:

- upload commit time is longer than necessary
- CPU/GPU pressure is higher than necessary
- quality can degrade through needless re-encoding
- product complexity leaks into the UI as codec choices the owner should not need to understand

## 3. Goals

- Keep the final stored playback format compatible with the owner's target browsers and predictable within this personal-vault product scope.
- Avoid full video transcoding when the input already has accepted video, initially H.264 or H.265/HEVC.
- Keep H.264/AAC as the fallback output profile, not the universal target.
- Preserve the existing DASH/CENC/ClearKey security model.
- Keep the upload page simpler than the current encoder picker.
- Make media preparation decisions testable without invoking FFmpeg.
- Keep routes thin and continue using the active ingest composition root.

## 4. Non-Goals

- Preserve VP9, AV1, ProRes, Xvid, MPEG-2, or other source video codecs in the first pass.
- Build a full browser compatibility engine that pre-classifies every H.264/H.265 profile, pixel format, bit depth, interlace mode, or HDR variant.
- Add adaptive bitrate ladders.
- Add user-facing CRF, CQ, bitrate, GOP, audio, or segment-duration controls.
- Add subtitle, multi-audio, or alternate-track support.
- Add background job infrastructure.
- Change playlist, library, auth, playback route, or ClearKey license ownership.
- Replace Shaka Packager.
- Provide commercial DRM guarantees.

## 5. Terminology

- Container: the outer file format, such as MP4, MKV, AVI, MOV, or WebM.
- Video codec: the compressed video format, such as H.264, H.265/HEVC, VP9, AV1, Xvid, or ProRes.
- Audio codec: the compressed audio format, such as AAC, MP3, AC3, DTS, FLAC, or Opus.
- Stream copy: copying encoded stream packets without decoding and encoding them again.
- Remux: changing the container or intermediate layout without changing the encoded media streams.
- Transcode: decoding media and encoding it again into a new codec or profile.
- Package: creating DASH manifest, initialization segments, media segments, and encryption metadata from prepared media streams.

## 6. External Facts Used

The design relies on these stable tool and browser facts:

- FFmpeg supports stream copy with `-c copy`, which avoids decoding and encoding. The FFmpeg documentation describes stream copy as fast and quality-preserving, while noting it can fail when required target-container information is unavailable. See [FFmpeg streamcopy](https://ffmpeg.org/ffmpeg.html#Streamcopy).
- Shaka Packager packages and encrypts already-encoded media. Its documentation states that it does not do transcoding and that content must be pre-encoded before packaging. See [Shaka Packager documentation](https://shaka-project.github.io/shaka-packager/html/documentation.html).
- Shaka Packager's encoding guidance recommends short GOPs for streaming; this design keeps GOP tuning internal and does not expose it in the UI. See [Shaka Packager media encoding guidance](https://shaka-project.github.io/shaka-packager/html/tutorials/encoding.html).
- Shaka Packager supports raw key encryption by receiving key IDs and keys directly. See [Shaka Packager raw key tutorial](https://shaka-project.github.io/shaka-packager/html/tutorials/raw_key.html).
- MDN describes H.264/AVC as broadly compatible in HTML browser contexts. See [MDN Web video codec guide](https://mdn2.netlify.app/en-us/docs/web/media/formats/video_codecs/#avc_h.264).
- MDN lists HEVC/H.265 as a browser video codec with modern browser support, but browser support still depends on the runtime platform and codec availability. See [MDN Web video codec guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs).
- MDN documents that codec strings contain profile and level information, which means a codec family name alone is not a complete browser-compatibility check. See [MDN codecs parameter guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/codecs_parameter).
- FFmpeg documents `aac_adtstoasc` for converting ADTS AAC bitstream framing when remuxing into MP4-family containers. See [FFmpeg bitstream filters](https://ffmpeg.org/ffmpeg-bitstream-filters.html#aac_005fadtstoasc).
- The W3C EME specification defines Clear Key as a baseline key system, while making clear that it is not equivalent to a commercial DRM system. See [W3C Encrypted Media Extensions](https://www.w3.org/TR/encrypted-media-2/).

## 7. Current Behavior

Current ingest ownership:

- `app/routes/api.uploads.$stagingId.commit.ts`
  - validates the API session
  - parses metadata and `encodingOptions`
  - calls the ingest composition service
- `app/composition/server/ingest.ts`
  - wires staged upload storage/repository, ffprobe analysis, metadata writer, and FFmpeg processing
- `app/modules/ingest/application/use-cases/commit-staged-upload-to-library.usecase.ts`
  - reserves the video ID
  - computes `storage/data/videos/:videoId`
  - runs analysis and processing
  - writes canonical metadata
  - deletes the staged file after success
- `app/modules/ingest/infrastructure/processing/ffmpeg-ingest-video-processing.adapter.ts`
  - maps current `encodingOptions` into `codecFamily`, `quality`, and `useGpu`
  - calls the FFmpeg transcoder
  - finalizes the encrypted thumbnail
- `app/modules/ingest/infrastructure/processing/ffmpeg-video-transcoder.adapter.ts`
  - creates `intermediate.mp4`
  - runs FFmpeg with a selected encoder
  - runs Shaka Packager with CENC raw key encryption
  - creates `thumbnail.jpg`
  - normalizes the ClearKey manifest
  - verifies manifest, key, init segments, and media segments

Current output layout:

```text
storage/data/videos/:videoId/
  manifest.mpd
  key.bin
  thumbnail.jpg
  intermediate.mp4        # temporary, removed after success
  video/
    init.mp4
    segment-0001.m4s
    ...
  audio/
    init.mp4
    segment-0001.m4s
    ...
```

This layout should remain stable.

## 8. Chosen Direction

Use a compatibility-first allowlist policy.

The application should analyze the uploaded file, preserve accepted source codecs when possible, and package the prepared result into encrypted DASH assets. H.264/AAC is the fallback format when the source is outside the allowlist or when remux/packaging fails.

The first-pass video allowlist is intentionally small:

- H.264
- H.265/HEVC

The first-pass audio allowlist is:

- AAC

The product does not need a broad "preserve every browser codec" mode. VP9, AV1, Xvid, ProRes, MPEG-2, and other non-allowlisted video codecs should fall back to H.264 in the first pass.

The design intentionally keeps the owner's choice surface small. The first pass should remove H.265 choices from the upload UI instead of adding more codec controls. H.265 preservation is an automatic source-codec decision, not a user-selected encoder mode.

## 9. Hard Rules

- Final library video streams must be either preserved H.264, preserved H.265/HEVC, or fallback H.264.
- Final library audio streams must be AAC.
- DASH packaging and CENC/ClearKey protection must always run.
- The existing authenticated playback routes remain the only supported media access path.
- H.264 and H.265/HEVC are the only video codecs preserved in the first pass.
- VP9, AV1, Xvid, ProRes, MPEG-2, and other non-allowlisted video codecs are not preserved in the first pass.
- The owner should not choose video codec, audio codec, CRF, CQ, bitrate, GOP, or segment duration in the normal upload flow.
- Only the first video stream and first usable audio stream are in scope for the first pass.
- Inputs without an audio stream should be handled deliberately by synthesizing a silent AAC track, so the existing audio output layout and playback assumptions remain stable.
- Subtitles and alternate audio tracks are ignored in the first pass.
- Preserve paths are allowed when the primary video codec reports `h264` or `hevc` and the primary audio is AAC or can be converted to AAC without video transcoding.
- The first pass should not add complex profile, pixel-format, bit-depth, interlace, HDR, or level pre-classification unless a real fixture proves it is needed.
- Full transcode remains the final fallback when cheaper preparation paths fail.
- Each preparation attempt must write into isolated attempt output or clean stable output paths before retrying fallback packaging.

## 10. V1 Preserve Policy

Preserve paths are an optimization and product preference, not a guarantee that every accepted source will package cleanly. The first pass should keep the policy simple and let actual FFmpeg/Shaka preparation decide edge cases.

Video preserve requirements:

- `codec_name` is `h264` or `hevc`
- a primary video stream exists
- FFmpeg can prepare a normalized intermediate file without video transcoding
- Shaka Packager can package the prepared media into the existing DASH/CENC layout

Audio preserve requirements:

- `codec_name` is `aac`
- ADTS-style AAC must be normalized during remux, for example with `aac_adtstoasc` where needed

If audio is missing, synthesize silent AAC. If audio is present but not AAC, preserve the accepted video stream and transcode only audio to AAC.

The first pass deliberately does not reject H.264 or HEVC preservation based on pixel format, bit depth, profile, level, field order, HDR metadata, or codec tag. Those checks can be added later only when a concrete source file fails in a repeatable way and the added rule reduces risk more than it increases policy complexity.

GOP policy:

- transcoded outputs should use an internal GOP target of 5 seconds or less
- GOP settings are not user-facing
- the first implementation should avoid full keyframe scanning for preserve paths unless poor seeking or startup behavior appears in real fixtures

## 11. Preparation Decision Table

| Input media | First strategy | Fallback |
| --- | --- | --- |
| H.264 video + AAC audio | Create normalized prepared MP4 with stream copy/remux, then package | Full H.264/AAC transcode |
| H.265/HEVC video + AAC audio | Create normalized prepared MP4 with stream copy/remux, then package | Full H.264/AAC transcode |
| H.264 or H.265/HEVC video + non-AAC audio | Copy video, transcode audio to AAC, then package | Full H.264/AAC transcode |
| H.264 or H.265/HEVC video + missing audio | Copy video, synthesize silent AAC, then package | Full H.264 + silent AAC transcode |
| Non-allowlisted video + AAC audio | Transcode video to H.264, copy or normalize audio as AAC, then package | Commit failure if full transcode fails |
| Non-allowlisted video + non-AAC audio | Full H.264/AAC transcode, then package | Commit failure if full transcode fails |
| Missing or unreadable video stream | Reject commit | None |

The "fallback" column is intentionally conservative. If a preserve path fails because FFmpeg or Shaka Packager cannot copy/remux the source cleanly, the system should try one full H.264/AAC transcode before failing the commit.

The first implementation should create a normalized prepared MP4 for all non-full-transcode preserve paths. It should not package directly from arbitrary source files. This keeps Shaka Packager input consistent and reduces source-container edge cases.

## 12. Proposed Pipeline

```text
browser upload
  -> staged file persisted
  -> owner clicks Add to Library
  -> commit use case reserves videoId and workspace
  -> one ffprobe analysis reads container, stream facts, and duration
  -> application/domain preparation policy chooses a strategy
  -> FFmpeg prepares a normalized intermediate MP4
  -> Shaka Packager creates DASH + CENC output
  -> thumbnail is created and finalized through existing thumbnail ownership
  -> output assets are verified
  -> canonical metadata is written
  -> staged file is deleted
```

The key distinction is that FFmpeg preparation may be a stream-copy/remux command, an audio-only transcode command, a silent-audio synthesis command, a video-only transcode command, or a full transcode command. Shaka Packager remains responsible for DASH segmentation and encryption.

The ffprobe result used for the strategy decision should also be the canonical analysis result used for metadata duration and thumbnail timing. Avoid a second ffprobe call inside the infrastructure adapter unless an implementation detail proves it is unavoidable and covered by tests.

## 13. Architecture Proposal

### 13.1 Naming

The current `IngestVideoTranscoder` name is too narrow for the desired behavior. The target concept is media preparation for protected playback, not always transcoding.

Introduce a new application-facing name:

- `IngestMediaPreparationPort`, or
- `IngestPlaybackPreparationPort`

Keep the first implementation small. It can wrap existing code internally, but route and use-case language should stop implying that every upload is transcoded.

### 13.2 Analysis Model

Extend the ffprobe analysis result from duration-only to stream facts:

```ts
interface IngestMediaAnalysis {
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
```

The first pass only needs enough information to choose preserve, audio-only transcode, full fallback transcode, silent-audio synthesis, or rejection. Additional stream metadata, such as pixel format, profile, level, field order, bit depth, HDR metadata, or codec tag, should not be added unless it drives a real decision or test.

### 13.3 Pure Decision Policy

Add a pure policy function in ingest domain/application, not infrastructure. The preserve allowlist is product policy. Infrastructure should execute a selected strategy instead of deciding the product contract internally.

```ts
type IngestMediaPreparationStrategy =
  | 'remux_then_package'
  | 'copy_video_transcode_audio'
  | 'copy_video_synthesize_audio'
  | 'transcode_video_copy_audio'
  | 'full_transcode'
  | 'reject';
```

The exact names can change during implementation, but the policy must be testable without spawning FFmpeg.

### 13.4 Infrastructure Adapter

The FFmpeg/Shaka infrastructure should:

- build different FFmpeg args based on the strategy
- create a prepared intermediate MP4 before Shaka packaging, including preserve paths
- use FFmpeg stream copy for remux/video-copy paths
- normalize copied AAC framing when needed
- preserve H.264 or H.265/HEVC video when the selected strategy says to copy video
- force H.264/AAC for full fallback transcode
- set an internal streaming-friendly GOP target for H.264 outputs
- run Shaka Packager for every successful preparation path
- preserve existing output layout and asset verification
- isolate per-attempt outputs or clean stable output paths before fallback retry

### 13.5 Metadata Commit Atomicity

The current commit order writes canonical library metadata after media processing succeeds but before staged upload cleanup and thumbnail finalization finish. This design must avoid visible broken library records if any post-metadata step fails.

The implementation plan should choose one of these concrete strategies:

- make metadata write, staged commit, and related state changes transactional in the SQLite-backed stores
- add a compensating library delete port that removes the canonical row when later commit steps fail
- reorder finalization so all fallible media/storage steps complete before the visible library record is written

Do not rely on workspace cleanup alone. If a library row can be created, rollback or idempotent retry behavior must be specified and tested.

## 14. Frontend UX

The upload screen should stop presenting codec choice as a primary decision.

First-pass UI:

- remove the current four-card encoder picker from the normal path
- show one short processing note, for example "Videos are prepared for browser-compatible protected playback when added to the library."
- keep title, tags, description, content type, and genre controls unchanged

Do not add an advanced drawer for H.265, CRF, bitrate, or segment duration.

Possible later option:

- "Use hardware acceleration when available"

Do not include that option in this first spec unless implementation research proves it can be done with low failure risk and clear CPU fallback.

## 15. API Contract

The upload commit API should stop requiring or encouraging `encodingOptions`.

Compatibility approach:

- accept existing `encodingOptions` during a transition period only as a backward-compatible ignored field
- parse `encodingOptions.encoder` through an allowlist before discarding it
- never let stale `cpu-h264`, `gpu-h264`, `cpu-h265`, or `gpu-h265` values choose the output codec
- preserve H.265/HEVC only when the uploaded source video itself is HEVC and the allowlist policy selects a preserve strategy
- ignore malformed `encodingOptions` instead of unsafe-casting it into the use-case command
- do not introduce a new public codec-selection field

Because this app has one owner and no public API consumers, the transition can be narrow. Tests should verify that stale `encodingOptions` do not force H.265 output or force H.264 fallback contrary to the source-codec policy.

## 16. Failure Handling

Failure behavior should stay predictable:

- If analysis cannot find a video stream, reject the commit with a validation-style failure.
- If a preserve path fails, attempt one full H.264/AAC transcode fallback.
- Before fallback retry, remove or isolate any partially written manifest, key, init segment, media segment, and intermediate files from the failed attempt.
- If full transcode fails, fail the commit.
- On commit failure, remove the partially created workspace and restore the staged upload to `uploaded`.
- Do not write canonical library metadata until packaging and verification succeed.
- Do not delete the staged upload until metadata write succeeds.
- If a failure happens after a library record is written, rollback the row or restore an idempotent retry state according to the strategy selected in section 13.5.

GPU failures are out of scope unless a later hardware-acceleration option is added.

## 17. Security And Storage Contract

This design does not weaken the current security model.

The security boundary is not "video was transcoded." The security boundary is:

- copied storage files are not directly useful because library media is packaged as encrypted DASH assets
- page and API access require the site session
- playback token, manifest, segment, and ClearKey routes remain protected
- Shaka Packager output is encrypted with the derived per-video key

The existing `key.bin`, manifest normalization, segment verification, and playback route contracts must remain intact.

## 18. Fixture Strategy

Do not rely on hidden local media. The implementation must define a hermetic fixture source before code changes are considered complete.

Preferred fixture approach:

- add a deterministic fixture-generation script under `scripts/` or `tests/support/` that uses FFmpeg to create tiny media files on demand
- keep generated files short and low resolution, for example 1-2 seconds at 160x90 or similar
- store only small static fixtures when generation is not practical
- document expected ffprobe facts for each generated fixture

Minimum fixture matrix:

- H.264/AAC MP4
- H.264/AAC in a non-MP4 container for remux coverage
- H.264 with non-AAC audio for audio-only transcode coverage
- H.264 with no audio for silent AAC synthesis coverage
- H.265/HEVC input for video-preserve coverage
- one VP9, AV1, or Xvid-style non-allowlisted input if practical at small size
- invalid or no-video input for reject coverage

If any fixture is too expensive to commit, generate it during focused tests and exclude it from default smoke only if the verification contract still has a CI-faithful path for it.

## 19. Testing Strategy

### Pure unit tests

- H.264/AAC input selects `remux_then_package`.
- H.265/HEVC + AAC input selects `remux_then_package`.
- H.264/AAC MKV-like input selects `remux_then_package`.
- H.264 + AC3 selects `copy_video_transcode_audio`.
- H.264 without audio selects `copy_video_synthesize_audio`.
- H.265/HEVC + AC3 selects `copy_video_transcode_audio`.
- H.265/HEVC without audio selects `copy_video_synthesize_audio`.
- VP9/AV1/Xvid inputs select a H.264-producing strategy.
- Missing video selects `reject`.
- stale or malformed `encodingOptions` cannot choose output codec.

### Analysis parser tests

- ffprobe JSON parsing captures container, codec, stream index, dimensions, and duration.
- parser chooses the first video stream and first usable audio stream.
- parser handles no-audio inputs deliberately.
- parser handles missing `codec_name`, missing duration, and malformed JSON without producing false preserve eligibility.

### Infrastructure tests

- remux strategy uses stream copy
- audio-only strategy copies video and encodes audio to AAC
- silent-audio strategy creates an AAC audio stream while copying allowlisted video
- full transcode strategy encodes video with `libx264` and audio with AAC
- copied AAC is normalized for MP4/fMP4 when needed
- transcoded H.264 uses the internal GOP target
- Shaka Packager still receives raw-key CENC args
- fallback runs full transcode after a preserve-path failure
- fallback cleanup prevents mixed artifacts from a failed preserve path and the fallback output
- metadata rollback/idempotency prevents visible broken library records after late failures

### Integration tests

- upload commit succeeds for a browser-compatible MP4 fixture without full transcode
- upload commit succeeds for a remux fixture
- upload commit succeeds for a H.265/HEVC fixture without video transcode when packaging succeeds
- stale H.265 encoding option does not force HEVC output for a non-HEVC source
- malformed `encodingOptions` is ignored safely
- failed full transcode restores staged upload status and removes workspace
- late failure after metadata write does not leave a visible library row or retry collision

### Browser/runtime tests

- browser smoke must prove at least one newly uploaded and newly prepared video plays, not only that seeded playback fixtures play
- the browser test should upload through `/add-videos`, commit, open the new player route, observe token/manifest/audio/video requests, assert no player error, and confirm playback time advances
- existing `bun run verify:e2e-smoke` remains required when packaging behavior changes
- base verification remains `bun run lint`, `bun run typecheck`, `bun run test`, and `bun run build`
- Docker CI-like verification is required for this change because it touches storage, ingest route behavior, FFmpeg/Shaka packaging, and protected playback assets. Use `bun run verify:ci-faithful:docker` or `bun run verify:ci-worktree:docker` according to the repository verification contract.
- when the UI encoder picker is removed, run the required browser smoke and an isolated Playwright MCP/manual QA pass for the changed browser-visible flow

## 20. Acceptance Criteria

- The normal upload UI no longer asks the owner to choose H.264 vs H.265.
- The final library playback format is always DASH+CENC with AAC audio and either preserved H.264, preserved H.265/HEVC, or fallback H.264 video.
- H.264/AAC sources avoid full video transcode when a package/remux path succeeds.
- H.265/HEVC/AAC sources avoid full video transcode when a package/remux path succeeds.
- VP9, AV1, Xvid, ProRes, MPEG-2, and other non-allowlisted video sources do not preserve their original video codec in the first pass.
- Existing protected playback routes continue to play newly ingested media.
- Failed media preparation does not create a visible library record.
- Failed media preparation leaves the staged upload retryable.
- Existing output layout remains compatible with current playback infrastructure.
- No-audio videos produce a deliberate result, initially silent AAC synthesis, instead of an accidental packager failure.
- Newly prepared media is proven playable in browser verification.

## 21. Open Questions For Review

1. Should stale `encodingOptions.encoder = "gpu-h264"` be ignored entirely, or should it allow GPU acceleration for the full-transcode fallback?
2. Should the first implementation remove the encoder UI in the same change as the backend policy, or should backend compatibility land first and UI simplification follow?
3. Should late-failure rollback use a compensating delete port, a transaction, or finalization reordering?
4. Should no-audio inputs synthesize silent AAC as specified here, or should the product reject silent videos to keep the first pass smaller?
5. Should the first-pass video allowlist remain H.264 + H.265/HEVC only, or should VP9/AV1 be considered after real owner fixtures prove a need?

## 22. Recommended First Implementation Slice

The safest first slice is backend-first:

1. Extend ffprobe analysis with stream facts.
2. Add and test the pure allowlist-based preparation decision policy.
3. Define the hermetic fixture-generation or fixture-storage strategy.
4. Add FFmpeg arg builders for remux, audio-only, silent-audio, video-only, and full-transcode paths.
5. Add fallback cleanup and metadata rollback/idempotency behavior.
6. Keep the current UI request shape but make backend output source-codec-policy-driven.
7. Add integration coverage for stale encoder options, malformed encoding options, HEVC preservation, and non-allowlisted fallback.
8. Add browser verification that plays newly prepared media.
9. Remove or simplify the encoder picker in a follow-up UI slice once backend behavior is stable.

This order reduces product risk. The backend stops treating owner-selected encoder options as product policy before the UI is simplified, and stale request payloads cannot bypass the allowlist/fallback policy.
