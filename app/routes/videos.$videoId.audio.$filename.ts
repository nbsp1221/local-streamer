import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { join } from 'path';
import { type LoaderFunctionArgs } from 'react-router';
import type { MediaSegmentRequest } from '~/modules/video/media-segment/media-segment.types';
import { config } from '~/configs';
import { DomainError } from '~/lib/errors';
import { MediaSegmentUseCase } from '~/modules/video/media-segment/media-segment.usecase';
import { validateVideoRequest } from '~/services/hls-jwt.server';
import {
  getDashContentType,
  getDashSegmentHeaders,
  handleDashRangeRequest,
  isValidDashSegmentName,
} from '~/utils/dash-segments.server';

/**
 * Create MediaSegmentUseCase with dependencies for audio segments
 */
function createMediaSegmentUseCase() {
  return new MediaSegmentUseCase({
    jwtValidator: {
      validateVideoRequest,
    },
    fileSystem: {
      stat: async (path: string) => {
        const stats = await stat(path);
        return { size: stats.size, mtime: stats.mtime };
      },
      exists: async (path: string) => {
        try {
          await stat(path);
          return true;
        }
        catch {
          return false;
        }
      },
      createReadStream: (path: string) => {
        return createReadStream(path) as unknown as ReadableStream;
      },
    },
    dashUtils: {
      isValidDashSegmentName,
      getDashContentType,
      getDashSegmentHeaders,
      handleDashRangeRequest,
    },
    pathResolver: {
      getVideoSegmentPath: (videoId: string, mediaType: 'audio' | 'video', filename: string) => join(config.paths.videos, videoId, mediaType, filename),
    },
    logger: console,
  });
}

/**
 * Handle audio segments (init.mp4, segment-*.m4s) from audio/ folder
 * RESTful endpoint: /videos/{videoId}/audio/{filename}
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const { videoId, filename } = params;

  if (!videoId || !filename) {
    throw new Response('Video ID and filename required', { status: 400 });
  }

  try {
    const mediaSegmentRequest: MediaSegmentRequest = {
      videoId,
      filename,
      mediaType: 'audio',
      request,
    };

    // Create UseCase and execute
    const mediaSegmentUseCase = createMediaSegmentUseCase();
    const result = await mediaSegmentUseCase.execute(mediaSegmentRequest);

    if (result.success) {
      // Handle range response differently
      if (result.data.isRangeResponse) {
        return new Response(result.data.stream, {
          status: result.data.statusCode,
          headers: result.data.headers,
        });
      }

      // Return regular streaming response
      return new Response(result.data.stream as any, {
        headers: result.data.headers,
      });
    }
    else {
      // Handle UseCase errors
      const statusCode = result.error instanceof DomainError ? result.error.statusCode : 500;
      throw new Response(result.error.message, { status: statusCode });
    }
  }
  catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    console.error(`Failed to serve audio segment ${videoId}/audio/${filename}:`, error);
    throw new Response('Failed to load audio segment', { status: 500 });
  }
}
