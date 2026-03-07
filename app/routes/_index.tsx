import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import { requireProtectedPageSession } from '~/composition/server/auth';
import type { PendingVideo, Video } from '~/legacy/types/video';
import { HomePage } from '~/legacy/pages/home/ui/HomePage';
import { getPendingVideoRepository, getVideoRepository } from '~/legacy/repositories';

interface LoaderData {
  videos: Video[];
  pendingVideos: PendingVideo[];
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireProtectedPageSession(request);

  const [videos, pendingVideos] = await Promise.all([
    getVideoRepository().findAll(),
    getPendingVideoRepository().findAll(),
  ]);

  return {
    videos,
    pendingVideos,
  } satisfies LoaderData;
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
      videos={data.videos}
      pendingVideos={data.pendingVideos}
    />
  );
}
