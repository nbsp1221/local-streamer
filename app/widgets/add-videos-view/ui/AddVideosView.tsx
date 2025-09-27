import { ArrowLeft, Check, FileVideo, RefreshCw, Upload } from 'lucide-react';
import { Link } from 'react-router';
import type { EncodingOptions } from '~/modules/video/add-video/add-video.types';
import type { PendingVideo } from '~/types/video';
import { EncodingOptionsComponent } from '~/components/EncodingOptions';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Separator } from '~/components/ui/separator';
import { DEFAULT_ENCODING_OPTIONS } from '~/utils/encoding';
import type { FileMetadataState } from '../model/useAddVideosView';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export interface AddVideosViewProps {
  pendingFiles: PendingVideo[];
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  processingFiles: Set<string>;
  metadataByFilename: Record<string, FileMetadataState>;
  onRefresh: () => void;
  onTitleChange: (filename: string, value: string) => void;
  onTagsChange: (filename: string, value: string) => void;
  onDescriptionChange: (filename: string, value: string) => void;
  onEncodingOptionsChange: (filename: string, options: EncodingOptions) => void;
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
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Library
              </Button>
            </Link>
          </div>
          <Button onClick={onRefresh} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Add Videos</h1>
          <p className="text-muted-foreground">
            Add video files from the uploads folder to your library
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="mb-6 border-green-500 bg-green-50 dark:bg-green-950">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700 dark:text-green-300">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {pendingFiles.length === 0 ? (
          <div className="text-center py-12">
            <FileVideo className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No videos to add</h3>
            <p className="text-muted-foreground mb-4">
              Place video files in the uploads folder and click the refresh button.
            </p>
            <div className="text-sm text-muted-foreground">
              <p>Supported formats: MP4, AVI, MKV, MOV, WebM, M4V, FLV, WMV</p>
            </div>
          </div>
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
                <div key={file.filename} className="border rounded-lg p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {file.thumbnailUrl ? (
                        <div className="flex-shrink-0">
                          <img
                            src={file.thumbnailUrl}
                            alt={`Preview of ${file.filename}`}
                            className="w-16 h-9 object-cover rounded border"
                            onError={(event) => {
                              const target = event.target as HTMLImageElement;
                              target.style.display = 'none';
                              const fallback = target.nextElementSibling as HTMLElement;
                              if (fallback) fallback.style.display = 'block';
                            }}
                          />
                          <FileVideo className="h-5 w-5 mt-1 text-muted-foreground hidden" />
                        </div>
                      ) : (
                        <FileVideo className="h-5 w-5 mt-1 text-muted-foreground" />
                      )}
                      <div>
                        <h3 className="font-medium">{file.filename}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary">{formatFileSize(file.size)}</Badge>
                          <Badge variant="outline">{file.type}</Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`title-${file.filename}`}>Title *</Label>
                      <Input
                        id={`title-${file.filename}`}
                        value={metadata?.title ?? ''}
                        onChange={event => onTitleChange(file.filename, event.target.value)}
                        placeholder="Enter video title"
                        disabled={isProcessing}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`tags-${file.filename}`}>Tags</Label>
                      <Input
                        id={`tags-${file.filename}`}
                        value={metadata?.tags ?? ''}
                        onChange={event => onTagsChange(file.filename, event.target.value)}
                        placeholder="tag1, tag2, tag3 (comma separated)"
                        disabled={isProcessing}
                      />
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor={`description-${file.filename}`}>Description (optional)</Label>
                      <Input
                        id={`description-${file.filename}`}
                        value={metadata?.description ?? ''}
                        onChange={event => onDescriptionChange(file.filename, event.target.value)}
                        placeholder="Brief description of the video"
                        disabled={isProcessing}
                      />
                    </div>
                  </div>

                  <EncodingOptionsComponent
                    value={metadata?.encodingOptions ?? { ...DEFAULT_ENCODING_OPTIONS }}
                    onChange={options => onEncodingOptionsChange(file.filename, options)}
                    fileSize={file.size}
                  />

                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={() => onAddToLibrary(file.filename)}
                      disabled={isProcessing || !(metadata?.title || '').trim()}
                    >
                      {isProcessing ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Add to Library
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
