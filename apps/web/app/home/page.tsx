'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface UserInfo {
  email: string;
  name: string;
  role: string;
}

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchMe() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          throw new Error('Not authenticated');
        }
        const data = await res.json();
        if (isMounted) {
          setUser(data);
          setLoading(false);
        }
      } catch {
        if (isMounted) {
          router.push('/login');
        }
      }
    }

    fetchMe();

    return () => {
      isMounted = false;
    };
  }, [router]);

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
    } finally {
      router.push('/login');
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-slate-400">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p>Loading user profile...</p>
      </div>
    );
  }

  return (
    <main className="w-full max-w-lg bg-slate-900/80 border border-slate-800 backdrop-blur-xl rounded-2xl p-8 shadow-2xl text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-6">
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
        Hello {user?.name}, your role is {user?.role}
      </h1>

      <p className="text-slate-400 text-sm mb-8">
        Signed in as <span className="text-slate-200 font-medium">{user?.email}</span>
      </p>

      <div className="pt-4 border-t border-slate-800 flex justify-center">
        <button
          onClick={handleLogout}
          className="px-6 py-2.5 bg-rose-600/80 hover:bg-rose-600 text-white font-medium rounded-lg shadow-lg shadow-rose-600/20 transition-all cursor-pointer"
        >
          Logout
        </button>
      </div>
    </main>
  );
}
