'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function HomePage() {
  const router = useRouter();
  const { user, landingPath, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.push(landingPath || '/dashboard');
      } else {
        router.push('/login');
      }
    }
  }, [user, landingPath, isLoading, router]);

  return (
    <div className="min-h-screen bg-app flex flex-col items-center justify-center text-muted gap-2">
      <div className="w-5 h-5 border-2 border-border border-t-brand-solid rounded-full animate-spin" />
      <p className="text-xs font-medium text-muted">Navigating to workspace…</p>
    </div>
  );
}
