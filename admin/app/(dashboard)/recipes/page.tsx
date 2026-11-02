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
import { formatINR } from '@/lib/format';
import type { Product } from '@/lib/types';

type RecipeItem = {
  id?: string;
  productId: string;
  quantity: number;
  product?: { id: string; name: string; unit: string; price: string } | null;
};

type Recipe = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  servings: number;
  imageUrl: string | null;
  steps: string[];
  isPublished: boolean;
  items: RecipeItem[];
};

type FormValues = {
  slug: string;
  title: string;
  description: string;
  servings: string;
  imageUrl: string;
  steps: string;
  isPublished: boolean;
  items: { productId: string; quantity: string }[];
};

const EMPTY: FormValues = {
  slug: '',
  title: '',
  description: '',
  servings: '2',
  imageUrl: '',
  steps: '',
  isPublished: true,
  items: [],
};

function toForm(recipe: Recipe): FormValues {
  return {
    slug: recipe.slug,
    title: recipe.title,
    description: recipe.description ?? '',
    servings: String(recipe.servings),
    imageUrl: recipe.imageUrl ?? '',
    steps: recipe.steps.join('\n'),
    isPublished: recipe.isPublished,
    items: recipe.items.map((item) => ({
      productId: item.productId,
      quantity: String(item.quantity),
    })),
  };
}

export default function RecipesPage() {
  const toast = useToast();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [fieldError, setFieldError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Recipe | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [recipeList, productList] = await Promise.all([
        api<Recipe[]>('/recs/admin/recipes'),
        apiPage<Product>('/products?limit=100&status=active'),
      ]);
      setRecipes(recipeList);
      setProducts(productList.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load recipes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setValues({ ...EMPTY, items: products[0] ? [{ productId: products[0].id, quantity: '1' }] : [] });
    setFieldError('');
    setFormOpen(true);
  }

  function openEdit(recipe: Recipe) {
    setEditing(recipe);
    setValues(toForm(recipe));
    setFieldError('');
    setFormOpen(true);
  }

  const update = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  function setItem(index: number, patch: Partial<FormValues['items'][number]>) {
    setValues((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  async function save() {
    if (values.title.trim().length < 3) return setFieldError('Give the recipe a title.');
    if (!/^[a-z0-9-]{3,60}$/.test(values.slug.trim())) {
      return setFieldError('Slug must be 3–60 lowercase letters, numbers or dashes.');
    }
    if (values.items.length === 0) return setFieldError('Add at least one product.');
    if (values.items.some((item) => !item.productId)) {
      return setFieldError('Every ingredient needs a product.');
    }

    setSaving(true);
    setFieldError('');
    const body = {
      slug: values.slug.trim(),
      title: values.title.trim(),
      description: values.description.trim() || undefined,
      servings: Number(values.servings) || 2,
      imageUrl: values.imageUrl.trim() || undefined,
      steps: values.steps
        .split('\n')
        .map((step) => step.trim())
        .filter(Boolean),
      isPublished: values.isPublished,
      items: values.items.map((item) => ({
        productId: item.productId,
        quantity: Math.max(1, Number(item.quantity) || 1),
      })),
    };
    try {
      if (editing) {
        await api(`/recs/admin/recipes/${editing.id}`, { method: 'PATCH', body });
        toast.success('Recipe updated.');
      } else {
        await api('/recs/admin/recipes', { method: 'POST', body });
        toast.success('Recipe created.');
      }
      setFormOpen(false);
      await load();
    } catch (caught) {
      setFieldError(caught instanceof Error ? caught.message : 'Could not save the recipe.');
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(recipe: Recipe) {
    setBusyId(recipe.id);
    try {
      await api(`/recs/admin/recipes/${recipe.id}`, {
        method: 'PATCH',
        body: { isPublished: !recipe.isPublished },
      });
      toast.success(recipe.isPublished ? 'Recipe hidden from customers.' : 'Recipe published.');
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not update the recipe.');
    } finally {
      setBusyId(null);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await api(`/recs/admin/recipes/${deleteTarget.id}`, { method: 'DELETE' });
      toast.success('Recipe deleted.');
      setDeleteTarget(null);
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not delete the recipe.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="page">
      <PageHeader
        title="Recipes"
        subtitle="Bundles that let customers add a whole meal to their cart"
        actions={
          <>
            <button className="btn btn-sm btn-secondary" onClick={() => void load()} disabled={loading} type="button">
              <Icon name="refresh" size={13} /> Refresh
            </button>
            <button className="btn btn-sm btn-primary" onClick={openCreate} disabled={products.length === 0} type="button">
              <Icon name="plus" size={13} /> New recipe
            </button>
          </>
        }
      />

      {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}

      <div className="card table-card">
        {loading ? (
          <SkeletonTable rows={5} />
        ) : recipes.length === 0 ? (
          <EmptyState
            icon="package"
            title="No recipes yet"
            text="Create a recipe to surface a ready-to-cook basket on the customer home screen."
            action={
              <button className="btn btn-primary" onClick={openCreate} disabled={products.length === 0} type="button">
                <Icon name="plus" size={14} /> New recipe
              </button>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Recipe</th>
                  <th className="num">Servings</th>
                  <th className="num">Ingredients</th>
                  <th className="num">Basket value</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recipes.map((recipe) => {
                  const total = recipe.items.reduce(
                    (sum, item) => sum + Number(item.product?.price ?? 0) * item.quantity,
                    0,
                  );
                  return (
                    <tr key={recipe.id}>
                      <td>
                        <span className="cell-main">{recipe.title}</span>
                        <div className="cell-sub">/{recipe.slug}</div>
                      </td>
                      <td className="num">{recipe.servings}</td>
                      <td className="num">{recipe.items.length}</td>
                      <td className="num">{formatINR(total)}</td>
                      <td>
                        <span className={`badge no-dot ${recipe.isPublished ? 'badge-green' : 'badge-gray'}`}>
                          {recipe.isPublished ? 'Published' : 'Hidden'}
                        </span>
                      </td>
                      <td>
                        <div className="cell-actions">
                          <button className="btn btn-sm btn-secondary" onClick={() => openEdit(recipe)} type="button">
                            <Icon name="edit" size={13} /> Edit
                          </button>
                          <button
                            className="btn btn-sm btn-ghost"
                            disabled={busyId === recipe.id}
                            onClick={() => void togglePublished(recipe)}
                            type="button"
                          >
                            {busyId === recipe.id ? <Spinner size={11} /> : <Icon name={recipe.isPublished ? 'x' : 'check'} size={12} />}
                            {recipe.isPublished ? 'Hide' : 'Publish'}
                          </button>
                          <button
                            className="btn btn-sm btn-danger-soft"
                            disabled={busyId === recipe.id}
                            onClick={() => setDeleteTarget(recipe)}
                            type="button"
                          >
                            <Icon name="trash" size={12} />
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
        title={editing ? `Edit ${editing.title}` : 'New recipe'}
        wide
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setFormOpen(false)} type="button">
              Cancel
            </button>
            <button className="btn btn-primary" onClick={() => void save()} disabled={saving} type="button">
              {saving ? <Spinner /> : <Icon name="save" size={13} />} Save recipe
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="field">
            <label className="label">Title</label>
            <input
              className="input"
              value={values.title}
              onChange={(event) => {
                update('title', event.target.value);
                if (!editing) {
                  update(
                    'slug',
                    event.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-|-$/g, '')
                      .slice(0, 60),
                  );
                }
              }}
            />
          </div>
          <div className="field">
            <label className="label">Slug</label>
            <input className="input" value={values.slug} onChange={(event) => update('slug', event.target.value.toLowerCase())} />
          </div>
          <div className="field">
            <label className="label">Servings</label>
            <input className="input" type="number" min={1} max={12} value={values.servings} onChange={(event) => update('servings', event.target.value)} />
          </div>
          <div className="field">
            <label className="label">Image URL (optional)</label>
            <input className="input" value={values.imageUrl} onChange={(event) => update('imageUrl', event.target.value)} />
          </div>
          <div className="field full">
            <label className="label">Description</label>
            <input className="input" maxLength={500} value={values.description} onChange={(event) => update('description', event.target.value)} />
          </div>
          <div className="field full">
            <label className="label">Steps (one per line)</label>
            <textarea
              className="textarea"
              rows={3}
              value={values.steps}
              onChange={(event) => update('steps', event.target.value)}
            />
          </div>

          <div className="field full">
            <label className="label">Ingredients</label>
            <div style={{ display: 'grid', gap: 8 }}>
              {values.items.map((item, index) => (
                <div key={`${item.productId}-${index}`} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    className="input"
                    value={item.productId}
                    onChange={(event) => setItem(index, { productId: event.target.value })}
                    aria-label={`Ingredient ${index + 1}`}
                  >
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} · {formatINR(Number(product.price))}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    style={{ maxWidth: 90 }}
                    type="number"
                    min={1}
                    max={50}
                    value={item.quantity}
                    onChange={(event) => setItem(index, { quantity: event.target.value })}
                    aria-label={`Quantity ${index + 1}`}
                  />
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() =>
                      update('items', values.items.filter((_, itemIndex) => itemIndex !== index))
                    }
                    type="button"
                    aria-label="Remove ingredient"
                  >
                    <Icon name="trash" size={12} />
                  </button>
                </div>
              ))}
              <button
                className="btn btn-sm btn-secondary"
                style={{ width: 'fit-content' }}
                onClick={() =>
                  products[0] &&
                  update('items', [...values.items, { productId: products[0].id, quantity: '1' }])
                }
                type="button"
              >
                <Icon name="plus" size={12} /> Add ingredient
              </button>
            </div>
          </div>

          <div className="field full">
            <label className="checkbox-row" style={{ display: 'flex', gap: 8 }}>
              <input
                type="checkbox"
                checked={values.isPublished}
                onChange={(event) => update('isPublished', event.target.checked)}
              />
              <span>Publish to customers</span>
            </label>
          </div>

          <FieldError>{fieldError}</FieldError>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete recipe?"
        description={deleteTarget ? `${deleteTarget.title} will disappear from the customer app.` : ''}
        confirmLabel="Delete"
        tone="danger"
        loading={busyId === deleteTarget?.id}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void remove()}
      />
    </main>
  );
}
