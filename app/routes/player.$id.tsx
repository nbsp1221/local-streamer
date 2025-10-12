import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { AlertTriangle, ShieldAlert, VideoOff } from 'lucide-react';
import { isRouteErrorResponse, useLoaderData, useRouteError } from 'react-router';

import type { Video } from '~/types/video';
import { RouteErrorView } from '~/components/RouteErrorView';
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

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return (
        <RouteErrorView
          icon={<VideoOff className="h-6 w-6" aria-hidden />}
          title="We can’t find that video"
          description={<p>The video might have been removed or the link could be incorrect. Try another option instead.</p>}
          actions={[
            { label: 'Go to library', to: '/' },
            { label: 'Browse playlists', to: '/playlists', variant: 'outline' },
          ]}
        />
      );
    }

    if (error.status === 400) {
      return (
        <RouteErrorView
          tone="warning"
          icon={<ShieldAlert className="h-6 w-6" aria-hidden />}
          title="Invalid video request"
          description={<p>The link is missing some information. Check the address and try again.</p>}
          actions={[
            { label: 'Go to library', to: '/' },
            { label: 'Browse playlists', to: '/playlists', variant: 'outline' },
          ]}
        />
      );
    }
  }

  return (
    <RouteErrorView
      tone="critical"
      icon={<AlertTriangle className="h-6 w-6" aria-hidden />}
      title="We couldn’t load the player"
      description={
        error instanceof Error
          ? error.message
          : 'Something unexpected happened while loading the video. Please try again shortly.'
      }
      actions={[
        { label: 'Go to library', to: '/' },
        { label: 'Browse playlists', to: '/playlists', variant: 'outline' },
      ]}
    />
  );
}
