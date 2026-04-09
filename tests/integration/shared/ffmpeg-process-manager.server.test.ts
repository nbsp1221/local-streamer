import { afterEach, describe, expect, test, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('active ffmpeg process manager', () => {
  test('cleans up a hung process after timeout by terminating and then force killing when needed', async () => {
    const stdoutOn = vi.fn();
    const stderrOn = vi.fn();
    const closeOn = vi.fn();
    const errorOn = vi.fn();
    const kill = vi.fn();
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const spawn = vi.fn(() => ({
      killed: false,
      pid: 123,
      stderr: { on: stderrOn },
      stdout: { on: stdoutOn },
      on: (event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'close') closeOn.mockImplementation(() => handler);
        if (event === 'error') errorOn.mockImplementation(() => handler);
      },
      kill,
    }));

    const { executeFFmpegCommand } = await import('../../../app/shared/lib/server/ffmpeg-process-manager.server');

    const promise = executeFFmpegCommand({
      args: ['-version'],
      command: 'ffmpeg',
      spawn,
      timeoutMs: 1,
    });

    await expect(promise).rejects.toThrow(/timed out/i);
    expect(spawn).toHaveBeenCalledOnce();
    expect(kill).toHaveBeenCalledWith('SIGTERM');
    expect(setTimeoutSpy).toHaveBeenCalled();
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
