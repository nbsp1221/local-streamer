import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PendingUploadVideo } from '~/entities/pending-video/model/pending-upload-video';
import {
  type AddVideosEncodingOptions,
  createDefaultAddVideosEncodingOptions,
} from '~/features/add-videos-encoding/model/add-videos-encoding-options';

export interface FileMetadataState {
  title: string;
  tags: string;
  description: string;
  encodingOptions: AddVideosEncodingOptions;
}

interface ScanResponse {
  success: boolean;
  files: PendingUploadVideo[];
  count: number;
  error?: string;
}

interface AddResponse {
  success: boolean;
  videoId?: string;
  message?: string;
  error?: string;
}

interface UseAddVideosViewResult {
  pendingFiles: PendingUploadVideo[];
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  processingFiles: Set<string>;
  metadataByFilename: Record<string, FileMetadataState>;
  handleRefresh: () => Promise<void>;
  handleTitleChange: (filename: string, value: string) => void;
  handleTagsChange: (filename: string, value: string) => void;
  handleDescriptionChange: (filename: string, value: string) => void;
  handleEncodingOptionsChange: (filename: string, options: AddVideosEncodingOptions) => void;
  handleAddToLibrary: (filename: string) => Promise<void>;
}

function createInitialMetadata(filename: string): FileMetadataState {
  return {
    title: filename.replace(/\.[^/.]+$/, ''),
    tags: '',
    description: '',
    encodingOptions: createDefaultAddVideosEncodingOptions(),
  };
}

export function useAddVideosView(): UseAddVideosViewResult {
  const [pendingFiles, setPendingFiles] = useState<PendingUploadVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [processingFiles, setProcessingFiles] = useState<Set<string>>(new Set());
  const [metadataByFilename, setMetadataByFilename] = useState<Record<string, FileMetadataState>>({});

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/scan-incoming');
      const data: ScanResponse = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to scan files.');
        return;
      }

      setPendingFiles(data.files);
      setMetadataByFilename((previous) => {
        const next: Record<string, FileMetadataState> = {};

        data.files.forEach((file) => {
          next[file.filename] = previous[file.filename] ?? createInitialMetadata(file.filename);
        });

        return next;
      });
    }
    catch (error) {
      console.error('Scan error:', error);
      setError('Network error occurred.');
    }
    finally {
      setLoading(false);
    }
  }, []);

  const updateMetadata = useCallback((filename: string, updater: (current: FileMetadataState) => FileMetadataState) => {
    setMetadataByFilename((previous) => {
      const current = previous[filename] ?? createInitialMetadata(filename);

      return {
        ...previous,
        [filename]: updater(current),
      };
    });
  }, []);

  const handleTitleChange = useCallback((filename: string, value: string) => {
    updateMetadata(filename, current => ({ ...current, title: value }));
  }, [updateMetadata]);

  const handleTagsChange = useCallback((filename: string, value: string) => {
    updateMetadata(filename, current => ({ ...current, tags: value }));
  }, [updateMetadata]);

  const handleDescriptionChange = useCallback((filename: string, value: string) => {
    updateMetadata(filename, current => ({ ...current, description: value }));
  }, [updateMetadata]);

  const handleEncodingOptionsChange = useCallback((filename: string, options: AddVideosEncodingOptions) => {
    updateMetadata(filename, current => ({ ...current, encodingOptions: options }));
  }, [updateMetadata]);

  const handleAddToLibrary = useCallback(async (filename: string) => {
    const metadata = metadataByFilename[filename] ?? createInitialMetadata(filename);

    if (!metadata.title.trim()) {
      setError('Please enter a title.');
      return;
    }

    setProcessingFiles((previous) => {
      const next = new Set(previous);
      next.add(filename);
      return next;
    });
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

      if (!data.success) {
        setError(data.error || 'Failed to add to library.');
        return;
      }

      setSuccessMessage(`"${metadata.title}" has been added to the library.`);
      setPendingFiles(previous => previous.filter(file => file.filename !== filename));
      setMetadataByFilename((previous) => {
        const next = { ...previous };
        delete next[filename];
        return next;
      });
    }
    catch (error) {
      console.error('Add to library error:', error);
      setError('Network error occurred.');
    }
    finally {
      setProcessingFiles((previous) => {
        const next = new Set(previous);
        next.delete(filename);
        return next;
      });
    }
  }, [metadataByFilename]);

  useEffect(() => {
    void handleRefresh();
  }, [handleRefresh]);

  return useMemo(() => ({
    pendingFiles,
    loading,
    error,
    successMessage,
    processingFiles,
    metadataByFilename,
    handleRefresh,
    handleTitleChange,
    handleTagsChange,
    handleDescriptionChange,
    handleEncodingOptionsChange,
    handleAddToLibrary,
  }), [
    pendingFiles,
    loading,
    error,
    successMessage,
    processingFiles,
    metadataByFilename,
    handleRefresh,
    handleTitleChange,
    handleTagsChange,
    handleDescriptionChange,
    handleEncodingOptionsChange,
    handleAddToLibrary,
  ]);
}
