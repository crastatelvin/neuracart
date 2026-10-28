'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icons';
import { useToast } from '@/components/Toast';
import {
  ConfirmDialog,
  FieldError,
  PageHeader,
  Spinner,
} from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateIST } from '@/lib/format';
import type { Product } from '@/lib/types';

const MAX_IMAGE_MB = 5;
const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

type Category = 'fruits' | 'vegetables' | 'meat';

const CATEGORY_LABELS: Record<Category, string> = {
  fruits: 'Fruits',
  vegetables: 'Vegetables',
  meat: 'Meat',
};

export type ProductFormValues = {
  name: string;
  description: string;
  category: Category;
  price: string;
  unit: string;
  stock: string;
  isFeatured: boolean;
  isActive: boolean;
  image: File | null;
  removeImage: boolean;
};

export function validateProduct(values: ProductFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (values.name.trim().length < 2) errors.name = 'Name must be at least 2 characters.';
  if (!values.price || Number(values.price) <= 0) errors.price = 'Give a valid price above ₹0.';
  if (!values.unit.trim()) errors.unit = 'Give a price unit, e.g. 1 kg.';
  if (values.stock === '' || Number.isNaN(Number(values.stock)) || Number(values.stock) < 0) {
    errors.stock = 'Give a valid stock count.';
  }
  if (values.image && values.image.size > MAX_IMAGE_MB * 1024 * 1024) {
    errors.image = `The image must be under ${MAX_IMAGE_MB} MB.`;
  }
  if (values.image && !ACCEPTED_TYPES.includes(values.image.type)) {
    errors.image = 'Only JPG, PNG, or WebP images are supported.';
  }
  return errors;
}

export default function ProductForm({ mode }: { mode: 'create' | 'edit' }) {
  const router = useRouter();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(mode === 'edit');
  const [initial, setInitial] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [values, setValues] = useState<ProductFormValues>({
    name: '',
    description: '',
    category: 'vegetables',
    price: '',
    unit: '',
    stock: '0',
    isFeatured: false,
    isActive: true,
    image: null,
    removeImage: false,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (mode !== 'edit') return;
    const id = typeof window !== 'undefined' ? new URL(window.location.href).pathname.split('/').pop() : '';
    if (!id) return;
    setLoading(true);
    api<Product>(`/products/${id}`, { redirectOnUnauthorized: false })
      .then((product) => {
        setInitial(product);
        setPreview(product.imageUrl);
        setValues({
          name: product.name,
          description: product.description ?? '',
          category: product.category as Category,
          price: product.price,
          unit: product.unit,
          stock: String(product.stock),
          isFeatured: product.isFeatured,
          isActive: product.isActive,
          image: null,
          removeImage: false,
        });
      })
      .catch(() => {
        setNotFound(true);
        setError('We could not load this product.');
      })
      .finally(() => setLoading(false));
  }, [mode]);

  const update = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  };

  const pickImage = (file: File | null) => {
    if (!file) {
      setValues((current) => ({ ...current, image: null, removeImage: current.removeImage }));
      setPreview(initial?.imageUrl ?? null);
      setFileName('');
      return;
    }
    const failures = validateProduct({ ...values, image: file });
    if (failures.image) {
      setFieldErrors((current) => ({ ...current, image: failures.image! }));
      return;
    }
    setValues({ ...values, image: file, removeImage: false });
    setPreview(URL.createObjectURL(file));
    setFileName(file.name);
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read that file.'));
      reader.onload = () => {
        const result = String(reader.result ?? '');
        resolve(result.slice(result.indexOf(',') + 1));
      };
      reader.readAsDataURL(file);
    });

  /** Vision draft: photo → Gemini catalog card → prefill the form. */
  const draftFromPhoto = async (file: File | null) => {
    if (!file || drafting) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Only JPG, PNG, or WebP images are supported.');
      return;
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      toast.error(`The image must be under ${MAX_IMAGE_MB} MB.`);
      return;
    }
    setDrafting(true);
    try {
      const base64 = await fileToBase64(file);
      const draft = await api<{
        name: string;
        category: string;
        price: number;
        unit: string;
        description: string;
        tags?: string[];
      }>('/ai/admin/catalog-draft', {
        method: 'POST',
        body: { image: base64, mimeType: file.type },
        redirectOnUnauthorized: false,
      });
      const category = ['fruits', 'vegetables', 'meat'].includes(draft.category.toLowerCase())
        ? (draft.category.toLowerCase() as Category)
        : 'fruits';
      setValues((current) => ({
        ...current,
        name: draft.name || current.name,
        description: draft.description || current.description,
        category,
        price: draft.price ? String(Math.round(draft.price)) : current.price,
        unit: draft.unit || current.unit,
      }));
      toast.success(`AI drafted “${draft.name || 'product'}” — review and save.`);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'The AI draft failed.');
    } finally {
      setDrafting(false);
      if (draftInputRef.current) draftInputRef.current.value = '';
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const failures = validateProduct(values);
    if (Object.keys(failures).length > 0) {
      setFieldErrors(failures);
      toast.error('Fix the highlighted fields and try again.');
      return;
    }
    setSubmitting(true);
    setError('');
    const body = new FormData();
    body.append('name', values.name.trim());
    if (values.description.trim()) body.append('description', values.description.trim());
    else body.append('description', '');
    body.append('category', values.category);
    body.append('price', values.price);
    body.append('unit', values.unit.trim());
    body.append('stock', values.stock);
    body.append('isActive', values.isActive ? 'true' : 'false');
    body.append('isFeatured', values.isFeatured ? 'true' : 'false');
    if (values.image) body.append('image', values.image);
    if (mode === 'edit' && values.removeImage && !values.image) {
      body.append('removeImage', 'true');
    }
    try {
      const product =
        mode === 'create'
          ? await api<Product>('/products', { method: 'POST', body })
          : await api<Product>(`/products/${initial?.id}`, { method: 'PATCH', body });
      toast.success(mode === 'create' ? `${product.name} added.` : `${product.name} updated.`);
      router.push('/products');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the product.');
      toast.error(caught instanceof Error ? caught.message : 'Could not save the product.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!initial) return;
    setDeleting(true);
    try {
      const result = await api<{ softDeleted?: boolean }>(`/products/${initial.id}`, { method: 'DELETE' });
      toast[result.softDeleted ? 'info' : 'success'](
        result.softDeleted ? `${initial.name} hidden because it appears in past orders.` : `${initial.name} deleted.`,
      );
      setDeleteOpen(false);
      router.push('/products');
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not delete the product.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <main className="page">
        <div className="card">
          <div style={{ padding: 24 }}>
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
          </div>
        </div>
      </main>
    );
  }

  if (notFound || (mode === 'edit' && !initial)) {
    return (
      <main className="page">
        <div className="empty-state">
          <span className="empty-icon"><Icon name="products" size={22} /></span>
          <p className="empty-title">Product not found</p>
          <p className="empty-text">{error}</p>
          <Link className="btn btn-secondary" href="/products" style={{ marginTop: 16 }}>Back to products</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <Link
        href="/products"
        className="btn btn-ghost btn-sm"
        style={{ marginBottom: 14, width: 'fit-content' }}
      >
        <Icon name="chevron-left" size={13} /> Products
      </Link>

      <PageHeader
        title={mode === 'create' ? 'Add product' : 'Edit product'}
        subtitle={mode === 'create'
          ? 'Create a listing and publish it instantly in the customer app.'
          : initial ? `Last updated ${formatDateIST(initial.updatedAt)}` : ''}
        actions={
          mode === 'edit' && initial ? (
            <>
              <button
                className="btn btn-sm btn-danger-soft"
                onClick={() => setDeleteOpen(true)}
                type="button"
              >
                <Icon name="trash" size={13} /> Delete
              </button>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => router.push('/products')}
                type="button"
              >
                View in list
              </button>
            </>
          ) : null
        }
      />

      {error && !notFound ? (
        <div className="error-banner" role="alert">
          <Icon name="alert" size={15} /> <span>{error}</span>
        </div>
      ) : null}

      <form className="form-layout" onSubmit={submit}>
        <div className="form-card">
          <div className="form-section">
            <div className="form-section-header">
              <p className="form-section-title">Details</p>
              <p className="form-section-text">Name, description, and category.</p>
            </div>
            <div className="form-grid">
              <div className="field full">
                <label className="label" htmlFor="name">Name <span className="required">*</span></label>
                <input
                  className="input"
                  id="name"
                  value={values.name}
                  maxLength={100}
                  placeholder="Kashmir apple"
                  onChange={(event) => update('name', event.target.value)}
                />
                <FieldError>{fieldErrors.name}</FieldError>
              </div>
              <div className="field full">
                <label className="label" htmlFor="description">Description</label>
                <textarea
                  className="textarea"
                  id="description"
                  value={values.description}
                  maxLength={500}
                  placeholder="Sweet, crisp apples sourced directly from the orchard."
                  onChange={(event) => update('description', event.target.value)}
                />
                <span className="field-hint">{values.description.trim().length}/500</span>
              </div>
              <div className="field">
                <label className="label" htmlFor="category">Category <span className="required">*</span></label>
                <select
                  className="select"
                  id="category"
                  value={values.category}
                  onChange={(event) => update('category', event.target.value as Category)}
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="label" htmlFor="unit">Unit <span className="required">*</span></label>
                <input
                  className="input"
                  id="unit"
                  value={values.unit}
                  maxLength={30}
                  placeholder="1 kg"
                  onChange={(event) => update('unit', event.target.value)}
                />
                <FieldError>{fieldErrors.unit}</FieldError>
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-header">
              <p className="form-section-title">Price and stock</p>
              <p className="form-section-text">Prices are shown inclusive of GST.</p>
            </div>
            <div className="form-grid">
              <div className="field">
                <label className="label" htmlFor="price">Price <span className="required">*</span></label>
                <div className="input-group">
                  <span className="input-prefix">₹</span>
                  <input
                    className="input"
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={values.price}
                    onChange={(event) => update('price', event.target.value)}
                  />
                </div>
                <FieldError>{fieldErrors.price}</FieldError>
              </div>
              <div className="field">
                <label className="label" htmlFor="stock">Stock <span className="required">*</span></label>
                <input
                  className="input"
                  id="stock"
                  type="number"
                  min="0"
                  step="1"
                  value={values.stock}
                  onChange={(event) => update('stock', event.target.value)}
                />
                <FieldError>{fieldErrors.stock}</FieldError>
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-header">
              <p className="form-section-title">Placement</p>
              <p className="form-section-text">Lifecycle and placement in the app.</p>
            </div>
            <div className="checkbox-row">
              <input
                id="isActive"
                type="checkbox"
                checked={values.isActive}
                onChange={(event) => update('isActive', event.target.checked)}
              />
              <div className="checkbox-copy">
                <strong>Active</strong>
                <span>Inactive products stay in past orders but are hidden from browsing.</span>
              </div>
            </div>
            <div className="checkbox-row">
              <input
                id="isFeatured"
                type="checkbox"
                checked={values.isFeatured}
                onChange={(event) => update('isFeatured', event.target.checked)}
              />
              <div className="checkbox-copy">
                <strong>Featured on home</strong>
                <span>Featured products appear first in the customer app carousel.</span>
              </div>
            </div>
          </div>

          <div className="form-actions">
            {mode === 'edit' && initial ? (
              <span className="field-hint" style={{ marginRight: 'auto' }}>
                Last updated {formatDateIST(initial.updatedAt)}
              </span>
            ) : null}
            <Link href="/products" className="btn btn-secondary">Cancel</Link>
            <button className="btn btn-primary" disabled={submitting} type="submit">
              {submitting ? <Spinner /> : <Icon name="save" size={14} />}
              {mode === 'create' ? 'Create product' : 'Save changes'}
            </button>
          </div>
        </div>

        <aside className="form-aside">
          <div className="form-card">
            <div className="form-section">
              <div className="form-section-header">
                <p className="form-section-title">Image</p>
                <p className="form-section-text">Optional but recommended. JPG, PNG, or WebP · max {MAX_IMAGE_MB} MB · recommended 1200×1200.</p>
              </div>
              {preview && !values.removeImage ? (
                <div>
                  <img className="upload-preview" src={preview} alt="Product preview" />
                  {fileName ? <p className="upload-file">{fileName}</p> : null}
                  {!fileName ? (
                    <button
                      className="btn btn-sm btn-ghost"
                      style={{ width: '100%', justifyContent: 'center' }}
                      onClick={() => {
                        setValues((current) => ({ ...current, removeImage: true }));
                        setPreview(null);
                      }}
                      type="button"
                    >
                      <Icon name="close" size={13} /> Remove saved image
                    </button>
                  ) : null}
                </div>
              ) : (
                <label
                  className="upload-zone"
                  htmlFor="imageInput"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const file = event.dataTransfer.files?.[0];
                    if (file) pickImage(file);
                  }}
                >
                  <span className="upload-icon"><Icon name="upload" size={18} /></span>
                  <span className="upload-title">Choose an image</span>
                  <span className="upload-text">Drag and drop or click to upload</span>
                  <input
                    id="imageInput"
                    ref={fileInputRef}
                    className="visually-hidden-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    onChange={(event) => pickImage(event.target.files?.[0] ?? null)}
                  />
                </label>
              )}
              <FieldError>{fieldErrors.image}</FieldError>
              {mode === 'create' ? (
                <>
                  <input
                    ref={draftInputRef}
                    className="visually-hidden-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    onChange={(event) => void draftFromPhoto(event.target.files?.[0] ?? null)}
                  />
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
                    onClick={() => draftInputRef.current?.click()}
                    disabled={drafting}
                    type="button"
                  >
                    {drafting ? <Spinner /> : <Icon name="sparkles" size={13} />}
                    Draft with AI from a photo
                  </button>
                  <span className="field-hint">
                    Upload a product photo to prefill name, price, unit, and description.
                  </span>
                </>
              ) : null}
              {!preview ? null : (
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
                  onClick={() => setValues((current) => ({ ...current, image: null, removeImage: false }))}
                  type="button"
                >
                  Keep saved image
                </button>
              )}
            </div>
          </div>
          <div className="settings-note">
            <strong>Tips:</strong><br />
            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              <li>Use square images (1:1) for the best look.</li>
              <li>Set accurate stock — orders fail safely when it runs out.</li>
              <li>Feature up to a handful of items to keep the carousel fresh.</li>
            </ul>
          </div>
        </aside>
      </form>

      <ConfirmDialog
        open={deleteOpen}
        title={`Delete ${initial?.name ?? 'product'}?`}
        description="This product will be removed from the catalog. Past orders are unaffected. If the product appears in orders, it will be hidden instead."
        confirmLabel="Delete product"
        tone="danger"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleteOpen(false)}
      />
    </main>
  );
}
