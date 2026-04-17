import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const requireProtectedPageSessionMock = vi.fn();
const addVideosPageRenderSpy = vi.fn(() => <div data-testid="add-videos-page-stub">Add Videos Page Stub</div>);

vi.mock('~/composition/server/auth', () => ({
  requireProtectedPageSession: requireProtectedPageSessionMock,
}));

vi.mock('~/pages/add-videos/ui/AddVideosPage', () => ({
  AddVideosPage: () => addVideosPageRenderSpy(),
}));

async function importAddVideosRoute() {
  return import('../../../app/routes/add-videos');
}

describe('/add-videos route adapter', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireProtectedPageSessionMock.mockResolvedValue({ id: 'session-1' });
  });

  test('delegates the protected loader to requireProtectedPageSession', async () => {
    const { loader } = await importAddVideosRoute();

    await expect(loader({
      request: new Request('http://localhost/add-videos'),
    } as never)).resolves.toEqual({});

    expect(requireProtectedPageSessionMock).toHaveBeenCalledWith(expect.any(Request));
  });

  test('renders the active page module from app/pages', async () => {
    const routeModule = await importAddVideosRoute();

    const html = renderToString(
      <MemoryRouter>
        <routeModule.default />
      </MemoryRouter>,
    );

    expect(addVideosPageRenderSpy).toHaveBeenCalledOnce();
    expect(html).toContain('Add Videos Page Stub');
  });
});
