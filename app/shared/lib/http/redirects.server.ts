export function getSafeRedirectTarget(request: Request, fallbackPath: string): string {
  const url = new URL(request.url);
  const candidate = url.searchParams.get('redirectTo');

  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return fallbackPath;
  }

  return candidate;
}
