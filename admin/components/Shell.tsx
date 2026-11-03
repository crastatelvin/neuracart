'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, apiPage, clearSession, readSession } from '@/lib/api';
import { initials, STATUS_LABEL } from '@/lib/format';
import type { Store } from '@/lib/types';
import { BrandMark, Icon, type IconName } from './Icons';
import { Spinner } from './ui';

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  badgeStatus?: 'pending';
};

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/orders', label: 'Orders', icon: 'orders', badgeStatus: 'pending' },
  { href: '/products', label: 'Products', icon: 'products' },
  { href: '/deals', label: 'Flash deals', icon: 'trending-up' },
  { href: '/slots', label: 'Delivery slots', icon: 'clock' },
  { href: '/subscriptions', label: 'Subscriptions', icon: 'refresh' },
  { href: '/reviews', label: 'Reviews', icon: 'star' },
  { href: '/recipes', label: 'Recipes', icon: 'package' },
  { href: '/risk', label: 'Risk flags', icon: 'shield' },
  { href: '/ai', label: 'AI console', icon: 'sparkles' },
  { href: '/delivery', label: 'Delivery partners', icon: 'delivery' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

const SHELL_REFRESH = 'neuracart:refresh-shell';

const TITLES: { prefix: string; title: string; subtitle: string }[] = [
  { prefix: '/dashboard', title: 'Dashboard', subtitle: 'Store performance at a glance' },
  { prefix: '/orders', title: 'Orders', subtitle: 'Confirm, prepare, assign, and track orders' },
  { prefix: '/products', title: 'Products', subtitle: 'Catalog, stock, and pricing' },
  { prefix: '/ai', title: 'AI console', subtitle: 'Ask the data, drafts, and AI health' },
  { prefix: '/delivery', title: 'Delivery partners', subtitle: 'Riders, verification, and workload' },
  { prefix: '/settings', title: 'Settings', subtitle: 'Store profile, hours, and delivery rules' },
];

export function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [store, setStore] = useState<Store | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [togglingStore, setTogglingStore] = useState(false);

  useEffect(() => {
    const session = readSession();
    if (!session) {
      router.replace('/login');
      setSignedOut(true);
      return;
    }
    setReady(true);
    setEmail(session.user.email);
    setDisplayName(session.user.name ?? 'Admin');
  }, [router]);

  const loadStore = useCallback(async () => {
    try {
      setStore(await api<Store>('/store'));
    } catch {
      // The primary screen still works without the store toggle; retry on refresh.
    }
  }, []);

  const loadPendingCount = useCallback(async () => {
    try {
      const result = await apiPage<unknown>('/orders?status=pending&limit=1');
      setPendingCount(result.pagination.total);
    } catch {
      setPendingCount(null);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void loadStore();
    void loadPendingCount();
    const onRefresh = () => {
      void loadStore();
      void loadPendingCount();
    };
    window.addEventListener(SHELL_REFRESH, onRefresh);
    return () => window.removeEventListener(SHELL_REFRESH, onRefresh);
  }, [ready, loadStore, loadPendingCount]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const toggleStore = async () => {
    if (!store || togglingStore) return;
    setTogglingStore(true);
    try {
      const updated = await api<Store>('/store', {
        method: 'PATCH',
        body: { isOpen: !store.manuallyOpen },
      });
      setStore(updated);
    } catch {
      // Ignore: the settings page surfaces a full retry for this action.
    } finally {
      setTogglingStore(false);
    }
  };

  const signOut = async () => {
    try {
      const { logoutAdmin } = await import('@/lib/api');
      await logoutAdmin();
    } catch {
      clearSession();
    }
    router.replace('/login');
  };

  if (signedOut) return null;

  if (!ready) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Spinner />
          Loading NeuraCart Admin…
        </div>
      </div>
    );
  }

  const meta =
    TITLES.find((item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`)) ??
    TITLES[0];
  const manualNext = store ? !store.manuallyOpen : false;

  return (
    <div className="app-shell">
      {sidebarOpen ? (
        <button
          className="sidebar-scrim"
          type="button"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="Admin navigation">
        <Link href="/dashboard" className="sidebar-brand">
          <BrandMark size={38} />
          <span>
            <span className="brand-name">NeuraCart</span>
            <span className="brand-sub">Admin</span>
          </span>
        </Link>
        <nav className="sidebar-nav">
          <p className="sidebar-label">Store operations</p>
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon name={item.icon} size={17} />
                {item.label}
                {item.badgeStatus && pendingCount !== null && pendingCount > 0 ? (
                  <span className="nav-badge">
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <button
            className="store-switch"
            onClick={toggleStore}
            disabled={!store || togglingStore}
            type="button"
            aria-live="polite"
          >
            <span className={`store-dot ${store?.isOpen ? 'open' : ''}`} />
            <span className="store-switch-copy">
              <span className="store-switch-title">
                {store
                  ? store.isOpen
                    ? 'Store open'
                    : store.manuallyOpen
                      ? `Opens ${store.openTime}`
                      : 'Temporarily closed'
                  : 'Store status'}
              </span>
              <span className="store-switch-sub">
                {store?.isOpen ? 'Accepting new orders' : 'Tap to control'}
              </span>
            </span>
            {togglingStore ? <Spinner size={13} /> : (
              <span
                className={`switch ${manualNext ? 'on' : ''}`}
                role="switch"
                aria-checked={manualNext}
                aria-label="Store open manually"
              />
            )}
          </button>
          <div className="user-card">
            <span className="avatar">{initials(displayName)}</span>
            <span className="user-copy">
              <span className="user-name">{displayName}</span>
              <span className="user-email">{email}</span>
            </span>
            <button
              className="icon-button"
              onClick={signOut}
              aria-label="Sign out"
              type="button"
            >
              <Icon name="logout" size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
            type="button"
          >
            <Icon name="menu" size={17} />
          </button>
          <div className="topbar-title">
            <h1>{meta.title}</h1>
            <p>{meta.subtitle}</p>
          </div>
          <div className="topbar-actions">
            <Link href="/orders?status=pending" className="btn btn-sm btn-secondary">
              <Icon name="orders" size={14} />
              <span>
                {pendingCount !== null && pendingCount > 0
                  ? `${pendingCount} ${STATUS_LABEL.pending.toLowerCase()} `
                  : 'Orders'}
              </span>
              <Icon name="arrow-up-right" size={11} />
            </Link>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
