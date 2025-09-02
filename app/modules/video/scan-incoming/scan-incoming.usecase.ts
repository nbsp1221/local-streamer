import { InternalError } from '~/lib/errors';
import { Result } from '~/lib/result';
import { UseCase } from '~/lib/usecase.base';
import type {
  ScanIncomingDependencies,
  ScanIncomingRequest,
  ScanIncomingResponse,
} from './scan-incoming.types';

export class ScanIncomingUseCase extends UseCase<ScanIncomingRequest, ScanIncomingResponse> {
  constructor(private readonly deps: ScanIncomingDependencies) {
    super();
  }

  async execute(_request: ScanIncomingRequest): Promise<Result<ScanIncomingResponse>> {
    const { fileManager, logger } = this.deps;

    try {
      // 1. Log the start of scanning operation
      logger.info('Starting to scan uploads directory for video files');

      // 2. Ensure uploads directory exists
      await fileManager.ensureUploadsDirectory();
      logger.info('Uploads directory verified');

      // 3. Scan for video files
      const files = await fileManager.scanIncomingFiles();
      const fileCount = files.length;

      // 4. Log the results
      if (fileCount === 0) {
        logger.info('No video files found in uploads directory');
      }
      else {
        logger.info(`Found ${fileCount} video file(s) in uploads directory`, {
          count: fileCount,
          files: files.map(f => ({
            filename: f.filename,
            size: f.size,
            type: f.type,
          })),
        });
      }

      // 5. Return success result
      return Result.ok({
        files,
        count: fileCount,
      });
    }
    catch (error) {
      // 6. Handle and log any errors
      logger.error('Failed to scan uploads files', error);

      return Result.fail(
        new InternalError('Failed to scan uploads files'),
      );
    }
  }
}
