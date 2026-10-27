'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { readSession } from '@/lib/api';

export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(readSession() ? '/dashboard' : '/login');
  }, [router]);
  return null;
}
