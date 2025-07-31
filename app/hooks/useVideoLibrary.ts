import { useState, useMemo } from 'react';
import type { Video, PendingVideo, SearchFilters } from '~/types/video';
import { mockVideos, mockPendingVideos } from '~/data/mockData';

export function useVideoLibrary() {
  const [videos, setVideos] = useState<Video[]>(mockVideos);
  const [pendingVideos, setPendingVideos] = useState<PendingVideo[]>(mockPendingVideos);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    query: '',
    tags: []
  });

  // 필터링된 비디오 목록
  const filteredVideos = useMemo(() => {
    return videos.filter(video => {
      // 검색어 필터링
      const matchesQuery = !searchFilters.query || 
        video.title.toLowerCase().includes(searchFilters.query.toLowerCase()) ||
        video.tags.some(tag => tag.toLowerCase().includes(searchFilters.query.toLowerCase()));

      // 태그 필터링
      const matchesTags = searchFilters.tags.length === 0 ||
        searchFilters.tags.every(filterTag => 
          video.tags.some(videoTag => videoTag.toLowerCase() === filterTag.toLowerCase())
        );

      return matchesQuery && matchesTags;
    });
  }, [videos, searchFilters]);

  // 검색어 업데이트
  const updateSearchQuery = (query: string) => {
    setSearchFilters(prev => ({ ...prev, query }));
  };

  // 태그 필터 토글
  const toggleTagFilter = (tag: string) => {
    setSearchFilters(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  // 태그 필터 초기화
  const clearTagFilters = () => {
    setSearchFilters(prev => ({ ...prev, tags: [] }));
  };

  // 비디오 추가 (더미 구현)
  const addVideo = (pendingVideo: PendingVideo, metadata: { title: string; tags: string[] }) => {
    const newVideo: Video = {
      id: crypto.randomUUID(),
      title: metadata.title,
      tags: metadata.tags,
      thumbnailUrl: `https://images.unsplash.com/photo-${Math.floor(Math.random() * 1000000000)}?w=600&h=400&fit=crop`,
      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      duration: Math.floor(Math.random() * 3600) + 300, // 5분-65분 랜덤
      addedAt: new Date(),
      description: `${metadata.title}에 대한 설명`
    };

    setVideos(prev => [newVideo, ...prev]);
    setPendingVideos(prev => prev.filter(pv => pv.filename !== pendingVideo.filename));
  };

  // 비디오 찾기
  const findVideoById = (id: string): Video | undefined => {
    return videos.find(video => video.id === id);
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
    totalVideos: videos.length
  };
}