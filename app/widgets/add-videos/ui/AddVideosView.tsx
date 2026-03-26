import { ArrowLeft, Check, FileVideo, RefreshCw, Upload } from 'lucide-react';
import { Link } from 'react-router';
import type { PendingUploadVideo } from '~/entities/pending-video/model/pending-upload-video';
import {
  type AddVideosEncodingOptions as AddVideosEncodingOptionsValue,
  createDefaultAddVideosEncodingOptions,
} from '~/features/add-videos-encoding/model/add-videos-encoding-options';
import { AddVideosEncodingOptions } from '~/features/add-videos-encoding/ui/AddVideosEncodingOptions';
import { Alert, AlertDescription } from '~/shared/ui/alert';
import { Badge } from '~/shared/ui/badge';
import { Button } from '~/shared/ui/button';
import { Card, CardContent, CardHeader } from '~/shared/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from '~/shared/ui/empty';
import { Input } from '~/shared/ui/input';
import { Label } from '~/shared/ui/label';
import { Separator } from '~/shared/ui/separator';
import type { FileMetadataState } from '../model/useAddVideosView';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export interface AddVideosViewProps {
  pendingFiles: PendingUploadVideo[];
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  processingFiles: Set<string>;
  metadataByFilename: Record<string, FileMetadataState>;
  onRefresh: () => void;
  onTitleChange: (filename: string, value: string) => void;
  onTagsChange: (filename: string, value: string) => void;
  onDescriptionChange: (filename: string, value: string) => void;
  onEncodingOptionsChange: (filename: string, options: AddVideosEncodingOptionsValue) => void;
  onAddToLibrary: (filename: string) => void;
}

export function AddVideosView({
  pendingFiles,
  loading,
  error,
  successMessage,
  processingFiles,
  metadataByFilename,
  onRefresh,
  onTitleChange,
  onTagsChange,
  onDescriptionChange,
  onEncodingOptionsChange,
  onAddToLibrary,
}: AddVideosViewProps) {
  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button asChild size="sm" variant="ghost">
              <Link to="/">
                <ArrowLeft data-icon="inline-start" />
                Back to Library
              </Link>
            </Button>
          </div>
          <Button disabled={loading} onClick={onRefresh} type="button" variant="outline">
            <RefreshCw className={loading ? 'animate-spin' : undefined} data-icon="inline-start" />
            Refresh
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Add Videos</h1>
          <p className="text-muted-foreground">
            Add video files from the uploads folder to your library
          </p>
        </div>
      </div>

      {error ? (
        <Alert className="mb-6" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {successMessage ? (
        <Alert className="mb-6 border-green-500 bg-green-50 dark:bg-green-950">
          <Check className="text-green-600" />
          <AlertDescription className="text-green-700 dark:text-green-300">
            {successMessage}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-6">
        {pendingFiles.length === 0 ? (
          <Empty className="gap-4 border-0 px-0 py-12 md:px-0 md:py-12">
            <EmptyHeader className="gap-2">
              <EmptyMedia>
                <FileVideo className="size-16 text-muted-foreground" />
              </EmptyMedia>
              <h3 className="text-lg font-semibold">No videos to add</h3>
              <EmptyDescription>
                Place video files in the uploads folder and click the refresh button.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="max-w-none gap-0 text-sm text-muted-foreground">
              <p>Supported formats: MP4, AVI, MKV, MOV, WebM, M4V, FLV, WMV</p>
            </EmptyContent>
          </Empty>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Pending Files ({pendingFiles.length})
              </h2>
            </div>

            {pendingFiles.map((file) => {
              const metadata = metadataByFilename[file.filename];
              const isProcessing = processingFiles.has(file.filename);

              return (
                <Card key={file.filename} className="gap-4 py-0">
                  <CardHeader className="px-6 pt-6 pb-0">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {file.thumbnailUrl ? (
                          <div className="shrink-0">
                            <img
                              alt={`Preview of ${file.filename}`}
                              className="h-9 w-16 rounded border object-cover"
                              onError={(event) => {
                                const target = event.target as HTMLImageElement;
                                target.style.display = 'none';
                                const fallback = target.nextElementSibling as HTMLElement | null;
                                if (fallback) {
                                  fallback.style.display = 'block';
                                }
                              }}
                              src={file.thumbnailUrl}
                            />
                            <FileVideo className="mt-1 hidden size-5 text-muted-foreground" />
                          </div>
                        ) : (
                          <FileVideo className="mt-1 size-5 text-muted-foreground" />
                        )}
                        <div className="flex flex-col gap-1">
                          <h3 className="font-medium">{file.filename}</h3>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{formatFileSize(file.size)}</Badge>
                            <Badge variant="outline">{file.type}</Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex flex-col gap-4 px-6 pb-6">
                    <Separator />

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`title-${file.filename}`}>Title *</Label>
                        <Input
                          disabled={isProcessing}
                          id={`title-${file.filename}`}
                          onChange={event => onTitleChange(file.filename, event.target.value)}
                          placeholder="Enter video title"
                          value={metadata?.title ?? ''}
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`tags-${file.filename}`}>Tags</Label>
                        <Input
                          disabled={isProcessing}
                          id={`tags-${file.filename}`}
                          onChange={event => onTagsChange(file.filename, event.target.value)}
                          placeholder="tag1, tag2, tag3 (comma separated)"
                          value={metadata?.tags ?? ''}
                        />
                      </div>

                      <div className="flex flex-col gap-2 md:col-span-2">
                        <Label htmlFor={`description-${file.filename}`}>Description (optional)</Label>
                        <Input
                          disabled={isProcessing}
                          id={`description-${file.filename}`}
                          onChange={event => onDescriptionChange(file.filename, event.target.value)}
                          placeholder="Brief description of the video"
                          value={metadata?.description ?? ''}
                        />
                      </div>
                    </div>

                    <AddVideosEncodingOptions
                      fileSize={file.size}
                      onChange={options => onEncodingOptionsChange(file.filename, options)}
                      value={metadata?.encodingOptions ?? createDefaultAddVideosEncodingOptions()}
                    />

                    <div className="flex justify-end pt-2">
                      <Button
                        disabled={isProcessing || !(metadata?.title || '').trim()}
                        onClick={() => onAddToLibrary(file.filename)}
                        type="button"
                      >
                        {isProcessing ? (
                          <>
                            <RefreshCw className="animate-spin" data-icon="inline-start" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Upload data-icon="inline-start" />
                            Add to Library
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
