import { create } from 'zustand';
import type { PublicUser } from '~/legacy/types/auth';

interface AuthState {
  user: PublicUser | null;
  isAuthenticated: boolean;
}

interface AuthActions {
  clearUser: () => void;
  setUser: (user: PublicUser | null) => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,

  setUser: (user) => {
    set({ user, isAuthenticated: Boolean(user) });
  },
  clearUser: () => {
    set({ user: null, isAuthenticated: false });
  },
}));

export const useAuthUser = () => useAuthStore(state => state.user);
