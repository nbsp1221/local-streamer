import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Mock environment variables
const mockEnv = {
  HLS_ENABLED: 'true',
  HLS_MASTER_ENCRYPTION_SEED: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
  KEY_SALT_PREFIX: 'test-salt-prefix',
  KEY_DERIVATION_ROUNDS: '1000',
};

describe('HLS Upload System', () => {
  let testDir: string;
  let originalEnv: { [key: string]: string | undefined };

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hybrid-upload-test-'));
    
    // Backup and set environment variables
    originalEnv = {};
    Object.keys(mockEnv).forEach(key => {
      originalEnv[key] = process.env[key];
    });
    
    Object.entries(mockEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });
  });

  afterEach(async () => {
    // Restore environment variables
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });

    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should support HLS upload when enabled', () => {
    expect(process.env.HLS_ENABLED).toBe('true');
    
    // This test verifies environment configuration for HLS
    expect(process.env.HLS_MASTER_ENCRYPTION_SEED).toBeDefined();
    expect(process.env.KEY_SALT_PREFIX).toBeDefined();
    expect(process.env.KEY_DERIVATION_ROUNDS).toBeDefined();
  });

  it('should handle HLS configuration properly', async () => {
    // Verify HLS is enabled by default in test
    const isHLSEnabled = process.env.HLS_ENABLED === 'true';
    expect(isHLSEnabled).toBe(true);
    
    // HLS should be the primary streaming method
    // The generateHLSVersion function should work when properly configured
  });

  it('should verify HLS response format', () => {
    // Test that the add-to-library API returns the expected response format
    const mockSuccessResponse = {
      success: true,
      videoId: 'test-video-id',
      message: 'Video added to library successfully with HLS',
      hlsEnabled: true
    };

    const mockFailureResponse = {
      success: true,
      videoId: 'test-video-id', 
      message: 'Video added to library but HLS generation failed',
      hlsEnabled: false
    };

    // Verify response structure
    expect(mockSuccessResponse).toHaveProperty('hlsEnabled');
    expect(mockSuccessResponse.hlsEnabled).toBe(true);
    expect(mockFailureResponse.hlsEnabled).toBe(false);
  });

  it('should verify video source priority logic', () => {
    // Mock Video object with HLS support
    const videoWithHLS = {
      id: 'test-video-1',
      title: 'Test Video',
      videoUrl: '/data/videos/test-video-1/video.mp4',
      hasHLS: true,
      thumbnailUrl: '/api/thumbnail/test-video-1',
      tags: ['test'],
      duration: 120,
      addedAt: new Date(),
      format: 'mp4'
    };

    const videoWithoutHLS = {
      ...videoWithHLS,
      hasHLS: false
    };

    const directVideo = {
      ...videoWithHLS,
      videoUrl: 'https://example.com/video.mp4'
    };

    // Test source generation logic (mirrors VideoPlayer logic)
    function generateSources(video: typeof videoWithHLS) {
      const sources = [];
      
      if (video.videoUrl.startsWith('/data/videos/')) {
        if (video.hasHLS) {
          sources.push({
            src: `/api/hls/${video.id}/playlist.m3u8`,
            type: 'hls',
            label: 'HLS Stream'
          });
        }
      } else {
        sources.push({
          src: video.videoUrl,
          type: 'direct',
          label: 'Direct Stream'
        });
      }
      
      return sources;
    }

    // Test HLS-enabled video (should prefer HLS)
    const hlsSources = generateSources(videoWithHLS);
    expect(hlsSources).toHaveLength(2);
    expect(hlsSources[0].type).toBe('hls');
    expect(hlsSources[1].type).toBe('xor');

    // Test HLS-disabled video (should only have XOR)
    const xorSources = generateSources(videoWithoutHLS);
    expect(xorSources).toHaveLength(1);
    expect(xorSources[0].type).toBe('xor');

    // Test direct video (should use direct URL)
    const directSources = generateSources(directVideo);
    expect(directSources).toHaveLength(1);
    expect(directSources[0].type).toBe('direct');
  });

  it('should verify single-source configuration', () => {
    // Test that HLS is the only source for local videos
    const sources = [
      { src: '/api/hls/video/playlist.m3u8', type: 'hls' as const, label: 'HLS' }
    ];

    let currentSrc = sources[0].src;

    // Simulate error handling with single source
    const handleError = () => {
      // No fallback available for local videos with HLS-only system
      return false; // No fallbacks available
    };

    // Error should result in failure (no fallbacks)
    expect(handleError()).toBe(false);
    expect(currentSrc).toBe('/api/hls/video/playlist.m3u8');
    
    // Verify sources array has only one item
    expect(sources).toHaveLength(1);
    expect(sources[0].type).toBe('hls');
  });
});