export type MediaType = 'audio' | 'video';

export interface MediaSegmentRequest {
  videoId: string;
  filename: string;
  mediaType: MediaType;
  request: Request;
}

export interface MediaSegmentResponse {
  success: true;
  stream: ReadableStream;
  headers: Record<string, string>;
  isRangeResponse?: boolean;
  statusCode?: number;
}

export interface FileStats {
  size: number;
  mtime: Date;
}

export interface MediaSegmentDependencies {
  jwtValidator: {
    validateVideoRequest: (request: Request, videoId: string) => Promise<{
      valid: boolean;
      error?: string;
      payload?: { userId?: string };
    }>;
  };
  fileSystem: {
    stat: (path: string) => Promise<FileStats>;
    exists: (path: string) => Promise<boolean>;
    createReadStream: (path: string) => ReadableStream;
  };
  dashUtils: {
    isValidDashSegmentName: (filename: string) => boolean;
    getDashContentType: (filename: string, mediaType: MediaType) => string;
    getDashSegmentHeaders: (contentType: string, fileSize: number) => HeadersInit;
    handleDashRangeRequest: (
      filePath: string,
      range: string,
      fileSize: number,
      contentType: string
    ) => Response;
  };
  pathResolver: {
    getVideoSegmentPath: (videoId: string, mediaType: MediaType, filename: string) => string;
  };
  logger?: {
    info: (message: string, meta?: any) => void;
    error: (message: string, error?: any) => void;
    warn: (message: string, meta?: any) => void;
  };
}
