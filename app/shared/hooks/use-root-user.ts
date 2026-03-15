import { useRouteLoaderData } from 'react-router';

export interface RootUser {
  email: string;
  id: string;
  role: 'admin' | 'user';
}

export function useRootUser(): RootUser | null {
  const data = useRouteLoaderData('root') as { user?: RootUser | null } | undefined;
  return data?.user ?? null;
}
