'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
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
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || 'Login failed. Please check your credentials.');
      }

      router.push('/home');
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
    <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 backdrop-blur-xl rounded-2xl p-8 shadow-2xl">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">Sign in to your account</h1>
        <p className="text-sm text-slate-400">Minimal monorepo hello-world auth</p>
      </div>

      {error && (
        <div className="mb-6 p-3 text-sm text-rose-300 bg-rose-950/50 border border-rose-800/60 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@test.com"
            className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1.5">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-slate-800">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 text-center">
          Quick-Fill Seed Users
        </p>
        <div className="grid grid-cols-2 gap-2">
          {['admin', 'kitchen', 'dispatch', 'driver'].map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => fillCredentials(`${role}@test.com`)}
              className="py-1.5 px-2 text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/50 transition-colors text-center cursor-pointer"
            >
              {role}@test.com
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-500 text-center mt-2">
          Password for all seed users: <code className="text-indigo-300">Test@1234</code>
        </p>
      </div>
    </div>
  );
}
