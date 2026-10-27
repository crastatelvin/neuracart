import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/Toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'LocalMart Admin',
  description: 'Manage the LocalMart neighbourhood market.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
