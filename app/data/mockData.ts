import type { Video, PendingVideo } from '~/types/video';

export const mockVideos: Video[] = [
  {
    id: "f14b5611-3681-41ba-93c6-d5fc2d78dd2a",
    title: "Svelte 5 완벽 정복하기",
    tags: ["Svelte", "Tutorial", "Frontend"],
    thumbnailUrl: "https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=600&h=400&fit=crop",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    duration: 1800, // 30 minutes
    addedAt: new Date('2025-01-15'),
    description: "Svelte 5의 모든 기능을 상세히 다루는 완벽 가이드"
  },
  {
    id: "fa670547-2738-4656-b378-13e9a8cdcd47",
    title: "Bun 런타임 심층 분석",
    tags: ["Bun", "JavaScript", "Runtime"],
    thumbnailUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&h=400&fit=crop",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    duration: 2400, // 40 minutes
    addedAt: new Date('2025-01-20'),
    description: "Bun의 성능과 특징을 Node.js와 비교 분석"
  },
  {
    id: "bd2c056c-00a0-44ca-b169-86e2263420ed",
    title: "제주도 여행 브이로그",
    tags: ["여행", "VLOG", "제주도"],
    thumbnailUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    duration: 900, // 15 minutes
    addedAt: new Date('2025-01-25'),
    description: "제주도 3박 4일 여행 하이라이트"
  },
  {
    id: "bf94bde2-f17c-4e1a-91b4-8af60102e456",
    title: "알리오 올리오 만들기",
    tags: ["요리", "이탈리안", "파스타"],
    thumbnailUrl: "https://images.unsplash.com/photo-1551782450-17144efb9c50?w=600&h=400&fit=crop",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    duration: 600, // 10 minutes
    addedAt: new Date('2025-01-28'),
    description: "간단하지만 맛있는 알리오 올리오 레시피"
  },
  {
    id: "69d14034-af19-40ac-8a0b-5c62d18c1e14",
    title: "2025년 상반기 프로젝트 회고",
    tags: ["업무", "회고", "개발"],
    thumbnailUrl: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=400&fit=crop",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    duration: 3600, // 60 minutes
    addedAt: new Date('2025-01-30'),
    description: "상반기 진행한 주요 프로젝트들을 돌아보며"
  },
  {
    id: "85e02da5-8cfa-4726-958e-8fabecbc1002",
    title: "React Server Components 깊이 파기",
    tags: ["React", "SSR", "Tutorial"],
    thumbnailUrl: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=600&h=400&fit=crop",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    duration: 2700, // 45 minutes
    addedAt: new Date('2025-02-01'),
    description: "RSC의 원리와 실전 적용 방법"
  },
  {
    id: "f63ac224-7f1b-42dc-ad51-7ba919f3088d",
    title: "TypeScript 5.0 새로운 기능들",
    tags: ["TypeScript", "JavaScript", "Programming"],
    thumbnailUrl: "https://images.unsplash.com/photo-1587620962725-abab7fe55159?w=600&h=400&fit=crop",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
    duration: 1500, // 25 minutes
    addedAt: new Date('2025-02-05'),
    description: "TypeScript 5.0의 주요 업데이트 내용 정리"
  },
  {
    id: "9b0c5f1f-0d86-4b1a-8ebe-7d0a769b8bd0",
    title: "홈카페 브런치 만들기",
    tags: ["요리", "브런치", "카페"],
    thumbnailUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=400&fit=crop",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
    duration: 1200, // 20 minutes
    addedAt: new Date('2025-02-08'),
    description: "집에서 만드는 근사한 브런치 메뉴"
  },
  {
    id: "3734958d-7ab3-4e33-aefd-41b3cb688b8f",
    title: "Next.js 15 마이그레이션 가이드",
    tags: ["Next.js", "React", "Migration"],
    thumbnailUrl: "https://images.unsplash.com/photo-1517077304055-6e89abbf09b0?w=600&h=400&fit=crop",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
    duration: 2100, // 35 minutes
    addedAt: new Date('2025-02-10'),
    description: "Next.js 14에서 15로 업그레이드하는 방법"
  },
  {
    id: "4f3c9ab3-096a-486c-861a-5a38463ff3e2",
    title: "개발자를 위한 피그마 활용법",
    tags: ["Design", "Figma", "UI/UX"],
    thumbnailUrl: "https://images.unsplash.com/photo-1609921212029-bb5a28e60960?w=600&h=400&fit=crop",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
    duration: 1800, // 30 minutes
    addedAt: new Date('2025-02-12'),
    description: "개발자가 알아야 할 피그마 핵심 기능들"
  },
  {
    id: "a32be38b-e6ef-4597-8ad4-2b4d777dff8d",
    title: "서울 야경 드라이브",
    tags: ["드라이브", "서울", "야경"],
    thumbnailUrl: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=600&h=400&fit=crop",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4",
    duration: 1800, // 30 minutes
    addedAt: new Date('2025-02-15'),
    description: "서울의 아름다운 야경을 감상하며 드라이브"
  },
  {
    id: "19b61713-a5a2-46c0-a7a5-c4e2b12aa929",
    title: "Docker 컨테이너 최적화 팁",
    tags: ["Docker", "DevOps", "Optimization"],
    thumbnailUrl: "https://images.unsplash.com/photo-1605745341112-85968b19335b?w=600&h=400&fit=crop",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4",
    duration: 2400, // 40 minutes
    addedAt: new Date('2025-02-18'),
    description: "Docker 이미지 크기 줄이기와 성능 향상 방법"
  }
];

export const mockPendingVideos: PendingVideo[] = [
  {
    filename: "new_video_01.mp4",
    size: 1024 * 1024 * 150, // 150MB
    type: "video/mp4",
    path: "/uploads/pending/new_video_01.mp4"
  },
  {
    filename: "another_clip.mkv", 
    size: 1024 * 1024 * 300, // 300MB
    type: "video/x-matroska",
    path: "/uploads/pending/another_clip.mkv"
  },
  {
    filename: "final-cut.mov",
    size: 1024 * 1024 * 500, // 500MB
    type: "video/quicktime", 
    path: "/uploads/pending/final-cut.mov"
  }
];

// 모든 고유 태그 추출 함수
export const getAllTags = (): string[] => {
  const tagSet = new Set<string>();
  mockVideos.forEach(video => {
    video.tags.forEach(tag => tagSet.add(tag));
  });
  return Array.from(tagSet).sort();
};