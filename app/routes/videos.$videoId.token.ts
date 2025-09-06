import jwt from 'jsonwebtoken';
import { type LoaderFunctionArgs } from 'react-router';
import { config } from '~/configs';
import { DomainError } from '~/lib/errors';
import { GenerateVideoTokenUseCase } from '~/modules/video/security/generate-token/generate-token.usecase';
import { IpExtractorAdapter } from '~/modules/video/security/validate-token/ip-extractor.adapter';

/**
 * Create GenerateVideoTokenUseCase with dependencies
 */
function createGenerateVideoTokenUseCase() {
  return new GenerateVideoTokenUseCase({
    jwt: {
      sign: jwt.sign,
    },
    config: {
      jwtSecret: config.security.video.auth.secret,
      jwtIssuer: 'local-streamer',
      jwtAudience: 'video-streaming',
      jwtExpiry: '15m',
    },
    logger: console,
  });
}

/**
 * Generate JWT token for video streaming access
 * RESTful endpoint: /videos/{videoId}/token
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const { videoId } = params;

  if (!videoId) {
    return Response.json({ success: false, error: 'Video ID is required' }, { status: 400 });
  }

  try {
    // Extract user info from request (IP, User-Agent)
    const ipExtractor = new IpExtractorAdapter();
    const ip = ipExtractor.getClientIP(request) || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Create UseCase and execute
    const generateTokenUseCase = createGenerateVideoTokenUseCase();
    const result = await generateTokenUseCase.execute({
      videoId,
      userId: 'system', // Using 'system' as user ID for now
      ipAddress: ip,
      userAgent,
    });

    if (result.success) {
      return Response.json({
        success: true,
        token: result.data.token,
        urls: {
          manifest: `/videos/${videoId}/manifest.mpd?token=${result.data.token}`,
          clearkey: `/videos/${videoId}/clearkey?token=${result.data.token}`,
        },
      });
    }
    else {
      // Handle UseCase errors
      const statusCode = result.error instanceof DomainError ? result.error.statusCode : 500;
      return Response.json({
        success: false,
        error: result.error.message,
      }, { status: statusCode });
    }
  }
  catch (error) {
    console.error(`Failed to generate video token for ${videoId}:`, error);
    return Response.json({
      success: false,
      error: 'Failed to generate video token',
    }, { status: 500 });
  }
}
