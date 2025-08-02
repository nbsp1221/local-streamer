import { useState } from "react";
import { useLoaderData } from "react-router";
import type { Route } from "./+types/home";
import { NavBar } from "~/components/NavBar";
import { VideoGrid } from "~/components/VideoGrid";
import { VideoModal } from "~/components/VideoModal";
import { TagFilter } from "~/components/TagFilter";
import { useVideoLibrary } from "~/hooks/useVideoLibrary";
import { getVideos, getPendingVideos } from "~/services/video-store.server";
import type { Video, PendingVideo } from "~/types/video";

export async function loader({}: Route.LoaderArgs) {
  const [videos, pendingVideos] = await Promise.all([
    getVideos(),
    getPendingVideos()
  ]);
  
  return {
    videos,
    pendingVideos
  };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Local Streamer - 내 라이브러리" },
    { name: "description", content: "개인 비디오 라이브러리" },
  ];
}

export default function Home() {
  const { videos: initialVideos, pendingVideos: initialPendingVideos } = useLoaderData<typeof loader>();
  
  const {
    videos,
    pendingVideos,
    searchFilters,
    updateSearchQuery,
    toggleTagFilter,
    clearTagFilters,
    totalVideos
  } = useVideoLibrary(initialVideos, initialPendingVideos);

  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  const handleQuickView = (video: Video) => {
    setSelectedVideo(video);
    setIsVideoModalOpen(true);
  };

  const handleTagClick = (tag: string) => {
    toggleTagFilter(tag);
  };

  const handleCloseVideoModal = () => {
    setIsVideoModalOpen(false);
    setSelectedVideo(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 네비게이션 바 */}
      <NavBar
        searchQuery={searchFilters.query}
        onSearchChange={updateSearchQuery}
        pendingCount={pendingVideos.length}
      />

      {/* 메인 컨텐츠 */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">내 라이브러리</h1>
          <p className="text-muted-foreground">
            총 {totalVideos}개의 비디오 • {videos.length}개 표시 중
          </p>
        </div>

        {/* 태그 필터 */}
        <TagFilter
          activeTags={searchFilters.tags}
          onTagRemove={toggleTagFilter}
          onClearAll={clearTagFilters}
        />

        {/* 비디오 그리드 */}
        <div className="mt-6">
          <VideoGrid 
            videos={videos}
            onQuickView={handleQuickView}
            onTagClick={handleTagClick}
          />
        </div>

        {/* 비디오 모달 */}
        <VideoModal
          video={selectedVideo}
          isOpen={isVideoModalOpen}
          onClose={handleCloseVideoModal}
          onTagClick={handleTagClick}
        />
      </main>
    </div>
  );
}