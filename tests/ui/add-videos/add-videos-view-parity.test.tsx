import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, test, vi } from 'vitest';
import {
  type AddVideosViewProps,
  AddVideosView,
} from '../../../app/widgets/add-videos/ui/AddVideosView';

function createViewProps(overrides: Partial<AddVideosViewProps> = {}): AddVideosViewProps {
  return {
    canAddToLibrary: false,
    onAddToLibrary: vi.fn(),
    onChooseFiles: vi.fn(),
    onClearSession: vi.fn(),
    onDescriptionChange: vi.fn(),
    onEncodingOptionsChange: vi.fn(),
    onRemoveSession: vi.fn(),
    onRetryUpload: vi.fn(),
    onTagsChange: vi.fn(),
    onTitleChange: vi.fn(),
    pageError: null,
    session: null,
    ...overrides,
  };
}

function renderView(props: AddVideosViewProps) {
  return render(
    <MemoryRouter>
      <AddVideosView {...props} />
    </MemoryRouter>,
  );
}

describe('AddVideosView', () => {
  test('renders the browser-first empty state instead of the old folder-scan flow', () => {
    renderView(createViewProps());

    expect(screen.getByRole('heading', { level: 1, name: 'Upload a video' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose Video' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
    expect(screen.getByText('Maximum file size: 4 GB')).toBeInTheDocument();
    expect(screen.getByText('Only one file can be uploaded at a time.')).toBeInTheDocument();
  });

  test('renders a single active upload card with inline status and textarea-based metadata editing', () => {
    renderView(createViewProps({
      session: {
        error: null,
        file: new File(['video-data'], 'fixture-video.mp4', { type: 'video/mp4' }),
        filename: 'fixture-video.mp4',
        metadata: {
          description: 'Fixture description',
          encodingOptions: {
            encoder: 'cpu-h264',
          },
          tags: 'one, two',
          title: 'Fixture title',
        },
        mimeType: 'video/mp4',
        progressPercent: 45,
        size: 1_024 * 1_024,
        stagingId: null,
        status: 'uploading',
        successMessage: null,
      },
    }));

    expect(screen.getByRole('heading', { level: 2, name: 'fixture-video.mp4' })).toBeInTheDocument();
    expect(screen.getByText('Uploading')).toBeInTheDocument();
    expect(screen.getByLabelText('Title *')).toHaveValue('Fixture title');
    expect(screen.getByLabelText('Tags')).toHaveValue('one, two');
    expect(screen.getByLabelText('Description')).toHaveValue('Fixture description');
    expect(screen.getByRole('textbox', { name: 'Description' }).tagName).toBe('TEXTAREA');
    expect(screen.getByRole('button', { name: 'Add to Library' })).toBeDisabled();
  });

  test('shows retry and completion actions in the correct session states', async () => {
    const user = userEvent.setup();
    const onRetryUpload = vi.fn();
    const onClearSession = vi.fn();

    const { rerender } = render(
      <MemoryRouter>
        <AddVideosView
          {...createViewProps({
            onRetryUpload,
            session: {
              error: 'Upload failed.',
              file: new File(['video-data'], 'fixture-video.mp4', { type: 'video/mp4' }),
              filename: 'fixture-video.mp4',
              metadata: {
                description: '',
                encodingOptions: {
                  encoder: 'cpu-h264',
                },
                tags: '',
                title: 'Fixture title',
              },
              mimeType: 'video/mp4',
              progressPercent: 10,
              size: 10,
              stagingId: null,
              status: 'upload_failed',
              successMessage: null,
            },
          })}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Retry Upload' }));
    expect(onRetryUpload).toHaveBeenCalledOnce();

    rerender(
      <MemoryRouter>
        <AddVideosView
          {...createViewProps({
            onClearSession,
            session: {
              error: null,
              file: new File(['video-data'], 'fixture-video.mp4', { type: 'video/mp4' }),
              filename: 'fixture-video.mp4',
              metadata: {
                description: '',
                encodingOptions: {
                  encoder: 'cpu-h264',
                },
                tags: '',
                title: 'Fixture title',
              },
              mimeType: 'video/mp4',
              progressPercent: 100,
              size: 10,
              stagingId: 'staging-123',
              status: 'completed',
              successMessage: '"Fixture title" has been added to the library.',
            },
          })}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('"Fixture title" has been added to the library.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Upload Another Video' }));
    expect(onClearSession).toHaveBeenCalledOnce();
  });

  test('hides remove while the final library commit is in flight', () => {
    renderView(createViewProps({
      session: {
        error: null,
        file: new File(['video-data'], 'fixture-video.mp4', { type: 'video/mp4' }),
        filename: 'fixture-video.mp4',
        metadata: {
          description: '',
          encodingOptions: {
            encoder: 'cpu-h264',
          },
          tags: '',
          title: 'Fixture title',
        },
        mimeType: 'video/mp4',
        progressPercent: 100,
        size: 10,
        stagingId: 'staging-123',
        status: 'adding_to_library',
        successMessage: null,
      },
    }));

    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adding...' })).toBeDisabled();
  });
});
