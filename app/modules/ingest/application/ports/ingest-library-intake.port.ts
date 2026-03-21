export interface IngestEncodingOptions {
  encoder: 'cpu-h264' | 'gpu-h264' | 'cpu-h265' | 'gpu-h265';
}

export interface AddVideoToLibraryCommand {
  filename: string;
  title: string;
  tags: string[];
  description?: string;
  encodingOptions?: IngestEncodingOptions;
}

export interface AddVideoToLibrarySuccessData {
  videoId: string;
  message: string;
  dashEnabled: boolean;
}

export interface IngestLibraryIntakePort {
  addVideoToLibrary(command: AddVideoToLibraryCommand): Promise<AddVideoToLibrarySuccessData>;
}
