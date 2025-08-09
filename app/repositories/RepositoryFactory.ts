import { JsonVideoRepository, JsonPendingVideoRepository } from "./JsonVideoRepository";
import { JsonUserRepository } from "./JsonUserRepository";
import { JsonSessionRepository } from "./JsonSessionRepository";
import type { VideoRepository, PendingVideoRepository } from "./interfaces/VideoRepository";
import type { UserRepository } from "./interfaces/UserRepository";
import type { SessionRepository } from "./interfaces/SessionRepository";

/**
 * Repository factory for creating and managing repository instances
 * Provides singleton instances to ensure consistency across the application
 */
class RepositoryFactory {
  private videoRepository: VideoRepository | null = null;
  private pendingVideoRepository: PendingVideoRepository | null = null;
  private userRepository: UserRepository | null = null;
  private sessionRepository: SessionRepository | null = null;

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
   * Clear all repository instances (useful for testing)
   */
  clearInstances(): void {
    this.videoRepository = null;
    this.pendingVideoRepository = null;
    this.userRepository = null;
    this.sessionRepository = null;
  }
}

// Export singleton factory instance
export const repositoryFactory = new RepositoryFactory();

// Export type-safe convenience functions
export const getVideoRepository = () => repositoryFactory.getVideoRepository();
export const getPendingVideoRepository = () => repositoryFactory.getPendingVideoRepository();
export const getUserRepository = () => repositoryFactory.getUserRepository();
export const getSessionRepository = () => repositoryFactory.getSessionRepository();