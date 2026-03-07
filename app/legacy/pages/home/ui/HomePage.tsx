import type { PendingVideo, SearchFilters, Video } from '~/legacy/types/video';
import { AppLayout } from '~/legacy/components/AppLayout';
import { useLibraryView } from '~/legacy/widgets/library-view/model/useLibraryView';
import { LibraryView } from '~/legacy/widgets/library-view/ui/LibraryView';

export interface HomePageProps {
  videos: Video[];
  pendingVideos: PendingVideo[];
  initialFilters?: SearchFilters;
}

export function HomePage({ videos, pendingVideos, initialFilters }: HomePageProps) {
  const view = useLibraryView({
    initialVideos: videos,
    initialPendingVideos: pendingVideos,
    initialFilters,
  });

  return (
    <AppLayout
      searchQuery={view.searchFilters.query}
      onSearchChange={view.handleSearchChange}
      pendingCount={view.pendingVideos.length}
    >
      <LibraryView
        videos={view.videos}
        totalVideosCount={view.totalVideosCount}
        searchFilters={view.searchFilters}
        onTagToggle={view.handleTagToggle}
        onClearTags={view.handleClearTags}
        onQuickView={view.handleQuickView}
        modalState={view.modalState}
        onCloseModal={view.handleCloseModal}
        onDeleteVideo={view.handleDeleteVideo}
        onUpdateVideo={view.handleUpdateVideo}
      />
    </AppLayout>
  );
}
