import { Clock, MoreVertical, Play } from 'lucide-react';
import { Link } from 'react-router';
import type { Video } from '~/types/video';
import { AspectRatio } from '~/components/ui/aspect-ratio';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';

interface VideoCardProps {
  video: Video;
  onQuickView?: (video: Video) => void;
  onTagClick?: (tag: string) => void;
}

export function VideoCard({ video, onQuickView, onTagClick }: VideoCardProps) {
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleTagClick = (tag: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onTagClick?.(tag);
  };

  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onQuickView?.(video);
  };

  return (
    <div className="group relative">
      {/* Main link area */}
      <Link to={`/player/${video.id}`} className="block">
        <div className="space-y-3">
          {/* Thumbnail area */}
          <div className="relative overflow-hidden rounded-lg bg-muted">
            <AspectRatio ratio={16 / 9}>
              <img
                src={video.thumbnailUrl}
                alt={video.title}
                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                loading="lazy"
              />

              {/* Play button overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-black">
                  <Play className="h-5 w-5 fill-current" />
                </div>
              </div>

              {/* Duration badge */}
              <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/80 px-1.5 py-0.5 text-xs text-white">
                <Clock className="h-3 w-3" />
                {formatDuration(video.duration)}
              </div>

              {/* Quick view button */}
              {onQuickView && (
                <div className="absolute top-2 right-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-full bg-black/60 hover:bg-black/80 text-white border-0"
                    onClick={handleQuickView}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </AspectRatio>
          </div>

          {/* Video info */}
          <div className="space-y-2">
            <h3 className="font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
              {video.title}
            </h3>

            {/* Added date */}
            <p className="text-xs text-muted-foreground">
              {video.createdAt.toLocaleDateString()}
            </p>
          </div>
        </div>
      </Link>

      {/* Tags - placed outside Link */}
      <div className="flex flex-wrap gap-1 mt-2">
        {video.tags.slice(0, 3).map(tag => (
          <Badge
            key={tag}
            variant="secondary"
            className="text-xs h-5 px-2 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
            onClick={e => handleTagClick(tag, e)}
          >
            #{tag}
          </Badge>
        ))}
        {video.tags.length > 3 && (
          <Badge
            variant="outline"
            className="text-xs h-5 px-2 cursor-pointer hover:bg-muted transition-colors"
            onClick={handleQuickView}
          >
            +{video.tags.length - 3}
          </Badge>
        )}
      </div>
    </div>
  );
}
