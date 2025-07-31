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
  return (
    <div className="w-full h-full">
      <MediaPlayer 
        title={video.title} 
        src={video.videoUrl}
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