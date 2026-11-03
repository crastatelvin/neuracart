import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/Toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'NeuraCart Admin',
  description: 'Manage the NeuraCart neighbourhood market.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('neuracart-theme');" +
              "if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}" +
              "document.documentElement.dataset.theme=t;}catch(e){}})();",
          }}
        />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
