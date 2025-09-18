import type { PlaylistRepository, UserRepository } from '~/repositories/interfaces';

export interface RemoveVideoFromPlaylistUseCaseRequest {
  playlistId: string;
  userId: string;
  videoId: string;
}

export interface RemoveVideoFromPlaylistUseCaseResponse {
  success: true;
  message: string;
  playlistId: string;
  videoId: string;
  remainingVideos: number;
}

export interface RemoveVideoFromPlaylistUseCaseDependencies {
  playlistRepository: PlaylistRepository;
  userRepository: UserRepository;
  logger: {
    error: (message: string, context?: any) => void;
    log: (message: string, context?: any) => void;
  };
}
