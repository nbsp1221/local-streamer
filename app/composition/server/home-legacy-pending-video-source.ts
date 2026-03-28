import type { PendingLibraryItem } from '~/entities/pending-video/model/pending-video';
import { getPendingVideoRepository } from '~/legacy/repositories';

export interface HomePendingLibraryItemSource {
  readPendingLibraryItems(): Promise<PendingLibraryItem[]>;
}

function toPendingLibraryItem(item: {
  filename: string;
  id: string;
  size: number;
  type: string;
}): PendingLibraryItem {
  return {
    filename: item.filename,
    id: item.id,
    size: item.size,
    type: item.type,
  };
}

export function createHomeLegacyPendingVideoSource(): HomePendingLibraryItemSource {
  return {
    async readPendingLibraryItems() {
      const pendingVideos = await getPendingVideoRepository().findAll();

      return pendingVideos.map(toPendingLibraryItem);
    },
  };
}
