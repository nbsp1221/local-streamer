import { AddVideosShell } from '~/widgets/add-videos-shell/ui/AddVideosShell';
import { useAddVideosView } from '~/widgets/add-videos/model/useAddVideosView';
import { AddVideosView } from '~/widgets/add-videos/ui/AddVideosView';

export function AddVideosPage() {
  const {
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
  } = useAddVideosView();

  return (
    <AddVideosShell>
      <AddVideosView
        error={error}
        loading={loading}
        metadataByFilename={metadataByFilename}
        onAddToLibrary={(filename) => { void handleAddToLibrary(filename); }}
        onDescriptionChange={handleDescriptionChange}
        onEncodingOptionsChange={handleEncodingOptionsChange}
        onRefresh={() => { void handleRefresh(); }}
        onTagsChange={handleTagsChange}
        onTitleChange={handleTitleChange}
        pendingFiles={pendingFiles}
        processingFiles={processingFiles}
        successMessage={successMessage}
      />
    </AddVideosShell>
  );
}
