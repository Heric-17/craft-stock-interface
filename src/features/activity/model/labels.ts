import { DISCOUNT_MODE_LABELS } from '@/features/invoices';
import { CONSUMPTION_UNIT_LABELS } from '@/features/materials';
import { PAYMENT_STATUS_LABELS, PRODUCTION_STATUS_LABELS } from '@/features/sales';

/**
 * How the value of a field is read and written. The kind decides the
 * formatting — money as money, a quantity with its unit, an enum by its label —
 * so the sentence never prints a value the way the database stored it.
 */
export type FieldKind =
  | { type: 'text' }
  | { type: 'money' }
  | { type: 'quantity' }
  /** A percentage as the database keeps it: `"33.33"` is 33,33%. */
  | { type: 'percent' }
  /** A margin as the API carries it in a request: `3333` is 33,33%. */
  | { type: 'basisPoints' }
  | { type: 'enum'; labels: Readonly<Record<string, string>> }
  | { type: 'date' }
  /** A photo. The value is a storage key and is never shown: only that the photo changed. */
  | { type: 'image' }
  /** A yes/no that is better said as a sentence of its own than as "de não para sim". */
  | {
      type: 'flag';
      whenTrue: string;
      whenFalse: string;
      /** The whole predicate for a lone change, given where it happened ("da compra em X"). */
      sentence: (isTrue: boolean, of: string) => string;
    }
  /** `discontinuedAt`: a date when discontinued, nothing when active. */
  | { type: 'discontinuation' };

export interface FieldDef {
  /** The name of the field as a person says it, lower case: "custo da embalagem". */
  label: string;
  /** The article that goes with it, for "o custo" / "a margem". */
  article: 'o' | 'a';
  kind: FieldKind;
}

const IMAGE: FieldDef = { label: 'foto', article: 'a', kind: { type: 'image' } };

const DISCONTINUATION: FieldDef = {
  label: 'situação',
  article: 'a',
  kind: { type: 'discontinuation' },
};

/**
 * The fields of each model worth telling a person about, by the name of the
 * column the audit trail records. Anything not listed — ids, timestamps, the
 * raw invoice, keys — is left out of the sentence, so an unknown column can
 * never reach the screen under its own name.
 *
 * The image appears under two names: `imageUrl` in rows written before the
 * rename in the backend and `imageKey` in the ones after. The trail is
 * append-only and was not rewritten, so both are read, as the same field, until
 * the 180-day retention retires the old rows.
 *
 * The margin has two spellings for the same reason a request and a column
 * differ: the trail records the column, a percentage with two places
 * (`profitMargin`), and the API's own field is in basis points.
 */
export const FIELDS: Readonly<Record<string, Readonly<Record<string, FieldDef>>>> = {
  Material: {
    name: { label: 'nome', article: 'o', kind: { type: 'text' } },
    description: { label: 'descrição', article: 'a', kind: { type: 'text' } },
    imageKey: IMAGE,
    imageUrl: IMAGE,
    packageCost: { label: 'custo da embalagem', article: 'o', kind: { type: 'money' } },
    packageQuantity: { label: 'quantidade da embalagem', article: 'a', kind: { type: 'quantity' } },
    consumptionUnit: {
      label: 'unidade de consumo',
      article: 'a',
      kind: { type: 'enum', labels: CONSUMPTION_UNIT_LABELS },
    },
    stockQuantity: { label: 'estoque', article: 'o', kind: { type: 'quantity' } },
    minimumStockAlert: { label: 'estoque mínimo', article: 'o', kind: { type: 'quantity' } },
    discontinuedAt: DISCONTINUATION,
  },
  CompositeProduct: {
    name: { label: 'nome', article: 'o', kind: { type: 'text' } },
    description: { label: 'descrição', article: 'a', kind: { type: 'text' } },
    imageKey: IMAGE,
    imageUrl: IMAGE,
    fixedOperationalCost: { label: 'custo fixo', article: 'o', kind: { type: 'money' } },
    profitMargin: { label: 'margem de lucro', article: 'a', kind: { type: 'percent' } },
    profitMarginBasisPoints: {
      label: 'margem de lucro',
      article: 'a',
      kind: { type: 'basisPoints' },
    },
    manualPrice: { label: 'preço manual', article: 'o', kind: { type: 'money' } },
    discontinuedAt: DISCONTINUATION,
  },
  Sale: {
    customerName: { label: 'nome do cliente', article: 'o', kind: { type: 'text' } },
    customerContact: { label: 'contato do cliente', article: 'o', kind: { type: 'text' } },
    paymentMethod: { label: 'forma de pagamento', article: 'a', kind: { type: 'text' } },
    paymentStatus: {
      label: 'pagamento',
      article: 'o',
      kind: { type: 'enum', labels: PAYMENT_STATUS_LABELS },
    },
    productionStatus: {
      label: 'produção',
      article: 'a',
      kind: { type: 'enum', labels: PRODUCTION_STATUS_LABELS },
    },
  },
  Purchase: {
    purchaseDate: { label: 'data', article: 'a', kind: { type: 'date' } },
    merchantName: { label: 'estabelecimento', article: 'o', kind: { type: 'text' } },
    merchantCnpj: { label: 'CNPJ do estabelecimento', article: 'o', kind: { type: 'text' } },
    grossTotal: { label: 'valor dos itens', article: 'o', kind: { type: 'money' } },
    discountTotal: { label: 'desconto da nota', article: 'o', kind: { type: 'money' } },
    netTotal: { label: 'valor pago', article: 'o', kind: { type: 'money' } },
    discountAllocationMode: {
      label: 'forma de atribuir o desconto',
      article: 'a',
      kind: { type: 'enum', labels: DISCOUNT_MODE_LABELS },
    },
    allocationPending: {
      label: 'situação do desconto',
      article: 'a',
      kind: {
        type: 'flag',
        whenTrue: 'a distribuir',
        whenFalse: 'distribuído',
        sentence: (isTrue, of) =>
          isTrue
            ? `deixou o desconto ${of} para distribuir entre os itens`
            : `distribuiu o desconto ${of} entre os itens`,
      },
    },
  },
};

/**
 * How each model is named in a sentence. `named` is the thing with its name
 * ("o insumo Café"), `unnamed` is what is said when the trail has no name for
 * it, and `of` is the same thing after "de" ("de Café", "do produto Bolo").
 *
 * A material is the one that goes without its noun after "de": "o custo da
 * embalagem de Café 3 Corações" is already about a material.
 */
export interface EntityText {
  named: (label: string) => string;
  unnamed: string;
  of: (label: string | null) => string;
  /** What registering one is called: a material is "cadastrado", a sale "registrada". */
  created: string;
  /** Word for taking it off the active list, and bringing it back. Only where it applies. */
  discontinued?: string;
  reactivated?: string;
}

export const ENTITIES: Readonly<Record<string, EntityText>> = {
  Material: {
    named: (label) => `o insumo ${label}`,
    unnamed: 'um insumo',
    of: (label) => (label === null ? 'de um insumo' : `de ${label}`),
    created: 'cadastrou',
    discontinued: 'descontinuou',
    reactivated: 'reativou',
  },
  CompositeProduct: {
    named: (label) => `o produto ${label}`,
    unnamed: 'um produto',
    of: (label) => (label === null ? 'de um produto' : `do produto ${label}`),
    created: 'cadastrou',
    discontinued: 'descontinuou',
    reactivated: 'reativou',
  },
  Sale: {
    named: (label) => `a venda de ${label}`,
    unnamed: 'uma venda',
    of: (label) => (label === null ? 'de uma venda' : `da venda de ${label}`),
    created: 'registrou',
  },
  Purchase: {
    named: (label) => `a compra em ${label}`,
    unnamed: 'uma compra',
    of: (label) => (label === null ? 'de uma compra' : `da compra em ${label}`),
    created: 'registrou',
  },
};

/** Who did it. Only the person looking at the screen is known by name: there is no list of users. */
export const SUBJECTS = {
  viewer: 'Você',
  someoneElse: 'Outra pessoa',
  system: 'O sistema',
} as const;

/** What is said of a purchase when its lines or the way its discount is spread were edited. */
export const PURCHASE_INTENT_VERBS = {
  purchase_item_edit: 'editou os itens',
  discount_allocation_change: 'mudou a atribuição do desconto',
} as const;

export const LOSS_TEXT = {
  recorded: 'registrou uma perda',
  deleted: 'excluiu a perda',
  noQuantityOrMaterial: 'estoque',
  stockUntouched: 'O estoque não foi alterado por esta exclusão.',
  observation: 'Observação',
  fallback: 'alterou uma perda de estoque',
} as const;

/** The sentence for a model or an operation this build has never heard of. */
export const GENERIC_TEXT = {
  record: 'um registro',
  created: 'adicionou',
  updated: 'alterou',
  deleted: 'excluiu',
  other: 'fez uma alteração em',
} as const;

/** How the value of a field is written when there is none. */
export const EMPTY_VALUE = 'sem valor';

export const DISCONTINUATION_VALUES = {
  active: 'ativo',
  discontinued: 'descontinuado',
} as const;

/** The longest text value printed in a sentence before it is cut with an ellipsis. */
export const MAX_TEXT_LENGTH = 60;
