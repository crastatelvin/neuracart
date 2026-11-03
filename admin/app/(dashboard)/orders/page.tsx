'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/Icons';
import { useToast } from '@/components/Toast';
import {
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Pagination,
  PaymentMethodBadge,
  PaymentStatusBadge,
  SkeletonTable,
  Spinner,
  StatusBadge,
} from '@/components/ui';
import { api, apiPage, queryString } from '@/lib/api';
import {
  formatDayLabel,
  formatINR,
  relativeTime,
  STATUS_LABEL,
  startOfTodayISO,
} from '@/lib/format';
import type { Order, OrderStatus } from '@/lib/types';

type DateRange = 'all' | 'today' | 'yesterday' | '7d' | '30d' | 'custom';

const REFRESH_MS = 60_000;

const DATE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom' },
];

const STATUS_TABS: (OrderStatus | 'all')[] = [
  'all',
  'pending',
  'confirmed',
  'preparing',
  'assigned',
  'out_for_delivery',
  'delivered',
  'cancelled',
];

function isoStartOfDayOffset(daysAgo: number): string {
  const base = new Date(`${startOfTodayISO().slice(0, 10)}T00:00:00+05:30`);
  const start = new Date(base.getTime() - daysAgo * 86_400_000);
  return start.toISOString();
}

function isoEndOfDay(daysAgo = 0): string {
  const start = isoStartOfDayOffset(daysAgo);
  const next = new Date(new Date(start).getTime() + 24 * 86_400_000 - 1);
  return next.toISOString();
}

export default function OrdersPage() {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusCounts, setStatusCounts] = useState<Partial<Record<OrderStatus, number>>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatusTab] = useState<OrderStatus | 'all'>('all');
  const [range, setRange] = useState<DateRange>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [payment, setPayment] = useState<'all' | 'cod' | 'online'>('all');
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Order | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('status');
    if (fromUrl && fromUrl !== 'all') {
      const valid = (fromUrl as OrderStatus);
      if (valid) setStatusTab(valid);
    }
    const searchParam = params.get('search');
    if (searchParam) {
      setSearch(searchParam);
      setDebouncedSearch(searchParam);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (range !== 'custom') {
      setCustomFrom('');
      setCustomTo('');
    }
  }, [range]);

  const loadCounts = useCallback(async () => {
    try {
      const stats = await api<{ ordersByStatus: Record<OrderStatus, number> }>(
        '/admin/stats?range=30d',
      );
      setStatusCounts(stats.ordersByStatus);
    } catch {
      setStatusCounts({});
    }
  }, []);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const dateQuery: Record<string, string | undefined> = {};
      if (range === 'today') dateQuery.from = startOfTodayISO();
      if (range === 'yesterday') {
        dateQuery.from = isoStartOfDayOffset(1);
        dateQuery.to = isoEndOfDay(1);
      }
      if (range === '7d') {
        dateQuery.from = isoStartOfDayOffset(6);
        dateQuery.to = isoEndOfDay(0);
      }
      if (range === '30d') {
        dateQuery.from = isoStartOfDayOffset(29);
        dateQuery.to = isoEndOfDay(0);
      }
      if (range === 'custom' && customFrom && customTo) {
        dateQuery.from = new Date(`${customFrom}T00:00:00+05:30`).toISOString();
        dateQuery.to = new Date(`${customTo}T23:59:59.999+05:30`).toISOString();
      }
      const result = await apiPage<Order>(
        `/orders${queryString({
          page,
          limit,
          status: status === 'all' ? undefined : status,
          search: debouncedSearch || undefined,
          paymentMethod: payment === 'all' ? undefined : payment,
          from: dateQuery.from,
          to: dateQuery.to,
        })}`,
      );
      setOrders(result.data);
      setTotal(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
    } catch (caught) {
      setOrders([]);
      setError(caught instanceof Error ? caught.message : 'Could not load orders.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, limit, status, debouncedSearch, range, customFrom, customTo, payment]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void load({ silent: true });
        void loadCounts();
      }
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load, loadCounts]);

  useEffect(() => {
    setPage(1);
  }, [status, debouncedSearch, range, customFrom, customTo, payment]);

  const markConfirmed = async (order: Order) => {
    setActionBusy(order.id);
    try {
      await api(`/orders/${order.id}/status`, {
        method: 'PATCH',
        body: { status: 'confirmed', note: 'Confirmed by store' },
      });
      void load({ silent: true });
      void loadCounts();
      window.dispatchEvent(new Event('neuracart:refresh-shell'));
      toast.success(`${order.orderNumber} confirmed.`);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not confirm the order.');
    } finally {
      setActionBusy(null);
    }
  };

  const prepare = async (order: Order) => {
    setActionBusy(order.id);
    try {
      await api(`/orders/${order.id}/status`, {
        method: 'PATCH',
        body: { status: 'preparing', note: 'Kitchen is preparing the order' },
      });
      void load({ silent: true });
      void loadCounts();
      window.dispatchEvent(new Event('neuracart:refresh-shell'));
      toast.success(`${order.orderNumber} is being prepared.`);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not update the order.');
    } finally {
      setActionBusy(null);
    }
  };

  const confirmYes = async () => {
    if (!confirmTarget) return;
    setConfirmLoading(true);
    await markConfirmed(confirmTarget);
    setConfirmLoading(false);
    setConfirmTarget(null);
  };

  const submitCancel = async () => {
    if (!cancelTarget) return;
    const reason = cancelReason.trim();
    if (reason.length < 3 || reason.length > 300) {
      setCancelError('Give a reason between 3 and 300 characters.');
      return;
    }
    setCancelLoading(true);
    try {
      await api(`/orders/${cancelTarget.id}/cancel`, { method: 'POST', body: { reason } });
      void load({ silent: true });
      void loadCounts();
      window.dispatchEvent(new Event('neuracart:refresh-shell'));
      toast.success(`${cancelTarget.orderNumber} cancelled.`);
      setCancelTarget(null);
      setCancelReason('');
    } catch (caught) {
      setCancelError(caught instanceof Error ? caught.message : 'Could not cancel.');
    } finally {
      setCancelLoading(false);
    }
  };

  const allCount = useMemo(
    () => Object.values(statusCounts).reduce((sum, value) => sum + (value ?? 0), 0),
    [statusCounts],
  );

  const countFor = (item: OrderStatus | 'all') =>
    item === 'all' ? allCount : statusCounts[item] ?? 0;

  const activeFilters = status !== 'all' || range !== 'all' || payment !== 'all' || !!debouncedSearch;

  return (
    <main className="page">
      <PageHeader
        title="Orders"
        subtitle="Confirm, prepare, assign, and track customer orders"
        actions={
          <>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => void load({ silent: true })}
              disabled={refreshing}
              type="button"
            >
              <span className={refreshing ? 'spin' : ''} style={{ display: 'inline-flex' }}>
                <Icon name="refresh" size={13} />
              </span>
              Refresh
            </button>
          </>
        }
      />

      {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}

      <div className="card table-card">
        <div className="toolbar">
          <div className="search-box">
            <Icon name="search" size={14} />
            <input
              placeholder="Order number or customer details"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search orders"
              type="search"
            />
          </div>
          <select
            className="select-sm"
            value={range}
            onChange={(event) => setRange(event.target.value as DateRange)}
            aria-label="Date range"
          >
            {DATE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {range === 'custom' ? (
            <>
              <input
                className="select-sm"
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
                aria-label="From date"
                style={{ width: 130 }}
              />
              <input
                className="select-sm"
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
                aria-label="To date"
                style={{ width: 130 }}
              />
            </>
          ) : null}
          <select
            className="select-sm"
            value={payment}
            onChange={(event) => setPayment(event.target.value as 'all' | 'cod' | 'online')}
            aria-label="Payment method"
          >
            <option value="all">All payments</option>
            <option value="cod">COD</option>
            <option value="online">Online</option>
          </select>
          <span className="filter-spacer" />
          {activeFilters ? (
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => {
                setStatusTab('all');
                setRange('all');
                setPayment('all');
                setSearch('');
                setPage(1);
              }}
              type="button"
            >
              <Icon name="close" size={12} />
              Clear
            </button>
          ) : null}
        </div>

        <div className="status-tabs" role="tablist" aria-label="Order status filter">
          {STATUS_TABS.map((item) => (
            <button
              key={item}
              className={`status-tab ${status === item ? 'active' : ''}`}
              role="tab"
              aria-selected={status === item}
              onClick={() => setStatusTab(item)}
              type="button"
            >
              {item === 'all' ? 'All' : STATUS_LABEL[item]}
              <span className="status-tab-count">{countFor(item)}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <SkeletonTable rows={7} />
        ) : orders.length === 0 ? (
          <EmptyState
            icon="orders"
            title={activeFilters ? 'No orders match this filter' : 'No orders yet'}
            text={activeFilters ? 'Try a different status, date range, or clearing the filters.' : 'The moment a customer checks out, that order lands here.'}
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th className="num">Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Rider</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/orders/${order.id}`} style={{ fontWeight: 700 }}>
                        {order.orderNumber}
                      </Link>
                      <div className="cell-sub">{formatDayLabel(order.createdAt.slice(0, 10))} · {relativeTime(order.createdAt)}</div>
                    </td>
                    <td>
                      <span className="cell-main">{order.customer.name ?? '—'}</span>
                      <div className="cell-sub">{order.customer.phone ?? order.customer.email}</div>
                    </td>
                    <td>
                      <span className="cell-main">{order.itemCount}</span>
                      <div className="cell-sub">
                        {order.items.slice(0, 2).map((item) => `${item.quantity}× ${item.product.name}`).join(', ')}
                        {order.items.length > 2 ? '…' : ''}
                      </div>
                    </td>
                    <td className="num" style={{ fontWeight: 700 }}>{formatINR(order.total)}</td>
                    <td>
                      <PaymentMethodBadge method={order.paymentMethod} />
                      <div style={{ marginTop: 3 }}><PaymentStatusBadge status={order.paymentStatus} /></div>
                    </td>
                    <td><StatusBadge status={order.status} /></td>
                    <td>
                      {order.deliveryPartner
                        ? <span className="cell-main">{order.deliveryPartner.name ?? 'Rider'}</span>
                        : <span className="cell-sub">Unassigned</span>}
                      <div className="cell-sub">{order.accepted ? 'Accepted' : ''}</div>
                    </td>
                    <td>
                      <div className="cell-actions">
                        {order.status === 'pending' ? (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => setConfirmTarget(order)}
                            disabled={actionBusy === order.id}
                            type="button"
                          >
                            {actionBusy === order.id ? <Spinner size={11} /> : <Icon name="check" size={12} />}
                            Confirm
                          </button>
                        ) : null}
                        {order.status === 'confirmed' ? (
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => void prepare(order)}
                            disabled={actionBusy === order.id}
                            type="button"
                          >
                            {actionBusy === order.id ? <Spinner size={11} /> : <Icon name="package" size={12} />}
                            Preparing
                          </button>
                        ) : null}
                        {order.status === 'out_for_delivery' || order.status === 'assigned' ? null : null}
                        <Link
                          href={`/orders/${order.id}`}
                          className="btn btn-sm btn-ghost"
                          aria-label={`Open order ${order.orderNumber}`}
                        >
                          <Icon name="eye" size={13} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && total > 0 ? (
          <Pagination page={page} totalPages={totalPages} total={total} limit={limit} onPage={setPage} />
        ) : null}
      </div>

      <ConfirmDialog
        open={!!confirmTarget}
        title={`Confirm ${confirmTarget?.orderNumber ?? ''}?`}
        description="The customer is notified by email, then the order moves into preparation."
        confirmLabel="Confirm order"
        loading={confirmLoading}
        onConfirm={() => void confirmYes()}
        onClose={() => setConfirmTarget(null)}
      />

      <ConfirmDialog
        open={!!cancelTarget}
        title={`Cancel ${cancelTarget?.orderNumber ?? ''}`}
        description="Stock is returned automatically and delivered items are unaffected."
        confirmLabel="Cancel order"
        tone="danger"
        loading={cancelLoading}
        onConfirm={() => void submitCancel()}
        onClose={() => {
          setCancelTarget(null);
          setCancelReason('');
          setCancelError('');
        }}
      >
        <div className="field" style={{ marginTop: 4 }}>
          <label className="label" htmlFor="cancelReason">Reason <span className="required">*</span></label>
          <textarea
            id="cancelReason"
            className="textarea"
            value={cancelReason}
            placeholder="E.g. The customer called to change the order"
            maxLength={300}
            onChange={(event) => {
              setCancelReason(event.target.value);
              setCancelError('');
            }}
          />
          <span className="field-hint">{cancelReason.trim().length}/300 · minimum 3 characters</span>
          {cancelError ? <span className="field-error">{cancelError}</span> : null}
        </div>
      </ConfirmDialog>
    </main>
  );
}
