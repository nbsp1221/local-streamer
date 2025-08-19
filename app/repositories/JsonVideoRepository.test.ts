import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PendingVideo, Video } from '~/types/video';
import type { CreateVideoInput, UpdateVideoInput } from './interfaces/VideoRepository';
import { JsonPendingVideoRepository, JsonVideoRepository } from './JsonVideoRepository';
import { JsonWriteQueue } from './utils/JsonWriteQueue';

describe('JsonVideoRepository', () => {
  let repository: JsonVideoRepository;
  let writeQueue: JsonWriteQueue;
  let testDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'video-repo-test-'));
    testFilePath = path.join(testDir, 'videos.json');

    // Create test repository with custom write queue and file path
    writeQueue = new JsonWriteQueue();
    repository = new (class extends JsonVideoRepository {
      protected readonly filePath = testFilePath;
    })(writeQueue);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    }
    catch (error) {
      // Ignore cleanup errors
    }

    writeQueue.clearMutexes();
  });

  const createSampleVideo = (overrides?: Partial<CreateVideoInput>): CreateVideoInput => ({
    title: 'Test Video',
    tags: ['test', 'sample'],
    videoUrl: '/videos/test.mp4',
    thumbnailUrl: '/thumbnails/test.jpg',
    duration: 120,
    format: 'mp4',
    description: 'A test video',
    ...overrides,
  });

  describe('Basic CRUD operations', () => {
    it('should create a video', async () => {
      const input = createSampleVideo();

      const video = await repository.create(input);

      expect(video).toMatchObject({
        title: input.title,
        tags: input.tags,
        videoUrl: input.videoUrl,
        thumbnailUrl: input.thumbnailUrl,
        duration: input.duration,
        format: input.format,
        description: input.description,
      });
      expect(video.id).toBeDefined();
      expect(video.addedAt).toBeInstanceOf(Date);
    });

    it('should find all videos', async () => {
      const video1 = await repository.create(createSampleVideo({ title: 'Video 1' }));
      const video2 = await repository.create(createSampleVideo({ title: 'Video 2' }));

      const videos = await repository.findAll();

      expect(videos).toHaveLength(2);
      // Newest first (video2 should be first)
      expect(videos[0].title).toBe('Video 2');
      expect(videos[1].title).toBe('Video 1');
    });

    it('should find video by ID', async () => {
      const video = await repository.create(createSampleVideo());

      const foundVideo = await repository.findById(video.id);

      expect(foundVideo).toEqual(video);
    });

    it('should return null for non-existent video', async () => {
      const foundVideo = await repository.findById('non-existent-id');

      expect(foundVideo).toBeNull();
    });

    it('should update video', async () => {
      const video = await repository.create(createSampleVideo());
      const updates: UpdateVideoInput = {
        title: 'Updated Title',
        tags: ['updated', 'test'],
      };

      const updatedVideo = await repository.update(video.id, updates);

      expect(updatedVideo).toMatchObject({
        ...video,
        title: 'Updated Title',
        tags: ['updated', 'test'],
      });
      // Should preserve id and addedAt
      expect(updatedVideo!.id).toBe(video.id);
      expect(updatedVideo!.addedAt).toEqual(video.addedAt);
    });

    it('should return null when updating non-existent video', async () => {
      const result = await repository.update('non-existent-id', { title: 'New Title' });

      expect(result).toBeNull();
    });

    it('should delete video', async () => {
      const video = await repository.create(createSampleVideo());

      const deleted = await repository.delete(video.id);

      expect(deleted).toBe(true);

      const foundVideo = await repository.findById(video.id);
      expect(foundVideo).toBeNull();
    });

    it('should return false when deleting non-existent video', async () => {
      const result = await repository.delete('non-existent-id');

      expect(result).toBe(false);
    });

    it('should check if video exists', async () => {
      const video = await repository.create(createSampleVideo());

      expect(await repository.exists(video.id)).toBe(true);
      expect(await repository.exists('non-existent-id')).toBe(false);
    });

    it('should count videos', async () => {
      expect(await repository.count()).toBe(0);

      await repository.create(createSampleVideo({ title: 'Video 1' }));
      await repository.create(createSampleVideo({ title: 'Video 2' }));

      expect(await repository.count()).toBe(2);
    });
  });

  describe('Video-specific methods', () => {
    beforeEach(async () => {
      // Create test videos
      await repository.create(createSampleVideo({
        title: 'Action Movie',
        tags: ['action', 'thriller'],
        format: 'mp4',
      }));

      await repository.create(createSampleVideo({
        title: 'Comedy Show',
        tags: ['comedy', 'funny'],
        format: 'avi',
      }));

      await repository.create(createSampleVideo({
        title: 'Action Series',
        tags: ['action', 'series'],
        format: 'mp4',
      }));
    });

    it('should find videos by tag', async () => {
      const actionVideos = await repository.findByTag('action');

      expect(actionVideos).toHaveLength(2);
      expect(actionVideos.every(video => video.tags.includes('action'))).toBe(true);
    });

    it('should find videos by tag (case insensitive)', async () => {
      const actionVideos = await repository.findByTag('ACTION');

      expect(actionVideos).toHaveLength(2);
    });

    it('should find videos by title (partial match)', async () => {
      const actionVideos = await repository.findByTitle('Action');

      expect(actionVideos).toHaveLength(2);
      expect(actionVideos.every(video => video.title.includes('Action'))).toBe(true);
    });

    it('should find videos by title (case insensitive)', async () => {
      const actionVideos = await repository.findByTitle('action');

      expect(actionVideos).toHaveLength(2);
    });

    it('should find videos by format', async () => {
      const mp4Videos = await repository.findByFormat('mp4');

      expect(mp4Videos).toHaveLength(2);
      expect(mp4Videos.every(video => video.format === 'mp4')).toBe(true);
    });

    it('should find videos by format (case insensitive)', async () => {
      const aviVideos = await repository.findByFormat('avi');

      expect(aviVideos).toHaveLength(1);
      expect(aviVideos[0].format).toBe('avi');
    });

    it('should get all unique tags', async () => {
      const tags = await repository.getAllTags();

      expect(tags.sort()).toEqual(['action', 'comedy', 'funny', 'series', 'thriller']);
    });

    it('should search videos by query', async () => {
      // Search by title
      const movieResults = await repository.search('Movie');
      expect(movieResults).toHaveLength(1);
      expect(movieResults[0].title).toBe('Action Movie');

      // Search by tag
      const comedyResults = await repository.search('comedy');
      expect(comedyResults).toHaveLength(1);
      expect(comedyResults[0].title).toBe('Comedy Show');

      // Search by partial match
      const actionResults = await repository.search('action');
      expect(actionResults).toHaveLength(2);
    });

    it('should search videos (case insensitive)', async () => {
      const results = await repository.search('COMEDY');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Comedy Show');
    });
  });

  describe('Data persistence and transformation', () => {
    it('should persist data across repository instances', async () => {
      const video = await repository.create(createSampleVideo());

      // Create new repository instance with same file path
      const newRepository = new (class extends JsonVideoRepository {
        protected readonly filePath = testFilePath;
      })(writeQueue);

      const foundVideo = await newRepository.findById(video.id);
      expect(foundVideo).toEqual(video);
    });

    it('should handle Date objects correctly', async () => {
      const video = await repository.create(createSampleVideo());

      // Read raw file content
      const fileContent = await fs.readFile(testFilePath, 'utf-8');
      const rawData = JSON.parse(fileContent);

      // Should store date as ISO string
      expect(typeof rawData[0].addedAt).toBe('string');
      expect(rawData[0].addedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);

      // But when loaded, should be Date object
      expect(video.addedAt).toBeInstanceOf(Date);
    });
  });

  describe('scheduleOriginalCleanup', () => {
    it('should schedule cleanup for existing video', async () => {
      const video = await repository.create(createSampleVideo());
      const cleanupAt = new Date('2025-02-01T00:00:00Z');

      const updatedVideo = await repository.scheduleOriginalCleanup(video.id, cleanupAt);

      expect(updatedVideo).toBeDefined();
      expect(updatedVideo!.originalCleanupAt).toEqual(cleanupAt);
    });

    it('should return null for non-existent video', async () => {
      const cleanupAt = new Date();

      const result = await repository.scheduleOriginalCleanup('non-existent-id', cleanupAt);

      expect(result).toBeNull();
    });

    it('should handle originalCleanupAt Date transformation', async () => {
      const cleanupAt = new Date('2025-02-15T08:30:00Z');
      const video = await repository.create(createSampleVideo());

      // Update video with cleanup schedule
      const updatedVideo = await repository.scheduleOriginalCleanup(video.id, cleanupAt);

      // Read raw file content
      const fileContent = await fs.readFile(testFilePath, 'utf-8');
      const rawData = JSON.parse(fileContent);
      const savedVideo = rawData.find((v: any) => v.id === video.id);

      // Should store date as ISO string
      expect(typeof savedVideo.originalCleanupAt).toBe('string');
      expect(savedVideo.originalCleanupAt).toBe(cleanupAt.toISOString());

      // But when loaded, should be Date object
      expect(updatedVideo!.originalCleanupAt).toBeInstanceOf(Date);
      expect(updatedVideo!.originalCleanupAt).toEqual(cleanupAt);
    });
  });
});

describe('JsonPendingVideoRepository', () => {
  let repository: JsonPendingVideoRepository;
  let writeQueue: JsonWriteQueue;
  let testDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pending-video-repo-test-'));
    testFilePath = path.join(testDir, 'pending.json');

    writeQueue = new JsonWriteQueue();
    repository = new (class extends JsonPendingVideoRepository {
      protected readonly filePath = testFilePath;
    })(writeQueue);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    }
    catch (error) {
      // Ignore cleanup errors
    }

    writeQueue.clearMutexes();
  });

  const createSamplePendingVideo = (overrides?: Partial<Omit<PendingVideo, 'id'>>): Omit<PendingVideo, 'id'> => ({
    filename: 'test-video.mp4',
    size: 1024000,
    type: 'video/mp4',
    format: 'mp4',
    ...overrides,
  });

  it('should create pending video', async () => {
    const input = createSamplePendingVideo();

    const pendingVideo = await repository.create(input);

    expect(pendingVideo).toMatchObject(input);
    expect(pendingVideo.id).toBeDefined();
  });

  it('should find pending video by filename', async () => {
    const input = createSamplePendingVideo({ filename: 'unique-video.mp4' });
    await repository.create(input);

    const found = await repository.findByFilename('unique-video.mp4');

    expect(found).toMatchObject(input);
  });

  it('should return null for non-existent filename', async () => {
    const found = await repository.findByFilename('non-existent.mp4');

    expect(found).toBeNull();
  });

  it('should delete pending video by filename', async () => {
    const input = createSamplePendingVideo({ filename: 'to-delete.mp4' });
    await repository.create(input);

    const deleted = await repository.deleteByFilename('to-delete.mp4');

    expect(deleted).toBe(true);

    const found = await repository.findByFilename('to-delete.mp4');
    expect(found).toBeNull();
  });

  it('should return false when deleting non-existent filename', async () => {
    const result = await repository.deleteByFilename('non-existent.mp4');

    expect(result).toBe(false);
  });
});
