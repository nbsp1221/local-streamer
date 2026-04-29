import { randomUUID } from 'node:crypto';
import { redirect } from 'react-router';
import type { SiteViewer } from '~/modules/auth/domain/site-viewer';
import { CreateAuthSessionUseCase } from '~/modules/auth/application/use-cases/create-auth-session.usecase';
import { DestroyAuthSessionUseCase } from '~/modules/auth/application/use-cases/destroy-auth-session.usecase';
import { EvaluateSiteAccessUseCase } from '~/modules/auth/application/use-cases/evaluate-site-access.usecase';
import { ResolveAuthSessionUseCase } from '~/modules/auth/application/use-cases/resolve-auth-session.usecase';
import { EnvSharedPasswordVerifier } from '~/modules/auth/infrastructure/password/env-shared-password.verifier';
import { InMemoryLoginAttemptGuard } from '~/modules/auth/infrastructure/security/in-memory-login-attempt-guard';
import { SqliteSessionRepository } from '~/modules/auth/infrastructure/sqlite/sqlite-session.repository';
import { ConfigSiteViewerResolver } from '~/modules/auth/infrastructure/viewer/config-site-viewer.resolver';
import { getPrimaryStorageConfig } from '~/modules/storage/infrastructure/config/storage-config.server';
import {
  getAuthConfig,
  getAuthCookieConfig,
  getAuthRuntimeState,
} from '~/shared/config/auth.server';
import { getCookieValue, serializeCookie } from '~/shared/lib/http/cookies.server';

interface ServerSessionServices {
  destroyAuthSession: DestroyAuthSessionUseCase;
  evaluateSiteAccess: EvaluateSiteAccessUseCase;
  resolveSiteViewer: () => Promise<SiteViewer>;
  resolveAuthSession: ResolveAuthSessionUseCase;
}

interface CachedServerSessionServices extends ServerSessionServices {
  sessionRepository: SqliteSessionRepository;
}

interface ServerAuthServices extends ServerSessionServices {
  createAuthSession: CreateAuthSessionUseCase;
}

let cachedAuthServices: ServerAuthServices | null = null;
let cachedSessionServices: CachedServerSessionServices | null = null;

function getCachedServerSessionServices(): CachedServerSessionServices {
  if (cachedSessionServices) {
    return cachedSessionServices;
  }

  const authCookieConfig = getAuthCookieConfig();
  const sessionRepository = new SqliteSessionRepository({
    dbPath: getPrimaryStorageConfig().databasePath,
  });
  const siteViewerResolver = new ConfigSiteViewerResolver();
  const resolveAuthSession = new ResolveAuthSessionUseCase({
    sessionRepository,
    sessionTtlMs: authCookieConfig.sessionTtlMs,
  });

  cachedSessionServices = {
    destroyAuthSession: new DestroyAuthSessionUseCase({
      sessionRepository,
    }),
    evaluateSiteAccess: new EvaluateSiteAccessUseCase({
      resolveAuthSession,
    }),
    resolveSiteViewer: async () => siteViewerResolver.resolveViewer(),
    resolveAuthSession,
    sessionRepository,
  };

  return cachedSessionServices;
}

export async function resolveSiteViewer(): Promise<SiteViewer> {
  return getServerSessionServices().resolveSiteViewer();
}

export function getServerSessionServices(): ServerSessionServices {
  const { sessionRepository: _sessionRepository, ...services } = getCachedServerSessionServices();

  return services;
}

export function getServerAuthServices(): ServerAuthServices {
  if (cachedAuthServices) {
    return cachedAuthServices;
  }

  const authRuntimeState = getAuthRuntimeState();

  if (!authRuntimeState.isConfigured) {
    throw new Error(authRuntimeState.configurationError || 'Shared-password auth is not configured');
  }

  const authConfig = getAuthConfig();
  const sessionServices = getCachedServerSessionServices();
  const loginAttemptGuard = new InMemoryLoginAttemptGuard({
    blockDurationMs: authConfig.failedLoginBlockDurationMs,
    maxFailures: authConfig.maxFailedLoginAttempts,
    windowMs: authConfig.failedLoginWindowMs,
  });

  cachedAuthServices = {
    createAuthSession: new CreateAuthSessionUseCase({
      createSessionId: randomUUID,
      loginAttemptGuard,
      onInvalidPassword: async () => {
        await new Promise(resolve => setTimeout(resolve, authConfig.failedLoginDelayMs));
      },
      passwordVerifier: new EnvSharedPasswordVerifier({
        sharedPassword: authConfig.sharedPassword,
      }),
      sessionRepository: sessionServices.sessionRepository,
      sessionTtlMs: authConfig.sessionTtlMs,
    }),
    destroyAuthSession: sessionServices.destroyAuthSession,
    evaluateSiteAccess: sessionServices.evaluateSiteAccess,
    resolveSiteViewer: sessionServices.resolveSiteViewer,
    resolveAuthSession: sessionServices.resolveAuthSession,
  };

  return cachedAuthServices;
}

export function getSiteSessionId(request: Request): string | null {
  return getCookieValue(request, getAuthCookieConfig().sessionCookieName);
}

export function createSessionCookieHeader(sessionId: string): string {
  const authConfig = getAuthCookieConfig();

  return serializeCookie(authConfig.sessionCookieName, sessionId, {
    httpOnly: true,
    maxAge: Math.floor(authConfig.sessionTtlMs / 1000),
    path: authConfig.sessionCookiePath,
    sameSite: 'Strict',
    secure: authConfig.sessionCookieSecure,
  });
}

export function createClearedSessionCookieHeader(): string {
  const authConfig = getAuthCookieConfig();

  return serializeCookie(authConfig.sessionCookieName, '', {
    httpOnly: true,
    maxAge: 0,
    path: authConfig.sessionCookiePath,
    sameSite: 'Strict',
    secure: authConfig.sessionCookieSecure,
  });
}

export async function getOptionalSiteViewer(request: Request): Promise<SiteViewer | null> {
  if (!getAuthRuntimeState().isConfigured) {
    return null;
  }

  const sessionServices = getServerSessionServices();
  const session = await sessionServices.resolveAuthSession.execute({
    now: new Date(),
    sessionId: getSiteSessionId(request),
  });

  return session ? sessionServices.resolveSiteViewer() : null;
}

async function requireProtectedSessionAccess(
  request: Request,
  surface: 'protected-page' | 'protected-api' | 'media-resource',
) {
  const sessionServices = getServerSessionServices();

  return sessionServices.evaluateSiteAccess.execute({
    now: new Date(),
    sessionId: getSiteSessionId(request),
    surface,
  });
}

export async function requireProtectedPageSession(request: Request) {
  if (!getAuthRuntimeState().isConfigured) {
    throw redirect('/login?misconfigured=1');
  }

  const access = await requireProtectedSessionAccess(request, 'protected-page');

  if (!access.decision.allowed) {
    const url = new URL(request.url);
    const redirectTo = url.pathname + url.search;
    const searchParams = new URLSearchParams([['redirectTo', redirectTo]]);
    throw redirect(`/login?${searchParams}`);
  }

  return access.session;
}

function createUnauthorizedAuthResponse(status: 401 | 503, error: string): Response {
  return Response.json({ success: false, error }, { status });
}

async function requireProtectedHttpSession(
  request: Request,
  surface: 'protected-api' | 'media-resource',
) {
  if (!getAuthRuntimeState().isConfigured) {
    return createUnauthorizedAuthResponse(503, 'Authentication is not configured');
  }

  const access = await requireProtectedSessionAccess(request, surface);

  if (!access.decision.allowed) {
    return createUnauthorizedAuthResponse(401, 'Authentication required');
  }

  return null;
}

export async function requireProtectedApiSession(request: Request) {
  return requireProtectedHttpSession(request, 'protected-api');
}

export async function requireProtectedMediaSession(request: Request) {
  return requireProtectedHttpSession(request, 'media-resource');
}
