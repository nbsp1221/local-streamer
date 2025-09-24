import {
  type MediaErrorDetail,
  type MediaPlayerInstance,
  type MediaProviderAdapter,
  isDASHProvider,
  MediaPlayer,
  MediaProvider,
} from '@vidstack/react';
import {
  defaultLayoutIcons,
  DefaultVideoLayout,
} from '@vidstack/react/player/layouts/default';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type Video } from '~/types/video';

import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';

// Constants
const TOKEN_REFRESH_INTERVAL = 12 * 60 * 1000; // 12 minutes in milliseconds

interface VidstackPlayerProps {
  video: Video;
}

interface VideoTokenResponse {
  success: boolean;
  token?: string;
  urls?: {
    manifest: string;
    clearkey: string;
  };
  error?: string;
}

interface ClearKeyResponse {
  keys: Array<{
    kid: string;
    k: string;
  }>;
}

interface DRMConfig {
  keyId: string;
  key: string;
}

export function VidstackPlayer({ video }: VidstackPlayerProps) {
  const [videoToken, setVideoToken] = useState<string | null>(null);
  const [drmConfig, setDrmConfig] = useState<DRMConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const playerRef = useRef<MediaPlayerInstance>(null);
  const retryCountRef = useRef(0);
  const tokenRefreshTimer = useRef<NodeJS.Timeout>(null);

  const fetchVideoData = useCallback(async () => {
    if (!video.videoUrl.startsWith('http')) {
      try {
        setError(null);
        console.log(`🔄 [Vidstack] Fetching video data for ${video.title}`);

        // Step 1: Fetch video token
        const tokenResponse = await fetch(`/videos/${video.id}/token`);
        const tokenData = await tokenResponse.json() as VideoTokenResponse;

        if (!tokenData.success || !tokenData.token) {
          console.warn(`[Vidstack] Failed to get video token: ${tokenData.error}`);
          setError(`Failed to get video token: ${tokenData.error}`);
          return;
        }

        console.log(`🔑 [Vidstack] Video token acquired for ${video.title}`);

        // Step 2: Fetch Clear Key data using the token
        const clearKeyResponse = await fetch(`/videos/${video.id}/clearkey?token=${tokenData.token}`);
        const clearKeyData = await clearKeyResponse.json() as ClearKeyResponse;

        if (!clearKeyData.keys || clearKeyData.keys.length === 0) {
          console.error('❌ [Vidstack] Invalid Clear Key DRM configuration:', clearKeyData);
          setError('Failed to get DRM configuration');
          return;
        }

        const clearkey = clearKeyData.keys[0];
        const keyId = clearkey.kid;
        const key = clearkey.k;

        if (!keyId || !key) {
          console.error('❌ [Vidstack] Missing key or k in JWK key data:', clearKeyData);
          setError('Invalid DRM key data');
          return;
        }

        // Step 3: Set both token and DRM config atomically
        setVideoToken(tokenData.token);
        setDrmConfig({ keyId, key });
        console.log(`✅ [Vidstack] Video data ready for ${video.title}`);

        // Set up token refresh
        if (tokenRefreshTimer.current) {
          clearTimeout(tokenRefreshTimer.current);
        }
        tokenRefreshTimer.current = setTimeout(() => {
          fetchVideoData();
        }, TOKEN_REFRESH_INTERVAL);
      }
      catch (error) {
        console.error('[Vidstack] Failed to fetch video data:', error);
        setError(`Failed to fetch video data: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
      }
    }
    else {
      setVideoToken('external');
      setDrmConfig(null); // External videos don't need DRM
    }
  }, [video.id, video.title, video.videoUrl]);

  // Fetch video data (token + DRM config) for streaming
  useEffect(() => {
    fetchVideoData();

    return () => {
      if (tokenRefreshTimer.current) {
        clearTimeout(tokenRefreshTimer.current);
      }
    };
  }, [fetchVideoData]);

  // Configure dash.js v5 Network Interceptors for token authentication
  const configureTokenAuthentication = async (dashInstance: any) => {
    try {
      // Request Interceptor for adding tokens to segment requests
      const requestInterceptor = (request: { url: string }) => {
        const originalUrl = request.url;
        const hasToken = originalUrl.includes('token=');

        // Add token to DASH segment requests if not already present
        if (!hasToken && videoToken) {
          const url = new URL(originalUrl);
          url.searchParams.set('token', videoToken);
          request.url = url.toString();
        }

        return Promise.resolve(request);
      };

      dashInstance.addRequestInterceptor(requestInterceptor);
      console.log('✅ [Vidstack] Network Interceptor registered successfully');
    }
    catch (error) {
      console.error('❌ [Vidstack] Failed to register Network Interceptor:', error);
    }
  };

  // Configure Clear Key DRM synchronously with pre-fetched data
  const configureClearKeyDRM = (dashInstance: any) => {
    if (!drmConfig || videoToken === 'external') {
      console.log('ℹ️ [Vidstack] Skipping DRM configuration (external video or no DRM config)');
      return;
    }

    try {
      dashInstance.setProtectionData({
        'org.w3.clearkey': {
          clearkeys: {
            [drmConfig.keyId]: drmConfig.key,
          },
        },
      });

      console.log('✅ [Vidstack] Clear Key DRM configured successfully');
    }
    catch (error) {
      console.error('❌ [Vidstack] Failed to configure Clear Key DRM:', error);
      setError('Failed to configure DRM');
    }
  };

  // Handle playback errors
  const handleError = (detail: MediaErrorDetail) => {
    console.error('❌ [Vidstack] Playback error:', detail);
    setIsLoading(false);
    setError(`Failed to load video: ${detail.message}`);
  };

  // Reset retry count when video loads successfully
  const handleLoadStart = () => {
    retryCountRef.current = 0;
    setIsLoading(true);
    setError(null);
    console.log(`📺 [Vidstack] Load start for ${video.title}`);
  };

  const handleCanPlay = () => {
    setIsLoading(false);
    setError(null);
    console.log(`✅ [Vidstack] Can play ${video.title}`);
  };

  const handleLoaded = () => {
    setIsLoading(false);
    setError(null);
    console.log(`🎬 [Vidstack] Fully loaded ${video.title}`);
  };

  const handleProviderChange = async (detail: MediaProviderAdapter | null) => {
    if (isDASHProvider(detail)) {
      detail.library = async () => {
        const dashjs = await import('dashjs');
        return { default: (dashjs as any).default || dashjs };
      };

      // Use the official onInstance method to configure dash.js v5
      detail.onInstance(async (dashInstance: any) => {
        await configureTokenAuthentication(dashInstance);
        configureClearKeyDRM(dashInstance); // Now synchronous
      });
    }
  };

  // Determine the playable src. We keep MediaPlayer mounted at all times so that
  // Vidstack layout hooks always have a valid media context, even while tokens
  // are loading asynchronously during client-side navigation.
  const videoSrc = video.videoUrl.startsWith('http')
    ? video.videoUrl
    : (videoToken && (drmConfig || videoToken === 'external') ? `${video.videoUrl}?token=${videoToken}` : undefined);

  const showLoadingOverlay = isLoading || (!videoSrc && !error);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
        <div className="text-center">
          <div className="text-xl mb-2">⚠️ Playback Error</div>
          <div className="text-sm text-gray-400">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-background">
      {showLoadingOverlay && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4" />
            <div className="text-sm text-gray-400">Loading {video.title}...</div>
          </div>
        </div>
      )}
      <MediaPlayer
        ref={playerRef}
        title={video.title}
        src={videoSrc}
        poster={video.thumbnailUrl}
        playsInline
        className="w-full h-full"
        crossOrigin=""
        volume={0.5}
        autoPlay={false}
        onLoadStart={handleLoadStart}
        onCanPlay={handleCanPlay}
        onLoad={handleLoaded}
        onError={handleError}
        onProviderChange={handleProviderChange}
      >
        <MediaProvider />
        <DefaultVideoLayout
          icons={defaultLayoutIcons}
          colorScheme="dark"
          menuContainer=".vds-player"
        />
      </MediaPlayer>
    </div>
  );
}
