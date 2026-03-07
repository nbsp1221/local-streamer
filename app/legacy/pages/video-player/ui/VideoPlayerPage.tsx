import type { Video } from '~/legacy/types/video';
import { VideoPlayerView } from '~/legacy/widgets/video-player-view/ui/VideoPlayerView';

interface VideoPlayerPageProps {
  video: Video;
  relatedVideos: Video[];
}

export function VideoPlayerPage({ video, relatedVideos }: VideoPlayerPageProps) {
  return (
    <VideoPlayerView video={video} relatedVideos={relatedVideos} />
  );
}
