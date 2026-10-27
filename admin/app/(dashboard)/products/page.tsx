'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/Icons';
import { useToast } from '@/components/Toast';
import {
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Pagination,
  SkeletonTable,
  Spinner,
} from '@/components/ui';
import { api, apiPage, queryString } from '@/lib/api';
import { formatINR, relativeTime, titleCase } from '@/lib/format';
import type { Product } from '@/lib/types';

type StatusFilter = 'active' | 'inactive' | 'all';
type Sort = 'newest' | 'price_asc' | 'price_desc' | 'low_stock';

const SORT_LABELS: { value: Sort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price · low to high' },
  { value: 'price_desc', label: 'Price · high to low' },
  { value: 'low_stock', label: 'Low stock first' },
];

export default function ProductsPage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState<'all' | 'fruits' | 'vegetables' | 'meat'>('all');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [featured, setFeatured] = useState<'all' | 'featured'>('all');
  const [lowStock, setLowStock] = useState(false);
  const [sort, setSort] = useState<Sort>('newest');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [featureBusy, setFeatureBusy] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const currentParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;

  useEffect(() => {
    const params = currentParams;
    if (!params) return;
    const statusParam = params.get('status');
    if (statusParam === 'inactive' || statusParam === 'all') setStatus(statusParam);
    const featuredParam = params.get('featured');
    if (featuredParam === 'true') setFeatured('featured');
  }, [currentParams]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError('');
      try {
        const result = await apiPage<Product>(
          `/products${queryString({
            page,
            limit,
            search: debouncedSearch || undefined,
            category: category === 'all' ? undefined : category,
            status,
            featured: featured === 'featured' ? true : undefined,
            lowStock: lowStock || undefined,
            sort: sort === 'low_stock' ? undefined : sort,
          })}`,
        );
        setTotal(result.pagination.total);
        setTotalPages(result.pagination.totalPages);
        if (sort === 'low_stock') {
          setProducts(result.data.slice().sort((a, b) => a.stock - b.stock));
        } else {
          setProducts(result.data);
        }
      } catch (caught) {
        setProducts([]);
        setError(caught instanceof Error ? caught.message : 'Could not load products.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, limit, debouncedSearch, category, status, featured, lowStock, sort],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, category, status, featured, lowStock, sort]);

  const toggleActive = async (product: Product) => {
    setTogglingId(product.id);
    try {
      await api<Product>(`/products/${product.id}/toggle`, { method: 'PATCH' });
      void load({ silent: true });
      toast.success(
        product.isActive
          ? `${product.name} hidden from the store.`
          : `${product.name} is live again.`,
      );
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not update the product.');
    } finally {
      setTogglingId(null);
    }
  };

  const toggleFeatured = async (product: Product) => {
    setFeatureBusy(product.id);
    try {
      await api<Product>(`/products/${product.id}`, {
        method: 'PATCH',
        body: { isFeatured: !product.isFeatured },
      });
      void load({ silent: true });
      toast.info(product.isFeatured ? `${product.name} removed from featured.` : `${product.name} added to featured.`);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not update the product.');
    } finally {
      setFeatureBusy(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const result = await api<{ product?: Product; softDeleted?: boolean }>(`/products/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      void load({ silent: true });
      if (result.softDeleted) {
        toast.info(`${deleteTarget.name} is was hidden because it appears in past orders.`);
      } else {
        toast.success(`${deleteTarget.name} deleted.`);
      }
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not delete the product.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const activeFilters = status !== 'active' || category !== 'all' || featured !== 'all' || lowStock || !!debouncedSearch;

  return (
    <main className="page">
      <PageHeader
        title="Products"
        subtitle="Catalog, stock, featured placement, and pricing"
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
            <Link href="/products/new" className="btn btn-sm btn-primary">
              <Icon name="plus" size={13} /> Add product
            </Link>
          </>
        }
      />

      {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}

      <div className="card table-card">
        <div className="toolbar">
          <div className="search-box">
            <Icon name="search" size={14} />
            <input
              placeholder="Search products"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search products"
              type="search"
            />
          </div>
          <select className="select-sm" value={category} onChange={(event) => setCategory(event.target.value as typeof category)} aria-label="Category">
            <option value="all">All categories</option>
            <option value="fruits">Fruits</option>
            <option value="vegetables">Vegetables</option>
            <option value="meat">Meat</option>
          </select>
          <select className="select-sm" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} aria-label="Status">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>
          <select className="select-sm" value={featured} onChange={(event) => setFeatured(event.target.value as typeof featured)} aria-label="Featured">
            <option value="all">All products</option>
            <option value="featured">Featured only</option>
          </select>
          <select className="select-sm" value={sort} onChange={(event) => setSort(event.target.value as Sort)} aria-label="Sort">
            {SORT_LABELS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button
            className={`btn btn-sm ${lowStock ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setLowStock((value) => !value)}
            type="button"
          >
            <Icon name="alert" size={12} /> Low stock
          </button>
          <span className="filter-spacer" />
          {activeFilters ? (
            <button className="btn btn-sm btn-ghost" onClick={() => { setCategory('all'); setStatus('active'); setFeatured('all'); setLowStock(false); setSearch(''); }} type="button">
              <Icon name="close" size={12} /> Clear
            </button>
          ) : null}
        </div>

        {loading ? (
          <SkeletonTable rows={7} />
        ) : products.length === 0 ? (
          <EmptyState
            icon="products"
            title={activeFilters ? 'No products match this filter' : 'No products yet'}
            text={activeFilters ? 'Change the category, status, or clear the search.' : 'Add the first product and it will appear immediately in the customer app.'}
            action={
              <Link href="/products/new" className="btn btn-primary">
                <Icon name="plus" size={14} /> Add product
              </Link>
            }
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th className="num">Price</th>
                    <th className="num">Stock</th>
                    <th>Featured</th>
                    <th>Active</th>
                    <th>Updated</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <div className="product-cell">
                          {product.imageUrl ? (
                            <img className="thumb" src={product.imageUrl} alt={product.name} />
                          ) : (
                            <span className="thumb-placeholder">
                              <Icon name="image" size={15} />
                            </span>
                          )}
                          <span>
                            <span className="cell-main">{product.name}</span>
                            <span className="cell-sub">{product.unit}</span>
                          </span>
                        </div>
                      </td>
                      <td>{titleCase(product.category)}</td>
                      <td className="num" style={{ fontWeight: 700 }}>{formatINR(product.price)}</td>
                      <td className="num">
                        <span className={product.stock <= 5 ? 'stock-chip' : ''}>
                          {product.stock}
                          {product.stock <= 5 ? ' left' : ''}
                        </span>
                      </td>
                      <td>
                        <button
                          className={`icon-button ${product.isFeatured ? 'featured-on' : ''}`}
                          onClick={() => void toggleFeatured(product)}
                          disabled={featureBusy === product.id}
                          aria-label={product.isFeatured ? 'Remove from featured' : 'Add to featured'}
                          style={{ color: product.isFeatured ? 'var(--amber-600)' : 'var(--muted-2)' }}
                          type="button"
                        >
                          {featureBusy === product.id ? <Spinner size={12} /> : <Icon name="star" size={15} />}
                        </button>
                      </td>
                      <td>
                        <button
                          className={`switch ${product.isActive ? 'on' : ''}`}
                          onClick={() => void toggleActive(product)}
                          disabled={togglingId === product.id}
                          role="switch"
                          aria-checked={product.isActive}
                          aria-label={`Toggle ${product.name}`}
                          type="button"
                        />
                      </td>
                      <td className="cell-sub">{relativeTime(product.updatedAt)}</td>
                      <td>
                        <div className="cell-actions">
                          <Link href={`/products/${product.id}`} className="icon-button" aria-label={`Edit ${product.name}`}>
                            <Icon name="edit" size={15} />
                          </Link>
                          <button
                            className="icon-button"
                            onClick={() => setDeleteTarget(product)}
                            aria-label={`Delete ${product.name}`}
                            type="button"
                          >
                            <Icon name="trash" size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} limit={limit} onPage={setPage} />
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.name ?? ''}?`}
        description={
          deleteTarget?.isFeatured || deleteTarget?.isActive
            ? 'This product will be removed from the catalog. Past orders are unaffected.'
            : 'This product will be removed from the catalog.'
        }
        confirmLabel="Delete product"
        tone="danger"
        loading={deleteLoading}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleteTarget(null)}
      />
    </main>
  );
}
