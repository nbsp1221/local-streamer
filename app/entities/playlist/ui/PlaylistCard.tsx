import { Film, Play } from 'lucide-react';
import type { Playlist } from '~/modules/playlist/domain/playlist.types';
import { AspectRatio } from '~/components/ui/aspect-ratio';

interface PlaylistCardProps {
  playlist: Playlist;
  videoCount?: number;
  onPlay?: (playlist: Playlist) => void;
  onClick?: (playlist: Playlist) => void;
}

export function PlaylistCard({
  playlist,
  videoCount,
  onPlay,
  onClick,
}: PlaylistCardProps) {
  const actualVideoCount = videoCount ?? playlist.videoIds.length;

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onPlay?.(playlist);
  };

  const handleCardClick = () => {
    onClick?.(playlist);
  };

  // Generate thumbnail or placeholder
  const getThumbnailContent = () => {
    if (playlist.thumbnailUrl) {
      return (
        <img
          src={playlist.thumbnailUrl}
          alt={playlist.name}
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
          loading="lazy"
        />
      );
    }

    // Simple playlist thumbnail with default styling
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100 transition-transform duration-200 group-hover:scale-105">
        <Film className="h-12 w-12 text-gray-400" />
      </div>
    );
  };

  return (
    <div className="group relative">
      <div className="block cursor-pointer" onClick={handleCardClick}>
        <div className="space-y-3">
          {/* Thumbnail area */}
          <div className="relative overflow-hidden rounded-lg bg-muted">
            <AspectRatio ratio={16 / 9}>
              {getThumbnailContent()}

              {/* Play button overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-black cursor-pointer hover:bg-white"
                  onClick={handlePlay}
                >
                  <Play className="h-5 w-5 fill-current" />
                </div>
              </div>

              {/* Video count badge */}
              <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/80 px-1.5 py-0.5 text-xs text-white">
                <Film className="h-3 w-3" />
                {actualVideoCount}
              </div>
            </AspectRatio>
          </div>

          {/* Playlist title only */}
          <div>
            <h3 className="font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
              {playlist.name}
            </h3>
          </div>
        </div>
      </div>
    </div>
  );
}
