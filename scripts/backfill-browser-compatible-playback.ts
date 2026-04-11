import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { basename, dirname, join } from 'path';
import { config } from '../app/legacy/configs';
import { ThumbnailCryptoUtils } from '../app/legacy/modules/thumbnail/shared/thumbnail-crypto.utils';
import { createCanonicalBackfillPackage } from '../app/legacy/modules/video/processing/services/create-canonical-backfill-package';
import { deriveVideoEncryptionKey } from '../app/legacy/modules/video/security/lib/derive-video-encryption-key';
import { generateVideoKeyId } from '../app/legacy/modules/video/security/lib/generate-video-key-id';

const HEVC_ONLY_PATTERN = /<Representation\b[^>]*codecs="(?:hev1|hvc1)[^"]*"/i;
const AVC_PATTERN = /<Representation\b[^>]*codecs="avc1[^"]*"/i;
const SOURCE_FILE_PATTERN = /^video\.[a-z0-9]+$/i;
const PROMOTED_PATHS = ['audio', 'video', 'manifest.mpd', 'key.bin'] as const;
const THUMBNAIL_FILENAME = 'thumbnail.jpg';

interface BackfillLogger {
  error: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
}

interface BackfillSkippedItem {
  reason: 'already-compatible' | 'manifest-missing' | 'missing-source';
  videoId: string;
}

interface BackfillFailedItem {
  error: string;
  videoId: string;
}

interface BackfillWarningItem {
  videoId: string;
  warning: string;
}

interface BackfillSummary {
  failed: BackfillFailedItem[];
  rebuilt: string[];
  skipped: BackfillSkippedItem[];
  warnings: BackfillWarningItem[];
}

interface ExistingThumbnailSnapshot {
  data: Buffer;
  key: Buffer | null;
}

interface BackfillDependencies {
  createPackage?: (input: {
    sourcePath: string;
    stagingDir: string;
    videoId: string;
  }) => Promise<void>;
  logger?: BackfillLogger;
  videoIds?: string[];
  videosDir?: string;
}

export async function backfillBrowserCompatiblePlayback(
  input: BackfillDependencies = {},
): Promise<BackfillSummary> {
  const logger = input.logger ?? console;
  const requiresExplicitFixtures = Boolean(input.videoIds && input.videoIds.length > 0);
  const videosDir = input.videosDir ?? config.paths.videos;
  const createPackage = input.createPackage ?? createCanonicalBackfillPackage;
  const videoIds = input.videoIds ?? await listVideoIds(videosDir);
  const summary: BackfillSummary = {
    failed: [],
    rebuilt: [],
    skipped: [],
    warnings: [],
  };

  for (const videoId of videoIds) {
    const targetDir = join(videosDir, videoId);
    const manifestPath = join(targetDir, 'manifest.mpd');
    const manifest = await readManifest(manifestPath);

    if (manifest === null) {
      if (requiresExplicitFixtures) {
        summary.failed.push({ error: 'manifest.mpd not found', videoId });
        logger.error(`[browser-backfill] Required fixture ${videoId} is missing manifest.mpd.`);
      }
      else {
        summary.skipped.push({ reason: 'manifest-missing', videoId });
        logger.warn(`[browser-backfill] Skipping ${videoId}: manifest.mpd not found.`);
      }
      continue;
    }

    if (!(await shouldBackfillVideo({ manifest, targetDir, videoId }))) {
      summary.skipped.push({ reason: 'already-compatible', videoId });
      logger.info(`[browser-backfill] Skipping ${videoId}: manifest already exposes a browser-compatible video representation with canonical ClearKey identity.`);
      continue;
    }

    const sourcePath = await findVideoSourcePath(targetDir);
    if (!sourcePath) {
      if (requiresExplicitFixtures) {
        summary.failed.push({ error: 'original source file is missing', videoId });
        logger.error(`[browser-backfill] Required fixture ${videoId} is missing the original source file.`);
      }
      else {
        summary.skipped.push({ reason: 'missing-source', videoId });
        logger.warn(`[browser-backfill] Skipping ${videoId}: original source file is missing.`);
      }
      continue;
    }

    const stagedDir = join(videosDir, `.browser-backfill-${videoId}-${randomUUID()}`);
    const rollbackDir = join(videosDir, `.browser-backfill-rollback-${videoId}-${randomUUID()}`);
    const existingThumbnail = await snapshotExistingThumbnail(targetDir);
    let rollbackPrepared = false;
    let rebuildCompleted = false;

    try {
      try {
        await createPackage({
          sourcePath,
          stagingDir: stagedDir,
          videoId,
        });

        await ensureRequiredStagedAssets(stagedDir);
        await captureRollbackAssets(targetDir, rollbackDir);
        rollbackPrepared = true;
        await promotePackagedAssets(stagedDir, targetDir);
        summary.rebuilt.push(videoId);
        rebuildCompleted = true;
        logger.info(`[browser-backfill] Rebuilt ${videoId} from ${basename(sourcePath)}.`);
      }
      catch (error) {
        if (rollbackPrepared) {
          await restorePromotedAssets(rollbackDir, targetDir);
        }
        const message = error instanceof Error ? error.message : 'Unknown backfill failure';
        summary.failed.push({ error: message, videoId });
        logger.error(`[browser-backfill] Failed to rebuild ${videoId}: ${message}`);
      }

      if (rebuildCompleted) {
        try {
          await reconcileThumbnailEncryption({
            logger,
            targetDir,
            videoId,
            previous: existingThumbnail,
          });
        }
        catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown thumbnail recovery failure';
          summary.warnings.push({ videoId, warning: message });
          logger.warn(`[browser-backfill] Rebuilt ${videoId}, but thumbnail recovery failed: ${message}`);
        }
      }
    }
    finally {
      await fs.rm(stagedDir, { force: true, recursive: true });
      await fs.rm(rollbackDir, { force: true, recursive: true });
    }
  }

  return summary;
}

export function isHevcOnlyManifest(manifest: string): boolean {
  return HEVC_ONLY_PATTERN.test(manifest) && !AVC_PATTERN.test(manifest);
}

export function shouldBackfillManifest(manifest: string, videoId: string): boolean {
  if (isHevcOnlyManifest(manifest)) {
    return true;
  }

  const keyIdMatch = manifest.match(/default_KID="([^"]+)"/i);
  if (!keyIdMatch) {
    return true;
  }

  return keyIdMatch[1].replaceAll('-', '').toLowerCase() !== generateVideoKeyId(videoId).toLowerCase();
}

async function shouldBackfillVideo(input: {
  manifest: string;
  targetDir: string;
  videoId: string;
}): Promise<boolean> {
  if (shouldBackfillManifest(input.manifest, input.videoId)) {
    return true;
  }

  const storedKey = await readStoredKey(input.targetDir);

  if (!storedKey) {
    return true;
  }

  const canonicalKey = deriveCanonicalKey(input.videoId);
  return !storedKey.equals(canonicalKey);
}

async function readManifest(manifestPath: string): Promise<string | null> {
  try {
    return await fs.readFile(manifestPath, 'utf8');
  }
  catch {
    return null;
  }
}

async function listVideoIds(videosDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(videosDir, { withFileTypes: true });
    return entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  }
  catch {
    return [];
  }
}

async function findVideoSourcePath(targetDir: string): Promise<string | null> {
  try {
    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    const match = entries.find(entry => entry.isFile() && SOURCE_FILE_PATTERN.test(entry.name));

    return match ? join(targetDir, match.name) : null;
  }
  catch {
    return null;
  }
}

async function snapshotExistingThumbnail(targetDir: string): Promise<ExistingThumbnailSnapshot | null> {
  const thumbnailPath = join(targetDir, THUMBNAIL_FILENAME);

  try {
    const data = await fs.readFile(thumbnailPath);
    const key = await readStoredKey(targetDir);

    return { data, key };
  }
  catch {
    return null;
  }
}

async function reconcileThumbnailEncryption(input: {
  logger: BackfillLogger;
  previous: ExistingThumbnailSnapshot | null;
  targetDir: string;
  videoId: string;
}): Promise<void> {
  const thumbnailPath = join(input.targetDir, THUMBNAIL_FILENAME);
  const currentKey = await readStoredKey(input.targetDir);

  if (!currentKey) {
    return;
  }

  let currentThumbnail: Buffer;

  try {
    currentThumbnail = await fs.readFile(thumbnailPath);
  }
  catch {
    return;
  }

  if (!ThumbnailCryptoUtils.validateEncryptedFormat(currentThumbnail)) {
    return;
  }

  const currentDecryption = ThumbnailCryptoUtils.decryptWithIVHeader(currentThumbnail, currentKey);
  if (currentDecryption.success && ThumbnailCryptoUtils.looksLikeJpeg(currentDecryption.data)) {
    return;
  }

  const previousKey = input.previous?.key;
  if (!previousKey) {
    throw new Error(`Encrypted thumbnail for ${input.videoId} is not decryptable with the promoted key.`);
  }

  const decryptWithPreviousKey = ThumbnailCryptoUtils.decryptWithIVHeader(currentThumbnail, previousKey);
  const previousThumbnail = decryptWithPreviousKey.success && ThumbnailCryptoUtils.looksLikeJpeg(decryptWithPreviousKey.data)
    ? decryptWithPreviousKey
    : ThumbnailCryptoUtils.decryptWithIVHeader(input.previous?.data ?? currentThumbnail, previousKey);

  if (!previousThumbnail.success || !ThumbnailCryptoUtils.looksLikeJpeg(previousThumbnail.data)) {
    throw new Error(`Encrypted thumbnail for ${input.videoId} cannot be re-keyed after backfill.`);
  }

  const reEncryptedThumbnail = ThumbnailCryptoUtils.encryptWithIVHeader(previousThumbnail.data, currentKey);

  if (!reEncryptedThumbnail.success || !reEncryptedThumbnail.data) {
    throw new Error(`Encrypted thumbnail for ${input.videoId} could not be re-encrypted after backfill.`);
  }

  await fs.writeFile(thumbnailPath, reEncryptedThumbnail.data);
  input.logger.info(`[browser-backfill] Re-keyed encrypted thumbnail for ${input.videoId}.`);
}

async function promotePackagedAssets(stagedDir: string, targetDir: string): Promise<void> {
  for (const relativePath of PROMOTED_PATHS) {
    const stagedPath = join(stagedDir, relativePath);
    const stats = await fs.stat(stagedPath);
    const targetPath = join(targetDir, relativePath);

    await fs.rm(targetPath, { force: true, recursive: true });

    if (stats.isDirectory()) {
      await fs.cp(stagedPath, targetPath, { recursive: true });
    }
    else {
      await fs.copyFile(stagedPath, targetPath);
    }
  }
}

async function ensureRequiredStagedAssets(stagedDir: string): Promise<void> {
  for (const relativePath of ['manifest.mpd', 'key.bin'] as const) {
    try {
      await fs.stat(join(stagedDir, relativePath));
    }
    catch {
      throw new Error(`missing staged asset: ${relativePath}`);
    }
  }

  await ensureSegmentedStreamAssets(stagedDir, 'audio');
  await ensureSegmentedStreamAssets(stagedDir, 'video');
}

async function captureRollbackAssets(targetDir: string, rollbackDir: string): Promise<void> {
  await fs.mkdir(rollbackDir, { recursive: true });

  for (const relativePath of PROMOTED_PATHS) {
    const targetPath = join(targetDir, relativePath);
    const rollbackPath = join(rollbackDir, relativePath);

    try {
      const stats = await fs.stat(targetPath);

      if (stats.isDirectory()) {
        await fs.cp(targetPath, rollbackPath, { recursive: true });
      }
      else {
        await fs.mkdir(dirname(rollbackPath), { recursive: true });
        await fs.copyFile(targetPath, rollbackPath);
      }
    }
    catch (error) {
      if (!isMissingFsError(error)) {
        throw error;
      }

      // Missing live asset means restore should remove any partially promoted replacement.
    }
  }
}

async function restorePromotedAssets(rollbackDir: string, targetDir: string): Promise<void> {
  for (const relativePath of PROMOTED_PATHS) {
    const targetPath = join(targetDir, relativePath);
    const rollbackPath = join(rollbackDir, relativePath);

    await fs.rm(targetPath, { force: true, recursive: true });

    try {
      const stats = await fs.stat(rollbackPath);

      if (stats.isDirectory()) {
        await fs.cp(rollbackPath, targetPath, { recursive: true });
      }
      else {
        await fs.copyFile(rollbackPath, targetPath);
      }
    }
    catch (error) {
      if (!isMissingFsError(error)) {
        throw error;
      }

      // No rollback copy means the asset did not exist before the failed promotion.
    }
  }
}

async function ensureSegmentedStreamAssets(stagedDir: string, streamDirName: 'audio' | 'video'): Promise<void> {
  const streamDir = join(stagedDir, streamDirName);
  let entries: string[];

  try {
    const stats = await fs.stat(streamDir);

    if (!stats.isDirectory()) {
      throw new Error(`missing staged asset: ${streamDirName}`);
    }

    entries = await fs.readdir(streamDir);
  }
  catch {
    throw new Error(`missing staged asset: ${streamDirName}`);
  }

  if (!entries.includes('init.mp4')) {
    throw new Error(`missing staged init segment: ${streamDirName}/init.mp4`);
  }

  if (!entries.some(entry => entry.endsWith('.m4s'))) {
    throw new Error(`missing staged media segments: ${streamDirName}`);
  }
}

function deriveCanonicalKey(videoId: string): Buffer {
  return deriveVideoEncryptionKey({
    masterSeed: config.security.video.masterSeed,
    rounds: config.security.video.keyDerivation.rounds,
    saltPrefix: config.security.video.keyDerivation.saltPrefix,
    videoId,
  });
}

async function readStoredKey(targetDir: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(join(targetDir, 'key.bin'));
  }
  catch {
    return null;
  }
}

function isMissingFsError(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as NodeJS.ErrnoException).code === 'string' &&
    (error as NodeJS.ErrnoException).code === 'ENOENT',
  );
}

function parseVideoIds(argv: string[]): string[] {
  const videoIds: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--video-id') {
      const value = argv[index + 1];
      if (value) {
        videoIds.push(value);
        index += 1;
      }
    }
  }

  return videoIds;
}

if (import.meta.main) {
  const videoIds = parseVideoIds(process.argv.slice(2));
  const summary = await backfillBrowserCompatiblePlayback({
    videoIds: videoIds.length > 0 ? videoIds : undefined,
  });

  if (summary.failed.length > 0) {
    process.exitCode = 1;
  }
}
