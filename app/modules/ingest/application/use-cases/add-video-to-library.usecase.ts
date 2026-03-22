import { v4 as uuidv4 } from 'uuid';
import type { IngestVideoRecord } from '../../domain/ingest-video-record';
import type {
  AddVideoToLibraryCommand,
  AddVideoToLibrarySuccessData,
  IngestLibraryIntakePort,
} from '../ports/ingest-library-intake.port';
import type { IngestVideoMetadataWriterPort } from '../ports/ingest-video-metadata-writer.port';

type ErrorWithStatusCode = {
  statusCode: number;
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
      const videoId = uuidv4();
      const preparedVideo = await this.deps.libraryIntake.prepareVideoForLibrary({
        filename: normalizedCommand.filename,
        title: normalizedCommand.title,
        videoId,
      });
      const videoRecord = createVideoRecord({
        command: normalizedCommand,
        duration: preparedVideo.duration,
        videoId,
      });
      await this.deps.videoMetadataWriter.writeVideoRecord(videoRecord);
      const processedVideo = await this.deps.libraryIntake.processPreparedVideo({
        encodingOptions: normalizedCommand.encodingOptions,
        sourcePath: preparedVideo.sourcePath,
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
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to add video to library',
        reason: isErrorWithStatusCode(error) && error.statusCode < 500
          ? 'ADD_TO_LIBRARY_REJECTED'
          : 'ADD_TO_LIBRARY_UNAVAILABLE',
      };
    }
  }
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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) &&
    value.every(item => typeof item === 'string');
}
