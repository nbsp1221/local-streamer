import { useState, useEffect } from 'react';
import { MediaPlayer, MediaProvider } from '@vidstack/react';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';
import type { Video } from '~/types/video';

// Vidstack 스타일 imports
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';

interface VideoPlayerProps {
  video: Video;
}

interface HLSCheckResult {
  videoId: string;
  hasHLS: boolean;
  hlsUrl: string | null;
}

export function VideoPlayer({ video }: VideoPlayerProps) {
  const [hlsInfo, setHlsInfo] = useState<HLSCheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkHLS() {
      try {
        const response = await fetch(`/api/hls-check/${video.id}`);
        if (response.ok) {
          const data: HLSCheckResult = await response.json();
          setHlsInfo(data);
        } else {
          setHlsInfo({ videoId: video.id, hasHLS: false, hlsUrl: null });
        }
      } catch (error) {
        setHlsInfo({ videoId: video.id, hasHLS: false, hlsUrl: null });
      } finally {
        setIsLoading(false);
      }
    }

    checkHLS();
  }, [video.id]);

  const getVideoSrc = (): string => {
    if (isLoading || !hlsInfo) {
      return video.videoUrl.startsWith('/data/videos/') 
        ? `/api/stream/${video.id}`
        : video.videoUrl;
    }

    if (hlsInfo.hasHLS && hlsInfo.hlsUrl) {
      return hlsInfo.hlsUrl;
    }

    return video.videoUrl.startsWith('/data/videos/') 
      ? `/api/stream/${video.id}`
      : video.videoUrl;
  };

  const videoSrc = getVideoSrc();

  return (
    <div className="w-full h-full">
      {isLoading ? (
        <div className="w-full h-full bg-black flex items-center justify-center">
          <div className="text-white text-sm">로딩 중...</div>
        </div>
      ) : (
        <MediaPlayer 
          title={video.title} 
          src={videoSrc}
          poster={video.thumbnailUrl}
          playsInline
          className="w-full h-full"
          crossOrigin=""
          volume={0.25}
          autoPlay={false}
          {...(hlsInfo?.hasHLS && {
            type: 'application/vnd.apple.mpegurl'
          })}
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