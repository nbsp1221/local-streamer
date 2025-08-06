import { Link } from "react-router";
import { Play, Clock, Trash2, X, Edit } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { AspectRatio } from "~/components/ui/aspect-ratio";
import type { Video } from "~/types/video";
import { EditVideoForm } from "./EditVideoForm";

interface VideoModalProps {
  video: Video | null;
  isOpen: boolean;
  onClose: () => void;
  onTagClick?: (tag: string) => void;
  onDelete?: (videoId: string) => Promise<void>;
  onUpdate?: (videoId: string, updates: { title: string; tags: string[]; description?: string }) => Promise<void>;
}

export function VideoModal({ video, isOpen, onClose, onTagClick, onDelete, onUpdate }: VideoModalProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

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

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!onDelete) return;
    
    setIsDeleting(true);
    try {
      await onDelete(video.id);
      setShowDeleteConfirm(false);
      onClose();
    } catch (error) {
      console.error('Failed to delete video:', error);
      // TODO: Show toast error message
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  const handleEditClick = () => {
    setIsEditMode(true);
  };

  const handleEditCancel = () => {
    setIsEditMode(false);
  };

  const handleEditSave = async (data: { title: string; tags: string[]; description?: string }) => {
    if (!onUpdate) return;
    
    try {
      await onUpdate(video.id, data);
      setIsEditMode(false);
      // The parent component should handle refreshing the video data
    } catch (error) {
      console.error('Failed to update video:', error);
      // TODO: Show toast error message
    }
  };

  return (
    <>
      {/* Main video modal */}
      <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) {
          setIsEditMode(false);
          onClose();
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold line-clamp-2">
                {isEditMode ? 'Edit Video Information' : video.title}
              </DialogTitle>
              {!isEditMode && onUpdate && (
                <Button variant="outline" size="sm" onClick={handleEditClick}>
                  <Edit className="h-4 w-4" />
                </Button>
              )}
            </div>
            <DialogDescription className="sr-only">
              {video.description || `${video.title} video information and playback options`}
            </DialogDescription>
          </DialogHeader>

          {isEditMode ? (
            <EditVideoForm
              video={video}
              onSave={handleEditSave}
              onCancel={handleEditCancel}
            />
          ) : (
          <div className="space-y-6">
            {/* Thumbnail area */}
            <div className="relative overflow-hidden rounded-lg bg-muted">
              <AspectRatio ratio={16 / 9}>
                <img
                  src={video.thumbnailUrl}
                  alt={video.title}
                  className="h-full w-full object-cover"
                />
                
                {/* Duration badge */}
                <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded bg-black/80 px-2 py-1 text-sm text-white">
                  <Clock className="h-3 w-3" />
                  {formatDuration(video.duration)}
                </div>
                
                {/* Center play button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <Link to={`/player/${video.id}`} onClick={onClose}>
                    <Button size="lg" className="h-16 w-16 rounded-full">
                      <Play className="h-6 w-6 fill-current" />
                    </Button>
                  </Link>
                </div>
              </AspectRatio>
            </div>

            {/* Video information */}
            <div className="space-y-4">
              {/* Description */}
              {video.description && (
                <div>
                  <h3 className="font-medium mb-2">Description</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {video.description}
                  </p>
                </div>
              )}

              {/* Tags */}
              <div>
                <h3 className="font-medium mb-2">Tags</h3>
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

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium">Duration:</span>
                  <span className="ml-2">{formatDuration(video.duration)}</span>
                </div>
                <div>
                  <span className="font-medium">Added:</span>
                  <span className="ml-2">{video.addedAt.toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <Link to={`/player/${video.id}`} onClick={onClose} className="flex-1">
                <Button className="w-full" size="lg">
                  <Play className="mr-2 h-4 w-4" />
                  Watch
                </Button>
              </Link>
              {onDelete && (
                <Button variant="destructive" onClick={handleDeleteClick}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              )}
              <Button variant="outline" onClick={onClose}>
                <X className="mr-2 h-4 w-4" />
                Close
              </Button>
            </div>
          </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Video</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{video.title}"?
              <br />
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={handleDeleteCancel}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>Deleting...</>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}