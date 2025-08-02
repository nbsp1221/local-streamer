import { spawn } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import { join, dirname, basename, extname } from 'path';
import { existsSync, mkdirSync, statSync } from 'fs';

export interface HLSConversionOptions {
  inputPath: string;
  outputDir: string;
  quality?: '480p' | '720p' | '1080p';
  segmentDuration?: number;
}

export interface HLSConversionResult {
  success: boolean;
  playlistPath?: string;
  segmentCount?: number;
  duration?: number;
  error?: string;
}
const QUALITY_SETTINGS = {
  '480p': {
    width: 854,
    height: 480,
    videoBitrate: '1000k',
    audioBitrate: '128k'
  },
  '720p': {
    width: 1280,
    height: 720,
    videoBitrate: '2500k',
    audioBitrate: '128k'
  },
  '1080p': {
    width: 1920,
    height: 1080,
    videoBitrate: '5000k',
    audioBitrate: '192k'
  }
};

/**
 * MP4 파일을 HLS 형식으로 변환
 * 
 * @param options 변환 옵션
 * @returns 변환 결과
 */
export async function convertToHLS(options: HLSConversionOptions): Promise<HLSConversionResult> {
  const { inputPath, outputDir, quality = '720p', segmentDuration = 6 } = options;
  
  // 입력 파일 존재 확인
  if (!existsSync(inputPath)) {
    return {
      success: false,
      error: `입력 파일이 존재하지 않습니다: ${inputPath}`
    };
  }
  
  // 출력 디렉토리 생성
  if (!existsSync(outputDir)) {
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch (error) {
      return {
        success: false,
        error: `출력 디렉토리 생성 실패: ${error}`
      };
    }
  }
  
  const inputFileName = basename(inputPath, extname(inputPath));
  const playlistPath = join(outputDir, `${inputFileName}.m3u8`);
  const segmentPattern = join(outputDir, `${inputFileName}_segment%d.ts`);
  
  const settings = QUALITY_SETTINGS[quality];
  
  console.log(`🎬 HLS 변환 시작:`);
  console.log(`   입력: ${inputPath}`);
  console.log(`   출력: ${playlistPath}`);
  console.log(`   품질: ${quality} (${settings.width}x${settings.height})`);
  console.log(`   세그먼트: ${segmentDuration}초`);
  
  return new Promise((resolve) => {
    const ffmpegArgs = [
      '-i', inputPath,
      
      // 비디오 설정
      '-c:v', 'libx264',
      '-preset', 'medium',          // 인코딩 속도 vs 품질 균형
      '-crf', '23',                 // 일정한 품질 (18-28, 낮을수록 고품질)
      '-s', `${settings.width}x${settings.height}`, // 해상도
      '-b:v', settings.videoBitrate, // 비디오 비트레이트
      '-maxrate', settings.videoBitrate,
      '-bufsize', `${parseInt(settings.videoBitrate) * 2}k`,
      
      // 오디오 설정
      '-c:a', 'aac',
      '-b:a', settings.audioBitrate,
      '-ar', '44100',               // 샘플레이트
      
      // HLS 설정
      '-f', 'hls',
      '-hls_time', segmentDuration.toString(),
      '-hls_list_size', '0',        // 모든 세그먼트 유지
      '-hls_segment_type', 'mpegts',
      '-hls_segment_filename', segmentPattern,
      
      // 키프레임 설정 (세그먼트 경계에 키프레임)
      '-g', (segmentDuration * 30).toString(), // 30fps 기준
      '-keyint_min', (segmentDuration * 30).toString(),
      '-sc_threshold', '0',         // 씬 체인지 감지 비활성화
      
      // 기타 설정
      '-y',                         // 덮어쓰기
      playlistPath
    ];
    
    console.log(`🔧 FFmpeg 명령어: ${ffmpegStatic} ${ffmpegArgs.join(' ')}`);
    
    if (!ffmpegStatic) {
      throw new Error('FFmpeg binary not found');
    }

    const ffmpeg = spawn(ffmpegStatic, ffmpegArgs);
    
    let stderr = '';
    let lastProgress = '';
    
    ffmpeg.stderr?.on('data', (data: any) => {
      const output = data.toString();
      stderr += output;
      
      // 진행상황 파싱 및 표시
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.includes('frame=') && line.includes('time=')) {
          // 중복 출력 방지
          if (line.trim() !== lastProgress) {
            process.stdout.write(`\r   📊 ${line.trim()}`);
            lastProgress = line.trim();
          }
        }
      }
    });
    
    ffmpeg.on('close', (code: any) => {
      console.log(''); // 새 줄
      
      if (code === 0) {
        // 성공 - 결과 파일들 확인
        if (existsSync(playlistPath)) {
          try {
            // 세그먼트 파일 개수 계산
            const segmentCount = countSegmentFiles(outputDir, inputFileName);
            
            // 원본 파일 정보
            const inputStats = statSync(inputPath);
            const inputSizeMB = (inputStats.size / 1024 / 1024).toFixed(2);
            
            console.log(`✅ HLS 변환 완료!`);
            console.log(`   📁 플레이리스트: ${playlistPath}`);
            console.log(`   🎞️  세그먼트 개수: ${segmentCount}개`);
            console.log(`   📦 원본 크기: ${inputSizeMB}MB`);
            
            resolve({
              success: true,
              playlistPath,
              segmentCount,
              duration: extractDuration(stderr)
            });
          } catch (error) {
            resolve({
              success: false,
              error: `결과 파일 분석 중 오류: ${error}`
            });
          }
        } else {
          resolve({
            success: false,
            error: '플레이리스트 파일이 생성되지 않았습니다'
          });
        }
      } else {
        console.log(`❌ HLS 변환 실패 (코드: ${code})`);
        
        // 오류 메시지에서 유용한 정보 추출
        const errorLines = stderr.split('\n').slice(-10).join('\n');
        console.log('FFmpeg 오류 (마지막 10줄):');
        console.log(errorLines);
        
        resolve({
          success: false,
          error: `FFmpeg 변환 실패 (코드: ${code})`
        });
      }
    });
    
    ffmpeg.on('error', (err: any) => {
      console.log(`❌ FFmpeg 프로세스 오류: ${err.message}`);
      resolve({
        success: false,
        error: `프로세스 오류: ${err.message}`
      });
    });
  });
}

/**
 * 디렉토리에서 세그먼트 파일 개수 계산
 */
function countSegmentFiles(outputDir: string, baseName: string): number {
  try {
    const fs = require('fs');
    const files = fs.readdirSync(outputDir);
    const segmentFiles = files.filter((file: string) => 
      file.startsWith(`${baseName}_segment`) && file.endsWith('.ts')
    );
    return segmentFiles.length;
  } catch (error) {
    console.log(`세그먼트 파일 개수 계산 중 오류: ${error}`);
    return 0;
  }
}

/**
 * FFmpeg 출력에서 총 재생시간 추출
 */
function extractDuration(stderr: string): number | undefined {
  const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
  if (durationMatch) {
    const hours = parseInt(durationMatch[1]);
    const minutes = parseInt(durationMatch[2]);
    const seconds = parseInt(durationMatch[3]);
    const centiseconds = parseInt(durationMatch[4]);
    
    return hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
  }
  return undefined;
}

/**
 * 간편한 HLS 변환 함수 (기본 설정 사용)
 */
export async function convertVideoToHLS(
  inputPath: string, 
  outputDir: string, 
  quality: '480p' | '720p' | '1080p' = '720p'
): Promise<HLSConversionResult> {
  return convertToHLS({
    inputPath,
    outputDir,
    quality,
    segmentDuration: 6
  });
}