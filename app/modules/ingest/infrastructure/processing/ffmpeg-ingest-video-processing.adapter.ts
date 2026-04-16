import type { ThumbnailFinalizerPort } from '~/modules/thumbnail/application/ports/thumbnail-finalizer.port';
import { ThumbnailFinalizerAdapter } from '~/modules/thumbnail/infrastructure/finalization/thumbnail-finalizer.adapter';
import type { ProcessPreparedVideoCommand } from '../../application/ports/ingest-library-intake.port';
import type { IngestVideoProcessingPort } from '../../application/ports/ingest-video-processing.port';
import type { IngestVideoTranscoder } from './ingest-video-transcoder';
import { FfmpegVideoTranscoderAdapter } from './ffmpeg-video-transcoder.adapter';
import { resolveIngestProcessingEncodingPolicy } from './ingest-processing-encoding-policy';
import { IngestProcessingError } from './ingest-processing.error';

interface LoggerLike {
  info(message: string, data?: unknown): void;
  error(message: string, error?: unknown): void;
}

interface FfmpegIngestVideoProcessingAdapterDependencies {
  logger?: LoggerLike;
  thumbnailFinalizer?: ThumbnailFinalizerPort;
  videoTranscoder?: Pick<IngestVideoTranscoder, 'transcode'>;
}

export class FfmpegIngestVideoProcessingAdapter implements IngestVideoProcessingPort {
  private readonly logger: LoggerLike;
  private readonly thumbnailFinalizer: ThumbnailFinalizerPort;
  private readonly videoTranscoder: Pick<IngestVideoTranscoder, 'transcode'>;

  constructor(deps: FfmpegIngestVideoProcessingAdapterDependencies = {}) {
    this.logger = deps.logger ?? console;
    this.thumbnailFinalizer = deps.thumbnailFinalizer ?? new ThumbnailFinalizerAdapter({
      logger: this.logger,
    });
    this.videoTranscoder = deps.videoTranscoder ?? new FfmpegVideoTranscoderAdapter();
  }

  async finalizeSuccessfulVideo(command: { title: string; videoId: string }): Promise<void> {
    try {
      await this.thumbnailFinalizer.finalizeThumbnail(command);
    }
    catch (error) {
      this.logger.error(`Failed to finalize thumbnail for ${command.videoId}`, error);
    }
  }

  async processPreparedVideo(command: ProcessPreparedVideoCommand): Promise<{
    dashEnabled: boolean;
    message: string;
  }> {
    this.logger.info(`Starting video processing for video: ${command.videoId}`);

    try {
      const transcodeResult = await this.videoTranscoder.transcode({
        ...resolveIngestProcessingEncodingPolicy(command.encodingOptions),
        sourcePath: command.sourcePath,
        videoId: command.videoId,
      });

      if (transcodeResult.success) {
        this.logger.info(`Video processing completed successfully for ${command.videoId}`);
        return {
          dashEnabled: true,
          message: 'Video added to library successfully with video conversion',
        };
      }

      this.logger.error(`Video processing failed for ${command.videoId}`, transcodeResult.error);
      return {
        dashEnabled: false,
        message: 'Video added to library but video conversion failed',
      };
    }
    catch (error) {
      this.logger.error(`Video processing failed for ${command.videoId}`, error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new IngestProcessingError(`Video processing failed: ${message}`);
    }
  }
}
