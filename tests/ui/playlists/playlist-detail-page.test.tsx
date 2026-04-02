import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, test, vi } from 'vitest';
import { PlaylistDetailPage } from '../../../app/pages/playlist-detail/ui/PlaylistDetailPage';

vi.mock('~/shared/hooks/use-root-user', () => ({
  useRootUser: () => ({
    email: 'owner@example.com',
    id: 'owner-1',
    role: 'admin',
  }),
}));

describe('PlaylistDetailPage', () => {
  test('renders the active shell and playlist detail content', () => {
    render(
      <MemoryRouter initialEntries={['/playlists/playlist-1']}>
        <PlaylistDetailPage
          playlist={{
            createdAt: new Date('2026-03-08T00:00:00.000Z'),
            description: 'Owned private playlist',
            id: 'playlist-1',
            isPublic: false,
            name: 'Vault',
            ownerId: 'owner-1',
            type: 'user_created',
            updatedAt: new Date('2026-03-08T00:00:00.000Z'),
            videoIds: ['video-1'],
            videos: [{
              duration: 90,
              id: 'video-1',
              position: 1,
              title: 'playtime',
            }],
          }}
          stats={null}
          relatedPlaylists={[]}
          videoPagination={{ hasMore: false, limit: 50, offset: 0, total: 1 }}
          permissions={{ canAddVideos: true, canDelete: true, canEdit: true, canShare: true }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Local Streamer')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Vault' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Browse' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /play all/i })).toBeInTheDocument();
    expect(screen.getByText('Playlist Videos')).toBeInTheDocument();
    expect(screen.getByText('playtime')).toBeInTheDocument();
  });
});
