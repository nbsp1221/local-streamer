import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import type { CreatePlaylistUseCaseRequest } from '~/legacy/modules/playlist/commands/create-playlist/create-playlist.types';
import type { PlaylistFilters, PlaylistType } from '~/legacy/modules/playlist/domain/playlist.types';
import type { FindPlaylistsUseCaseRequest } from '~/legacy/modules/playlist/queries/find-playlists/find-playlists.types';
import { requireProtectedApiSession, resolveLegacyCompatibilityUser } from '~/composition/server/auth';
import { CreatePlaylistUseCase } from '~/legacy/modules/playlist/commands/create-playlist/create-playlist.usecase';
import { FindPlaylistsUseCase } from '~/legacy/modules/playlist/queries/find-playlists/find-playlists.usecase';
import { getPlaylistRepository, getUserRepository } from '~/legacy/repositories';
import { createErrorResponse, handleUseCaseResult } from '~/legacy/utils/error-response.server';

const playlistTypes: PlaylistType[] = ['user_created', 'series', 'season', 'auto_generated'];
const playlistStatuses: NonNullable<PlaylistFilters['status']>[] = ['ongoing', 'completed', 'hiatus'];
const playlistSortFields: NonNullable<FindPlaylistsUseCaseRequest['sortBy']>[] = ['name', 'createdAt', 'updatedAt', 'videoCount', 'popularity'];
const sortOrders: NonNullable<FindPlaylistsUseCaseRequest['sortOrder']>[] = ['asc', 'desc'];

function parsePlaylistType(value: string | null): PlaylistType | undefined {
  if (value === null) {
    return undefined;
  }

  return playlistTypes.includes(value as PlaylistType)
    ? value as PlaylistType
    : undefined;
}

function parsePlaylistStatus(value: string | null): PlaylistFilters['status'] {
  if (value === null) {
    return undefined;
  }

  return playlistStatuses.includes(value as NonNullable<PlaylistFilters['status']>)
    ? value as NonNullable<PlaylistFilters['status']>
    : undefined;
}

function parseSortBy(value: string | null): NonNullable<FindPlaylistsUseCaseRequest['sortBy']> {
  if (value === null) {
    return 'updatedAt';
  }

  return playlistSortFields.includes(value as NonNullable<FindPlaylistsUseCaseRequest['sortBy']>)
    ? value as NonNullable<FindPlaylistsUseCaseRequest['sortBy']>
    : 'updatedAt';
}

function parseSortOrder(value: string | null): NonNullable<FindPlaylistsUseCaseRequest['sortOrder']> {
  if (value === null) {
    return 'desc';
  }

  return sortOrders.includes(value as NonNullable<FindPlaylistsUseCaseRequest['sortOrder']>)
    ? value as NonNullable<FindPlaylistsUseCaseRequest['sortOrder']>
    : 'desc';
}

/**
 * GET /api/playlists - List playlists with filtering and pagination
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const unauthorizedResponse = await requireProtectedApiSession(request);
    if (unauthorizedResponse) return unauthorizedResponse;
    const user = await resolveLegacyCompatibilityUser();
    const userId = user.id;

    // Parse query parameters
    const url = new URL(request.url);
    const filters: PlaylistFilters = {
      type: parsePlaylistType(url.searchParams.get('type')),
      searchQuery: url.searchParams.get('q') || undefined,
      genre: url.searchParams.getAll('genre'),
      isPublic: url.searchParams.get('isPublic') === 'true'
        ? true
        : url.searchParams.get('isPublic') === 'false' ? false : undefined,
      seriesName: url.searchParams.get('seriesName') || undefined,
      status: parsePlaylistStatus(url.searchParams.get('status')),
    };

    const sortBy = parseSortBy(url.searchParams.get('sortBy'));
    const sortOrder = parseSortOrder(url.searchParams.get('sortOrder'));
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const includeStats = url.searchParams.get('includeStats') === 'true';
    const includeEmpty = url.searchParams.get('includeEmpty') !== 'false';

    // Create use case with dependencies
    const useCase = new FindPlaylistsUseCase({
      playlistRepository: getPlaylistRepository(),
      userRepository: getUserRepository(),
      logger: console,
    });

    // Execute use case
    const result = await useCase.execute({
      userId,
      filters,
      sortBy,
      sortOrder,
      limit,
      offset,
      includeStats,
      includeEmpty,
    });

    // Handle result
    const response = handleUseCaseResult(result);
    if (response instanceof Response) {
      return response;
    }

    return Response.json({
      success: true,
      ...response,
    });
  }
  catch (error) {
    console.error('Unexpected error in find playlists route:', error);
    return createErrorResponse(error);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  // Only allow POST requests for playlist creation
  if (request.method !== 'POST') {
    return Response.json(
      { success: false, error: 'Method not allowed' },
      { status: 405 },
    );
  }

  try {
    const unauthorizedResponse = await requireProtectedApiSession(request);
    if (unauthorizedResponse) return unauthorizedResponse;
    const user = await resolveLegacyCompatibilityUser();
    const userId = user.id;

    // Parse request body
    const body = await request.json() as Partial<CreatePlaylistUseCaseRequest>;

    // Create use case with dependencies
    const useCase = new CreatePlaylistUseCase({
      playlistRepository: getPlaylistRepository(),
      userRepository: getUserRepository(),
      logger: console, // Using console as logger for now
    });

    // Execute use case with request data including user ID
    const requestData: CreatePlaylistUseCaseRequest = {
      ...body,
      userId,
    } as CreatePlaylistUseCaseRequest;

    const result = await useCase.execute(requestData);

    // Handle result with type-safe error handling
    const response = handleUseCaseResult(result);
    if (response instanceof Response) {
      return response;
    }

    return Response.json({
      success: true,
      ...response,
    });
  }
  catch (error) {
    console.error('Unexpected error in create playlist route:', error);
    return createErrorResponse(error);
  }
}
