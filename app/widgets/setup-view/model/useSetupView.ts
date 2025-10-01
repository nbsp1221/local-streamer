import type { FormEvent } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '~/stores/auth-store';

export interface UseSetupViewReturn {
  email: string;
  password: string;
  confirmPassword: string;
  showPassword: boolean;
  showConfirmPassword: boolean;
  loading: boolean;
  error: string | null;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onToggleConfirmPassword: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

/**
 * Custom hook for setup page business logic
 * Handles admin account creation with validation and authentication
 */
export function useSetupView(): UseSetupViewReturn {
  const navigate = useNavigate();
  const setUser = useAuthStore(state => state.setUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Validates user input for admin account creation
   * @returns Error message if validation fails, null if valid
   */
  const validateInput = (): string | null => {
    if (!email || !password || !confirmPassword) {
      return 'All fields are required';
    }

    if (password !== confirmPassword) {
      return 'Passwords do not match';
    }

    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }

    if (!email.includes('@')) {
      return 'Please enter a valid email address';
    }

    return null;
  };

  /**
   * Handles form submission for admin account setup
   * Creates admin account and redirects to home page on success
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const validationError = validateInput();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success && data.user) {
        // Setup successful, set user info and redirect to home
        setUser(data.user);
        navigate('/', { replace: true });
      }
      else {
        setError(data.error || 'Setup failed');
      }
    }
    catch (error) {
      console.error('Setup error:', error);
      setError('Network error occurred');
    }
    finally {
      setLoading(false);
    }
  };

  return {
    email,
    password,
    confirmPassword,
    showPassword,
    showConfirmPassword,
    loading,
    error,
    onEmailChange: setEmail,
    onPasswordChange: setPassword,
    onConfirmPasswordChange: setConfirmPassword,
    onTogglePassword: () => setShowPassword(prev => !prev),
    onToggleConfirmPassword: () => setShowConfirmPassword(prev => !prev),
    onSubmit: handleSubmit,
  };
}
