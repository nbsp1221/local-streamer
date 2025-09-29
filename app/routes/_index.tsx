import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import type { PendingVideo, Video } from '~/types/video';
import { HomePage } from '~/pages/home/ui/HomePage';
import { getPendingVideoRepository, getVideoRepository } from '~/repositories';
import { requireAuth } from '~/utils/auth.server';

interface LoaderData {
  videos: Video[];
  pendingVideos: PendingVideo[];
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAuth(request);

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
