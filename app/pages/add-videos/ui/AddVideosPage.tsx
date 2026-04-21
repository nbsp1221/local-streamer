import { AddVideosShell } from '~/widgets/add-videos-shell/ui/AddVideosShell';
import { useAddVideosView } from '~/widgets/add-videos/model/useAddVideosView';
import { AddVideosView } from '~/widgets/add-videos/ui/AddVideosView';

export function AddVideosPage() {
  const {
    canAddToLibrary,
    handleAddToLibrary,
    handleChooseFiles,
    handleClearSession,
    handleDescriptionChange,
    handleEncodingOptionsChange,
    handleRemoveSession,
    handleRetryUpload,
    handleTagsChange,
    handleTitleChange,
    pageError,
    session,
  } = useAddVideosView();

  return (
    <AddVideosShell>
      <AddVideosView
        canAddToLibrary={canAddToLibrary}
        onAddToLibrary={() => { void handleAddToLibrary(); }}
        onChooseFiles={handleChooseFiles}
        onClearSession={handleClearSession}
        onDescriptionChange={handleDescriptionChange}
        onEncodingOptionsChange={handleEncodingOptionsChange}
        onRemoveSession={() => { void handleRemoveSession(); }}
        onRetryUpload={handleRetryUpload}
        onTagsChange={handleTagsChange}
        onTitleChange={handleTitleChange}
        pageError={pageError}
        session={session}
      />
    </AddVideosShell>
  );
}
