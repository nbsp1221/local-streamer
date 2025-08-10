import type { Route } from "./+types/update.$id";
import { updateVideo, findVideoById } from "~/services/video-store.server";
import { requireAuth } from "~/utils/auth.server";

export async function action({ request, params }: Route.ActionArgs) {
  // Authentication check
  await requireAuth(request);
  
  const videoId = params.id;
  
  if (request.method !== 'PUT' && request.method !== 'PATCH') {
    return Response.json({ success: false, error: 'Method not allowed' }, { status: 405 });
  }
  
  try {
    // Check if video exists
    const existingVideo = await findVideoById(videoId);
    if (!existingVideo) {
      return Response.json({ success: false, error: 'Video not found' }, { status: 404 });
    }
    
    // Parse request body
    const body = await request.json();
    const { title, tags, description } = body;
    
    // Validate required fields
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return Response.json({ success: false, error: 'Title is required' }, { status: 400 });
    }
    
    // Prepare updates
    const updates = {
      title: title.trim(),
      tags: Array.isArray(tags) ? tags.filter((tag: any) => typeof tag === 'string' && tag.trim().length > 0) : [],
      description: typeof description === 'string' ? description.trim() : undefined
    };
    
    // Update video
    const updatedVideo = await updateVideo(videoId, updates);
    
    if (!updatedVideo) {
      return Response.json({ success: false, error: 'Failed to update video' }, { status: 500 });
    }
    
    return Response.json({ 
      success: true, 
      video: updatedVideo,
      message: `Video "${updatedVideo.title}" updated successfully`
    });
    
  } catch (error) {
    console.error('Update video error:', error);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}