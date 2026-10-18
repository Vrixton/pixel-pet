import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

  it('exposes the pet as a button named after the pet', () => {
    render(<PixelPet petName="Danko" />);

    expect(screen.getByRole('button', { name: 'Danko' })).toBeInTheDocument();
  });

  it('uses the label prop as the accessible name when provided', () => {
    render(<PixelPet petName="Danko" label="Pet Danko" />);

    expect(screen.getByRole('button', { name: 'Pet Danko' })).toBeInTheDocument();
  });

  it('can be focused and activated with the keyboard', async () => {
    const user = userEvent.setup();
    render(<PixelPet petName="Danko" />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    await user.tab();
    expect(pet).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(pet).toHaveClass('state-happy');
  });
});

describe('PixelPet dialog bubble', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const getDialog = (container: HTMLElement) => container.querySelector('.pixel-pet-dialog');

  it('shows the bubble after a tap, without hover', () => {
    const { container } = render(<PixelPet petName="Danko" />);

    expect(getDialog(container)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Danko' }));

    expect(getDialog(container)).toHaveTextContent('Danko se siente feliz');
  });

  it('announces the bubble through a status region when activated with the keyboard', async () => {
    const user = userEvent.setup();
    render(<PixelPet petName="Danko" />);

    await user.tab();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('status')).toHaveTextContent('Danko se siente feliz');
  });

  it('keeps automatic emotions silent until the pet is hovered or focused', () => {
    vi.useFakeTimers();
    const { container } = render(<PixelPet petName="Danko" />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(pet.className).toMatch(/state-(happy|angry|curious)/);
    expect(getDialog(container)).not.toBeInTheDocument();

    act(() => {
      pet.focus();
    });

    expect(getDialog(container)).toBeInTheDocument();
  });
});

describe('PixelPet sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const advance = (ms: number) => {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  };

  const renderAndSleep = () => {
    render(<PixelPet petName="Danko" />);
    advance(1000);
    fireEvent.pointerMove(window);
    advance(120000);
    const pet = screen.getByRole('button', { name: 'Danko' });
    expect(pet).toHaveClass('state-sleep');
    return pet;
  };

  it('falls asleep two minutes after the last activity', () => {
    renderAndSleep();
  });

  it('counts keyboard activity and stays awake', () => {
    render(<PixelPet petName="Danko" />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    advance(1000);
    fireEvent.keyDown(window, { key: 'Tab' });
    advance(119000);
    fireEvent.keyDown(window, { key: 'Tab' });
    advance(2000);

    expect(pet).not.toHaveClass('state-sleep');
  });

  it('wakes up with a key press', () => {
    const pet = renderAndSleep();

    fireEvent.keyDown(window, { key: 'Tab' });

    expect(pet).not.toHaveClass('state-sleep');
  });

  it('wakes up with a touch anywhere on the page', () => {
    const pet = renderAndSleep();

    fireEvent.pointerDown(window, { pointerType: 'touch' });

    expect(pet).not.toHaveClass('state-sleep');
  });
});

describe('PixelPet reduced motion', () => {
  const mockReducedMotion = (matches: boolean) => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('walks when the user has no motion preference', () => {
    mockReducedMotion(false);
    render(<PixelPet petName="Danko" />);

    expect(screen.getByRole('button', { name: 'Danko' })).toHaveClass('state-walk');
  });

  it('stays in place when the user prefers reduced motion', () => {
    mockReducedMotion(true);
    render(<PixelPet petName="Danko" />);

    act(() => {
      vi.advanceTimersByTime(20000);
    });

    expect(screen.getByRole('button', { name: 'Danko' })).not.toHaveClass('state-walk');
  });
});

describe('PixelPet walking', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('tries again when the first roll says not to walk', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValue(0.99);
    render(<PixelPet petName="Danko" />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    expect(pet).not.toHaveClass('state-walk');

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(pet).toHaveClass('state-walk');
  });

  it('stops walking when the walk duration ends', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValue(0);
    render(<PixelPet petName="Danko" />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    expect(pet).toHaveClass('state-walk');

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(pet).toHaveClass('state-idle');
  });
});
