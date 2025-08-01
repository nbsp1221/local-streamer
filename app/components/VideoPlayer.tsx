import { MediaPlayer, MediaProvider } from '@vidstack/react';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';
import type { Video } from '~/types/video';

// Vidstack 스타일 imports
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';

interface VideoPlayerProps {
  video: Video;
}

export function VideoPlayer({ video }: VideoPlayerProps) {
  // 로컬 파일인 경우 스트리밍 API 사용
  const videoSrc = video.videoUrl.startsWith('/data/videos/') 
    ? `/api/stream/${video.id}`
    : video.videoUrl;

  return (
    <div className="w-full h-full">
      <MediaPlayer 
        title={video.title} 
        src={videoSrc}
        poster={video.thumbnailUrl}
        playsInline
        className="w-full h-full"
        crossOrigin=""
        volume={0.25}
        autoPlay={false}
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