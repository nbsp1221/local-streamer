import type { PlaybackTokenService } from '../ports/playback-token-service.port';
import { PlaybackGrantPolicy } from '../../domain/policies/PlaybackGrantPolicy';

interface IssuePlaybackTokenUseCaseDependencies {
  tokenService: PlaybackTokenService;
}

interface IssuePlaybackTokenUseCaseInput {
  hasSiteSession: boolean;
  ipAddress?: string;
  userAgent?: string;
  videoId: string;
}

type IssuePlaybackTokenUseCaseResult =
  | {
    success: true;
    token: string;
    urls: {
      clearkey: string;
      manifest: string;
    };
  }
  | {
    reason: 'SITE_SESSION_REQUIRED';
    success: false;
  };

export class IssuePlaybackTokenUseCase {
  constructor(private readonly deps: IssuePlaybackTokenUseCaseDependencies) {}

  async execute(input: IssuePlaybackTokenUseCaseInput): Promise<IssuePlaybackTokenUseCaseResult> {
    const decision = PlaybackGrantPolicy.evaluate({
      hasSiteSession: input.hasSiteSession,
    });

    if (!decision.allowed) {
      return {
        reason: decision.reason,
        success: false,
      };
    }

    const token = await this.deps.tokenService.issue({
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      videoId: input.videoId,
    });

    return {
      success: true,
      token,
      urls: {
        clearkey: `/videos/${input.videoId}/clearkey?token=${token}`,
        manifest: `/videos/${input.videoId}/manifest.mpd?token=${token}`,
      },
    };
  }
}
