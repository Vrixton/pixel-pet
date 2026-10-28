import React, { CSSProperties, useEffect, useLayoutEffect, useRef } from 'react';

export interface PetMenuAction {
  id: string;
  label: string;
  onSelect: () => void;
}

interface PetMenuProps {
  id: string;
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

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, []);

  useLayoutEffect(() => {
    const menu = listRef.current?.parentElement;
    return () => {
      if (menu?.contains(document.activeElement)) restoreFocus();
    };
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
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
