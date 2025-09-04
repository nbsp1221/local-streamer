import crypto from 'crypto';
import { type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router';
import type { ClearKeyRequest } from '~/modules/video/clear-key/clear-key.types';
import { DomainError } from '~/lib/errors';
import { ClearKeyUseCase } from '~/modules/video/clear-key/clear-key.usecase';
import { AESKeyManager } from '~/services/aes-key-manager.server';
import { validateVideoRequest } from '~/services/video-jwt.server';

/**
 * Convert hex string to base64url
 */
function hexToBase64Url(hex: string): string {
  return Buffer.from(hex, 'hex').toString('base64url');
}

/**
 * Generate consistent key ID from video ID
 */
function generateKeyId(videoId: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(videoId);
  const digest = hash.digest();
  return digest.subarray(0, 16).toString('hex');
}

/**
 * Create ClearKeyUseCase with dependencies
 */
function createClearKeyUseCase() {
  const keyManager = new AESKeyManager();

  return new ClearKeyUseCase({
    jwtValidator: {
      validateVideoRequest,
    },
    keyManager: {
      hasVideoKey: keyManager.hasVideoKey.bind(keyManager),
      getVideoKey: keyManager.getVideoKey.bind(keyManager),
    },
    keyUtils: {
      generateKeyId,
      hexToBase64Url,
    },
    logger: console,
  });
}

/**
 * Handle Clear Key DRM license requests
 */
async function handleClearKeyRequest(request: Request, videoId: string) {
  if (!videoId) {
    throw new Response('Video ID required', { status: 400 });
  }

  try {
    const clearKeyRequest: ClearKeyRequest = {
      videoId,
      request,
    };

    // Create UseCase and execute
    const clearKeyUseCase = createClearKeyUseCase();
    const result = await clearKeyUseCase.execute(clearKeyRequest);

    if (result.success) {
      // Return Clear Key license response with security headers
      return new Response(JSON.stringify(result.data.clearKeyResponse), {
        headers: result.data.headers,
      });
    }
    else {
      // Handle UseCase errors
      const statusCode = result.error instanceof DomainError ? result.error.statusCode : 403;
      throw new Response(result.error.message, { status: statusCode });
    }
  }
  catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    console.error(`❌ Failed to serve Clear Key license for ${videoId}:`, error);

    // Don't leak information about why the key request failed
    throw new Response('Clear Key license access denied', { status: 403 });
  }
}

// Handle GET requests
export async function loader({ request, params }: LoaderFunctionArgs) {
  const { videoId } = params;

  if (!videoId) {
    throw new Response('Video ID required', { status: 400 });
  }

  console.log(`🔍 [ClearKey] GET request for video: ${videoId}`);
  return await handleClearKeyRequest(request, videoId);
}

// Handle POST requests
export async function action({ request, params }: ActionFunctionArgs) {
  const { videoId } = params;

  if (!videoId) {
    throw new Response('Video ID required', { status: 400 });
  }

  console.log(`🔍 [ClearKey] POST request for video: ${videoId}`);

  try {
    // Parse JSON body to check if it contains key IDs
    const body = await request.text();

    if (body) {
      const parsedBody = JSON.parse(body);
      console.log(`📨 [ClearKey] POST body:`, parsedBody);

      // If it's a standard Clear Key license request with kids array
      if (parsedBody.kids && Array.isArray(parsedBody.kids)) {
        console.log(`🔑 [ClearKey] Standard license request with ${parsedBody.kids.length} key ID(s)`);
      }
    }
  }
  catch (error) {
    console.log(`📨 [ClearKey] Non-JSON POST body or parsing error:`, error);
  }

  return await handleClearKeyRequest(request, videoId);
}
