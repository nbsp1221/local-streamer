import path from 'node:path';
import type { VideoAnalysisService } from '~/legacy/modules/video/analysis/video-analysis.types';
import type { WorkspaceManagerService } from '~/legacy/modules/video/storage/types/workspace-manager.types';
import type { VideoTranscoder } from '~/legacy/modules/video/transcoding';
import type {
  IngestEncodingOptions,
  IngestLibraryIntakePort,
  RecoverFailedPreparedVideoResult,
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
    async finalizeSuccessfulPreparedVideo(command) {
      await encryptThumbnailAfterDASH({
        logger: deps.logger,
        title: command.title,
        videoId: command.videoId,
      });
    },

    async prepareVideoForLibrary(command) {
      const workspace = await deps.workspaceManager.createWorkspace({
        videoId: command.videoId,
        temporary: false,
        cleanupOnError: true,
      });
      const sourcePath = path.join(config.paths.uploads, command.filename);
      const ext = path.extname(command.filename);
      const targetName = `video${ext}`;

      try {
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
      }
      catch (error) {
        const recoveryResult = await restorePreparedVideoForRetry({
          filename: command.filename,
          logger: deps.logger,
          videoId: command.videoId,
          workspaceManager: deps.workspaceManager,
        });
        throw attachPrepareRecoveryContext(error, recoveryResult);
      }
    },

    async processPreparedVideo(command) {
      const transcodeResult = await processVideo({
        command,
        logger: deps.logger,
        videoTranscoder: deps.videoTranscoder,
      });

      return {
        dashEnabled: transcodeResult.success,
        message: transcodeResult.success
          ? 'Video added to library successfully with video conversion'
          : 'Video added to library but video conversion failed',
      };
    },

    async recoverFailedPreparedVideo(command) {
      return restorePreparedVideoForRetry({
        filename: command.filename,
        logger: deps.logger,
        videoId: command.videoId,
        workspaceManager: deps.workspaceManager,
      });
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

async function restorePreparedVideoForRetry(input: {
  filename: string;
  logger: LoggerLike;
  videoId: string;
  workspaceManager: WorkspaceManagerService;
}): Promise<RecoverFailedPreparedVideoResult> {
  const targetVideoPath = path.join(config.paths.uploads, input.filename);
  const targetThumbnailPath = path.join(
    config.paths.thumbnails,
    `${path.parse(input.filename).name}.jpg`,
  );

  try {
    const workspace = await input.workspaceManager.getWorkspace(input.videoId);
    const ext = path.extname(input.filename);
    const sourceVideoPath = path.join(workspace.rootDir, `video${ext}`);
    const sourceThumbnailPath = workspace.thumbnailPath;

    const restoredUpload = await restoreFileIfPresent({
      destinationPath: targetVideoPath,
      logger: input.logger,
      sourcePath: sourceVideoPath,
      workspaceManager: input.workspaceManager,
    });
    const restoredThumbnail = await restoreFileIfPresent({
      destinationPath: targetThumbnailPath,
      logger: input.logger,
      sourcePath: sourceThumbnailPath,
      workspaceManager: input.workspaceManager,
    });
    await input.workspaceManager.cleanupWorkspace(input.videoId);
    return {
      restoredThumbnail: restoredThumbnail ||
        await input.workspaceManager.fileExists(targetThumbnailPath),
      retryAvailability: restoredUpload
        ? 'restored'
        : await input.workspaceManager.fileExists(targetVideoPath)
          ? 'already_available'
          : 'unavailable',
    };
  }
  catch (error) {
    input.logger.error(`Failed to restore upload artifacts for ${input.videoId}:`, error);
    return {
      restoredThumbnail: false,
      retryAvailability: await input.workspaceManager.fileExists(targetVideoPath)
        ? 'already_available'
        : 'unavailable',
    };
  }
}

function attachPrepareRecoveryContext(
  error: unknown,
  recoveryResult: RecoverFailedPreparedVideoResult,
): Error & { addToLibraryStage: 'prepare'; recoveryResult: RecoverFailedPreparedVideoResult } {
  const preparedError = error instanceof Error
    ? error
    : new Error('Failed to prepare video for library');

  return Object.assign(preparedError, {
    addToLibraryStage: 'prepare' as const,
    recoveryResult,
  });
}

async function restoreFileIfPresent(input: {
  destinationPath: string;
  logger: LoggerLike;
  sourcePath: string;
  workspaceManager: WorkspaceManagerService;
}): Promise<boolean> {
  const fs = await import('node:fs');

  if (!await input.workspaceManager.fileExists(input.sourcePath)) {
    return false;
  }

  await fs.promises.mkdir(path.dirname(input.destinationPath), { recursive: true });
  await fs.promises.rm(input.destinationPath, { force: true });
  await fs.promises.rename(input.sourcePath, input.destinationPath);
  input.logger.info(`Restored upload artifact: ${input.destinationPath}`);
  return true;
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
