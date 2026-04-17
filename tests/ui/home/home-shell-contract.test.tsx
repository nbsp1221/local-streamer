import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, test, vi } from 'vitest';

import type { HomeLibraryVideo } from '../../../app/entities/library-video/model/library-video';
import type { PendingLibraryItem } from '../../../app/entities/pending-video/model/pending-video';
import { HomePage } from '../../../app/pages/home/ui/HomePage';

const rootLoaderDataMock = vi.fn(() => ({
  user: {
    email: 'owner@example.com',
    id: 'user-1',
    role: 'admin',
  },
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');

  return {
    ...actual,
    useRouteLoaderData: () => rootLoaderDataMock(),
  };
});

function createVideo(overrides: Partial<HomeLibraryVideo> = {}): HomeLibraryVideo {
  return {
    createdAt: new Date('2026-03-11T00:00:00.000Z'),
    duration: 180,
    id: 'video-1',
    tags: ['Action', 'Neo', 'Vault'],
    thumbnailUrl: '/thumb.jpg',
    title: 'Catalog Fixture',
    videoUrl: '/videos/video-1/manifest.mpd',
    ...overrides,
  };
}

function createPendingVideo(overrides: Partial<PendingLibraryItem> = {}): PendingLibraryItem {
  return {
    filename: 'pending.mp4',
    id: 'pending-1',
    size: 128,
    type: 'video/mp4',
    ...overrides,
  };
}

describe('Home shell contract', () => {
  test('renders the approved sidebar, header, and shell affordances in the correct order', () => {
    render(
      <MemoryRouter>
        <HomePage
          initialFilters={{ query: '', tags: [] }}
          pendingVideos={[createPendingVideo()]}
          videos={[createVideo()]}
        />
      </MemoryRouter>,
    );

    const browseHeading = screen.getByRole('heading', { level: 3, name: 'Browse' });
    const libraryHeading = screen.getByRole('heading', { level: 3, name: 'Library' });
    const manageHeading = screen.getByRole('heading', { level: 3, name: 'Manage' });
    const settingsHeading = screen.getByRole('heading', { level: 3, name: 'Settings' });
    const homeLink = screen.getByRole('link', { name: 'All Videos' });
    const moviesLink = screen.getByRole('link', { name: 'Movies' });
    const dramaLink = screen.getByRole('link', { name: 'Drama Series' });
    const animationLink = screen.getByRole('link', { name: 'Animation' });
    const documentaryLink = screen.getByRole('link', { name: 'Documentary' });
    const varietyLink = screen.getByRole('link', { name: 'Variety Show' });
    const otherLink = screen.getByRole('link', { name: 'Other' });
    const playlistsLink = screen.getByRole('link', { name: 'Playlists' });
    const uploadLink = screen.getAllByRole('link', { name: /Upload/i })[0];
    const settingsLink = screen.getByRole('link', { name: 'Settings' });
    const desktopSearch = screen.getAllByPlaceholderText('Search movies, TV series...')[0];
    const pendingBadge = screen.getByText('1');
    const accountMenu = screen.getByTitle('Account Menu');

    expect(screen.getByText('Local Streamer')).toBeInTheDocument();
    expect(browseHeading.compareDocumentPosition(libraryHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(libraryHeading.compareDocumentPosition(manageHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(manageHeading.compareDocumentPosition(settingsHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(homeLink).toHaveAttribute('href', '/');
    expect(moviesLink).toHaveAttribute('href', '/?genre=movie');
    expect(dramaLink).toHaveAttribute('href', '/?genre=drama');
    expect(animationLink).toHaveAttribute('href', '/?genre=animation');
    expect(documentaryLink).toHaveAttribute('href', '/?genre=documentary');
    expect(varietyLink).toHaveAttribute('href', '/?genre=variety');
    expect(otherLink).toHaveAttribute('href', '/?genre=other');
    expect(playlistsLink).toHaveAttribute('href', '/playlists');
    expect(uploadLink).toHaveAttribute('href', '/add-videos');
    expect(settingsLink).toHaveAttribute('href', '/settings');
    expect(desktopSearch).toBeInTheDocument();
    expect(pendingBadge).toBeInTheDocument();
    expect(accountMenu).toBeInTheDocument();
  });

  test('renders desktop and mobile search controls with the approved placeholder', () => {
    render(
      <MemoryRouter>
        <HomePage
          initialFilters={{ query: 'Action', tags: [] }}
          pendingVideos={[]}
          videos={[createVideo()]}
        />
      </MemoryRouter>,
    );

    expect(screen.getAllByPlaceholderText('Search movies, TV series...')).toHaveLength(2);
    expect(screen.getAllByDisplayValue('Action')).toHaveLength(2);
  });

  test('preserves q/tag URL state when browse navigation changes the visible genre affordance', async () => {
    const user = userEvent.setup();

    function LocationProbe() {
      const location = useLocation();
      return <output data-testid="location-search">{location.search}</output>;
    }

    render(
      <MemoryRouter initialEntries={['/?q=Action&tag=Action']}>
        <HomePage
          initialFilters={{ query: 'Action', tags: ['Action'] }}
          pendingVideos={[]}
          videos={[createVideo()]}
        />
        <LocationProbe />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('link', { name: 'Movies' }));

    const nextSearch = new URLSearchParams(screen.getByTestId('location-search').textContent ?? '');
    expect(nextSearch.get('q')).toBe('Action');
    expect(nextSearch.getAll('tag')).toEqual(['Action']);
    expect(nextSearch.get('genre')).toBe('movie');
  });

  test('opens an accessible mobile navigation drawer and closes it again', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <HomePage
          initialFilters={{ query: '', tags: [] }}
          pendingVideos={[createPendingVideo()]}
          videos={[createVideo()]}
        />
      </MemoryRouter>,
    );

    const toggleButton = screen.getByRole('button', { name: 'Toggle sidebar menu' });
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog', { name: 'Navigation menu' })).not.toBeInTheDocument();

    await user.click(toggleButton);

    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog', { name: 'Navigation menu' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Movies' }));
    expect(screen.queryByRole('dialog', { name: 'Navigation menu' })).not.toBeInTheDocument();

    await user.click(toggleButton);
    expect(screen.getByRole('dialog', { name: 'Navigation menu' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Local Streamer' }));
    expect(screen.queryByRole('dialog', { name: 'Navigation menu' })).not.toBeInTheDocument();

    await user.click(toggleButton);
    expect(screen.getByRole('dialog', { name: 'Navigation menu' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Navigation menu' })).not.toBeInTheDocument();

    await user.click(toggleButton);
    expect(screen.getByRole('dialog', { name: 'Navigation menu' })).toBeInTheDocument();

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1024,
    });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Navigation menu' })).not.toBeInTheDocument();
    });
  });
});
