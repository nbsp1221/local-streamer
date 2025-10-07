import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { AlertTriangle, FileWarning, Lock } from 'lucide-react';
import { isRouteErrorResponse, useLoaderData, useRouteError } from 'react-router';
import type { PlaylistStats, PlaylistWithVideos } from '~/modules/playlist/domain/playlist.types';
import { RouteErrorView } from '~/components/RouteErrorView';
import { PlaylistDetailPage } from '~/pages/playlist-detail/ui/PlaylistDetailPage';

function parsePlaylist(data: any): PlaylistWithVideos {
  return {
    ...data,
    createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
    updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
    videos: Array.isArray(data.videos)
      ? data.videos.map((video: any) => ({
          ...video,
        }))
      : [],
    stats: data.stats ?? undefined,
  };
}

function parseStats(data: any): PlaylistStats | null {
  if (!data) return null;
  return {
    ...data,
    lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : new Date(),
  };
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const playlistId = params.id;

  if (!playlistId) {
    throw new Response('Playlist ID is required', { status: 400 });
  }

  const url = new URL(request.url);
  const apiUrl = new URL(`/api/playlists/${playlistId}`, url.origin);
  apiUrl.searchParams.set('includeVideos', 'true');
  apiUrl.searchParams.set('includeStats', 'true');

  const response = await fetch(apiUrl.toString(), {
    headers: {
      cookie: request.headers.get('cookie') ?? '',
    },
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    const status = response.status === 200 ? 500 : response.status;
    const message = data?.error || 'Failed to load playlist';
    throw new Response(message, { status });
  }

  return {
    playlist: parsePlaylist(data.playlist),
    stats: parseStats(data.stats),
    relatedPlaylists: Array.isArray(data.relatedPlaylists) ? data.relatedPlaylists : [],
    videoPagination: data.videoPagination ?? null,
    permissions: data.permissions ?? {},
  } as const;
}

export const meta: MetaFunction = () => ([
  { title: 'Playlist Detail - Local Streamer' },
  { name: 'description', content: 'View playlist information and videos' },
]);

export default function PlaylistDetailRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <PlaylistDetailPage
      playlist={data.playlist}
      stats={data.stats}
      relatedPlaylists={data.relatedPlaylists}
      videoPagination={data.videoPagination}
      permissions={data.permissions}
    />
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 403) {
      return (
        <RouteErrorView
          tone="warning"
          icon={<Lock className="h-6 w-6" aria-hidden />}
          title="This playlist is private"
          description={(
            <p>
              The owner hasn’t shared this playlist yet. Ask them to invite you or explore public collections instead.
            </p>
          )}
          actions={[
            { label: 'Explore public playlists', to: '/playlists' },
            { label: 'Back to library', to: '/', variant: 'outline' },
          ]}
          footnote="If you believe you should have access, contact the playlist owner for an invitation."
        />
      );
    }

    if (error.status === 404) {
      return (
        <RouteErrorView
          icon={<FileWarning className="h-6 w-6" aria-hidden />}
          title="Playlist not found"
          description={<p>The playlist might have been removed or the link could be incorrect. Try a different collection instead.</p>}
          actions={[
            { label: 'Browse playlists', to: '/playlists' },
            { label: 'Go to library', to: '/', variant: 'outline' },
          ]}
        />
      );
    }
  }

  return (
    <RouteErrorView
      tone="critical"
      icon={<AlertTriangle className="h-6 w-6" aria-hidden />}
      title="We couldn’t open this playlist"
      description={
        error instanceof Error
          ? error.message
          : 'Something unexpected happened while loading the playlist. Please try again shortly.'
      }
      actions={[
        { label: 'Try again', to: '/playlists', variant: 'secondary' },
        { label: 'Go to home', to: '/', variant: 'outline' },
      ]}
    />
  );
}
