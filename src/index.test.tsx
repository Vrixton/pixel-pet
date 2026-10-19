import { Profiler } from 'react';
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

    expect(getDialog(container)).toHaveTextContent('Danko is feeling happy!');
  });

  it('announces the bubble through a status region when activated with the keyboard', async () => {
    const user = userEvent.setup();
    render(<PixelPet petName="Danko" />);

    await user.tab();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('status')).toHaveTextContent('Danko is feeling happy!');
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

describe('PixelPet emotions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
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

  it('shows an emotion every 30 seconds even when the action changes in between', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValueOnce(0).mockReturnValue(0);
    render(<PixelPet petName="Danko" />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    expect(pet).toHaveClass('state-walk');

    for (let second = 0; second < 30; second += 1) {
      advance(1000);
    }

    expect(pet).toHaveClass('state-happy');
  });

  it('clears the emotion after five seconds when tapping a sleeping pet', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    render(<PixelPet petName="Danko" />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    advance(1000);
    fireEvent.pointerMove(window);
    advance(120000);
    expect(pet).toHaveClass('state-sleep');

    fireEvent.click(pet);
    expect(pet).toHaveClass('state-happy');

    advance(5000);

    expect(pet).toHaveClass('state-idle');
  });

  it('stays asleep when falling asleep and an automatic emotion happen at the same time', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    render(<PixelPet petName="Danko" />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    advance(120000);
    expect(pet).toHaveClass('state-sleep');

    advance(10000);

    expect(pet).toHaveClass('state-sleep');
  });
});

describe('PixelPet placement', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const getPositionX = (container: HTMLElement) => {
    const walker = container.querySelector<HTMLElement>('.pixel-pet-container');
    return Number(walker?.style.transform.match(/translateX\((-?[\d.]+)px\)/)?.[1]);
  };

  it('positions itself inside its parent instead of the viewport', () => {
    const { container } = render(<PixelPet petName="Danko" />);
    const stage = container.querySelector<HTMLElement>('.pixel-pet');
    const walker = container.querySelector<HTMLElement>('.pixel-pet-container');

    expect(stage).toBeInTheDocument();
    expect(getComputedStyle(stage as HTMLElement).position).toBe('absolute');
    expect(getComputedStyle(walker as HTMLElement).position).toBe('absolute');
  });

  it('does not walk when the walk prop is false', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    render(<PixelPet petName="Danko" walk={false} />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    act(() => {
      vi.advanceTimersByTime(20000);
    });

    expect(pet).not.toHaveClass('state-walk');
  });

  it('keeps walking within the width of its parent', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValue(0);
    const { container } = render(<PixelPet petName="Danko" />);
    const positions: number[] = [];

    for (let step = 0; step < 50; step += 1) {
      act(() => {
        vi.advanceTimersByTime(100);
      });
      positions.push(getPositionX(container));
    }

    expect(Math.max(...positions)).toBeLessThanOrEqual(240);
    expect(Math.min(...positions)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...positions)).toBeGreaterThan(200);
  });
});

describe('PixelPet dialog placement', () => {
  const mockLayout = (stageWidth: number) => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(stageWidth);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.classList.contains('pixel-pet-dialog') ? 180 : 60;
    });
  };

  const getPositionX = (container: HTMLElement) => {
    const walker = container.querySelector<HTMLElement>('.pixel-pet-container');
    return Number(walker?.style.transform.match(/translateX\((-?[\d.]+)px\)/)?.[1]);
  };

  const getDialog = (container: HTMLElement) =>
    container.querySelector<HTMLElement>('.pixel-pet-dialog');

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('centers the bubble over the pet when there is room', () => {
    mockLayout(300);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { container } = render(<PixelPet petName="Danko" />);

    fireEvent.click(screen.getByRole('button', { name: 'Danko' }));

    expect(getDialog(container)?.style.left).toBe('-60px');
  });

  it('keeps the bubble inside the container when the pet is at the edge', () => {
    mockLayout(300);
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValue(0);
    const { container } = render(<PixelPet petName="Danko" />);

    for (let step = 0; step < 40; step += 1) {
      act(() => {
        vi.advanceTimersByTime(100);
      });
    }

    const positionX = getPositionX(container);
    expect(positionX).toBeGreaterThan(200);

    fireEvent.click(screen.getByRole('button', { name: 'Danko' }));
    const dialogLeft = parseFloat(getDialog(container)?.style.left ?? '');

    expect(positionX + dialogLeft + 180).toBe(296);
  });

  it('limits the bubble width to the container', () => {
    mockLayout(200);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { container } = render(<PixelPet petName="Danko" />);

    fireEvent.click(screen.getByRole('button', { name: 'Danko' }));

    expect(getDialog(container)?.style.maxWidth).toBe('192px');
  });
});

describe('PixelPet container resizing', () => {
  let notifyResize: ((width: number) => void) | undefined;

  class MockResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      notifyResize = (width) => {
        callback(
          [{ contentRect: { width } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      };
    }

    observe() {}

    unobserve() {}

    disconnect() {}
  }

  const getPositionX = (container: HTMLElement) => {
    const walker = container.querySelector<HTMLElement>('.pixel-pet-container');
    return Number(walker?.style.transform.match(/translateX\((-?[\d.]+)px\)/)?.[1]);
  };

  const resizeTo = (width: number) => {
    act(() => {
      notifyResize?.(width);
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('moves the pet back inside when the container shrinks', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { container } = render(<PixelPet petName="Danko" />);

    expect(getPositionX(container)).toBe(100);

    resizeTo(120);

    expect(getPositionX(container)).toBe(55);
  });

  it('walks across the new width when the container grows', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.05)
      .mockReturnValue(0);
    const { container } = render(<PixelPet petName="Danko" />);

    resizeTo(500);

    const positions: number[] = [];
    for (let step = 0; step < 100; step += 1) {
      act(() => {
        vi.advanceTimersByTime(100);
      });
      positions.push(getPositionX(container));
    }

    expect(Math.max(...positions)).toBeGreaterThan(300);
    expect(Math.max(...positions)).toBeLessThanOrEqual(435);
  });
});

describe('PixelPet walking performance', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('moves without re-rendering the component on every step', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValueOnce(0.05).mockReturnValue(0);
    let commits = 0;
    const { container } = render(
      <Profiler id="pet" onRender={() => (commits += 1)}>
        <PixelPet petName="Danko" />
      </Profiler>,
    );
    const walker = container.querySelector<HTMLElement>('.pixel-pet-container');

    act(() => {
      vi.advanceTimersByTime(100);
    });
    const startTransform = walker?.style.transform;
    const commitsBefore = commits;

    for (let step = 0; step < 20; step += 1) {
      act(() => {
        vi.advanceTimersByTime(100);
      });
    }

    expect(walker?.style.transform).not.toBe(startTransform);
    expect(commits - commitsBefore).toBe(0);
  });
});

describe('PixelPet messages', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const getDialog = (container: HTMLElement) => container.querySelector('.pixel-pet-dialog');

  it('uses English messages by default', () => {
    const { container } = render(<PixelPet petName="Danko" />);

    fireEvent.click(screen.getByRole('button', { name: 'Danko' }));

    expect(getDialog(container)).toHaveTextContent('Danko is feeling happy!');
  });

  it('uses the message passed for the emotion, for example in another language', () => {
    const { container } = render(
      <PixelPet petName="Danko" messages={{ happy: '¡Danko se siente feliz!' }} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Danko' }));

    expect(getDialog(container)).toHaveTextContent('¡Danko se siente feliz!');
  });

  it('keeps the default for emotions without a custom message', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { container } = render(
      <PixelPet petName="Danko" messages={{ happy: '¡Danko se siente feliz!' }} />,
    );
    const pet = screen.getByRole('button', { name: 'Danko' });

    act(() => {
      vi.advanceTimersByTime(30000);
    });
    act(() => {
      pet.focus();
    });

    expect(pet).toHaveClass('state-angry');
    expect(getDialog(container)).toHaveTextContent('Danko is feeling overwhelmed!');
    vi.useRealTimers();
  });
});
