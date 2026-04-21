import { useSearchParams } from 'react-router';
import type { HomeLibraryVideo } from '~/entities/library-video/model/library-video';
import { LibraryVideoCard } from '~/entities/library-video/ui/LibraryVideoCard';
import { HomeQuickViewDialog } from '~/features/home-quick-view/ui/HomeQuickViewDialog';
import { HomeTagFilter } from '~/features/home-tag-filter/ui/HomeTagFilter';
import { HomeShell } from '~/widgets/home-shell/ui/HomeShell';
import {
  type HomeLibraryFilters,
  createHomeLibraryFilters,
  toggleHomeLibraryTag,
} from '../model/home-library-filters';
import { useHomeLibraryView } from '../model/useHomeLibraryView';

interface HomeLibraryWidgetProps {
  videos: HomeLibraryVideo[];
  initialFilters?: HomeLibraryFilters;
}

export function HomeLibraryWidget({
  videos,
  initialFilters,
}: HomeLibraryWidgetProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = useHomeLibraryView({
    initialFilters,
    initialVideos: videos,
  });

  const updateUrlFilters = (nextFilters: HomeLibraryFilters, replace = false) => {
    const nextParams = new URLSearchParams(searchParams);

    if (nextFilters.query.trim().length > 0) {
      nextParams.set('q', nextFilters.query);
    }
    else {
      nextParams.delete('q');
    }

    nextParams.delete('tag');
    nextFilters.tags.forEach(tag => nextParams.append('tag', tag));
    setSearchParams(nextParams, { replace });
  };

  const handleSearchChange = (query: string) => {
    view.handleSearchChange(query);
    updateUrlFilters({
      ...createHomeLibraryFilters(view.searchFilters),
      query,
    }, true);
  };

  const handleTagToggle = (tag: string) => {
    const nextTags = toggleHomeLibraryTag(view.searchFilters.tags, tag);

    view.handleTagToggle(tag);
    updateUrlFilters({
      ...createHomeLibraryFilters(view.searchFilters),
      tags: nextTags,
    }, false);
  };

  const handleClearTags = () => {
    view.handleClearTags();
    updateUrlFilters({
      ...createHomeLibraryFilters(view.searchFilters),
      tags: [],
    }, false);
  };

  return (
    <HomeShell
      onSearchChange={handleSearchChange}
      searchQuery={view.searchFilters.query}
    >
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="mb-2 text-2xl font-bold">My Library</h1>
          <p className="text-muted-foreground">
            Total {view.totalVideosCount} videos • Showing {view.videos.length}
          </p>
        </div>

        <HomeTagFilter
          activeTags={view.searchFilters.tags}
          onClearAll={handleClearTags}
          onTagRemove={handleTagToggle}
        />

        <div className="mt-6">
          {view.videos.length === 0
            ? (
                <div className="py-12 text-center">
                  <p className="text-muted-foreground">No videos found.</p>
                </div>
              )
            : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:gap-6">
                  {view.videos.map(video => (
                    <LibraryVideoCard
                      key={video.id}
                      onQuickView={view.handleQuickView}
                      onTagClick={handleTagToggle}
                      video={video}
                    />
                  ))}
                </div>
              )}
        </div>
      </div>

      <HomeQuickViewDialog
        modalState={view.modalState}
        onClose={view.handleCloseModal}
        onDeleteVideo={view.handleDeleteVideo}
        onTagClick={handleTagToggle}
        onUpdateVideo={view.handleUpdateVideo}
      />
    </HomeShell>
  );
}
