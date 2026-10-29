# Changelog

All notable changes to `@vrixton/pixel-pet` are listed here, newest first. Dates are the day each version was published to npm.

## 0.6.2 (2026-10-29)

This is the first version on npm since 0.5.2, so it also ships everything listed under 0.6.1 and 0.6.0, which were prepared but never published.

### Added

- A `typecheck` script that checks the source and the tests with TypeScript. It runs before publishing and, together with the tests and the build, on every pull request and every push to `main`.

### Fixed

- Installing the package no longer requires Node.js 24. The `engines` field is gone, since the package runs wherever your React app runs.
- The trip target, the nearest edge, and the walking edges now come from the same container width, so they agree while the container is being resized.
- A sprite sheet that cannot be loaded now logs a warning with its path instead of failing silently.
- Measuring the sprite sheet again no longer moves the pet when the result differs only by rounding noise.

## 0.6.1 (not published)

### Security

- `spriteSrc` is escaped as a CSS string before it goes into the background `url()`. Before, a path could close the declaration and add its own CSS to the server-rendered HTML, and on the client a path with quotes made the sprite disappear.

### Fixed

- The walking position is rounded to whole physical pixels, so moving never changes how the sprite is drawn, including on screens with fractional scaling.
- The 30-second rest after a walk no longer leaves a timer running after the pet unmounts.

## 0.6.0 (not published)

### Added

- `rest('nearest')` sends the pet to whichever edge is closer, left or right. When both are almost as close, it keeps going the way it faces. `onRestingChange` receives the side it picked, and the method takes the new `RestCommand` type.

### Changed

- The walk eases in and out over about 200 ms, including when something interrupts it. At an edge, or to turn around toward a resting spot, the pet brakes, turns, and pauses before setting off.
- The feet follow the distance walked instead of a clock, with one stride every 52/60 of the rendered frame width, so they keep up at any speed.
- Trips longer than 120px speed up to last about three seconds, up to three times the walking speed for trips longer than 360px.
- The walking position snaps to the pixel grid of the sprite sheet.
- The walk frames are set by the script, and the `pixel-pet-walk` keyframes are gone. A stylesheet that overrode those keyframes no longer has any effect.

### Fixed

- The pet keeps walking after React's `<Activity>` hides and shows it, or after Fast Refresh.
- With no room to walk, the pet stands idle instead of walking in place.
- The speech bubble and the menu are placed again once the pet has stopped.
- A trip canceled just before arriving no longer puts the pet to sleep.

## 0.5.2 (2026-10-29)

Action labels accept the same `{name}`, `__word__`, and `**word**` markers as the messages.

## 0.5.1 (2026-10-29)

The resting pet is anchored with CSS, so it renders in place from the first paint, and the actions menu is styled with `--pixel-pet-menu-*` CSS variables.

## 0.5.0 (2026-10-29)

Adds the actions menu, `rest()` with the `resting` and `onRestingChange` props, and `emote()`; replaces the inactivity sleep with a short nap, shows the hover message only on fine pointers, and makes `variant="cat"` a tuxedo cat.

## 0.4.0 (2026-10-19)

Adds `mode="showcase"`, which only idles, sleeps, and greets on click.

## 0.3.0 (2026-10-19)

Messages passed to `say()` accept the `{name}` and `**word**` markers, the new `__word__` marker paints a word in the pet's color, and speech bubbles are darker with square corners.

## 0.2.1 (2026-10-19)

Hides the click bubble after three seconds and ignores focus that comes from the mouse.

## 0.2.0 (2026-10-19)

Adds `hush()` and the `onClick` prop, and keeps messages on screen when `say()` gets an infinite duration.

## 0.1.0 (2026-10-19)

First public release, with `say()` on the handle and the `petName`, `variant`, `spriteSrc`, `color`, `walk`, `messages`, `dialogStyle`, and `emotionDialogStyles` props.
