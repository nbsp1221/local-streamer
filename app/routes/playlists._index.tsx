import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { isRouteErrorResponse, useLoaderData, useRouteError } from 'react-router';

import { RouteErrorView } from '~/components/RouteErrorView';
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

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <RouteErrorView
        tone="warning"
        icon={<RefreshCw className="h-6 w-6" aria-hidden />}
        title="We couldn’t load your playlists"
        description={
          error.data
            ? <p>{error.data}</p>
            : <p>Please check your connection and try again.</p>
        }
        actions={[
          { label: 'Try again', to: '/playlists' },
          { label: 'Go to home', to: '/', variant: 'outline' },
        ]}
      />
    );
  }

  return (
    <RouteErrorView
      tone="critical"
      icon={<AlertTriangle className="h-6 w-6" aria-hidden />}
      title="Something went wrong"
      description={
        error instanceof Error
          ? error.message
          : 'We weren’t able to display your playlists right now. Please try again soon.'
      }
      actions={[
        { label: 'Try again', to: '/playlists' },
        { label: 'Go to home', to: '/', variant: 'outline' },
      ]}
    />
  );
}
