import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const requireProtectedPageSessionMock = vi.fn();
const loadVideoMetadataVocabularyMock = vi.fn();
const useLoaderDataMock = vi.fn();
const addVideosPageRenderSpy = vi.fn((props: unknown) => (
  <div data-testid="add-videos-page-stub">{JSON.stringify(props)}</div>
));

const vocabularyFixture = {
  contentTypes: [{ active: true, label: 'Movie', slug: 'movie', sortOrder: 10 }],
  genres: [{ active: true, label: 'Action', slug: 'action', sortOrder: 10 }],
};

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');

  return {
    ...actual,
    useLoaderData: () => useLoaderDataMock(),
  };
});

vi.mock('~/composition/server/auth', () => ({
  requireProtectedPageSession: requireProtectedPageSessionMock,
}));

vi.mock('~/composition/server/library', () => ({
  getServerLibraryServices: () => ({
    loadVideoMetadataVocabulary: {
      execute: loadVideoMetadataVocabularyMock,
    },
  }),
}));

vi.mock('~/pages/add-videos/ui/AddVideosPage', () => ({
  AddVideosPage: (props: unknown) => addVideosPageRenderSpy(props),
}));

async function importAddVideosRoute() {
  return import('../../../app/routes/add-videos');
}

describe('/add-videos route adapter', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireProtectedPageSessionMock.mockResolvedValue({ id: 'session-1' });
    loadVideoMetadataVocabularyMock.mockResolvedValue({
      data: vocabularyFixture,
      ok: true,
    });
  });

  test('delegates the protected loader to auth and metadata vocabulary services', async () => {
    const { loader } = await importAddVideosRoute();

    await expect(loader({
      request: new Request('http://localhost/add-videos'),
    } as never)).resolves.toEqual({
      contentTypes: vocabularyFixture.contentTypes,
      genres: vocabularyFixture.genres,
    });

    expect(requireProtectedPageSessionMock).toHaveBeenCalledWith(expect.any(Request));
    expect(loadVideoMetadataVocabularyMock).toHaveBeenCalledOnce();
  });

  test('renders the active page module from app/pages', async () => {
    useLoaderDataMock.mockReturnValue(vocabularyFixture);
    const routeModule = await importAddVideosRoute();

    const html = renderToString(
      <MemoryRouter>
        <routeModule.default />
      </MemoryRouter>,
    );

    expect(addVideosPageRenderSpy).toHaveBeenCalledOnce();
    expect(addVideosPageRenderSpy).toHaveBeenCalledWith({
      contentTypes: vocabularyFixture.contentTypes,
      genres: vocabularyFixture.genres,
    });
    expect(html).toContain('movie');
  });
});
