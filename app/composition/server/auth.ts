import { randomUUID } from 'node:crypto';
import { redirect } from 'react-router';
import { getUserRepository } from '~/legacy/repositories';
import type { PublicUser } from '~/legacy/types/auth';
import { CreateAuthSessionUseCase } from '~/modules/auth/application/use-cases/create-auth-session.usecase';
import { DestroyAuthSessionUseCase } from '~/modules/auth/application/use-cases/destroy-auth-session.usecase';
import { EvaluateSiteAccessUseCase } from '~/modules/auth/application/use-cases/evaluate-site-access.usecase';
import { ResolveAuthSessionUseCase } from '~/modules/auth/application/use-cases/resolve-auth-session.usecase';
import { EnvSharedPasswordVerifier } from '~/modules/auth/infrastructure/password/env-shared-password.verifier';
import { SqliteSessionRepository } from '~/modules/auth/infrastructure/sqlite/sqlite-session.repository';
import { getAuthConfig } from '~/shared/config/auth.server';
import { getCookieValue, serializeCookie } from '~/shared/lib/http/cookies.server';

const LEGACY_COMPATIBILITY_EMAIL = 'vault@local';

export type LegacyCompatibleUser = PublicUser;

interface ServerAuthServices {
  createAuthSession: CreateAuthSessionUseCase;
  destroyAuthSession: DestroyAuthSessionUseCase;
  evaluateSiteAccess: EvaluateSiteAccessUseCase;
  resolveAuthSession: ResolveAuthSessionUseCase;
  toLegacyCompatibleUser: () => Promise<LegacyCompatibleUser>;
}

let cachedServices: ServerAuthServices | null = null;

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

export async function resolveLegacyCompatibilityUser(): Promise<LegacyCompatibleUser> {
  return resolveLegacyCompatibilityUserFromStore();
}

export function getServerAuthServices(): ServerAuthServices {
  if (cachedServices) {
    return cachedServices;
  }

  const authConfig = getAuthConfig();
  const sessionRepository = new SqliteSessionRepository({
    dbPath: authConfig.sqlitePath,
  });
  const resolveAuthSession = new ResolveAuthSessionUseCase({
    sessionRepository,
    sessionTtlMs: authConfig.sessionTtlMs,
  });

  cachedServices = {
    createAuthSession: new CreateAuthSessionUseCase({
      createSessionId: randomUUID,
      passwordVerifier: new EnvSharedPasswordVerifier({
        sharedPassword: authConfig.sharedPassword,
      }),
      sessionRepository,
      sessionTtlMs: authConfig.sessionTtlMs,
    }),
    destroyAuthSession: new DestroyAuthSessionUseCase({
      sessionRepository,
    }),
    evaluateSiteAccess: new EvaluateSiteAccessUseCase({
      resolveAuthSession,
    }),
    resolveAuthSession,
    toLegacyCompatibleUser: resolveLegacyCompatibilityUser,
  };

  return cachedServices;
}

export function getSiteSessionId(request: Request): string | null {
  return getCookieValue(request, getAuthConfig().sessionCookieName);
}

export function createSessionCookieHeader(sessionId: string): string {
  const authConfig = getAuthConfig();

  return serializeCookie(authConfig.sessionCookieName, sessionId, {
    httpOnly: true,
    maxAge: Math.floor(authConfig.sessionTtlMs / 1000),
    path: authConfig.sessionCookiePath,
    sameSite: 'Strict',
    secure: authConfig.sessionCookieSecure,
  });
}

export function createClearedSessionCookieHeader(): string {
  const authConfig = getAuthConfig();

  return serializeCookie(authConfig.sessionCookieName, '', {
    httpOnly: true,
    maxAge: 0,
    path: authConfig.sessionCookiePath,
    sameSite: 'Strict',
    secure: authConfig.sessionCookieSecure,
  });
}

export async function getOptionalLegacyCompatibleUser(request: Request): Promise<LegacyCompatibleUser | null> {
  const authServices = getServerAuthServices();
  const session = await authServices.resolveAuthSession.execute({
    now: new Date(),
    sessionId: getSiteSessionId(request),
  });

  return session ? authServices.toLegacyCompatibleUser() : null;
}

export async function requireProtectedPageSession(request: Request) {
  const authServices = getServerAuthServices();
  const access = await authServices.evaluateSiteAccess.execute({
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
  const authServices = getServerAuthServices();
  const access = await authServices.evaluateSiteAccess.execute({
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
  const authServices = getServerAuthServices();
  const access = await authServices.evaluateSiteAccess.execute({
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
