import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { derivePlaybackEncryptionKey } from '~/modules/playback/infrastructure/license/derive-playback-encryption-key';
import { generatePlaybackKeyId } from '~/modules/playback/infrastructure/license/generate-playback-key-id';
import { getShakaPackagerPath } from '~/shared/config/video-tools.server';
import { executeFFmpegCommand } from '~/shared/lib/server/ffmpeg-process-manager.server';
import { FfprobeIngestVideoAnalysisAdapter } from '../analysis/ffprobe-ingest-video-analysis.adapter';
import type {
  IngestVideoTranscoder,
  IngestVideoTranscodeRequest,
  IngestVideoTranscodeResult,
} from './ingest-video-transcoder';
import { normalizeClearKeyManifest } from './normalize-clearkey-manifest';

interface VideoAnalysisPort {
  analyze(inputPath: string): Promise<{ duration: number }>;
}

interface WorkspacePaths {
  audioDir: string;
  intermediatePath: string;
  keyPath: string;
  manifestPath: string;
  rootDir: string;
  thumbnailPath: string;
  videoDir: string;
}

interface FfmpegVideoTranscoderAdapterDependencies {
  env?: NodeJS.ProcessEnv;
  executeCommand?: (input: {
    args: string[];
    command: string;
    timeoutMs?: number;
  }) => Promise<Awaited<ReturnType<typeof executeFFmpegCommand>>>;
  getShakaPackagerPath?: () => string;
  videoAnalysis?: VideoAnalysisPort;
}

interface EncodingPreset {
  additionalFlags: string[];
  codec: string;
  preset: string;
  qualityParam: 'crf' | 'cq';
  qualityValue: number;
}

const ENCODING_PRESETS: Record<'cpu-h264' | 'gpu-h264' | 'cpu-h265' | 'gpu-h265', EncodingPreset> = {
  'cpu-h264': {
    additionalFlags: ['-profile:v', 'high', '-level', '4.1', '-pix_fmt', 'yuv420p'],
    codec: 'libx264',
    preset: 'slow',
    qualityParam: 'crf',
    qualityValue: 20,
  },
  'gpu-h264': {
    additionalFlags: ['-profile:v', 'high', '-pix_fmt', 'yuv420p', '-rc', 'vbr'],
    codec: 'h264_nvenc',
    preset: 'p6',
    qualityParam: 'cq',
    qualityValue: 21,
  },
  'cpu-h265': {
    additionalFlags: ['-tag:v', 'hvc1', '-pix_fmt', 'yuv420p'],
    codec: 'libx265',
    preset: 'slow',
    qualityParam: 'crf',
    qualityValue: 18,
  },
  'gpu-h265': {
    additionalFlags: ['-tag:v', 'hvc1', '-pix_fmt', 'yuv420p', '-tune', 'hq', '-rc', 'vbr'],
    codec: 'hevc_nvenc',
    preset: 'p6',
    qualityParam: 'cq',
    qualityValue: 19,
  },
};

export class FfmpegVideoTranscoderAdapter implements IngestVideoTranscoder {
  private readonly env: NodeJS.ProcessEnv;
  private readonly executeCommand: NonNullable<FfmpegVideoTranscoderAdapterDependencies['executeCommand']>;
  private readonly getShakaPackagerPath: NonNullable<FfmpegVideoTranscoderAdapterDependencies['getShakaPackagerPath']>;
  private readonly videoAnalysis: VideoAnalysisPort;

  constructor(deps: FfmpegVideoTranscoderAdapterDependencies = {}) {
    this.env = deps.env ?? process.env;
    this.executeCommand = deps.executeCommand ?? executeFFmpegCommand;
    this.getShakaPackagerPath = deps.getShakaPackagerPath ?? getShakaPackagerPath;
    this.videoAnalysis = deps.videoAnalysis ?? new FfprobeIngestVideoAnalysisAdapter();
  }

  async transcode(request: IngestVideoTranscodeRequest): Promise<IngestVideoTranscodeResult> {
    try {
      const workspace = resolveWorkspacePaths({
        sourcePath: request.sourcePath,
        workspaceRootDir: request.workspaceRootDir,
      });
      const preset = resolveEncodingPreset(request);
      const duration = await this.videoAnalysis.analyze(request.sourcePath).then(result => result.duration);
      const key = derivePlaybackEncryptionKey({
        env: this.env,
        videoId: request.videoId,
      });

      await mkdir(workspace.videoDir, { recursive: true });
      await mkdir(workspace.audioDir, { recursive: true });
      await writeFile(workspace.keyPath, key);

      await this.executeCommand({
        args: buildFfmpegArgs({
          inputPath: request.sourcePath,
          outputPath: workspace.intermediatePath,
          preset,
        }),
        command: 'ffmpeg',
      });

      await this.executeCommand({
        args: buildPackagerArgs({
          inputPath: workspace.intermediatePath,
          key,
          keyId: generatePlaybackKeyId(request.videoId),
          manifestPath: workspace.manifestPath,
          outputDir: workspace.rootDir,
          segmentDuration: resolveSegmentDuration(this.env),
        }),
        command: this.getShakaPackagerPath(),
      });

      await ensureThumbnailAsset({
        duration,
        executeCommand: this.executeCommand,
        sourcePath: request.sourcePath,
        thumbnailPath: workspace.thumbnailPath,
      });
      await normalizeManifest(workspace.manifestPath);
      await verifyPackagedPlaybackAssets(workspace);
      await rm(workspace.intermediatePath, { force: true });

      return {
        data: {
          duration,
          manifestPath: workspace.manifestPath,
          thumbnailPath: workspace.thumbnailPath,
          videoId: request.videoId,
        },
        success: true,
      };
    }
    catch (error) {
      return {
        error: error instanceof Error ? error : new Error('Unknown transcoding error'),
        success: false,
      };
    }
  }
}

function resolveWorkspacePaths(input: {
  sourcePath: string;
  workspaceRootDir?: string;
}): WorkspacePaths {
  const rootDir = input.workspaceRootDir ?? path.dirname(input.sourcePath);

  return {
    audioDir: path.join(rootDir, 'audio'),
    intermediatePath: path.join(rootDir, 'intermediate.mp4'),
    keyPath: path.join(rootDir, 'key.bin'),
    manifestPath: path.join(rootDir, 'manifest.mpd'),
    rootDir,
    thumbnailPath: path.join(rootDir, 'thumbnail.jpg'),
    videoDir: path.join(rootDir, 'video'),
  };
}

function resolveEncodingPreset(request: IngestVideoTranscodeRequest): EncodingPreset {
  const encoder = `${request.useGpu ? 'gpu' : 'cpu'}-${request.codecFamily ?? 'h264'}` as const;
  return ENCODING_PRESETS[encoder];
}

function buildFfmpegArgs(input: {
  inputPath: string;
  outputPath: string;
  preset: EncodingPreset;
}): string[] {
  return [
    '-i',
    input.inputPath,
    '-map',
    '0:v:0',
    '-map',
    '0:a:0?',
    '-c:v',
    input.preset.codec,
    `-${input.preset.qualityParam}`,
    String(input.preset.qualityValue),
    '-preset',
    input.preset.preset,
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-ac',
    '2',
    '-ar',
    '44100',
    ...input.preset.additionalFlags,
    '-f',
    'mp4',
    '-movflags',
    '+faststart',
    '-y',
    input.outputPath,
  ];
}

function buildPackagerArgs(input: {
  inputPath: string;
  key: Buffer;
  keyId: string;
  manifestPath: string;
  outputDir: string;
  segmentDuration: number;
}): string[] {
  return [
    [
      `in=${input.inputPath}`,
      'stream=video',
      `init_segment=${path.join(input.outputDir, 'video', 'init.mp4')}`,
      `segment_template=${path.join(input.outputDir, 'video', 'segment-$Number%04d$.m4s')}`,
      'drm_label=CENC',
    ].join(','),
    [
      `in=${input.inputPath}`,
      'stream=audio',
      `init_segment=${path.join(input.outputDir, 'audio', 'init.mp4')}`,
      `segment_template=${path.join(input.outputDir, 'audio', 'segment-$Number%04d$.m4s')}`,
      'drm_label=CENC',
    ].join(','),
    '--enable_raw_key_encryption',
    '--protection_scheme',
    'cenc',
    '--keys',
    `label=CENC:key_id=${input.keyId}:key=${input.key.toString('hex')}`,
    '--generate_static_live_mpd',
    '--mpd_output',
    input.manifestPath,
    '--segment_duration',
    String(input.segmentDuration),
  ];
}

function buildThumbnailArgs(input: {
  outputPath: string;
  sourcePath: string;
  timestampSeconds?: number;
}): string[] {
  return [
    '-ss',
    String(input.timestampSeconds ?? 3),
    '-i',
    input.sourcePath,
    '-vframes',
    '1',
    '-vf',
    'scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2',
    '-q:v',
    '2',
    '-y',
    input.outputPath,
  ];
}

function resolveSegmentDuration(env: NodeJS.ProcessEnv): number {
  const parsed = Number.parseInt(env.DASH_SEGMENT_DURATION ?? '10', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

async function normalizeManifest(manifestPath: string) {
  const manifest = await readFile(manifestPath, 'utf8');
  const normalizedManifest = normalizeClearKeyManifest(manifest);

  if (normalizedManifest !== manifest) {
    await writeFile(manifestPath, normalizedManifest);
  }
}

async function ensureThumbnailAsset(input: {
  duration: number;
  executeCommand: NonNullable<FfmpegVideoTranscoderAdapterDependencies['executeCommand']>;
  sourcePath: string;
  thumbnailPath: string;
}) {
  if (await pathExists(input.thumbnailPath)) {
    return;
  }

  await input.executeCommand({
    args: buildThumbnailArgs({
      outputPath: input.thumbnailPath,
      sourcePath: input.sourcePath,
      timestampSeconds: resolveThumbnailTimestampSeconds(input.duration),
    }),
    command: 'ffmpeg',
  });
}

function resolveThumbnailTimestampSeconds(duration: number) {
  if (!Number.isFinite(duration) || duration <= 0) {
    return 0;
  }

  if (duration > 6) {
    return 3;
  }

  return Math.max(0, Math.floor(duration / 2));
}

async function verifyPackagedPlaybackAssets(workspace: WorkspacePaths) {
  await ensurePathExists(workspace.manifestPath);
  await ensurePathExists(workspace.keyPath);
  await ensurePathExists(workspace.thumbnailPath);
  await ensureStreamAssets(workspace.audioDir, 'audio');
  await ensureStreamAssets(workspace.videoDir, 'video');
}

async function ensurePathExists(targetPath: string) {
  await stat(targetPath);
}

async function ensureStreamAssets(streamDir: string, label: 'audio' | 'video') {
  await ensurePathExists(path.join(streamDir, 'init.mp4'));

  const segmentStats = await Promise.allSettled([
    stat(path.join(streamDir, 'segment-0001.m4s')),
    stat(path.join(streamDir, 'segment-1.m4s')),
  ]);
  const hasSegment = segmentStats.some(result => result.status === 'fulfilled');

  if (!hasSegment) {
    throw new Error(`missing packaged media segments: ${label}`);
  }
}

async function pathExists(targetPath: string) {
  try {
    await stat(targetPath);
    return true;
  }
  catch {
    return false;
  }
}
