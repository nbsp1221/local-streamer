import path from 'node:path';
import type { VideoAnalysisService } from '~/legacy/modules/video/analysis/video-analysis.types';
import type { WorkspaceManagerService } from '~/legacy/modules/video/storage/types/workspace-manager.types';
import type { VideoTranscoder } from '~/legacy/modules/video/transcoding';
import type {
  IngestEncodingOptions,
  IngestLibraryIntakePort,
  ProcessPreparedVideoCommand,
} from '~/modules/ingest/application/ports/ingest-library-intake.port';
import { config } from '~/legacy/configs';
import { InternalError } from '~/legacy/lib/errors';
import { FFprobeAnalysisService } from '~/legacy/modules/video/analysis/ffprobe-analysis.service';
import { workspaceManagerService } from '~/legacy/modules/video/storage/services/WorkspaceManagerService';
import { FFmpegVideoTranscoderAdapter } from '~/legacy/modules/video/transcoding';

interface LoggerLike {
  info(message: string, data?: unknown): void;
  error(message: string, error?: unknown): void;
}

interface IngestLegacyLibraryIntakeDependencies {
  logger: LoggerLike;
  videoAnalysis: VideoAnalysisService;
  videoTranscoder: VideoTranscoder;
  workspaceManager: WorkspaceManagerService;
}

export function createIngestLegacyLibraryIntake(
  overrides: Partial<IngestLegacyLibraryIntakeDependencies> = {},
): IngestLibraryIntakePort {
  const deps = createDependencies(overrides);

  return {
    async prepareVideoForLibrary(command) {
      const workspace = await deps.workspaceManager.createWorkspace({
        videoId: command.videoId,
        temporary: false,
        cleanupOnError: true,
      });
      const sourcePath = path.join(config.paths.uploads, command.filename);
      const ext = path.extname(command.filename);
      const targetName = `video${ext}`;
      const moveResult = await deps.workspaceManager.moveToWorkspace(
        sourcePath,
        workspace,
        targetName,
      );

      if (!moveResult.success) {
        throw new Error(`Failed to move file to workspace: ${moveResult.error}`);
      }

      const videoAnalysis = await deps.videoAnalysis.analyze(moveResult.destination);
      await moveThumbnailToWorkspace({
        filename: command.filename,
        logger: deps.logger,
        title: command.title,
        videoId: command.videoId,
        workspaceManager: deps.workspaceManager,
        workspace,
      });

      return {
        duration: videoAnalysis.duration,
        sourcePath: moveResult.destination,
      };
    },

    async processPreparedVideo(command) {
      const transcodeResult = await processVideo({
        command,
        logger: deps.logger,
        videoTranscoder: deps.videoTranscoder,
      });

      await encryptThumbnailAfterDASH({
        logger: deps.logger,
        title: command.title,
        videoId: command.videoId,
      });

      return {
        dashEnabled: transcodeResult.success,
        message: transcodeResult.success
          ? 'Video added to library successfully with video conversion'
          : 'Video added to library but video conversion failed',
      };
    },
  };
}

function createDependencies(
  overrides: Partial<IngestLegacyLibraryIntakeDependencies>,
): IngestLegacyLibraryIntakeDependencies {
  return {
    logger: overrides.logger ?? console,
    videoAnalysis: overrides.videoAnalysis ?? new FFprobeAnalysisService(),
    videoTranscoder: overrides.videoTranscoder ?? new FFmpegVideoTranscoderAdapter(),
    workspaceManager: overrides.workspaceManager ?? workspaceManagerService,
  };
}

async function moveThumbnailToWorkspace(input: {
  filename: string;
  logger: LoggerLike;
  title: string;
  videoId: string;
  workspace: Awaited<ReturnType<WorkspaceManagerService['createWorkspace']>>;
  workspaceManager: WorkspaceManagerService;
}): Promise<boolean> {
  const nameWithoutExt = path.parse(input.filename).name;
  const tempThumbnailPath = path.join(config.paths.thumbnails, `${nameWithoutExt}.jpg`);

  try {
    await import('node:fs').then(fs => fs.promises.access(tempThumbnailPath));
    const moveResult = await input.workspaceManager.moveToWorkspace(
      tempThumbnailPath,
      input.workspace,
      'thumbnail.jpg',
    );

    if (moveResult.success) {
      input.logger.info(`Temporary thumbnail moved for: ${input.title} (${input.videoId})`);
      return true;
    }

    input.logger.error(`Failed to move thumbnail: ${moveResult.error}`);
    return false;
  }
  catch {
    input.logger.info(
      `No temporary thumbnail available for: ${input.title} (${input.videoId}). ` +
      'Encrypted thumbnail will be generated during DASH conversion if needed',
    );
    return false;
  }
}

async function processVideo(input: {
  command: ProcessPreparedVideoCommand;
  logger: LoggerLike;
  videoTranscoder: VideoTranscoder;
}): Promise<{ success: boolean }> {
  input.logger.info(`Starting video processing for video: ${input.command.videoId}`);

  try {
    const { codecFamily, quality, useGpu } = mapEncodingOptionsToQuality(input.command.encodingOptions);
    const transcodeResult = await input.videoTranscoder.transcode({
      codecFamily,
      quality,
      sourcePath: input.command.sourcePath,
      useGpu,
      videoId: input.command.videoId,
    });

    if (transcodeResult.success) {
      input.logger.info(`Video processing completed successfully for ${input.command.videoId}`);
      return { success: true };
    }

    input.logger.error(`Video processing failed for ${input.command.videoId}:`, transcodeResult.error);
    return { success: false };
  }
  catch (error) {
    input.logger.error(`Video processing failed for ${input.command.videoId}:`, error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new InternalError(`Video processing failed: ${errorMessage}`);
  }
}

async function encryptThumbnailAfterDASH(input: {
  logger: LoggerLike;
  title: string;
  videoId: string;
}): Promise<void> {
  try {
    const { encryptedThumbnailGenerator } = await import('~/legacy/modules/thumbnail/shared/thumbnail-generator-encrypted.server');
    const encryptionResult = await encryptedThumbnailGenerator.migrateExistingThumbnail(input.videoId);

    if (encryptionResult.success) {
      input.logger.info(`✅ Thumbnail encrypted for: ${input.title} (${input.videoId})`);
      return;
    }

    input.logger.error(`❌ Failed to encrypt thumbnail for ${input.videoId}: ${encryptionResult.error}`);
  }
  catch (error) {
    input.logger.error(`❌ Failed to encrypt thumbnail for ${input.videoId}:`, error);
  }
}

function mapEncodingOptionsToQuality(
  encodingOptions?: IngestEncodingOptions,
): { codecFamily: 'h264' | 'h265'; quality: 'high' | 'medium' | 'fast'; useGpu: boolean } {
  if (!encodingOptions) {
    return { codecFamily: 'h264', quality: 'high', useGpu: false };
  }

  const useGpu = encodingOptions.encoder.startsWith('gpu-');
  const codecFamily = encodingOptions.encoder.endsWith('h265') ? 'h265' : 'h264';

  return { codecFamily, quality: 'high', useGpu };
}
