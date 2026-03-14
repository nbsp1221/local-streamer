import type { LibraryVideo } from '../../domain/library-video';

export interface LibraryVideoSourcePort {
  listLibraryVideos(): Promise<LibraryVideo[]>;
}
