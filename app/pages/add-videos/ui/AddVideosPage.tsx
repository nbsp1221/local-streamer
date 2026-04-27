import type { VideoTaxonomyItem } from '~/modules/library/domain/video-taxonomy';
import { AddVideosShell } from '~/widgets/add-videos-shell/ui/AddVideosShell';
import { useAddVideosView } from '~/widgets/add-videos/model/useAddVideosView';
import { AddVideosView } from '~/widgets/add-videos/ui/AddVideosView';

interface AddVideosPageProps {
  contentTypes: VideoTaxonomyItem[];
  genres: VideoTaxonomyItem[];
}

export function AddVideosPage({ contentTypes, genres }: AddVideosPageProps) {
  const {
    canAddToLibrary,
    handleAddToLibrary,
    handleChooseFiles,
    handleClearSession,
    handleContentTypeChange,
    handleDescriptionChange,
    handleGenreSlugsChange,
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
        contentTypes={contentTypes}
        genres={genres}
        onAddToLibrary={() => { void handleAddToLibrary(); }}
        onChooseFiles={handleChooseFiles}
        onClearSession={handleClearSession}
        onContentTypeChange={handleContentTypeChange}
        onDescriptionChange={handleDescriptionChange}
        onGenreSlugsChange={handleGenreSlugsChange}
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
