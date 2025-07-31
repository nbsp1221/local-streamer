import { Link } from "react-router";
import { Play, Clock, ExternalLink, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { AspectRatio } from "~/components/ui/aspect-ratio";
import type { Video } from "~/types/video";

interface VideoModalProps {
  video: Video | null;
  isOpen: boolean;
  onClose: () => void;
  onTagClick?: (tag: string) => void;
}

export function VideoModal({ video, isOpen, onClose, onTagClick }: VideoModalProps) {
  if (!video) return null;

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleTagClick = (tag: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onTagClick?.(tag);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold line-clamp-2">
            {video.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {video.description || `${video.title} 비디오 정보 및 재생 옵션`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 썸네일 영역 */}
          <div className="relative overflow-hidden rounded-lg bg-muted">
            <AspectRatio ratio={16 / 9}>
              <img
                src={video.thumbnailUrl}
                alt={video.title}
                className="h-full w-full object-cover"
              />
              
              {/* 재생시간 배지 */}
              <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded bg-black/80 px-2 py-1 text-sm text-white">
                <Clock className="h-3 w-3" />
                {formatDuration(video.duration)}
              </div>
              
              {/* 중앙 재생 버튼 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <Link to={`/player/${video.id}`} onClick={onClose}>
                  <Button size="lg" className="h-16 w-16 rounded-full">
                    <Play className="h-6 w-6 fill-current" />
                  </Button>
                </Link>
              </div>
            </AspectRatio>
          </div>

          {/* 비디오 정보 */}
          <div className="space-y-4">
            {/* 설명 */}
            {video.description && (
              <div>
                <h3 className="font-medium mb-2">설명</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {video.description}
                </p>
              </div>
            )}

            {/* 태그들 */}
            <div>
              <h3 className="font-medium mb-2">태그</h3>
              <div className="flex flex-wrap gap-2">
                {video.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={(e) => handleTagClick(tag, e)}
                  >
                    #{tag}
                  </Badge>
                ))}
              </div>
            </div>

            {/* 메타데이터 */}
            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div>
                <span className="font-medium">재생시간:</span>
                <span className="ml-2">{formatDuration(video.duration)}</span>
              </div>
              <div>
                <span className="font-medium">추가일:</span>
                <span className="ml-2">{video.addedAt.toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* 액션 버튼들 */}
          <div className="flex gap-3 pt-4 border-t">
            <Link to={`/player/${video.id}`} onClick={onClose} className="flex-1">
              <Button className="w-full" size="lg">
                <Play className="mr-2 h-4 w-4" />
                시청하기
              </Button>
            </Link>
            <Button variant="outline" onClick={onClose}>
              <X className="mr-2 h-4 w-4" />
              닫기
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}