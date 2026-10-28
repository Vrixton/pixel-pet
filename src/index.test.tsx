import { Profiler, createRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PixelPet, type PixelPetHandle } from './index';

const getSprite = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('.pixel-pet-sprite');

const focusWithKeyboard = (element: HTMLElement) => {
  fireEvent.keyDown(document.body, { key: 'Tab' });
  act(() => {
    element.focus();
  });
};

const clickWithMouse = (element: HTMLElement) => {
  fireEvent.pointerEnter(element.parentElement!, { pointerType: 'mouse' });
  fireEvent.pointerDown(element);
  fireEvent.mouseDown(element);
  act(() => {
    element.focus();
  });
  fireEvent.mouseUp(element);
  fireEvent.click(element);
};

describe('PixelPet', () => {
  it('renders the cat sprite by default', () => {
    const { container } = render(<PixelPet />);
    const sprite = getSprite(container);

    expect(sprite).toHaveClass('pixel-pet-cat');
    expect(getComputedStyle(sprite!).backgroundImage).toContain('cat-sprite');
  });

  it('renders the dog sprite when the variant is dog', () => {
    const { container } = render(<PixelPet variant="dog" />);
    const sprite = getSprite(container);

    expect(sprite).toHaveClass('pixel-pet-dog');
    expect(getComputedStyle(sprite!).backgroundImage).toContain('dog-sprite');
  });

  it.each(['axolotl', 'parakeet', 'hamster'] as const)('renders the %s sprite for its variant', (variant) => {
    const { container } = render(<PixelPet variant={variant} />);
    const sprite = getSprite(container);

    expect(sprite).toHaveClass(`pixel-pet-${variant}`);
    expect(getComputedStyle(sprite!).backgroundImage).toContain(`${variant}-sprite`);
  });

  it('loads the variant sprite from the stylesheet instead of an inline style', () => {
    const { container } = render(<PixelPet variant="dog" />);

    expect(getSprite(container)?.getAttribute('style')).toBeNull();
  });

  it('uses spriteSrc instead of the variant sprite when provided', () => {
    const { container } = render(<PixelPet variant="dog" spriteSrc="/pets/danko.png" />);
    const backgroundImage = getSprite(container)?.style.backgroundImage;

    expect(backgroundImage).toContain('/pets/danko.png');
    expect(getComputedStyle(getSprite(container)!).backgroundImage).toContain('/pets/danko.png');
  });

  it('keeps a spriteSrc with spaces and parentheses intact', () => {
    const { container } = render(<PixelPet spriteSrc="/pets/my dog (v2).png" />);

    expect(getSprite(container)?.style.backgroundImage).toBe('url("/pets/my dog (v2).png")');
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
    expect(pet).toHaveClass('pixel-pet-state-happy');
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

    expect(pet.className).toMatch(/pixel-pet-state-(happy|angry|curious)/);
    expect(getDialog(container)).not.toBeInTheDocument();

    focusWithKeyboard(pet);

    expect(getDialog(container)).toBeInTheDocument();
  });
});

describe('PixelPet nap', () => {
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

  const renderPet = () => {
    const { container } = render(<PixelPet petName="Danko" />);
    return {
      pet: screen.getByRole('button', { name: 'Danko' }),
      walker: container.querySelector<HTMLElement>('.pixel-pet-container')!,
    };
  };

  it('naps for a moment two minutes after the last activity and wakes up with a startle', () => {
    const { pet, walker } = renderPet();

    advance(1000);
    fireEvent.pointerMove(window);
    advance(119900);

    expect(pet).not.toHaveClass('pixel-pet-state-sleep');

    advance(100);

    expect(pet).toHaveClass('pixel-pet-state-sleep');

    advance(2500);

    expect(pet).toHaveClass('pixel-pet-state-idle');
    expect(walker).toHaveClass('pixel-pet-startle');

    advance(300);

    expect(walker).not.toHaveClass('pixel-pet-startle');
  });

  it('counts keyboard activity and stays awake', () => {
    const { pet } = renderPet();

    advance(1000);
    fireEvent.keyDown(window, { key: 'Tab' });
    advance(119000);
    fireEvent.keyDown(window, { key: 'Tab' });
    advance(2000);

    expect(pet).not.toHaveClass('pixel-pet-state-sleep');
  });

  it('no longer stays asleep after two minutes without activity', () => {
    const { pet } = renderPet();

    advance(120000);
    advance(5000);

    expect(pet).not.toHaveClass('pixel-pet-state-sleep');
  });

  it('naps again every two minutes while there is no activity', () => {
    const { pet } = renderPet();

    advance(120000);
    advance(2500);
    expect(pet).not.toHaveClass('pixel-pet-state-sleep');

    advance(120000 - 2500);
    expect(pet).toHaveClass('pixel-pet-state-sleep');
  });

  it('wakes up early without a startle when tapped', () => {
    const { pet, walker } = renderPet();

    advance(120000);
    fireEvent.click(pet);
    advance(2500);

    expect(pet).not.toHaveClass('pixel-pet-state-sleep');
    expect(walker).not.toHaveClass('pixel-pet-startle');
  });

  it('skips the nap while the actions menu is open', () => {
    render(<PixelPet petName="Danko" actions={[{ id: 'chat', label: 'Chat', onSelect: () => {} }]} />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    fireEvent.click(pet);
    advance(120000);

    expect(pet).toHaveClass('pixel-pet-state-idle');
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('skips the nap while speaking', () => {
    const handle = createRef<PixelPetHandle>();
    render(<PixelPet petName="Danko" ref={handle} />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    act(() => {
      handle.current?.say('Still here', { duration: Infinity });
    });
    advance(120000);

    expect(pet).not.toHaveClass('pixel-pet-state-sleep');
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

    expect(screen.getByRole('button', { name: 'Danko' })).toHaveClass('pixel-pet-state-walk');
  });

  it('stays in place when the user prefers reduced motion', () => {
    mockReducedMotion(true);
    render(<PixelPet petName="Danko" />);

    act(() => {
      vi.advanceTimersByTime(20000);
    });

    expect(screen.getByRole('button', { name: 'Danko' })).not.toHaveClass('pixel-pet-state-walk');
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

    expect(pet).not.toHaveClass('pixel-pet-state-walk');

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(pet).toHaveClass('pixel-pet-state-walk');
  });

  it('stops walking when the walk duration ends', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValue(0);
    render(<PixelPet petName="Danko" />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    expect(pet).toHaveClass('pixel-pet-state-walk');

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(pet).toHaveClass('pixel-pet-state-idle');
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

    expect(pet).toHaveClass('pixel-pet-state-walk');

    for (let second = 0; second < 30; second += 1) {
      advance(1000);
    }

    expect(pet).toHaveClass('pixel-pet-state-happy');
  });

  it('clears the emotion after five seconds when tapping a sleeping pet', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    render(<PixelPet petName="Danko" />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    advance(1000);
    fireEvent.pointerMove(window);
    advance(120000);
    expect(pet).toHaveClass('pixel-pet-state-sleep');

    fireEvent.click(pet);
    expect(pet).toHaveClass('pixel-pet-state-happy');

    advance(5000);

    expect(pet).toHaveClass('pixel-pet-state-idle');
  });

  it('keeps napping when the nap and an automatic emotion happen at the same time', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    render(<PixelPet petName="Danko" />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    advance(120000);
    expect(pet).toHaveClass('pixel-pet-state-sleep');

    advance(2000);

    expect(pet).toHaveClass('pixel-pet-state-sleep');
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

    expect(pet).not.toHaveClass('pixel-pet-state-walk');
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
    focusWithKeyboard(pet);

    expect(pet).toHaveClass('pixel-pet-state-angry');
    expect(getDialog(container)).toHaveTextContent('Danko is feeling overwhelmed!');
    vi.useRealTimers();
  });
});

describe('PixelPet say()', () => {
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

  const renderWithHandle = () => {
    const handle = createRef<PixelPetHandle>();
    const view = render(<PixelPet petName="Danko" ref={handle} />);
    const say = (...args: Parameters<PixelPetHandle['say']>) => {
      act(() => {
        handle.current?.say(...args);
      });
    };
    return { ...view, say, pet: screen.getByRole('button', { name: 'Danko' }) };
  };

  const getDialog = (container: HTMLElement) => container.querySelector('.pixel-pet-dialog');

  it('shows and announces a message without hover, then hides it after five seconds', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { container, say } = renderWithHandle();

    say('Press the center button.');

    expect(getDialog(container)).toHaveTextContent('Press the center button.');
    expect(screen.getByRole('status')).toHaveTextContent('Press the center button.');

    advance(5000);

    expect(getDialog(container)).not.toBeInTheDocument();
  });

  it('shows the requested emotion while speaking', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { container, say, pet } = renderWithHandle();

    say('What is this?', { emotion: 'curious' });

    expect(pet).toHaveClass('pixel-pet-state-curious');
    expect(getDialog(container)).toHaveTextContent('What is this?');
  });

  it('keeps the message for the requested duration', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { container, say } = renderWithHandle();

    say('A longer hint.', { duration: 8000 });
    advance(7000);

    expect(getDialog(container)).toHaveTextContent('A longer hint.');

    advance(1000);

    expect(getDialog(container)).not.toBeInTheDocument();
  });

  it('keeps an endless message until the pet is tapped', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { container, say, pet } = renderWithHandle();

    say('Ask me anything.', { duration: Infinity });
    advance(50000);
    fireEvent.pointerEnter(pet.parentElement!, { pointerType: 'mouse' });
    fireEvent.pointerLeave(pet.parentElement!, { pointerType: 'mouse' });
    advance(50000);

    expect(getDialog(container)).toHaveTextContent('Ask me anything.');

    fireEvent.click(pet);

    expect(getDialog(container)).not.toHaveTextContent('Ask me anything.');
  });

  it('closes the current message on hush()', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const handle = createRef<PixelPetHandle>();
    const { container } = render(<PixelPet petName="Danko" ref={handle} />);

    act(() => {
      handle.current?.say('Ask me anything.', { duration: Infinity });
    });
    act(() => {
      handle.current?.hush();
    });

    expect(getDialog(container)).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('wakes the pet up to speak', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { container, say, pet } = renderWithHandle();

    advance(1000);
    fireEvent.pointerMove(window);
    advance(120000);
    expect(pet).toHaveClass('pixel-pet-state-sleep');

    say('Wake up!');

    expect(pet).not.toHaveClass('pixel-pet-state-sleep');
    expect(getDialog(container)).toHaveTextContent('Wake up!');
  });

  it('stops walking while speaking', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValueOnce(0.05).mockReturnValue(0);
    const { container, say, pet } = renderWithHandle();
    const walker = container.querySelector<HTMLElement>('.pixel-pet-container');

    advance(500);
    say('Hold on.');
    const transformWhileSpeaking = walker?.style.transform;
    advance(2000);

    expect(pet).toHaveClass('pixel-pet-state-idle');
    expect(walker?.style.transform).toBe(transformWhileSpeaking);
  });

  it('is not interrupted by an automatic emotion', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { container, say } = renderWithHandle();

    advance(29000);
    say('Still talking.');
    advance(2000);

    expect(getDialog(container)).toHaveTextContent('Still talking.');
  });

  it('gives way to the user when they tap the pet', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { container, say, pet } = renderWithHandle();

    say('Hello there.');
    fireEvent.click(pet);

    expect(getDialog(container)).toHaveTextContent('Danko is feeling happy!');
  });
});

describe('PixelPet color', () => {
  const getRoot = (container: HTMLElement) => container.querySelector<HTMLElement>('.pixel-pet');

  const renderSpeaking = (props: Partial<React.ComponentProps<typeof PixelPet>> = {}) => {
    const handle = createRef<PixelPetHandle>();
    const view = render(<PixelPet petName="Danko" ref={handle} {...props} />);
    act(() => {
      handle.current?.say('Hello');
    });
    return { ...view, dialog: view.container.querySelector<HTMLElement>('.pixel-pet-dialog') };
  };

  it('exposes the color as a CSS variable on the pet', () => {
    const { container } = render(<PixelPet color="#8BE383" />);

    expect(getRoot(container)?.style.getPropertyValue('--pixel-pet-color')).toBe('#8BE383');
  });

  it('leaves the CSS variable unset without a color', () => {
    const { container } = render(<PixelPet />);

    expect(getRoot(container)?.style.getPropertyValue('--pixel-pet-color')).toBe('');
  });

  it('paints the pet name with the color', async () => {
    const user = userEvent.setup();
    const { container } = render(<PixelPet petName="Danko" color="#8BE383" />);

    await user.click(screen.getByRole('button', { name: 'Danko' }));

    const name = container.querySelector<HTMLElement>('.pixel-pet-highlight-pet');
    expect(getComputedStyle(name!).color).toBe('var(--pixel-pet-color, #FDDBA0)');
  });

  it('paints the border of a neutral speech bubble with the color', () => {
    const { dialog } = renderSpeaking({ color: '#8BE383' });

    expect(dialog?.style.border).toBe('1px solid var(--pixel-pet-color, #FDDBA0)');
  });

  it('lets dialogStyle override the color of a neutral speech bubble', () => {
    const { dialog } = renderSpeaking({ color: '#8BE383', dialogStyle: { borderColor: '#123456' } });

    expect(dialog?.style.border).toBe('1px solid rgb(18, 52, 86)');
  });
});

describe('PixelPet onClick', () => {
  it('calls onClick when the pet is clicked or activated with the keyboard', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<PixelPet petName="Danko" onClick={handleClick} />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    await user.click(pet);
    pet.focus();
    await user.keyboard('{Enter}');

    expect(handleClick).toHaveBeenCalledTimes(2);
    expect(handleClick.mock.calls[0][0].target).toBe(pet);
  });

  it('still reacts with its emotion after calling onClick', async () => {
    const user = userEvent.setup();
    const { container } = render(<PixelPet petName="Danko" onClick={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Danko' }));

    expect(container.querySelector('.pixel-pet-dialog')).toHaveTextContent('Danko is feeling happy!');
  });

  it('skips its own reaction when onClick prevents the default', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PixelPet petName="Danko" onClick={(event) => event.preventDefault()} />,
    );
    const pet = screen.getByRole('button', { name: 'Danko' });

    await user.click(pet);

    expect(container.querySelector('.pixel-pet-dialog')).not.toBeInTheDocument();
    expect(pet).not.toHaveClass('pixel-pet-state-happy');
  });
});

describe('PixelPet hover', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const showEmotion = () => {
    const handle = createRef<PixelPetHandle>();
    const view = render(<PixelPet petName="Danko" ref={handle} />);
    act(() => {
      handle.current?.emote('happy');
    });
    return { ...view, pet: screen.getByRole('button', { name: 'Danko' }) };
  };

  it.each(['mouse', 'pen'])('shows the message and holds the emotion while a %s hovers', (pointerType) => {
    const { container, pet } = showEmotion();

    fireEvent.pointerEnter(pet.parentElement!, { pointerType });
    act(() => {
      vi.advanceTimersByTime(20000);
    });

    expect(container.querySelector('.pixel-pet-dialog')).toHaveTextContent('Danko is feeling happy!');
    expect(pet).toHaveClass('pixel-pet-state-happy');
  });

  it('ignores touch, which has no hover', () => {
    const { container, pet } = showEmotion();

    fireEvent.pointerEnter(pet.parentElement!, { pointerType: 'touch' });

    expect(container.querySelector('.pixel-pet-dialog')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(pet).not.toHaveClass('pixel-pet-state-happy');
  });
});

describe('PixelPet click bubble', () => {
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

  const getDialog = (container: HTMLElement) => container.querySelector('.pixel-pet-dialog');

  it('hides the click bubble after three seconds while the pointer stays on the pet', () => {
    const { container } = render(<PixelPet petName="Danko" />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    clickWithMouse(pet);

    expect(getDialog(container)).toHaveTextContent('Danko is feeling happy!');

    advance(2900);

    expect(getDialog(container)).toBeInTheDocument();

    advance(100);

    expect(pet).toHaveClass('pixel-pet-state-happy');
    expect(getDialog(container)).not.toBeInTheDocument();
  });

  it('keeps automatic emotions silent after a mouse click until the pointer comes back', () => {
    const { container } = render(<PixelPet petName="Danko" />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    clickWithMouse(pet);
    advance(30000);

    expect(pet).toHaveFocus();
    expect(pet.className).toMatch(/pixel-pet-state-(happy|angry|curious)/);
    expect(getDialog(container)).not.toBeInTheDocument();

    fireEvent.pointerLeave(pet.parentElement!, { pointerType: 'mouse' });
    fireEvent.pointerEnter(pet.parentElement!, { pointerType: 'mouse' });

    expect(getDialog(container)).toBeInTheDocument();
  });
});

describe('PixelPet message markers', () => {
  const highlight = (container: HTMLElement, kind: string) =>
    [...container.querySelectorAll(`.pixel-pet-dialog .pixel-pet-highlight-${kind}`)].map(
      (element) => element.textContent,
    );

  it('replaces {name} and highlights **words** in custom emotion messages', () => {
    const { container } = render(
      <PixelPet petName="Bit" messages={{ happy: '{name} está **feliz**.' }} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Bit' }));

    expect(container.querySelector('.pixel-pet-dialog')).toHaveTextContent('Bit está feliz.');
    expect(highlight(container, 'pet')).toEqual(['Bit']);
    expect(highlight(container, 'happy')).toEqual(['feliz']);
  });

  it('uses the color of the emotion or of the pet for **words** in say()', () => {
    const handle = createRef<PixelPetHandle>();
    const { container } = render(<PixelPet petName="Bit" ref={handle} />);

    act(() => {
      handle.current?.say('Soy {name} y esto es **importante**.');
    });

    expect(container.querySelector('.pixel-pet-dialog')).toHaveTextContent('Soy Bit y esto es importante.');
    expect(highlight(container, 'pet')).toEqual(['Bit', 'importante']);

    act(() => {
      handle.current?.say('¿Qué es **eso**?', { emotion: 'curious' });
    });

    expect(highlight(container, 'curious')).toEqual(['eso']);
  });

  it('paints __words__ in the pet color for names filled in by a translation system', () => {
    const { container } = render(
      <PixelPet petName="Bit" messages={{ happy: '__Bit__ is **happy**.' }} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Bit' }));

    expect(container.querySelector('.pixel-pet-dialog')).toHaveTextContent('Bit is happy.');
    expect(highlight(container, 'pet')).toEqual(['Bit']);
    expect(highlight(container, 'happy')).toEqual(['happy']);
  });

  it('replaces {name} in the accessible label', () => {
    render(<PixelPet petName="Bit" label="{name}, la mascota" />);

    expect(screen.getByRole('button', { name: 'Bit, la mascota' })).toBeInTheDocument();
  });

  it('leaves text without markers and JSX messages untouched', () => {
    const handle = createRef<PixelPetHandle>();
    const { container } = render(<PixelPet petName="Bit" ref={handle} />);

    act(() => {
      handle.current?.say('2 * 3 = 6 {not a marker} snake_case_name');
    });

    expect(container.querySelector('.pixel-pet-dialog')).toHaveTextContent(
      '2 * 3 = 6 {not a marker} snake_case_name',
    );

    act(() => {
      handle.current?.say(<em>{'{name}'}</em>);
    });

    expect(container.querySelector('.pixel-pet-dialog em')).toHaveTextContent('{name}');
  });
});

describe('PixelPet showcase mode', () => {
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

  const getDialog = (container: HTMLElement) => container.querySelector('.pixel-pet-dialog');

  it('stays idle instead of walking', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    render(<PixelPet petName="Danko" mode="showcase" />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    advance(20000);

    expect(pet).toHaveClass('pixel-pet-state-idle');
  });

  it('shows no automatic emotions, even on hover', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { container } = render(<PixelPet petName="Danko" mode="showcase" />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    advance(30000);
    fireEvent.pointerEnter(pet.parentElement!, { pointerType: 'mouse' });

    expect(pet).toHaveClass('pixel-pet-state-idle');
    expect(getDialog(container)).not.toBeInTheDocument();
  });

  it('says its name on click while staying idle, then hides it after three seconds', () => {
    const { container } = render(<PixelPet petName="Danko" mode="showcase" />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    clickWithMouse(pet);

    expect(getDialog(container)).toHaveTextContent("Hi, I'm Danko!");
    expect(container.querySelector('.pixel-pet-dialog .pixel-pet-highlight-pet')).toHaveTextContent('Danko');
    expect(pet).toHaveClass('pixel-pet-state-idle');

    advance(2900);

    expect(getDialog(container)).toBeInTheDocument();

    advance(100);

    expect(getDialog(container)).not.toBeInTheDocument();
  });

  it('uses the greeting message passed in, for example in another language', () => {
    const { container } = render(
      <PixelPet petName="Danko" mode="showcase" messages={{ greeting: '¡Hola, soy {name}!' }} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Danko' }));

    expect(getDialog(container)).toHaveTextContent('¡Hola, soy Danko!');
  });

  it('does not get angry after many clicks', () => {
    const { container } = render(<PixelPet petName="Danko" mode="showcase" />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    for (let click = 0; click < 8; click += 1) fireEvent.click(pet);

    expect(pet).toHaveClass('pixel-pet-state-idle');
    expect(getDialog(container)).toHaveTextContent("Hi, I'm Danko!");
  });

  it('falls asleep after two minutes and wakes up to say its name', () => {
    const { container } = render(<PixelPet petName="Danko" mode="showcase" />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    advance(120000);

    expect(pet).toHaveClass('pixel-pet-state-sleep');

    fireEvent.click(pet);

    expect(pet).toHaveClass('pixel-pet-state-idle');
    expect(getDialog(container)).toHaveTextContent("Hi, I'm Danko!");
  });

  it('skips the greeting when onClick prevents the default', () => {
    const { container } = render(
      <PixelPet petName="Danko" mode="showcase" onClick={(event) => event.preventDefault()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Danko' }));

    expect(getDialog(container)).not.toBeInTheDocument();
  });
});

describe('PixelPet actions menu', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const makeActions = () => [
    { id: 'chat', label: 'Chat', onSelect: vi.fn() },
    { id: 'rest', label: 'Rest', onSelect: vi.fn() },
  ];

  const getDialog = (container: HTMLElement) => container.querySelector('.pixel-pet-dialog');

  it('keeps the 0.4.0 click reaction without actions or with an empty list', () => {
    const { container, rerender } = render(<PixelPet petName="Danko" />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    expect(pet).not.toHaveAttribute('aria-haspopup');
    fireEvent.click(pet);
    expect(getDialog(container)).toHaveTextContent('Danko is feeling happy!');

    rerender(<PixelPet petName="Danko" actions={[]} />);

    expect(pet).not.toHaveAttribute('aria-haspopup');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('ignores actions in showcase mode and keeps the greeting', () => {
    const { container } = render(<PixelPet petName="Danko" mode="showcase" actions={makeActions()} />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    fireEvent.click(pet);

    expect(pet).not.toHaveAttribute('aria-haspopup');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(getDialog(container)).toHaveTextContent("Hi, I'm Danko!");
  });

  it('opens a menu with one item per action on click, without an emotion', () => {
    const { container } = render(<PixelPet petName="Danko" actions={makeActions()} />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    expect(pet).toHaveAttribute('aria-haspopup', 'menu');
    expect(pet).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(pet);

    const menu = screen.getByRole('menu', { name: 'Danko actions' });
    expect(pet).toHaveAttribute('aria-expanded', 'true');
    expect(pet).toHaveAttribute('aria-controls', menu.id);
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Chat', 'Rest']);
    expect(pet).not.toHaveClass('pixel-pet-state-happy');
    expect(getDialog(container)).not.toBeInTheDocument();
  });

  it('calls onSelect, closes the menu, and gives the focus back to the pet', async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    actions[1].onSelect.mockImplementation(() => {
      expect(screen.getByRole('button', { name: 'Danko' })).toHaveFocus();
    });
    render(<PixelPet petName="Danko" actions={actions} />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    await user.click(pet);
    await user.click(screen.getByRole('menuitem', { name: 'Rest' }));

    expect(actions[1].onSelect).toHaveBeenCalledTimes(1);
    expect(actions[0].onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(pet).toHaveAttribute('aria-expanded', 'false');
    expect(pet).toHaveFocus();
  });

  it.each(['{Enter}', ' '])('opens with %s and moves the focus to the first item', async (key) => {
    const user = userEvent.setup();
    render(<PixelPet petName="Danko" actions={makeActions()} />);

    await user.tab();
    await user.keyboard(key);

    expect(screen.getByRole('menuitem', { name: 'Chat' })).toHaveFocus();
  });

  it('closes when the pet is clicked again', () => {
    render(<PixelPet petName="Danko" actions={makeActions()} />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    fireEvent.click(pet);
    fireEvent.click(pet);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('does not reopen by itself when the actions go away and come back', () => {
    const actions = makeActions();
    const { rerender } = render(<PixelPet petName="Danko" actions={actions} />);

    fireEvent.click(screen.getByRole('button', { name: 'Danko' }));
    rerender(<PixelPet petName="Danko" actions={[]} />);
    rerender(<PixelPet petName="Danko" actions={actions} />);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes with Escape and gives the focus back to the pet', async () => {
    const user = userEvent.setup();
    render(<PixelPet petName="Danko" actions={makeActions()} />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    await user.tab();
    await user.keyboard('{Enter}');
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(pet).toHaveFocus();
  });

  it('closes with the close button, which is not one of the items', async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    render(<PixelPet petName="Danko" actions={actions} />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    await user.click(pet);
    const closeButton = screen.getByRole('button', { name: 'Close menu' });

    expect(screen.getByRole('menu')).not.toContainElement(closeButton);

    await user.click(closeButton);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(actions.every((action) => action.onSelect.mock.calls.length === 0)).toBe(true);
    expect(pet).toHaveFocus();
  });

  it('closes on a click outside without selecting anything', async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    render(
      <>
        <PixelPet petName="Danko" actions={actions} />
        <p>Outside</p>
      </>,
    );

    await user.click(screen.getByRole('button', { name: 'Danko' }));
    await user.click(screen.getByText('Outside'));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(actions.every((action) => action.onSelect.mock.calls.length === 0)).toBe(true);
  });

  it('gives the focus back to the pet when the pet is clicked to close the menu', async () => {
    const user = userEvent.setup();
    render(<PixelPet petName="Danko" actions={makeActions()} />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    await user.tab();
    await user.keyboard('{Enter}');
    fireEvent.click(pet);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(pet).toHaveFocus();
  });

  it('gives the focus back to the pet when the actions go away while it is in the menu', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<PixelPet petName="Danko" actions={makeActions()} />);

    await user.tab();
    await user.keyboard('{Enter}');
    rerender(<PixelPet petName="Danko" actions={[]} />);

    expect(screen.getByRole('button', { name: 'Danko' })).toHaveFocus();
  });

  it('keeps Escape from reaching a dialog or page around the pet', async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn();
    render(
      <div onKeyDown={(event) => onKeyDown(event.key)}>
        <PixelPet petName="Danko" actions={makeActions()} />
      </div>,
    );

    await user.tab();
    await user.keyboard('{Enter}');
    await user.keyboard('{Escape}');

    expect(onKeyDown).not.toHaveBeenCalledWith('Escape');
  });

  it('stops listening for outside clicks once closed', () => {
    const removeListener = vi.spyOn(document, 'removeEventListener');
    render(<PixelPet petName="Danko" actions={makeActions()} />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    fireEvent.click(pet);
    fireEvent.click(pet);

    expect(removeListener).toHaveBeenCalledWith('pointerdown', expect.any(Function), true);
  });

  it('translates the close button with menuLabels', () => {
    render(<PixelPet petName="Bit" actions={makeActions()} menuLabels={{ close: 'Cerrar el menú de {name}' }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Bit' }));

    expect(screen.getByRole('button', { name: 'Cerrar el menú de Bit' })).toBeInTheDocument();
  });

  it('moves through the items with the arrow keys, Home, and End', async () => {
    const user = userEvent.setup();
    const actions = [...makeActions(), { id: 'theme', label: 'Theme', onSelect: vi.fn() }];
    render(<PixelPet petName="Danko" actions={actions} />);
    const item = (name: string) => screen.getByRole('menuitem', { name });

    await user.tab();
    await user.keyboard('{Enter}');
    expect(item('Chat')).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(item('Rest')).toHaveFocus();

    await user.keyboard('{End}');
    expect(item('Theme')).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(item('Chat')).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(item('Theme')).toHaveFocus();

    await user.keyboard('{Home}');
    expect(item('Chat')).toHaveFocus();

    await user.keyboard('{ArrowDown}{Enter}');
    expect(actions[1].onSelect).toHaveBeenCalledTimes(1);
  });

  it('keeps the items out of the tab order and closes on Tab', async () => {
    const user = userEvent.setup();
    render(<PixelPet petName="Danko" actions={makeActions()} />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    await user.tab();
    await user.keyboard('{Enter}');

    screen.getAllByRole('menuitem').forEach((item) => expect(item).toHaveAttribute('tabindex', '-1'));

    await user.tab();

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(pet).toHaveFocus();
  });

  it('opens from the pet with ArrowDown on the first item and ArrowUp on the last', async () => {
    const user = userEvent.setup();
    render(<PixelPet petName="Danko" actions={makeActions()} />);

    await user.tab();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Rest' })).toHaveFocus();

    await user.keyboard('{Escape}{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Chat' })).toHaveFocus();
  });

  it('leaves the arrow keys alone without actions', async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn();
    render(
      <div onKeyDown={(event) => onKeyDown(event.defaultPrevented)}>
        <PixelPet petName="Danko" />
      </div>,
    );

    await user.tab();
    await user.keyboard('{ArrowDown}');

    expect(onKeyDown).toHaveBeenCalledWith(false);
  });

  it('names the menu with menuLabels and replaces {name}', () => {
    render(<PixelPet petName="Bit" actions={makeActions()} menuLabels={{ menu: 'Acciones de {name}' }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Bit' }));

    expect(screen.getByRole('menu', { name: 'Acciones de Bit' })).toBeInTheDocument();
  });

  it('stays closed when onClick prevents the default', () => {
    render(
      <PixelPet petName="Danko" actions={makeActions()} onClick={(event) => event.preventDefault()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Danko' }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('uses the dialog style for the menu', () => {
    const { container } = render(
      <PixelPet petName="Danko" actions={makeActions()} dialogStyle={{ backgroundColor: '#123456' }} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Danko' }));

    expect(container.querySelector<HTMLElement>('.pixel-pet-menu')?.style.backgroundColor).toBe(
      'rgb(18, 52, 86)',
    );
  });

  it('keeps the menu inside the container like the dialog bubble', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.classList.contains('pixel-pet-menu') ? 180 : 60;
    });
    const { container } = render(<PixelPet petName="Danko" actions={makeActions()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Danko' }));
    const menu = container.querySelector<HTMLElement>('.pixel-pet-menu');

    expect(100 + parseFloat(menu?.style.left ?? '') + 180).toBe(196);
    expect(menu?.style.maxWidth).toBe('192px');
  });
});

describe('PixelPet while the actions menu is open', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const actions = [{ id: 'chat', label: 'Chat', onSelect: () => {} }];

  const advance = (ms: number) => {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  };

  const getPositionX = (container: HTMLElement) => {
    const walker = container.querySelector<HTMLElement>('.pixel-pet-container');
    return Number(walker?.style.transform.match(/translateX\((-?[\d.]+)px\)/)?.[1]);
  };

  it('stays idle in place, then walks again once the menu closes', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValueOnce(0.05).mockReturnValue(0);
    const { container } = render(<PixelPet petName="Danko" actions={actions} />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    advance(500);
    expect(pet).toHaveClass('pixel-pet-state-walk');

    fireEvent.click(pet);
    const openedAt = getPositionX(container);
    advance(2000);

    expect(pet).toHaveClass('pixel-pet-state-idle');
    expect(getPositionX(container)).toBe(openedAt);

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    advance(500);

    expect(pet).toHaveClass('pixel-pet-state-walk');
    expect(getPositionX(container)).not.toBe(openedAt);
  });

  it('skips automatic emotions while the menu is open', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    render(<PixelPet petName="Danko" actions={actions} />);
    const pet = screen.getByRole('button', { name: 'Danko' });

    fireEvent.click(pet);
    advance(30000);

    expect(pet).toHaveClass('pixel-pet-state-idle');
  });

  it('hides the speech bubble while the menu is open and shows it again after', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const handle = createRef<PixelPetHandle>();
    const { container } = render(<PixelPet petName="Danko" actions={actions} ref={handle} />);

    fireEvent.click(screen.getByRole('button', { name: 'Danko' }));
    act(() => {
      handle.current?.say('Hello', { duration: Infinity });
    });

    expect(container.querySelector('.pixel-pet-dialog')).not.toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });

    expect(container.querySelector('.pixel-pet-dialog')).toHaveTextContent('Hello');
  });
});

describe('PixelPet rest', () => {
  let notifyResize: ((width: number) => void) | undefined;

  class MockResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      notifyResize = (width) => {
        callback([{ contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver);
      };
    }

    observe() {}

    unobserve() {}

    disconnect() {}
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const advance = (ms: number) => {
    for (let elapsed = 0; elapsed < ms; elapsed += 100) {
      act(() => {
        vi.advanceTimersByTime(100);
      });
    }
  };

  const getPositionX = (container: HTMLElement) => {
    const walker = container.querySelector<HTMLElement>('.pixel-pet-container');
    return Number(walker?.style.transform.match(/translateX\((-?[\d.]+)px\)/)?.[1]);
  };

  const renderPet = (props: Partial<React.ComponentProps<typeof PixelPet>> = {}) => {
    const handle = createRef<PixelPetHandle>();
    const onRestingChange = vi.fn();
    const view = render(
      <PixelPet petName="Danko" ref={handle} onRestingChange={onRestingChange} {...props} />,
    );
    const pet = screen.getByRole('button', { name: 'Danko' });
    const rest = (at: 'left' | 'center' | 'right') => {
      act(() => {
        handle.current?.rest(at);
      });
    };
    return { ...view, handle, pet, rest, onRestingChange };
  };

  it('walks to the spot, falls asleep, and only then reports it', () => {
    const { container, pet, rest, onRestingChange } = renderPet();

    rest('right');

    expect(pet).toHaveClass('pixel-pet-state-walk');
    expect(pet).not.toHaveClass('pixel-pet-flip-x');

    advance(1000);

    expect(onRestingChange).not.toHaveBeenCalled();
    expect(getPositionX(container)).toBeGreaterThan(100);

    advance(3000);

    expect(pet).toHaveClass('pixel-pet-state-sleep');
    expect(getPositionX(container)).toBe(235);
    expect(onRestingChange).toHaveBeenCalledTimes(1);
    expect(onRestingChange).toHaveBeenCalledWith('right');
  });

  it.each([
    ['left', 0],
    ['center', 117.5],
  ] as const)('rests at the %s of its parent', (at, x) => {
    const { container, pet, rest } = renderPet();

    rest(at);
    advance(4000);

    expect(pet).toHaveClass('pixel-pet-state-sleep');
    expect(getPositionX(container)).toBe(x);
  });

  it('only wakes up with a direct click, not with other activity on the page', () => {
    const { pet, rest, onRestingChange } = renderPet();

    rest('left');
    advance(4000);
    onRestingChange.mockClear();

    fireEvent.pointerMove(window);
    fireEvent.wheel(window);
    fireEvent.keyDown(window, { key: 'Tab' });
    advance(200000);

    expect(pet).toHaveClass('pixel-pet-state-sleep');

    fireEvent.click(pet);

    expect(pet).not.toHaveClass('pixel-pet-state-sleep');
    expect(onRestingChange).toHaveBeenCalledTimes(1);
    expect(onRestingChange).toHaveBeenCalledWith(null);
  });

  it('cancels the trip without reporting anything when clicked on the way', () => {
    const { container, pet, rest, onRestingChange } = renderPet();

    rest('right');
    advance(1000);
    fireEvent.click(pet);
    const stoppedAt = getPositionX(container);
    advance(4000);

    expect(pet).not.toHaveClass('pixel-pet-state-sleep');
    expect(getPositionX(container)).toBe(stoppedAt);
    expect(onRestingChange).not.toHaveBeenCalled();
  });

  it('ignores rest() while resting or on the way', () => {
    const { container, rest, onRestingChange } = renderPet();

    rest('right');
    rest('left');
    advance(4000);

    expect(getPositionX(container)).toBe(235);
    expect(onRestingChange).toHaveBeenCalledTimes(1);
  });

  it('ignores say() while resting', () => {
    const { container, handle, rest } = renderPet();

    rest('right');
    act(() => {
      handle.current?.say('Hello');
    });

    expect(container.querySelector('.pixel-pet-dialog')).not.toBeInTheDocument();
  });

  it('appears asleep at the spot right away when it cannot walk', () => {
    const { container, pet, rest, onRestingChange } = renderPet({ walk: false });

    rest('right');

    expect(pet).toHaveClass('pixel-pet-state-sleep');
    expect(getPositionX(container)).toBe(235);
    expect(onRestingChange).toHaveBeenCalledWith('right');
  });

  it('stays at its edge when the parent changes width', () => {
    const { container, rest } = renderPet();

    rest('right');
    advance(4000);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(500);
    act(() => {
      notifyResize?.(500);
    });

    expect(getPositionX(container)).toBe(435);
  });

  it('keeps the menu closed for the arrow keys while resting or on the way', () => {
    const actions = [{ id: 'chat', label: 'Chat', onSelect: () => {} }];
    const { pet, rest } = renderPet({ actions });

    rest('right');
    fireEvent.keyDown(pet, { key: 'ArrowDown' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    advance(4000);
    fireEvent.keyDown(pet, { key: 'ArrowUp' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(pet).toHaveClass('pixel-pet-state-sleep');
  });

  it('finishes the trip at once when walking is turned off on the way', () => {
    const { container, pet, rest, rerender, handle, onRestingChange } = renderPet();

    rest('right');
    advance(500);
    rerender(<PixelPet petName="Danko" ref={handle} onRestingChange={onRestingChange} walk={false} />);

    expect(pet).toHaveClass('pixel-pet-state-sleep');
    expect(getPositionX(container)).toBe(235);
  });

  it('ignores rest() and resting in showcase mode', () => {
    const { pet, rest, onRestingChange } = renderPet({ mode: 'showcase', resting: 'right' });

    expect(pet).not.toHaveClass('pixel-pet-state-sleep');

    rest('left');

    expect(pet).toHaveClass('pixel-pet-state-idle');
    expect(onRestingChange).not.toHaveBeenCalled();
  });

  describe('when controlled with resting', () => {
    it('appears already asleep at the spot on the first render, without walking', () => {
      const { container, pet, onRestingChange } = renderPet({ resting: 'right' });

      expect(pet).toHaveClass('pixel-pet-state-sleep');
      expect(getPositionX(container)).toBe(235);
      expect(onRestingChange).not.toHaveBeenCalled();
    });

    it('asks to wake up on click but keeps sleeping until the prop changes', () => {
      const { pet, rerender, onRestingChange } = renderPet({ resting: 'right' });

      fireEvent.click(pet);

      expect(onRestingChange).toHaveBeenCalledWith(null);
      expect(pet).toHaveClass('pixel-pet-state-sleep');

      rerender(<PixelPet petName="Danko" resting={null} onRestingChange={onRestingChange} />);

      expect(pet).not.toHaveClass('pixel-pet-state-sleep');
    });

    it('reports the spot after rest() and sleeps once the prop follows, without walking again', () => {
      const { container, pet, rest, rerender, onRestingChange } = renderPet({ resting: null });

      rest('right');
      advance(4000);

      expect(onRestingChange).toHaveBeenCalledWith('right');
      expect(pet).not.toHaveClass('pixel-pet-state-sleep');

      rerender(<PixelPet petName="Danko" resting="right" onRestingChange={onRestingChange} />);

      expect(pet).toHaveClass('pixel-pet-state-sleep');
      expect(getPositionX(container)).toBe(235);
    });

    it('walks to the spot again after a canceled trip instead of jumping there', () => {
      const { container, pet, rest, rerender, handle, onRestingChange } = renderPet({ resting: null });
      const renderWith = (resting: 'left' | 'right' | null) =>
        rerender(<PixelPet petName="Danko" ref={handle} resting={resting} onRestingChange={onRestingChange} />);

      rest('right');
      advance(4000);
      renderWith('right');
      fireEvent.click(pet);
      renderWith(null);

      rest('left');
      advance(1000);
      fireEvent.click(pet);
      const stoppedAt = getPositionX(container);
      renderWith('right');

      expect(pet).toHaveClass('pixel-pet-state-walk');
      expect(getPositionX(container)).toBe(stoppedAt);
    });

    it('walks to a spot set later through the prop, without reporting it back', () => {
      const { container, pet, rerender, onRestingChange } = renderPet({ resting: null });

      rerender(<PixelPet petName="Danko" resting="left" onRestingChange={onRestingChange} />);

      expect(pet).toHaveClass('pixel-pet-state-walk');

      advance(4000);

      expect(pet).toHaveClass('pixel-pet-state-sleep');
      expect(getPositionX(container)).toBe(0);
      expect(onRestingChange).not.toHaveBeenCalled();
    });
  });
});

describe('PixelPet emote()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const renderPet = (props: Partial<React.ComponentProps<typeof PixelPet>> = {}) => {
    const handle = createRef<PixelPetHandle>();
    const view = render(<PixelPet petName="Danko" ref={handle} {...props} />);
    const emote = (emotion: 'happy' | 'angry' | 'curious') => {
      act(() => {
        handle.current?.emote(emotion);
      });
    };
    return { ...view, handle, emote, pet: screen.getByRole('button', { name: 'Danko' }) };
  };

  it('plays the emotion for five seconds and keeps its message for hover or focus', () => {
    const { container, emote, pet } = renderPet();

    emote('curious');

    expect(pet).toHaveClass('pixel-pet-state-curious');
    expect(container.querySelector('.pixel-pet-dialog')).not.toBeInTheDocument();

    focusWithKeyboard(pet);

    expect(container.querySelector('.pixel-pet-dialog')).toHaveTextContent('Danko is very curious');

    act(() => {
      pet.blur();
      vi.advanceTimersByTime(5000);
    });

    expect(pet).not.toHaveClass('pixel-pet-state-curious');
  });

  it('is ignored in showcase mode', () => {
    const { emote, pet } = renderPet({ mode: 'showcase' });

    emote('angry');

    expect(pet).toHaveClass('pixel-pet-state-idle');
  });

  it('is ignored while resting', () => {
    const { emote, handle, pet } = renderPet({ walk: false });

    act(() => {
      handle.current?.rest('left');
    });
    emote('happy');

    expect(pet).toHaveClass('pixel-pet-state-sleep');
  });
});
