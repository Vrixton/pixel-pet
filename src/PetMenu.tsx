import React, { CSSProperties, useEffect, useLayoutEffect, useRef } from 'react';

export interface PetMenuAction {
  id: string;
  label: string;
  onSelect: () => void;
}

export type PetMenuFocus = 'first' | 'last';

interface PetMenuProps {
  id: string;
  initialFocus: PetMenuFocus;
  label: string;
  closeLabel: string;
  actions: PetMenuAction[];
  style?: CSSProperties;
  onSelect: (action: PetMenuAction) => void;
  onClose: () => void;
  restoreFocus: () => void;
  ref?: React.Ref<HTMLDivElement>;
}

export const PetMenu = ({
  id,
  initialFocus,
  label,
  closeLabel,
  actions,
  style,
  onSelect,
  onClose,
  restoreFocus,
  ref,
}: PetMenuProps) => {
  const listRef = useRef<HTMLUListElement>(null);

  const getItems = () => [
    ...(listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []),
  ];

  useEffect(() => {
    const items = getItems();
    items[initialFocus === 'last' ? items.length - 1 : 0]?.focus();
  }, []);

  useLayoutEffect(() => {
    const menu = listRef.current?.parentElement;
    return () => {
      if (menu?.contains(document.activeElement)) restoreFocus();
    };
  }, []);

  const focusItem = (getIndex: (current: number, count: number) => number) => {
    const items = getItems();
    const current = items.indexOf(document.activeElement as HTMLElement);
    items[getIndex(current, items.length)]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'Escape':
        event.stopPropagation();
        onClose();
        break;
      case 'Tab':
        onClose();
        break;
      case 'ArrowDown':
        focusItem((current, count) => (current + 1) % count);
        break;
      case 'ArrowUp':
        focusItem((current, count) => (current <= 0 ? count - 1 : current - 1));
        break;
      case 'Home':
        focusItem(() => 0);
        break;
      case 'End':
        focusItem((_, count) => count - 1);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <div ref={ref} className="pixel-pet-menu" style={style} onKeyDown={handleKeyDown}>
      <button
        type="button"
        className="pixel-pet-menu-close"
        aria-label={closeLabel}
        tabIndex={-1}
        onClick={onClose}
      >
        <span aria-hidden="true">×</span>
      </button>
      <ul ref={listRef} id={id} role="menu" aria-label={label} className="pixel-pet-menu-list">
        {actions.map((action) => (
          <li key={action.id} role="none">
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="pixel-pet-menu-item"
              onClick={() => onSelect(action)}
            >
              {action.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
