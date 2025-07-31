import { Link } from "react-router";
import { Play, Clock } from "lucide-react";
import { AspectRatio } from "~/components/ui/aspect-ratio";
import { Badge } from "~/components/ui/badge";
import type { Video } from "~/types/video";

interface RelatedVideosProps {
  videos: Video[];
  onTagClick?: (tag: string) => void;
}

interface RelatedVideoItemProps {
  video: Video;
  onTagClick?: (tag: string) => void;
}

function RelatedVideoItem({ video, onTagClick }: RelatedVideoItemProps) {

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

  return (
    <div className="group relative">
      {/* 메인 컨텐츠 */}
      <Link to={`/player/${video.id}`} className="block mb-2">
        <div className="flex gap-2 lg:gap-3">
          {/* 썸네일 */}
          <div className="relative w-32 lg:w-40 flex-shrink-0">
            <AspectRatio ratio={16 / 9}>
              <div className="relative overflow-hidden rounded-md bg-muted h-full">
                <img
                  src={video.thumbnailUrl}
                  alt={video.title}
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                  loading="lazy"
                />
                
                {/* 재생 버튼 오버레이 */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <div className="flex h-6 w-6 lg:h-8 lg:w-8 items-center justify-center rounded-full bg-white/90 text-black">
                    <Play className="h-2.5 w-2.5 lg:h-3 lg:w-3 fill-current" />
                  </div>
                </div>
                
                {/* 재생시간 배지 */}
                <div className="absolute bottom-1 right-1 flex items-center gap-1 rounded bg-black/80 px-1 py-0.5 text-xs text-white">
                  <Clock className="h-2 w-2" />
                  {formatDuration(video.duration)}
                </div>
              </div>
            </AspectRatio>
          </div>

          {/* 비디오 정보 */}
          <div className="flex-1 space-y-1 lg:space-y-2">
            <h3 className="font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors text-xs lg:text-sm">
              {video.title}
            </h3>
            
            <p className="text-xs text-muted-foreground">
              {video.addedAt.toLocaleDateString()}
            </p>
          </div>
        </div>
      </Link>
      
      {/* 태그들 - 완전히 분리된 행 */}
      <div className="flex flex-wrap gap-1">
        {video.tags.slice(0, 2).map((tag) => (
          <Badge 
            key={tag} 
            variant="secondary" 
            className="text-xs h-4 px-1.5 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
            onClick={(e) => handleTagClick(tag, e)}
          >
            #{tag}
          </Badge>
        ))}
        {video.tags.length > 2 && (
          <Badge 
            variant="outline" 
            className="text-xs h-4 px-1.5 cursor-pointer hover:bg-muted transition-colors"
          >
            +{video.tags.length - 2}
          </Badge>
        )}
      </div>
    </div>
  );
}

export function RelatedVideos({ videos, onTagClick }: RelatedVideosProps) {
  if (videos.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-base lg:text-lg font-semibold">관련 비디오</h2>
        <div className="text-center py-8">
          <p className="text-muted-foreground text-sm">
            관련 비디오가 없습니다
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 lg:space-y-4">
      <h2 className="text-base lg:text-lg font-semibold">관련 비디오</h2>
      
      <div className="space-y-3 lg:space-y-4">
        {videos.map((video) => (
          <RelatedVideoItem 
            key={video.id} 
            video={video} 
            onTagClick={onTagClick}
          />
        ))}
      </div>
      
      {videos.length >= 10 && (
        <div className="text-center pt-4">
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            더 많은 비디오 보기 →
          </Link>
        </div>
      )}
    </div>
  );
}