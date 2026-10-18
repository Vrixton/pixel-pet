import { describe, expect, it } from 'vitest';

import componentStyles from './styles.css?raw';

describe('component stylesheet', () => {
  it('does not style global elements', () => {
    expect(componentStyles).not.toMatch(/(^|[\s,}])(html|body|:root)\s*[{,]/);
  });

  it('pauses the sprite and skips the dialog animation for reduced motion', () => {
    const reducedMotionBlock = componentStyles.slice(
      componentStyles.indexOf('@media (prefers-reduced-motion: reduce)'),
    );

    expect(componentStyles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(reducedMotionBlock).toMatch(/\.pixel-pet-sprite\s*\{[^}]*animation-play-state:\s*paused/);
    expect(reducedMotionBlock).toMatch(/\.pixel-pet-dialog\s*\{[^}]*animation:\s*none/);
  });
});
