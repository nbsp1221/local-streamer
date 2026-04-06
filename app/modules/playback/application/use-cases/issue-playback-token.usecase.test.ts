import { describe, expect, test, vi } from 'vitest';

describe('IssuePlaybackTokenUseCase', () => {
  test('issues a playback token for an authenticated request and returns manifest and clearkey URLs', async () => {
    const { IssuePlaybackTokenUseCase } = await import('./issue-playback-token.usecase');
    const issue = vi.fn(async () => 'signed-token');
    const useCase = new IssuePlaybackTokenUseCase({
      tokenService: {
        issue,
        validate: async () => null,
      },
    });

    const result = await useCase.execute({
      hasSiteSession: true,
      ipAddress: '203.0.113.10',
      userAgent: 'vitest',
      videoId: 'video-1',
    });

    expect(result).toEqual({
      success: true,
      token: 'signed-token',
      urls: {
        clearkey: '/videos/video-1/clearkey?token=signed-token',
        manifest: '/videos/video-1/manifest.mpd?token=signed-token',
      },
    });
    expect(issue).toHaveBeenCalledWith({
      ipAddress: '203.0.113.10',
      userAgent: 'vitest',
      videoId: 'video-1',
    });
  });

  test('denies token issuance when the site session grant policy rejects the request', async () => {
    const { IssuePlaybackTokenUseCase } = await import('./issue-playback-token.usecase');
    const issue = vi.fn(async () => 'signed-token');
    const useCase = new IssuePlaybackTokenUseCase({
      tokenService: {
        issue,
        validate: async () => null,
      },
    });

    const result = await useCase.execute({
      hasSiteSession: false,
      ipAddress: '203.0.113.10',
      userAgent: 'vitest',
      videoId: 'video-1',
    });

    expect(result).toEqual({
      reason: 'SITE_SESSION_REQUIRED',
      success: false,
    });
    expect(issue).not.toHaveBeenCalled();
  });

  test('rejects unsafe playback video ids before minting a token', async () => {
    const { IssuePlaybackTokenUseCase } = await import('./issue-playback-token.usecase');
    const issue = vi.fn(async () => 'signed-token');
    const useCase = new IssuePlaybackTokenUseCase({
      tokenService: {
        issue,
        validate: async () => null,
      },
    });

    await expect(useCase.execute({
      hasSiteSession: true,
      ipAddress: '203.0.113.10',
      userAgent: 'vitest',
      videoId: '../escape',
    })).rejects.toMatchObject({
      message: 'Invalid video ID format',
      name: 'ValidationError',
      statusCode: 400,
    });
    expect(issue).not.toHaveBeenCalled();
  });
});
