import { apiRequest } from './api';
import type { Product } from './types';

export type CartProposalItem = {
  productId: string;
  quantity: number;
};

export type ChatTurn = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  cartProposal: CartProposalItem[];
  createdAt: string;
};

export type ChatResponse = {
  sessionId: string;
  reply: string;
  cartItems: CartProposalItem[];
  model: string | null;
  usedFallback: boolean;
};

export type ChatSessionSummary = {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatTurn[];
};

export type SupportResponse = {
  reply: string;
  articleSlugs: string[];
  usedFallback: boolean;
};

export function postAiChat(message: string, sessionId?: string): Promise<ChatResponse> {
  return apiRequest<ChatResponse>('/ai/chat', {
    method: 'POST',
    body: { message, sessionId: sessionId || undefined },
  });
}

export function fetchAiChatSessions(): Promise<ChatSessionSummary[]> {
  return apiRequest<ChatSessionSummary[]>('/ai/chat/sessions');
}

export function aiSmartSearch(query: string, limit = 12): Promise<Product[]> {
  return apiRequest<{ results: Product[] }>('/ai/search', {
    method: 'POST',
    body: { query, limit },
  }).then((data) => data.results);
}

export function postAiSupport(message: string): Promise<SupportResponse> {
  return apiRequest<SupportResponse>('/ai/support', {
    method: 'POST',
    body: { message },
  });
}
