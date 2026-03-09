import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, test } from 'vitest';

describe('PlayerPage SSR safety', () => {
  test('renders a server-safe loading shell for protected playback sources', async () => {
    const { PlayerPage } = await import('../../../app/pages/player/ui/PlayerPage');

    const html = renderToString(
      <MemoryRouter>
        <PlayerPage
          relatedVideos={[]}
          video={{
            createdAt: new Date('2026-03-09T00:00:00.000Z'),
            duration: 90,
            id: 'video-1',
            tags: ['vault'],
            title: 'Fixture player video',
            videoUrl: '/videos/video-1/manifest.mpd',
          }}
        />
      </MemoryRouter>,
    );

    expect(html).toContain('Preparing secure playback');
    expect(html).toContain('Fixture player video');
    expect(html).not.toContain('Protected playback');
    expect(html).not.toContain('Vault player');
  });
});
