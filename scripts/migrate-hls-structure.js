#!/usr/bin/env node

/**
 * Migration script to convert HLS folder structure
 * 
 * Changes:
 * - Move files from {UUID}/hls/ to {UUID}/
 * - Rename segments from segment_000.ts to segment-0000.ts
 * - Update playlist.m3u8 to reference new segment names
 * - Remove original MP4 files to save storage
 * 
 * Usage: node scripts/migrate-hls-structure.js [--dry-run] [--keep-originals]
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const VIDEOS_DIR = join(PROJECT_ROOT, 'data', 'videos');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const keepOriginals = args.includes('--keep-originals');

console.log('🔄 HLS Structure Migration Script');
console.log('==================================');
if (isDryRun) {
  console.log('🟡 DRY RUN MODE - No changes will be made');
}
if (keepOriginals) {
  console.log('📁 KEEP ORIGINALS - Original MP4 files will not be deleted');
}
console.log('');

async function migrateVideo(videoId) {
  const videoDir = join(VIDEOS_DIR, videoId);
  const hlsDir = join(videoDir, 'hls');
  
  console.log(`📹 Processing video: ${videoId}`);
  
  // Check if old structure exists
  if (!existsSync(hlsDir)) {
    console.log(`  ⏭️  No HLS directory found, skipping`);
    return { status: 'skipped', reason: 'no_hls_dir' };
  }
  
  try {
    // Read HLS directory contents
    const hlsFiles = await fs.readdir(hlsDir);
    console.log(`  📂 Found ${hlsFiles.length} files in HLS directory`);
    
    const movePromises = [];
    let playlistContent = null;
    let segmentsMoved = 0;
    
    for (const file of hlsFiles) {
      const oldPath = join(hlsDir, file);
      let newPath, newFilename;
      
      if (file === 'playlist.m3u8') {
        // Move playlist to video root
        newPath = join(videoDir, file);
        newFilename = file;
        
        // Read playlist content for segment renaming
        playlistContent = await fs.readFile(oldPath, 'utf-8');
        
      } else if (file === 'key.bin') {
        // Move key to video root
        newPath = join(videoDir, file);
        newFilename = file;
        
      } else if (file.match(/^segment_(\d{3})\.ts$/)) {
        // Rename and move segments: segment_000.ts -> segment-0000.ts
        const match = file.match(/^segment_(\d{3})\.ts$/);
        const segmentNumber = match[1].padStart(4, '0'); // Convert 000 to 0000
        newFilename = `segment-${segmentNumber}.ts`;
        newPath = join(videoDir, newFilename);
        segmentsMoved++;
        
      } else if (file === 'keyinfo.txt') {
        // Skip temporary file (should be deleted anyway)
        console.log(`  🗑️  Skipping temporary file: ${file}`);
        continue;
        
      } else {
        console.log(`  ⚠️  Unknown file in HLS directory: ${file}`);
        continue;
      }
      
      console.log(`  🔄 ${file} -> ${newFilename}`);
      
      if (!isDryRun) {
        // Check if destination exists
        if (existsSync(newPath)) {
          console.log(`    ⚠️  Destination exists, skipping: ${newPath}`);
          continue;
        }
        
        movePromises.push(fs.rename(oldPath, newPath));
      }
    }
    
    // Execute all move operations
    if (!isDryRun && movePromises.length > 0) {
      await Promise.all(movePromises);
      console.log(`  ✅ Moved ${movePromises.length} files`);
    }
    
    // Update playlist content to reference new segment names
    if (playlistContent && segmentsMoved > 0) {
      console.log(`  📝 Updating playlist to reference new segment names`);
      
      // Replace segment_XXX.ts with segment-XXXX.ts
      const updatedPlaylist = playlistContent.replace(
        /segment_(\d{3})\.ts/g, 
        (match, segmentNum) => `segment-${segmentNum.padStart(4, '0')}.ts`
      );
      
      if (!isDryRun) {
        const playlistPath = join(videoDir, 'playlist.m3u8');
        await fs.writeFile(playlistPath, updatedPlaylist, 'utf-8');
        console.log(`  ✅ Updated playlist content`);
      }
    }
    
    // Remove old HLS directory if empty
    if (!isDryRun) {
      try {
        const remainingFiles = await fs.readdir(hlsDir);
        if (remainingFiles.length === 0) {
          await fs.rmdir(hlsDir);
          console.log(`  🗑️  Removed empty HLS directory`);
        } else {
          console.log(`  ⚠️  HLS directory not empty, keeping: ${remainingFiles.join(', ')}`);
        }
      } catch (error) {
        console.log(`  ⚠️  Could not remove HLS directory: ${error.message}`);
      }
    }
    
    // Remove original MP4 file to save storage (if not keeping originals)
    if (!keepOriginals) {
      const mp4Files = ['video.mp4', 'video.avi', 'video.mkv', 'video.mov', 'video.webm'];
      for (const mp4File of mp4Files) {
        const mp4Path = join(videoDir, mp4File);
        if (existsSync(mp4Path)) {
          console.log(`  🗑️  Removing original file: ${mp4File}`);
          if (!isDryRun) {
            await fs.unlink(mp4Path);
            console.log(`  ✅ Deleted original file to save storage`);
          }
          break;
        }
      }
    }
    
    console.log(`  ✅ Migration completed for ${videoId}`);
    return { status: 'success', segmentsMoved };
    
  } catch (error) {
    console.error(`  ❌ Migration failed for ${videoId}: ${error.message}`);
    return { status: 'error', error: error.message };
  }
}

async function main() {
  try {
    // Check if videos directory exists
    if (!existsSync(VIDEOS_DIR)) {
      console.error(`❌ Videos directory not found: ${VIDEOS_DIR}`);
      process.exit(1);
    }
    
    // Get list of video directories
    const videoIds = await fs.readdir(VIDEOS_DIR);
    const validVideoIds = [];
    
    for (const videoId of videoIds) {
      const videoDir = join(VIDEOS_DIR, videoId);
      const stat = await fs.stat(videoDir);
      if (stat.isDirectory()) {
        validVideoIds.push(videoId);
      }
    }
    
    console.log(`📊 Found ${validVideoIds.length} video directories to process`);
    console.log('');
    
    // Process each video
    const results = {
      success: 0,
      skipped: 0,
      error: 0
    };
    
    for (const videoId of validVideoIds) {
      const result = await migrateVideo(videoId);
      results[result.status]++;
      console.log('');
    }
    
    // Print summary
    console.log('📊 Migration Summary');
    console.log('===================');
    console.log(`✅ Successful migrations: ${results.success}`);
    console.log(`⏭️  Skipped (no changes needed): ${results.skipped}`);
    console.log(`❌ Failed migrations: ${results.error}`);
    
    if (isDryRun) {
      console.log('');
      console.log('🟡 This was a dry run - no actual changes were made');
      console.log('   Run without --dry-run to execute the migration');
    }
    
    if (results.error > 0) {
      console.log('');
      console.log('⚠️  Some migrations failed. Please review the errors above.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  }
}

// Run the migration
main().catch(console.error);