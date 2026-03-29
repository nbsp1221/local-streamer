import type { VideoTranscoder } from '~/legacy/modules/video/transcoding';
import type { IngestEncodingOptions, ProcessPreparedVideoCommand } from '~/modules/ingest/application/ports/ingest-library-intake.port';
import type { IngestVideoProcessingPort } from '~/modules/ingest/application/ports/ingest-video-processing.port';
import { InternalError } from '~/legacy/lib/errors';
import { FFmpegVideoTranscoderAdapter } from '~/legacy/modules/video/transcoding';

interface LoggerLike {
  info(message: string, data?: unknown): void;
  error(message: string, error?: unknown): void;
}

interface IngestLegacyVideoProcessingDependencies {
  logger: LoggerLike;
  videoTranscoder: VideoTranscoder;
}

export function createIngestLegacyVideoProcessing(
  overrides: Partial<IngestLegacyVideoProcessingDependencies> = {},
): IngestVideoProcessingPort {
  const deps = createDependencies(overrides);

  return {
    async finalizeSuccessfulVideo(command) {
      await encryptThumbnailAfterDASH({
        logger: deps.logger,
        title: command.title,
        videoId: command.videoId,
      });
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
  };
}

function createDependencies(
  overrides: Partial<IngestLegacyVideoProcessingDependencies>,
): IngestLegacyVideoProcessingDependencies {
  return {
    logger: overrides.logger ?? console,
    videoTranscoder: overrides.videoTranscoder ?? new FFmpegVideoTranscoderAdapter(),
  };
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
