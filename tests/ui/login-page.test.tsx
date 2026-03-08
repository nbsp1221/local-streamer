import type { ComponentProps } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { LoginPage } from '~/pages/login/ui/LoginPage';

function renderLoginPage(
  initialEntry: string = '/login',
  loginPageProps?: ComponentProps<typeof LoginPage>,
) {
  const router = createMemoryRouter([
    {
      path: '/login',
      element: <LoginPage {...loginPageProps} />,
    },
    {
      path: '/',
      element: <div>Library home</div>,
    },
    {
      path: '/vault',
      element: <div>Vault destination</div>,
    },
  ], {
    initialEntries: [initialEntry],
  });

  return {
    router,
    user: userEvent.setup(),
    ...render(<RouterProvider router={router} />),
  };
}

describe('LoginPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('renders an accessible heading and labeled password field', () => {
    renderLoginPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Unlock your vault' })).toBeInTheDocument();
    expect(screen.getByLabelText('Shared password')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeInTheDocument();
  });

  test('shows an error alert when login fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(
        JSON.stringify({ success: false, error: 'Invalid password' }),
        {
          headers: {
            'Content-Type': 'application/json',
          },
          status: 401,
        },
      )) as unknown as typeof fetch,
    );

    const { router, user } = renderLoginPage();

    await user.type(screen.getByLabelText('Shared password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid password');
    expect(router.state.location.pathname).toBe('/login');
  });

  test('navigates to redirect target after successful login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(
        JSON.stringify({ success: true, user: { id: 'user-1' } }),
        {
          headers: {
            'Content-Type': 'application/json',
          },
          status: 200,
        },
      )) as unknown as typeof fetch,
    );

    const { router, user } = renderLoginPage('/login?redirectTo=%2Fvault');

    await user.type(screen.getByLabelText('Shared password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/vault');
    });

    expect(screen.getByText('Vault destination')).toBeInTheDocument();
  });

  test('shows a configuration error and disables login controls when auth is misconfigured', () => {
    renderLoginPage('/login', {
      authConfigured: false,
      configurationError: 'AUTH_SHARED_PASSWORD environment variable is required',
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'AUTH_SHARED_PASSWORD environment variable is required',
    );
    expect(screen.getByLabelText('Shared password')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeDisabled();
  });
});
