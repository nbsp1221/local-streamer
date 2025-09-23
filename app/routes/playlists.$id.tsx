import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { useLoaderData } from 'react-router';
import type { PlaylistStats, PlaylistWithVideos } from '~/modules/playlist/domain/playlist.types';
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
