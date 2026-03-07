import { promises as fs } from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Playlist, PlaylistType } from '../../domain/playlist.types';
import { JsonPlaylistRepository } from './json-playlist.repository';

describe('JsonPlaylistRepository', () => {
  let repository: JsonPlaylistRepository;
  let testFilePath: string;

  const mockPlaylist1: Omit<Playlist, 'id' | 'createdAt' | 'updatedAt'> = {
    name: 'Action Movies',
    description: 'Best action movies collection',
    type: 'user_created',
    videoIds: ['video-1', 'video-2', 'video-3'],
    thumbnailUrl: undefined,
    ownerId: 'user-123',
    isPublic: true,
    metadata: {
      genre: ['action', 'movies'],
    },
  };

  const mockPlaylist2: Omit<Playlist, 'id' | 'createdAt' | 'updatedAt'> = {
    name: 'Anime Series',
    description: 'My favorite anime collection',
    type: 'series',
    videoIds: ['video-4', 'video-5'],
    thumbnailUrl: undefined,
    ownerId: 'user-123',
    isPublic: false,
    metadata: {
      seriesName: 'Attack on Titan',
      genre: ['anime', 'action'],
      status: 'completed',
      episodeCount: 2,
    },
  };

  const mockPlaylist3: Omit<Playlist, 'id' | 'createdAt' | 'updatedAt'> = {
    name: 'Comedy Shows',
    description: 'Funny stuff',
    type: 'user_created',
    videoIds: ['video-6'],
    thumbnailUrl: undefined,
    ownerId: 'user-456',
    isPublic: true,
    metadata: {
      genre: ['comedy'],
    },
  };

  beforeEach(async () => {
    // Create a temporary test file
    testFilePath = path.join('/tmp', `test-playlists-${Date.now()}.json`);

    // Override the filePath in the repository
    repository = new JsonPlaylistRepository();
    (repository as any).filePath = testFilePath;

    // Initialize with empty array
    await fs.writeFile(testFilePath, JSON.stringify([]));
  });

  afterEach(async () => {
    // Clean up test file
    try {
      await fs.unlink(testFilePath);
    }
    catch {
      // File might not exist
    }
  });

  describe('basic CRUD operations', () => {
    it('should create a playlist successfully', async () => {
      const created = await repository.create(mockPlaylist1);

      expect(created.id).toBeDefined();
      expect(created.name).toBe(mockPlaylist1.name);
      expect(created.description).toBe(mockPlaylist1.description);
      expect(created.type).toBe(mockPlaylist1.type);
      expect(created.videoIds).toEqual(mockPlaylist1.videoIds);
      expect(created.ownerId).toBe(mockPlaylist1.ownerId);
      expect(created.isPublic).toBe(mockPlaylist1.isPublic);
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
      expect(created.metadata).toEqual(mockPlaylist1.metadata);
    });

    it('should find playlist by ID', async () => {
      const created = await repository.create(mockPlaylist1);
      const found = await repository.findById(created.id);

      expect(found).toEqual(created);
    });

    it('should return null for non-existent playlist', async () => {
      const found = await repository.findById('non-existent-id');
      expect(found).toBeNull();
    });

    it('should update playlist successfully', async () => {
      const created = await repository.create(mockPlaylist1);
      const updates = {
        name: 'Updated Action Movies',
        description: 'Updated description',
        isPublic: false,
      };

      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      const updated = await repository.update(created.id, updates);

      expect(updated).not.toBeNull();
      if (updated) {
        expect(updated.name).toBe(updates.name);
        expect(updated.description).toBe(updates.description);
        expect(updated.isPublic).toBe(updates.isPublic);
        expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
      }
    });

    it('should delete playlist successfully', async () => {
      const created = await repository.create(mockPlaylist1);
      const deleted = await repository.delete(created.id);

      expect(deleted).toBe(true);

      const found = await repository.findById(created.id);
      expect(found).toBeNull();
    });

    it('should return false when deleting non-existent playlist', async () => {
      const deleted = await repository.delete('non-existent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('query operations', () => {
    beforeEach(async () => {
      await repository.create(mockPlaylist1);
      await repository.create(mockPlaylist2);
      await repository.create(mockPlaylist3);
    });

    it('should find all playlists', async () => {
      const playlists = await repository.findAll();
      expect(playlists).toHaveLength(3);
    });

    it('should find playlists by owner', async () => {
      const user123Playlists = await repository.findByOwner('user-123');
      expect(user123Playlists).toHaveLength(2);
      expect(user123Playlists.every(p => p.ownerId === 'user-123')).toBe(true);

      const user456Playlists = await repository.findByOwner('user-456');
      expect(user456Playlists).toHaveLength(1);
      expect(user456Playlists[0].ownerId).toBe('user-456');
    });

    it('should find playlists by type', async () => {
      const userCreatedPlaylists = await repository.findByType('user_created');
      expect(userCreatedPlaylists).toHaveLength(2);
      expect(userCreatedPlaylists.every(p => p.type === 'user_created')).toBe(true);

      const seriesPlaylists = await repository.findByType('series');
      expect(seriesPlaylists).toHaveLength(1);
      expect(seriesPlaylists[0].type).toBe('series');
    });

    it('should find public playlists only', async () => {
      const publicPlaylists = await repository.findPublicPlaylists();
      expect(publicPlaylists).toHaveLength(2);
      expect(publicPlaylists.every(p => p.isPublic === true)).toBe(true);
    });

    it('should find playlists by series name', async () => {
      const attackOnTitanPlaylists = await repository.findBySeries('Attack on Titan');
      expect(attackOnTitanPlaylists).toHaveLength(1);
      expect(attackOnTitanPlaylists[0].metadata?.seriesName).toBe('Attack on Titan');

      const nonExistentSeries = await repository.findBySeries('Non-existent Series');
      expect(nonExistentSeries).toHaveLength(0);
    });

    it('should find playlists by name', async () => {
      const actionPlaylists = await repository.findByName('action');
      expect(actionPlaylists).toHaveLength(1);
      expect(actionPlaylists[0].name.toLowerCase()).toContain('action');

      const moviePlaylists = await repository.findByName('Movie');
      expect(moviePlaylists).toHaveLength(1);
    });

    it('should search playlists by query', async () => {
      const actionResults = await repository.search('action');
      expect(actionResults.length).toBeGreaterThan(0);

      const comedyResults = await repository.search('comedy');
      expect(comedyResults).toHaveLength(1);
      expect(comedyResults[0].name).toBe('Comedy Shows');
    });

    it('should get all unique genres', async () => {
      const genres = await repository.getAllGenres();
      expect(genres).toContain('action');
      expect(genres).toContain('movies');
      expect(genres).toContain('anime');
      expect(genres).toContain('comedy');
      expect(genres).toHaveLength(4);
    });
  });

  describe('filter operations', () => {
    beforeEach(async () => {
      await repository.create(mockPlaylist1);
      await repository.create(mockPlaylist2);
      await repository.create(mockPlaylist3);
    });

    it('should filter by type', async () => {
      const filters = { type: 'series' as PlaylistType };
      const results = await repository.findWithFilters(filters);

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('series');
    });

    it('should filter by owner', async () => {
      const filters = { ownerId: 'user-123' };
      const results = await repository.findWithFilters(filters);

      expect(results).toHaveLength(2);
      expect(results.every(p => p.ownerId === 'user-123')).toBe(true);
    });

    it('should filter by public/private', async () => {
      const publicFilters = { isPublic: true };
      const publicResults = await repository.findWithFilters(publicFilters);
      expect(publicResults).toHaveLength(2);
      expect(publicResults.every(p => p.isPublic === true)).toBe(true);

      const privateFilters = { isPublic: false };
      const privateResults = await repository.findWithFilters(privateFilters);
      expect(privateResults).toHaveLength(1);
      expect(privateResults[0].isPublic).toBe(false);
    });

    it('should filter by genre', async () => {
      const filters = { genre: ['action'] };
      const results = await repository.findWithFilters(filters);

      expect(results).toHaveLength(2);
      expect(results.every(p => p.metadata?.genre?.some(g => g === 'action'))).toBe(true);
    });

    it('should filter by search query', async () => {
      const filters = { searchQuery: 'anime' };
      const results = await repository.findWithFilters(filters);

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Anime Series');
    });

    it('should filter by series name', async () => {
      const filters = { seriesName: 'Attack on Titan' };
      const results = await repository.findWithFilters(filters);

      expect(results).toHaveLength(1);
      expect(results[0].metadata?.seriesName).toBe('Attack on Titan');
    });

    it('should filter by status', async () => {
      const filters = { status: 'completed' as const };
      const results = await repository.findWithFilters(filters);

      expect(results).toHaveLength(1);
      expect(results[0].metadata?.status).toBe('completed');
    });

    it('should apply multiple filters', async () => {
      const filters = {
        type: 'series' as PlaylistType,
        ownerId: 'user-123',
        isPublic: false,
        genre: ['anime'],
      };
      const results = await repository.findWithFilters(filters);

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('series');
      expect(results[0].ownerId).toBe('user-123');
      expect(results[0].isPublic).toBe(false);
      expect(results[0].metadata?.genre).toContain('anime');
    });
  });

  describe('popularity and recent queries', () => {
    beforeEach(async () => {
      await repository.create(mockPlaylist1); // 3 videos
      await repository.create(mockPlaylist2); // 2 videos
      await repository.create(mockPlaylist3); // 1 video
    });

    it('should get most popular playlists', async () => {
      const popular = await repository.getMostPopular(2);

      expect(popular).toHaveLength(2);
      // Should be sorted by video count descending (among public playlists)
      expect(popular[0].videoIds.length).toBeGreaterThanOrEqual(popular[1].videoIds.length);
      // Should only include public playlists
      expect(popular.every(p => p.isPublic === true)).toBe(true);
    });

    it('should get recently created playlists', async () => {
      const recent = await repository.getRecentlyCreated(3);

      expect(recent).toHaveLength(2); // Only public playlists
      // Should be sorted by creation date descending
      for (let i = 0; i < recent.length - 1; i++) {
        expect(recent[i].createdAt.getTime()).toBeGreaterThanOrEqual(
          recent[i + 1].createdAt.getTime(),
        );
      }
    });
  });

  describe('name uniqueness', () => {
    it('should check if playlist name exists for user', async () => {
      await repository.create(mockPlaylist1);

      const exists = await repository.nameExistsForUser('Action Movies', 'user-123');
      expect(exists).toBe(true);

      const notExists = await repository.nameExistsForUser('Non-existent Playlist', 'user-123');
      expect(notExists).toBe(false);

      const existsForDifferentUser = await repository.nameExistsForUser('Action Movies', 'user-456');
      expect(existsForDifferentUser).toBe(false);
    });

    it('should exclude playlist ID when checking name existence', async () => {
      const created = await repository.create(mockPlaylist1);

      // Should return false when excluding the same playlist ID
      const exists = await repository.nameExistsForUser('Action Movies', 'user-123', created.id);
      expect(exists).toBe(false);

      // Should return true when not excluding
      const existsWithoutExclusion = await repository.nameExistsForUser('Action Movies', 'user-123');
      expect(existsWithoutExclusion).toBe(true);
    });
  });

  describe('video management', () => {
    let playlist: Playlist;

    beforeEach(async () => {
      playlist = await repository.create(mockPlaylist1);
    });

    it('should add video to playlist', async () => {
      await repository.addVideoToPlaylist(playlist.id, 'new-video');

      const updated = await repository.findById(playlist.id);
      expect(updated?.videoIds).toContain('new-video');
      expect(updated?.videoIds).toHaveLength(4);
    });

    it('should add video at specific position', async () => {
      await repository.addVideoToPlaylist(playlist.id, 'new-video', 1);

      const updated = await repository.findById(playlist.id);
      expect(updated?.videoIds[1]).toBe('new-video');
      expect(updated?.videoIds).toHaveLength(4);
    });

    it('should fail to add duplicate video', async () => {
      await expect(
        repository.addVideoToPlaylist(playlist.id, 'video-1'),
      ).rejects.toThrow('already in playlist');
    });

    it('should remove video from playlist', async () => {
      await repository.removeVideoFromPlaylist(playlist.id, 'video-2');

      const updated = await repository.findById(playlist.id);
      expect(updated?.videoIds).not.toContain('video-2');
      expect(updated?.videoIds).toHaveLength(2);
    });

    it('should fail to remove non-existent video', async () => {
      await expect(
        repository.removeVideoFromPlaylist(playlist.id, 'non-existent-video'),
      ).rejects.toThrow('not found in playlist');
    });

    it('should reorder playlist items', async () => {
      const newOrder = ['video-3', 'video-1', 'video-2'];
      await repository.reorderPlaylistItems(playlist.id, newOrder);

      const updated = await repository.findById(playlist.id);
      expect(updated?.videoIds).toEqual(newOrder);
    });

    it('should fail to reorder with invalid video list', async () => {
      const invalidOrder = ['video-1', 'video-2']; // Missing video-3

      await expect(
        repository.reorderPlaylistItems(playlist.id, invalidOrder),
      ).rejects.toThrow('same videos as current playlist');
    });

    it('should find playlists containing video', async () => {
      const playlists = await repository.findContainingVideo('video-1');

      expect(playlists).toHaveLength(1);
      expect(playlists[0].id).toBe(playlist.id);
    });
  });

  describe('batch operations', () => {
    let playlist1: Playlist;
    let playlist2: Playlist;

    beforeEach(async () => {
      playlist1 = await repository.create(mockPlaylist1);
      playlist2 = await repository.create(mockPlaylist2);
    });

    it('should batch delete playlists', async () => {
      const result = await repository.batchDelete([playlist1.id, playlist2.id]);

      expect(result.successful).toEqual([playlist1.id, playlist2.id]);
      expect(result.failed).toHaveLength(0);

      const remaining = await repository.findAll();
      expect(remaining).toHaveLength(0);
    });

    it('should handle partial batch delete failures', async () => {
      const result = await repository.batchDelete([playlist1.id, 'non-existent-id']);

      expect(result.successful).toEqual([playlist1.id]);
      expect(result.failed).toEqual(['non-existent-id']);
    });

    it('should update playlist access', async () => {
      const success = await repository.updateAccess(playlist2.id, true);
      expect(success).toBe(true);

      const updated = await repository.findById(playlist2.id);
      expect(updated?.isPublic).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle playlist not found errors', async () => {
      await expect(
        repository.addVideoToPlaylist('non-existent-id', 'video-1'),
      ).rejects.toThrow('not found');

      await expect(
        repository.removeVideoFromPlaylist('non-existent-id', 'video-1'),
      ).rejects.toThrow('not found');

      await expect(
        repository.reorderPlaylistItems('non-existent-id', ['video-1']),
      ).rejects.toThrow('not found');
    });

    it('should return null for getPlaylistWithVideos with non-existent playlist', async () => {
      const result = await repository.getPlaylistWithVideos('non-existent-id');
      expect(result).toBeNull();
    });

    it('should return empty playlist with videos for existing playlist', async () => {
      const playlist = await repository.create(mockPlaylist1);
      const result = await repository.getPlaylistWithVideos(playlist.id);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.id).toBe(playlist.id);
        expect(result.videos).toEqual([]);
      }
    });
  });
});
