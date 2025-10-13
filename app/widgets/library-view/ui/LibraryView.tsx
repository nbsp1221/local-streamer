import type { SearchFilters, Video } from '~/types/video';
import type { ModalState } from '../model/useLibraryView';
import { TagFilter } from './TagFilter';
import { VideoGrid } from './VideoGrid';
import { VideoModal } from './VideoModal';

interface LibraryViewProps {
  videos: Video[];
  totalVideosCount: number;
  searchFilters: SearchFilters;
  onTagToggle: (tag: string) => void;
  onClearTags: () => void;
  onQuickView: (video: Video) => void;
  modalState: ModalState;
  onCloseModal: () => void;
  onDeleteVideo: (videoId: string) => Promise<void>;
  onUpdateVideo: (videoId: string, updates: { title: string; tags: string[]; description?: string }) => Promise<void>;
}

export function LibraryView({
  videos,
  totalVideosCount,
  searchFilters,
  onTagToggle,
  onClearTags,
  onQuickView,
  modalState,
  onCloseModal,
  onDeleteVideo,
  onUpdateVideo,
}: LibraryViewProps) {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">My Library</h1>
        <p className="text-muted-foreground">
          Total {totalVideosCount} videos • Showing {videos.length}
        </p>
      </div>

      <TagFilter
        activeTags={searchFilters.tags}
        onTagRemove={onTagToggle}
        onClearAll={onClearTags}
      />

      <div className="mt-6">
        <VideoGrid
          videos={videos}
          onQuickView={onQuickView}
          onTagClick={onTagToggle}
        />
      </div>

      <VideoModal
        video={modalState.video}
        isOpen={modalState.isOpen}
        onClose={onCloseModal}
        onTagClick={onTagToggle}
        onDelete={onDeleteVideo}
        onUpdate={onUpdateVideo}
      />
    </div>
  );
}
