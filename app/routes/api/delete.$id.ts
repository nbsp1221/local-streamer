import { deleteVideo, findVideoById } from '~/services/video-store.server';
import { requireAuth } from '~/utils/auth.server';
import type { Route } from './+types/delete.$id';

export async function action({ request, params }: Route.ActionArgs) {
  // Authentication check
  await requireAuth(request);

  const { id } = params;

  // Only allow DELETE method
  if (request.method !== 'DELETE') {
    return Response.json({
      success: false,
      error: 'Method not allowed',
    }, { status: 405 });
  }

  if (!id) {
    return Response.json({
      success: false,
      error: 'Video ID is required',
    }, { status: 400 });
  }

  try {
    // Check if video exists before deletion
    const video = await findVideoById(id);
    if (!video) {
      return Response.json({
        success: false,
        error: 'Video not found',
      }, { status: 404 });
    }

    // Delete video completely (files + metadata)
    await deleteVideo(id);

    console.log(`Video deleted successfully: ${video.title} (${id})`);

    return Response.json({
      success: true,
      message: 'Video deleted successfully',
      videoId: id,
      title: video.title,
    });
  }
  catch (error) {
    console.error('Failed to delete video:', error);

    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete video',
    }, { status: 500 });
  }
}
