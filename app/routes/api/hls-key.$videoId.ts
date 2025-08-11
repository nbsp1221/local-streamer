import { validateHLSRequest } from '~/services/hls-jwt.server';
import { AESKeyManager } from '~/services/aes-key-manager.server';

export async function loader({ request, params }: { request: Request; params: { videoId: string } }) {
  const { videoId } = params;
  if (!videoId) {
    throw new Response('Video ID required', { status: 400 });
  }

  // CRITICAL: Validate JWT token for key delivery
  const validation = await validateHLSRequest(request, videoId);
  if (!validation.valid) {
    console.warn(`HLS key access denied for ${videoId}: ${validation.error}`);
    throw new Response(validation.error || 'Unauthorized', { status: 401 });
  }
  
  // Additional security: Check origin to prevent unauthorized access
  const origin = request.headers.get('Origin');
  
  // Allow requests from same origin or localhost (for development)
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.FRONTEND_URL,
  ].filter(Boolean);
  
  const isValidOrigin = !origin || allowedOrigins.some(allowed => 
    origin === allowed || (origin && origin.startsWith(allowed + ':'))
  );
  
  if (!isValidOrigin && origin) {
    console.warn(`🚨 Unauthorized key request for ${videoId} from origin: ${origin}`);
    // Log warning but don't block - JWT is primary authentication
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
    
    // Log key access for security monitoring
    const userId = validation.payload?.userId || 'unknown';
    console.log(`🔑 AES key delivered for video: ${videoId}, user: ${userId} (key length: ${key.length} bytes)`);
    
    return new Response(key, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': key.length.toString(),
        // CRITICAL SECURITY: Prevent caching of encryption keys
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        // Allow CORS for HLS requests
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'false',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
        // Security headers
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      }
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    
    console.error(`❌ Failed to serve encryption key for ${videoId}:`, error);
    
    // Don't leak information about why the key request failed
    throw new Response('Key access denied', { status: 403 });
  }
}