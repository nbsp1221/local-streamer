import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, test, vi } from 'vitest';

const useLoaderDataMock = vi.fn();
const useSearchParamsMock = vi.fn(() => [new URLSearchParams('q=Action&tag=Action'), vi.fn()] as const);
const homePageMock = vi.fn((props: unknown) => (
  <div data-testid="mock-home-page">{JSON.stringify(props)}</div>
));

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');

  return {
    ...actual,
    useLoaderData: () => useLoaderDataMock(),
    useSearchParams: () => useSearchParamsMock(),
  };
});

vi.mock('~/pages/home/ui/HomePage', () => ({
  HomePage: (props: unknown) => homePageMock(props),
}));

describe('HomeRoute bootstrap forwarding', () => {
  test('passes initialFilters, videos, and pendingVideos through to the new HomePage owner', async () => {
    useLoaderDataMock.mockReturnValue({
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
          createdAt: '2026-03-11T00:00:00.000Z',
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
          createdAt: expect.any(Date),
          id: 'video-1',
        }),
      ],
    }));
  });

  test('keeps deserialized video references stable across same-snapshot rerenders', async () => {
    const loaderSnapshot = {
      pendingVideos: [],
      videos: [
        {
          createdAt: '2026-03-11T00:00:00.000Z',
          duration: 180,
          id: 'video-1',
          tags: ['Action'],
          title: 'Catalog Fixture',
          videoUrl: '/videos/video-1/manifest.mpd',
        },
      ],
    };
    useLoaderDataMock.mockReturnValue(loaderSnapshot);
    const routeModule = await import('../../../app/routes/_index');
    const { rerender } = render(React.createElement(routeModule.default));

    const firstCallProps = homePageMock.mock.lastCall?.[0] as {
      videos: Array<{ id: string }>;
    };

    rerender(React.createElement(routeModule.default));

    const secondCallProps = homePageMock.mock.lastCall?.[0] as {
      videos: Array<{ id: string }>;
    };

    expect(firstCallProps.videos).toBe(secondCallProps.videos);
  });
});
