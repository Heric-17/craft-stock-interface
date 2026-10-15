import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { Sheet, SheetContent } from './sheet';

function OpenPanel() {
  const [open, setOpen] = useState(true);

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" title="Painel">
          <p>Dentro do painel</p>
        </SheetContent>
      </Sheet>
      {/* Where a toast is drawn: outside the panel, inside the toaster. */}
      <ol data-sonner-toaster>
        <li>
          <button type="button">Copiar código</button>
        </li>
      </ol>
      <p>Fora de tudo</p>
    </>
  );
}

describe('a panel', () => {
  it('stays open when a toast is pressed, since the toast belongs to the screen under it', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<OpenPanel />);

    await user.click(screen.getByText('Copiar código'));

    expect(screen.getByText('Dentro do painel')).toBeInTheDocument();
  });

  it('still closes when anything else outside it is pressed', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<OpenPanel />);

    await user.click(screen.getByText('Fora de tudo'));

    expect(screen.queryByText('Dentro do painel')).not.toBeInTheDocument();
  });
});
