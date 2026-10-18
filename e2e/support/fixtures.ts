import type { APIRequestContext } from '@playwright/test';

import { API_URL, SEED_USER, uniqueName } from './session';

/**
 * Data made straight through the API, for the specs that look at a screen with content in
 * it. An empty screen hides every layout defect, so the names here are as long as the ones a
 * real shop has, and the numbers are the kind that need a thousands separator.
 *
 * The flows themselves go through the screens (stock-flow.spec.ts); this is only the setup
 * of a spec whose subject is something else.
 */
export interface Fixtures {
  materialId: string;
  secondMaterialId: string;
  productId: string;
  saleId: string;
  purchaseId: string;
}

async function post<T>(
  request: APIRequestContext,
  token: string,
  path: string,
  data: unknown,
): Promise<T> {
  const response = await request.post(`${API_URL}${path}`, {
    data,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok()) {
    throw new Error(`POST ${path} answered ${response.status()}: ${await response.text()}`);
  }

  return (await response.json()) as T;
}

async function accessToken(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${API_URL}/auth/login`, {
    data: { email: SEED_USER.email, password: SEED_USER.password },
  });

  return ((await response.json()) as { accessToken: string }).accessToken;
}

export async function createFixtures(request: APIRequestContext): Promise<Fixtures> {
  const token = await accessToken(request);

  const material = await post<{ id: string }>(request, token, '/materials', {
    name: uniqueName('Farinha de trigo especial tipo 1 orgânica integral'),
    description: 'Moída na pedra, embalagem de cinco quilos',
    packageCost: '1284.70',
    packageQuantity: 5000,
    consumptionUnit: 'GRAM',
    stockQuantity: 0,
    minimumStockAlert: 1500,
  });
  const secondMaterial = await post<{ id: string }>(request, token, '/materials', {
    name: uniqueName('Essência de baunilha'),
    packageCost: '38.00',
    packageQuantity: 1000,
    consumptionUnit: 'MILLILITER',
    stockQuantity: 0,
    minimumStockAlert: 100,
  });

  await post(request, token, `/materials/${material.id}/stock-entries`, {
    source: 'MANUAL',
    relativeIncrement: 12000,
  });
  await post(request, token, `/materials/${secondMaterial.id}/stock-entries`, {
    source: 'MANUAL',
    relativeIncrement: 80,
  });
  await post(request, token, `/materials/${material.id}/losses`, {
    quantity: 250,
    reason: 'BREAKAGE',
    observation: 'Caiu da prateleira durante a limpeza',
  });

  const product = await post<{ id: string }>(request, token, '/composite-products', {
    name: uniqueName('Bolo de aniversário recheado com doce de leite e coco'),
    description: null,
    fixedOperationalCost: '2.50',
    profitMarginBasisPoints: 5000,
    manualPrice: null,
    billOfMaterials: [
      { materialId: material.id, quantity: 600 },
      { materialId: secondMaterial.id, quantity: 20 },
    ],
  });

  const sale = await post<{ id: string }>(request, token, '/sales', {
    customerName: 'Maria Aparecida dos Santos Albuquerque',
    customerContact: '51 99999-0000',
    paymentMethod: 'Pix',
    items: [{ compositeProductId: product.id, quantity: 3 }],
  });

  const purchase = await post<{ id: string }>(request, token, '/purchases', {
    purchaseDate: new Date().toISOString(),
    establishment: {
      name: 'SUPERMERCADO DO ZÉ COMÉRCIO DE ALIMENTOS LTDA',
      cnpj: '33.444.555/0001-66',
    },
    discountTotal: '20.00',
    discountAllocationMode: 'PROPORTIONAL',
    lines: [
      {
        description: 'Farinha de trigo especial tipo 1 orgânica integral 5kg',
        quantity: 2,
        unit: 'UN',
        unitPrice: '1300.00',
        grossValue: '2600.00',
        isCompanyExpense: true,
        materialId: material.id,
      },
      {
        description: 'Sacola plástica',
        quantity: 1,
        unit: 'UN',
        unitPrice: '10.00',
        grossValue: '10.00',
        isCompanyExpense: true,
      },
    ],
  });

  return {
    materialId: material.id,
    secondMaterialId: secondMaterial.id,
    productId: product.id,
    saleId: sale.id,
    purchaseId: purchase.id,
  };
}
