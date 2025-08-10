# HLS Migration Plan: From XOR to Industry Standard Streaming

**Version**: 1.0  
**Created**: 2025-01-10  
**Target**: Migration from custom XOR encryption to HLS with AES-128  
**Estimated Timeline**: 6 weeks

---

## 📋 Executive Summary

### Decision Context

After comprehensive analysis of streaming protocols and security implementations, we have decided to migrate from our custom XOR encryption system to **HTTP Live Streaming (HLS) with AES-128 encryption**. This decision prioritizes long-term maintainability, security standards compliance, and ecosystem compatibility over short-term performance optimization.

### Key Decision Factors

**Why HLS over Direct AES Implementation:**
- ✅ **Battle-tested reliability**: Used by 70+ major streaming platforms
- ✅ **Ecosystem support**: @vidstack/react has native HLS support with automatic hls.js integration
- ✅ **No custom crypto code**: Eliminates security vulnerabilities from custom implementation
- ✅ **Standard compliance**: Industry standard AES-128 encryption
- ✅ **Future-proofing**: Built-in support for adaptive bitrate, subtitles, multiple audio tracks
- ✅ **Reduced maintenance burden**: Community-driven bug fixes and optimizations

**Trade-offs Accepted:**
- ⚠️ **Initial latency**: 6-10 seconds vs <100ms with XOR (acceptable for personal VOD server)
- ⚠️ **Storage overhead**: ~10% increase vs current system
- ⚠️ **Processing requirement**: FFmpeg transcoding during upload

---

## 🔬 Technical Research Findings

### HLS Protocol Analysis

**HTTP Live Streaming (HLS)** segments video into small chunks (.ts files) served over HTTP with M3U8 playlists containing metadata and encryption information.

#### Encryption Mechanism
- **Algorithm**: AES-128 CBC mode (industry standard)
- **Key Management**: Per-video unique keys delivered via authenticated HTTPS endpoints
- **Segment Encryption**: Each .ts segment encrypted independently
- **Browser Support**: Universal compatibility via hls.js for non-Safari browsers

#### M3U8 Playlist Structure
```m3u8
#EXT-X-KEY:METHOD=AES-128,URI="/api/hls-key/video-uuid",IV=0x12345678...
#EXTINF:10.0,
segment_000.ts
#EXTINF:10.0,
segment_001.ts
```

### @vidstack/react HLS Support Confirmation

**Native HLS Support**: ✅ Confirmed built-in support without additional libraries
- **Automatic hls.js integration**: Loads hls.js from JSDelivr automatically
- **Browser compatibility**: Handles MSE/MMS support detection transparently
- **Safari fallback**: Uses native HLS support on Apple devices
- **No configuration required**: Simply change src URL to .m3u8 playlist

```typescript
// Current implementation
<MediaPlayer src={`/api/stream/${videoId}`} />

// HLS implementation (no other changes needed)
<MediaPlayer src={`/api/hls/${videoId}/playlist.m3u8`} />
```

### Performance Analysis

| Metric | Current XOR | HLS | Direct AES |
|--------|-------------|-----|------------|
| **Initial Latency** | <100ms | 6-10s | <500ms |
| **Security Level** | Low (obfuscation) | High (AES-128) | High (AES-128/256) |
| **Implementation Complexity** | Low | Medium | High |
| **Maintenance Burden** | High (custom) | Low (standard) | High (custom) |
| **Ecosystem Support** | None | Excellent | Limited |
| **Future Extensibility** | Limited | Excellent | Limited |

### Commercial Streaming Service Insights

**Why Netflix/YouTube/Twitch appear fast despite HLS latency:**
- **Low-Latency HLS (LL-HLS)**: 2-3 second segments with chunked encoding
- **Predictive caching**: AI-driven content pre-positioning
- **Global CDN**: Thousands of edge servers worldwide
- **Protocol mixing**: DASH for VOD, LL-HLS for live, WebRTC for real-time features
- **Massive infrastructure**: Multi-million dollar optimization investments

**Personal Server Reality Check:**
- Standard HLS 6-10 second latency is acceptable for personal VOD
- LL-HLS requires significant infrastructure investment
- Our use case doesn't require real-time interaction

---

## 🏗️ Architecture Design

### Current XOR System Analysis

```
[Original MP4] → [XOR Encryption] → [Encrypted File] → [Real-time XOR Decryption] → [Browser]
                                                      ↑
                                            Range Request Support
```

**Current Implementation:**
- `app/utils/xor-encryption.server.ts`: XOR crypto logic
- `app/services/file-encryption.server.ts`: File encryption service
- `app/routes/api/stream.$id.ts`: Real-time decryption with Range Request support
- Fixed 39-byte key cycling for encryption

### Proposed HLS Architecture

```
[Original MP4] → [FFmpeg HLS Conversion] → [Encrypted TS Segments + M3U8] → [Browser via @vidstack/react]
                         ↓
                 [AES-128 Key Generation]
                         ↓
                 [Authenticated Key Delivery]
```

#### File Structure
```
data/videos/{uuid}/
├── hls/
│   ├── playlist.m3u8           # Master playlist
│   ├── key.bin                 # AES-128 encryption key
│   ├── segment_000.ts          # Encrypted video segments
│   ├── segment_001.ts
│   └── ...
├── thumbnail.jpg
└── original.mp4               # Retained for 7 days, then deleted
```

#### Security Model
- **Unique Keys**: Each video gets a randomly generated AES-128 key
- **Authenticated Delivery**: Key endpoint requires user authentication
- **HTTPS Only**: All key requests must be over secure connections
- **No Client Caching**: Keys served with no-cache headers
- **Automatic Rotation**: Future enhancement for periodic key rotation

---

## 📅 Implementation Plan

### Phase 1: Foundation Setup (Week 1-2)
**Goal**: Build HLS infrastructure alongside existing XOR system

#### New Services Implementation

**`app/services/hls-converter.server.ts`**
```typescript
export async function convertToHLS(videoId: string, inputPath: string): Promise<void> {
  const hlsDir = path.join(config.paths.videos, videoId, 'hls');
  const keyFile = path.join(hlsDir, 'key.bin');
  const keyInfoFile = path.join(hlsDir, 'keyinfo.txt');
  
  // Generate AES-128 key
  const encryptionKey = crypto.randomBytes(16);
  await fs.writeFile(keyFile, encryptionKey);
  
  // Create key info file for FFmpeg
  const keyInfo = `/api/hls-key/${videoId}\n${keyFile}\n`;
  await fs.writeFile(keyInfoFile, keyInfo);
  
  // FFmpeg HLS conversion with encryption
  const ffmpegArgs = [
    '-i', inputPath,
    '-hls_time', '10',                    // 10-second segments
    '-hls_key_info_file', keyInfoFile,    // AES encryption info
    '-hls_playlist_type', 'vod',          // Video on demand
    '-c:v', 'libx264',                    // H.264 video codec
    '-c:a', 'aac',                        // AAC audio codec
    path.join(hlsDir, 'playlist.m3u8')
  ];
  
  await executeFFmpeg(ffmpegArgs);
}
```

**`app/services/aes-key-manager.server.ts`**
```typescript
export class AESKeyManager {
  async generateKey(videoId: string): Promise<Buffer> {
    const key = crypto.randomBytes(16); // AES-128 key
    const keyPath = path.join(config.paths.videos, videoId, 'hls', 'key.bin');
    await fs.writeFile(keyPath, key);
    return key;
  }
  
  async getKey(videoId: string): Promise<Buffer> {
    const keyPath = path.join(config.paths.videos, videoId, 'hls', 'key.bin');
    return await fs.readFile(keyPath);
  }
}
```

#### New Routes Implementation

**`app/routes/api/hls.$videoId.playlist.ts`**
```typescript
export async function loader({ request, params }: LoaderArgs) {
  await requireAuth(request);
  
  const playlistPath = path.join(config.paths.videos, params.videoId, 'hls', 'playlist.m3u8');
  const playlist = await fs.readFile(playlistPath, 'utf-8');
  
  return new Response(playlist, {
    headers: {
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Cache-Control': 'no-cache'
    }
  });
}
```

**`app/routes/api/hls-key.$videoId.ts`**
```typescript
export async function loader({ request, params }: LoaderArgs) {
  await requireAuth(request); // Authentication required!
  
  const keyManager = new AESKeyManager();
  const key = await keyManager.getKey(params.videoId);
  
  return new Response(key, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}
```

### Phase 2: Hybrid System (Week 3)
**Goal**: Support both XOR and HLS simultaneously for new uploads

#### Enhanced Video Processing
**Update `app/routes/api/add-to-library.ts`**
```typescript
export async function action({ request }: Route.ActionArgs) {
  // ... existing validation ...
  
  const videoId = await moveToLibrary(filename);
  
  // Generate both XOR (existing) and HLS (new) versions
  await Promise.all([
    generateXORVersion(videoId, sourcePath),  // Existing logic
    convertToHLS(videoId, sourcePath)         // New HLS conversion
  ]);
  
  // ... rest of existing logic ...
}
```

#### Smart Video Player
**Update `app/components/VideoPlayer.tsx`**
```typescript
export function VideoPlayer({ video }: VideoPlayerProps) {
  const getVideoSrc = (): string => {
    // Check if HLS version exists
    const hlsExists = video.hasHLS || checkHLSAvailability(video.id);
    
    if (hlsExists) {
      return `/api/hls/${video.id}/playlist.m3u8`;
    }
    
    // Fallback to existing XOR streaming
    return video.videoUrl.startsWith('/data/videos/') 
      ? `/api/stream/${video.id}`
      : video.videoUrl;
  };
  
  // ... rest remains unchanged
}
```

### Phase 3: Background Migration (Week 4-5)
**Goal**: Convert existing XOR-encrypted videos to HLS

#### Migration Service
**`app/services/migration.server.ts`**
```typescript
export class XORToHLSMigrator {
  async migrateAllVideos(): Promise<void> {
    const videos = await getAllVideos();
    
    for (const video of videos) {
      if (!video.hasHLS) {
        try {
          await this.migrateVideo(video.id);
          await this.updateVideoMetadata(video.id, { hasHLS: true });
          console.log(`✅ Migrated video: ${video.title} (${video.id})`);
        } catch (error) {
          console.error(`❌ Failed to migrate ${video.id}:`, error);
        }
      }
    }
  }
  
  private async migrateVideo(videoId: string): Promise<void> {
    // 1. Decrypt XOR file to temporary location
    const tempFile = await this.decryptXORToTemp(videoId);
    
    // 2. Convert to HLS
    await convertToHLS(videoId, tempFile);
    
    // 3. Verify HLS integrity
    await this.verifyHLSConversion(videoId);
    
    // 4. Schedule original cleanup (7 days)
    await this.scheduleCleanup(videoId, tempFile);
  }
}
```

### Phase 4: MP4 Download Feature (Week 5)
**Goal**: Implement MP4 download with real-time reconstruction

**`app/routes/api/download.$videoId.ts`**
```typescript
export async function loader({ request, params }: LoaderArgs) {
  await requireAuth(request);
  
  const { videoId } = params;
  const video = await findVideoById(videoId);
  
  // Priority 1: Serve original if available (during migration period)
  const originalPath = path.join(config.paths.videos, videoId, 'original.mp4');
  if (existsSync(originalPath)) {
    return streamFile(originalPath, `${video.title}.mp4`);
  }
  
  // Priority 2: Reconstruct from HLS segments
  const playlistPath = path.join(config.paths.videos, videoId, 'hls', 'playlist.m3u8');
  if (existsSync(playlistPath)) {
    return streamReconstructedMP4(playlistPath, `${video.title}.mp4`);
  }
  
  throw new Response('Video not available for download', { status: 404 });
}

async function streamReconstructedMP4(playlistPath: string, filename: string) {
  // FFmpeg reconstruction: HLS → MP4 streaming
  const ffmpegArgs = [
    '-i', playlistPath,
    '-c', 'copy',                               // No re-encoding (fast!)
    '-movflags', 'frag_keyframe+empty_moov',    // Streaming optimization
    '-f', 'mp4',
    'pipe:1'                                    // Stream to stdout
  ];
  
  const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
  
  return new Response(ffmpegProcess.stdout as any, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Transfer-Encoding': 'chunked'
    }
  });
}
```

### Phase 5: Storage Optimization (Week 6)
**Goal**: Implement automated cleanup and storage monitoring

#### Cleanup Automation
**`app/services/cleanup.server.ts`**
```typescript
export class StorageCleanup {
  async scheduleOriginalCleanup(videoId: string): Promise<void> {
    // Schedule cleanup after 7 days
    setTimeout(async () => {
      try {
        // Verify HLS integrity first
        const hlsValid = await this.verifyHLSIntegrity(videoId);
        if (hlsValid) {
          await this.cleanupOriginalFiles(videoId);
          console.log(`🧹 Cleaned up original files for ${videoId}`);
        }
      } catch (error) {
        console.error(`Failed to cleanup ${videoId}:`, error);
      }
    }, 7 * 24 * 60 * 60 * 1000); // 7 days
  }
  
  private async cleanupOriginalFiles(videoId: string): Promise<void> {
    const filesToRemove = [
      path.join(config.paths.videos, videoId, 'original.mp4'),
      path.join(config.paths.videos, videoId, 'video.encrypted.mp4') // XOR file
    ];
    
    for (const file of filesToRemove) {
      if (existsSync(file)) {
        await fs.unlink(file);
      }
    }
  }
}
```

### Phase 6: XOR System Removal (Week 6)
**Goal**: Remove all XOR-related code and complete migration

#### Code Removal Checklist
- ❌ Delete `app/utils/xor-encryption.server.ts`
- ❌ Delete `app/services/file-encryption.server.ts`
- ❌ Remove XOR logic from `app/routes/api/stream.$id.ts`
- ❌ Remove XOR settings from `app/configs/security.ts`
- ❌ Update `app/components/VideoPlayer.tsx` to only use HLS
- ❌ Remove XOR-related tests

---

## 🔧 Key Features Implementation

### MP4 Download Functionality

**Technical Approach**: Real-time MP4 reconstruction from HLS segments using FFmpeg

#### How It Works
1. **User clicks download**: Request sent to `/api/download/{videoId}`
2. **Server checks availability**: Original file → HLS segments → Error
3. **FFmpeg reconstruction**: `ffmpeg -i playlist.m3u8 -c copy output.mp4`
4. **Streaming download**: User sees progress immediately via chunked transfer

#### Performance Characteristics
```
Conversion Speed: 10-30 seconds for typical video (no re-encoding)
Memory Usage: ~64MB (FFmpeg buffer)
Quality: Lossless (container change only)
User Experience: Immediate download start with progress
```

#### Implementation Benefits
- ✅ **No additional storage**: MP4 reconstructed on-demand
- ✅ **Lossless quality**: Same as original video
- ✅ **Fast conversion**: No re-encoding, just container change
- ✅ **Streaming experience**: User doesn't wait for full conversion

### Storage Optimization Strategy

#### Three-Phase Storage Approach
1. **Upload Phase**: Original MP4 + HLS generation (2x storage temporarily)
2. **Verification Phase**: 7-day retention of original for safety
3. **Optimized Phase**: HLS only (~1.1x original size)

#### Storage Calculations
```
Example 1GB video:
- Original MP4: 1.0 GB
- HLS segments: 1.1 GB (10% overhead for segmentation)
- Peak storage (migration): 2.1 GB
- Final storage: 1.1 GB
- Net increase: +10% vs current XOR system
```

#### Cleanup Automation
- **Automatic verification**: HLS integrity check before cleanup
- **Gradual rollout**: Cleanup older videos first
- **Safety measures**: Manual override capability
- **Monitoring**: Storage usage alerts and reporting

---

## 🛠️ Technical Specifications

### New Database Schema
```sql
-- Add HLS tracking to existing videos table
ALTER TABLE videos ADD COLUMN has_hls BOOLEAN DEFAULT FALSE;
ALTER TABLE videos ADD COLUMN hls_generated_at TIMESTAMP;
ALTER TABLE videos ADD COLUMN original_cleanup_at TIMESTAMP;
```

### Configuration Updates
```typescript
// app/configs/security.ts - Remove XOR, add HLS
export const security = {
  hls: {
    segmentDuration: 10,           // 10-second segments
    keyRotationInterval: 30,       // Days (future enhancement)
    allowedOrigins: ['localhost'], // CORS for key delivery
  },
  // Remove: xorKey, encryptedExtension, etc.
};
```

### FFmpeg Commands Reference

#### HLS Conversion with AES-128
```bash
ffmpeg -i input.mp4 \
  -hls_time 10 \
  -hls_key_info_file keyinfo.txt \
  -hls_playlist_type vod \
  -c:v libx264 \
  -c:a aac \
  playlist.m3u8
```

#### MP4 Reconstruction
```bash
ffmpeg -i playlist.m3u8 \
  -c copy \
  -movflags frag_keyframe+empty_moov \
  -f mp4 \
  output.mp4
```

### API Endpoints Summary

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/hls/{id}/playlist.m3u8` | GET | HLS playlist delivery | Required |
| `/api/hls/{id}/segment/{seg}.ts` | GET | HLS segment delivery | Required |
| `/api/hls-key/{id}` | GET | AES key delivery | Required |
| `/api/download/{id}` | GET | MP4 download | Required |

---

## ⚠️ Risk Management & Mitigation

### Identified Risks

#### 1. Storage Space Exhaustion
**Risk**: Temporary 2x storage during migration
**Mitigation**: 
- Implement storage monitoring with alerts
- Migrate in batches (e.g., 10 videos per day)
- Automated cleanup verification before proceeding
- Manual override capability

#### 2. FFmpeg Process Failures
**Risk**: Conversion or reconstruction failures
**Mitigation**:
- Comprehensive error handling and logging
- Retry mechanisms with exponential backoff
- Process timeout protection (max 30 minutes)
- Fallback to error reporting for manual intervention

#### 3. Performance Degradation
**Risk**: Server overload during conversion
**Mitigation**:
- Queue-based processing system
- CPU usage monitoring and throttling
- Off-peak scheduling for batch migrations
- Resource limit enforcement per process

#### 4. HLS Streaming Issues
**Risk**: Playback problems in various browsers
**Mitigation**:
- Comprehensive browser testing matrix
- @vidstack/react handles compatibility automatically
- Fallback to XOR system during transition
- User agent detection and appropriate error messages

### Rollback Procedures

#### Phase-by-Phase Rollback
1. **Phase 1-2**: Simply don't use new HLS endpoints
2. **Phase 3**: Stop migration service, continue with XOR
3. **Phase 4-5**: Restore original files from backup if needed
4. **Phase 6**: Revert code changes via git

#### Emergency Rollback
```bash
# Stop all migration processes
sudo systemctl stop local-streamer-migration

# Revert to previous git commit
git revert HEAD~5 --no-edit

# Restart application with XOR system
bun start
```

### Success Criteria

#### Functional Requirements
- ✅ All videos accessible via HLS streaming
- ✅ @vidstack/react player works across all supported browsers
- ✅ MP4 download functionality operational
- ✅ Authentication and security model functioning
- ✅ Performance meets or exceeds current system

#### Non-Functional Requirements
- ✅ Storage usage increase <20% of current system
- ✅ Migration completes without user-facing downtime
- ✅ System reliability maintained throughout transition
- ✅ All existing features continue working

#### Quality Metrics
- ✅ Video quality identical to original
- ✅ Streaming latency acceptable for use case (6-10s)
- ✅ Download speed comparable to direct file serving
- ✅ Zero data loss during migration

---

## 📊 Appendices

### Appendix A: Performance Benchmarks

#### Streaming Latency Measurements
```
Current XOR System:
- Initial playback: <100ms
- Seek operations: <200ms
- Memory usage: 64KB per connection

Proposed HLS System:
- Initial playback: 6-10 seconds
- Seek operations: 2-4 seconds (segment boundaries)
- Memory usage: 10-20MB per connection (acceptable trade-off)
```

#### Storage Efficiency Analysis
```
1000 videos, average 2GB each:

Current XOR:
- Total storage: 2TB
- Encryption overhead: 0%

Proposed HLS:
- Total storage: 2.2TB
- Segmentation overhead: 10%
- Net increase: 200GB (acceptable)
```

### Appendix B: Code Examples

#### Complete HLS Conversion Service
```typescript
// app/services/hls-converter.server.ts
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import crypto from 'crypto';
import ffmpegStatic from 'ffmpeg-static';

export class HLSConverter {
  async convertVideo(videoId: string, inputPath: string): Promise<void> {
    const hlsDir = join(config.paths.videos, videoId, 'hls');
    await fs.mkdir(hlsDir, { recursive: true });
    
    // Generate AES-128 key
    const key = crypto.randomBytes(16);
    const keyFile = join(hlsDir, 'key.bin');
    await fs.writeFile(keyFile, key);
    
    // Create key info file
    const keyInfo = `/api/hls-key/${videoId}\n${keyFile}\n`;
    const keyInfoFile = join(hlsDir, 'keyinfo.txt');
    await fs.writeFile(keyInfoFile, keyInfo);
    
    // FFmpeg conversion
    return new Promise((resolve, reject) => {
      const args = [
        '-i', inputPath,
        '-hls_time', '10',
        '-hls_key_info_file', keyInfoFile,
        '-hls_playlist_type', 'vod',
        '-hls_flags', 'delete_segments',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        join(hlsDir, 'playlist.m3u8')
      ];
      
      const ffmpeg = spawn(ffmpegStatic!, args);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(undefined);
        } else {
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });
      
      ffmpeg.on('error', reject);
    });
  }
}
```

### Appendix C: Testing Strategy

#### Unit Tests Coverage
```typescript
// Test categories to implement:
describe('HLS Conversion', () => {
  test('converts MP4 to HLS with encryption');
  test('generates valid M3U8 playlist');
  test('creates proper segment files');
  test('handles conversion errors gracefully');
});

describe('Key Management', () => {
  test('generates unique keys per video');
  test('securely delivers keys with authentication');
  test('handles key access errors');
});

describe('MP4 Reconstruction', () => {
  test('reconstructs MP4 from HLS segments');
  test('maintains video quality during reconstruction');
  test('handles streaming download properly');
});
```

#### Integration Tests
```typescript
describe('End-to-End HLS Streaming', () => {
  test('complete upload to HLS conversion flow');
  test('browser compatibility across major browsers');
  test('@vidstack/react player integration');
  test('authentication and security model');
});
```

#### Performance Tests
```typescript
describe('Performance Benchmarks', () => {
  test('conversion time within acceptable limits');
  test('concurrent streaming performance');
  test('memory usage during operations');
  test('storage efficiency measurements');
});
```

---

## 🎯 Conclusion

This migration plan represents a strategic shift from a custom, minimally-secure solution to an industry-standard, future-proof streaming architecture. While we sacrifice some performance (6-10 second initial latency vs <100ms), we gain significantly in security, maintainability, and ecosystem compatibility.

The phased approach ensures zero-downtime migration while providing safety nets and rollback capabilities. The investment in HLS infrastructure positions the project for future enhancements like adaptive bitrate streaming, multiple audio tracks, and subtitle support.

**Next Steps:**
1. Review and approve this migration plan
2. Begin Phase 1 implementation with foundation setup
3. Establish monitoring and testing frameworks
4. Execute migration according to timeline

**Success Metrics:**
- ✅ Improved security with AES-128 encryption
- ✅ Reduced maintenance burden through standard adoption
- ✅ Enhanced compatibility across devices and browsers
- ✅ Foundation for future streaming features

This migration transforms Local Streamer from a custom solution into a modern, standards-compliant streaming platform while maintaining all existing functionality and adding the requested MP4 download capability.

---

*Migration Plan v1.0 - Ready for Implementation*