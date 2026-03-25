import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, test, vi } from 'vitest';

import type { EncodingOptions } from '../../../app/legacy/modules/video/add-video/add-video.types';
import type { PendingVideo } from '../../../app/legacy/types/video';
import { DEFAULT_ENCODING_OPTIONS } from '../../../app/legacy/utils/encoding';
import {
  type AddVideosViewProps,
  AddVideosView,
} from '../../../app/widgets/add-videos/ui/AddVideosView';

function createPendingFile(overrides: Partial<PendingVideo> = {}): PendingVideo {
  return {
    createdAt: new Date('2026-03-25T00:00:00.000Z'),
    filename: 'fixture-video.mp4',
    id: 'pending-1',
    size: 1_024 * 1_024,
    thumbnailUrl: '/api/thumbnail-preview/fixture-video.jpg',
    type: 'mp4',
    ...overrides,
  };
}

function createViewProps(overrides: Partial<AddVideosViewProps> = {}): AddVideosViewProps {
  const pendingFile = createPendingFile();
  const metadataByFilename = {
    [pendingFile.filename]: {
      description: 'Fixture description',
      encodingOptions: { ...DEFAULT_ENCODING_OPTIONS } satisfies EncodingOptions,
      tags: 'one, two',
      title: 'Fixture title',
    },
  };

  return {
    error: null,
    loading: false,
    metadataByFilename,
    onAddToLibrary: vi.fn(),
    onDescriptionChange: vi.fn(),
    onEncodingOptionsChange: vi.fn(),
    onRefresh: vi.fn(),
    onTagsChange: vi.fn(),
    onTitleChange: vi.fn(),
    pendingFiles: [pendingFile],
    processingFiles: new Set<string>(),
    successMessage: null,
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

describe('AddVideosView parity target', () => {
  test('preserves the current empty-state copy and refresh action', () => {
    renderView(createViewProps({
      metadataByFilename: {},
      pendingFiles: [],
    }));

    expect(screen.getByRole('heading', { level: 1, name: 'Add Videos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Library' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('heading', { level: 3, name: 'No videos to add' })).toBeInTheDocument();
    expect(screen.getByText('Place video files in the uploads folder and click the refresh button.')).toBeInTheDocument();
    expect(screen.getByText('Supported formats: MP4, AVI, MKV, MOV, WebM, M4V, FLV, WMV')).toBeInTheDocument();
  });

  test('preserves the current populated-file labels, alerts, and primary action copy', () => {
    renderView(createViewProps({
      error: 'Network error occurred.',
      successMessage: '"Fixture title" has been added to the library.',
    }));

    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(screen.getByText('Network error occurred.')).toBeInTheDocument();
    expect(screen.getByText('"Fixture title" has been added to the library.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Pending Files (1)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'fixture-video.mp4' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title *')).toHaveValue('Fixture title');
    expect(screen.getByLabelText('Tags')).toHaveValue('one, two');
    expect(screen.getByLabelText('Description (optional)')).toHaveValue('Fixture description');
    expect(screen.getByRole('button', { name: 'Add to Library' })).toBeInTheDocument();
    expect(screen.getByText('Browser Playback Encoding')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Configure' })).toBeInTheDocument();
  });
});
