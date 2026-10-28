import React, { CSSProperties, useEffect, useRef } from 'react';

export interface PetMenuAction {
  id: string;
  label: string;
  onSelect: () => void;
}

interface PetMenuProps {
  id: string;
  label: string;
  actions: PetMenuAction[];
  style?: CSSProperties;
  onSelect: (action: PetMenuAction) => void;
  ref?: React.Ref<HTMLDivElement>;
}

export const PetMenu = ({ id, label, actions, style, onSelect, ref }: PetMenuProps) => {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, []);

  return (
    <div ref={ref} className="pixel-pet-menu" style={style}>
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
