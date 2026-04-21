import type { LoaderFunctionArgs } from 'react-router';
import { useMemo } from 'react';
import { useLoaderData, useSearchParams } from 'react-router';
import type { HomeLibraryVideo } from '~/entities/library-video/model/library-video';
import { requireProtectedPageSession } from '~/composition/server/auth';
import { getHomeLibraryPageServices } from '~/composition/server/home-library-page';
import { HomePage } from '~/pages/home/ui/HomePage';
import { createHomeLibraryFilters } from '~/widgets/home-library/model/home-library-filters';

interface LoaderData {
  videos: SerializedHomeLibraryVideo[];
}

interface SerializedHomeLibraryVideo extends Omit<HomeLibraryVideo, 'createdAt'> {
  createdAt: string;
}

function serializeHomeLibraryVideo(video: {
  createdAt: Date;
  description?: string;
  duration: number;
  id: string;
  tags: string[];
  thumbnailUrl?: string;
  title: string;
  videoUrl: string;
}): SerializedHomeLibraryVideo {
  return {
    createdAt: video.createdAt.toISOString(),
    description: video.description,
    duration: video.duration,
    id: video.id,
    tags: [...video.tags],
    thumbnailUrl: video.thumbnailUrl,
    title: video.title,
    videoUrl: video.videoUrl,
  };
}

function deserializeHomeLibraryVideo(video: SerializedHomeLibraryVideo): HomeLibraryVideo {
  return {
    ...video,
    createdAt: new Date(video.createdAt),
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireProtectedPageSession(request);
  const result = await getHomeLibraryPageServices().loadHomeLibraryPageData.execute({});

  if (!result.ok) {
    throw new Response('Unable to load home library', { status: 500 });
  }

  return {
    videos: result.data.videos.map(serializeHomeLibraryVideo),
  } satisfies LoaderData;
}

export function shouldRevalidate({
  currentUrl,
  defaultShouldRevalidate,
  nextUrl,
}: {
  currentUrl: URL;
  defaultShouldRevalidate: boolean;
  nextUrl: URL;
}) {
  if (
    currentUrl.pathname === '/' &&
    nextUrl.pathname === '/' &&
    currentUrl.search !== nextUrl.search
  ) {
    return false;
  }

  return defaultShouldRevalidate;
}

export function meta() {
  return [
    { title: 'Local Streamer - My Library' },
    { name: 'description', content: 'Personal video library' },
  ];
}

export default function HomeRoute() {
  const data = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const videos = useMemo(() => data.videos.map(deserializeHomeLibraryVideo), [data.videos]);
  const initialFilters = useMemo(() => createHomeLibraryFilters({
    query: searchParams.get('q') ?? '',
    tags: searchParams.getAll('tag'),
  }), [searchParams]);

  return (
    <HomePage
      initialFilters={initialFilters}
      videos={videos}
    />
  );
}
