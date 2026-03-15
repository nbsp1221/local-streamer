import type { HomeLibraryVideo } from '~/entities/library-video/model/library-video';
import type { PendingLibraryItem } from '~/entities/pending-video/model/pending-video';
import type { HomeLibraryFilters } from '~/widgets/home-library/model/home-library-filters';
import { HomeLibraryWidget } from '~/widgets/home-library/ui/HomeLibraryWidget';

export interface HomePageProps {
  videos: HomeLibraryVideo[];
  pendingVideos: PendingLibraryItem[];
  initialFilters?: HomeLibraryFilters;
}

export function HomePage({
  videos,
  pendingVideos,
  initialFilters,
}: HomePageProps) {
  return (
    <HomeLibraryWidget
      initialFilters={initialFilters}
      pendingVideos={pendingVideos}
      videos={videos}
    />
  );
}
