import { v4 as uuidv4 } from 'uuid';
import type { Video, PendingVideo } from "~/types/video";
import type { VideoRepository, PendingVideoRepository, CreateVideoInput, UpdateVideoInput } from "~/repositories/interfaces/VideoRepository";
import { BaseJsonRepository } from "~/repositories/base/BaseJsonRepository";
import { config } from "~/configs";

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
      addedAt: new Date(data.addedAt)
    };
  }

  /**
   * Transform Video entity to JSON data
   */
  protected transformToJson(entity: Video): any {
    return {
      ...entity,
      addedAt: entity.addedAt.toISOString()
    };
  }

  /**
   * Create a new Video entity from input data
   */
  protected createEntity(input: CreateVideoInput): Video {
    return {
      id: uuidv4(),
      title: input.title,
      tags: input.tags,
      videoUrl: input.videoUrl,
      thumbnailUrl: input.thumbnailUrl,
      duration: input.duration || 0, // Default to 0 if not provided
      format: input.format,
      description: input.description,
      addedAt: new Date()
    };
  }

  /**
   * Find videos by tag
   */
  async findByTag(tag: string): Promise<Video[]> {
    return this.findWhere(video => 
      video.tags.some(videoTag => 
        videoTag.toLowerCase() === tag.toLowerCase()
      )
    );
  }

  /**
   * Find videos by title (case-insensitive partial match)
   */
  async findByTitle(title: string): Promise<Video[]> {
    const searchTerm = title.toLowerCase();
    return this.findWhere(video => 
      video.title.toLowerCase().includes(searchTerm)
    );
  }

  /**
   * Find videos by format
   */
  async findByFormat(format: string): Promise<Video[]> {
    return this.findWhere(video => 
      video.format.toLowerCase() === format.toLowerCase()
    );
  }

  /**
   * Get all unique tags across all videos
   */
  async getAllTags(): Promise<string[]> {
    const videos = await this.findAll();
    const tagSet = new Set<string>();
    
    videos.forEach(video => {
      video.tags.forEach(tag => tagSet.add(tag));
    });
    
    return Array.from(tagSet).sort();
  }

  /**
   * Search videos by query (title or tags)
   */
  async search(query: string): Promise<Video[]> {
    const searchTerm = query.toLowerCase();
    
    return this.findWhere(video => {
      // Search in title
      const matchesTitle = video.title.toLowerCase().includes(searchTerm);
      
      // Search in tags
      const matchesTags = video.tags.some(tag => 
        tag.toLowerCase().includes(searchTerm)
      );
      
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
      ...input
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