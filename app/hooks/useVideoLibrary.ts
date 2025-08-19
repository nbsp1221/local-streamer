import { useMemo, useState } from 'react';
import type { PendingVideo, SearchFilters, Video } from '~/types/video';

export function useVideoLibrary(initialVideos: Video[] = [], initialPendingVideos: PendingVideo[] = []) {
  const [videos, setVideos] = useState<Video[]>(initialVideos);
  const [pendingVideos, setPendingVideos] = useState<PendingVideo[]>(initialPendingVideos);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    query: '',
    tags: [],
  });

  // Filtered video list
  const filteredVideos = useMemo(() => {
    return videos.filter((video) => {
      // Query filtering
      const matchesQuery = !searchFilters.query ||
        video.title.toLowerCase().includes(searchFilters.query.toLowerCase()) ||
        video.tags.some(tag => tag.toLowerCase().includes(searchFilters.query.toLowerCase()));

      // Tag filtering
      const matchesTags = searchFilters.tags.length === 0 ||
        searchFilters.tags.every(filterTag => video.tags.some(videoTag => videoTag.toLowerCase() === filterTag.toLowerCase()));

      return matchesQuery && matchesTags;
    });
  }, [videos, searchFilters]);

  // Update search query
  const updateSearchQuery = (query: string) => {
    setSearchFilters(prev => ({ ...prev, query }));
  };

  // Toggle tag filter
  const toggleTagFilter = (tag: string) => {
    setSearchFilters(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  // Clear tag filters
  const clearTagFilters = () => {
    setSearchFilters(prev => ({ ...prev, tags: [] }));
  };

  // Add video (dummy implementation)
  const addVideo = (pendingVideo: PendingVideo, metadata: { title: string; tags: string[] }) => {
    const newVideo: Video = {
      id: crypto.randomUUID(),
      title: metadata.title,
      tags: metadata.tags,
      thumbnailUrl: `https://images.unsplash.com/photo-${Math.floor(Math.random() * 1000000000)}?w=600&h=400&fit=crop`,
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      duration: Math.floor(Math.random() * 3600) + 300, // 5-65 minutes random
      addedAt: new Date(),
      description: `Description for ${metadata.title}`,
      format: 'mp4',
    };

    setVideos(prev => [newVideo, ...prev]);
    setPendingVideos(prev => prev.filter(pv => pv.filename !== pendingVideo.filename));
  };

  // Find video
  const findVideoById = (id: string): Video | undefined => {
    return videos.find(video => video.id === id);
  };

  // Delete video
  const deleteVideo = async (videoId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/delete/${videoId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete video');
      }

      // Remove from local state on successful deletion
      setVideos(prev => prev.filter(video => video.id !== videoId));

      console.log(`Video deleted successfully: ${result.title} (${videoId})`);
    }
    catch (error) {
      console.error('Failed to delete video:', error);
      throw error; // Re-throw to allow UI to handle error
    }
  };

  return {
    videos: filteredVideos,
    pendingVideos,
    searchFilters,
    updateSearchQuery,
    toggleTagFilter,
    clearTagFilters,
    addVideo,
    findVideoById,
    deleteVideo,
    totalVideos: videos.length,
  };
}
