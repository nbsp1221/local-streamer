import { access, mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import type { StoragePaths } from '~/shared/config/storage-paths.server';
import type { RecoverFailedPreparedVideoResult } from '../../application/ports/ingest-library-intake.port';
import type { IngestPreparedVideoWorkspacePort } from '../../application/ports/ingest-prepared-video-workspace.port';
import { FfprobeIngestVideoAnalysisAdapter } from '../analysis/ffprobe-ingest-video-analysis.adapter';
import { getIngestStoragePaths } from '../storage/ingest-storage-paths.server';

interface LoggerLike {
  error(message: string, error?: unknown): void;
  info(message: string, data?: unknown): void;
}

interface VideoAnalysisPort {
  analyze(inputPath: string): Promise<{ duration: number }>;
}

interface FilesystemIngestPreparedVideoWorkspaceAdapterDependencies {
  logger?: LoggerLike;
  storagePaths?: StoragePaths;
  videoAnalysis?: VideoAnalysisPort;
}

interface WorkspacePaths {
  audioDir: string;
  intermediatePath: string;
  keyPath: string;
  manifestPath: string;
  rootDir: string;
  tempDir: string;
  thumbnailPath: string;
  videoDir: string;
}

export class FilesystemIngestPreparedVideoWorkspaceAdapter implements IngestPreparedVideoWorkspacePort {
  private readonly logger: LoggerLike;
  private readonly storagePaths: StoragePaths;
  private readonly videoAnalysis: VideoAnalysisPort;

  constructor(deps: FilesystemIngestPreparedVideoWorkspaceAdapterDependencies = {}) {
    this.logger = deps.logger ?? console;
    this.storagePaths = deps.storagePaths ?? getIngestStoragePaths();
    this.videoAnalysis = deps.videoAnalysis ?? new FfprobeIngestVideoAnalysisAdapter();
  }

  async preparePreparedVideo(command: Parameters<IngestPreparedVideoWorkspacePort['preparePreparedVideo']>[0]) {
    const workspace = createWorkspacePaths(this.storagePaths.videosDir, command.videoId);
    const sourcePath = path.join(this.storagePaths.uploadsDir, command.filename);
    const sourceExtension = path.extname(command.filename);
    const workspaceVideoPath = path.join(workspace.rootDir, `video${sourceExtension}`);

    await createWorkspaceDirectories(workspace);

    try {
      await rename(sourcePath, workspaceVideoPath);
      const analysis = await this.videoAnalysis.analyze(workspaceVideoPath);
      await moveThumbnailToWorkspace({
        filename: command.filename,
        logger: this.logger,
        storagePaths: this.storagePaths,
        title: command.title,
        workspace,
      });

      return {
        duration: analysis.duration,
        sourcePath: workspaceVideoPath,
      };
    }
    catch (error) {
      const recoveryResult = await safeRecoverPreparedVideo(this.logger, async () => this.recoverPreparedVideo({
        filename: command.filename,
        videoId: command.videoId,
      }));
      throw attachPrepareRecoveryContext(error, recoveryResult);
    }
  }

  async recoverPreparedVideo(command: Parameters<IngestPreparedVideoWorkspacePort['recoverPreparedVideo']>[0]) {
    const workspace = createWorkspacePaths(this.storagePaths.videosDir, command.videoId);
    const sourceExtension = path.extname(command.filename);
    const destinationThumbnailPath = path.join(
      this.storagePaths.thumbnailsDir,
      `${path.parse(command.filename).name}.jpg`,
    );
    const restoredUpload = await restoreFileIfPresent({
      destinationPath: path.join(this.storagePaths.uploadsDir, command.filename),
      logger: this.logger,
      sourcePath: path.join(workspace.rootDir, `video${sourceExtension}`),
    });
    const restoredThumbnail = await restoreFileIfPresent({
      destinationPath: destinationThumbnailPath,
      logger: this.logger,
      sourcePath: workspace.thumbnailPath,
    });

    await rm(workspace.rootDir, { force: true, recursive: true });
    const retryAvailability = restoredUpload
      ? 'restored'
      : await fileExists(path.join(this.storagePaths.uploadsDir, command.filename))
        ? 'already_available'
        : 'unavailable';

    return {
      restoredThumbnail: restoredThumbnail || await fileExists(destinationThumbnailPath),
      retryAvailability,
    } satisfies RecoverFailedPreparedVideoResult;
  }
}

function createWorkspacePaths(videosDir: string, videoId: string): WorkspacePaths {
  const rootDir = path.join(videosDir, videoId);

  return {
    audioDir: path.join(rootDir, 'audio'),
    intermediatePath: path.join(rootDir, 'intermediate.mp4'),
    keyPath: path.join(rootDir, 'key.bin'),
    manifestPath: path.join(rootDir, 'manifest.mpd'),
    rootDir,
    tempDir: path.join(rootDir, 'temp'),
    thumbnailPath: path.join(rootDir, 'thumbnail.jpg'),
    videoDir: path.join(rootDir, 'video'),
  };
}

async function createWorkspaceDirectories(workspace: WorkspacePaths) {
  await mkdir(workspace.videoDir, { recursive: true });
  await mkdir(workspace.audioDir, { recursive: true });
  await mkdir(workspace.tempDir, { recursive: true });
}

async function moveThumbnailToWorkspace(input: {
  filename: string;
  logger: LoggerLike;
  storagePaths: StoragePaths;
  title: string;
  workspace: WorkspacePaths;
}) {
  const previewThumbnailPath = path.join(
    input.storagePaths.thumbnailsDir,
    `${path.parse(input.filename).name}.jpg`,
  );

  try {
    await access(previewThumbnailPath);
    await rename(previewThumbnailPath, input.workspace.thumbnailPath);
    input.logger.info(`Temporary thumbnail moved for: ${input.title}`);
  }
  catch {
    input.logger.info(`No temporary thumbnail available for: ${input.title}`);
  }
}

function attachPrepareRecoveryContext(
  error: unknown,
  recoveryResult: RecoverFailedPreparedVideoResult,
) {
  const preparedError = error instanceof Error
    ? error
    : new Error('Failed to prepare video for library');

  return Object.assign(preparedError, {
    addToLibraryStage: 'prepare' as const,
    recoveryResult,
  });
}

async function restoreFileIfPresent(input: {
  destinationPath: string;
  logger: LoggerLike;
  sourcePath: string;
}) {
  if (!await fileExists(input.sourcePath)) {
    return false;
  }

  await mkdir(path.dirname(input.destinationPath), { recursive: true });
  await rm(input.destinationPath, { force: true, recursive: true });
  await rename(input.sourcePath, input.destinationPath);
  input.logger.info(`Restored upload artifact: ${input.destinationPath}`);
  return true;
}

async function safeRecoverPreparedVideo(
  logger: LoggerLike,
  recover: () => Promise<RecoverFailedPreparedVideoResult>,
): Promise<RecoverFailedPreparedVideoResult> {
  try {
    return await recover();
  }
  catch (error) {
    logger.error('Failed to recover prepared video after prepare-stage error:', error);

    return {
      restoredThumbnail: false,
      retryAvailability: 'unavailable',
    };
  }
}

async function fileExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  }
  catch {
    return false;
  }
}
