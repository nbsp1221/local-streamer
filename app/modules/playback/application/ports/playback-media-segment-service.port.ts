export type PlaybackMediaType = 'audio' | 'video';

export interface PlaybackMediaSegmentResponse {
  headers: Record<string, string>;
  isRangeResponse: boolean;
  statusCode?: number;
  stream: ReadableStream;
}

export interface PlaybackMediaSegmentService {
  serveSegment: (input: {
    filename: string;
    mediaType: PlaybackMediaType;
    rangeHeader: string | null;
    videoId: string;
  }) => Promise<PlaybackMediaSegmentResponse>;
}
