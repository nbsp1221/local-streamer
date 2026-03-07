import { useEffect } from 'react';
import type { PublicUser } from '~/legacy/types/auth';
import { useAuthStore } from '~/legacy/stores/auth-store';

interface AuthInitializerProps {
  initialUser: PublicUser | null;
}

export function AuthInitializer({ initialUser }: AuthInitializerProps) {
  const setUser = useAuthStore(state => state.setUser);

  useEffect(() => {
    setUser(initialUser);
  }, [initialUser, setUser]);

  return null;
}
