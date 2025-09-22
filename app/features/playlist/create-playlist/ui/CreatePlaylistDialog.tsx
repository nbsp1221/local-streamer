import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { useCreatePlaylist } from '../model/useCreatePlaylist';
import { CreatePlaylistForm } from './CreatePlaylistForm';

interface CreatePlaylistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePlaylistDialog({
  open,
  onOpenChange,
}: CreatePlaylistDialogProps) {
  const { createPlaylist, isSubmitting, isSuccess } = useCreatePlaylist();

  // Close dialog when playlist is successfully created
  useEffect(() => {
    if (isSuccess) {
      onOpenChange(false);
    }
  }, [isSuccess, onOpenChange]);

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
          onSubmit={createPlaylist}
          onCancel={handleCancel}
          isSubmitting={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
}
