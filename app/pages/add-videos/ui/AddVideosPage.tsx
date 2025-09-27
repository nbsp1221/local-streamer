import { AppLayout } from '~/components/AppLayout';
import { useAddVideosView } from '~/widgets/add-videos-view/model/useAddVideosView';
import { AddVideosView } from '~/widgets/add-videos-view/ui/AddVideosView';

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
    <AppLayout>
      <AddVideosView
        pendingFiles={pendingFiles}
        loading={loading}
        error={error}
        successMessage={successMessage}
        processingFiles={processingFiles}
        metadataByFilename={metadataByFilename}
        onRefresh={() => { void handleRefresh(); }}
        onTitleChange={handleTitleChange}
        onTagsChange={handleTagsChange}
        onDescriptionChange={handleDescriptionChange}
        onEncodingOptionsChange={handleEncodingOptionsChange}
        onAddToLibrary={(filename) => { void handleAddToLibrary(filename); }}
      />
    </AppLayout>
  );
}
