import type { WorkspaceManagerService } from '~/legacy/modules/video/storage/types/workspace-manager.types';
import type { VideoRepository } from '~/legacy/repositories/interfaces/VideoRepository';
import type { LibraryVideoArtifactRemovalPort } from '~/modules/library/application/ports/library-video-artifact-removal.port';
import type {
  LibraryVideoMutationPort,
  UpdateLibraryVideoInput,
} from '~/modules/library/application/ports/library-video-mutation.port';
import type { LibraryVideo } from '~/modules/library/domain/library-video';
import { workspaceManagerService } from '~/legacy/modules/video/storage/services/WorkspaceManagerService';
import { getVideoRepository } from '~/legacy/repositories';

interface LibraryLegacyVideoMutationDependencies {
  videoRepository: VideoRepository;
  workspaceManager: WorkspaceManagerService;
}

function mapLegacyVideoToLibraryVideo(video: Awaited<ReturnType<VideoRepository['findById']>> extends infer T ? Exclude<T, null> : never): LibraryVideo {
  return {
    createdAt: video.createdAt,
    description: video.description,
    duration: video.duration,
    id: video.id,
    tags: [...video.tags],
    thumbnailUrl: video.thumbnailUrl,
    title: video.title,
    videoUrl: video.videoUrl,
  };
}

export function createLibraryLegacyVideoMutationPort(
  overrides: Partial<LibraryLegacyVideoMutationDependencies> = {},
): LibraryVideoMutationPort {
  const videoRepository = overrides.videoRepository ?? getVideoRepository();

  return {
    async deleteLibraryVideo({ videoId }) {
      const existingVideo = await videoRepository.findById(videoId);

      if (!existingVideo) {
        return { deleted: false };
      }

      const deleted = await videoRepository.delete(videoId);

      if (!deleted) {
        return { deleted: false, title: existingVideo.title };
      }

      return {
        deleted: true,
        title: existingVideo.title,
      };
    },

    async findLibraryVideoById(videoId) {
      const video = await videoRepository.findById(videoId);
      return video ? mapLegacyVideoToLibraryVideo(video) : null;
    },

    async updateLibraryVideo(input: UpdateLibraryVideoInput) {
      const updatedVideo = await videoRepository.update(input.videoId, {
        description: input.description,
        tags: input.tags,
        title: input.title,
      });

      return updatedVideo ? mapLegacyVideoToLibraryVideo(updatedVideo) : null;
    },
  };
}

export function createLibraryLegacyVideoArtifactRemovalPort(
  overrides: Partial<LibraryLegacyVideoMutationDependencies> = {},
): LibraryVideoArtifactRemovalPort {
  const workspaceManager = overrides.workspaceManager ?? workspaceManagerService;

  return {
    async cleanupVideoArtifacts({ videoId }: { videoId: string }) {
      try {
        await workspaceManager.cleanupWorkspace(videoId);
        return {};
      }
      catch (error) {
        console.error(`Failed to clean up video workspace for ${videoId}`, error);
        return {
          warning: 'Video files could not be fully removed',
        };
      }
    },
  };
}
