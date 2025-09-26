import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { useLoaderData } from 'react-router';
import type { Video } from '~/types/video';
import { VideoPlayerPage } from '~/pages/video-player/ui/VideoPlayerPage';
import { getVideoRepository } from '~/repositories';
import { requireAuth } from '~/utils/auth.server';

interface SerializedVideo extends Omit<Video, 'createdAt'> {
  createdAt: string;
}

function serializeVideo(video: Video): SerializedVideo {
  return {
    ...video,
    createdAt: video.createdAt.toISOString(),
  };
}

function deserializeVideo(serialized: SerializedVideo): Video {
  return {
    ...serialized,
    createdAt: new Date(serialized.createdAt),
  };
}

function findRelatedVideos(current: Video, allVideos: Video[]): Video[] {
  if (current.tags.length === 0) {
    return [];
  }

  const currentTags = new Set(current.tags.map(tag => tag.toLowerCase()));

  return allVideos
    .filter(candidate => candidate.id !== current.id)
    .filter(candidate => candidate.tags.some(tag => currentTags.has(tag.toLowerCase())))
    .slice(0, 10);
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireAuth(request);

  const videoId = params.id;
  if (!videoId) {
    throw new Response('Video ID is required', { status: 400 });
  }

  const videoRepository = getVideoRepository();
  const videos = await videoRepository.findAll();
  const currentVideo = videos.find(video => video.id === videoId);

  if (!currentVideo) {
    throw new Response('Video not found', { status: 404 });
  }

  const relatedVideos = findRelatedVideos(currentVideo, videos);

  return {
    video: serializeVideo(currentVideo),
    relatedVideos: relatedVideos.map(serializeVideo),
  };
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [
      { title: 'Video Player - Local Streamer' },
      { name: 'description', content: 'Local video streaming' },
    ];
  }

  return [
    { title: `${data.video.title} - Local Streamer` },
    { name: 'description', content: `Watch ${data.video.title} on Local Streamer` },
  ];
};

export default function VideoPlayerRoute() {
  const data = useLoaderData<typeof loader>();
  const video = deserializeVideo(data.video);
  const relatedVideos = data.relatedVideos.map(deserializeVideo);

  return (
    <VideoPlayerPage
      video={video}
      relatedVideos={relatedVideos}
    />
  );
}
