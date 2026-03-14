import type { LibraryVideoSourcePort } from '~/modules/library/application/ports/library-video-source.port';
import { getVideoRepository } from '~/legacy/repositories';

export function createLibraryLegacyVideoSource(): LibraryVideoSourcePort {
  return {
    listLibraryVideos: () => getVideoRepository().findAll(),
  };
}
