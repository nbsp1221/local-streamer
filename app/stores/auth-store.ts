import { create } from 'zustand';
import type { PublicUser } from '~/types/auth';

interface AuthState {
  user: PublicUser | null;
  isAuthenticated: boolean;
}

interface AuthActions {
  setUser: (user: PublicUser | null) => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set, get) => ({
  // State
  user: null,
  isAuthenticated: false,

  // Actions
  setUser: (user) => {
    set({ user, isAuthenticated: Boolean(user) });
  },

  login: async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success && data.user) {
        set({ user: data.user, isAuthenticated: true });
        // Refresh page on successful login to reflect latest state
        window.location.href = '/';
        return { success: true };
      }
      else {
        return { success: false, error: data.error || 'Login failed' };
      }
    }
    catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error' };
    }
  },

  logout: async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    }
    catch (error) {
      console.error('Logout error:', error);
    }
    finally {
      set({ user: null, isAuthenticated: false });
      // Redirect to login page after logout
      window.location.href = '/login';
    }
  },

  fetchUser: async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          set({ user: data.user, isAuthenticated: true });
        }
        else {
          set({ user: null, isAuthenticated: false });
        }
      }
      else {
        set({ user: null, isAuthenticated: false });
      }
    }
    catch (error) {
      console.error('Failed to fetch user:', error);
      set({ user: null, isAuthenticated: false });
    }
  },
}));

// Selector hooks for better performance
export const useAuthUser = () => useAuthStore(state => state.user);
export const useIsAuthenticated = () => useAuthStore(state => state.isAuthenticated);
