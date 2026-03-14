import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import type { PendingVideo, SearchFilters, Video } from '~/legacy/types/video';
import { requireProtectedPageSession } from '~/composition/server/auth';
import { getHomeLibraryPageServices } from '~/composition/server/home-library-page';
import { HomePage } from '~/legacy/pages/home/ui/HomePage';

interface LoaderData {
  initialFilters: SearchFilters;
  videos: Video[];
  pendingVideos: PendingVideo[];
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireProtectedPageSession(request);
  const url = new URL(request.url);
  const result = await getHomeLibraryPageServices().loadHomeLibraryPageData.execute({
    rawQuery: url.searchParams.get('q'),
    rawTags: url.searchParams.getAll('tag'),
  });

  if (!result.ok) {
    throw new Response('Unable to load home library', { status: 500 });
  }

  return result.data satisfies LoaderData;
}

export function meta() {
  return [
    { title: 'Local Streamer - My Library' },
    { name: 'description', content: 'Personal video library' },
  ];
}

export default function HomeRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <HomePage
      initialFilters={data.initialFilters}
      videos={data.videos}
      pendingVideos={data.pendingVideos}
    />
  );
}
