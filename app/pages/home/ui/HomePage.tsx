import type { HomeLibraryVideo } from '~/entities/library-video/model/library-video';
import type { HomeLibraryFilters } from '~/widgets/home-library/model/home-library-filters';
import { HomeLibraryWidget } from '~/widgets/home-library/ui/HomeLibraryWidget';

export interface HomePageProps {
  videos: HomeLibraryVideo[];
  initialFilters?: HomeLibraryFilters;
}

export function HomePage({
  videos,
  initialFilters,
}: HomePageProps) {
  return (
    <HomeLibraryWidget
      initialFilters={initialFilters}
      videos={videos}
    />
  );
}
