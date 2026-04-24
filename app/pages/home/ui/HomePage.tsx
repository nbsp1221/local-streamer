import type { HomeLibraryVideo } from '~/entities/library-video/model/library-video';
import type { VideoTaxonomyItem } from '~/modules/library/domain/video-taxonomy';
import type { HomeLibraryFilters } from '~/widgets/home-library/model/home-library-filters';
import { HomeLibraryWidget } from '~/widgets/home-library/ui/HomeLibraryWidget';

export interface HomePageProps {
  contentTypes?: VideoTaxonomyItem[];
  genres?: VideoTaxonomyItem[];
  videos: HomeLibraryVideo[];
  initialFilters?: Partial<HomeLibraryFilters>;
}

export function HomePage({
  contentTypes = [],
  genres = [],
  videos,
  initialFilters,
}: HomePageProps) {
  return (
    <HomeLibraryWidget
      contentTypes={contentTypes}
      genres={genres}
      initialFilters={initialFilters}
      videos={videos}
    />
  );
}
