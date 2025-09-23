import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { ArrowLeft, Download, Share2 } from 'lucide-react';
import { Link, useLoaderData, useParams } from 'react-router';
import { RelatedVideos } from '~/components/RelatedVideos';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { VidstackPlayer } from '~/components/VidstackPlayer';
import { useVideoLibrary } from '~/hooks/useVideoLibrary';
import { getVideoRepository } from '~/repositories';
import { requireAuth } from '~/utils/auth.server';
export async function loader({ request, params }: LoaderFunctionArgs) {
  // Server-side authentication check
  await requireAuth(request);

  const videos = await getVideoRepository().findAll();
  return { videos };
}

export const meta: MetaFunction = () => ([
  { title: 'Video Player - Local Streamer' },
  { name: 'description', content: 'Local video streaming' },
]);

export default function Player() {
  const { id } = useParams();
  const { videos: initialVideos } = useLoaderData<typeof loader>();
  const { videos, toggleTagFilter } = useVideoLibrary(initialVideos);

  // Find current video
  const currentVideo = videos.find(video => video.id === id);

  // Related videos (same tags, excluding current video)
  const relatedVideos = videos
    .filter(video => video.id !== id &&
      video.tags.some(tag => currentVideo?.tags.includes(tag)))
    .slice(0, 10);

  if (!currentVideo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Video not found</h1>
          <Link to="/">
            <Button>Back to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleTagClick = (tag: string) => {
    toggleTagFilter(tag);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top navigation */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Library
              </Button>
            </Link>
            <div className="flex-1" />
            <Button variant="ghost" size="sm">
              <Share2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Player and info area */}
          <div className="lg:col-span-2 space-y-4 lg:space-y-6">
            {/* Video player */}
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <VidstackPlayer video={currentVideo} />
            </div>

            {/* Video info */}
            <div className="space-y-3 lg:space-y-4">
              <h1 className="text-xl lg:text-2xl font-bold leading-tight">
                {currentVideo.title}
              </h1>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 lg:gap-2">
                {currentVideo.tags.map(tag => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-xs lg:text-sm cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={() => handleTagClick(tag)}
                  >
                    #{tag}
                  </Badge>
                ))}
              </div>

              {/* Description */}
              {currentVideo.description && (
                <div className="space-y-2">
                  <h3 className="text-sm lg:text-base font-semibold">Description</h3>
                  <p className="text-sm lg:text-base text-muted-foreground leading-relaxed">
                    {currentVideo.description}
                  </p>
                </div>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-4 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium">Duration:</span>
                  <span className="ml-2">
                    {Math.floor(currentVideo.duration / 60)}:
                    {(currentVideo.duration % 60).toString().padStart(2, '0')}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Added:</span>
                  <span className="ml-2">
                    {currentVideo.createdAt.toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Related videos sidebar */}
          <div className="lg:col-span-1">
            <RelatedVideos videos={relatedVideos} onTagClick={handleTagClick} />
          </div>
        </div>
      </div>
    </div>
  );
}
