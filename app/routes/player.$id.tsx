import { useParams, Link, useLoaderData } from "react-router";
import { ArrowLeft, Share2, Download } from "lucide-react";
import type { Route } from "./+types/player.$id";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { VideoPlayer } from "~/components/VideoPlayer";
import { RelatedVideos } from "~/components/RelatedVideos";
import { useVideoLibrary } from "~/hooks/useVideoLibrary";
import { getVideos } from "~/services/video-store.server";

export async function loader({ params }: Route.LoaderArgs) {
  const videos = await getVideos();
  return { videos };
}

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `비디오 재생 - Local Streamer` },
    { name: "description", content: "로컬 비디오 스트리밍" },
  ];
}

export default function Player() {
  const { id } = useParams();
  const { videos: initialVideos } = useLoaderData<typeof loader>();
  const { videos, toggleTagFilter } = useVideoLibrary(initialVideos);
  
  // 현재 비디오 찾기
  const currentVideo = videos.find(video => video.id === id);
  
  // 관련 비디오 (같은 태그 포함, 현재 비디오 제외)
  const relatedVideos = videos
    .filter(video => 
      video.id !== id && 
      video.tags.some(tag => currentVideo?.tags.includes(tag))
    )
    .slice(0, 10);

  if (!currentVideo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">비디오를 찾을 수 없습니다</h1>
          <Link to="/">
            <Button>홈으로 돌아가기</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleTagClick = (tag: string) => {
    toggleTagFilter(tag);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 상단 네비게이션 */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                라이브러리
              </Button>
            </Link>
            <div className="flex-1" />
            <Button variant="ghost" size="sm">
              <Share2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* 플레이어 및 정보 영역 */}
          <div className="lg:col-span-2 space-y-4 lg:space-y-6">
            {/* 비디오 플레이어 */}
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <VideoPlayer video={currentVideo} />
            </div>

            {/* 비디오 정보 */}
            <div className="space-y-3 lg:space-y-4">
              <h1 className="text-xl lg:text-2xl font-bold leading-tight">
                {currentVideo.title}
              </h1>

              {/* 태그들 */}
              <div className="flex flex-wrap gap-1.5 lg:gap-2">
                {currentVideo.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-xs lg:text-sm cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={() => handleTagClick(tag)}
                  >
                    #{tag}
                  </Badge>
                ))}
              </div>

              {/* 설명 */}
              {currentVideo.description && (
                <div className="space-y-2">
                  <h3 className="text-sm lg:text-base font-semibold">설명</h3>
                  <p className="text-sm lg:text-base text-muted-foreground leading-relaxed">
                    {currentVideo.description}
                  </p>
                </div>
              )}

              {/* 메타데이터 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-4 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium">재생시간:</span>
                  <span className="ml-2">
                    {Math.floor(currentVideo.duration / 60)}:
                    {(currentVideo.duration % 60).toString().padStart(2, '0')}
                  </span>
                </div>
                <div>
                  <span className="font-medium">추가일:</span>
                  <span className="ml-2">
                    {currentVideo.addedAt.toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 관련 비디오 사이드바 */}
          <div className="lg:col-span-1">
            <RelatedVideos videos={relatedVideos} onTagClick={handleTagClick} />
          </div>
        </div>
      </div>
    </div>
  );
}