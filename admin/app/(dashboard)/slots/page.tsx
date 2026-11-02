'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/Icons';
import { useToast } from '@/components/Toast';
import { EmptyState, ErrorBanner, PageHeader, SkeletonTable, Spinner } from '@/components/ui';
import { api } from '@/lib/api';

type SlotDay = {
  date: string;
  label: string;
  windows: { id: string; windowLabel: string; available: number; capacity: number }[];
};

export default function SlotsPage() {
  const toast = useToast();
  const [days, setDays] = useState<SlotDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setDays(await api<SlotDay[]>('/admin/slots'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load delivery slots.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    setGenerating(true);
    try {
      await api('/admin/slots/bulk', { method: 'POST', body: { days: 7 } });
      toast.success('Slot windows topped up for the next 7 days.');
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not generate slots.');
    } finally {
      setGenerating(false);
    }
  }

  const totalCapacity = days.reduce(
    (sum, day) => sum + day.windows.reduce((daySum, window) => daySum + window.capacity, 0),
    0,
  );
  const totalAvailable = days.reduce(
    (sum, day) => sum + day.windows.reduce((daySum, window) => daySum + window.available, 0),
    0,
  );

  return (
    <main className="page">
      <PageHeader
        title="Delivery slots"
        subtitle="Two-hour windows and capacity per day"
        actions={
          <>
            <button className="btn btn-sm btn-secondary" onClick={() => void load()} disabled={loading} type="button">
              <Icon name="refresh" size={13} /> Refresh
            </button>
            <button className="btn btn-sm btn-primary" onClick={() => void generate()} disabled={generating} type="button">
              {generating ? <Spinner /> : <Icon name="plus" size={13} />} Generate 7 days
            </button>
          </>
        }
      />

      <div className="mini-grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
        <div className="mini-card">
          <span className="mini-icon"><Icon name="clock" size={16} /></span>
          <span>
            <span className="mini-value">{days.length}</span>
            <span className="mini-label" style={{ display: 'block' }}>Days scheduled</span>
          </span>
        </div>
        <div className="mini-card">
          <span className="mini-icon"><Icon name="package" size={16} /></span>
          <span>
            <span className="mini-value">{totalCapacity}</span>
            <span className="mini-label" style={{ display: 'block' }}>Total capacity</span>
          </span>
        </div>
        <div className="mini-card">
          <span className="mini-icon"><Icon name="check" size={16} /></span>
          <span>
            <span className="mini-value">{totalAvailable}</span>
            <span className="mini-label" style={{ display: 'block' }}>Still bookable</span>
          </span>
        </div>
      </div>

      {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}

      {loading ? (
        <div className="card"><SkeletonTable rows={5} /></div>
      ) : days.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="clock"
            title="No slots scheduled"
            text="Generate the next 7 days to open checkout windows for customers."
            action={
              <button className="btn btn-primary" onClick={() => void generate()} disabled={generating} type="button">
                <Icon name="plus" size={14} /> Generate 7 days
              </button>
            }
          />
        </div>
      ) : (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'grid', gap: 16 }}>
            {days.map((day) => (
              <div key={day.date}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                  <strong>{day.label}</strong>
                  <span className="cell-sub">{new Date(`${day.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {day.windows.map((window) => {
                    const fill = window.capacity === 0 ? 0 : (window.capacity - window.available) / window.capacity;
                    return (
                      <div
                        key={window.id}
                        style={{
                          minWidth: 150,
                          border: '1px solid var(--border, #E5E7EB)',
                          borderRadius: 12,
                          padding: '9px 11px',
                          background: window.available === 0 ? '#FEF2F2' : '#F9FAFB',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, fontWeight: 600 }}>
                          <span>{window.windowLabel}</span>
                          <span className={window.available === 0 ? 'badge no-dot badge-red' : 'badge no-dot badge-green'}>
                            {window.available} left
                          </span>
                        </div>
                        <div style={{ marginTop: 7, height: 5, borderRadius: 999, background: '#E5E7EB', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.min(100, Math.round(fill * 100))}%`,
                              height: '100%',
                              background: window.available === 0 ? '#EF4444' : '#16A34A',
                            }}
                          />
                        </div>
                        <div className="cell-sub" style={{ marginTop: 5 }}>
                          {window.capacity - window.available} of {window.capacity} booked
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
