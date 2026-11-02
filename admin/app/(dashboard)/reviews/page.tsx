'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/Icons';
import { useToast } from '@/components/Toast';
import {
  EmptyState,
  ErrorBanner,
  Modal,
  PageHeader,
  Pagination,
  SkeletonTable,
  Spinner,
} from '@/components/ui';
import { api, apiPage, queryString } from '@/lib/api';
import { relativeTime } from '@/lib/format';

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  response: string | null;
  isVerified: boolean;
  createdAt: string;
  product: { name: string };
  user: { name: string | null; email: string };
};

export default function ReviewsPage() {
  const toast = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyTarget, setReplyTarget] = useState<Review | null>(null);
  const [reply, setReply] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiPage<Review>(
        `/reviews/admin${queryString({ page, limit: 20 })}`,
      );
      setReviews(result.data);
      setTotal(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load reviews.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  function openReply(review: Review) {
    setReplyTarget(review);
    setReply(review.response ?? '');
  }

  async function submitReply() {
    if (!replyTarget) return;
    if (reply.trim().length < 3) {
      toast.error('Write at least a few words before saving.');
      return;
    }
    setSaving(true);
    try {
      await api(`/reviews/${replyTarget.id}/reply`, {
        method: 'PATCH',
        body: { response: reply.trim() },
      });
      toast.success('Reply published.');
      setReplyTarget(null);
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not save the reply.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <PageHeader
        title="Reviews"
        subtitle="Moderate product feedback and reply as the store"
        actions={
          <button className="btn btn-sm btn-secondary" onClick={() => void load()} disabled={loading} type="button">
            <Icon name="refresh" size={13} /> Refresh
          </button>
        }
      />

      {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}

      <div className="card table-card">
        {loading ? (
          <SkeletonTable rows={6} />
        ) : reviews.length === 0 ? (
          <EmptyState
            icon="star"
            title="No reviews yet"
            text="Customer ratings appear here after their orders are delivered."
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Customer</th>
                    <th>Rating</th>
                    <th>Comment</th>
                    <th>Store reply</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((review) => (
                    <tr key={review.id}>
                      <td className="cell-main">{review.product.name}</td>
                      <td>
                        <span className="cell-main">{review.user.name ?? 'Customer'}</span>
                        <div className="cell-sub">{review.user.email}</div>
                      </td>
                      <td>
                        <span style={{ whiteSpace: 'nowrap', color: '#B45309', fontWeight: 700 }}>
                          {'★'.repeat(review.rating)}
                          <span style={{ color: '#D1D5DB' }}>{'★'.repeat(5 - review.rating)}</span>
                        </span>
                        <div className="cell-sub">{relativeTime(review.createdAt)}</div>
                      </td>
                      <td style={{ maxWidth: 260 }}>
                        <span className="cell-sub" style={{ color: '#374151' }}>
                          {review.comment ?? '—'}
                        </span>
                      </td>
                      <td style={{ maxWidth: 220 }}>
                        <span className="cell-sub" style={{ color: '#374151' }}>
                          {review.response ?? 'Not replied'}
                        </span>
                      </td>
                      <td>
                        <div className="cell-actions">
                          <button className="btn btn-sm btn-secondary" onClick={() => openReply(review)} type="button">
                            <Icon name="edit" size={13} /> {review.response ? 'Edit reply' : 'Reply'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              limit={20}
              onPage={setPage}
            />
          </>
        )}
      </div>

      <Modal
        open={Boolean(replyTarget)}
        onClose={() => setReplyTarget(null)}
        title={replyTarget ? `Reply to ${replyTarget.user.name ?? 'customer'}` : 'Reply'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setReplyTarget(null)} type="button">
              Cancel
            </button>
            <button className="btn btn-primary" onClick={() => void submitReply()} disabled={saving} type="button">
              {saving ? <Spinner /> : <Icon name="save" size={13} />} Publish reply
            </button>
          </>
        }
      >
        {replyTarget ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <p className="cell-sub" style={{ margin: 0 }}>
              {replyTarget.product.name} · {replyTarget.rating}/5 — “{replyTarget.comment ?? 'No comment'}”
            </p>
            <textarea
              className="input"
              rows={4}
              maxLength={500}
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Thanks for the feedback…"
            />
          </div>
        ) : null}
      </Modal>
    </main>
  );
}
