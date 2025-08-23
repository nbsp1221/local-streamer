import {
  type MediaErrorDetail,
  type MediaPlayerInstance,
  type MediaProviderAdapter,
  type MediaProviderChangeEvent,
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

export function VidstackPlayer({ video }: VidstackPlayerProps) {
  const [videoToken, setVideoToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const playerRef = useRef<MediaPlayerInstance>(null);
  const retryCountRef = useRef(0);
  const tokenRefreshTimer = useRef<NodeJS.Timeout>(null);

  const fetchVideoToken = useCallback(async () => {
    if (!video.videoUrl.startsWith('http')) {
      try {
        const response = await fetch(`/videos/${video.id}/token`);
        const data = await response.json() as VideoTokenResponse;

        if (!data.success || !data.token) {
          console.warn(`[Vidstack] Failed to get video token: ${data.error}`);
          setError(`Failed to get video token: ${data.error}`);
          return;
        }

        setVideoToken(data.token);
        console.log(`🔑 [Vidstack] Video token acquired for ${video.title}`);

        // Set up token refresh
        if (tokenRefreshTimer.current) {
          clearTimeout(tokenRefreshTimer.current);
        }
        tokenRefreshTimer.current = setTimeout(() => {
          fetchVideoToken();
        }, TOKEN_REFRESH_INTERVAL);
      }
      catch (error) {
        console.error('[Vidstack] Failed to fetch video token:', error);
        setError(`Failed to fetch video token: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
      }
    }
    else {
      setVideoToken('external');
    }
  }, [video.id, video.title, video.videoUrl]);

  // Fetch video token for streaming
  useEffect(() => {
    fetchVideoToken();

    return () => {
      if (tokenRefreshTimer.current) {
        clearTimeout(tokenRefreshTimer.current);
      }
    };
  }, [fetchVideoToken]);

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

  // Configure Clear Key DRM with proper format
  const configureClearKeyDRM = async (dashInstance: any) => {
    if (!videoToken || videoToken === 'external') {
      return;
    }

    try {
      const response = await fetch(`/videos/${video.id}/clearkey?token=${videoToken}`);
      const data = await response.json();

      if (!data.keys || data.keys.length === 0) {
        console.error('❌ [Vidstack] Invalid Clear Key DRM configuration:', data);
        return;
      }

      const clearkey = data.keys[0];
      const keyId = clearkey.kid;
      const key = clearkey.k;

      if (!keyId || !key) {
        console.error('❌ [Vidstack] Missing key or k in JWK key data:', data);
        return;
      }

      dashInstance.setProtectionData({
        'org.w3.clearkey': {
          clearkeys: {
            [keyId]: key,
          },
        },
      });

      console.log('✅ [Vidstack] Clear Key DRM configured successfully');
    }
    catch (error) {
      console.error('❌ [Vidstack] Failed to configure Clear Key DRM:', error);
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
  };

  const handleCanPlay = () => {
    setIsLoading(false);
    setError(null);
  };

  const handleLoaded = () => {
    setIsLoading(false);
    setError(null);
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
        await configureClearKeyDRM(dashInstance);
      });
    }
  };

  const videoSrc = video.videoUrl.startsWith('http')
    ? video.videoUrl
    : (videoToken ? `${video.videoUrl}?token=${videoToken}` : null);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="text-xl mb-2">⚠️ Playback Error</div>
          <div className="text-sm text-gray-400">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-black">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4" />
            <div className="text-sm text-gray-400">Loading {video.title}...</div>
          </div>
        </div>
      )}
      {videoSrc && (
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
      )}
    </div>
  );
}
