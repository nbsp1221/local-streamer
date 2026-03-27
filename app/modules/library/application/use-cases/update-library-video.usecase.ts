import type { LibraryVideo } from '../../domain/library-video';
import type { LibraryVideoMutationPort } from '../ports/library-video-mutation.port';

export interface UpdateLibraryVideoInput {
  description?: unknown;
  tags?: unknown;
  title?: unknown;
  videoId: string;
}

interface UpdateLibraryVideoSuccess {
  ok: true;
  data: {
    message: string;
    video: LibraryVideo;
  };
}

interface UpdateLibraryVideoFailure {
  ok: false;
  reason: 'INVALID_INPUT' | 'VIDEO_NOT_FOUND' | 'UPDATE_FAILED';
  message: string;
}

export type UpdateLibraryVideoUseCaseResult =
  | UpdateLibraryVideoSuccess
  | UpdateLibraryVideoFailure;

interface UpdateLibraryVideoUseCaseDependencies {
  videoMutation: LibraryVideoMutationPort;
}

function sanitizeTags(tags: unknown) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .filter(tag => typeof tag === 'string')
    .map(tag => tag.trim())
    .filter(Boolean);
}

function sanitizeDescription(description: unknown) {
  if (typeof description !== 'string') {
    return undefined;
  }

  const trimmed = description.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class UpdateLibraryVideoUseCase {
  constructor(
    private readonly deps: UpdateLibraryVideoUseCaseDependencies,
  ) {}

  async execute(input: UpdateLibraryVideoInput): Promise<UpdateLibraryVideoUseCaseResult> {
    const videoId = input.videoId.trim();
    const title = typeof input.title === 'string'
      ? input.title.trim()
      : '';

    if (videoId.length === 0) {
      return {
        message: 'Video ID is required',
        ok: false,
        reason: 'INVALID_INPUT',
      };
    }

    if (title.length === 0) {
      return {
        message: 'Title is required',
        ok: false,
        reason: 'INVALID_INPUT',
      };
    }

    const existingVideo = await this.deps.videoMutation.findLibraryVideoById(videoId);

    if (!existingVideo) {
      return {
        message: 'Video not found',
        ok: false,
        reason: 'VIDEO_NOT_FOUND',
      };
    }

    const updatedVideo = await this.deps.videoMutation.updateLibraryVideo({
      description: sanitizeDescription(input.description),
      tags: sanitizeTags(input.tags),
      title,
      videoId,
    });

    if (!updatedVideo) {
      return {
        message: 'Failed to update video',
        ok: false,
        reason: 'UPDATE_FAILED',
      };
    }

    return {
      data: {
        message: `Video "${updatedVideo.title}" updated successfully`,
        video: updatedVideo,
      },
      ok: true,
    };
  }
}
