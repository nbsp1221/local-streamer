import crypto from 'crypto';
import { type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router';
import { AESKeyManager } from '~/services/aes-key-manager.server';
import { validateVideoRequest } from '~/services/hls-jwt.server';

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
 * Handle Clear Key DRM license requests
 */
async function handleClearKeyRequest(request: Request, videoId: string) {
  if (!videoId) {
    throw new Response('Video ID required', { status: 400 });
  }

  // CRITICAL: Validate JWT Token for key delivery
  const validation = await validateVideoRequest(request, videoId);
  if (!validation.valid) {
    console.warn(`Clear Key license access denied for ${videoId}: ${validation.error}`);
    throw new Response(validation.error || 'Unauthorized', { status: 401 });
  }

  try {
    const keyManager = new AESKeyManager();

    // Check if key exists for this video
    const hasKey = await keyManager.hasVideoKey(videoId);
    if (!hasKey) {
      throw new Response('Key not found', { status: 404 });
    }

    // Get the encryption key
    const key = await keyManager.getVideoKey(videoId);
    const keyHex = key.toString('hex');

    // Generate consistent key ID for this video
    const keyId = generateKeyId(videoId);

    // Convert to base64url format (required by Clear Key spec)
    const keyIdBase64Url = hexToBase64Url(keyId);
    const keyBase64Url = hexToBase64Url(keyHex);

    // Create Clear Key license response
    const clearKeyResponse = {
      keys: [
        {
          kty: 'oct',
          kid: keyIdBase64Url,
          k: keyBase64Url,
        },
      ],
      type: 'temporary',
    };

    // Log key access for security monitoring
    const userId = validation.payload?.userId || 'unknown';
    console.log(`🔑 Clear Key license delivered for video: ${videoId}, user: ${userId} (KID: ${keyId})`);

    return new Response(JSON.stringify(clearKeyResponse), {
      headers: {
        'Content-Type': 'application/json',

        // CRITICAL SECURITY: Prevent caching of encryption keys
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',

        // Allow CORS for EME requests
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'false',
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',

        // Security headers
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    });
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
