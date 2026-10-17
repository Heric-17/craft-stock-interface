import { request } from '@/shared/api/http-client';

import type { ShoppingListDto, ShoppingListRequestDto } from './shopping-list.dto';

/**
 * `POST /sales/shopping-list` is a **read** that happens to carry a body: it
 * works out what is missing and answers, and nothing is saved on the server.
 * That is why it is a query in the hook and not a mutation.
 */
export function fetchShoppingList(
  body: ShoppingListRequestDto,
  signal: AbortSignal,
): Promise<ShoppingListDto> {
  return request<ShoppingListDto>('/sales/shopping-list', { method: 'POST', body, signal });
}
