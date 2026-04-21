export interface PromoteStagedUploadInput {
  filename: string;
  sourcePath: string;
  stagingId: string;
}

export interface PromoteStagedUploadResult {
  storagePath: string;
}

export interface IngestStagedUploadStoragePort {
  delete(storagePath: string): Promise<void>;
  deleteTemp(storagePath: string): Promise<void>;
  promote(input: PromoteStagedUploadInput): Promise<PromoteStagedUploadResult>;
}
