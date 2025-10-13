import { AlertCircle, Check, ListPlus, Loader2, PlusCircle, RefreshCw } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { Video } from '~/types/video';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import { CreatePlaylistDialog } from '~/features/playlist/create-playlist/ui/CreatePlaylistDialog';
import { useAddToPlaylistDialog } from '../model/useAddToPlaylistDialog';

interface AddToPlaylistPanelProps {
  video: Video;
  open: boolean;
}

export function AddToPlaylistPanel({ video, open }: AddToPlaylistPanelProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const {
    playlists,
    isLoading,
    error,
    actionStates,
    handleAdd,
    refresh,
  } = useAddToPlaylistDialog({ open, video });

  const handleCreateDialogChange = useCallback((nextOpen: boolean) => {
    setIsCreateDialogOpen(nextOpen);
    if (!nextOpen && open) {
      void refresh();
    }
  }, [open, refresh]);

  const renderPlaylists = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <p className="text-sm">Loading your playlists…</p>
        </div>
      );
    }

    if (!playlists.length) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
          <ListPlus className="h-8 w-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Create your first playlist</p>
            <p className="text-xs text-muted-foreground">
              Save this video by making a new playlist.
            </p>
          </div>
          <Button size="sm" className="gap-2" onClick={() => handleCreateDialogChange(true)}>
            <PlusCircle className="h-4 w-4" />
            New playlist
          </Button>
        </div>
      );
    }

    return (
      <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
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
                <p className="truncate text-sm font-medium">{playlist.name}</p>
                <p className="text-xs text-muted-foreground">
                  {playlist.videoCount} video{playlist.videoCount === 1 ? '' : 's'}
                  {playlist.isPublic ? ' • Public' : ' • Private'}
                </p>
              </div>
              <Button
                variant={isAdded && !isErrored ? 'secondary' : 'default'}
                size="sm"
                disabled={isAdded && !isErrored}
                className="w-24 justify-center"
                onClick={() => handleAdd(playlist.id)}
              >
                {isBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isAdded && !isErrored
                  ? (
                      <span className="flex items-center gap-1">
                        <Check className="h-4 w-4" />
                        Added
                      </span>
                    )
                  : (
                      buttonLabel
                    )}
              </Button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div className="rounded-lg border border-border/60 bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Save to playlist</p>
            <p className="text-xs text-muted-foreground">
              Choose where to keep “{video.title}”.
            </p>
          </div>
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
          <Alert variant="destructive" className="mt-4">
            <AlertTitle className="flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="h-4 w-4" />
              We couldn’t update playlists
            </AlertTitle>
            <AlertDescription className="mt-2 flex items-center justify-between gap-2 text-xs">
              <span>{error}</span>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 px-2"
                onClick={() => void refresh()}
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Separator className="my-4" />

        {renderPlaylists()}
      </div>

      <CreatePlaylistDialog
        open={isCreateDialogOpen}
        onOpenChange={handleCreateDialogChange}
      />
    </>
  );
}
