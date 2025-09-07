import { useState } from 'react';
import { useLoaderData } from 'react-router';
import type { PendingVideo, Video } from '~/types/video';
import { AppLayout } from '~/components/AppLayout';
import { TagFilter } from '~/components/TagFilter';
import { VideoGrid } from '~/components/VideoGrid';
import { VideoModal } from '~/components/VideoModal';
import { useVideoLibrary } from '~/hooks/useVideoLibrary';
import { getPendingVideoRepository, getVideoRepository } from '~/repositories';
import { requireAuth } from '~/utils/auth.server';
import type { Route } from './+types/home';

export async function loader({ request }: Route.LoaderArgs) {
  // Server-side authentication check
  await requireAuth(request);

  const [videos, pendingVideos] = await Promise.all([
    getVideoRepository().findAll(),
    getPendingVideoRepository().findAll(),
  ]);

  return {
    videos,
    pendingVideos,
  };
}

export function meta() {
  return [
    { title: 'Local Streamer - My Library' },
    { name: 'description', content: 'Personal video library' },
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
    deleteVideo,
    totalVideos,
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

  const handleUpdateVideo = async (videoId: string, updates: { title: string; tags: string[]; description?: string }) => {
    try {
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

      // Reload the page to refresh data
      window.location.reload();
    }
    catch (error) {
      console.error('Failed to update video:', error);
      throw error;
    }
  };

  return (
    <AppLayout
      searchQuery={searchFilters.query}
      onSearchChange={updateSearchQuery}
      pendingCount={pendingVideos.length}
    >
      {/* Main content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">My Library</h1>
          <p className="text-muted-foreground">
            Total {totalVideos} videos • Showing {videos.length}
          </p>
        </div>

        {/* Tag filter */}
        <TagFilter
          activeTags={searchFilters.tags}
          onTagRemove={toggleTagFilter}
          onClearAll={clearTagFilters}
        />

        {/* Video grid */}
        <div className="mt-6">
          <VideoGrid
            videos={videos}
            onQuickView={handleQuickView}
            onTagClick={handleTagClick}
          />
        </div>

        {/* Video modal */}
        <VideoModal
          video={selectedVideo}
          isOpen={isVideoModalOpen}
          onClose={handleCloseVideoModal}
          onTagClick={handleTagClick}
          onDelete={deleteVideo}
          onUpdate={handleUpdateVideo}
        />
      </div>
    </AppLayout>
  );
}
