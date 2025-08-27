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
      logger.info('Starting to scan incoming directory for video files');

      // 2. Ensure incoming directory exists
      await fileManager.ensureIncomingDirectory();
      logger.info('Incoming directory verified');

      // 3. Scan for video files
      const files = await fileManager.scanIncomingFiles();
      const fileCount = files.length;

      // 4. Log the results
      if (fileCount === 0) {
        logger.info('No video files found in incoming directory');
      }
      else {
        logger.info(`Found ${fileCount} video file(s) in incoming directory`, {
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
      logger.error('Failed to scan incoming files', error);

      return Result.fail(
        new InternalError('Failed to scan incoming files'),
      );
    }
  }
}
