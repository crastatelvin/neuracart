import { apiRequest } from './api';
import type {
  Product,
  ProductCategory,
  RecsCard,
  RecsHome,
  ReorderEntry,
  RecipeSummary,
} from './types';

/** Adapt a recommendation card into the full Product shape the UI expects. */
export function cardToProduct(card: RecsCard): Product {
  return {
    id: card.id,
    name: card.name,
    description: null,
    category: card.category as ProductCategory,
    price: card.price,
    unit: card.unit,
    stock: card.stock,
    imageUrl: card.imageUrl,
    isActive: true,
    isFeatured: card.isFeatured,
    createdAt: '',
    updatedAt: '',
  };
}

export function fetchRecsHome(productIds: string[]): Promise<RecsHome> {
  return apiRequest<RecsHome>('/recs/home', {
    method: 'POST',
    body: { productIds },
  });
}

export function fetchReorder(): Promise<ReorderEntry[]> {
  return apiRequest<ReorderEntry[]>('/recs/reorder');
}

export function fetchRecipes(): Promise<RecipeSummary[]> {
  return apiRequest<RecipeSummary[]>('/recs/recipes');
}

export const URGENCY_LABEL: Record<ReorderEntry['urgency'], string> = {
  likely_out: 'May be out',
  running_low: 'Running low',
  due_soon: 'Due soon',
};

export const URGENCY_TONE: Record<ReorderEntry['urgency'], { bg: string; text: string }> = {
  likely_out: { bg: '#FEE2E2', text: '#B91C1C' },
  running_low: { bg: '#FEF3C7', text: '#B45309' },
  due_soon: { bg: '#DCFCE7', text: '#15803D' },
};
