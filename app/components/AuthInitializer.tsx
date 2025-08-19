import { useEffect } from 'react';
import type { PublicUser } from '~/types/auth';
import { useAuthStore } from '~/stores/auth-store';

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
