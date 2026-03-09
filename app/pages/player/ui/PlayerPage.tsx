import type { PlaybackCatalogVideo } from '~/modules/playback/application/ports/video-catalog.port';
import { PlayerSurface } from '~/widgets/player-surface/ui/PlayerSurface';

interface PlayerPageProps {
  relatedVideos: PlaybackCatalogVideo[];
  video: PlaybackCatalogVideo;
}

export function PlayerPage({ video, relatedVideos }: PlayerPageProps) {
  return (
    <PlayerSurface
      relatedVideos={relatedVideos}
      video={video}
    />
  );
}
