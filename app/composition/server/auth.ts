import { randomUUID } from 'node:crypto';
import { redirect } from 'react-router';
import type { PublicUser } from '~/legacy/types/auth';
import { getUserRepository } from '~/legacy/repositories';
import { CreateAuthSessionUseCase } from '~/modules/auth/application/use-cases/create-auth-session.usecase';
import { DestroyAuthSessionUseCase } from '~/modules/auth/application/use-cases/destroy-auth-session.usecase';
import { EvaluateSiteAccessUseCase } from '~/modules/auth/application/use-cases/evaluate-site-access.usecase';
import { ResolveAuthSessionUseCase } from '~/modules/auth/application/use-cases/resolve-auth-session.usecase';
import { EnvSharedPasswordVerifier } from '~/modules/auth/infrastructure/password/env-shared-password.verifier';
import { InMemoryLoginAttemptGuard } from '~/modules/auth/infrastructure/security/in-memory-login-attempt-guard';
import { SqliteSessionRepository } from '~/modules/auth/infrastructure/sqlite/sqlite-session.repository';
import {
  getAuthConfig,
  getAuthCookieConfig,
  getAuthRuntimeState,
  getAuthSessionConfig,
} from '~/shared/config/auth.server';
import { getCookieValue, serializeCookie } from '~/shared/lib/http/cookies.server';

const LEGACY_COMPATIBILITY_EMAIL = 'vault@local';

export type LegacyCompatibleUser = PublicUser;

interface ServerSessionServices {
  destroyAuthSession: DestroyAuthSessionUseCase;
  evaluateSiteAccess: EvaluateSiteAccessUseCase;
  resolveAuthSession: ResolveAuthSessionUseCase;
  toLegacyCompatibleUser: () => Promise<LegacyCompatibleUser>;
}

interface CachedServerSessionServices extends ServerSessionServices {
  sessionRepository: SqliteSessionRepository;
}

interface ServerAuthServices extends ServerSessionServices {
  createAuthSession: CreateAuthSessionUseCase;
}

let cachedAuthServices: ServerAuthServices | null = null;
let cachedSessionServices: CachedServerSessionServices | null = null;

async function resolveLegacyCompatibilityUserFromStore(): Promise<LegacyCompatibleUser> {
  const userRepository = getUserRepository();
  const existingCompatibilityUser = await userRepository.findByEmail(LEGACY_COMPATIBILITY_EMAIL);

  if (existingCompatibilityUser) {
    return userRepository.toPublicUser(existingCompatibilityUser);
  }

  const [adminUser] = await userRepository.findByRole('admin');
  if (adminUser) {
    return userRepository.toPublicUser(adminUser);
  }

  const [firstUser] = await userRepository.findAll();
  if (firstUser) {
    return userRepository.toPublicUser(firstUser);
  }

  try {
    const createdUser = await userRepository.create({
      email: LEGACY_COMPATIBILITY_EMAIL,
      password: randomUUID(),
      role: 'admin',
    });

    return userRepository.toPublicUser(createdUser);
  }
  catch (error) {
    const racedCompatibilityUser = await userRepository.findByEmail(LEGACY_COMPATIBILITY_EMAIL);

    if (racedCompatibilityUser) {
      return userRepository.toPublicUser(racedCompatibilityUser);
    }

    throw error;
  }
}

function getCachedServerSessionServices(): CachedServerSessionServices {
  if (cachedSessionServices) {
    return cachedSessionServices;
  }

  const sessionConfig = getAuthSessionConfig();
  const sessionRepository = new SqliteSessionRepository({
    dbPath: sessionConfig.sqlitePath,
  });
  const resolveAuthSession = new ResolveAuthSessionUseCase({
    sessionRepository,
    sessionTtlMs: sessionConfig.sessionTtlMs,
  });

  cachedSessionServices = {
    destroyAuthSession: new DestroyAuthSessionUseCase({
      sessionRepository,
    }),
    evaluateSiteAccess: new EvaluateSiteAccessUseCase({
      resolveAuthSession,
    }),
    resolveAuthSession,
    sessionRepository,
    toLegacyCompatibleUser: resolveLegacyCompatibilityUser,
  };

  return cachedSessionServices;
}

export async function resolveLegacyCompatibilityUser(): Promise<LegacyCompatibleUser> {
  return resolveLegacyCompatibilityUserFromStore();
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
    resolveAuthSession: sessionServices.resolveAuthSession,
    toLegacyCompatibleUser: sessionServices.toLegacyCompatibleUser,
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

export async function getOptionalLegacyCompatibleUser(request: Request): Promise<LegacyCompatibleUser | null> {
  if (!getAuthRuntimeState().isConfigured) {
    return null;
  }

  const sessionServices = getServerSessionServices();
  const session = await sessionServices.resolveAuthSession.execute({
    now: new Date(),
    sessionId: getSiteSessionId(request),
  });

  return session ? sessionServices.toLegacyCompatibleUser() : null;
}

export async function requireProtectedPageSession(request: Request) {
  if (!getAuthRuntimeState().isConfigured) {
    throw redirect('/login?misconfigured=1');
  }

  const sessionServices = getServerSessionServices();
  const access = await sessionServices.evaluateSiteAccess.execute({
    now: new Date(),
    sessionId: getSiteSessionId(request),
    surface: 'protected-page',
  });

  if (!access.decision.allowed) {
    const url = new URL(request.url);
    const redirectTo = url.pathname + url.search;
    const searchParams = new URLSearchParams([['redirectTo', redirectTo]]);
    throw redirect(`/login?${searchParams}`);
  }

  return access.session;
}

export async function requireProtectedApiSession(request: Request) {
  if (!getAuthRuntimeState().isConfigured) {
    return Response.json(
      { success: false, error: 'Authentication is not configured' },
      { status: 503 },
    );
  }

  const sessionServices = getServerSessionServices();
  const access = await sessionServices.evaluateSiteAccess.execute({
    now: new Date(),
    sessionId: getSiteSessionId(request),
    surface: 'protected-api',
  });

  if (!access.decision.allowed) {
    return Response.json(
      { success: false, error: 'Authentication required' },
      { status: 401 },
    );
  }

  return null;
}

export async function requireProtectedMediaSession(request: Request) {
  if (!getAuthRuntimeState().isConfigured) {
    return Response.json(
      { success: false, error: 'Authentication is not configured' },
      { status: 503 },
    );
  }

  const sessionServices = getServerSessionServices();
  const access = await sessionServices.evaluateSiteAccess.execute({
    now: new Date(),
    sessionId: getSiteSessionId(request),
    surface: 'media-resource',
  });

  if (!access.decision.allowed) {
    return Response.json(
      { success: false, error: 'Authentication required' },
      { status: 401 },
    );
  }

  return null;
}
