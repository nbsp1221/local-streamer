import type { Route } from "./+types/scan-incoming";
import { scanIncomingFiles, ensureIncomingDirectory } from "~/services/file-manager.server";

export async function loader({}: Route.LoaderArgs) {
  try {
    // Ensure incoming directory exists
    await ensureIncomingDirectory();
    
    // Scan files
    const files = await scanIncomingFiles();
    
    return Response.json({
      success: true,
      files,
      count: files.length
    });
  } catch (error) {
    console.error('Failed to scan incoming files:', error);
    
    return Response.json({
      success: false,
      error: 'Failed to scan incoming files',
      files: [],
      count: 0
    }, { status: 500 });
  }
}