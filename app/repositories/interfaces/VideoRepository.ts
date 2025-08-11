import type { Video, PendingVideo } from "~/types/video";
import type { BaseRepository } from "./BaseRepository";

/**
 * Input for creating a new video
 */
export interface CreateVideoInput {
  id?: string; // Optional ID - if not provided, UUID will be generated
  title: string;
  tags: string[];
  videoUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  format: string;
  description?: string;
}

/**
 * Input for updating an existing video
 */
export interface UpdateVideoInput {
  title?: string;
  tags?: string[];
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  format?: string;
  description?: string;
  // HLS-related fields
  hasHLS?: boolean;
  hlsGeneratedAt?: Date;
  originalCleanupAt?: Date;
}

/**
 * Video repository interface extending base repository with video-specific methods
 */
export interface VideoRepository extends BaseRepository<Video, CreateVideoInput, UpdateVideoInput> {
  /**
   * Find videos by tag
   */
  findByTag(tag: string): Promise<Video[]>;

  /**
   * Find videos by title (case-insensitive partial match)
   */
  findByTitle(title: string): Promise<Video[]>;

  /**
   * Find videos by format
   */
  findByFormat(format: string): Promise<Video[]>;

  /**
   * Get all unique tags across all videos
   */
  getAllTags(): Promise<string[]>;

  /**
   * Search videos by query (title or tags)
   */
  search(query: string): Promise<Video[]>;

  /**
   * Update HLS status for a video
   */
  updateHLSStatus(id: string, hasHLS: boolean, generatedAt?: Date): Promise<Video | null>;

  /**
   * Find videos without HLS conversion (for migration)
   */
  findVideosWithoutHLS(): Promise<Video[]>;

  /**
   * Find videos with HLS conversion
   */
  findVideosWithHLS(): Promise<Video[]>;

  /**
   * Schedule original file cleanup
   */
  scheduleOriginalCleanup(id: string, cleanupAt: Date): Promise<Video | null>;
}

/**
 * Pending video repository interface for managing incoming videos
 */
export interface PendingVideoRepository extends BaseRepository<PendingVideo, Omit<PendingVideo, 'id'>, Partial<Omit<PendingVideo, 'id'>>> {
  /**
   * Find pending video by filename
   */
  findByFilename(filename: string): Promise<PendingVideo | null>;

  /**
   * Remove pending video by filename
   */
  deleteByFilename(filename: string): Promise<boolean>;
}