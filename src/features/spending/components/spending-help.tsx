import { Callout } from '@/shared/ui/callout';

import { SPENDING_HELP } from '../model/labels';

/**
 * What the panel adds up and what it leaves out, in three short lines. The two
 * that surprise: the total is what was paid, not the sum of the lines, and the
 * cost of a material is worked out from the full price instead.
 */
export function SpendingHelp() {
  return (
    <Callout tone="info">
      <p className="font-semibold">{SPENDING_HELP.title}</p>
      <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-pretty">
        <li>{SPENDING_HELP.paidValue}</li>
        <li>{SPENDING_HELP.materialCost}</li>
        <li>{SPENDING_HELP.split}</li>
      </ul>
    </Callout>
  );
}
