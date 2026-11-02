'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/Icons';
import { EmptyState, ErrorBanner, PageHeader, SkeletonTable } from '@/components/ui';
import { api } from '@/lib/api';
import { relativeTime } from '@/lib/format';

type RiskRow = {
  user: { id: string; name: string | null; email: string };
  score: number;
  kinds: Record<string, number>;
  lastAt: string;
};

function tone(score: number): string {
  if (score >= 6) return 'badge-red';
  if (score >= 3) return 'badge-amber';
  return 'badge-gray';
}

export default function RiskPage() {
  const [rows, setRows] = useState<RiskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await api<RiskRow[]>('/admin/risk'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load risk flags.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="page">
      <PageHeader
        title="Risk flags"
        subtitle="Repeat cancellations and suspicious activity, scored per customer"
        actions={
          <button className="btn btn-sm btn-secondary" onClick={() => void load()} disabled={loading} type="button">
            <Icon name="refresh" size={13} /> Refresh
          </button>
        }
      />

      {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}

      <div className="card table-card">
        {loading ? (
          <SkeletonTable rows={5} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="shield"
            title="No risk flags"
            text="Cancellations and payment anomalies will be scored here for manual review."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th className="num">Risk score</th>
                  <th>Flags</th>
                  <th>Last flagged</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.user.id}>
                    <td>
                      <span className="cell-main">{row.user.name ?? 'Customer'}</span>
                      <div className="cell-sub">{row.user.email}</div>
                    </td>
                    <td className="num">
                      <span className={`badge no-dot ${tone(row.score)}`}>{row.score}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {Object.entries(row.kinds).map(([kind, count]) => (
                          <span key={kind} className="badge no-dot badge-blue">
                            {kind.replaceAll('_', ' ').toLowerCase()} × {count}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="cell-sub">{relativeTime(row.lastAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="cell-sub" style={{ padding: '0 4px' }}>
        Flags are advisory only — review an order in Orders before taking action on an account.
      </p>
    </main>
  );
}
