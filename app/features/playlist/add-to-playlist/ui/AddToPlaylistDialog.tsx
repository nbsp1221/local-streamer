import { ListPlus, Loader2, PlusCircle, RefreshCw } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { Video } from '~/types/video';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Separator } from '~/components/ui/separator';
import { CreatePlaylistDialog } from '~/features/playlist/create-playlist/ui/CreatePlaylistDialog';
import { useAddToPlaylistDialog } from '../model/useAddToPlaylistDialog';

interface AddToPlaylistDialogProps {
  video: Video | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddToPlaylistDialog({ video, open, onOpenChange }: AddToPlaylistDialogProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { playlists, isLoading, error, actionStates, handleAdd, refresh } = useAddToPlaylistDialog({
    open,
    video,
  });

  const handleCreateDialogChange = useCallback((nextOpen: boolean) => {
    setIsCreateDialogOpen(nextOpen);
    if (!nextOpen && open) {
      void refresh();
    }
  }, [open, refresh]);

  const renderPlaylistContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="mb-3 h-5 w-5 animate-spin" />
          Loading your playlists…
        </div>
      );
    }

    if (!playlists.length) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <ListPlus className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Create your first playlist to add videos.
          </p>
          <Button onClick={() => handleCreateDialogChange(true)} size="sm" className="gap-2">
            <PlusCircle className="h-4 w-4" />
            New playlist
          </Button>
        </div>
      );
    }

    return (
      <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
        {playlists.map((playlist) => {
          const state = actionStates[playlist.id] ?? (playlist.containsVideo ? 'success' : 'idle');
          const isAdded = playlist.containsVideo || state === 'success';
          const isBusy = state === 'loading';
          const isErrored = state === 'error';

          let buttonLabel = 'Add';
          if (isBusy) buttonLabel = 'Adding…';
          else if (isAdded) buttonLabel = 'Added';
          else if (isErrored) buttonLabel = 'Retry';

          return (
            <div
              key={playlist.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-card/60 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{playlist.name}</p>
                <p className="text-xs text-muted-foreground">
                  {playlist.videoCount} video{playlist.videoCount === 1 ? '' : 's'}
                  {playlist.isPublic ? ' • Public' : ' • Private'}
                </p>
              </div>
              <Button
                variant={isAdded ? 'outline' : 'secondary'}
                size="sm"
                disabled={isBusy || (isAdded && !isErrored)}
                className="w-24 justify-center"
                onClick={() => {
                  if (isBusy) return;
                  void handleAdd(playlist.id);
                }}
              >
                {isBusy
                  ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  : buttonLabel}
              </Button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add to playlist</DialogTitle>
            <DialogDescription>
              {video ? `Choose a playlist to add “${video.title}”.` : 'Select a playlist to add this video.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Only playlists you created are shown here.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={() => handleCreateDialogChange(true)}
              >
                <PlusCircle className="h-4 w-4" />
                New playlist
              </Button>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTitle>We couldn’t update playlists</AlertTitle>
                <AlertDescription className="flex items-center justify-between gap-3">
                  <span className="text-sm">{error}</span>
                  <Button variant="outline" size="sm" className="gap-1 px-2" onClick={() => void refresh()}>
                    <RefreshCw className="h-3 w-3" />
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <Separator />

            {renderPlaylistContent()}
          </div>
        </DialogContent>
      </Dialog>

      <CreatePlaylistDialog open={isCreateDialogOpen} onOpenChange={handleCreateDialogChange} />
    </>
  );
}
