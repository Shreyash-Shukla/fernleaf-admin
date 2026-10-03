import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Heizen Monorepo',
  description: 'Minimal monorepo hello-world with NestJS, Next.js, and Prisma',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased flex flex-col justify-center items-center p-4">
        {children}
      </body>
    </html>
  );
}
