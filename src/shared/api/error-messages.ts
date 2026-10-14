import { formatMoney } from '@/shared/format';
import { Money, parseDecimalString } from '@/shared/money';

import type { ApiError } from './api-error';
import type { DiscountAllocationReason } from './error-codes';

/**
 * One message per error the API can answer with, in Portuguese, written for
 * whoever is producing — not for whoever wrote the API.
 *
 * **Keyed by `code`**, the stable identifier, never by the English `message`
 * and never by the `error` class name. A 422 is not one thing: refusing to
 * delete something in use and refusing to change a consumption unit are
 * different problems with different ways out, and the screen says which.
 *
 * A code that is not here falls back by status band, so an error the API grows
 * tomorrow does not break a screen today.
 */
export const ERROR_MESSAGES: Record<string, string> = {
  // Sessão
  INVALID_CREDENTIALS: 'E-mail ou senha incorretos.',
  INVALID_REFRESH_TOKEN: 'Sua sessão expirou. Entre novamente.',
  INVALID_TOKEN: 'Sua sessão expirou. Entre novamente.',
  UNAUTHORIZED: 'Sua sessão expirou. Entre novamente.',

  // Usuários
  EMAIL_ALREADY_IN_USE: 'Já existe uma conta com esse e-mail.',
  USER_NOT_FOUND: 'Usuário não encontrado.',
  INVALID_USER: 'Os dados do usuário não são válidos.',

  // Ciclo de vida
  // A frase genérica. Com `details`, a tela diz quantas referências existem e
  // de que tipo, por `entityInUseSummary`.
  ENTITY_IN_USE:
    'Este item está sendo usado em outros registros e não pode ser excluído. Descontinue em vez de excluir.',

  // Insumos
  MATERIAL_NOT_FOUND: 'Insumo não encontrado.',
  INVALID_MATERIAL: 'Os dados do insumo não são válidos.',
  INVALID_STOCK_ENTRY: 'A entrada de estoque não é válida.',
  CONSUMPTION_UNIT_LOCKED:
    'A unidade de consumo não pode mudar enquanto houver estoque ou uso em ficha técnica.',

  // Produtos e fichas técnicas
  COMPOSITE_PRODUCT_NOT_FOUND: 'Produto não encontrado.',
  INVALID_COMPOSITE_PRODUCT: 'Os dados do produto não são válidos.',
  UNKNOWN_MATERIAL_REFERENCE: 'A ficha técnica aponta para um insumo que não existe.',
  UNKNOWN_COMPOSITE_PRODUCT_REFERENCE: 'A venda aponta para um produto que não existe.',
  INACTIVE_MATERIAL_REFERENCE:
    'Um insumo desta ficha foi descontinuado. Remova esse item da ficha ou reative o insumo para salvar mudanças nos itens.',

  // Vendas
  SALE_NOT_FOUND: 'Venda não encontrada.',
  SALE_ITEM_NOT_FOUND: 'Item da venda não encontrado.',
  INVALID_SALE: 'Os dados da venda não são válidos.',
  EMPTY_SALE: 'Uma venda precisa de pelo menos um item.',
  SALE_NOT_EDITABLE: 'Esta venda não pode mais ser alterada no estado em que está.',
  DISCONTINUED_COMPOSITE_PRODUCT_REFERENCE:
    'Este produto está descontinuado e não pode entrar em uma venda nova.',
  DISCONTINUED_MATERIAL_REFERENCE:
    'Este insumo está descontinuado e não pode entrar em uma venda nova.',
  MISSING_LOOSE_MATERIAL_MARGIN:
    'Informe a margem para vender este insumo avulso. Zero vende a preço de custo.',
  UNEXPECTED_MARGIN: 'A margem não se aplica a um produto: ele já tem a margem da ficha.',

  // Compras e desconto
  PURCHASE_NOT_FOUND: 'Compra não encontrada.',
  INVALID_PURCHASE: 'Os dados da compra não são válidos.',
  // A frase por `reason` está em DISCOUNT_ALLOCATION_MESSAGES; esta é o fallback
  // para um motivo que a API ganhe depois.
  DISCOUNT_ALLOCATION: 'A distribuição do desconto não pôde ser aplicada.',
  DISCOUNT_ALLOCATION_DESYNC:
    'A distribuição do desconto ficou desatualizada depois de uma alteração. Refaça a distribuição.',
  PENDING_DISCOUNT_ALLOCATION:
    'Distribua todo o desconto entre as linhas antes de concluir esta compra.',

  // Notas
  DUPLICATE_INVOICE: 'Esta nota já foi importada.',
  INVOICE_SOURCE_UNAVAILABLE:
    'O portal da SEFAZ não respondeu. A nota ficou na fila e pode ser tentada de novo.',
  INVOICE_STRUCTURE_CHANGED:
    'Não foi possível ler a nota no portal da SEFAZ. O suporte já foi avisado.',
  UNSUPPORTED_FEDERAL_UNIT: 'A importação automática ainda não atende o estado desta nota.',
  INVALID_PENDING_INVOICE: 'Esta nota da fila não está em um estado que permita essa ação.',
  HTTP_TRANSPORT: 'Não foi possível buscar a nota agora. Tente novamente.',

  // Imagens
  // O que foi enviado e o que é aceito vêm de `details`, por `unsupportedImageSummary`.
  UNSUPPORTED_IMAGE_MIME_TYPE: 'Formato de imagem não aceito.',
  IMAGE_UPLOAD_FAILED: 'Não foi possível enviar a imagem agora. Tente novamente.',
  PAYLOAD_TOO_LARGE: 'A imagem é grande demais. Escolha um arquivo menor.',

  // Dinheiro
  INVALID_MONEY_OPERATION: 'Não foi possível calcular esse valor.',
};

/**
 * `DISCOUNT_ALLOCATION` is one code for a family of rules, discriminated by
 * `reason`: each one has a different way out, so each one has its own sentence.
 *
 * The amounts in these sentences are never read out of the English message —
 * they come from `expected` and `provided` in `details`, as decimal strings, and
 * are formatted through `Money` by whoever shows them.
 */
export const DISCOUNT_ALLOCATION_MESSAGES: Record<DiscountAllocationReason, string> = {
  SUM_MISMATCH: 'O desconto distribuído não fecha com o desconto da nota.',
  LINE_EXCEEDS_GROSS: 'Uma linha recebeu mais desconto do que ela vale.',
  DISCOUNT_EXCEEDS_GROSS: 'O desconto é maior do que as linhas de onde ele sairia.',
  NO_ELIGIBLE_LINE: 'Nenhuma linha desta nota se encaixa na forma de distribuição escolhida.',
  MANUAL_INPUT_MISSING: 'Informe quanto do desconto cabe a cada linha.',
  NEGATIVE_LINE_AMOUNT: 'O desconto de uma linha não pode ser negativo.',
  NEGATIVE_DISCOUNT_TOTAL: 'O desconto da nota não pode ser negativo.',
  NO_LINES: 'A nota tem desconto e nenhuma linha para receber esse desconto.',
  RESIDUE_UNALLOCATABLE:
    'Sobrou uma diferença de centavos que não cabe em nenhuma linha. Ajuste a distribuição à mão.',
};

const UNEXPECTED =
  'Algo deu errado do nosso lado. Tente novamente em instantes; se continuar, envie o código abaixo para o suporte.';

const NETWORK = 'Não foi possível falar com o servidor. Verifique a conexão e tente novamente.';

const VALIDATION = 'Confira os campos destacados e tente de novo.';

const NOT_FOUND = 'Não encontramos o que você procurava.';

const CONFLICT = 'Isso entra em conflito com algo que já existe.';

const UNAVAILABLE = 'O serviço não está respondendo agora. Tente novamente em instantes.';

/**
 * The sentence to show for a failure. Never the API's own message: it is in
 * English and written for whoever maintains the system.
 *
 * The order matters. A network failure and a 5xx are unexpected whatever code
 * they carry; below that, the code decides; and a code this build does not know
 * falls back by status band rather than breaking the screen.
 */
export function messageForError(error: ApiError): string {
  if (error.statusCode === 0) {
    return NETWORK;
  }

  if (error.statusCode >= 500 && error.statusCode !== 502 && error.statusCode !== 503) {
    return UNEXPECTED;
  }

  const allocation = error.detailsFor('DISCOUNT_ALLOCATION');

  if (allocation !== undefined) {
    return DISCOUNT_ALLOCATION_MESSAGES[allocation.reason];
  }

  const known = ERROR_MESSAGES[error.code];

  if (known !== undefined) {
    return known;
  }

  if (error.code === 'VALIDATION_FAILED') {
    return VALIDATION;
  }

  return messageForStatus(error.statusCode);
}

/** The fallback band, for a `code` this build has never heard of. */
function messageForStatus(statusCode: number): string {
  if (statusCode === 400 || statusCode === 422) {
    return VALIDATION;
  }

  if (statusCode === 401) {
    return 'Sua sessão expirou. Entre novamente.';
  }

  if (statusCode === 404) {
    return NOT_FOUND;
  }

  if (statusCode === 409) {
    return CONFLICT;
  }

  if (statusCode === 502 || statusCode === 503) {
    return UNAVAILABLE;
  }

  return UNEXPECTED;
}

/**
 * "em uso em 3 vendas e 2 fichas": the breakdown of what is blocking a delete,
 * built from the counts in `details` and never from the English message.
 *
 * Returns `undefined` when the error is not `ENTITY_IN_USE` or did not carry
 * the documented shape, in which case the generic sentence is all there is.
 */
export function entityInUseSummary(error: ApiError): string | undefined {
  const details = error.detailsFor('ENTITY_IN_USE');

  if (details === undefined) {
    return undefined;
  }

  const parts: string[] = [];

  const add = (count: number, one: string, many: string): void => {
    if (count > 0) {
      parts.push(`${count} ${count === 1 ? one : many}`);
    }
  };

  add(details.saleItems, 'venda', 'vendas');
  add(details.bomItems, 'ficha técnica', 'fichas técnicas');
  add(details.purchaseItems, 'compra', 'compras');
  add(details.stockMovements, 'movimentação de estoque', 'movimentações de estoque');

  if (parts.length === 0) {
    return undefined;
  }

  if (parts.length === 1) {
    return `Em uso em ${parts[0]}.`;
  }

  return `Em uso em ${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}.`;
}

/**
 * Why the consumption unit cannot change, with the way out — which is different
 * for each reason, and is the whole point of the API discriminating them.
 */
export function consumptionUnitLockedReason(error: ApiError): string | undefined {
  const details = error.detailsFor('CONSUMPTION_UNIT_LOCKED');

  if (details === undefined) {
    return undefined;
  }

  if (details.reason === 'STOCK_ON_HAND') {
    return 'Há estoque registrado nesta unidade. Zere o estoque para poder trocá-la.';
  }

  const count = details.bomItemReferences;

  return count === 1
    ? 'Uma ficha técnica usa este insumo nesta unidade. Remova essa linha para poder trocá-la.'
    : `${count} fichas técnicas usam este insumo nesta unidade. Remova essas linhas para poder trocá-la.`;
}

/**
 * What goes under a field the API rejected. The reason lives in the English
 * `constraints`, which are diagnostic and never shown, so the field only says
 * that it was refused; the form-level sentence says what to do about it.
 */
export const FIELD_REJECTED_MESSAGE = 'Confira este campo.';

/** An amount from `details`, a decimal string, written as money. */
function amountFrom(value: string | undefined): string | undefined {
  const decimal = parseDecimalString(value);

  return decimal === null ? undefined : formatMoney(Money.parse(decimal));
}

/**
 * The amounts of a discount that did not close, written under the sentence of
 * its reason. Read from `expected` and `provided` as decimal strings and
 * formatted through `Money`; never lifted out of the English message.
 */
export function discountAmountsSummary(error: ApiError): string | undefined {
  const allocation = error.detailsFor('DISCOUNT_ALLOCATION');

  if (allocation !== undefined) {
    const expected = amountFrom(allocation.expected);
    const provided = amountFrom(allocation.provided);

    if (expected === undefined || provided === undefined) {
      return undefined;
    }

    switch (allocation.reason) {
      case 'SUM_MISMATCH':
        return `Distribuído ${provided} de ${expected}.`;
      case 'LINE_EXCEEDS_GROSS':
        return `A linha vale ${expected} e recebeu ${provided}.`;
      case 'DISCOUNT_EXCEEDS_GROSS':
        return `As linhas valem ${expected} e o desconto é ${provided}.`;
      default:
        return undefined;
    }
  }

  const pending = error.detailsFor('PENDING_DISCOUNT_ALLOCATION');

  if (pending !== undefined) {
    const expected = amountFrom(pending.expected);
    const provided = amountFrom(pending.provided);

    return expected === undefined || provided === undefined
      ? undefined
      : `Distribuído ${provided} de ${expected}.`;
  }

  return undefined;
}

/**
 * How a MIME type reads to someone who never saw one: `image/webp` is WebP and
 * `image/heic` is HEIC. Built from the type itself, so a format the API starts
 * to accept tomorrow needs no change here.
 */
function imageFormatName(mimeType: string): string {
  const subtype = (mimeType.split('/')[1] ?? mimeType).split('+')[0] ?? mimeType;

  return subtype.toLowerCase() === 'webp' ? 'WebP' : subtype.toUpperCase();
}

function joinWithAnd(names: readonly string[]): string {
  if (names.length <= 1) {
    return names.join('');
  }

  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1] ?? ''}`;
}

/**
 * "Você enviou um arquivo HEIC. Os formatos aceitos são JPEG, PNG e WebP.":
 * what was sent and what is accepted, both read from `details` and never from
 * the English message.
 */
export function unsupportedImageSummary(error: ApiError): string | undefined {
  const details = error.detailsFor('UNSUPPORTED_IMAGE_MIME_TYPE');

  if (details === undefined) {
    return undefined;
  }

  const sent = `Você enviou um arquivo ${imageFormatName(details.mimeType)}.`;

  if (details.supported.length === 0) {
    return sent;
  }

  const accepted = details.supported.map(imageFormatName);

  return `${sent} ${accepted.length === 1 ? 'O formato aceito é' : 'Os formatos aceitos são'} ${joinWithAnd(accepted)}.`;
}

/**
 * The second line under {@link messageForError}: the numbers and the way out
 * that only the typed `details` know — how many records block a delete, why a
 * unit is locked, how much of a discount is still unattributed.
 */
export function errorDetail(error: ApiError): string | undefined {
  return (
    entityInUseSummary(error) ??
    consumptionUnitLockedReason(error) ??
    discountAmountsSummary(error) ??
    unsupportedImageSummary(error)
  );
}
