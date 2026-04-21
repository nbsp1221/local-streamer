import { useEffect, useMemo, useRef, useState } from 'react';
import type { HomeLibraryVideo } from '~/entities/library-video/model/library-video';
import type { HomeLibraryModalState } from '~/features/home-quick-view/ui/HomeQuickViewDialog';
import { type HomeLibraryVideoActions, useHomeLibraryVideoActions } from '~/features/home-library-video-actions/model/useHomeLibraryVideoActions';
import {
  type HomeLibraryFilters,
  areHomeLibraryFiltersEqual,
  createHomeLibraryFilters,
  normalizeHomeLibraryQuery,
  toggleHomeLibraryTag,
} from './home-library-filters';

interface UseHomeLibraryViewOptions {
  initialVideos: HomeLibraryVideo[];
  initialFilters?: HomeLibraryFilters;
  videoActions?: HomeLibraryVideoActions;
}

interface UpdateVideoPayload {
  title: string;
  tags: string[];
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
      video.createdAt.getTime() === other.createdAt.getTime() &&
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

function matchesSearchFilters(video: HomeLibraryVideo, searchFilters: HomeLibraryFilters) {
  const normalizedQuery = normalizeHomeLibraryQuery(searchFilters.query);
  const matchesQuery = !normalizedQuery ||
    video.title.toLowerCase().includes(normalizedQuery) ||
    video.tags.some(tag => tag.toLowerCase().includes(normalizedQuery));
  const matchesTags = searchFilters.tags.length === 0 ||
    searchFilters.tags.every(filterTag => video.tags.some(videoTag => videoTag.toLowerCase() === filterTag.toLowerCase()));

  return matchesQuery && matchesTags;
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
    return videos.filter(video => matchesSearchFilters(video, searchFilters));
  }, [searchFilters, videos]);

  const handleSearchChange = (query: string) => {
    setSearchFilters(prev => ({ ...prev, query }));
  };

  const handleTagToggle = (tag: string) => {
    setSearchFilters(prev => ({
      ...prev,
      tags: toggleHomeLibraryTag(prev.tags, tag),
    }));
  };

  const handleClearTags = () => {
    setSearchFilters(prev => ({ ...prev, tags: [] }));
  };

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
    handleSearchChange,
    handleTagToggle,
    handleClearTags,
    handleQuickView,
    handleCloseModal,
    handleDeleteVideo,
    handleUpdateVideo,
  };
}
