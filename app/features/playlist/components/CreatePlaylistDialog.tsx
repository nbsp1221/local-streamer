import { useEffect } from 'react';
import { useFetcher } from 'react-router';
import type { CreatePlaylistRequest } from '~/modules/playlist/domain/playlist.types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { CreatePlaylistForm } from './CreatePlaylistForm';

interface CreatePlaylistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePlaylistDialog({
  open,
  onOpenChange,
}: CreatePlaylistDialogProps) {
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state !== 'idle';

  // Close dialog when playlist is successfully created
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.success) {
      onOpenChange(false);
    }
  }, [fetcher.state, fetcher.data, onOpenChange]);

  const handleSubmit = async (data: CreatePlaylistRequest) => {
    fetcher.submit(
      JSON.stringify(data),
      {
        method: 'POST',
        action: '/api/playlists',
        encType: 'application/json',
      },
    );
  };

  const handleCancel = () => {
    if (!isSubmitting) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Playlist</DialogTitle>
          <DialogDescription>
            Create a new playlist to organize your videos. You can add videos to it later.
          </DialogDescription>
        </DialogHeader>

        <CreatePlaylistForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
}
