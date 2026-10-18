import { STOCK_LOSS_REASON_LABELS } from '@/features/materials';
import type { ConsumptionUnit } from '@/shared/quantity';

import type { ActivityEntry, FieldChange } from './activity-entry';
import { formatFieldValue, isEmptyValue, readUnit, type ValueContext } from './activity-values';
import {
  ENTITIES,
  FIELDS,
  GENERIC_TEXT,
  LOSS_TEXT,
  PURCHASE_INTENT_VERBS,
  SUBJECTS,
  type EntityText,
  type FieldDef,
} from './labels';

/** A material as far as a sentence needs it: its name, and the unit its quantities are in. */
export interface MaterialRef {
  name: string;
  unit: ConsumptionUnit;
}

/**
 * What a sentence needs to know that the entry itself does not say.
 *
 * - who is looking, because the feed is the whole installation's and "Você" is
 *   only true for the entries that person made;
 * - the materials, because a stock loss names its material by id only, and a
 *   quantity in the trail carries no unit — the unit is the material's;
 * - the clock, so that "Hoje" in a sentence is something a test can fix.
 */
export interface ActivityContext {
  viewerId: string | null;
  materials: ReadonlyMap<string, MaterialRef>;
  now: Date;
}

export interface ActivityDescription {
  /** One line, without a final period: "Você alterou o custo da embalagem de Café de R$ 22,90 para R$ 24,50". */
  sentence: string;
  /** What changed, one line per field, when the sentence alone does not say it all. */
  details: readonly string[];
}

/** The materials of the system, keyed by id, for `ActivityContext`. */
export function indexMaterials(
  materials: readonly { id: string; name: string; consumptionUnit: ConsumptionUnit }[],
): ReadonlyMap<string, MaterialRef> {
  return new Map(
    materials.map((material) => [
      material.id,
      { name: material.name, unit: material.consumptionUnit },
    ]),
  );
}

/**
 * Tells what an entry of the trail did, in Portuguese, from the structured data
 * the API sends and nothing else: the API never sends a sentence, and nothing
 * here prints a column name.
 *
 * Whatever this build does not recognise degrades to a plainer sentence and
 * never to an error: an unknown model is "um registro", an unknown field is left
 * out, an unreadable value is left out of "de … para …".
 */
export function describeActivity(
  entry: ActivityEntry,
  context: ActivityContext,
): ActivityDescription {
  const subject = subjectOf(entry, context);

  if (entry.entityType === 'StockLoss') {
    return describeLoss(entry, subject, context);
  }

  const entity = own(ENTITIES, entry.entityType);

  if (entity === undefined) {
    return { sentence: `${subject} ${describeUnknown(entry)}`, details: [] };
  }

  switch (entry.operation) {
    case 'CREATE':
      return describeCreation(entry, entity, subject, context);
    case 'DELETE':
      return { sentence: `${subject} excluiu ${nameOf(entity, entry.entityLabel)}`, details: [] };
    case 'UPDATE':
      return describeUpdate(entry, entity, subject, context);
    default:
      return {
        sentence: `${subject} ${GENERIC_TEXT.other} ${entry.entityLabel?.trim() || entity.unnamed}`,
        details: [],
      };
  }
}

function subjectOf(entry: ActivityEntry, context: ActivityContext): string {
  if (entry.userId === null) {
    return SUBJECTS.system;
  }

  return entry.userId === context.viewerId ? SUBJECTS.viewer : SUBJECTS.someoneElse;
}

function nameOf(entity: EntityText, label: string | null): string {
  return label === null || label.trim() === '' ? entity.unnamed : entity.named(label);
}

function ofLabel(entity: EntityText, label: string | null): string {
  return entity.of(label === null || label.trim() === '' ? null : label);
}

function describeUnknown(entry: ActivityEntry): string {
  const what = entry.entityLabel?.trim() || GENERIC_TEXT.record;

  switch (entry.operation) {
    case 'CREATE':
      return `${GENERIC_TEXT.created} ${what}`;
    case 'UPDATE':
      return `${GENERIC_TEXT.updated} ${what}`;
    case 'DELETE':
      return `${GENERIC_TEXT.deleted} ${what}`;
    default:
      return `${GENERIC_TEXT.other} ${what}`;
  }
}

function describeCreation(
  entry: ActivityEntry,
  entity: EntityText,
  subject: string,
  context: ActivityContext,
): ActivityDescription {
  const base = `${subject} ${entity.created} ${nameOf(entity, entry.entityLabel)}`;

  // A purchase is worth saying with what was paid: it is the one thing a person
  // looks for in the list. The other models have no figure that sums them up.
  if (entry.entityType === 'Purchase') {
    const paid = formatFieldValue(
      { type: 'money' },
      entry.changes.netTotal?.new,
      valueContext(null, context),
    );

    return { sentence: paid === null ? base : `${base} no valor de ${paid}`, details: [] };
  }

  return { sentence: base, details: [] };
}

/** One changed field, ready to be said. */
interface Clause {
  def: FieldDef;
  change: FieldChange;
  /** `null` when the value cannot be written (no unit, unreadable). */
  from: string | null;
  to: string | null;
  /** The side that had nothing: the field was set, or was cleared. */
  wasEmpty: boolean;
  isEmpty: boolean;
}

function describeUpdate(
  entry: ActivityEntry,
  entity: EntityText,
  subject: string,
  context: ActivityContext,
): ActivityDescription {
  const fields = own(FIELDS, entry.entityType) ?? {};
  const clauses = readClauses(entry, fields, context);
  const of = ofLabel(entity, entry.entityLabel);

  if (entry.entityType === 'Purchase') {
    const verb = intentVerb(entry.intent);

    if (verb !== null) {
      return { sentence: `${subject} ${verb} ${of}`, details: clauses.map(detailOf) };
    }
  }

  const [only, ...rest] = clauses;

  if (only === undefined) {
    return {
      sentence: `${subject} ${GENERIC_TEXT.updated} ${nameOf(entity, entry.entityLabel)}`,
      details: [],
    };
  }

  if (rest.length === 0) {
    return {
      sentence: `${subject} ${singleClause(only, entity, of, entry.entityLabel)}`,
      details: [],
    };
  }

  const names = clauses.map((clause) => `${clause.def.article} ${clause.def.label}`);

  return {
    sentence: `${subject} alterou ${joinList(names)} ${of}`,
    details: clauses.map(detailOf),
  };
}

function readClauses(
  entry: ActivityEntry,
  fields: Readonly<Record<string, FieldDef>>,
  context: ActivityContext,
): Clause[] {
  const clauses: Clause[] = [];
  const seen = new Set<string>();
  const fallbackUnit = unitOfEntry(entry, context);

  for (const [column, change] of Object.entries(entry.changes)) {
    const def = own(fields, column);

    // An unknown column, or the second spelling of a field already told (the
    // photo has two): nothing to say.
    if (def === undefined || seen.has(def.label)) {
      continue;
    }

    seen.add(def.label);

    const unitOld = readUnit(entry.changes.consumptionUnit?.old) ?? fallbackUnit;
    const unitNew = readUnit(entry.changes.consumptionUnit?.new) ?? fallbackUnit;

    clauses.push({
      def,
      change,
      from: formatFieldValue(def.kind, change.old, valueContext(unitOld, context)),
      to: formatFieldValue(def.kind, change.new, valueContext(unitNew, context)),
      wasEmpty: isEmptyValue(change.old),
      isEmpty: isEmptyValue(change.new),
    });
  }

  return clauses;
}

/** The unit a material's quantities are in, from the materials the screen knows. */
function unitOfEntry(entry: ActivityEntry, context: ActivityContext): ConsumptionUnit | null {
  return entry.entityType === 'Material'
    ? (context.materials.get(entry.entityId)?.unit ?? null)
    : null;
}

function valueContext(unit: ConsumptionUnit | null, context: ActivityContext): ValueContext {
  return { unit, now: context.now };
}

function singleClause(
  clause: Clause,
  entity: EntityText,
  of: string,
  label: string | null,
): string {
  const { def } = clause;
  const field = `${def.article} ${def.label}`;

  if (def.kind.type === 'flag') {
    return def.kind.sentence(clause.change.new === true, of);
  }

  if (def.kind.type === 'discontinuation') {
    const verb = clause.isEmpty ? entity.reactivated : entity.discontinued;

    if (verb !== undefined) {
      return `${verb} ${nameOf(entity, label)}`;
    }
  }

  if (def.kind.type === 'image') {
    return `${clause.wasEmpty ? 'adicionou' : clause.isEmpty ? 'removeu' : 'alterou'} ${field} ${of}`;
  }

  if (clause.wasEmpty && !clause.isEmpty) {
    return clause.to === null
      ? `definiu ${field} ${of}`
      : `definiu ${field} ${of} como ${clause.to}`;
  }

  if (clause.isEmpty && !clause.wasEmpty) {
    return `removeu ${field} ${of}`;
  }

  if (clause.from === null || clause.to === null) {
    return `alterou ${field} ${of}`;
  }

  return `alterou ${field} ${of} de ${clause.from} para ${clause.to}`;
}

/** One line under a sentence that names several fields. */
function detailOf(clause: Clause): string {
  const name = capitalize(clause.def.label);

  if (clause.def.kind.type === 'image') {
    return `${name}: ${clause.wasEmpty ? 'adicionada' : clause.isEmpty ? 'removida' : 'alterada'}`;
  }

  if (clause.wasEmpty && clause.to !== null) {
    return `${name}: definido como ${clause.to}`;
  }

  if (clause.isEmpty && !clause.wasEmpty) {
    return `${name}: removido`;
  }

  return clause.from === null || clause.to === null
    ? `${name}: alterado`
    : `${name}: de ${clause.from} para ${clause.to}`;
}

function intentVerb(intent: string | null): string | null {
  return intent !== null && Object.hasOwn(PURCHASE_INTENT_VERBS, intent)
    ? PURCHASE_INTENT_VERBS[intent as keyof typeof PURCHASE_INTENT_VERBS]
    : null;
}

function describeLoss(
  entry: ActivityEntry,
  subject: string,
  context: ActivityContext,
): ActivityDescription {
  const isDeletion = entry.operation === 'DELETE';

  if (entry.operation !== 'CREATE' && !isDeletion) {
    return { sentence: `${subject} ${LOSS_TEXT.fallback}`, details: [] };
  }

  // A deleted loss carries its values on the old side, a recorded one on the new.
  const side = (column: string): unknown =>
    isDeletion ? entry.changes[column]?.old : entry.changes[column]?.new;

  const materialId = side('materialId');
  const material = typeof materialId === 'string' ? context.materials.get(materialId) : undefined;
  const quantity =
    material === undefined
      ? null
      : formatFieldValue(
          { type: 'quantity' },
          side('quantity'),
          valueContext(material.unit, context),
        );
  const reason = typeof side('reason') === 'string' ? side('reason') : null;
  const reasonLabel =
    typeof reason === 'string' && Object.hasOwn(STOCK_LOSS_REASON_LABELS, reason)
      ? STOCK_LOSS_REASON_LABELS[reason as keyof typeof STOCK_LOSS_REASON_LABELS]
      : null;

  const what = [quantity, material?.name].filter(
    (part): part is string => part !== null && part !== undefined,
  );
  const base = isDeletion ? LOSS_TEXT.deleted : LOSS_TEXT.recorded;
  const subjectOfLoss = what.length === 0 ? LOSS_TEXT.noQuantityOrMaterial : what.join(' de ');
  const because = reasonLabel === null ? '' : ` (${reasonLabel.toLowerCase()})`;

  const observation = side('observation');
  const details: string[] = [];

  if (typeof observation === 'string' && observation.trim() !== '') {
    details.push(`${LOSS_TEXT.observation}: ${observation.trim()}`);
  }

  if (isDeletion) {
    details.push(LOSS_TEXT.stockUntouched);
  }

  return { sentence: `${subject} ${base} de ${subjectOfLoss}${because}`, details };
}

/** "a, b e c" — Portuguese lists close with "e" and have no serial comma. */
function joinList(items: readonly string[]): string {
  const last = items[items.length - 1];

  return items.length < 2 || last === undefined
    ? items.join('')
    : `${items.slice(0, -1).join(', ')} e ${last}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * A property of a table keyed by something the API sent. `Object.hasOwn` keeps a
 * model or column called `constructor` from finding something on the prototype.
 */
function own<T>(table: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined;
}
