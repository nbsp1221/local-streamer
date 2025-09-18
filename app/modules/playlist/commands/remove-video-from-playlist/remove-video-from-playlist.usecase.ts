import { Result } from '~/lib/result';
import { UseCase } from '~/lib/usecase.base';
import {
  InvalidPlaylistDataError,
  PlaylistNotFoundError,
  PlaylistPermissionDeniedError,
  VideoNotFoundInPlaylistError,
} from '~/modules/playlist/domain/playlist.errors';
import type {
  RemoveVideoFromPlaylistUseCaseDependencies,
  RemoveVideoFromPlaylistUseCaseRequest,
  RemoveVideoFromPlaylistUseCaseResponse,
} from './remove-video-from-playlist.types';

export class RemoveVideoFromPlaylistUseCase extends UseCase<
  RemoveVideoFromPlaylistUseCaseRequest,
  RemoveVideoFromPlaylistUseCaseResponse
> {
  constructor(
    private dependencies: RemoveVideoFromPlaylistUseCaseDependencies,
  ) {
    super();
  }

  async execute(
    request: RemoveVideoFromPlaylistUseCaseRequest,
  ): Promise<Result<RemoveVideoFromPlaylistUseCaseResponse>> {
    const { playlistId, userId, videoId } = request;
    const { playlistRepository, userRepository, logger } = this.dependencies;

    try {
      // Validate playlist ID
      if (!playlistId?.trim()) {
        return Result.fail(new InvalidPlaylistDataError('id', 'Playlist ID is required'));
      }

      // Validate video ID
      if (!videoId?.trim()) {
        return Result.fail(new Error('Video ID is required'));
      }

      // Validate user
      const user = await userRepository.findById(userId);
      if (!user) {
        return Result.fail(new Error('User not found'));
      }

      // Get playlist
      const playlist = await playlistRepository.findById(playlistId);
      if (!playlist) {
        return Result.fail(new PlaylistNotFoundError(playlistId));
      }

      // Check ownership
      if (playlist.ownerId !== userId) {
        return Result.fail(
          new PlaylistPermissionDeniedError(playlistId, userId, 'modify'),
        );
      }

      // Check if video is in playlist
      if (!playlist.videoIds.includes(videoId)) {
        return Result.fail(
          new VideoNotFoundInPlaylistError(videoId, playlistId),
        );
      }

      // Remove video from playlist
      await playlistRepository.removeVideoFromPlaylist(playlistId, videoId);

      // Get updated playlist for response
      const updatedPlaylist = await playlistRepository.findById(playlistId);
      const remainingVideos = updatedPlaylist?.videoIds.length || 0;

      logger.log('Video removed from playlist successfully', {
        playlistId,
        videoId,
        userId,
        remainingVideos,
      });

      return Result.ok({
        success: true,
        message: `Video removed from playlist "${playlist.name}" successfully`,
        playlistId,
        videoId,
        remainingVideos,
      });
    }
    catch (error) {
      logger.error('Failed to remove video from playlist', {
        playlistId,
        videoId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return Result.fail(
        error instanceof Error ? error : new Error('Unknown error occurred'),
      );
    }
  }
}
