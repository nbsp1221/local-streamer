import { VideoCard } from "~/components/VideoCard";
import type { Video } from "~/types/video";

interface VideoGridProps {
  videos: Video[];
  onQuickView?: (video: Video) => void;
  onTagClick?: (tag: string) => void;
}

export function VideoGrid({ videos, onQuickView, onTagClick }: VideoGridProps) {
  if (videos.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No videos found.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
      {videos.map((video) => (
        <VideoCard 
          key={video.id} 
          video={video}
          onQuickView={onQuickView}
          onTagClick={onTagClick}
        />
      ))}
    </div>
  );
}