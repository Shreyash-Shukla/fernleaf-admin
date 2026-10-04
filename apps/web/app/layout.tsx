import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Fernleaf Kitchen Admin',
  description: 'B2B commercial kitchen & corporate catering operations portal',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" className={`dark ${inter.variable}`}>
      <body className="min-h-screen bg-bg-app text-text-main font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
