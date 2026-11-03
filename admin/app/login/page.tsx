'use client';

import { useCallback, useEffect, useState } from 'react';
import { BrandMark, Icon } from '@/components/Icons';
import { Spinner } from '@/components/ui';
import {
  ApiError,
  readSession,
  sendAdminOtp,
  verifyAdminOtp,
} from '@/lib/api';
import { useRouter } from 'next/navigation';

type Step = 'email' | 'otp';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<Step>('email');
  const [code, setCode] = useState('');
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [redirecting, setRedirecting] = useState(false);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  useEffect(() => {
    if (readSession()) router.replace('/dashboard');
    const params = new URLSearchParams(window.location.search);
    if (params.get('expired') === '1') {
      setError('Your session expired. Please sign in again.');
      window.history.replaceState(null, '', '/login');
    }
    const fromUrl = params.get('email');
    if (fromUrl) {
      setEmail(params.get('email')!);
      window.history.replaceState(null, '', '/login');
    }
  }, [router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const sendOtp = useCallback(
    async (address: string) => {
      const normalized = address.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)) return;
      setResending(true);
      setError('');
      try {
        const result = await sendAdminOtp(normalized);
        setDevOtp(result.devOtp ?? '');
        setStep('otp');
        setCooldown(60);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Something went wrong. Try again.');
      } finally {
        setResending(false);
      }
    },
    [],
  );

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      await verifyAdminOtp(email.trim().toLowerCase(), code.trim());
      setRedirecting(true);
      router.replace('/dashboard');
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 403) {
        setError('Access denied. Admins only.');
      } else if (caught instanceof ApiError && caught.status === 429) {
        setError(caught.message);
      } else {
        setError(
          caught instanceof ApiError
            ? caught.message
            : 'We could not sign you in. Try again.',
        );
      }
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const changeEmail = () => {
    setStep('email');
    setCode('');
    setDevOtp('');
    setError('');
    setCooldown(0);
  };

  return (
    <div className="login-page">
      <div className="login-brand">
        <span className="login-logo">
          <BrandMark size={38} />
          <span style={{ display: 'block' }}>
            <span className="brand-name">NeuraCart</span>
            <span className="brand-sub">Your neighbourhood market</span>
          </span>
        </span>
        <div className="login-hero">
          <span className="login-eyebrow">
            <Icon name="shield" size={11} /> Store operations
          </span>
          <h2>
            Everything your store needs,
            <br />
            in one calm place.
          </h2>
          <p>
            Confirm orders, assign riders, restock products and keep the storefront open —
            all from a single, focused control room.
          </p>
        </div>
        <div className="login-points">
          <span className="login-point"><Icon name="check-circle" size={13} /> Live order board</span>
          <span className="login-point"><Icon name="check-circle" size={13} /> Inventory control</span>
          <span className="login-point"><Icon name="check-circle" size={13} /> Rider management</span>
          <span className="login-point"><Icon name="check-circle" size={13} /> Store settings</span>
        </div>
      </div>

      <div className="login-form-side">
        <div className="login-card">
          {step === 'otp' ? (
            <button className="login-back" onClick={changeEmail} type="button">
              <Icon name="chevron-left" size={13} /> Back
            </button>
          ) : null}

          {(step === 'otp' ? redirecting : false) ? null : null}

          <h1>
            {step === 'email' ? 'NeuraCart Admin' : 'Check your mail'}
          </h1>
          <p>
            {step === 'email'
              ? 'Sign in to manage your store.'
              : `We sent a 6-digit code to ${email}. It expires in 10 minutes.`}
          </p>

          <form className="login-form" onSubmit={step === 'email' ? (event) => { event.preventDefault(); void sendOtp(email); } : verify}>
            {step === 'email' ? (
              <div className="field">
                <label className="label" htmlFor="email">Work email</label>
                <input
                  id="email"
                  className="input"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@neuracart.app"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError('');
                  }}
                  disabled={resending}
                  required
                />
              </div>
            ) : (
              <div className="field">
                <label className="label" htmlFor="otp">6-digit code</label>
                <input
                  id="otp"
                  className="otp-input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="••••••"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                    setError('');
                  }}
                  disabled={redirecting}
                  autoFocus
                  required
                />
              </div>
            )}

            {step === 'otp' ? (
              <button className="btn btn-primary" type="submit" disabled={code.length !== 6 || loading || redirecting}>
                {loading || redirecting ? <Spinner /> : <Icon name="lock" size={15} />}
                {redirecting ? 'Opening dashboard…' : 'Verify & sign in'}
              </button>
            ) : (
              <button className="btn btn-primary" type="submit" disabled={resending || !isValidEmail}>
                {resending ? <Spinner /> : <Icon name="mail" size={15} />}
                Continue with email
              </button>
            )}
          </form>

          {devOtp ? (
            <div className="dev-otp">
              <span>
                Development shortcut — OTP:{' '}
                <strong>{devOtp}</strong>
              </span>
              <button
                type="button"
                onClick={() => setCode(devOtp)}
              >
                Use code
              </button>
            </div>
          ) : null}

          {error ? (
            <p className="field-error" style={{ marginTop: 12 }} role="alert">{error}</p>
          ) : null}

          {step === 'otp' ? (
            <div className="login-links">
              <button
                className="text-button"
                onClick={() => void sendOtp(email)}
                disabled={cooldown > 0 || resending}
                type="button"
              >
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </button>
              <button className="text-button" onClick={changeEmail} type="button">
                Change email
              </button>
            </div>
          ) : null}

          <div className="login-security">
            <Icon name="shield" size={13} />
            Admin-only access · Codes expire · Sessions auto-refresh
          </div>
        </div>
      </div>
    </div>
  );
}
