import jwt from 'jsonwebtoken';
import { type LoaderFunctionArgs } from 'react-router';
import { config } from '~/configs';
import { getManifestUseCase } from '~/modules/video/manifest/get-manifest.usecase';
import { ExtractVideoTokenUseCase } from '~/modules/video/security/validate-token/extract-video-token.usecase';
import { IpExtractorAdapter } from '~/modules/video/security/validate-token/ip-extractor.adapter';
import { ValidateVideoTokenUseCase } from '~/modules/video/security/validate-token/validate-token.usecase';
import { ValidateVideoRequestUseCase } from '~/modules/video/security/validate-token/validate-video-request.usecase';

/**
 * Create ValidateVideoRequestUseCase with dependencies
 */
function createValidateVideoRequestUseCase() {
  const ipExtractor = new IpExtractorAdapter();
  const extractTokenUseCase = new ExtractVideoTokenUseCase();
  const validateTokenUseCase = new ValidateVideoTokenUseCase({
    jwt: {
      verify: jwt.verify,
      TokenExpiredError: jwt.TokenExpiredError,
      JsonWebTokenError: jwt.JsonWebTokenError,
    },
    config: {
      jwtSecret: config.security.video.auth.secret,
      jwtIssuer: 'local-streamer',
      jwtAudience: 'video-streaming',
    },
    logger: console,
  });

  return new ValidateVideoRequestUseCase({
    tokenExtractor: {
      extractVideoToken: (request: Request) => {
        const result = extractTokenUseCase.execute({ request });
        return result.success ? result.data.token : null;
      },
    },
    tokenValidator: {
      validateVideoToken: async (token: string, expectedVideoId?: string, ip?: string, userAgent?: string) => {
        const result = await validateTokenUseCase.execute({
          token,
          expectedVideoId,
          ipAddress: ip,
          userAgent,
        });

        if (result.success) {
          return {
            valid: true,
            payload: result.data.payload,
          };
        }

        return {
          valid: false,
          error: result.error.message,
        };
      },
    },
    ipExtractor: {
      getClientIP: ipExtractor.getClientIP.bind(ipExtractor),
    },
  });
}

/**
 * Handle DASH manifest (manifest.mpd)
 * RESTful endpoint: /videos/{videoId}/manifest.mpd
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const { videoId } = params;

  if (!videoId) {
    throw new Response('Video ID required', { status: 400 });
  }

  // Validate JWT token using UseCase
  const validateRequestUseCase = createValidateVideoRequestUseCase();
  const validation = await validateRequestUseCase.execute({
    request,
    expectedVideoId: videoId,
  });

  if (!validation.success) {
    console.warn(`DASH manifest access denied for ${videoId}: ${validation.error.message}`);
    throw new Response(validation.error.message, { status: 401 });
  }

  try {
    // Use the new GetManifestUseCase
    const result = await getManifestUseCase.execute({ videoId });

    if (!result.success) {
      const error = result.error;
      console.error(`GetManifest UseCase failed for ${videoId}:`, error);

      // Map error types to HTTP status codes
      if (error.name === 'NotFoundError') {
        throw new Response(error.message, { status: 404 });
      }
      if (error.name === 'ValidationError') {
        throw new Response(error.message, { status: 400 });
      }
      if (error.name === 'UnauthorizedError') {
        throw new Response(error.message, { status: 401 });
      }

      // Default to 500 for internal errors
      throw new Response('Failed to load DASH manifest', { status: 500 });
    }

    const { manifestContent, headers } = result.data;

    console.log(`📽️ DASH manifest served: ${videoId}/manifest.mpd`);

    return new Response(manifestContent, {
      headers,
    });
  }
  catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    console.error(`Failed to serve DASH manifest for ${videoId}:`, error);
    throw new Response('Failed to load DASH manifest', { status: 500 });
  }
}
