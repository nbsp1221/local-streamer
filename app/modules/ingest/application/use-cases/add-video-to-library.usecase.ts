import type {
  AddVideoToLibraryCommand,
  AddVideoToLibrarySuccessData,
  IngestLibraryIntakePort,
} from '../ports/ingest-library-intake.port';

type ErrorWithStatusCode = {
  statusCode: number;
};

interface AddVideoToLibraryUseCaseDependencies {
  libraryIntake: IngestLibraryIntakePort;
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
      const data = await this.deps.libraryIntake.addVideoToLibrary(command);

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

function isErrorWithStatusCode(error: unknown): error is ErrorWithStatusCode {
  return typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof error.statusCode === 'number';
}
