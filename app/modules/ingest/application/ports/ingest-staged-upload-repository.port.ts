import type { IngestStagedUpload, IngestStagedUploadStatus } from '../../domain/staged-upload';

export interface CreateIngestStagedUploadInput {
  committedVideoId?: string;
  createdAt: Date;
  expiresAt: Date;
  filename: string;
  mimeType: string;
  size: number;
  stagingId: string;
  status: IngestStagedUploadStatus;
  storagePath: string;
}

export interface UpdateIngestStagedUploadInput {
  committedVideoId?: string;
  expiresAt?: Date;
  status?: IngestStagedUploadStatus;
}

export interface IngestStagedUploadRepositoryPort {
  beginCommit(stagingId: string): Promise<'acquired' | 'already_committed' | 'already_committing' | 'missing'>;
  create(upload: CreateIngestStagedUploadInput): Promise<IngestStagedUpload>;
  delete(stagingId: string): Promise<void>;
  findByStagingId(stagingId: string): Promise<IngestStagedUpload | null>;
  listExpired(referenceTime: Date): Promise<IngestStagedUpload[]>;
  reserveCommittedVideoId(stagingId: string, nextVideoId: string): Promise<string | null>;
  update(stagingId: string, input: UpdateIngestStagedUploadInput): Promise<IngestStagedUpload | null>;
}
