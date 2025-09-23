import type { LoaderFunctionArgs } from 'react-router';
import { ArrowLeft, Check, FileVideo, RefreshCw, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { EncodingOptions } from '~/modules/video/add-video/add-video.types';
import type { PendingVideo } from '~/types/video';
import { AppLayout } from '~/components/AppLayout';
import { EncodingOptionsComponent } from '~/components/EncodingOptions';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Separator } from '~/components/ui/separator';
import { requireAuth } from '~/utils/auth.server';
import { DEFAULT_ENCODING_OPTIONS } from '~/utils/encoding';

interface ScanResponse {
  success: boolean;
  files: PendingVideo[];
  count: number;
  error?: string;
}

interface AddResponse {
  success: boolean;
  videoId?: string;
  message?: string;
  error?: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  // Server-side authentication check
  await requireAuth(request);
  return {};
}

export function meta() {
  return [
    { title: 'Add Videos - Local Streamer' },
    { name: 'description', content: 'Add new videos to your library' },
  ];
}

export default function AddVideos() {
  const [pendingFiles, setPendingFiles] = useState<PendingVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [processingFiles, setProcessingFiles] = useState<Set<string>>(new Set());

  // File metadata state
  const [fileMetadata, setFileMetadata] = useState<Record<string, {
    title: string;
    tags: string;
    description: string;
    encodingOptions: EncodingOptions;
  }>>({});

  // Scan uploads folder
  const scanFiles = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/scan-incoming');
      const data: ScanResponse = await response.json();

      if (data.success) {
        setPendingFiles(data.files);

        // Set default values for files without existing metadata
        const newMetadata = { ...fileMetadata };
        data.files.forEach((file) => {
          if (!newMetadata[file.filename]) {
            // Remove extension from filename for default title
            const defaultTitle = file.filename.replace(/\.[^/.]+$/, '');
            newMetadata[file.filename] = {
              title: defaultTitle,
              tags: '',
              description: '',
              encodingOptions: DEFAULT_ENCODING_OPTIONS,
            };
          }
        });
        setFileMetadata(newMetadata);
      }
      else {
        setError(data.error || 'Failed to scan files.');
      }
    }
    catch (err) {
      setError('Network error occurred.');
      console.error('Scan error:', err);
    }
    finally {
      setLoading(false);
    }
  };

  // Auto scan on component mount
  useEffect(() => {
    scanFiles();
  }, []);

  // Update metadata
  const updateMetadata = (filename: string, field: string, value: string) => {
    setFileMetadata(prev => ({
      ...prev,
      [filename]: {
        ...prev[filename],
        [field]: value,
      },
    }));
  };

  // Update encoding options
  const updateEncodingOptions = (filename: string, encodingOptions: EncodingOptions) => {
    setFileMetadata(prev => ({
      ...prev,
      [filename]: {
        ...prev[filename],
        encodingOptions,
      },
    }));
  };

  // Add to library
  const addToLibrary = async (filename: string) => {
    const metadata = fileMetadata[filename];
    if (!metadata || !metadata.title.trim()) {
      setError('Please enter a title.');
      return;
    }

    setProcessingFiles(prev => new Set(prev).add(filename));
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/add-to-library', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename,
          title: metadata.title.trim(),
          tags: metadata.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
          description: metadata.description.trim() || undefined,
          encodingOptions: metadata.encodingOptions,
        }),
      });

      const data: AddResponse = await response.json();

      if (data.success) {
        setSuccessMessage(`"${metadata.title}" has been added to the library.`);

        // Remove successful file from list
        setPendingFiles(prev => prev.filter(file => file.filename !== filename));
        setFileMetadata((prev) => {
          const newMetadata = { ...prev };
          delete newMetadata[filename];
          return newMetadata;
        });
      }
      else {
        setError(data.error || 'Failed to add to library.');
      }
    }
    catch (err) {
      setError('Network error occurred.');
      console.error('Add to library error:', err);
    }
    finally {
      setProcessingFiles((prev) => {
        const newSet = new Set(prev);
        newSet.delete(filename);
        return newSet;
      });
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  return (
    <AppLayout>
      {/* Main Content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
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
            <Button onClick={scanFiles} disabled={loading} variant="outline">
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
        {/* Alert Messages */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>
              {error}
            </AlertDescription>
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

        {/* File List */}
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
                const metadata = fileMetadata[file.filename] || {
                  title: '',
                  tags: '',
                  description: '',
                  encodingOptions: DEFAULT_ENCODING_OPTIONS,
                };
                const isProcessing = processingFiles.has(file.filename);

                return (
                  <div key={file.filename} className="border rounded-lg p-6 space-y-4">
                    {/* File Information */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {file.thumbnailUrl ? (
                          <div className="flex-shrink-0">
                            <img
                              src={file.thumbnailUrl}
                              alt={`Preview of ${file.filename}`}
                              className="w-16 h-9 object-cover rounded border"
                              onError={(e) => {
                                // Fallback to file icon if thumbnail fails to load
                                const target = e.target as HTMLImageElement;
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

                    {/* Metadata Input Form */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`title-${file.filename}`}>Title *</Label>
                        <Input
                          id={`title-${file.filename}`}
                          value={metadata.title}
                          onChange={e => updateMetadata(file.filename, 'title', e.target.value)}
                          placeholder="Enter video title"
                          disabled={isProcessing}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`tags-${file.filename}`}>Tags</Label>
                        <Input
                          id={`tags-${file.filename}`}
                          value={metadata.tags}
                          onChange={e => updateMetadata(file.filename, 'tags', e.target.value)}
                          placeholder="tag1, tag2, tag3 (comma separated)"
                          disabled={isProcessing}
                        />
                      </div>

                      <div className="md:col-span-2 space-y-2">
                        <Label htmlFor={`description-${file.filename}`}>Description (optional)</Label>
                        <Input
                          id={`description-${file.filename}`}
                          value={metadata.description}
                          onChange={e => updateMetadata(file.filename, 'description', e.target.value)}
                          placeholder="Brief description of the video"
                          disabled={isProcessing}
                        />
                      </div>
                    </div>

                    {/* Encoding Options */}
                    <EncodingOptionsComponent
                      value={metadata.encodingOptions}
                      onChange={encodingOptions => updateEncodingOptions(file.filename, encodingOptions)}
                      fileSize={file.size}
                    />

                    {/* Add Button */}
                    <div className="flex justify-end pt-2">
                      <Button
                        onClick={() => addToLibrary(file.filename)}
                        disabled={isProcessing || !metadata.title.trim()}
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
    </AppLayout>
  );
}
