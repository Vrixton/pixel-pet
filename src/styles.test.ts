import { describe, expect, it } from 'vitest';

import componentStyles from './styles.css?raw';

describe('component stylesheet', () => {
  it('does not style global elements', () => {
    expect(componentStyles).not.toMatch(/(^|[\s,}])(html|body|:root)\s*[{,]/);
  });

  it('prefixes every class and animation name with pixel-pet-', () => {
    const stylesWithoutUrls = componentStyles.replace(/url\([^)]*\)/g, '');
    const classNames = stylesWithoutUrls.match(/\.[a-z][\w-]*/gi) ?? [];
    const animationNames = [...componentStyles.matchAll(/@keyframes\s+([\w-]+)/g)].map(
      ([, name]) => name,
    );

    expect(classNames.length).toBeGreaterThan(0);
    expect(animationNames.length).toBeGreaterThan(0);
    expect(classNames.filter((name) => !/^\.pixel-pet(-|$)/.test(name))).toEqual([]);
    expect(animationNames.filter((name) => !name.startsWith('pixel-pet-'))).toEqual([]);
  });

  it('pauses the sprite and skips the dialog animation for reduced motion', () => {
    const reducedMotionBlock = componentStyles.slice(
      componentStyles.indexOf('@media (prefers-reduced-motion: reduce)'),
    );

    expect(componentStyles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(reducedMotionBlock).toMatch(/\.pixel-pet-sprite\s*\{[^}]*animation-play-state:\s*paused/);
    expect(reducedMotionBlock).toMatch(/\.pixel-pet-dialog\s*\{[^}]*animation:\s*none/);
  });

  it('skips the menu animation for reduced motion', () => {
    const reducedMotionBlock = componentStyles.slice(
      componentStyles.indexOf('@media (prefers-reduced-motion: reduce)'),
    );

    expect(reducedMotionBlock).toMatch(/\.pixel-pet-menu\s*\{[^}]*animation:\s*none/);
  });

  it('skips the startle hop for reduced motion', () => {
    const reducedMotionBlock = componentStyles.slice(
      componentStyles.indexOf('@media (prefers-reduced-motion: reduce)'),
    );

    expect(reducedMotionBlock).toMatch(/\.pixel-pet-startle\s*\{[^}]*animation:\s*none/);
  });
});
