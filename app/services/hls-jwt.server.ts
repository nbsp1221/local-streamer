import jwt from 'jsonwebtoken';
import { config } from '~/configs';

// JWT configuration
const JWT_SECRET = (() => {
  const secret = process.env.HLS_JWT_SECRET;
  if (!secret) {
    throw new Error('HLS_JWT_SECRET environment variable is required for video streaming');
  }
  return secret;
})();
const JWT_ISSUER = 'local-streamer';
const JWT_AUDIENCE = 'hls-streaming';
const JWT_EXPIRY = '15m'; // 15 minutes expiry for HLS tokens

export interface HLSTokenPayload {
  videoId: string;
  userId: string;
  ip?: string;
  userAgent?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  aud?: string;
}

export interface HLSTokenValidation {
  valid: boolean;
  payload?: HLSTokenPayload;
  error?: string;
}

/**
 * Generate video access token for a specific video
 */
export function generateVideoToken(
  videoId: string,
  userId: string,
  ip?: string,
  userAgent?: string,
): string {
  const payload: HLSTokenPayload = {
    videoId,
    userId,
    ip,
    userAgent,
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });

  console.log(`🔑 Generated HLS token for video ${videoId}, user ${userId}`);
  return token;
}

/**
 * Validate HLS access token
 */
export function validateHLSToken(
  token: string,
  expectedVideoId?: string,
  ip?: string,
  userAgent?: string,
): HLSTokenValidation {
  try {
    // Verify token signature and expiry
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as HLSTokenPayload;

    // Check video ID if specified
    if (expectedVideoId && decoded.videoId !== expectedVideoId) {
      return {
        valid: false,
        error: 'Token not valid for this video',
      };
    }

    // Optional: Strict IP validation (can be disabled for flexibility)
    if (decoded.ip && ip && decoded.ip !== ip) {
      console.warn(`HLS token IP mismatch: expected ${decoded.ip}, got ${ip}`);
      // Uncomment for strict validation:
      // return {
      //   valid: false,
      //   error: 'IP address mismatch',
      // };
    }

    // Optional: User-Agent validation (can be disabled for flexibility)
    if (decoded.userAgent && userAgent && decoded.userAgent !== userAgent) {
      console.warn(`HLS token User-Agent mismatch`);
      // Uncomment for strict validation:
      // return {
      //   valid: false,
      //   error: 'User-Agent mismatch',
      // };
    }

    return {
      valid: true,
      payload: decoded,
    };
  }
  catch (error) {
    let errorMessage = 'Invalid token';

    if (error instanceof jwt.TokenExpiredError) {
      errorMessage = 'Token expired';
    }
    else if (error instanceof jwt.JsonWebTokenError) {
      errorMessage = 'Invalid token signature';
    }

    return {
      valid: false,
      error: errorMessage,
    };
  }
}

/**
 * Extract token from request (query parameter or Authorization header)
 */
export function extractHLSToken(request: Request): string | null {
  // 1. Check query parameter (preferred for HLS)
  const url = new URL(request.url);
  const queryToken = url.searchParams.get('token');
  if (queryToken) {
    return queryToken;
  }

  // 2. Check Authorization header (fallback)
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

/**
 * Validate video request with token
 */
export async function validateVideoRequest(
  request: Request,
  expectedVideoId?: string,
): Promise<HLSTokenValidation> {
  const token = extractHLSToken(request);

  if (!token) {
    return {
      valid: false,
      error: 'No token provided',
    };
  }

  // Extract IP and User-Agent for additional validation
  const ip = getClientIP(request);
  const userAgent = request.headers.get('User-Agent') || undefined;

  return validateHLSToken(token, expectedVideoId, ip, userAgent);
}

/**
 * Generate HLS URLs with embedded token
 */
export function generateHLSUrls(videoId: string, token: string) {
  return {
    playlist: `/api/hls/${videoId}/playlist.m3u8?token=${token}`,
    key: `/api/hls-key/${videoId}?token=${token}`,
    segment: (segmentName: string) => `/api/hls/${videoId}/segment/${segmentName}?token=${token}`,
  };
}

/**
 * Extract client IP from request headers
 */
function getClientIP(request: Request): string | undefined {
  // Check various headers for client IP
  const forwarded = request.headers.get('X-Forwarded-For');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers.get('X-Real-IP');
  if (realIP) {
    return realIP;
  }

  const cfIP = request.headers.get('CF-Connecting-IP');
  if (cfIP) {
    return cfIP;
  }

  return undefined;
}

/**
 * Refresh token if close to expiry (for future use)
 */
export function shouldRefreshToken(token: string): boolean {
  try {
    const decoded = jwt.decode(token) as HLSTokenPayload;
    if (!decoded || !decoded.exp) {
      return true;
    }

    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decoded.exp - now;

    // Refresh if less than 5 minutes remaining
    return timeUntilExpiry < 300;
  }
  catch {
    return true;
  }
}
