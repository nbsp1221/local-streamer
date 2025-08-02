import { readFileSync } from 'fs';
import type { Route } from './+types/api.hls.$id';
import { resolveHLSFiles } from '~/services/hls-resolver.server';

export async function loader({ params }: Route.LoaderArgs) {
  const { id } = params;
  
  try {
    const hlsInfo = await resolveHLSFiles(id);
    
    if (!hlsInfo.exists || !hlsInfo.playlistPath) {
      throw new Response('HLS playlist not found', { 
        status: 404,
        statusText: hlsInfo.error || 'HLS files not available for this video'
      });
    }
    
    let playlistContent: string;
    try {
      playlistContent = readFileSync(hlsInfo.playlistPath, 'utf-8');
    } catch (error) {
      throw new Response('Failed to read HLS playlist', { 
        status: 500,
        statusText: 'Internal server error while reading playlist file'
      });
    }
    
    const modifiedPlaylist = modifyPlaylistUrls(playlistContent, id);
    
    return new Response(modifiedPlaylist, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Range',
      },
    });
    
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    
    throw new Response('Internal server error', { 
      status: 500,
      statusText: 'Unexpected error while processing HLS playlist'
    });
  }
}

function modifyPlaylistUrls(playlistContent: string, videoId: string): string {
  const lines = playlistContent.split('\n');
  
  const modifiedLines = lines.map(line => {
    if (line.trim().endsWith('.ts')) {
      const segmentMatch = line.match(/_?(segment\d+\.ts)$/);
      if (segmentMatch) {
        const segmentFile = segmentMatch[1];
        return `/api/segment/${videoId}/${segmentFile}`;
      } else {
        const filename = line.trim();
        return `/api/segment/${videoId}/${filename}`;
      }
    }
    
    return line;
  });
  
  return modifiedLines.join('\n');
}

export async function action({ params }: Route.ActionArgs) {
  throw new Response('Method not allowed', { 
    status: 405,
    statusText: 'HLS playlists only support GET requests'
  });
}