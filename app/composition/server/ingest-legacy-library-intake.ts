import type { AddVideoDependencies } from '~/legacy/modules/video/add-video/add-video.types';
import type {
  AddVideoToLibraryCommand,
  IngestLibraryIntakePort,
} from '~/modules/ingest/application/ports/ingest-library-intake.port';
import { AddVideoUseCase } from '~/legacy/modules/video/add-video/add-video.usecase';
import { FFprobeAnalysisService } from '~/legacy/modules/video/analysis/ffprobe-analysis.service';
import { workspaceManagerService } from '~/legacy/modules/video/storage/services/WorkspaceManagerService';
import { FFmpegVideoTranscoderAdapter } from '~/legacy/modules/video/transcoding';
import { getVideoRepository } from '~/legacy/repositories';

type AddVideoUseCaseLike = Pick<AddVideoUseCase, 'execute'>;

type IngestLegacyLibraryIntakeDependencies = Partial<AddVideoDependencies> & {
  createAddVideoUseCase?: (deps: AddVideoDependencies) => AddVideoUseCaseLike;
};

function createAddVideoDependencies(
  overrides: IngestLegacyLibraryIntakeDependencies,
): AddVideoDependencies {
  return {
    logger: overrides.logger ?? console,
    videoAnalysis: overrides.videoAnalysis ?? new FFprobeAnalysisService(),
    videoRepository: overrides.videoRepository ?? getVideoRepository(),
    videoTranscoder: overrides.videoTranscoder ?? new FFmpegVideoTranscoderAdapter(),
    workspaceManager: overrides.workspaceManager ?? workspaceManagerService,
  };
}

export function createIngestLegacyLibraryIntake(
  overrides: IngestLegacyLibraryIntakeDependencies = {},
): IngestLibraryIntakePort {
  const deps = createAddVideoDependencies(overrides);
  const createAddVideoUseCase = overrides.createAddVideoUseCase ??
    (resolvedDeps => new AddVideoUseCase(resolvedDeps));

  return {
    async addVideoToLibrary(command: AddVideoToLibraryCommand) {
      const useCase = createAddVideoUseCase(deps);
      const result = await useCase.execute({
        description: command.description,
        encodingOptions: command.encodingOptions,
        filename: command.filename,
        tags: command.tags,
        title: command.title,
      });

      if (!result.success) {
        throw result.error;
      }

      return {
        dashEnabled: result.data.dashEnabled,
        message: result.data.message,
        videoId: result.data.videoId,
      };
    },
  };
}
