import { useMemo, useState } from 'react';
import type { Video } from '~/types/video';
import { formatDuration } from '~/lib/utils';

interface UseVideoPlayerViewParams {
  video: Video;
  relatedVideos: Video[];
}

interface TagItem {
  value: string;
  isActive: boolean;
}

export function useVideoPlayerView({ video, relatedVideos }: UseVideoPlayerViewParams) {
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const filteredRelatedVideos = useMemo(() => {
    if (!activeTag) {
      return relatedVideos;
    }

    const lowerActiveTag = activeTag.toLowerCase();
    return relatedVideos.filter(candidate => candidate.tags.some(tag => tag.toLowerCase() === lowerActiveTag));
  }, [activeTag, relatedVideos]);

  const tagItems: TagItem[] = useMemo(() => {
    return video.tags.map(tag => ({
      value: tag,
      isActive: activeTag?.toLowerCase() === tag.toLowerCase(),
    }));
  }, [activeTag, video.tags]);

  const toggleTagFilter = (tag: string) => {
    setActiveTag(prev => (prev?.toLowerCase() === tag.toLowerCase() ? null : tag));
  };

  const clearTagFilter = () => {
    setActiveTag(null);
  };

  const durationLabel = useMemo(() => formatDuration(video.duration), [video.duration]);
  const createdAtLabel = useMemo(() => video.createdAt.toLocaleDateString(), [video.createdAt]);

  return {
    video,
    durationLabel,
    createdAtLabel,
    tagItems,
    activeTag,
    relatedVideos: filteredRelatedVideos,
    hasTagFilter: Boolean(activeTag),
    toggleTagFilter,
    clearTagFilter,
  };
}
