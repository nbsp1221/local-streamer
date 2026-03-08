import { beforeEach, describe, expect, test } from 'vitest';
import { useAuthStore } from './auth-store';

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      isAuthenticated: false,
      user: null,
    });
  });

  test('keeps only mirrored auth state actions', () => {
    const state = useAuthStore.getState();

    expect(state).toHaveProperty('setUser');
    expect(state).toHaveProperty('clearUser');
    expect(state).not.toHaveProperty('login');
    expect(state).not.toHaveProperty('logout');
    expect(state).not.toHaveProperty('fetchUser');
  });

  test('clearUser resets mirrored auth state', () => {
    useAuthStore.getState().setUser({
      createdAt: new Date('2026-03-09T00:00:00.000Z'),
      email: 'admin@example.com',
      id: 'user-1',
      role: 'admin',
      updatedAt: new Date('2026-03-09T00:00:00.000Z'),
    });

    useAuthStore.getState().clearUser();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
