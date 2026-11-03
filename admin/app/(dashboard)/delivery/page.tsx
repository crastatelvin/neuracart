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
  Pagination,
  SkeletonTable,
  Spinner,
} from '@/components/ui';
import { api, apiPage, queryString } from '@/lib/api';
import { formatINR, initials, relativeTime, titleCase } from '@/lib/format';
import type { DeliveryPartner } from '@/lib/types';

type PartnerFormValues = {
  name: string;
  email: string;
  phone: string;
  password: string;
  vehicleType: 'Bike' | 'Scooter' | 'EV' | string;
  vehicleNumber: string;
  isAvailable: boolean;
};

const EMPTY_FORM: PartnerFormValues = {
  name: '',
  email: '',
  phone: '',
  password: '',
  vehicleType: 'Bike',
  vehicleNumber: '',
  isAvailable: true,
};

type Mode = null | { kind: 'create' } | { kind: 'edit'; partner: DeliveryPartner };

function validate(values: PartnerFormValues, kind: 'create' | 'edit'): Record<string, string> {
  const errors: Record<string, string> = {};
  if (values.name.trim().length < 2) errors.name = 'Name must be at least 2 characters.';
  if (kind === 'create' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim())) {
    errors.email = 'Give a valid email address.';
  }
  if (values.phone.trim().length < 8) errors.phone = 'Give a valid phone number.';
  if (kind === 'create' && values.password.length < 8) {
    errors.password = 'Password must be at least 8 characters.';
  }
  if (values.vehicleNumber.trim().length < 3) {
    errors.vehicleNumber = 'Give the vehicle number shown on the plate.';
  }
  return errors;
}

export default function DeliveryPartnersPage() {
  const toast = useToast();
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [available, setAvailable] = useState<'all' | 'available' | 'offline'>('all');
  const [verified, setVerified] = useState<'all' | 'verified' | 'unverified'>('all');
  const [mode, setMode] = useState<Mode>(null);
  const [form, setForm] = useState<PartnerFormValues>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<DeliveryPartner | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<DeliveryPartner | null>(null);
  const [targetLoading, setTargetLoading] = useState(false);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError('');
      try {
        const result = await apiPage<DeliveryPartner>(
          `/delivery-partners${queryString({
            page,
            limit,
            search: debouncedSearch || undefined,
            available:
              available === 'available' ? true : available === 'offline' ? false : undefined,
            verified:
              verified === 'verified' ? true : verified === 'unverified' ? false : undefined,
          })}`,
        );
        setPartners(result.data);
        setTotal(result.pagination.total);
        setTotalPages(result.pagination.totalPages);
      } catch (caught) {
        setPartners([]);
        setError(caught instanceof Error ? caught.message : 'Could not load delivery partners.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, limit, debouncedSearch, available, verified],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, available, verified]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const verifiedCount = partners.filter((partner) => partner.isVerified).length;
  const availableCount = partners.filter((partner) => partner.isAvailable).length;
  const activeAssignments = partners.reduce((sum, partner) => sum + partner.activeAssignments, 0);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setMode({ kind: 'create' });
  };
  const openEdit = (partner: DeliveryPartner) => {
    setFieldErrors({});
    setForm({
      name: partner.name ?? '',
      email: partner.email,
      phone: partner.phone ?? '',
      password: '',
      vehicleType: partner.vehicleType,
      vehicleNumber: partner.vehicleNumber,
      isAvailable: partner.isAvailable,
    });
    setMode({ kind: 'edit', partner });
  };

  const update = <K extends keyof PartnerFormValues>(key: K, value: PartnerFormValues[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!mode) return;
    const kind = mode.kind;
    const failures = validate(form, kind);
    if (Object.keys(failures).length > 0) {
      setFieldErrors(failures);
      return;
    }
    setSaving(true);
    try {
      if (kind === 'create') {
        const created = await api<DeliveryPartner>('/delivery-partners', {
          method: 'POST',
          body: {
            name: form.name.trim(),
            email: form.email.trim().toLowerCase(),
            phone: form.phone.trim(),
            password: form.password,
            vehicleType: form.vehicleType,
            vehicleNumber: form.vehicleNumber.trim(),
          },
        });
        toast.success(`${created.name ?? created.email} created. Login credentials were emailed.`);
        setMode(null);
      } else {
        const updated = await api<DeliveryPartner>(`/delivery-partners/${mode.partner.id}`, {
          method: 'PATCH',
          body: {
            name: form.name.trim(),
            phone: form.phone.trim(),
            vehicleType: form.vehicleType,
            vehicleNumber: form.vehicleNumber.trim(),
            isAvailable: form.isAvailable,
          },
        });
        toast.success(`${updated.name ?? updated.email} updated.`);
        setMode(null);
      }
      void load({ silent: true });
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not save the partner.');
    } finally {
      setSaving(false);
    }
  };

  const toggleVerify = async (partner: DeliveryPartner) => {
    setBusyId(partner.id);
    try {
      const next = await api<DeliveryPartner>(`/delivery-partners/${partner.id}/verify`, {
        method: 'PATCH',
        body: { isVerified: !partner.isVerified },
      });
      setVerifyTarget(null);
      void load({ silent: true });
      toast.success(`${next.name ?? next.email} ${next.isVerified ? 'verified.' : 'unverified.'}`);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not update verification.');
    } finally {
      setBusyId(null);
    }
  };

  const deactivate = async (partner: DeliveryPartner) => {
    setBusyId(partner.id);
    try {
      const next = await api<DeliveryPartner>(`/delivery-partners/${partner.id}/deactivate`, { method: 'PATCH' });
      setDeactivateTarget(null);
      void load({ silent: true });
      toast.info(`${next.name ?? next.email} deactivated.`);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not deactivate the partner.');
    } finally {
      setBusyId(null);
    }
  };

  const loadNext = (next: number) => {
    setPage(next);
  };

  const changeLimit = (next: number) => {
    setPage(1);
    setLimit(next);
  };

  const changePage = (next: number) => {
    loadNext(next);
  };

  return (
    <main className="page">
      <PageHeader
        title="Delivery partners"
        subtitle="Onboard, verify, and track rider availability"
        actions={
          <>
            <button className="btn btn-sm btn-secondary" disabled={refreshing} onClick={() => void load({ silent: true })} type="button">
              <span className={refreshing ? 'spin' : ''} style={{ display: 'inline-flex' }}>
                <Icon name="refresh" size={13} />
              </span>
              Refresh
            </button>
            <button className="btn btn-sm btn-primary" onClick={openCreate} type="button">
              <Icon name="plus" size={13} /> Add partner
            </button>
          </>
        }
      />

      <div className="mini-grid" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
        <div className="mini-card">
          <span className="mini-icon"><Icon name="users" size={16} /></span>
          <span>
            <span className="mini-value">{total}</span>
            <span className="mini-label" style={{ display: 'block' }}>Total partners</span>
          </span>
        </div>
        <div className="mini-card">
          <span className="mini-icon"><Icon name="shield" size={16} /></span>
          <span>
            <span className="mini-value">{verifiedCount}</span>
            <span className="mini-label" style={{ display: 'block' }}>Verified</span>
          </span>
        </div>
        <div className="mini-card">
          <span className="mini-icon"><Icon name="truck" size={16} /></span>
          <span>
            <span className="mini-value">{availableCount}</span>
            <span className="mini-label" style={{ display: 'block' }}>Available now</span>
          </span>
        </div>
        <div className="mini-card">
          <span className="mini-icon"><Icon name="orders" size={16} /></span>
          <span>
            <span className="mini-value">{activeAssignments}</span>
            <span className="mini-label" style={{ display: 'block' }}>Active assignments</span>
          </span>
        </div>
      </div>

      {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}

      <div className="card table-card">
        <div className="toolbar">
          <div className="search-box">
            <Icon name="search" size={14} />
            <input
              placeholder="Search partners, phone, vehicle"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search partners"
              type="search"
            />
          </div>
          <select className="select-sm" value={available} onChange={(event) => setAvailable(event.target.value as typeof available)} aria-label="Availability">
            <option value="all">Any availability</option>
            <option value="available">Available</option>
            <option value="offline">Offline</option>
          </select>
          <select className="select-sm" value={verified} onChange={(event) => setVerified(event.target.value as typeof verified)} aria-label="Verification">
            <option value="all">Any status</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
          </select>
          <span className="filter-spacer" />
        </div>

        {loading ? (
          <SkeletonTable rows={6} />
        ) : partners.length === 0 ? (
          <EmptyState
            icon="delivery"
            title={debouncedSearch || verified !== 'all' || available !== 'all' ? 'No partners match the filters' : 'No delivery partners yet'}
            text="Add a rider, share their temporary password, and they can log in on the delivery app."
            action={
              <button className="btn btn-primary" onClick={openCreate} type="button">
                <Icon name="plus" size={14} /> Add partner
              </button>
            }
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Partner</th>
                    <th>Vehicle</th>
                    <th>Status</th>
                    <th className="num">Active</th>
                    <th className="num">Deliveries</th>
                    <th className="num">Earnings</th>
                    <th>Last login</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {partners.map((partner) => (
                    <tr key={partner.id}>
                      <td>
                        <div className="cell-person">
                          <span className="avatar">{initials(partner.name ?? 'Rider')}</span>
                          <span>
                            <span className="cell-main">{partner.name ?? partner.email}</span>
                            <span className="cell-sub">{partner.email}</span>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="cell-main">{titleCase(partner.vehicleType)}</span>
                        <div className="cell-sub">{partner.vehicleNumber}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span className={`availability-dot ${partner.isAvailable ? 'on' : ''}`} />
                          <span>{partner.isAvailable ? 'Available' : 'Offline'}</span>
                        </div>
                        <div style={{ marginTop: 3 }}>
                          <span className={`badge no-dot ${partner.isVerified ? 'badge-green' : 'badge-amber'}`}>
                            {partner.isVerified ? 'Verified' : 'Unverified'}
                          </span>
                          {!partner.isActive ? <span className="badge no-dot badge-red">Inactive</span> : null}
                        </div>
                      </td>
                      <td className="num">{partner.activeAssignments}</td>
                      <td className="num">{partner.totalDeliveries}</td>
                      <td className="num">{formatINR(partner.earnings)}</td>
                      <td className="cell-sub">{relativeTime(partner.lastLoginAt)}</td>
                      <td>
                        <div className="cell-actions">
                          <button className="btn btn-sm btn-ghost" onClick={() => openEdit(partner)} type="button">
                            <Icon name="edit" size={13} /> Edit
                          </button>
                          {!partner.isVerified ? (
                            <button
                              className="btn btn-sm btn-primary"
                              disabled={busyId === partner.id || deactivateTarget ? false : false}
                              onClick={() => setVerifyTarget(partner)}
                              type="button"
                            >
                              {busyId === partner.id ? <Spinner size={11} /> : <Icon name="shield" size={12} />}
                              Verify
                            </button>
                          ) : (
                            <button
                              className="btn btn-sm btn-secondary"
                              disabled={busyId === partner.id}
                              onClick={() => setVerifyTarget(partner)}
                              type="button"
                            >
                              {busyId === partner.id ? <Spinner size={11} /> : <Icon name="close" size={12} />}
                              Unverify
                            </button>
                          )}
                          {partner.isActive ? (
                            <button
                              className="btn btn-sm btn-danger-soft"
                              disabled={busyId === partner.id}
                              onClick={() => setDeactivateTarget(partner)}
                              type="button"
                            >
                              Deactivate
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} limit={limit} onPage={changePage} />
          </>
        )}
      </div>

      <Modal
        open={!!mode}
        title={mode?.kind === 'edit' ? 'Edit partner' : 'Add delivery partner'}
        description={mode?.kind === 'edit'
          ? 'Update the partner profile, vehicle, and availability.'
          : 'We create a delivery-partner login and email temporary credentials.'}
        onClose={saving ? () => undefined : () => setMode(null)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setMode(null)} disabled={saving} type="button">
              Cancel
            </button>
            <button className="btn btn-primary" form="partnerForm" type="submit" disabled={saving}>
              {saving ? <Spinner /> : <Icon name="save" size={14} />}
              {mode?.kind === 'edit' ? 'Save partner' : 'Create partner'}
            </button>
          </>
        }
      >
        <form id="partnerForm" onSubmit={submit} className="partner-form-grid" noValidate>
          <div className="field full">
            <label className="label" htmlFor="name">Full name <span className="required">*</span></label>
            <input className="input" id="name" value={form.name} placeholder="Arun Kumar" onChange={(event) => update('name', event.target.value)} />
            <FieldError>{fieldErrors.name}</FieldError>
          </div>
          {mode?.kind === 'create' ? (
            <div className="field full">
              <label className="label" htmlFor="email">Email <span className="required">*</span></label>
              <input className="input" id="email" type="email" value={form.email} placeholder="arun@neuracart.app" onChange={(event) => update('email', event.target.value)} />
              <FieldError>{fieldErrors.email}</FieldError>
            </div>
          ) : (
            <div className="field full">
              <label className="label" htmlFor="emailEdit">Email</label>
              <input className="input" id="emailEdit" value={form.email} disabled />
            </div>
          )}
          <div className="field full">
            <label className="label" htmlFor="phone">Phone <span className="required">*</span></label>
            <input className="input" id="phone" value={form.phone} placeholder="+91 98450 12345" onChange={(event) => update('phone', event.target.value)} />
            <FieldError>{fieldErrors.phone}</FieldError>
          </div>
          {mode?.kind === 'create' ? (
            <div className="field full">
              <label className="label" htmlFor="password">Temporary password <span className="required">*</span></label>
              <input className="input" id="password" type="text" value={form.password} placeholder="Minimum 8 characters" onChange={(event) => update('password', event.target.value)} />
              <span className="field-hint">Shared once with the rider and stored securely in auth.</span>
              <FieldError>{fieldErrors.password}</FieldError>
            </div>
          ) : null}
          <div className="field">
            <label className="label" htmlFor="vehicleType">Vehicle type <span className="required">*</span></label>
            <select className="select" id="vehicleType" value={form.vehicleType} onChange={(event) => update('vehicleType', event.target.value)}>
              <option value="Bike">Bike</option>
              <option value="Scooter">Scooter</option>
              <option value="EV">EV</option>
            </select>
            <FieldError>{fieldErrors.vehicleType}</FieldError>
          </div>
          <div className="field">
            <label className="label" htmlFor="vehicleNumber">Vehicle number <span className="required">*</span></label>
            <input className="input" id="vehicleNumber" value={form.vehicleNumber} placeholder="KA-05-AB-1234" onChange={(event) => update('vehicleNumber', event.target.value)} />
            <FieldError>{fieldErrors.vehicleNumber}</FieldError>
          </div>
          {mode?.kind === 'edit' ? (
            <div className="checkbox-row full">
              <input
                id="isAvailable"
                type="checkbox"
                checked={form.isAvailable}
                onChange={(event) => update('isAvailable', event.target.checked)}
              />
              <div className="checkbox-copy">
                <strong>Mark available</strong>
                <span>Only available + verified riders can receive new assignments.</span>
              </div>
            </div>
          ) : null}
        </form>
      </Modal>

      <ConfirmDialog
        open={!!verifyTarget}
        title={`Verify ${verifyTarget?.name ?? 'rider'}?`}
        description="Only verified riders receive new assignments. Unverified riders can still use the app."
        confirmLabel={verifyTarget?.isVerified ? 'Unverify rider' : 'Verify rider'}
        loading={!!verifyTarget && busyId === verifyTarget.id}
        onConfirm={() => void (verifyTarget ? toggleVerify(verifyTarget) : Promise.resolve())}
        onClose={() => setVerifyTarget(null)}
      />
      <ConfirmDialog
        open={!!deactivateTarget}
        title={`Deactivate ${deactivateTarget?.name ?? 'rider'}?`}
        description="They cannot sign in or be assigned. This is blocked while orders are assigned."
        confirmLabel="Deactivate"
        tone="danger"
        loading={!!deactivateTarget && busyId === deactivateTarget.id}
        onConfirm={() => void (deactivateTarget ? deactivate(deactivateTarget) : Promise.resolve())}
        onClose={() => setDeactivateTarget(null)}
      />
    </main>
  );
}
