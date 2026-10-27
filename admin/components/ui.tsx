'use client';

import { useEffect, type ReactNode } from 'react';
import {
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
} from '@/lib/format';
import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/lib/types';
import { Icon, type IconName } from './Icons';

export function Spinner({ size = 15 }: { size?: number }) {
  return (
    <span
      className="spinner"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="header-actions">{actions}</div> : null}
    </header>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`badge badge-${STATUS_TONE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const tone =
    status === 'paid'
      ? 'green'
      : status === 'failed'
        ? 'red'
        : status === 'refunded'
          ? 'purple'
          : 'amber';
  return (
    <span className={`badge badge-${tone}`}>
      {PAYMENT_STATUS_LABEL[status]}
    </span>
  );
}

export function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  return (
    <span className={`badge no-dot ${method === 'cod' ? 'badge-gray' : 'badge-blue'}`}>
      {PAYMENT_METHOD_LABEL[method]}
    </span>
  );
}

export function EmptyState({
  icon = 'package',
  title,
  text,
  action,
}: {
  icon?: IconName;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={22} />
      </span>
      <p className="empty-title">{title}</p>
      {text ? <p className="empty-text">{text}</p> : null}
      {action ? <div style={{ marginTop: 16 }}>{action}</div> : null}
    </div>
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="error-banner" role="alert">
      <Icon name="alert" size={16} />
      <span>{message}</span>
      {onRetry ? (
        <button className="btn btn-sm btn-secondary" onClick={onRetry} type="button">
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div style={{ padding: 16 }} aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton skeleton-row" key={index} />
      ))}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPage: (page: number) => void;
}) {
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  const pages: number[] = [];
  const first = Math.max(1, Math.min(page - 2, totalPages - 4));
  const last = Math.min(totalPages, Math.max(first + 4, 5));
  for (let index = first; index <= last; index += 1) pages.push(index);

  return (
    <div className="table-footer">
      <span>
        Showing {start}–{end} of {total}
      </span>
      <div className="pagination">
        <button
          className="page-btn"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
          type="button"
        >
          <Icon name="chevron-left" size={13} />
        </button>
        {pages.map((item) => (
          <button
            key={item}
            className={`page-btn ${item === page ? 'active' : ''}`}
            onClick={() => onPage(item)}
            aria-current={item === page ? 'page' : undefined}
            type="button"
          >
            {item}
          </button>
        ))}
        <button
          className="page-btn"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
          type="button"
        >
          <Icon name="chevron-right" size={13} />
        </button>
      </div>
    </div>
  );
}

export function Modal({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  wide = false,
}: {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <div style={{ flex: 1 }}>
            <h2 className="modal-title" id="modal-title">
              {title}
            </h2>
            {description ? <p className="modal-text">{description}</p> : null}
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
            type="button"
          >
            <Icon name="close" size={17} />
          </button>
        </div>
        {children ? <div className="modal-body">{children}</div> : null}
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'primary',
  loading = false,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: 'primary' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={loading ? () => undefined : onClose}
      footer={
        <>
          <button
            className="btn btn-secondary"
            onClick={onClose}
            disabled={loading}
            type="button"
          >
            Cancel
          </button>
          <button
            className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={loading}
            type="button"
          >
            {loading ? <Spinner /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <span className="field-error">{children}</span>;
}
