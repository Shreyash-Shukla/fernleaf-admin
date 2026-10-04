'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Loader2 } from 'lucide-react';

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
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      <p className="text-xs font-medium">Navigating to your workspace...</p>
    </div>
  );
}
