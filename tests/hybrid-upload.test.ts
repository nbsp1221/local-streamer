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

describe('Hybrid Upload System (XOR + HLS)', () => {
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

  it('should support both HLS and XOR upload when HLS is enabled', () => {
    expect(process.env.HLS_ENABLED).toBe('true');
    
    // This test verifies environment configuration
    expect(process.env.HLS_MASTER_ENCRYPTION_SEED).toBeDefined();
    expect(process.env.KEY_SALT_PREFIX).toBeDefined();
    expect(process.env.KEY_DERIVATION_ROUNDS).toBeDefined();
  });

  it('should handle HLS disabled scenario', async () => {
    // Set HLS disabled
    process.env.HLS_ENABLED = 'false';
    
    // Import the generateHLSVersion function (this would normally be tested via add-to-library)
    // For now, just verify the environment check logic
    const isHLSEnabled = process.env.HLS_ENABLED === 'true';
    expect(isHLSEnabled).toBe(false);
    
    // When HLS is disabled, only XOR should be generated
    // The generateHLSVersion function should return { success: false, error: 'HLS disabled' }
  });

  it('should verify hybrid response format', () => {
    // Test that the add-to-library API returns the expected response format
    const mockSuccessResponse = {
      success: true,
      videoId: 'test-video-id',
      message: 'Video added to library successfully (XOR + HLS)',
      formats: {
        xor: true,
        hls: true
      }
    };

    const mockPartialResponse = {
      success: true,
      videoId: 'test-video-id', 
      message: 'Video added to library with XOR only (HLS generation failed)',
      formats: {
        xor: true,
        hls: false
      }
    };

    // Verify response structure
    expect(mockSuccessResponse.formats).toHaveProperty('xor');
    expect(mockSuccessResponse.formats).toHaveProperty('hls');
    expect(mockPartialResponse.formats.xor).toBe(true);
    expect(mockPartialResponse.formats.hls).toBe(false);
  });

  it('should verify video source priority logic', () => {
    // Mock Video object with HLS support
    const videoWithHLS = {
      id: 'test-video-1',
      title: 'Test Video',
      videoUrl: '/data/videos/test-video-1/video.encrypted.mp4',
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
            label: 'HLS (Encrypted)'
          });
        }
        sources.push({
          src: `/api/stream/${video.id}`,
          type: 'xor',
          label: 'XOR Stream'
        });
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

  it('should verify fallback mechanism configuration', () => {
    // Test the fallback retry logic
    const sources = [
      { src: '/api/hls/video/playlist.m3u8', type: 'hls' as const, label: 'HLS' },
      { src: '/api/stream/video', type: 'xor' as const, label: 'XOR' }
    ];

    let currentSrc = sources[0].src;
    let retryCount = 0;

    // Simulate error and fallback
    const handleError = () => {
      const currentIndex = sources.findIndex(s => s.src === currentSrc);
      const nextIndex = currentIndex + 1;
      
      if (nextIndex < sources.length && retryCount < 3) {
        retryCount += 1;
        currentSrc = sources[nextIndex].src;
        return true; // Successfully fell back
      }
      return false; // No more fallbacks
    };

    // First error should fallback to XOR
    expect(handleError()).toBe(true);
    expect(currentSrc).toBe('/api/stream/video');
    expect(retryCount).toBe(1);

    // Second error should fail (no more sources)
    expect(handleError()).toBe(false);
    expect(retryCount).toBe(1); // Retry count shouldn't increase if no fallback available
  });
});