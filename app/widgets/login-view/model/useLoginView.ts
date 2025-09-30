import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuthStore, useIsAuthenticated } from '~/stores/auth-store';

export interface UseLoginViewResult {
  email: string;
  password: string;
  showPassword: boolean;
  loading: boolean;
  error: string | null;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onTogglePasswordVisibility: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function useLoginView(): UseLoginViewResult {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAuthenticated = useIsAuthenticated();
  const login = useAuthStore(state => state.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const redirectTo = searchParams.get('redirectTo') || '/';
    navigate(redirectTo, { replace: true });
  }, [isAuthenticated, navigate, searchParams]);

  const handleEmailChange = useCallback((value: string) => {
    setEmail(value);
  }, []);

  const handlePasswordChange = useCallback((value: string) => {
    setPassword(value);
  }, []);

  const handleTogglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setLoading(true);

    try {
      const result = await login(email, password);

      if (result.success) {
        const redirectTo = searchParams.get('redirectTo') || '/';
        navigate(redirectTo, { replace: true });
        return;
      }

      setError(result.error || 'Login failed');
    }
    catch (error) {
      console.error('Login error:', error);
      setError('Network error occurred');
    }
    finally {
      setLoading(false);
    }
  }, [email, password, login, navigate, searchParams]);

  return {
    email,
    password,
    showPassword,
    loading,
    error,
    onEmailChange: handleEmailChange,
    onPasswordChange: handlePasswordChange,
    onTogglePasswordVisibility: handleTogglePasswordVisibility,
    onSubmit: handleSubmit,
  };
}
