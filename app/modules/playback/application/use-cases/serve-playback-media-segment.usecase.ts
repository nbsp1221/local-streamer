import type {
  PlaybackMediaSegmentService,
  PlaybackMediaType,
} from '../ports/playback-media-segment-service.port';
import type { PlaybackTokenService } from '../ports/playback-token-service.port';
import {
  type PlaybackResourceDecision,
  PlaybackResourcePolicy,
} from '../../domain/policies/PlaybackResourcePolicy';

interface ServePlaybackMediaSegmentUseCaseDependencies {
  mediaSegmentService: PlaybackMediaSegmentService;
  tokenService: PlaybackTokenService;
}

interface ServePlaybackMediaSegmentUseCaseInput {
  filename: string;
  mediaType: PlaybackMediaType;
  rangeHeader: string | null;
  token: string | null;
  videoId: string;
}

type ServePlaybackMediaSegmentUseCaseResult =
  | {
    headers: Record<string, string>;
    isRangeResponse: boolean;
    ok: true;
    statusCode?: number;
    stream: ReadableStream;
  }
  | ({
    ok: false;
  } & Omit<Extract<PlaybackResourceDecision, { allowed: false }>, 'allowed'>);

export class ServePlaybackMediaSegmentUseCase {
  constructor(private readonly deps: ServePlaybackMediaSegmentUseCaseDependencies) {}

  async execute(input: ServePlaybackMediaSegmentUseCaseInput): Promise<ServePlaybackMediaSegmentUseCaseResult> {
    const payload = input.token
      ? await this.deps.tokenService.validate(input.token)
      : null;
    const decision = PlaybackResourcePolicy.evaluate({
      requestedVideoId: input.videoId,
      resource: input.mediaType === 'audio' ? 'audio-segment' : 'segment',
      token: payload,
    });

    if (!decision.allowed) {
      return {
        metadata: decision.metadata,
        ok: false,
        reason: decision.reason,
      };
    }

    const segment = await this.deps.mediaSegmentService.serveSegment({
      filename: input.filename,
      mediaType: input.mediaType,
      rangeHeader: input.rangeHeader,
      videoId: input.videoId,
    });

    return {
      headers: segment.headers,
      isRangeResponse: segment.isRangeResponse,
      ok: true,
      statusCode: segment.statusCode,
      stream: segment.stream,
    };
  }
}
