import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, test, vi } from 'vitest';

const useLoaderDataMock = vi.fn();
const homePageMock = vi.fn((props: unknown) => (
  <div data-testid="mock-home-page">{JSON.stringify(props)}</div>
));

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');

  return {
    ...actual,
    useLoaderData: () => useLoaderDataMock(),
  };
});

vi.mock('~/legacy/pages/home/ui/HomePage', () => ({
  HomePage: (props: unknown) => homePageMock(props),
}));

describe('HomeRoute bootstrap forwarding', () => {
  test('passes initialFilters, videos, and pendingVideos through to the legacy HomePage compatibility component', async () => {
    useLoaderDataMock.mockReturnValue({
      initialFilters: {
        query: 'Action',
        tags: ['Action'],
      },
      pendingVideos: [
        {
          filename: 'pending.mp4',
          id: 'pending-1',
          size: 128,
          type: 'video/mp4',
        },
      ],
      videos: [
        {
          createdAt: new Date('2026-03-11T00:00:00.000Z'),
          duration: 180,
          id: 'video-1',
          tags: ['Action'],
          title: 'Catalog Fixture',
          videoUrl: '/videos/video-1/manifest.mpd',
        },
      ],
    });
    const routeModule = await import('../../../app/routes/_index');

    render(React.createElement(routeModule.default));

    expect(screen.getByTestId('mock-home-page')).toBeInTheDocument();
    expect(homePageMock).toHaveBeenCalledWith(expect.objectContaining({
      initialFilters: {
        query: 'Action',
        tags: ['Action'],
      },
      pendingVideos: [
        {
          filename: 'pending.mp4',
          id: 'pending-1',
          size: 128,
          type: 'video/mp4',
        },
      ],
      videos: [
        expect.objectContaining({
          id: 'video-1',
        }),
      ],
    }));
  });
});
