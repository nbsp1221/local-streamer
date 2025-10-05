import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { isRouteErrorResponse, Link, useLoaderData, useRouteError } from 'react-router';
import type { PlaylistStats, PlaylistWithVideos } from '~/modules/playlist/domain/playlist.types';
import { AppLayout } from '~/components/AppLayout';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
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

  let title = 'Unable to open playlist';
  let description = 'Something went wrong while loading this playlist.';
  const primaryAction = { label: 'Back to playlists', to: '/playlists' };
  const secondaryAction = { label: 'Go to home', to: '/' };

  if (isRouteErrorResponse(error)) {
    if (error.status === 403) {
      title = 'You do not have access to this playlist';
      description = 'This playlist is private or restricted. Ask the owner to share it or switch to a playlist you can view.';
    }
    else if (error.status === 404) {
      title = 'Playlist not found';
      description = 'The playlist you are trying to open may have been deleted or never existed.';
    }
    else {
      title = error.statusText || title;
      description = typeof error.data === 'string' ? error.data : description;
    }
  }
  else if (error instanceof Error) {
    description = error.message;
  }

  return (
    <AppLayout>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-16">
        <Alert>
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription>
            <p>{description}</p>
          </AlertDescription>
        </Alert>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to={primaryAction.to}>{primaryAction.label}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={secondaryAction.to}>{secondaryAction.label}</Link>
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
