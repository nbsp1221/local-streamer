import { describe, expect, it } from 'vitest';
import { formatDuration } from './utils';

describe('formatDuration', () => {
  describe('Basic formatting', () => {
    it('should format whole seconds correctly', () => {
      expect(formatDuration(0)).toBe('0:00');
      expect(formatDuration(30)).toBe('0:30');
      expect(formatDuration(59)).toBe('0:59');
    });

    it('should format minutes correctly', () => {
      expect(formatDuration(60)).toBe('1:00');
      expect(formatDuration(90)).toBe('1:30');
      expect(formatDuration(120)).toBe('2:00');
    });

    it('should format hours as minutes (61+ minutes)', () => {
      expect(formatDuration(3600)).toBe('60:00'); // 1 hour = 60 minutes
      expect(formatDuration(3661)).toBe('61:01'); // 1 hour 1 minute 1 second
      expect(formatDuration(7200)).toBe('120:00'); // 2 hours = 120 minutes
    });
  });

  describe('Decimal seconds handling (Math.floor behavior)', () => {
    it('should floor decimal seconds - bug fix validation', () => {
      // This was the original bug: 58.916667 should become 0:58, not 0:58.916667
      expect(formatDuration(58.916667)).toBe('0:58');
      expect(formatDuration(59.1)).toBe('0:59');
      expect(formatDuration(61.5)).toBe('1:01');
      expect(formatDuration(119.9)).toBe('1:59');
    });

    it('should handle edge cases around minute boundaries', () => {
      expect(formatDuration(59.9)).toBe('0:59'); // Should not round up to 1:00
      expect(formatDuration(60.1)).toBe('1:00');
      expect(formatDuration(60.9)).toBe('1:00');
    });

    it('should handle very small decimals', () => {
      expect(formatDuration(0.1)).toBe('0:00');
      expect(formatDuration(0.9)).toBe('0:00');
      expect(formatDuration(1.1)).toBe('0:01');
    });
  });

  describe('YouTube/HTML5 standard compliance', () => {
    it('should always use Math.floor for consistent behavior', () => {
      // These test cases verify we follow industry standard (Math.floor, not Math.round)
      expect(formatDuration(29.9)).toBe('0:29'); // Floor, not round to 0:30
      expect(formatDuration(89.8)).toBe('1:29'); // Floor, not round to 1:30
      expect(formatDuration(149.7)).toBe('2:29'); // Floor, not round to 2:30
    });

    it('should pad seconds with leading zero', () => {
      expect(formatDuration(5)).toBe('0:05');
      expect(formatDuration(65)).toBe('1:05');
      expect(formatDuration(605)).toBe('10:05');
    });

    it('should not pad minutes with leading zero for readability', () => {
      expect(formatDuration(600)).toBe('10:00'); // Not "010:00"
      expect(formatDuration(3600)).toBe('60:00'); // Not "060:00"
    });
  });

  describe('Real-world video duration examples', () => {
    it('should handle typical video durations', () => {
      expect(formatDuration(30.5)).toBe('0:30'); // Short clip
      expect(formatDuration(125.7)).toBe('2:05'); // 2 minute video
      expect(formatDuration(600.3)).toBe('10:00'); // 10 minute video
      expect(formatDuration(1800.9)).toBe('30:00'); // 30 minute video
    });

    it('should handle long-form content', () => {
      expect(formatDuration(3661.2)).toBe('61:01'); // 1+ hour content
      expect(formatDuration(5400.5)).toBe('90:00'); // 1.5 hour movie
      expect(formatDuration(7200)).toBe('120:00'); // 2 hour movie
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle negative numbers gracefully', () => {
      // While unexpected, should not crash
      expect(formatDuration(-1)).toBe('0:00');
      expect(formatDuration(-30.5)).toBe('0:00');
    });

    it('should handle zero and very large numbers', () => {
      expect(formatDuration(0)).toBe('0:00');
      expect(formatDuration(999999)).toBe('16666:39'); // Very large number
    });

    it('should handle NaN and Infinity', () => {
      expect(formatDuration(NaN)).toBe('0:00');
      expect(formatDuration(Infinity)).toBe('0:00');
      expect(formatDuration(-Infinity)).toBe('0:00');
    });
  });
});
