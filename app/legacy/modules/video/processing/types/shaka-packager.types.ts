/**
 * Types for Shaka Packager service
 */

export interface PackagingRequest {
  /** Video ID */
  videoId: string;
  /** Input file path (transcoded intermediate file) */
  inputPath: string;
  /** Output directory for packaged files */
  outputDir: string;
  /** Encryption configuration */
  encryption: EncryptionConfig;
  /** Segment duration in seconds */
  segmentDuration?: number;
  /** Generate static live MPD */
  staticLiveMpd?: boolean;
}

export interface EncryptionConfig {
  /** Encryption scheme (cenc, cbcs, etc.) */
  scheme: 'cenc' | 'cbcs' | 'none';
  /** AES-128 encryption key (hex) */
  key: string;
  /** Key ID for Clear Key DRM (hex) */
  keyId: string;
  /** Key info file path (for HLS compatibility) */
  keyInfoFile?: string;
  /** DRM label */
  drmLabel?: string;
}

export interface PackagingResult {
  /** Path to the generated manifest file */
  manifestPath: string;
  /** Paths to video segments */
  videoSegments: string[];
  /** Paths to audio segments */
  audioSegments: string[];
  /** Path to video init segment */
  videoInitSegment: string;
  /** Path to audio init segment */
  audioInitSegment: string;
  /** Total number of segments created */
  segmentCount: number;
  /** Duration of packaging operation */
  duration: number;
}

export interface ShakaCommandOptions {
  /** Input file path */
  input: string;
  /** Video stream output configuration */
  videoStream: StreamConfig;
  /** Audio stream output configuration */
  audioStream: StreamConfig;
  /** Encryption configuration */
  encryption?: EncryptionConfig;
  /** MPD output path */
  mpdOutput: string;
  /** Segment duration */
  segmentDuration: number;
  /** Generate static live MPD */
  staticLiveMpd: boolean;
}

export interface StreamConfig {
  /** Stream type (video or audio) */
  streamType: 'video' | 'audio';
  /** Init segment path */
  initSegment: string;
  /** Segment template path */
  segmentTemplate: string;
  /** DRM label if encrypted */
  drmLabel?: string;
}

export class PackagingError extends Error {
  constructor(
    message: string,
    public readonly inputPath: string,
    public readonly outputDir: string,
    public readonly stderr?: string,
  ) {
    super(message);
    this.name = 'PackagingError';
  }
}

export class ManifestGenerationError extends PackagingError {
  constructor(inputPath: string, outputDir: string, stderr?: string) {
    super('Failed to generate DASH manifest', inputPath, outputDir, stderr);
    this.name = 'ManifestGenerationError';
  }
}

export class EncryptionError extends PackagingError {
  constructor(message: string, inputPath: string, outputDir: string) {
    super(`Encryption failed: ${message}`, inputPath, outputDir);
    this.name = 'EncryptionError';
  }
}

export interface ShakaPackagerService {
  /**
   * Package a video file into DASH format with encryption
   */
  package(request: PackagingRequest): Promise<PackagingResult>;

  /**
   * Build Shaka Packager command arguments
   */
  buildPackagerArgs(options: ShakaCommandOptions): string[];

  /**
   * Check if Shaka Packager is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get Shaka Packager version
   */
  getVersion(): Promise<string>;

  /**
   * List segments in a packaged directory
   */
  listSegments(videoDir: string): Promise<string[]>;
}
