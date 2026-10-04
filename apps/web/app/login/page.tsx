'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const router = useRouter();
  const { refetch } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || data.error?.message || 'Login failed. Please check your credentials.');
      }

      await refetch();
      router.push(data.landingPath || '/dashboard');
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  function fillCredentials(testEmail: string) {
    setEmail(testEmail);
    setPassword('Test@1234');
    setError('');
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-app">
      <div className="w-full max-w-sm bg-surface border border-border rounded-lg p-6 space-y-5">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-brand-soft text-brand-text mb-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-base font-semibold text-text">Fernleaf</h1>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Kitchen Admin</p>
        </div>

        {error && (
          <div className="p-3 text-xs text-danger bg-danger/10 border border-danger/28 rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-text mb-1">
              Staff email
            </label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@test.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-text mb-1">
              Password
            </label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={loading}
              loading={loading}
              className="w-full"
            >
              Sign in to operations
            </Button>
          </div>
        </form>

        <div className="pt-4 border-t border-border space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted text-center">
            One-click test accounts
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { role: 'admin', label: 'Admin', desc: 'Full operations' },
              { role: 'kitchen', label: 'Kitchen', desc: 'Prep board' },
              { role: 'dispatch', label: 'Dispatch', desc: 'Staging & drops' },
              { role: 'driver', label: 'Driver', desc: 'Deliveries run' },
            ].map(({ role, label }) => (
              <button
                key={role}
                type="button"
                onClick={() => fillCredentials(`${role}@test.com`)}
                className="py-1.5 px-2 text-left bg-app hover:bg-raised text-text rounded-md border border-border transition-colors cursor-pointer"
              >
                <div className="text-xs font-medium text-text">
                  {label}
                </div>
                <div className="text-[11px] font-mono text-muted truncate">{role}@test.com</div>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted text-center pt-1 font-mono tabular-nums">
            Password: Test@1234
          </p>
        </div>
      </div>
    </div>
  );
}
