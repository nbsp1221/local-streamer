import { existsSync } from 'node:fs';
import path from 'node:path';

export function getFFmpegPath(): string {
  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }

  const localFFmpeg = path.join(process.cwd(), 'binaries', 'ffmpeg');
  if (existsSync(localFFmpeg)) {
    return localFFmpeg;
  }

  return 'ffmpeg';
}

export function getFFprobePath(): string {
  if (process.env.FFPROBE_PATH && existsSync(process.env.FFPROBE_PATH)) {
    return process.env.FFPROBE_PATH;
  }

  const localFFprobe = path.join(process.cwd(), 'binaries', 'ffprobe');
  if (existsSync(localFFprobe)) {
    return localFFprobe;
  }

  return 'ffprobe';
}
