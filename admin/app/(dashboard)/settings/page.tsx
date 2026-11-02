'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/Icons';
import { useToast } from '@/components/Toast';
import { ErrorBanner, PageHeader, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDayLabel, formatDateIST } from '@/lib/format';
import type { Store } from '@/lib/types';

type Values = {
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  latitude: string;
  longitude: string;
  openTime: string;
  closeTime: string;
  deliveryFee: string;
  freeDeliveryAbove: string;
  manuallyOpen: boolean;
};

function validate(values: Values): Record<string, string> {
  const errors: Record<string, string> = {};
  if (values.name.trim().length === 0) errors.name = 'The store name is required.';
  if (values.address.trim().length < 5) errors.address = 'Give the full street address.';
  if (values.city.trim().length === 0) errors.city = 'City is required.';
  if (values.state.trim().length === 0) errors.state = 'State is required.';
  if (!/^\d{6}$/.test(values.pincode.trim())) errors.pincode = 'Pincode must be 6 digits.';
  if (values.phone.trim().length < 8) errors.phone = 'Give a valid contact number.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim())) errors.email = 'Give a valid email.';
  if (Number.isNaN(Number(values.latitude)) || Number(values.latitude) < -90 || Number(values.latitude) > 90) {
    errors.latitude = 'Latitude must be between -90 and 90.';
  }
  if (Number.isNaN(Number(values.longitude)) || Number(values.longitude) < -180 || Number(values.longitude) > 180) {
    errors.longitude = 'Longitude must be between -180 and 180.';
  }
  if (values.openTime >= values.closeTime) errors.closeTime = 'Closing time must be after opening time.';
  if (Number.isNaN(Number(values.deliveryFee)) || Number(values.deliveryFee) < 0) {
    errors.deliveryFee = 'Delivery fee cannot be negative.';
  }
  if (Number.isNaN(Number(values.freeDeliveryAbove)) || Number(values.freeDeliveryAbove) < 0) {
    errors.freeDeliveryAbove = 'Free-delivery threshold cannot be negative.';
  }
  return errors;
}

function toState(store: Store): Values {
  return {
    name: store.name,
    address: store.address,
    city: store.city,
    state: store.state,
    pincode: store.pincode,
    phone: store.phone,
    email: store.email,
    latitude: String(store.latitude),
    longitude: String(store.longitude),
    openTime: store.openTime,
    closeTime: store.closeTime,
    deliveryFee: store.deliveryFee,
    freeDeliveryAbove: store.freeDeliveryAbove,
    manuallyOpen: store.manuallyOpen,
  };
}

export default function SettingsPage() {
  const toast = useToast();
  const [store, setStore] = useState<Store | null>(null);
  const [values, setValues] = useState<Values | null>(null);
  const [initial, setInitial] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [weather, setWeather] = useState<{
    mode: 'NORMAL' | 'RAIN' | 'HEAVY';
    note: string;
    surgeFee: string;
    etaMinutes: number;
  } | null>(null);
  const [weatherSaving, setWeatherSaving] = useState(false);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const next = await api<Store>('/store');
      setStore(next);
      setInitial(next);
      setValues(toState(next));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load the store settings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadWeather = useCallback(async () => {
    try {
      setWeather(await api('/admin/store/weather'));
    } catch {
      setWeather(null);
    }
  }, []);

  useEffect(() => {
    void loadWeather();
  }, [loadWeather]);

  async function saveWeather() {
    if (!weather) return;
    setWeatherSaving(true);
    try {
      await api('/admin/store/weather', {
        method: 'POST',
        body: {
          mode: weather.mode,
          note: weather.note.trim() || undefined,
          surgeFee: Number(weather.surgeFee) || 0,
        },
      });
      toast.success('Weather settings saved.');
      await loadWeather();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not save weather settings.');
    } finally {
      setWeatherSaving(false);
    }
  }

  const update = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => {
      if (!current) return current;
      const next = { ...current, [key]: value };
      setFieldErrors((errors) => {
        if (!errors[key as string]) return errors;
        const copy = { ...errors };
        delete copy[key as string];
        return copy;
      });
      return next;
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!values) return;
    const failures = validate(values);
    if (Object.keys(failures).length > 0) {
      setFieldErrors(failures);
      toast.error('Fix the highlighted fields and try saving again.');
      return;
    }
    setSaving(true);
    try {
      const next = await api<Store>('/store', {
        method: 'PATCH',
        body: {
          name: values.name.trim(),
          address: values.address.trim(),
          city: values.city.trim(),
          state: values.state.trim(),
          pincode: values.pincode.trim(),
          phone: values.phone.trim(),
          email: values.email.trim(),
          latitude: Number(values.latitude),
          longitude: Number(values.longitude),
          openTime: values.openTime,
          closeTime: values.closeTime,
          deliveryFee: Number(values.deliveryFee),
          freeDeliveryAbove: Number(values.freeDeliveryAbove),
          isOpen: values.manuallyOpen,
        },
      });
      setStore(next);
      setInitial(next);
      setValues(toState(next));
      toast.success(next.isOpen ? 'Store saved and open for new orders.' : 'Store saved. It is temporarily closed.');
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not save the store.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !values) {
    return (
      <main className="page">
        {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : (
          <div className="card"><SkeletonRows /></div>
        )}
      </main>
    );
  }

  return (
    <main className="page">
      <PageHeader
        title="Settings"
        subtitle={store ? store.name : 'Store profile and delivery rules'}
        actions={
          <>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => {
                setValues(initial ? toState(initial) : null);
                setFieldErrors({});
                toast.info('Reverted unsaved changes.');
              }}
              disabled={!initial || refreshing}
              type="button"
            >
              <Icon name="refresh" size={13} /> Reset
            </button>
            <button
              className="btn btn-sm btn-primary"
              form="settingsForm"
              type="submit"
              disabled={saving}
            >
              {saving ? <Spinner /> : <Icon name="save" size={13} />}
              Save changes
            </button>
          </>
        }
      />

      {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}

      <form className="settings-layout" id="settingsForm" onSubmit={submit}>
        <div className="form-card" style={{ overflow: 'visible' }}>
          <div className="form-section">
            <div className="form-section-header">
              <p className="form-section-title">Store profile</p>
              <p className="form-section-text">Shown across the customer and delivery apps.</p>
            </div>
            <div className="form-grid">
              <div className="field full">
                <label className="label" htmlFor="name">Store name <span className="required">*</span></label>
                <input className="input" id="name" value={values.name} onChange={(event) => update('name', event.target.value)} />
                <span className="field-error">{fieldErrors.name}</span>
              </div>
              <div className="field full">
                <label className="label" htmlFor="address">Street address <span className="required">*</span></label>
                <input className="input" id="address" value={values.address} onChange={(event) => update('address', event.target.value)} />
                <span className="field-hint">{fieldErrors.address}</span>
              </div>
              <div className="field"><label className="label">City</label><input className="input" value={values.city} onChange={(event) => update('city', event.target.value)} /><span className="field-error">{fieldErrors.city}</span></div>
              <div className="field"><label className="label">State</label><input className="input" value={values.state} onChange={(event) => update('state', event.target.value)} /><span className="field-error">{fieldErrors.state}</span></div>
              <div className="field"><label className="label">Pincode</label><input className="input" value={values.pincode} onChange={(event) => update('pincode', event.target.value)} /><span className="field-error">{fieldErrors.pincode}</span></div>
              <div className="field"><label className="label">Phone</label><input className="input" value={values.phone} onChange={(event) => update('phone', event.target.value)} /><span className="field-error">{fieldErrors.phone}</span></div>
              <div className="field full"><label className="label">Store email</label><input className="input" value={values.email} onChange={(event) => update('email', event.target.value)} /><span className="field-error">{fieldErrors.email}</span></div>
              <div className="field"><label className="label">Latitude</label><input className="input" value={values.latitude} onChange={(event) => update('latitude', event.target.value)} /><span className="field-error">{fieldErrors.latitude}</span></div>
              <div className="field"><label className="label">Longitude</label><input className="input" value={values.longitude} onChange={(event) => update('longitude', event.target.value)} /><span className="field-error">{fieldErrors.longitude}</span></div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-header">
              <p className="form-section-title">Hours</p>
              <p className="form-section-text">Orders are accepted only inside this IST window.</p>
            </div>
            <div className="form-grid">
              <div className="field">
                <label className="label" htmlFor="openTime">Opens</label>
                <input className="input" id="openTime" type="time" value={values.openTime} onChange={(event) => update('openTime', event.target.value)} />
              </div>
              <div className="field">
                <label className="label" htmlFor="closeTime">Closes</label>
                <input className="input" id="closeTime" type="time" value={values.closeTime} onChange={(event) => update('closeTime', event.target.value)} />
                <span className="field-error">{fieldErrors.closeTime}</span>
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-header">
              <p className="form-section-title">Delivery pricing</p>
              <p className="form-section-text">Free delivery above the threshold.</p>
            </div>
            <div className="form-grid">
              <div className="field">
                <label className="label">Delivery fee</label>
                <div className="input-group"><span className="input-prefix">₹</span>
                  <input className="input" value={values.deliveryFee} onChange={(event) => update('deliveryFee', event.target.value)} />
                </div>
                <span className="field-error">{fieldErrors.deliveryFee}</span>
              </div>
              <div className="field">
                <label className="label">Free delivery above</label>
                <div className="input-group"><span className="input-prefix">₹</span>
                  <input className="input" value={values.freeDeliveryAbove} onChange={(event) => update('freeDeliveryAbove', event.target.value)} />
                </div>
                <span className="field-error">{fieldErrors.freeDeliveryAbove}</span>
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-header">
              <p className="form-section-title">Storefront</p>
              <p className="form-section-text">Pause new orders without cancelling existing ones.</p>
            </div>
            <div className="checkbox-row">
              <input
                type="checkbox"
                checked={values.manuallyOpen}
                onChange={(event) => update('manuallyOpen', event.target.checked)}
              />
              <span className="checkbox-copy">
                <strong>Open for orders</strong>
                <span>Turning this off shows “temporarily closed” in the customer app until reopened.</span>
              </span>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-header">
              <p className="form-section-title">Weather surge</p>
              <p className="form-section-text">Added to the delivery fee while conditions are poor.</p>
            </div>
            {weather ? (
              <div className="form-grid">
                <div className="field">
                  <label className="label" htmlFor="weatherMode">Conditions</label>
                  <select
                    className="input"
                    id="weatherMode"
                    value={weather.mode}
                    onChange={(event) =>
                      setWeather({ ...weather, mode: event.target.value as typeof weather.mode })
                    }
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="RAIN">Rain</option>
                    <option value="HEAVY">Heavy / storm</option>
                  </select>
                  <span className="field-hint">ETA shown to customers: {weather.etaMinutes} min</span>
                </div>
                <div className="field">
                  <label className="label" htmlFor="surgeFee">Surge fee</label>
                  <div className="input-group">
                    <span className="input-prefix">₹</span>
                    <input
                      className="input"
                      id="surgeFee"
                      type="number"
                      min={0}
                      max={200}
                      value={weather.surgeFee}
                      onChange={(event) => setWeather({ ...weather, surgeFee: event.target.value })}
                    />
                  </div>
                </div>
                <div className="field full">
                  <label className="label" htmlFor="weatherNote">Customer note</label>
                  <input
                    className="input"
                    id="weatherNote"
                    maxLength={200}
                    value={weather.note}
                    onChange={(event) => setWeather({ ...weather, note: event.target.value })}
                    placeholder="E.g. Heavy rain — deliveries may take longer"
                  />
                </div>
                <div className="field full">
                  <button
                    className="btn btn-secondary"
                    type="button"
                    disabled={weatherSaving}
                    onClick={() => void saveWeather()}
                  >
                    {weatherSaving ? <Spinner /> : <Icon name="save" size={13} />} Save weather settings
                  </button>
                </div>
              </div>
            ) : (
              <p className="field-hint">Weather settings are unavailable right now.</p>
            )}
          </div>

          <div className="form-actions">
            <span className="field-hint" style={{ marginRight: 'auto' }}>
              {store ? `Auto-saved last at ${formatDayLabel(store.updatedAt.slice(0, 10))}` : ''}
            </span>
            <button className="btn btn-secondary" onClick={() => setValues(initial ? toState(initial) : null)} disabled={saving} type="button">
              Reset
            </button>
            <button className="btn btn-primary" disabled={saving} type="submit">
              {saving ? <Spinner /> : <Icon name="save" size={14} />} Save changes
            </button>
          </div>
        </div>

        <aside className="settings-aside">
          <div className="detail-card">
            <div className="detail-card-title">Store status</div>
            <span className={`status-pill ${store?.isOpen ? '' : 'closed'}`}>
              <span className={`availability-dot ${store?.isOpen ? 'on' : ''}`} />
              {store?.isOpen
                ? 'Open now · accepting orders'
                : store?.manuallyOpen
                  ? `Opens at ${store?.openTime} IST`
                  : 'Temporarily closed'}
            </span>
            <div className="info-list" style={{ marginTop: 12 }}>
              {store ? (
                <>
                  <div className="info-row"><span>Hours (IST)</span><span>{store.openTime}–{store.closeTime}</span></div>
                  <div className="info-row"><span>Member of</span><span>{store.city}</span></div>
                  <div className="info-row"><span>Updated</span><span>{formatDateIST(store.updatedAt)}</span></div>
                </>
              ) : null}
            </div>
          </div>
          <div className="detail-card">
            <div className="detail-card-title">Delivery configuration</div>
            <div className="info-list">
              <div className="info-row"><span>Rider payout</span><span>₹40 per delivery</span></div>
              <div className="info-row"><span>Max active per rider</span><span>3</span></div>
              <div className="info-row"><span>Order cutoff</span><span>22:00 IST</span></div>
            </div>
          </div>
          <div className="settings-note">
            <strong>Service pincodes</strong><br />
            The allow-list is set in the backend (SERVICE_PINCODES). Update it to serve more areas.
          </div>
        </aside>
      </form>
    </main>
  );
}

function SkeletonRows() {
  return (
    <div style={{ padding: 20 }}>
      {[0, 1, 2, 3, 4].map((item) => (
        <div className="skeleton skeleton-row" key={item} />
      ))}
    </div>
  );
}
