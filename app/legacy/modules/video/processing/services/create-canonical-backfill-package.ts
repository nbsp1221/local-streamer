import { promises as fs } from 'fs';
import { join } from 'path';
import { config } from '~/legacy/configs';
import { FFprobeAnalysisService } from '../../analysis/ffprobe-analysis.service';
import { deriveVideoEncryptionKey } from '../../security/lib/derive-video-encryption-key';
import { generateVideoKeyId } from '../../security/lib/generate-video-key-id';
import { createBrowserPlaybackEncodingOptions } from '../../transcoding/browser-playback-encoding-options';
import { ffmpegTranscodingService } from './FFmpegTranscodingService';
import { shakaPackagerService } from './ShakaPackagerService';

interface CreateCanonicalBackfillPackageDependencies {
  analyzeSource: (sourcePath: string) => Promise<{
    audioBitrate: number;
    audioCodec: string;
    bitrate: number;
    duration: number;
    fileSize: number;
    frameRate: number;
    height: number;
    videoCodec: string;
    width: number;
  }>;
  calculateBitrates: (
    analysis: {
      audioBitrate: number;
      audioCodec: string;
      bitrate: number;
      duration: number;
      fileSize: number;
      frameRate: number;
      height: number;
      videoCodec: string;
      width: number;
    },
    encoder: 'cpu-h264',
  ) => {
    audioSettings: {
      bitrate: string;
      codec: string;
    };
    targetVideoBitrate: number;
  };
  deriveEncryptionKey: (videoId: string) => Buffer;
  packageDash: (input: {
    encryption: {
      drmLabel: 'CENC';
      key: string;
      keyId: string;
      scheme: 'cenc';
    };
    inputPath: string;
    outputDir: string;
    segmentDuration: number;
    staticLiveMpd: true;
    videoId: string;
  }) => Promise<unknown>;
  transcodeIntermediate: (input: {
    encodingOptions: ReturnType<typeof createBrowserPlaybackEncodingOptions>;
    inputPath: string;
    outputPath: string;
    videoAnalysis: {
      audioBitrate: number;
      audioCodec: string;
      bitrate: number;
      duration: number;
      fileSize: number;
      frameRate: number;
      height: number;
      videoCodec: string;
      width: number;
    };
    videoId: string;
  }) => Promise<unknown>;
}

interface CreateCanonicalBackfillPackageInput {
  deps?: Partial<CreateCanonicalBackfillPackageDependencies>;
  sourcePath: string;
  stagingDir: string;
  videoId: string;
}

export async function createCanonicalBackfillPackage(
  input: CreateCanonicalBackfillPackageInput,
): Promise<void> {
  const analysisService = new FFprobeAnalysisService();
  const deps: CreateCanonicalBackfillPackageDependencies = {
    analyzeSource: input.deps?.analyzeSource ?? (sourcePath => analysisService.analyze(sourcePath)),
    calculateBitrates: input.deps?.calculateBitrates ?? ((analysis, encoder) => analysisService.calculateOptimalBitrates(analysis, encoder)),
    deriveEncryptionKey: input.deps?.deriveEncryptionKey ?? (videoId => deriveVideoEncryptionKey({
      masterSeed: config.security.video.masterSeed,
      rounds: config.security.video.keyDerivation.rounds,
      saltPrefix: config.security.video.keyDerivation.saltPrefix,
      videoId,
    })),
    packageDash: input.deps?.packageDash ?? (request => shakaPackagerService.package(request)),
    transcodeIntermediate: input.deps?.transcodeIntermediate ?? (request => ffmpegTranscodingService.transcode(request)),
  };

  await fs.mkdir(input.stagingDir, { recursive: true });

  const analysis = await deps.analyzeSource(input.sourcePath);
  const bitrateRecommendation = deps.calculateBitrates(analysis, 'cpu-h264');
  const encodingOptions = createBrowserPlaybackEncodingOptions({
    audioSettings: bitrateRecommendation.audioSettings,
    encoder: 'cpu-h264',
    targetVideoBitrate: bitrateRecommendation.targetVideoBitrate,
  });
  const intermediatePath = join(input.stagingDir, 'intermediate.mp4');

  await deps.transcodeIntermediate({
    encodingOptions,
    inputPath: input.sourcePath,
    outputPath: intermediatePath,
    videoAnalysis: analysis,
    videoId: input.videoId,
  });

  const key = deps.deriveEncryptionKey(input.videoId);
  await fs.writeFile(join(input.stagingDir, 'key.bin'), key);

  await deps.packageDash({
    encryption: {
      drmLabel: 'CENC',
      key: key.toString('hex'),
      keyId: generateVideoKeyId(input.videoId),
      scheme: 'cenc',
    },
    inputPath: intermediatePath,
    outputDir: input.stagingDir,
    segmentDuration: parseInt(process.env.DASH_SEGMENT_DURATION || '10', 10),
    staticLiveMpd: true,
    videoId: input.videoId,
  });

  await verifyPackagedPlaybackAssets(input.stagingDir);
}

async function verifyPackagedPlaybackAssets(stagingDir: string): Promise<void> {
  await ensurePathExists(join(stagingDir, 'manifest.mpd'));
  await ensurePathExists(join(stagingDir, 'key.bin'));
  await ensureStreamAssets(stagingDir, 'audio');
  await ensureStreamAssets(stagingDir, 'video');
}

async function ensurePathExists(path: string): Promise<void> {
  try {
    await fs.stat(path);
  }
  catch {
    throw new Error(`missing packaged asset: ${path}`);
  }
}

async function ensureStreamAssets(stagingDir: string, streamDirName: 'audio' | 'video'): Promise<void> {
  const streamDir = join(stagingDir, streamDirName);
  let entries: string[];

  try {
    const stats = await fs.stat(streamDir);

    if (!stats.isDirectory()) {
      throw new Error(`missing packaged stream directory: ${streamDirName}`);
    }

    entries = await fs.readdir(streamDir);
  }
  catch {
    throw new Error(`missing packaged stream directory: ${streamDirName}`);
  }

  if (!entries.includes('init.mp4')) {
    throw new Error(`missing packaged init segment: ${streamDirName}/init.mp4`);
  }

  if (!entries.some(entry => entry.endsWith('.m4s'))) {
    throw new Error(`missing packaged media segments: ${streamDirName}`);
  }
}
