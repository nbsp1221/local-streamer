import type { LibraryVideo } from '../../domain/library-video';
import type { VideoTaxonomyItem } from '../../domain/video-taxonomy';

export interface LibraryVideoSourcePort {
  listActiveContentTypes(): Promise<VideoTaxonomyItem[]>;
  listActiveGenres(): Promise<VideoTaxonomyItem[]>;
  listLibraryVideos(): Promise<LibraryVideo[]>;
}
