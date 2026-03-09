import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  MediaSegmentRequest,
  MediaSegmentResponse,
} from '~/legacy/modules/video/media-segment/media-segment.types';
import { config as legacyConfig } from '~/legacy/configs';
import { MediaSegmentUseCase } from '~/legacy/modules/video/media-segment/media-segment.usecase';
import {
  getDashContentType,
  getDashSegmentHeaders,
  handleDashRangeRequest,
  isValidDashSegmentName,
} from '~/legacy/utils/dash-segments.server';
import type { PlaybackMediaSegmentService } from '../../application/ports/playback-media-segment-service.port';

interface LegacyMediaSegmentUseCaseResult {
  data?: MediaSegmentResponse;
  error?: Error;
  success: boolean;
}

interface LegacyPlaybackMediaSegmentServiceAdapterDependencies {
  execute?: (input: MediaSegmentRequest) => Promise<LegacyMediaSegmentUseCaseResult>;
}

export class LegacyPlaybackMediaSegmentServiceAdapter implements PlaybackMediaSegmentService {
  private readonly execute: (input: MediaSegmentRequest) => Promise<LegacyMediaSegmentUseCaseResult>;

  constructor(deps: LegacyPlaybackMediaSegmentServiceAdapterDependencies = {}) {
    if (deps.execute) {
      this.execute = deps.execute;
      return;
    }

    const defaultUseCase = createLegacyMediaSegmentUseCase();
    this.execute = input => defaultUseCase.execute(input);
  }

  async serveSegment(input: {
    filename: string;
    mediaType: 'audio' | 'video';
    rangeHeader: string | null;
    videoId: string;
  }) {
    const headers = input.rangeHeader
      ? { range: input.rangeHeader }
      : undefined;
    const request = new Request(
      `http://localhost/videos/${input.videoId}/${input.mediaType}/${input.filename}`,
      headers ? { headers } : undefined,
    );
    const result = await this.execute({
      filename: input.filename,
      mediaType: input.mediaType,
      request,
      videoId: input.videoId,
    });

    if (!result.success || !result.data) {
      throw result.error ?? new Error('Failed to load playback segment');
    }

    return {
      headers: result.data.headers,
      isRangeResponse: Boolean(result.data.isRangeResponse),
      statusCode: result.data.statusCode,
      stream: result.data.stream,
    };
  }
}

function createLegacyMediaSegmentUseCase() {
  return new MediaSegmentUseCase({
    jwtValidator: {
      validateVideoRequest: async () => ({
        payload: { userId: 'system' },
        valid: true,
      }),
    },
    fileSystem: {
      createReadStream: (path: string) => createReadStream(path) as unknown as ReadableStream,
      exists: async (path: string) => {
        try {
          await stat(path);
          return true;
        }
        catch {
          return false;
        }
      },
      stat: async (path: string) => {
        const fileStats = await stat(path);

        return {
          mtime: fileStats.mtime,
          size: fileStats.size,
        };
      },
    },
    dashUtils: {
      getDashContentType,
      getDashSegmentHeaders,
      handleDashRangeRequest,
      isValidDashSegmentName,
    },
    logger: console,
    pathResolver: {
      getVideoSegmentPath: (videoId: string, mediaType: 'audio' | 'video', filename: string) => join(legacyConfig.paths.videos, videoId, mediaType, filename),
    },
  });
}
