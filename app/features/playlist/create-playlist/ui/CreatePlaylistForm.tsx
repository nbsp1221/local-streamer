import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '~/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { type CreatePlaylistRequest } from '~/modules/playlist/domain/playlist.types';

const formSchema = z.object({
  name: z
    .string()
    .min(1, 'Playlist name is required')
    .max(100, 'Playlist name must be within 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be within 500 characters')
    .optional()
    .or(z.literal('')),
});

type FormData = z.infer<typeof formSchema>;

interface CreatePlaylistFormProps {
  onSubmit: (data: CreatePlaylistRequest) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function CreatePlaylistForm({
  onSubmit,
  onCancel,
  isSubmitting = false,
}: CreatePlaylistFormProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const handleSubmit = (values: FormData) => {
    const createRequest: CreatePlaylistRequest = {
      name: values.name,
      description: values.description || undefined,
      type: 'user_created',
      isPublic: false, // Default to private for user-created playlists
    };

    onSubmit(createRequest);
  };

  const isDisabled = isSubmitting;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Playlist Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Playlist Name *</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter playlist name"
                  disabled={isDisabled}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter playlist description (optional)"
                  className="resize-none"
                  rows={3}
                  disabled={isDisabled}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Add a description to help others understand what this playlist is about.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isDisabled}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isDisabled}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Playlist
          </Button>
        </div>
      </form>
    </Form>
  );
}
