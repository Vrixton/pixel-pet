import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PixelPet } from './index';

const getSprite = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('.pixel-pet-sprite');

describe('PixelPet', () => {
  it('renders the cat sprite by default', () => {
    const { container } = render(<PixelPet />);
    const sprite = getSprite(container);

    expect(sprite).toBeInTheDocument();
    expect(sprite?.style.backgroundImage).toContain('cat-sprite');
  });

  it('renders the dog sprite when the variant is dog', () => {
    const { container } = render(<PixelPet variant="dog" />);

    expect(getSprite(container)?.style.backgroundImage).toContain('dog-sprite');
  });
});
