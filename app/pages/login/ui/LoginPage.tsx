import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState('');

  const redirectTo = (() => {
    const candidate = searchParams.get('redirectTo');

    if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) {
      return '/';
    }

    return candidate;
  })();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        body: JSON.stringify({ password }),
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Unlock failed');
        return;
      }

      navigate(redirectTo, { replace: true });
    }
    catch (submissionError) {
      console.error('Unlock failed:', submissionError);
      setError('Unlock failed');
    }
    finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <section className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Unlock your vault</h1>
          <p className="text-sm text-muted-foreground">
            Enter the shared password to access Local Streamer.
          </p>
        </header>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-medium">Shared password</span>
            <input
              autoComplete="current-password"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              disabled={isSubmitting}
              onChange={event => setPassword(event.target.value)}
              placeholder="Enter password"
              required
              type="password"
              value={password}
            />
          </label>

          {error && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            className="w-full rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Unlocking...' : 'Unlock'}
          </button>
        </form>
      </section>
    </main>
  );
}
