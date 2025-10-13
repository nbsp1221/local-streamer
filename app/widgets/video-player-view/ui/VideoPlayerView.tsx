import { ArrowLeft, ChevronDown, ChevronUp, Download, PlusCircle, Share2, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import type { Video } from '~/types/video';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible';
import { VidstackPlayer } from '~/entities/video/ui/VidstackPlayer';
import { AddToPlaylistPanel } from '~/features/playlist/add-to-playlist/ui/AddToPlaylistPanel';
import { RelatedVideos } from '~/widgets/related-videos/ui/RelatedVideos';
import { useVideoPlayerView } from '../model/useVideoPlayerView';

interface VideoPlayerViewProps {
  video: Video;
  relatedVideos: Video[];
}

export function VideoPlayerView({ video, relatedVideos }: VideoPlayerViewProps) {
  const {
    durationLabel,
    createdAtLabel,
    tagItems,
    relatedVideos: filteredRelatedVideos,
    hasTagFilter,
    toggleTagFilter,
    clearTagFilter,
  } = useVideoPlayerView({ video, relatedVideos });

  const [isPlaylistSectionOpen, setIsPlaylistSectionOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Library
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2 space-y-4 lg:space-y-6">
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <VidstackPlayer video={video} />
            </div>

            <div className="space-y-3 lg:space-y-4">
              <h1 className="text-xl lg:text-2xl font-bold leading-tight">
                {video.title}
              </h1>

              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium">Duration:</span>
                <span>{durationLabel}</span>
                <span className="hidden sm:inline">•</span>
                <span className="font-medium">Added:</span>
                <span>{createdAtLabel}</span>
              </div>

              <Collapsible
                open={isPlaylistSectionOpen}
                onOpenChange={setIsPlaylistSectionOpen}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <CollapsibleTrigger asChild>
                    <Button variant="secondary" size="sm" className="gap-2">
                      <PlusCircle className="h-4 w-4" />
                      Save to playlist
                      {isPlaylistSectionOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Share2 className="h-4 w-4" />
                    Share
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </div>

                <CollapsibleContent className="mt-3">
                  {isPlaylistSectionOpen ? (
                    <AddToPlaylistPanel video={video} open={isPlaylistSectionOpen} />
                  ) : null}
                </CollapsibleContent>
              </Collapsible>

              {video.description && (
                <div className="space-y-2">
                  <h3 className="text-sm lg:text-base font-semibold">Description</h3>
                  <p className="text-sm lg:text-base text-muted-foreground leading-relaxed">
                    {video.description}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm lg:text-base font-semibold mb-1">Tags</h3>
                  {hasTagFilter && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={clearTagFilter}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Clear filter
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 lg:gap-2">
                  {tagItems.map(tag => (
                    <Badge
                      key={tag.value}
                      variant={tag.isActive ? 'default' : 'secondary'}
                      className="text-xs lg:text-sm cursor-pointer transition-colors"
                      onClick={() => toggleTagFilter(tag.value)}
                    >
                      #{tag.value}
                    </Badge>
                  ))}
                  {tagItems.length === 0 && (
                    <span className="text-xs text-muted-foreground">No tags</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <RelatedVideos
              videos={filteredRelatedVideos}
              onTagClick={toggleTagFilter}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
