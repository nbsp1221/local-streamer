export interface ThumbnailFinalizerInput {
  title: string;
  videoId: string;
}

export interface ThumbnailFinalizerPort {
  finalizeThumbnail(input: ThumbnailFinalizerInput): Promise<void>;
}
