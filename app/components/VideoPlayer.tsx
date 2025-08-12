import { MediaPlayer, MediaProvider } from '@vidstack/react';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';
import { useState, useEffect, useRef } from 'react';
import type { Video } from '~/types/video';

// Vidstack style imports
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';

// Constants
const TOKEN_REFRESH_INTERVAL = 12 * 60 * 1000; // 12 minutes in milliseconds

interface VideoPlayerProps {
  video: Video;
}

interface VideoSource {
  src: string;
  type: 'hls' | 'direct';
  label: string;
}

interface HLSTokenResponse {
  success: boolean;
  token?: string;
  urls?: {
    playlist: string;
    key: string;
  };
  error?: string;
}

export function VideoPlayer({ video }: VideoPlayerProps) {
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const [sources, setSources] = useState<VideoSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hlsToken, setHlsToken] = useState<string | null>(null);
  const playerRef = useRef<any>(null);
  const retryCountRef = useRef(0);
  const tokenRefreshTimer = useRef<NodeJS.Timeout | null>(null);

  // Fetch HLS token for local videos (all local videos are HLS-only now)
  useEffect(() => {
    const fetchHLSToken = async () => {
      // All local videos use HLS streaming
      if (video.videoUrl.startsWith('/data/videos/')) {
        try {
          const response = await fetch(`/api/hls-token/${video.id}`);
          const data: HLSTokenResponse = await response.json();
          
          if (data.success && data.token) {
            setHlsToken(data.token);
            console.log(`🔑 HLS token acquired for ${video.title}`);
            
            // Set up token refresh (refresh at 12 minutes, token expires at 15)
            if (tokenRefreshTimer.current) {
              clearTimeout(tokenRefreshTimer.current);
            }
            tokenRefreshTimer.current = setTimeout(() => {
              fetchHLSToken();
            }, TOKEN_REFRESH_INTERVAL);
          } else {
            console.warn(`Failed to get HLS token: ${data.error}`);
          }
        } catch (error) {
          console.error('Failed to fetch HLS token:', error);
        }
      }
    };

    fetchHLSToken();

    return () => {
      if (tokenRefreshTimer.current) {
        clearTimeout(tokenRefreshTimer.current);
      }
    };
  }, [video]);

  // Generate video sources - All local videos are HLS-only now
  useEffect(() => {
    const generateSources = (): VideoSource[] => {
      const videoSources: VideoSource[] = [];

      // For local videos, use HLS streaming (all local videos are HLS-only)
      if (video.videoUrl.startsWith('/data/videos/')) {
        if (hlsToken) {
          videoSources.push({
            src: `/api/hls/${video.id}/playlist.m3u8?token=${hlsToken}`,
            type: 'hls',
            label: 'HLS Stream'
          });
        }
      } else {
        // Direct video URL (external)
        videoSources.push({
          src: video.videoUrl,
          type: 'direct',
          label: 'Direct Stream'
        });
      }

      return videoSources;
    };

    const videoSources = generateSources();
    setSources(videoSources);
    
    // Set initial source (first in priority order)
    if (videoSources.length > 0) {
      setCurrentSrc(videoSources[0].src);
      console.log(`🎬 Video player initialized with ${videoSources[0].type} source for ${video.title}`);
    }
  }, [video, hlsToken]);

  // Handle playback errors
  const handleError = (errorEvent: any) => {
    console.error(`❌ Video playback error:`, errorEvent);
    
    const errorMessage = `Failed to load video`;
    console.error(`💔 ${errorMessage}`);
    setError(errorMessage);
  };

  // Reset retry count when video loads successfully
  const handleLoadStart = () => {
    retryCountRef.current = 0;
    setError(null);
  };

  // Handle successful load
  const handleCanPlay = () => {
    const currentSource = sources.find(s => s.src === currentSrc);
    if (currentSource) {
      console.log(`✅ Video loaded successfully using ${currentSource.type} source`);
    }
  };

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

  if (!currentSrc) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <MediaPlayer 
        ref={playerRef}
        title={video.title} 
        src={currentSrc}
        poster={video.thumbnailUrl}
        playsInline
        className="w-full h-full"
        crossOrigin=""
        volume={0.25}
        autoPlay={false}
        onLoadStart={handleLoadStart}
        onCanPlay={handleCanPlay}
        onError={handleError}
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