import type { Video } from '~/types/video';
import { VideoPlayerView } from '~/widgets/video-player-view/ui/VideoPlayerView';

interface VideoPlayerPageProps {
  video: Video;
  relatedVideos: Video[];
}

export function VideoPlayerPage({ video, relatedVideos }: VideoPlayerPageProps) {
  return (
    <VideoPlayerView video={video} relatedVideos={relatedVideos} />
  );
}
