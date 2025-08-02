import { createReadStream, statSync } from 'fs';
import type { Route } from './+types/api.segment.$id.$file';
import { resolveSegmentFile } from '~/services/hls-resolver.server';

export async function loader({ request, params }: Route.LoaderArgs) {
  const { id, file } = params;
  
  try {
    const segmentPath = await resolveSegmentFile(id, file);
    
    if (!segmentPath) {
      throw new Response('Segment not found', { 
        status: 404,
        statusText: `HLS segment file not found: ${file}`
      });
    }
    
    let fileStats;
    try {
      fileStats = statSync(segmentPath);
    } catch (error) {
      throw new Response('Segment file inaccessible', { 
        status: 404,
        statusText: 'Segment file could not be accessed'
      });
    }
    
    const fileSize = fileStats.size;
    const range = request.headers.get('range');
    
    if (range) {
      return handleRangeRequest(segmentPath, fileSize, range, file);
    } else {
      return handleFullFileRequest(segmentPath, fileSize, file);
    }
    
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    
    throw new Response('Internal server error', { 
      status: 500,
      statusText: 'Unexpected error while processing HLS segment'
    });
  }
}

function handleRangeRequest(filePath: string, fileSize: number, range: string, filename: string): Response {
  try {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    
    if (start >= fileSize || end >= fileSize || start > end) {
      throw new Response('Requested range not satisfiable', { 
        status: 416,
        headers: {
          'Content-Range': `bytes */${fileSize}`,
        },
      });
    }
    
    const stream = createReadStream(filePath, { start, end });
    
    return new Response(stream as any, {
      status: 206, // Partial Content
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize.toString(),
        'Content-Type': 'video/mp2t', // MPEG-2 Transport Stream
        'Cache-Control': 'public, max-age=31536000',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Range',
      },
    });
    
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    
    throw new Response('Range request processing failed', { status: 500 });
  }
}

function handleFullFileRequest(filePath: string, fileSize: number, filename: string): Response {
  try {
    const stream = createReadStream(filePath);
    
    return new Response(stream as any, {
      status: 200,
      headers: {
        'Content-Length': fileSize.toString(),
        'Content-Type': 'video/mp2t', // MPEG-2 Transport Stream
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Range',
      },
    });
    
  } catch (error) {
    throw new Response('File streaming failed', { status: 500 });
  }
}

export async function action({ params }: Route.ActionArgs) {
  throw new Response('Method not allowed', { 
    status: 405,
    statusText: 'HLS segments only support GET requests'
  });
}