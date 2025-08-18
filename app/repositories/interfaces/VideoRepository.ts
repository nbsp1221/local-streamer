import type { Video, PendingVideo, VideoFormat } from "~/types/video";
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
  format: VideoFormat;
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
  format?: VideoFormat;
  description?: string;
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
  findByFormat(format: VideoFormat): Promise<Video[]>;

  /**
   * Get all unique tags across all videos
   */
  getAllTags(): Promise<string[]>;

  /**
   * Search videos by query (title or tags)
   */
  search(query: string): Promise<Video[]>;


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