import { v4 as uuidv4 } from 'uuid';
import type { IngestVideoRecord } from '../../domain/ingest-video-record';
import type {
  AddVideoToLibraryCommand,
  AddVideoToLibrarySuccessData,
  IngestLibraryIntakePort,
  RecoverFailedPreparedVideoResult,
} from '../ports/ingest-library-intake.port';
import type { IngestVideoMetadataWriterPort } from '../ports/ingest-video-metadata-writer.port';

type ErrorWithStatusCode = {
  statusCode: number;
};

type AddToLibraryStage = 'finalize' | 'prepare' | 'process' | 'write';
type RecoveryAwareError = {
  addToLibraryStage?: AddToLibraryStage;
  recoveryResult?: RecoverFailedPreparedVideoResult;
};

interface AddVideoToLibraryUseCaseDependencies {
  libraryIntake: IngestLibraryIntakePort;
  videoMetadataWriter: IngestVideoMetadataWriterPort;
}

export type AddVideoToLibraryUseCaseResult =
  | {
    ok: true;
    data: AddVideoToLibrarySuccessData;
  }
  | {
    ok: false;
    reason: 'ADD_TO_LIBRARY_REJECTED' | 'ADD_TO_LIBRARY_UNAVAILABLE';
    message: string;
  };

export class AddVideoToLibraryUseCase {
  constructor(
    private readonly deps: AddVideoToLibraryUseCaseDependencies,
  ) {}

  async execute(command: AddVideoToLibraryCommand): Promise<AddVideoToLibraryUseCaseResult> {
    let currentStage: AddToLibraryStage = 'prepare';
    let preparedVideo: { videoId: string } | null = null;
    let normalizedFilename: string | null = null;

    try {
      const validationError = validateCommand(command);
      if (validationError) {
        return {
          ok: false,
          message: validationError,
          reason: 'ADD_TO_LIBRARY_REJECTED',
        };
      }

      const normalizedCommand = normalizeCommand(command);
      normalizedFilename = normalizedCommand.filename;
      const videoId = uuidv4();
      const preparedAsset = await this.deps.libraryIntake.prepareVideoForLibrary({
        filename: normalizedCommand.filename,
        title: normalizedCommand.title,
        videoId,
      });
      const recoveryTarget = {
        filename: normalizedCommand.filename,
        videoId,
      };
      preparedVideo = recoveryTarget;
      currentStage = 'process';
      const processedVideo = await this.deps.libraryIntake.processPreparedVideo({
        encodingOptions: normalizedCommand.encodingOptions,
        sourcePath: preparedAsset.sourcePath,
        title: normalizedCommand.title,
        videoId,
      });

      if (!processedVideo.dashEnabled) {
        const recoveryResult = await this.deps.libraryIntake.recoverFailedPreparedVideo(recoveryTarget);

        return {
          ok: false,
          message: buildRecoveryFailureMessage({
            recoveryResult,
            when: 'video conversion failed',
          }),
          reason: 'ADD_TO_LIBRARY_UNAVAILABLE',
        };
      }

      const videoRecord = createVideoRecord({
        command: normalizedCommand,
        duration: preparedAsset.duration,
        videoId,
      });
      currentStage = 'write';
      await this.deps.videoMetadataWriter.writeVideoRecord(videoRecord);
      currentStage = 'finalize';
      await this.deps.libraryIntake.finalizeSuccessfulPreparedVideo({
        title: normalizedCommand.title,
        videoId,
      });
      const data: AddVideoToLibrarySuccessData = {
        dashEnabled: processedVideo.dashEnabled,
        message: processedVideo.message,
        videoId,
      };

      return {
        ok: true,
        data,
      };
    }
    catch (error) {
      const reason = isErrorWithStatusCode(error) && error.statusCode < 500
        ? 'ADD_TO_LIBRARY_REJECTED'
        : 'ADD_TO_LIBRARY_UNAVAILABLE';
      let message = error instanceof Error ? error.message : 'Failed to add video to library';
      const errorStage = getRecoveryAwareErrorStage(error) ?? currentStage;

      if (reason === 'ADD_TO_LIBRARY_UNAVAILABLE') {
        const recoveryResult = await resolveRecoveryResult({
          error,
          errorStage,
          libraryIntake: this.deps.libraryIntake,
          normalizedFilename,
          preparedVideo,
        });

        if (recoveryResult) {
          message = buildRecoveryFailureMessage({
            recoveryResult,
            when: stageFailureLabel(errorStage),
          });
        }
      }

      return {
        ok: false,
        message,
        reason,
      };
    }
  }
}

async function recoverPreparedVideo(
  libraryIntake: IngestLibraryIntakePort,
  command: { filename: string; videoId: string },
): Promise<RecoverFailedPreparedVideoResult> {
  try {
    return await libraryIntake.recoverFailedPreparedVideo(command);
  }
  catch (recoveryError) {
    console.error('Failed to recover prepared video after add-to-library error:', recoveryError);
    return {
      restoredThumbnail: false,
      retryAvailability: 'unavailable',
    };
  }
}

async function resolveRecoveryResult(input: {
  error: unknown;
  errorStage: AddToLibraryStage;
  libraryIntake: IngestLibraryIntakePort;
  normalizedFilename: string | null;
  preparedVideo: { videoId: string } | null;
}): Promise<RecoverFailedPreparedVideoResult | null> {
  const contextualRecovery = getRecoveryAwareErrorResult(input.error);
  if (input.errorStage === 'prepare' && contextualRecovery) {
    return contextualRecovery;
  }

  if (input.preparedVideo && input.normalizedFilename) {
    return recoverPreparedVideo(input.libraryIntake, {
      filename: input.normalizedFilename,
      videoId: input.preparedVideo.videoId,
    });
  }

  return null;
}

function buildRecoveryFailureMessage(input: {
  recoveryResult: RecoverFailedPreparedVideoResult;
  when: string;
}): string {
  if (input.recoveryResult.retryAvailability === 'restored' && input.recoveryResult.restoredThumbnail) {
    return `${capitalize(input.when)}. The upload was restored so you can retry.`;
  }

  if (input.recoveryResult.retryAvailability === 'restored') {
    return `${capitalize(input.when)}. The upload was restored, but the preview thumbnail could not be restored automatically.`;
  }

  if (input.recoveryResult.retryAvailability === 'already_available') {
    return `${capitalize(input.when)}. The upload is still available so you can retry.`;
  }

  return `${capitalize(input.when)} and the upload could not be restored automatically.`;
}

function capitalize(value: string): string {
  if (value.length === 0) {
    return value;
  }

  return value[0].toUpperCase() + value.slice(1);
}

function validateCommand(command: AddVideoToLibraryCommand): string | null {
  const input = command as AddVideoToLibraryCommand & {
    description?: unknown;
    filename?: unknown;
    tags?: unknown;
    title?: unknown;
  };

  if (typeof input.filename !== 'string' || typeof input.title !== 'string') {
    return 'Filename and title are required';
  }

  if (typeof input.description !== 'undefined' && typeof input.description !== 'string') {
    return 'Description must be a string';
  }

  if (typeof input.tags !== 'undefined' && !isStringArray(input.tags)) {
    return 'Tags must be an array';
  }

  if (input.title.trim().length === 0) {
    return 'Title cannot be empty';
  }

  return null;
}

function normalizeCommand(command: AddVideoToLibraryCommand): AddVideoToLibraryCommand {
  const tags = Array.isArray(command.tags)
    ? command.tags
    : [];

  return {
    ...command,
    description: typeof command.description === 'string'
      ? command.description.trim() || undefined
      : undefined,
    tags: tags
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0),
    title: command.title.trim(),
  };
}

function createVideoRecord(input: {
  command: AddVideoToLibraryCommand;
  duration: number;
  videoId: string;
}): IngestVideoRecord {
  const { command, duration, videoId } = input;

  return {
    description: command.description,
    duration,
    id: videoId,
    tags: command.tags,
    thumbnailUrl: `/api/thumbnail/${videoId}`,
    title: command.title,
    videoUrl: `/videos/${videoId}/manifest.mpd`,
  };
}

function isErrorWithStatusCode(error: unknown): error is ErrorWithStatusCode {
  return typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof error.statusCode === 'number';
}

function getRecoveryAwareErrorResult(error: unknown): RecoverFailedPreparedVideoResult | null {
  if (typeof error !== 'object' || error === null || !('recoveryResult' in error)) {
    return null;
  }

  const recoveryResult = (error as RecoveryAwareError).recoveryResult;
  if (!recoveryResult) {
    return null;
  }

  return recoveryResult;
}

function getRecoveryAwareErrorStage(error: unknown): AddToLibraryStage | null {
  if (typeof error !== 'object' || error === null || !('addToLibraryStage' in error)) {
    return null;
  }

  const stage = (error as RecoveryAwareError).addToLibraryStage;
  return stage ?? null;
}

function stageFailureLabel(stage: AddToLibraryStage): string {
  switch (stage) {
    case 'prepare':
      return 'video preparation failed';
    case 'process':
      return 'video conversion failed';
    case 'write':
      return 'video metadata could not be saved';
    case 'finalize':
      return 'video finalization failed';
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) &&
    value.every(item => typeof item === 'string');
}
