import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PendingVideo, SearchFilters, Video } from '~/types/video';

interface UseLibraryViewOptions {
  initialVideos: Video[];
  initialPendingVideos: PendingVideo[];
  initialFilters?: SearchFilters;
}

interface UpdatePayload {
  title: string;
  tags: string[];
  description?: string;
}

export interface ModalState {
  video: Video | null;
  isOpen: boolean;
}

export interface UseLibraryViewResult {
  videos: Video[];
  totalVideosCount: number;
  pendingVideos: PendingVideo[];
  searchFilters: SearchFilters;
  modalState: ModalState;
  addToPlaylistState: ModalState;
  handleSearchChange: (query: string) => void;
  handleTagToggle: (tag: string) => void;
  handleClearTags: () => void;
  handleQuickView: (video: Video) => void;
  handleCloseModal: () => void;
  handleDeleteVideo: (videoId: string) => Promise<void>;
  handleUpdateVideo: (videoId: string, updates: UpdatePayload) => Promise<void>;
  handleAddToPlaylist: (video: Video) => void;
  handleCloseAddToPlaylist: () => void;
}

function createInitialFilters(initialFilters?: SearchFilters): SearchFilters {
  return {
    query: initialFilters?.query ?? '',
    tags: initialFilters?.tags ?? [],
  };
}

function areFiltersEqual(a: SearchFilters, b: SearchFilters) {
  const normalizeQuery = (value: string) => value.trim().toLowerCase();
  const normalizeTags = (tags: string[]) => [...tags].map(tag => tag.toLowerCase()).sort();

  if (normalizeQuery(a.query) !== normalizeQuery(b.query)) {
    return false;
  }

  const aTags = normalizeTags(a.tags);
  const bTags = normalizeTags(b.tags);

  if (aTags.length !== bTags.length) {
    return false;
  }

  return aTags.every((tag, index) => tag === bTags[index]);
}

export function useLibraryView({
  initialVideos,
  initialPendingVideos,
  initialFilters,
}: UseLibraryViewOptions): UseLibraryViewResult {
  const [videos, setVideos] = useState<Video[]>(initialVideos);
  const [pendingVideos, setPendingVideos] = useState<PendingVideo[]>(initialPendingVideos);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(() => createInitialFilters(initialFilters));
  const [modalState, setModalState] = useState<ModalState>({
    video: null,
    isOpen: false,
  });
  const [addToPlaylistState, setAddToPlaylistState] = useState<ModalState>({
    video: null,
    isOpen: false,
  });

  const filteredVideos = useMemo(() => {
    const normalizedQuery = searchFilters.query.trim().toLowerCase();

    return videos.filter((video) => {
      const matchesQuery = !normalizedQuery ||
        video.title.toLowerCase().includes(normalizedQuery) ||
        video.tags.some(tag => tag.toLowerCase().includes(normalizedQuery));

      const matchesTags = searchFilters.tags.length === 0 ||
        searchFilters.tags.every(filterTag => video.tags.some(videoTag => videoTag.toLowerCase() === filterTag.toLowerCase()));

      return matchesQuery && matchesTags;
    });
  }, [videos, searchFilters]);

  const handleSearchChange = useCallback((query: string) => {
    setSearchFilters(prev => ({ ...prev, query }));
  }, []);

  const handleTagToggle = useCallback((tag: string) => {
    setSearchFilters(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(existing => existing !== tag)
        : [...prev.tags, tag],
    }));
  }, []);

  const handleClearTags = useCallback(() => {
    setSearchFilters(prev => ({ ...prev, tags: [] }));
  }, []);

  const handleQuickView = useCallback((video: Video) => {
    setModalState({ video, isOpen: true });
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalState({ video: null, isOpen: false });
  }, []);

  const handleAddToPlaylist = useCallback((video: Video) => {
    setAddToPlaylistState({ video, isOpen: true });
  }, []);

  const handleCloseAddToPlaylist = useCallback(() => {
    setAddToPlaylistState({ video: null, isOpen: false });
  }, []);

  const handleDeleteVideo = useCallback(async (videoId: string) => {
    const response = await fetch(`/api/delete/${videoId}`, {
      method: 'DELETE',
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to delete video');
    }

    setVideos(prev => prev.filter(video => video.id !== videoId));

    if (modalState.video?.id === videoId) {
      setModalState({ video: null, isOpen: false });
    }
  }, [modalState.video?.id]);

  const handleUpdateVideo = useCallback(async (videoId: string, updates: UpdatePayload) => {
    const response = await fetch(`/api/update/${videoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to update video');
    }

    setVideos(prev => prev.map(video => (video.id === videoId ? { ...video, ...updates } : video)));

    if (modalState.video?.id === videoId) {
      setModalState({
        video: { ...modalState.video, ...updates },
        isOpen: true,
      });
    }
  }, [modalState.video]);

  useEffect(() => {
    setVideos(initialVideos);
  }, [initialVideos]);

  useEffect(() => {
    setPendingVideos(initialPendingVideos);
  }, [initialPendingVideos]);

  useEffect(() => {
    const nextFilters = createInitialFilters(initialFilters);

    setSearchFilters(prevFilters => (
      areFiltersEqual(prevFilters, nextFilters)
        ? prevFilters
        : nextFilters
    ));
  }, [initialFilters, initialVideos, initialPendingVideos]);

  return {
    videos: filteredVideos,
    totalVideosCount: videos.length,
    pendingVideos,
    searchFilters,
    modalState,
    addToPlaylistState,
    handleSearchChange,
    handleTagToggle,
    handleClearTags,
    handleQuickView,
    handleCloseModal,
    handleDeleteVideo,
    handleUpdateVideo,
    handleAddToPlaylist,
    handleCloseAddToPlaylist,
  };
}
