import { Clock, Film, Play } from 'lucide-react';
import type { PlaylistWithVideos } from '~/modules/playlist/domain/playlist.types';
import { AspectRatio } from '~/components/ui/aspect-ratio';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Separator } from '~/components/ui/separator';
import { formatDuration } from '~/lib/utils';

interface PlaylistVideoListProps {
  playlist: PlaylistWithVideos;
  onVideoSelect: (videoId: string) => void;
  videoPagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  } | null;
}

export function PlaylistVideoList({
  playlist,
  onVideoSelect,
  videoPagination,
}: PlaylistVideoListProps) {
  const hasVideos = playlist.videos.length > 0;

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-xl font-semibold">Playlist Videos</CardTitle>
          <p className="text-sm text-muted-foreground">
            {playlist.videos.length} of {videoPagination?.total ?? playlist.videos.length} videos • Ordered play
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="gap-1 rounded-full px-3 py-1 text-xs font-medium uppercase">
            <Clock className="h-3.5 w-3.5" />
            {' '}
            {totalPlaylistDuration(playlist)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasVideos ? (
          <div className="space-y-2">
            {playlist.videos.map(video => (
              <div
                key={video.id}
                className="group flex items-stretch gap-4 rounded-xl border border-border/40 bg-card/60 p-3 transition hover:border-primary/40 hover:bg-card"
              >
                <div className="flex w-10 items-center justify-center">
                  <Badge variant="outline" className="rounded-full px-0 py-0 text-xs font-semibold">
                    #{video.position}
                  </Badge>
                </div>
                <div className="relative h-20 w-36 overflow-hidden rounded-lg bg-muted">
                  <AspectRatio ratio={16 / 9} className="h-full w-full overflow-hidden">
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground">
                        <Film className="h-4 w-4" />
                        No art
                      </div>
                    )}
                  </AspectRatio>
                  <span className="absolute bottom-2 right-2 rounded-full bg-black/75 px-2 py-0.5 text-[10px] font-semibold text-white">
                    {formatDuration(video.duration)}
                  </span>
                </div>
                <div className="flex flex-1 flex-col justify-between gap-2 md:flex-row md:items-center">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold md:text-base">{video.title}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {video.episodeMetadata?.episodeTitle && (
                        <span>{video.episodeMetadata.episodeTitle}</span>
                      )}
                      {video.episodeMetadata?.episodeNumber && (
                        <span>Episode {video.episodeMetadata.episodeNumber}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start md:self-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="gap-2 rounded-full"
                      onClick={() => onVideoSelect(video.id)}
                    >
                      <Play className="h-4 w-4" />
                      Play
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-border/60 bg-muted/20 px-8 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Play className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">No videos yet</h3>
              <p className="text-sm text-muted-foreground">
                Start building this playlist by adding videos from your library.
              </p>
            </div>
          </div>
        )}

        {hasVideos && <Separator />}

        {hasVideos && videoPagination?.hasMore && (
          <div className="flex justify-center">
            <Button variant="outline" size="sm" disabled>
              Load more (coming soon)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function totalPlaylistDuration(playlist: PlaylistWithVideos) {
  const total = playlist.videos.reduce((acc, video) => acc + (video.duration ?? 0), 0);
  return formatDuration(total);
}
