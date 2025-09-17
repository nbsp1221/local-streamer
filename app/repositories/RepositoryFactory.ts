import { JsonPlaylistRepository } from '../modules/playlist/infrastructure/adapters/json-playlist.repository';
import type { PlaylistRepository } from './interfaces/PlaylistRepository';
import type { SessionRepository } from './interfaces/SessionRepository';
import type { UserRepository } from './interfaces/UserRepository';
import type { PendingVideoRepository, VideoRepository } from './interfaces/VideoRepository';
import { JsonSessionRepository } from './JsonSessionRepository';
import { JsonUserRepository } from './JsonUserRepository';
import { JsonPendingVideoRepository, JsonVideoRepository } from './JsonVideoRepository';

/**
 * Repository factory for creating and managing repository instances
 * Provides singleton instances to ensure consistency across the application
 */
class RepositoryFactory {
  private videoRepository: VideoRepository | null = null;
  private pendingVideoRepository: PendingVideoRepository | null = null;
  private userRepository: UserRepository | null = null;
  private sessionRepository: SessionRepository | null = null;
  private playlistRepository: PlaylistRepository | null = null;

  /**
   * Get VideoRepository instance (singleton)
   */
  getVideoRepository(): VideoRepository {
    if (!this.videoRepository) {
      this.videoRepository = new JsonVideoRepository();
    }
    return this.videoRepository;
  }

  /**
   * Get PendingVideoRepository instance (singleton)
   */
  getPendingVideoRepository(): PendingVideoRepository {
    if (!this.pendingVideoRepository) {
      this.pendingVideoRepository = new JsonPendingVideoRepository();
    }
    return this.pendingVideoRepository;
  }

  /**
   * Get UserRepository instance (singleton)
   */
  getUserRepository(): UserRepository {
    if (!this.userRepository) {
      this.userRepository = new JsonUserRepository();
    }
    return this.userRepository;
  }

  /**
   * Get SessionRepository instance (singleton)
   */
  getSessionRepository(): SessionRepository {
    if (!this.sessionRepository) {
      this.sessionRepository = new JsonSessionRepository();
    }
    return this.sessionRepository;
  }

  /**
   * Get PlaylistRepository instance (singleton)
   */
  getPlaylistRepository(): PlaylistRepository {
    if (!this.playlistRepository) {
      this.playlistRepository = new JsonPlaylistRepository();
    }
    return this.playlistRepository;
  }

  /**
   * Clear all repository instances (useful for testing)
   */
  clearInstances(): void {
    this.videoRepository = null;
    this.pendingVideoRepository = null;
    this.userRepository = null;
    this.sessionRepository = null;
    this.playlistRepository = null;
  }
}

// Export singleton factory instance
export const repositoryFactory = new RepositoryFactory();

// Export type-safe convenience functions
export const getVideoRepository = () => repositoryFactory.getVideoRepository();
export const getPendingVideoRepository = () => repositoryFactory.getPendingVideoRepository();
export const getUserRepository = () => repositoryFactory.getUserRepository();
export const getSessionRepository = () => repositoryFactory.getSessionRepository();
export const getPlaylistRepository = () => repositoryFactory.getPlaylistRepository();
