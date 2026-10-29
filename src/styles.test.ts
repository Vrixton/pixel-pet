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

  it.each([
    ['background-color', '--pixel-pet-menu-bg', '--_pixel-pet-dialog-bg'],
    ['color', '--pixel-pet-menu-fg', '--_pixel-pet-dialog-fg'],
    ['border-radius', '--pixel-pet-menu-radius', '--_pixel-pet-dialog-radius'],
    ['font-family', '--pixel-pet-menu-font', '--_pixel-pet-dialog-font'],
  ])('lets the menu variable win over dialogStyle for %s', (property, variable, fallback) => {
    const menuRule = componentStyles.match(/\.pixel-pet-menu\s*\{[^}]*\}/)?.[0] ?? '';

    expect(menuRule).toMatch(new RegExp(`${property}:\\s*var\\(${variable},\\s*var\\(${fallback},`));
  });

  it('lets the menu variables win over dialogStyle for the border', () => {
    const menuRule = componentStyles.match(/\.pixel-pet-menu\s*\{[^}]*\}/)?.[0] ?? '';

    expect(menuRule).toMatch(/border:\s*var\(--pixel-pet-menu-border-width,\s*var\(--_pixel-pet-dialog-border-width,/);
    expect(menuRule).toMatch(/var\(--pixel-pet-menu-border,\s*var\(--_pixel-pet-dialog-border,/);
  });

  it('exposes variables for the font size, the item hover, and the focus ring', () => {
    expect(componentStyles).toMatch(/font-size:\s*var\(--pixel-pet-menu-font-size,/);
    expect(componentStyles).toMatch(/background-color:\s*var\(--pixel-pet-menu-item-hover-bg,/);
    expect(componentStyles).toMatch(/outline:[^;]*var\(--pixel-pet-menu-focus,/);
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
