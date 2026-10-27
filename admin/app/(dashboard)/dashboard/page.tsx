'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import {
  EmptyState,
  ErrorBanner,
  SkeletonTable,
  StatusBadge,
} from '@/components/ui';
import { Icon, type IconName } from '@/components/Icons';
import { api } from '@/lib/api';
import {
  formatDayLabel,
  formatINR,
  relativeTime,
  STATUS_LABEL,
  STATUS_TONE,
} from '@/lib/format';
import type { DashboardStats, Store } from '@/lib/types';

type Range = 'today' | '7d' | '30d';
const REFRESH_MS = 60_000;

const SECONDARY: { key: 'totalCustomers' | 'averageOrderValue' | 'lowStockCount'; label: string; icon: IconName; href?: string; tone?: string }[] = [
  { key: 'averageOrderValue', label: 'Avg. order value', icon: 'rupee' },
  { key: 'lowStockCount', label: 'Low stock items', icon: 'alert', href: '/products?status=active&sort=newest', tone: 'red' as string },
  { key: 'totalCustomers', label: 'Total customers', icon: 'users' },
];

export default function DashboardPage() {
  const toast = useToast();
  const [range, setRange] = useState<Range>('7d');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (nextRange: Range, { silent = false } = {}) => {
      if (!silent) setError('');
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const [nextStats, nextStore] = await Promise.all([
          api<DashboardStats>(`/admin/stats?range=${nextRange}`),
          api<Store>('/store'),
        ]);
        setStats(nextStats);
        setStore(nextStore);
        setError('');
      } catch (caught) {
        setStats(null);
        setError(
          caught instanceof Error ? caught.message : 'Could not load dashboard data.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(range);
  }, [range, load]);

  useEffect(() => {
    const timer = setInterval(() => void load(range, { silent: true }), REFRESH_MS);
    return () => clearInterval(timer);
  }, [range, load]);

  const toggleStore = async () => {
    if (!store) return;
    setBusy(true);
    try {
      const next = await api<Store>('/store', {
        method: 'PATCH',
        body: { isOpen: !store.manuallyOpen },
      });
      setStore(next);
      toast.success(next.isOpen ? 'Store is now accepting new orders.' : 'Store is temporarily closed.');
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not update the store.');
    } finally {
      setBusy(false);
    }
  };

  const maxRevenue = stats
    ? Math.max(
        1,
        ...stats.revenueSeries.map((entry) => Number(entry.revenue)),
      )
    : 1;

  const statusEntries = stats
    ? (Object.entries(stats.ordersByStatus) as [keyof DashboardStats['ordersByStatus'], number][])
    : [];

  const statusToneCss = (status: string) =>
    ({
      amber: '#d97706',
      blue: '#2563eb',
      green: '#16a34a',
      indigo: '#4f46e5',
      orange: '#ea580c',
      purple: '#9333ea',
      red: '#dc2626',
    })[STATUS_TONE[status as keyof typeof STATUS_TONE] ?? 'amber'];

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Here is how the store is performing.
          </p>
        </div>
        <div className="header-actions">
          <div className="range-tabs" role="tablist" aria-label="Stats range">
            {(['today', '7d', '30d'] as Range[]).map((item) => (
              <button
                key={item}
                className={item === range ? 'active' : ''}
                onClick={() => setRange(item)}
                role="tab"
                aria-selected={item === range}
                type="button"
              >
                {item === 'today' ? 'Today' : item === '7d' ? '7 days' : '30 days'}
              </button>
            ))}
          </div>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => void load(range, { silent: true })}
            disabled={refreshing}
            type="button"
          >
            <span className={refreshing ? 'spin' : ''} style={{ display: 'inline-flex' }}>
              <Icon name="refresh" size={13} />
            </span>
            Refresh
          </button>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={() => void load(range)} /> : null}

      {loading || !stats ? (
        <div>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
            {[1, 2, 3, 4].map((item) => (
              <div className="skeleton skeleton-card" key={item} />
            ))}
          </div>
          <div className="card"><SkeletonTable rows={5} /></div>
        </div>
      ) : (
        <>
          <section className="stats-grid" aria-label="Today at a glance">
            <div className="stat-card">
              <span className="stat-top">
                <span className="stat-label">Orders today</span>
                <span className="stat-icon"><Icon name="orders" size={15} /></span>
              </span>
              <strong className="stat-value">{stats.todayOrders}</strong>
              <p className="stat-hint">All statuses · IST day</p>
            </div>
            <div className="stat-card">
              <span className="stat-top">
                <span className="stat-label">Revenue today</span>
                <span className="stat-icon"><Icon name="trending-up" size={15} /></span>
              </span>
              <strong className="stat-value">{formatINR(stats.todayRevenue)}</strong>
              <p className="stat-hint">Delivered, COD orders collected</p>
            </div>
            <div className="stat-card amber">
              <span className="stat-top">
                <span className="stat-label">Pending orders</span>
                <span className="stat-icon"><Icon name="clock" size={15} /></span>
              </span>
              <strong className="stat-value">{stats.pendingOrders}</strong>
              <p className="stat-hint">Awaiting confirmation</p>
            </div>
            <div className="stat-card blue">
              <span className="stat-top">
                <span className="stat-label">Active deliveries</span>
                <span className="stat-icon"><Icon name="truck" size={15} /></span>
              </span>
              <strong className="stat-value">{stats.activeDeliveries}</strong>
              <p className="stat-hint">Assigned or out for delivery</p>
            </div>
          </section>

          <section className="mini-grid" aria-label="Secondary metrics">
            {SECONDARY.map((item) => (
              <Link
                key={item.key}
                href={item.href ?? '/orders'}
                style={{ display: 'block' }}
              >
                <div className="mini-card">
                  <span className="mini-icon" style={item.tone ? { background: 'var(--red-50)', color: 'var(--red-600)' } : undefined}>
                    <Icon name={item.icon} size={16} />
                  </span>
                  <span>
                    <span className="mini-value">
                      {item.key === 'averageOrderValue'
                        ? formatINR(stats[item.key])
                        : stats[item.key]}
                    </span>
                    <span className="mini-label" style={{ display: 'block' }}>{item.label}</span>
                  </span>
                </div>
              </Link>
            ))}
            <div className="mini-card">
              <span className="mini-icon">
                <Icon name="store" size={16} />
              </span>
              <span style={{ flex: 1 }}>
                <span className="mini-value">{store?.isOpen ? 'Open' : 'Closed'}</span>
                <span className="mini-label" style={{ display: 'block' }}>
                  {store ? `${store.openTime}–${store.closeTime} IST` : 'Hours'}
                </span>
              </span>
              <button
                className={`switch ${(store?.isOpen ?? false) ? 'on' : ''}`}
                onClick={toggleStore}
                disabled={busy || !store}
                type="button"
                role="switch"
                aria-checked={store?.isOpen ?? false}
                aria-label="Toggle store openness"
              />
            </div>
          </section>

          <div className="dashboard-grid">
            <div className="stack">
              <div className="card">
                <div className="card-header">
                  <div>
                    <p className="card-title">Revenue · {range === 'today' ? 'today' : range === '7d' ? 'last 7 days' : 'last 30 days'}</p>
                    <p className="card-subtitle">Delivered COD totals by IST day</p>
                  </div>
                  <strong style={{ fontSize: 15, fontWeight: 750 }}>
                    {formatINR(stats.revenueSeries.reduce((sum, entry) => sum + Number(entry.revenue), 0))}
                  </strong>
                </div>
                <div className="chart">
                  <div className="chart-box">
                    <div className="chart-y">
                      <span>{formatINR(maxRevenue)}</span>
                      <span>{formatINR(maxRevenue / 2)}</span>
                      <span>{formatINR(0)}</span>
                    </div>
                    <div className="chart-area" role="img" aria-label="Revenue per day">
                      {stats.revenueSeries.map((entry) => {
                        const value = Number(entry.revenue);
                        const height = Math.max(3, (value / maxRevenue) * 100);
                        return (
                          <div className="chart-col" key={entry.date} title={`${formatDayLabel(entry.date)} · ${formatINR(entry.revenue)}`}>
                            <span className="chart-tooltip">{formatINR(entry.revenue)} · {entry.orders} {entry.orders === 1 ? 'order' : 'orders'}</span>
                            <span className="chart-bar-wrap">
                              <span className="chart-bar" style={{ height: `${height}%` }} />
                            </span>
                            <span className="chart-col-label">{formatDayLabel(entry.date)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div>
                    <p className="card-title">Recent orders</p>
                    <p className="card-subtitle">Latest 5 orders, any status</p>
                  </div>
                  <Link href="/orders" style={{ color: 'var(--green-700)', fontSize: 11.5, fontWeight: 650 }}>
                    View all
                  </Link>
                </div>
                {stats.recentOrders.length === 0 ? (
                  <EmptyState title="No orders yet today" text="New orders will appear here the moment customers check out." />
                ) : (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Order</th>
                          <th>Customer</th>
                          <th>Total</th>
                          <th>Status</th>
                          <th>Placed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.recentOrders.map((order) => (
                          <tr key={order.id}>
                            <td>
                              <Link href={`/orders/${order.id}`} style={{ fontWeight: 700 }}>
                                {order.orderNumber}
                              </Link>
                            </td>
                            <td>
                              <div className="cell-main">{order.customer.name ?? '—'}</div>
                              <div className="cell-sub">{order.customer.email}</div>
                            </td>
                            <td className="num">{formatINR(order.total)}</td>
                            <td><StatusBadge status={order.status} /></td>
                            <td className="cell-sub">{relativeTime(order.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="stack">
              <div className="card">
                <div className="card-header">
                  <p className="card-title">Orders by status</p>
                </div>
                <div className="card-body">
                  <div className="status-bars">
                    {statusEntries.map(([status, countLabel]) => {
                      const totalAll = Math.max(1, statusEntries.reduce((sum, [, count]) => sum + count, 0));
                      const width = (countLabel / totalAll) * 100;
                      return (
                        <div key={status}>
                          <div className="status-bar-top">
                            <span>{STATUS_LABEL[status]}</span>
                            <span>{countLabel}</span>
                          </div>
                          <span className="progress">
                            <span style={{ width: `${width}%`, background: statusToneCss(status) }} />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div>
                    <p className="card-title">Low stock</p>
                    <p className="card-subtitle">{stats.lowStockCount} active product{stats.lowStockCount === 1 ? '' : 's'} at or below 5 units</p>
                  </div>
                  <Link href="/products?status=active&sort=newest" style={{ color: 'var(--green-700)', fontSize: 11.5, fontWeight: 650 }}>
                    Restock
                  </Link>
                </div>
                {stats.lowStock.length === 0 ? (
                  <EmptyState icon="check-circle" title="Stock looks healthy" text="No active product is at risk of running out right now." />
                ) : (
                  <div className="low-stock-list">
                    {stats.lowStock.map((product) => (
                      <Link href={`/products/${product.id}`} className="low-stock-row" key={product.id}>
                        <span className="low-stock-name">{product.name}</span>
                        <span className="stock-chip">{product.stock} left</span>
                        <Icon name="arrow-up-right" size={12} />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
