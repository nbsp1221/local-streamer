import type { PendingVideo } from '~/types/video';

/**
 * Request interface for scanning incoming videos
 * Currently empty as no parameters are needed
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ScanIncomingRequest {
  // No parameters needed for scanning
}

/**
 * Response interface for scanning incoming videos
 */
export interface ScanIncomingResponse {
  files: PendingVideo[];
  count: number;
}

/**
 * Dependencies required for ScanIncomingUseCase
 */
export interface ScanIncomingDependencies {
  fileManager: {
    ensureUploadsDirectory: () => Promise<void>;
    scanIncomingFiles: () => Promise<PendingVideo[]>;
  };
  logger: {
    info: (message: string, data?: unknown) => void;
    error: (message: string, error?: unknown) => void;
    warn: (message: string, data?: unknown) => void;
  };
}
