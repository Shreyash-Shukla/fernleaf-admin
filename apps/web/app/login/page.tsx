'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UtensilsCrossed, Lock, Mail, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

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
      // Redirect to role landing path
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-2xl relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-4 shadow-inner">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1.5">Fernleaf Kitchen</h1>
          <p className="text-xs text-slate-400">Admin Operations & Meal Logistics Portal</p>
        </div>

        {error && (
          <div className="mb-6 p-3 text-xs text-rose-300 bg-rose-950/60 border border-rose-800/60 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-slate-300 mb-1.5">
              Staff Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@test.com"
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-lg text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-lg text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign in to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2.5 text-center">
            One-Click Test Accounts
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { role: 'admin', label: 'Admin', desc: 'Full Access' },
              { role: 'kitchen', label: 'Kitchen', desc: 'Prep Board' },
              { role: 'dispatch', label: 'Dispatch', desc: 'Staging & Drops' },
              { role: 'driver', label: 'Driver', desc: 'Deliveries View' },
            ].map(({ role, label, desc }) => (
              <button
                key={role}
                type="button"
                onClick={() => fillCredentials(`${role}@test.com`)}
                className="py-2 px-2.5 text-left bg-slate-800/60 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-700/50 transition-colors cursor-pointer group"
              >
                <div className="text-xs font-medium text-slate-200 group-hover:text-emerald-400 transition-colors">
                  {label}
                </div>
                <div className="text-[10px] text-slate-500 truncate">{role}@test.com</div>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 text-center mt-3">
            Password: <code className="text-emerald-400 bg-slate-950 px-1 py-0.5 rounded text-[11px]">Test@1234</code>
          </p>
        </div>
      </div>
    </div>
  );
}
