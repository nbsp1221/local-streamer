import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EncodingOptions } from '~/modules/video/add-video/add-video.types';
import type { PendingVideo } from '~/types/video';
import { DEFAULT_ENCODING_OPTIONS } from '~/utils/encoding';

export interface FileMetadataState {
  title: string;
  tags: string;
  description: string;
  encodingOptions: EncodingOptions;
}

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

interface UseAddVideosViewResult {
  pendingFiles: PendingVideo[];
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  processingFiles: Set<string>;
  metadataByFilename: Record<string, FileMetadataState>;
  handleRefresh: () => Promise<void>;
  handleTitleChange: (filename: string, value: string) => void;
  handleTagsChange: (filename: string, value: string) => void;
  handleDescriptionChange: (filename: string, value: string) => void;
  handleEncodingOptionsChange: (filename: string, options: EncodingOptions) => void;
  handleAddToLibrary: (filename: string) => Promise<void>;
}

function createInitialMetadata(filename: string): FileMetadataState {
  const defaultTitle = filename.replace(/\.[^/.]+$/, '');
  return {
    title: defaultTitle,
    tags: '',
    description: '',
    encodingOptions: { ...DEFAULT_ENCODING_OPTIONS },
  };
}

export function useAddVideosView(): UseAddVideosViewResult {
  const [pendingFiles, setPendingFiles] = useState<PendingVideo[]>([]);
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
      setMetadataByFilename((prev) => {
        const next: Record<string, FileMetadataState> = {};

        data.files.forEach((file) => {
          next[file.filename] = prev[file.filename] ?? createInitialMetadata(file.filename);
        });

        // If there was success message for removed file, keep state clean
        return next;
      });
    }
    catch (err) {
      console.error('Scan error:', err);
      setError('Network error occurred.');
    }
    finally {
      setLoading(false);
    }
  }, []);

  const updateMetadata = useCallback((filename: string, updater: (current: FileMetadataState) => FileMetadataState) => {
    setMetadataByFilename((prev) => {
      const current = prev[filename] ?? createInitialMetadata(filename);
      return {
        ...prev,
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

  const handleEncodingOptionsChange = useCallback((filename: string, options: EncodingOptions) => {
    updateMetadata(filename, current => ({ ...current, encodingOptions: options }));
  }, [updateMetadata]);

  const handleAddToLibrary = useCallback(async (filename: string) => {
    const metadata = metadataByFilename[filename] ?? createInitialMetadata(filename);

    if (!metadata.title.trim()) {
      setError('Please enter a title.');
      return;
    }

    setProcessingFiles((prev) => {
      const updated = new Set(prev);
      updated.add(filename);
      return updated;
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
      setPendingFiles(prev => prev.filter(file => file.filename !== filename));
      setMetadataByFilename((prev) => {
        const next = { ...prev };
        delete next[filename];
        return next;
      });
    }
    catch (err) {
      console.error('Add to library error:', err);
      setError('Network error occurred.');
    }
    finally {
      setProcessingFiles((prev) => {
        const updated = new Set(prev);
        updated.delete(filename);
        return updated;
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
