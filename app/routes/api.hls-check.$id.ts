import type { Route } from "./+types/api.hls-check.$id";
import { hasHLSFiles } from "~/services/hls-resolver.server";
import { findVideoById } from "~/services/video-store.server";

export async function loader({ params }: Route.LoaderArgs) {
  const videoId = params.id;
  
  try {
    const hasHLS = await hasHLSFiles(videoId);
    const video = await findVideoById(videoId);
    
    const response: any = {
      videoId,
      hasHLS,
      hlsUrl: hasHLS ? `/api/hls/${videoId}` : null,
      timestamp: new Date().toISOString()
    };

    // Include HLS metadata if available (metadata-based optimization)
    if (hasHLS && video?.hlsInfo) {
      response.hlsInfo = {
        segmentCount: video.hlsInfo.segmentCount,
        segmentDuration: video.hlsInfo.segmentDuration,
        totalSizeMB: video.hlsInfo.totalSizeMB,
        quality: video.hlsInfo.quality
      };
    }
    
    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=300'
        }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        videoId,
        hasHLS: false,
        error: 'Failed to check HLS files',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
}