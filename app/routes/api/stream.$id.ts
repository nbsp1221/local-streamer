import { createReadStream, statSync } from 'fs';
import { join } from 'path';
import { findVideoById } from '~/services/video-store.server';
import { requireAuth } from '~/utils/auth.server';
import { config } from '~/configs';

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  // 인증 확인
  await requireAuth(request);
  
  const { id } = params;
  
  // 비디오 정보 조회
  const video = await findVideoById(id);
  if (!video) {
    throw new Response('Video not found', { status: 404 });
  }

  // 로컬 파일 경로인지 확인
  if (!video.videoUrl.startsWith('/data/videos/')) {
    // 외부 URL은 리다이렉트
    return Response.redirect(video.videoUrl);
  }

  // 로컬 파일 경로 구성
  const filePath = join(config.paths.root, video.videoUrl);
  
  try {
    const stat = statSync(filePath);
    const fileSize = stat.size;
    
    // Range 요청 처리
    const range = request.headers.get('range');
    
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      const stream = createReadStream(filePath, { start, end });
      
      return new Response(stream as any, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize.toString(),
          'Content-Type': 'video/mp4',
        },
      });
    } else {
      // 전체 파일 스트리밍
      const stream = createReadStream(filePath);
      
      return new Response(stream as any, {
        headers: {
          'Content-Length': fileSize.toString(),
          'Content-Type': 'video/mp4',
        },
      });
    }
  } catch (error) {
    console.error('Failed to stream video:', error);
    throw new Response('File not found', { status: 404 });
  }
}