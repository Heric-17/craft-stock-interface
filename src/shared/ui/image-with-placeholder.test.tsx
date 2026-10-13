import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ImageWithPlaceholder } from './image-with-placeholder';

describe('ImageWithPlaceholder', () => {
  it('shows the picture when the URL loads', () => {
    render(<ImageWithPlaceholder src="https://img.test/cera.jpg" alt="Cera de soja" />);

    expect(screen.getByRole('img', { name: 'Cera de soja' })).toHaveAttribute(
      'src',
      'https://img.test/cera.jpg',
    );
  });

  it('swaps in a reserved space, never a broken icon, when the URL fails', () => {
    const { container } = render(
      <ImageWithPlaceholder
        src="https://img.test/quebrada.jpg"
        alt="Cera de soja"
        className="size-11"
      />,
    );

    fireEvent.error(container.querySelector('img')!);

    expect(container.querySelector('img')).toBeNull();
    const placeholder = screen.getByRole('img', { name: 'Cera de soja (sem foto)' });
    // The space keeps the size the picture would have had, so the row does not move.
    expect(placeholder).toHaveClass('size-11');
  });

  it('shows the placeholder straight away when the API sent no URL', () => {
    const { container } = render(<ImageWithPlaceholder src={null} alt="Pavio encerado" />);

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('img', { name: 'Pavio encerado (sem foto)' })).toBeInTheDocument();
  });

  it('gives a replaced URL its own try instead of inheriting the old failure', () => {
    const { container, rerender } = render(
      <ImageWithPlaceholder src="https://img.test/antiga.jpg" alt="Cera de soja" />,
    );
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();

    rerender(<ImageWithPlaceholder src="https://img.test/nova.jpg" alt="Cera de soja" />);

    expect(container.querySelector('img')).toHaveAttribute('src', 'https://img.test/nova.jpg');
  });
});
