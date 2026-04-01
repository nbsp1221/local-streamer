import type { PlaybackMediaSegmentService as PlaybackMediaSegmentServicePort } from '../../application/ports/playback-media-segment-service.port';
import { LegacyPlaybackMediaSegmentServiceAdapter } from './legacy-playback-media-segment.service.adapter';

interface PlaybackMediaSegmentRouteRequest {
  filename: string;
  mediaType: 'audio' | 'video';
  request: Request;
  videoId: string;
}

interface PlaybackMediaSegmentUseCaseResult {
  data?: {
    headers: Record<string, string>;
    isRangeResponse?: boolean;
    statusCode?: number;
    stream: ReadableStream;
    success: true;
  };
  error?: Error;
  success: boolean;
}

interface PlaybackMediaSegmentServiceDependencies {
  execute?: (input: PlaybackMediaSegmentRouteRequest) => Promise<PlaybackMediaSegmentUseCaseResult>;
}

// Temporary playback-owned compatibility seam while protected DASH segment delivery still delegates to legacy internals.
export class PlaybackMediaSegmentService implements PlaybackMediaSegmentServicePort {
  private readonly delegate: PlaybackMediaSegmentServicePort;

  constructor(deps: PlaybackMediaSegmentServiceDependencies = {}) {
    this.delegate = new LegacyPlaybackMediaSegmentServiceAdapter(deps);
  }

  async serveSegment(input: Parameters<PlaybackMediaSegmentServicePort['serveSegment']>[0]) {
    return this.delegate.serveSegment(input);
  }
}
