'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/Icons';
import { useToast } from '@/components/Toast';
import {
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  FieldError,
  Modal,
  PageHeader,
  SkeletonTable,
  Spinner,
} from '@/components/ui';
import { api, apiPage } from '@/lib/api';
import { formatINR, relativeTime } from '@/lib/format';
import type { Product } from '@/lib/types';

type Deal = {
  id: string;
  discountPct: number;
  startsAt: string;
  endsAt: string;
  stockLimit: number | null;
  usedCount: number;
  isActive: boolean;
  product: { name: string; price: string | number };
};

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function DealsPage() {
  const toast = useToast();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Deal | null>(null);
  const [fieldError, setFieldError] = useState('');

  const [productId, setProductId] = useState('');
  const [discountPct, setDiscountPct] = useState('20');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [stockLimit, setStockLimit] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dealList, productList] = await Promise.all([
        api<Deal[]>('/admin/flash-deals'),
        apiPage<Product>('/products?limit=100&status=all'),
      ]);
      setDeals(dealList);
      setProducts(productList.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load flash deals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    const now = new Date();
    const end = new Date(now.getTime() + 24 * 3600_000);
    setProductId(products[0]?.id ?? '');
    setDiscountPct('20');
    setStartsAt(toLocalInput(now.toISOString()));
    setEndsAt(toLocalInput(end.toISOString()));
    setStockLimit('');
    setFieldError('');
    setFormOpen(true);
  }

  async function create() {
    if (!productId) {
      setFieldError('Pick a product.');
      return;
    }
    if (Number(discountPct) < 1 || Number(discountPct) > 80) {
      setFieldError('Discount must be between 1% and 80%.');
      return;
    }
    if (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt)) {
      setFieldError('The deal must end after it starts.');
      return;
    }
    setSaving(true);
    try {
      await api('/admin/flash-deals', {
        method: 'POST',
        body: {
          productId,
          discountPct: Number(discountPct),
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          ...(stockLimit ? { stockLimit: Number(stockLimit) } : {}),
        },
      });
      toast.success('Flash deal created.');
      setFormOpen(false);
      await load();
    } catch (caught) {
      setFieldError(caught instanceof Error ? caught.message : 'Could not create the deal.');
    } finally {
      setSaving(false);
    }
  }

  async function toggle(deal: Deal) {
    setBusyId(deal.id);
    try {
      await api(`/admin/flash-deals/${deal.id}`, {
        method: 'PATCH',
        body: { isActive: !deal.isActive },
      });
      toast.success(deal.isActive ? 'Deal paused.' : 'Deal resumed.');
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not update the deal.');
    } finally {
      setBusyId(null);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await api(`/admin/flash-deals/${deleteTarget.id}`, { method: 'DELETE' });
      toast.success('Deal deleted.');
      setDeleteTarget(null);
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not delete the deal.');
    } finally {
      setBusyId(null);
    }
  }

  const now = Date.now();

  return (
    <main className="page">
      <PageHeader
        title="Flash deals"
        subtitle="Time-boxed discounts on individual products"
        actions={
          <>
            <button className="btn btn-sm btn-secondary" onClick={() => void load()} disabled={loading} type="button">
              <Icon name="refresh" size={13} /> Refresh
            </button>
            <button className="btn btn-sm btn-primary" onClick={openCreate} disabled={products.length === 0} type="button">
              <Icon name="plus" size={13} /> New deal
            </button>
          </>
        }
      />

      {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}

      <div className="card table-card">
        {loading ? (
          <SkeletonTable rows={5} />
        ) : deals.length === 0 ? (
          <EmptyState
            icon="trending-up"
            title="No flash deals"
            text="Create a discount to surface it on the customer home screen and product page."
            action={
              <button className="btn btn-primary" onClick={openCreate} disabled={products.length === 0} type="button">
                <Icon name="plus" size={14} /> New deal
              </button>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="num">Discount</th>
                  <th className="num">Deal price</th>
                  <th>Window</th>
                  <th className="num">Claimed</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((deal) => {
                  const price = Number(deal.product.price);
                  const dealPrice = Math.round(price * (1 - deal.discountPct / 100) * 100) / 100;
                  const live = deal.isActive && new Date(deal.startsAt).getTime() <= now && new Date(deal.endsAt).getTime() >= now;
                  return (
                    <tr key={deal.id}>
                      <td className="cell-main">{deal.product.name}</td>
                      <td className="num">{deal.discountPct}%</td>
                      <td className="num">
                        <span style={{ fontWeight: 700 }}>{formatINR(dealPrice)}</span>
                        <div className="cell-sub" style={{ textDecoration: 'line-through' }}>
                          {formatINR(price)}
                        </div>
                      </td>
                      <td>
                        <span className="cell-main">
                          {new Date(deal.startsAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                        <div className="cell-sub">
                          ends {relativeTime(deal.endsAt)}
                        </div>
                      </td>
                      <td className="num">
                        {deal.usedCount}
                        {deal.stockLimit !== null ? ` / ${deal.stockLimit}` : ''}
                      </td>
                      <td>
                        <span className={`badge no-dot ${live ? 'badge-green' : deal.isActive ? 'badge-blue' : 'badge-gray'}`}>
                          {live ? 'Live' : deal.isActive ? 'Scheduled' : 'Paused'}
                        </span>
                      </td>
                      <td>
                        <div className="cell-actions">
                          <button className="btn btn-sm btn-secondary" disabled={busyId === deal.id} onClick={() => void toggle(deal)} type="button">
                            {busyId === deal.id ? <Spinner size={11} /> : <Icon name={deal.isActive ? 'x' : 'check'} size={12} />}
                            {deal.isActive ? 'Pause' : 'Resume'}
                          </button>
                          <button className="btn btn-sm btn-danger-soft" disabled={busyId === deal.id} onClick={() => setDeleteTarget(deal)} type="button">
                            <Icon name="trash" size={12} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="New flash deal"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setFormOpen(false)} type="button">
              Cancel
            </button>
            <button className="btn btn-primary" onClick={() => void create()} disabled={saving} type="button">
              {saving ? <Spinner /> : <Icon name="plus" size={13} />} Create deal
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="field full">
            <label className="label" htmlFor="deal-product">Product</label>
            <select
              className="input"
              id="deal-product"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · {formatINR(Number(product.price))}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="deal-pct">Discount %</label>
            <input
              className="input"
              id="deal-pct"
              type="number"
              min={1}
              max={80}
              value={discountPct}
              onChange={(event) => setDiscountPct(event.target.value)}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="deal-stock">Stock limit (optional)</label>
            <input
              className="input"
              id="deal-stock"
              type="number"
              min={1}
              value={stockLimit}
              onChange={(event) => setStockLimit(event.target.value)}
              placeholder="Unlimited"
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="deal-start">Starts</label>
            <input
              className="input"
              id="deal-start"
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="deal-end">Ends</label>
            <input
              className="input"
              id="deal-end"
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
            />
          </div>
          <FieldError>{fieldError}</FieldError>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete flash deal?"
        description={deleteTarget ? `The discount on ${deleteTarget.product.name} will stop immediately.` : ''}
        confirmLabel="Delete"
        tone="danger"
        loading={busyId === deleteTarget?.id}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void remove()}
      />
    </main>
  );
}
