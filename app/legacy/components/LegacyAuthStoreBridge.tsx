import { useEffect } from 'react';
import type { PublicUser } from '~/legacy/types/auth';
import { useAuthStore } from '~/legacy/stores/auth-store';

interface LegacyAuthStoreBridgeProps {
  initialUser: PublicUser | null;
}

export function LegacyAuthStoreBridge({ initialUser }: LegacyAuthStoreBridgeProps) {
  const setUser = useAuthStore(state => state.setUser);

  useEffect(() => {
    setUser(initialUser);
  }, [initialUser, setUser]);

  return null;
}
