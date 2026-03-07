import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format video duration from seconds to MM:SS format
 * Uses Math.floor to follow YouTube/HTML5 video player standards
 * @param seconds Duration in seconds (can include decimals)
 * @returns Formatted string in MM:SS format
 * @example
 * formatDuration(58.916667) // "0:58"
 * formatDuration(61.5) // "1:01"
 * formatDuration(3661.2) // "61:01"
 */
export function formatDuration(seconds: number): string {
  // Handle invalid inputs gracefully
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
