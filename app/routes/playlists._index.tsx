import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { useLoaderData } from 'react-router';
import { PlaylistsPage } from '~/pages/playlists/ui/PlaylistsPage';
// Loader function to fetch playlist data from server-side API
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const searchQuery = url.searchParams.get('q') || '';

  // Fetch from the real API endpoint
  const apiUrl = new URL('/api/playlists', url.origin);
  if (searchQuery) {
    apiUrl.searchParams.set('q', searchQuery);
  }

  const response = await fetch(apiUrl.toString(), {
    headers: {
      // Forward authentication cookie to maintain user session
      cookie: request.headers.get('cookie') || '',
    },
  });
  const data = await response.json();

  // Handle API response format
  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch playlists');
  }

  // Create video count map from playlists data
  const videoCountMap: Record<string, number> = {};
  data.playlists.forEach((playlist: { id: string; videoIds?: string[] }) => {
    videoCountMap[playlist.id] = playlist.videoIds?.length || 0;
  });

  return {
    playlists: data.playlists,
    videoCountMap,
    total: data.totalCount,
  };
}

export const meta: MetaFunction = () => ([
  { title: 'Playlists - Local Streamer' },
  { name: 'description', content: 'Manage your video playlists' },
]);

export default function Playlists() {
  // Get data from server-side loader
  const { playlists, videoCountMap, total } = useLoaderData<typeof loader>();

  return (
    <PlaylistsPage
      playlists={playlists}
      videoCountMap={videoCountMap}
      total={total}
      searchQuery=""
      onSearchChange={() => {}}
    />
  );
}
