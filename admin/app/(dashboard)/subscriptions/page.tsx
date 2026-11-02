'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/Icons';
import { useToast } from '@/components/Toast';
import { EmptyState, ErrorBanner, PageHeader, SkeletonTable, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { relativeTime } from '@/lib/format';

type AdminSubscription = {
  id: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  cadenceDays: number;
  dayOfWeek: number;
  nextRunAt: string | null;
  lastRunAt: string | null;
  user: { name: string | null; email: string };
  address: { label: string; line1: string; city: string };
  items: { productId: string; quantity: number; product?: { name: string } | null }[];
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AdminSubscriptionsPage() {
  const toast = useToast();
  const [subs, setSubs] = useState<AdminSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setSubs(await api<AdminSubscription[]>('/admin/subscriptions'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load subscriptions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runDue() {
    setRunning(true);
    try {
      const result = await api<{ created: number; skipped: string[] }>(
        '/admin/subscriptions/run',
        { method: 'POST' },
      );
      toast.success(
        result.created > 0
          ? `Created ${result.created} subscription order${result.created === 1 ? '' : 's'}.`
          : 'No subscriptions are due right now.',
      );
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not run subscriptions.');
    } finally {
      setRunning(false);
    }
  }

  const active = subs.filter((sub) => sub.status === 'ACTIVE').length;

  return (
    <main className="page">
      <PageHeader
        title="Subscriptions"
        subtitle="Recurring baskets and their next scheduled runs"
        actions={
          <>
            <button className="btn btn-sm btn-secondary" onClick={() => void load()} disabled={loading} type="button">
              <Icon name="refresh" size={13} /> Refresh
            </button>
            <button className="btn btn-sm btn-primary" onClick={() => void runDue()} disabled={running} type="button">
              {running ? <Spinner /> : <Icon name="clock" size={13} />} Run due now
            </button>
          </>
        }
      />

      <div className="mini-grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
        <div className="mini-card">
          <span className="mini-icon"><Icon name="orders" size={16} /></span>
          <span>
            <span className="mini-value">{subs.length}</span>
            <span className="mini-label" style={{ display: 'block' }}>Total subscriptions</span>
          </span>
        </div>
        <div className="mini-card">
          <span className="mini-icon"><Icon name="check" size={16} /></span>
          <span>
            <span className="mini-value">{active}</span>
            <span className="mini-label" style={{ display: 'block' }}>Active</span>
          </span>
        </div>
        <div className="mini-card">
          <span className="mini-icon"><Icon name="clock" size={16} /></span>
          <span>
            <span className="mini-value">
              {subs.filter((sub) => sub.nextRunAt && new Date(sub.nextRunAt) <= new Date()).length}
            </span>
            <span className="mini-label" style={{ display: 'block' }}>Due now</span>
          </span>
        </div>
      </div>

      {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}

      <div className="card table-card">
        {loading ? (
          <SkeletonTable rows={5} />
        ) : subs.length === 0 ? (
          <EmptyState
            icon="orders"
            title="No subscriptions"
            text="Customers can subscribe to a regular basket from their cart."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Cadence</th>
                  <th className="num">Items</th>
                  <th>Address</th>
                  <th>Next run</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((sub) => (
                  <tr key={sub.id}>
                    <td>
                      <span className="cell-main">{sub.user.name ?? 'Customer'}</span>
                      <div className="cell-sub">{sub.user.email}</div>
                    </td>
                    <td>
                      <span className="cell-main">
                        Every {sub.cadenceDays} days · {DAYS[sub.dayOfWeek]}
                      </span>
                      {sub.lastRunAt ? (
                        <div className="cell-sub">last run {relativeTime(sub.lastRunAt)}</div>
                      ) : null}
                    </td>
                    <td className="num">{sub.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                    <td>
                      <span className="cell-main">{sub.address.label}</span>
                      <div className="cell-sub">{sub.address.line1}</div>
                    </td>
                    <td className="cell-sub">
                      {sub.nextRunAt
                        ? new Date(sub.nextRunAt).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </td>
                    <td>
                      <span
                        className={`badge no-dot ${
                          sub.status === 'ACTIVE'
                            ? 'badge-green'
                            : sub.status === 'PAUSED'
                              ? 'badge-amber'
                              : 'badge-gray'
                        }`}
                      >
                        {sub.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
