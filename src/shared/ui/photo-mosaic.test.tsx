import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PhotoMosaic, type MosaicPhoto } from './photo-mosaic';

function photos(count: number): MosaicPhoto[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `p${index}`,
    src: `https://img.example/${index}.png`,
    alt: `Item ${index + 1}`,
  }));
}

describe('PhotoMosaic', () => {
  it('lets a single photo fill the whole frame', () => {
    const { container } = render(<PhotoMosaic photos={photos(1)} />);

    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(container.firstElementChild).toHaveClass('grid-cols-1');
  });

  it('splits the frame in halves for two', () => {
    const { container } = render(<PhotoMosaic photos={photos(2)} />);

    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(container.firstElementChild).toHaveClass('grid-cols-2');
    expect(container.firstElementChild).toHaveClass('grid-rows-1');
  });

  it('gives the first of three the whole left side', () => {
    const { container } = render(<PhotoMosaic photos={photos(3)} />);

    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(container.firstElementChild?.firstElementChild).toHaveClass('row-span-2');
  });

  it('draws four and counts the rest on the last: six items show +3', () => {
    render(<PhotoMosaic photos={photos(6)} />);

    expect(screen.getAllByRole('img')).toHaveLength(4);
    expect(screen.getByText('+3')).toBeInTheDocument();
  });

  it('says nothing extra when exactly four fit', () => {
    render(<PhotoMosaic photos={photos(4)} />);

    expect(screen.getAllByRole('img')).toHaveLength(4);
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });

  it('keeps the reserved space for an item with no photo, never a broken image', () => {
    render(<PhotoMosaic photos={[{ key: 'a', src: null, alt: 'Cera' }]} />);

    expect(screen.getByRole('img', { name: 'Cera (sem foto)' })).toBeInTheDocument();
  });
});
