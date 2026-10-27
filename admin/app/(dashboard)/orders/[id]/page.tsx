'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/Icons';
import { useToast } from '@/components/Toast';
import {
  ConfirmDialog,
  EmptyState,
  Modal,
  PaymentStatusBadge,
  SkeletonTable,
  Spinner,
  StatusBadge,
} from '@/components/ui';
import { api } from '@/lib/api';
import {
  formatDateIST,
  formatINR,
  formatTimeIST,
  initials,
  relativeTime,
  STATUS_LABEL,
  titleCase,
} from '@/lib/format';
import type { DeliveryPartner, Order, OrderStatus } from '@/lib/types';

const NOT_FOUND = 'ORDER_NOT_FOUND';

function statusDotTone(status: OrderStatus): string {
  return status === 'cancelled' ? 'var(--red-600)' : status === 'delivered' ? 'var(--green-600)' : '#16a34a';
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const toast = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [riders, setRiders] = useState<DeliveryPartner[]>([]);
  const [ridersLoading, setRidersLoading] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');
  const [assigning, setAssigning] = useState<string | null>(null);
  const [action, setAction] = useState<{ label: string; status: OrderStatus } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotFound(false);
    try {
      const next = await api<Order>(`/orders/${params.id}`, { redirectOnUnauthorized: false });
      setOrder(next);
    } catch (caught) {
      setOrder(null);
      if (caught instanceof Error && caught.message.includes(NOT_FOUND)) setNotFound(true);
      setError(caught instanceof Error ? caught.message : 'Could not load the order.');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const transition = async () => {
    if (!order || !action) return;
    setActionLoading(true);
    try {
      await api<Order>(`/orders/${order.id}/status`, {
        method: 'PATCH',
        body: { status: action.status, note: undefined },
      });
      setAction(null);
      await load();
      window.dispatchEvent(new Event('localmart:refresh-shell'));
      toast.success(`${order.orderNumber} moved to ${STATUS_LABEL[action.status].toLowerCase()}.`);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not update the order.');
    } finally {
      setActionLoading(false);
    }
  };

  const submitCancel = async () => {
    if (!order) return;
    const reason = cancelReason.trim();
    if (reason.length < 3 || reason.length > 300) {
      setCancelError('Give a reason between 3 and 300 characters.');
      return;
    }
    setCancelLoading(true);
    try {
      await api<Order>(`/orders/${order.id}/cancel`, { method: 'POST', body: { reason } });
      setCancelOpen(false);
      setCancelReason('');
      await load();
      window.dispatchEvent(new Event('localmart:refresh-shell'));
      toast.success(`${order.orderNumber} cancelled.`);
    } catch (caught) {
      setCancelError(caught instanceof Error ? caught.message : 'Could not cancel.');
    } finally {
      setCancelLoading(false);
    }
  };

  const openAssign = async () => {
    setAssignOpen(true);
    setRidersLoading(true);
    setAssignSearch('');
    try {
      const result = await api<DeliveryPartner[]>('/delivery-partners?available=true&verified=true&limit=50&isActive=true');
      setRiders(result);
    } catch (caught) {
      setRiders([]);
      toast.error(caught instanceof Error ? caught.message : 'Could not load available riders.');
    } finally {
      setRidersLoading(false);
    }
  };

  const assignRider = async (partner: DeliveryPartner) => {
    if (!order) return;
    setAssigning(partner.id);
    try {
      await api<Order>(`/orders/${order.id}/assign`, {
        method: 'PATCH',
        body: { partnerId: partner.id, note: `Assigned to ${partner.name ?? 'rider'}` },
      });
      setAssignOpen(false);
      await load();
      window.dispatchEvent(new Event('localmart:refresh-shell'));
      toast.success(`${partner.name ?? 'Rider'} assigned to ${order.orderNumber}.`);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not assign the rider.');
    } finally {
      setAssigning(null);
    }
  };

  if (loading) {
    return (
      <main className="page">
        <div className="card"><SkeletonTable rows={8} /></div>
      </main>
    );
  }

  if (notFound || !order) {
    return (
      <main className="page">
        <EmptyState
          icon="orders"
          title="Order not found"
          text={error || 'This order may have been removed or the link is stale.'}
          action={<Link className="btn btn-secondary" href="/orders">Back to orders</Link>}
        />
      </main>
    );
  }

  const actorName = (id: string | null) => {
    if (!id) return 'System';
    if (id === order.customer.id) return order.customer.name ?? order.customer.email;
    if (order.deliveryPartner?.id === id) return order.deliveryPartner.name ?? 'Rider';
    return 'Store admin';
  };

  const history = order.statusHistory
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const cancelable = ['pending', 'confirmed', 'preparing', 'assigned', 'out_for_delivery'].includes(order.status);
  const businessMap: Record<OrderStatus, { label: string; target: OrderStatus }[]> = {
    pending: [{ label: 'Confirm order', target: 'confirmed' }],
    confirmed: [{ label: 'Mark preparing', target: 'preparing' }],
    preparing: [],
    assigned: [{ label: 'Mark out for delivery', target: 'out_for_delivery' }],
    out_for_delivery: [{ label: 'Mark delivered', target: 'delivered' }],
    delivered: [],
    cancelled: [],
  };
  const contextActions = businessMap[order.status];

  return (
    <main className="page">
      <Link href="/orders" className="btn btn-ghost btn-sm" style={{ marginBottom: 14, width: 'fit-content' }}>
        <Icon name="chevron-left" size={13} /> All orders
      </Link>

      <div className="order-header-card">
        <div className="order-header-main">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 className="order-number">{order.orderNumber}</h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="order-header-meta" style={{ marginTop: 5 }}>
            Placed {formatDateIST(order.createdAt)} · {order.itemCount} item{order.itemCount === 1 ? '' : 's'} · {formatINR(order.total)}
          </p>
        </div>
        <div className="header-actions">
          {cancelable ? (
            <button className="btn btn-sm btn-secondary" onClick={() => { setCancelOpen(true); setCancelReason(''); }} type="button">
              <Icon name="close" size={13} /> Cancel order
            </button>
          ) : null}
          {['pending', 'confirmed', 'assigned', 'out_for_delivery'].includes(order.status)
            ? businessMap[order.status].map((item) => (
              <button
                key={item.target}
                className="btn btn-sm btn-primary"
                onClick={() => setAction({ ...item, status: item.target })}
                type="button"
              >
                <Icon name="check" size={13} /> {item.label}
              </button>
            ))
            : null}
          {['preparing', 'assigned'].includes(order.status) ? (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => void openAssign()}
              type="button"
            >
              <Icon name="bike" size={14} />
              {order.status === 'assigned' ? 'Reassign rider' : 'Assign partner'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="order-layout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="card">
            <div className="card-header">
              <div>
                <p className="card-title">Status timeline</p>
                <p className="card-subtitle">{history.length} change{history.length === 1 ? '' : 's'}</p>
              </div>
            </div>
            <div className="card-body">
              <div className="timeline">
                {history.map((entry, index) => (
                  <div className={`timeline-item ${index === 0 ? '' : 'muted'}`} key={entry.id}>
                    {index < history.length - 1 ? <span className="timeline-line" /> : null}
                    <span className="timeline-dot" style={{ background: statusDotTone(entry.status) }} />
                    <div className="timeline-copy">
                      <div className="timeline-title">
                        {STATUS_LABEL[entry.status]}
                        <span className="badge no-dot badge-gray">{actorName(entry.changedBy)}</span>
                      </div>
                      <p className="timeline-note">
                        {entry.note ? entry.note : 'Status updated'}
                        <span className="timeline-time"> · {formatTimeIST(entry.createdAt)} · {relativeTime(entry.createdAt)}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card table-card">
            <div className="card-header">
              <div>
                <p className="card-title">Items</p>
                <p className="card-subtitle">{order.itemCount} unit{order.itemCount === 1 ? '' : 's'} in {order.items.length} product{order.items.length === 1 ? '' : 's'}</p>
              </div>
              {order.notes ? (
                <div className="note-box" style={{ maxWidth: 330 }}>
                  <strong>Customer note:</strong> {order.notes}
                </div>
              ) : null}
            </div>
            <div>
              {order.items.map((item) => (
                <div className="order-item" key={item.id}>
                  <span className="thumb-placeholder">
                    {item.product.imageUrl ? (
                      <img className="thumb" src={item.product.imageUrl} alt={item.product.name} />
                    ) : (
                      <Icon name="package" size={15} />
                    )}
                  </span>
                  <span className="order-item-main">
                    <span className="order-item-name">{item.product.name}</span>
                    <span className="order-item-meta">
                      {titleCase(item.product.category)} · {item.product.unit} · {formatINR(item.unitPrice)} each
                    </span>
                  </span>
                  <span className="order-item-total">{formatINR(item.total)}</span>
                </div>
              ))}
              <div className="totals">
                <div className="total-row"><span>Subtotal</span><span>{formatINR(order.subtotal)}</span></div>
                <div className="total-row"><span>Delivery</span><span>{formatINR(order.deliveryFee)}</span></div>
                {Number(order.discount) > 0 ? (
                  <div className="total-row"><span>Discount</span><span>-{formatINR(order.discount)}</span></div>
                ) : null}
                <div className="total-row grand">
                  <span>Total</span>
                  <span>{formatINR(order.total)}</span>
                </div>
              </div>
            </div>
          </div>

          {order.status === 'cancelled' ? (
            <div className="cancel-box">
              <strong>Order cancelled</strong>
              {order.cancelReason ? <p style={{ marginTop: 3 }}>{order.cancelReason}</p> : null}
              {order.cancelledAt ? <p className="order-header-meta" style={{ marginTop: 4 }}>{formatDateIST(order.cancelledAt)}</p> : null}
            </div>
          ) : null}
        </div>

        <div className="side-stack">
          <div className="detail-card">
            <div className="detail-card-title">Customer</div>
            <p className="detail-name">{order.customer.name ?? 'Customer'}</p>
            <div className="detail-line"><Icon name="mail" size={13} />{order.customer.email}</div>
            <div className="detail-line"><Icon name="phone" size={13} /><a href={`tel:${order.customer.phone ?? ''}`}>{order.customer.phone ?? '—'}</a></div>
            <div className="detail-divider" />
            <div className="detail-card-title">Delivery address</div>
            <div className="detail-line">
              <Icon name="map-pin" size={13} />
              <span>
                {order.address.line1}
                {order.address.line2 ? `, ${order.address.line2}` : ''}
                <br />{order.address.city}, {order.address.state} {order.address.pincode}
                <br /><span className="badge no-dot badge-gray">{titleCase(order.address.label)}</span>
              </span>
            </div>
            {order.address.latitude && order.address.longitude ? (
              <a className="btn btn-ghost btn-sm" style={{ marginTop: 10, justifyContent: 'flex-start' }} href={`https://www.google.com/maps/search/?api=1&query=${order.address.latitude},${order.address.longitude}`} target="_blank" rel="noreferrer">
                Open in maps <Icon name="external-link" size={12} />
              </a>
            ) : null}
          </div>

          <div className="detail-card">
            <div className="detail-card-title">Payment</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="badge no-dot badge-gray">{order.paymentMethod === 'cod' ? 'Cash on delivery' : 'Online'}</span>
              <PaymentStatusBadge status={order.paymentStatus} />
            </div>
            <div className="info-list" style={{ marginTop: 12 }}>
              <div className="info-row"><span>Method</span><span>{order.paymentMethod}</span></div>
              <div className="info-row"><span>Total</span><span>{formatINR(order.total)}</span></div>
            </div>
          </div>

          <div className="detail-card">
            <div className="detail-card-title">
              Rider
              {order.deliveryPartner ? (
                <span className={`badge no-dot ${order.accepted ? 'badge-green' : 'badge-amber'}`}>
                  {order.accepted ? 'Accepted' : 'Awaiting reply'}
                </span>
              ) : null}
            </div>
            {order.deliveryPartner ? (
              <div className="rider-row">
                <span className="avatar">{initials(order.deliveryPartner.name ?? 'Rider')}</span>
                <span style={{ flex: 1 }}>
                  <span className="detail-name">{order.deliveryPartner.name ?? 'Rider'}</span>
                  <div className="rider-meta">
                    {order.deliveryPartner.phone ?? order.deliveryPartner.email}
                    {order.deliveryPartner.phone ? (
                      <>
                        {' · '}
                        <a href={`tel:${order.deliveryPartner.phone}`}>Call</a>
                      </>
                    ) : null}
                  </div>
                </span>
                <button className="btn btn-sm btn-secondary" onClick={() => void openAssign()} type="button">Reassign</button>
              </div>
            ) : (
              <EmptyState icon="bike" title="No rider assigned yet" text={order.status === 'preparing' ? 'Assign a partner from the available list.' : 'The rider appears once the order advances.'} />
            )}
          </div>

          {order.tracking && ['assigned', 'out_for_delivery'].includes(order.status) ? (
            <div className="detail-card">
              <div className="detail-card-title">Live tracking</div>
              <div className="info-list">
                <div className="info-row"><span>Rider location</span><span>{order.tracking.latitude ?? '—'}, {order.tracking.longitude ?? '—'}</span></div>
                <div className="info-row"><span>Updated</span><span>{relativeTime(order.tracking.updatedAt)}</span></div>
              </div>
            </div>
          ) : null}

          {contextActions.length > 0 || cancelable ? (
            <div className="detail-card">
              <div className="detail-card-title">Next actions</div>
              <div className="action-stack">
                {contextActions.map((item) => (
                  <button
                    className="btn btn-primary"
                    key={item.target}
                    onClick={() => setAction({ ...item, status: item.target })}
                    type="button"
                  >
                    <Icon name="check" size={14} /> {item.label}
                  </button>
                ))}
                {['preparing', 'assigned'].includes(order.status) ? (
                  <button className="btn btn-secondary" onClick={() => void openAssign()} type="button">
                    <Icon name="bike" size={14} /> {order.status === 'assigned' ? 'Reassign rider' : 'Assign partner'}
                  </button>
                ) : null}
                {cancelable ? (
                  <button
                    className="btn btn-danger-soft"
                    onClick={() => { setCancelOpen(true); setCancelReason(''); }}
                    type="button"
                  >
                    <Icon name="close" size={14} /> Cancel with reason
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={!!action}
        title={action ? `${action.label}?` : ''}
        description={`Continue moving ${order.orderNumber} to ${action ? STATUS_LABEL[action.status].toLowerCase() : ''}? The customer is notified by email.`}
        confirmLabel={action?.label}
        loading={actionLoading}
        onConfirm={() => void transition()}
        onClose={() => setAction(null)}
      />

      <ConfirmDialog
        open={cancelOpen}
        title={`Cancel ${order.orderNumber}`}
        description="Stock returns to the shelf automatically once this is saved."
        confirmLabel="Cancel order"
        tone="danger"
        loading={cancelLoading}
        onConfirm={() => void submitCancel()}
        onClose={() => { setCancelOpen(false); setCancelReason(''); setCancelError(''); }}
      >
        <div className="field" style={{ marginTop: 4 }}>
          <label className="label" htmlFor="cancelReasonDetail">Reason <span className="required">*</span></label>
          <textarea
            id="cancelReasonDetail"
            className="textarea"
            maxLength={300}
            value={cancelReason}
            placeholder="E.g. Address is outside the delivery radius"
            onChange={(event) => { setCancelReason(event.target.value); setCancelError(''); }}
          />
          <span className="field-hint">{cancelReason.trim().length}/300 · minimum 3 characters</span>
          {cancelError ? <span className="field-error">{cancelError}</span> : null}
        </div>
      </ConfirmDialog>

      <Modal
        open={assignOpen}
        title={order.status === 'assigned' ? 'Reassign rider' : 'Assign partner'}
        description="Only verified riders who are online and below the active-order limit appear here."
        onClose={() => setAssignOpen(false)}
        wide
      >
        <div className="field" style={{ marginBottom: 12 }}>
          <label className="label" htmlFor="riderSearch">Filter riders</label>
          <input
            className="input"
            id="riderSearch"
            placeholder="Search by name, vehicle, or number"
            value={assignSearch}
            onChange={(event) => setAssignSearch(event.target.value)}
          />
        </div>
        {ridersLoading ? <SkeletonTable rows={3} /> : null}
        {!ridersLoading && riders.length === 0 ? (
          <EmptyState icon="bike" title="No riders online" text="Riders appear as soon as they toggle availability in the delivery app." />
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {riders.filter((partner) => `${partner.name ?? ''} ${partner.vehicleType} ${partner.vehicleNumber}`.toLowerCase().includes(assignSearch.toLowerCase())).map((partner) => (
            <div key={partner.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 10 }}>
              <span className="avatar">{initials(partner.name ?? 'Rider')}</span>
              <span style={{ flex: 1 }}>
                <span className="detail-name">{partner.name ?? 'Rider'}</span>
                <div className="rider-meta">{titleCase(partner.vehicleType)} · {partner.vehicleNumber}</div>
                <div className="rider-meta">{partner.activeAssignments} active · {formatINR(partner.earnings)} earned</div>
              </span>
              {partner.id === order.deliveryPartner?.id ? (
                <span className="badge no-dot badge-blue">Current</span>
              ) : (
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => void assignRider(partner)}
                  disabled={assigning !== null}
                  type="button"
                >
                  {assigning === partner.id ? <Spinner size={11} /> : <Icon name="check" size={12} />}
                  Assign
                </button>
              )}
            </div>
          ))}
        </div>
      </Modal>
    </main>
  );
}
