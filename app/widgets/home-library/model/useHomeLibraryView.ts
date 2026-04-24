import { useEffect, useMemo, useRef, useState } from 'react';
import type { HomeLibraryVideo } from '~/entities/library-video/model/library-video';
import type { HomeLibraryModalState } from '~/features/home-quick-view/ui/HomeQuickViewDialog';
import { type HomeLibraryVideoActions, useHomeLibraryVideoActions } from '~/features/home-library-video-actions/model/useHomeLibraryVideoActions';
import { doesLibraryVideoMatchHomeFilters } from '~/modules/library/domain/library-home-filters';
import {
  type HomeLibraryFilters,
  areHomeLibraryFiltersEqual,
  createHomeLibraryFilters,
  toLibraryHomeFilters,
} from './home-library-filters';

interface UseHomeLibraryViewOptions {
  initialVideos: HomeLibraryVideo[];
  initialFilters?: Partial<HomeLibraryFilters>;
  videoActions?: HomeLibraryVideoActions;
}

interface UpdateVideoPayload {
  contentTypeSlug?: string | null;
  title: string;
  tags: string[];
  genreSlugs: string[];
  description?: string;
}

function areVideoSnapshotsEqual(a: HomeLibraryVideo[], b: HomeLibraryVideo[]) {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((video, index) => {
    const other = b[index];

    return video.id === other.id &&
      video.title === other.title &&
      video.videoUrl === other.videoUrl &&
      video.thumbnailUrl === other.thumbnailUrl &&
      video.duration === other.duration &&
      video.description === other.description &&
      video.contentTypeSlug === other.contentTypeSlug &&
      video.createdAt.getTime() === other.createdAt.getTime() &&
      (video.genreSlugs ?? []).length === (other.genreSlugs ?? []).length &&
      (video.genreSlugs ?? []).every((genreSlug, genreIndex) => genreSlug === (other.genreSlugs ?? [])[genreIndex]) &&
      video.tags.length === other.tags.length &&
      video.tags.every((tag, tagIndex) => tag === other.tags[tagIndex]);
  });
}

function createClosedModalState(): HomeLibraryModalState {
  return {
    video: null,
    isOpen: false,
  };
}

function syncModalStateAfterCanonicalVideoUpdate(
  modalState: HomeLibraryModalState,
  updatedVideo: HomeLibraryVideo,
): HomeLibraryModalState {
  if (modalState.video?.id !== updatedVideo.id) {
    return modalState;
  }

  return {
    isOpen: true,
    video: updatedVideo,
  };
}

export function useHomeLibraryView({
  initialVideos,
  initialFilters,
  videoActions,
}: UseHomeLibraryViewOptions) {
  const defaultVideoActions = useHomeLibraryVideoActions();
  const actions = videoActions ?? defaultVideoActions;
  const previousInitialFiltersRef = useRef<HomeLibraryFilters>(createHomeLibraryFilters(initialFilters));
  const previousInitialVideosRef = useRef<HomeLibraryVideo[]>(initialVideos);
  const [videos, setVideos] = useState<HomeLibraryVideo[]>(initialVideos);
  const [searchFilters, setSearchFilters] = useState<HomeLibraryFilters>(() => createHomeLibraryFilters(initialFilters));
  const [modalState, setModalState] = useState<HomeLibraryModalState>(createClosedModalState);

  const filteredVideos = useMemo(() => {
    const domainFilters = toLibraryHomeFilters(searchFilters);

    return videos.filter(video => doesLibraryVideoMatchHomeFilters(video, domainFilters));
  }, [searchFilters, videos]);

  const replaceSearchFilters = (nextFilters: HomeLibraryFilters) => {
    setSearchFilters(prevFilters => (areHomeLibraryFiltersEqual(prevFilters, nextFilters) ? prevFilters : nextFilters));
  };

  const handleQuickView = (video: HomeLibraryVideo) => {
    setModalState({
      video,
      isOpen: true,
    });
  };

  const handleCloseModal = () => {
    setModalState(createClosedModalState());
  };

  const handleDeleteVideo = async (videoId: string) => {
    await actions.deleteVideo(videoId);
    setVideos(prev => prev.filter(video => video.id !== videoId));
    setModalState(prev => (prev.video?.id === videoId ? createClosedModalState() : prev));
  };

  const handleUpdateVideo = async (videoId: string, updates: UpdateVideoPayload) => {
    const updatedVideo = await actions.updateVideo(videoId, updates);
    setVideos(prev => prev.map(video => (video.id === videoId ? updatedVideo : video)));
    setModalState(prev => syncModalStateAfterCanonicalVideoUpdate(prev, updatedVideo));
  };

  useEffect(() => {
    if (areVideoSnapshotsEqual(previousInitialVideosRef.current, initialVideos)) {
      return;
    }

    previousInitialVideosRef.current = initialVideos;
    setVideos(initialVideos);
  }, [initialVideos]);

  useEffect(() => {
    const nextFilters = createHomeLibraryFilters(initialFilters);

    if (areHomeLibraryFiltersEqual(previousInitialFiltersRef.current, nextFilters)) {
      return;
    }

    previousInitialFiltersRef.current = nextFilters;
    setSearchFilters(prevFilters => (areHomeLibraryFiltersEqual(prevFilters, nextFilters) ? prevFilters : nextFilters));
  }, [initialFilters]);

  return {
    videos: filteredVideos,
    totalVideosCount: videos.length,
    searchFilters,
    modalState,
    replaceSearchFilters,
    handleQuickView,
    handleCloseModal,
    handleDeleteVideo,
    handleUpdateVideo,
  };
}
