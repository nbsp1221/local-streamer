import { v4 as uuidv4 } from 'uuid';
import type { CreateVideoInput, PendingVideoRepository, UpdateVideoInput, VideoRepository } from '~/repositories/interfaces/VideoRepository';
import type { PendingVideo, Video } from '~/types/video';
import { config } from '~/configs';
import { BaseJsonRepository } from '~/repositories/base/BaseJsonRepository';

/**
 * JSON-based implementation of VideoRepository
 */
export class JsonVideoRepository extends BaseJsonRepository<Video, CreateVideoInput, UpdateVideoInput> implements VideoRepository {
  protected readonly filePath = config.paths.videosJson;

  /**
   * Transform raw JSON data to Video entity
   */
  protected transformFromJson(data: any): Video {
    return {
      ...data,
      // Handle migration: use createdAt if available, otherwise migrate from addedAt
      createdAt: new Date(data.createdAt || data.addedAt),
      // Remove originalCleanupAt - ignore it completely
      originalCleanupAt: undefined,
    };
  }

  /**
   * Transform Video entity to JSON data
   */
  protected transformToJson(entity: Video): any {
    return {
      ...entity,
      createdAt: entity.createdAt.toISOString(),
      // Don't serialize originalCleanupAt - it's removed
    };
  }

  /**
   * Create a new Video entity from input data
   */
  protected createEntity(input: CreateVideoInput): Video {
    return {
      id: input.id || uuidv4(), // Use provided ID or generate new one
      title: input.title,
      tags: input.tags,
      videoUrl: input.videoUrl,
      thumbnailUrl: input.thumbnailUrl,
      duration: input.duration || 0, // Default to 0 if not provided
      description: input.description,
      createdAt: new Date(),
    };
  }

  /**
   * Find videos by tag
   */
  async findByTag(tag: string): Promise<Video[]> {
    return this.findWhere(video => video.tags.some(videoTag => videoTag.toLowerCase() === tag.toLowerCase()));
  }

  /**
   * Find videos by title (case-insensitive partial match)
   */
  async findByTitle(title: string): Promise<Video[]> {
    const searchTerm = title.toLowerCase();
    return this.findWhere(video => video.title.toLowerCase().includes(searchTerm));
  }

  /**
   * Get all unique tags across all videos
   */
  async getAllTags(): Promise<string[]> {
    const videos = await this.findAll();
    const tagSet = new Set<string>();

    videos.forEach((video) => {
      video.tags.forEach(tag => tagSet.add(tag));
    });

    return Array.from(tagSet).sort();
  }

  /**
   * Search videos by query (title or tags)
   */
  async search(query: string): Promise<Video[]> {
    const searchTerm = query.toLowerCase();

    return this.findWhere((video) => {
      // Search in title
      const matchesTitle = video.title.toLowerCase().includes(searchTerm);

      // Search in tags
      const matchesTags = video.tags.some(tag => tag.toLowerCase().includes(searchTerm));

      return matchesTitle || matchesTags;
    });
  }
}

/**
 * JSON-based implementation of PendingVideoRepository
 */
export class JsonPendingVideoRepository extends BaseJsonRepository<PendingVideo, Omit<PendingVideo, 'id'>, Partial<Omit<PendingVideo, 'id'>>> implements PendingVideoRepository {
  protected readonly filePath = config.paths.pendingJson;

  /**
   * Transform raw JSON data to PendingVideo entity
   */
  protected transformFromJson(data: any): PendingVideo {
    return {
      ...data,
      // PendingVideo doesn't have Date fields, so no transformation needed
    };
  }

  /**
   * Transform PendingVideo entity to JSON data
   */
  protected transformToJson(entity: PendingVideo): any {
    return entity;
  }

  /**
   * Create a new PendingVideo entity from input data
   */
  protected createEntity(input: Omit<PendingVideo, 'id'>): PendingVideo {
    return {
      id: uuidv4(),
      ...input,
    };
  }

  /**
   * Find pending video by filename
   */
  async findByFilename(filename: string): Promise<PendingVideo | null> {
    return this.findOneWhere(video => video.filename === filename);
  }

  /**
   * Remove pending video by filename
   */
  async deleteByFilename(filename: string): Promise<boolean> {
    const videos = await this.readAllFromFile();
    const initialLength = videos.length;

    const filteredVideos = videos.filter(video => video.filename !== filename);

    if (filteredVideos.length === initialLength) {
      return false; // Video not found
    }

    await this.writeAllToFile(filteredVideos);
    return true;
  }
}
