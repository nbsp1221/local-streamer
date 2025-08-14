import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { config, ffmpeg } from '~/configs';
import { AESKeyManager } from './aes-key-manager.server';
import type { EncodingOptions } from '~/modules/video/add-video/add-video.types';
import { 
  DEFAULT_ENCODING_OPTIONS,
  getCodecName,
  getQualityParam,
  getQualityValue,
  getPresetValue,
  getAdditionalFlags,
  validateEncodingOptionsStrict
} from '~/utils/encoding';

interface VideoAnalysis {
  duration: number; // in seconds
  bitrate: number; // in kbps
  audioBitrate: number; // in kbps
  audioCodec: string;
  videoCodec: string;
  fileSize: number; // in bytes
}

export class HLSConverter {
  private keyManager: AESKeyManager;

  constructor() {
    this.keyManager = new AESKeyManager();
  }

  /**
   * Convert MP4 to HLS with AES-128 encryption
   * New structure: stores HLS files directly in video UUID folder
   */
  async convertVideo(videoId: string, inputPath: string, encodingOptions?: EncodingOptions): Promise<void> {
    console.log(`🎬 Starting HLS conversion for video: ${videoId}`);
    
    const videoDir = join(config.paths.videos, videoId);
    await fs.mkdir(videoDir, { recursive: true });
    
    try {
      // 1. Analyze input video to determine optimal encoding settings
      console.log(`📊 Analyzing video: ${inputPath}`);
      const videoAnalysis = await this.analyzeVideo(inputPath);
      console.log(`📊 Analysis: ${videoAnalysis.duration}s, ${videoAnalysis.bitrate}kbps, ${videoAnalysis.fileSize} bytes`);
      
      // 2. Generate AES-128 key and keyinfo file
      const { keyInfoFile } = await this.keyManager.generateAndStoreVideoKey(videoId);
      
      // 3. Execute FFmpeg HLS conversion with size constraints
      const playlistPath = join(videoDir, 'playlist.m3u8');
      const options = encodingOptions || DEFAULT_ENCODING_OPTIONS;
      await this.executeFFmpegConversion(inputPath, keyInfoFile, playlistPath, videoId, options, videoAnalysis);
      
      // 3. Cleanup temporary files
      await this.keyManager.cleanupTempFiles(videoId);
      
      // 4. Remove original file to save storage
      await this.removeOriginalFile(inputPath);
      
      console.log(`✅ HLS conversion completed for video: ${videoId}`);
    } catch (error) {
      console.error(`❌ HLS conversion failed for video: ${videoId}`, error);
      await this.cleanup(videoId);
      throw error;
    }
  }

  private async executeFFmpegConversion(
    inputPath: string, 
    keyInfoFile: string, 
    playlistPath: string,
    videoId: string,
    encodingOptions: EncodingOptions,
    videoAnalysis: VideoAnalysis
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Validate encoding options first
        validateEncodingOptionsStrict(encodingOptions);

        // Validate and sanitize segment duration
        const rawSegmentDuration = process.env.HLS_SEGMENT_DURATION || '10';
        const segmentDuration = this.validateSegmentDuration(rawSegmentDuration);

        const segmentPath = join(config.paths.videos, videoId, 'segment-%04d.ts');

        // Get validated encoding parameters
        const codec = this.validateCodec(getCodecName(encodingOptions.encoder));
        const preset = this.validatePreset(getPresetValue(encodingOptions.encoder), encodingOptions.encoder);
        const qualityParam = this.validateQualityParam(getQualityParam(encodingOptions.encoder));
        const qualityValue = this.validateQualityValue(getQualityValue(encodingOptions.encoder));
        const additionalFlags = this.validateAdditionalFlags(getAdditionalFlags(encodingOptions.encoder));
        
        // Calculate target bitrate to prevent size inflation
        const { targetVideoBitrate, audioSettings } = this.calculateOptimalBitrates(videoAnalysis, encodingOptions.encoder);
        console.log(`🎯 Target video bitrate: ${targetVideoBitrate}k, Audio: ${audioSettings.codec} ${audioSettings.bitrate}`);

        // Build FFmpeg command with size constraints
        const ffmpegArgs = [
          '-i', inputPath,
          '-hls_time', segmentDuration,
          '-hls_key_info_file', keyInfoFile,
          '-hls_playlist_type', 'vod',
          '-hls_flags', 'delete_segments+independent_segments',
          '-hls_segment_filename', segmentPath,
          
          // Video encoding with bitrate constraints
          '-c:v', codec,
          '-preset', preset,
        ];
        
        // Add quality and bitrate control based on encoder
        if (encodingOptions.encoder === 'cpu-h265') {
          ffmpegArgs.push(
            `-${qualityParam}`, qualityValue.toString(),
            '-maxrate', `${targetVideoBitrate}k`,
            '-bufsize', `${targetVideoBitrate * 2}k`
          );
        }
        else if (encodingOptions.encoder === 'gpu-h265') {
          // GPU uses 2-pass encoding for optimal quality
          this.executeGPU2PassEncoding(
            inputPath, 
            keyInfoFile, 
            segmentPath, 
            playlistPath,
            videoId,
            targetVideoBitrate,
            audioSettings,
            segmentDuration,
            preset
          ).then(() => {
            resolve();
          }).catch((error) => {
            reject(error);
          });
          return; // Skip single-pass execution
        }
        
        // Add additional encoding flags
        ffmpegArgs.push(...additionalFlags);
        
        // Add audio settings
        if (audioSettings.codec === 'copy') {
          ffmpegArgs.push('-c:a', 'copy');
        } else {
          ffmpegArgs.push(
            '-c:a', audioSettings.codec,
            '-b:a', audioSettings.bitrate,
            '-ac', '2',
            '-ar', '44100'
          );
        }
        
        ffmpegArgs.push('-movflags', '+faststart', playlistPath);

        console.log(`⚙️  Encoding Settings: ${codec} ${qualityParam}=${qualityValue} preset=${preset}`);
        console.log(`🔧 FFmpeg command: ${config.ffmpeg.ffmpegPath} ${ffmpegArgs.join(' ')}`); 

        const ffmpegProcess = spawn(config.ffmpeg.ffmpegPath, ffmpegArgs);

        let stderrOutput = '';

        ffmpegProcess.stdout?.on('data', (data) => {
          console.log(`FFmpeg stdout: ${data}`);
        });

        ffmpegProcess.stderr?.on('data', (data) => {
          stderrOutput += data.toString();
          // Only log important progress information
          const output = data.toString();
          if (output.includes('frame=') || output.includes('time=')) {
            console.log(`FFmpeg progress: ${output.trim()}`);
          }
        });

        ffmpegProcess.on('close', (code) => {
          if (code === 0) {
            console.log(`✅ FFmpeg conversion completed for ${videoId}`);
            resolve();
          }
          else {
            console.error(`❌ FFmpeg exited with code ${code} for ${videoId}`);
            console.error(`FFmpeg stderr: ${stderrOutput}`);
            reject(new Error(`FFmpeg conversion failed with code ${code}`));
          }
        });

        ffmpegProcess.on('error', (error) => {
          console.error(`❌ FFmpeg process error for ${videoId}:`, error);
          reject(error);
        });
      }
      catch (error) {
        console.error(`❌ FFmpeg validation error for ${videoId}:`, error);
        reject(error instanceof Error ? error : new Error('FFmpeg validation failed'));
      }
    });
  }

  /**
   * Validate segment duration parameter
   */
  private validateSegmentDuration(duration: string): string {
    const parsed = parseInt(duration, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 60) {
      throw new Error(`Invalid segment duration: ${duration}. Must be between 1 and 60 seconds.`);
    }
    return parsed.toString();
  }

  /**
   * Validate codec parameter
   */
  private validateCodec(codec: string): string {
    const allowedCodecs = ['libx265', 'hevc_nvenc'];
    if (!allowedCodecs.includes(codec)) {
      throw new Error(`Invalid codec: ${codec}. Allowed codecs: ${allowedCodecs.join(', ')}`);
    }
    return codec;
  }

  /**
   * Validate preset parameter
   */
  private validatePreset(preset: string, encoder: EncodingOptions['encoder']): string {
    const allowedPresets = encoder === 'gpu-h265' 
      ? ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']
      : ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow'];
    
    if (!allowedPresets.includes(preset)) {
      throw new Error(`Invalid preset: ${preset} for encoder: ${encoder}. Allowed presets: ${allowedPresets.join(', ')}`);
    }
    return preset;
  }

  /**
   * Validate quality parameter name
   */
  private validateQualityParam(qualityParam: string): string {
    const allowedParams = ['crf', 'cq'];
    if (!allowedParams.includes(qualityParam)) {
      throw new Error(`Invalid quality parameter: ${qualityParam}. Allowed parameters: ${allowedParams.join(', ')}`);
    }
    return qualityParam;
  }

  /**
   * Validate quality value
   */
  private validateQualityValue(qualityValue: number): number {
    if (!Number.isInteger(qualityValue) || qualityValue < 0 || qualityValue > 51) {
      throw new Error(`Invalid quality value: ${qualityValue}. Must be an integer between 0 and 51.`);
    }
    return qualityValue;
  }

  /**
   * Validate additional flags for FFmpeg
   */
  private validateAdditionalFlags(flags: string[]): string[] {
    const allowedFlags = [
      '-tune', 'fastdecode', 'hq', 'uhq',
      '-rc', 'vbr'
    ];

    for (const flag of flags) {
      if (!allowedFlags.includes(flag)) {
        throw new Error(`Invalid additional flag: ${flag}. Allowed flags: ${allowedFlags.join(', ')}`);
      }
    }

    // Validate flag pairs (tune and rc flags should come in pairs)
    for (let i = 0; i < flags.length; i += 2) {
      const flagName = flags[i];
      const flagValue = flags[i + 1];
      
      if (flagName === '-tune' && !['fastdecode', 'hq', 'uhq'].includes(flagValue)) {
        throw new Error(`Invalid tune value: ${flagValue}. Allowed values: fastdecode, hq, uhq`);
      }
      
      if (flagName === '-rc' && flagValue !== 'vbr') {
        throw new Error(`Invalid rc value: ${flagValue}. Allowed values: vbr`);
      }
    }

    return flags;
  }

  /**
   * Execute GPU 2-pass encoding for optimal quality within bitrate limits
   */
  private async executeGPU2PassEncoding(
    inputPath: string,
    keyInfoFile: string, 
    segmentPath: string,
    playlistPath: string,
    videoId: string,
    targetVideoBitrate: number,
    audioSettings: { codec: string; bitrate: string },
    segmentDuration: string,
    preset: string
  ): Promise<void> {
    const videoDir = join(config.paths.videos, videoId);
    const logFile = join(videoDir, 'ffmpeg2pass');
    
    console.log(`🎯 Starting GPU 2-pass encoding for ${videoId}`);
    
    try {
      // Pass 1: Analysis
      console.log(`📊 Pass 1: Analyzing video complexity...`);
      await this.executePass1(
        inputPath, 
        targetVideoBitrate, 
        preset, 
        logFile
      );
      
      // Pass 2: HLS Encoding
      console.log(`🎬 Pass 2: Encoding HLS with optimal bitrate distribution...`);
      await this.executePass2(
        inputPath,
        keyInfoFile,
        segmentPath, 
        playlistPath,
        targetVideoBitrate,
        audioSettings,
        segmentDuration,
        preset,
        logFile
      );
      
      console.log(`✅ GPU 2-pass encoding completed for ${videoId}`);
      
    } catch (error) {
      console.error(`❌ GPU 2-pass encoding failed for ${videoId}:`, error);
      throw error;
    } finally {
      // Cleanup log files
      await this.cleanupPassLogFiles(logFile);
    }
  }
  
  /**
   * Execute Pass 1: Video analysis for optimal bitrate distribution
   */
  private async executePass1(
    inputPath: string,
    targetVideoBitrate: number,
    preset: string,
    logFile: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const pass1Args = [
        '-y', '-i', inputPath,
        '-c:v', 'hevc_nvenc',
        '-preset', preset,
        '-tune', 'uhq',
        '-b:v', `${targetVideoBitrate}k`,
        '-maxrate', `${targetVideoBitrate}k`,
        '-bufsize', `${targetVideoBitrate * 2}k`,
        '-rc', 'vbr',
        '-pass', '1',
        '-passlogfile', logFile,
        '-an', // No audio in pass 1
        '-f', 'null',
        '/dev/null'
      ];
      
      console.log(`🔧 Pass 1 command: ${config.ffmpeg.ffmpegPath} ${pass1Args.join(' ')}`);
      
      const ffmpegProcess = spawn(config.ffmpeg.ffmpegPath, pass1Args);
      let stderrOutput = '';
      
      ffmpegProcess.stderr?.on('data', (data) => {
        stderrOutput += data.toString();
      });
      
      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ Pass 1 analysis completed`);
          resolve();
        } else {
          console.error(`❌ Pass 1 failed with code ${code}`);
          console.error(`Pass 1 stderr: ${stderrOutput}`);
          reject(new Error(`Pass 1 failed with code ${code}`));
        }
      });
      
      ffmpegProcess.on('error', (error) => {
        console.error(`❌ Pass 1 process error:`, error);
        reject(error);
      });
    });
  }
  
  /**
   * Execute Pass 2: HLS encoding with analysis data from Pass 1
   */
  private async executePass2(
    inputPath: string,
    keyInfoFile: string,
    segmentPath: string, 
    playlistPath: string,
    targetVideoBitrate: number,
    audioSettings: { codec: string; bitrate: string },
    segmentDuration: string,
    preset: string,
    logFile: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const pass2Args = [
        '-y', '-i', inputPath,
        
        // HLS settings
        '-hls_time', segmentDuration,
        '-hls_key_info_file', keyInfoFile,
        '-hls_playlist_type', 'vod',
        '-hls_flags', 'delete_segments+independent_segments', 
        '-hls_segment_filename', segmentPath,
        
        // Video encoding with Pass 1 analysis data
        '-c:v', 'hevc_nvenc',
        '-preset', preset,
        '-tune', 'uhq',
        '-b:v', `${targetVideoBitrate}k`,
        '-maxrate', `${targetVideoBitrate}k`, 
        '-bufsize', `${targetVideoBitrate * 2}k`,
        '-rc', 'vbr',
        '-pass', '2',
        '-passlogfile', logFile
      ];
      
      // Add audio settings
      if (audioSettings.codec === 'copy') {
        pass2Args.push('-c:a', 'copy');
      } else {
        pass2Args.push(
          '-c:a', audioSettings.codec,
          '-b:a', audioSettings.bitrate,
          '-ac', '2',
          '-ar', '44100'
        );
      }
      
      pass2Args.push('-movflags', '+faststart', playlistPath);
      
      console.log(`🔧 Pass 2 command: ${config.ffmpeg.ffmpegPath} ${pass2Args.join(' ')}`);
      
      const ffmpegProcess = spawn(config.ffmpeg.ffmpegPath, pass2Args);
      let stderrOutput = '';
      
      ffmpegProcess.stderr?.on('data', (data) => {
        stderrOutput += data.toString();
        // Show encoding progress
        const output = data.toString();
        if (output.includes('frame=') || output.includes('time=')) {
          console.log(`FFmpeg progress: ${output.trim()}`);
        }
      });
      
      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ Pass 2 HLS encoding completed`);
          resolve();
        } else {
          console.error(`❌ Pass 2 failed with code ${code}`);
          console.error(`Pass 2 stderr: ${stderrOutput}`);
          reject(new Error(`Pass 2 failed with code ${code}`));
        }
      });
      
      ffmpegProcess.on('error', (error) => {
        console.error(`❌ Pass 2 process error:`, error);
        reject(error);
      });
    });
  }
  
  /**
   * Clean up FFmpeg pass log files
   */
  private async cleanupPassLogFiles(logFilePrefix: string): Promise<void> {
    try {
      // FFmpeg creates log files with extensions like .log, .log.mbtree, etc.
      const logFiles = [
        `${logFilePrefix}-0.log`,
        `${logFilePrefix}-0.log.mbtree`,
        `${logFilePrefix}.log`,
        `${logFilePrefix}.log.mbtree`
      ];
      
      for (const logFile of logFiles) {
        try {
          await fs.unlink(logFile);
          console.log(`🧹 Cleaned up log file: ${logFile}`);
        } catch {
          // Ignore cleanup errors for non-existent files
        }
      }
    } catch (error) {
      console.warn(`⚠️  Failed to cleanup pass log files:`, error);
    }
  }
  
  /**
   * Analyze video file using ffprobe to get bitrate, duration, and codec info
   */
  private async analyzeVideo(inputPath: string): Promise<VideoAnalysis> {
    return new Promise((resolve, reject) => {
      const ffprobeArgs = [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        inputPath
      ];

      const ffprobeProcess = spawn(config.ffmpeg.ffprobePath, ffprobeArgs);
      let stdout = '';
      let stderr = '';

      ffprobeProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      ffprobeProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      ffprobeProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`ffprobe failed with code ${code}: ${stderr}`));
          return;
        }

        try {
          const probeData = JSON.parse(stdout);
          
          // Extract file size
          const fileSize = parseInt(probeData.format.size || '0', 10);
          const duration = parseFloat(probeData.format.duration || '0');
          const totalBitrate = parseInt(probeData.format.bit_rate || '0', 10) / 1000; // Convert to kbps
          
          // Find video and audio streams
          const videoStream = probeData.streams.find((s: any) => s.codec_type === 'video');
          const audioStream = probeData.streams.find((s: any) => s.codec_type === 'audio');
          
          const videoCodec = videoStream?.codec_name || 'unknown';
          const audioCodec = audioStream?.codec_name || 'unknown';
          const audioBitrate = audioStream?.bit_rate ? parseInt(audioStream.bit_rate, 10) / 1000 : 128; // Default to 128kbps
          
          resolve({
            duration,
            bitrate: totalBitrate,
            audioBitrate,
            audioCodec,
            videoCodec,
            fileSize
          });
        } catch (error) {
          reject(new Error(`Failed to parse ffprobe output: ${error}`));
        }
      });

      ffprobeProcess.on('error', (error) => {
        reject(new Error(`ffprobe process error: ${error}`));
      });
    });
  }
  
  /**
   * Calculate optimal bitrates to prevent file size inflation
   */
  private calculateOptimalBitrates(analysis: VideoAnalysis, encoder: EncodingOptions['encoder']): {
    targetVideoBitrate: number;
    audioSettings: { codec: string; bitrate: string };
  } {
    // Use original bitrate as ceiling - don't exceed but same size is acceptable
    const maxTotalBitrate = Math.floor(analysis.bitrate);
    
    // Smart audio handling
    let audioSettings: { codec: string; bitrate: string };
    let audioBitrateValue: number;
    
    if (analysis.audioCodec === 'aac' && analysis.audioBitrate <= 160) {
      // Original is already efficient AAC, copy it
      audioSettings = { codec: 'copy', bitrate: '' };
      audioBitrateValue = analysis.audioBitrate;
      console.log(`📧 Copying original AAC audio (${analysis.audioBitrate}kbps)`);
    } else {
      // Re-encode audio
      const targetAudioBitrate = Math.min(128, analysis.audioBitrate * 0.8); // Don't exceed 128kbps or 80% of original
      audioSettings = { codec: 'aac', bitrate: `${Math.floor(targetAudioBitrate)}k` };
      audioBitrateValue = targetAudioBitrate;
      console.log(`🔄 Re-encoding audio: ${analysis.audioCodec} ${analysis.audioBitrate}kbps → AAC ${Math.floor(targetAudioBitrate)}kbps`);
    }
    
    // Calculate target video bitrate (total - audio - overhead)
    const hlsOverheadEstimate = 50; // kbps estimate for HLS segmentation overhead
    const targetVideoBitrate = Math.max(
      500, // Minimum 500kbps for video quality
      Math.floor(maxTotalBitrate - audioBitrateValue - hlsOverheadEstimate)
    );
    
    console.log(`📊 Bitrate calculation: Original ${analysis.bitrate}k → Max total ${maxTotalBitrate}k (Video: ${targetVideoBitrate}k + Audio: ${audioBitrateValue}k + Overhead: ${hlsOverheadEstimate}k)`);
    
    return {
      targetVideoBitrate,
      audioSettings
    };
  }

  /**
   * Check if HLS conversion is available for video
   */
  async isHLSAvailable(videoId: string): Promise<boolean> {
    try {
      const playlistPath = join(config.paths.videos, videoId, 'playlist.m3u8');
      await fs.access(playlistPath);
      return await this.keyManager.hasVideoKey(videoId);
    } catch {
      return false;
    }
  }

  /**
   * Get HLS playlist content
   */
  async getPlaylist(videoId: string): Promise<string> {
    const playlistPath = join(config.paths.videos, videoId, 'playlist.m3u8');
    return await fs.readFile(playlistPath, 'utf-8');
  }

  /**
   * Get list of HLS segments for a video
   */
  async getSegmentList(videoId: string): Promise<string[]> {
    try {
      const videoDir = join(config.paths.videos, videoId);
      const files = await fs.readdir(videoDir);
      return files.filter(file => file.endsWith('.ts')).sort();
    } catch {
      return [];
    }
  }

  /**
   * Get segment file path
   */
  getSegmentPath(videoId: string, segmentName: string): string {
    return join(config.paths.videos, videoId, segmentName);
  }

  /**
   * Validate segment name to prevent path traversal attacks
   */
  isValidSegmentName(segmentName: string): boolean {
    // Check for path traversal patterns
    if (segmentName.includes('..') || segmentName.includes('/') || segmentName.includes('\\')) {
      return false;
    }
    
    // Check for null bytes (security vulnerability)
    if (segmentName.includes('\0')) {
      return false;
    }
    
    // Updated pattern for new segment naming: segment-0000.ts
    return /^segment-\d{4}\.ts$/.test(segmentName);
  }

  /**
   * Clean up HLS files for a video
   */
  async cleanup(videoId: string): Promise<void> {
    try {
      const videoDir = join(config.paths.videos, videoId);
      await fs.rm(videoDir, { recursive: true, force: true });
      console.log(`🧹 Cleaned up HLS files for video: ${videoId}`);
    } catch (error) {
      console.error(`⚠️  Failed to cleanup HLS files for ${videoId}:`, error);
    }
  }

  /**
   * Get HLS conversion progress info (for future use)
   */
  getConversionInfo(videoId: string): { videoDir: string; playlistPath: string } {
    const videoDir = join(config.paths.videos, videoId);
    const playlistPath = join(videoDir, 'playlist.m3u8');
    
    return { videoDir, playlistPath };
  }

  /**
   * Remove original file after successful HLS conversion
   */
  private async removeOriginalFile(originalPath: string): Promise<void> {
    try {
      await fs.unlink(originalPath);
      console.log(`🗑️  Removed original file: ${originalPath}`);
    } catch (error) {
      console.warn(`⚠️  Failed to remove original file ${originalPath}:`, error);
      // Don't throw error - HLS conversion succeeded, original cleanup is non-critical
    }
  }
}
