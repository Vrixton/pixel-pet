# PixelPet

A pixel art cat or dog for React. It walks along the bottom of its container, falls asleep when nobody's around, reacts to clicks, changes its mood over time, and can speak on demand.

It was built for the handheld-console interface of [V-DEX](https://v-dex.vercel.app), where it lives inside the device's screen.

## Installation

```bash
pnpm add @vrixton/pixel-pet
```

It needs React 19.

## Usage

Import the stylesheet once, for example in your root layout, and place the pet inside a positioned container:

```tsx
import '@vrixton/pixel-pet/styles.css';
import { PixelPet } from '@vrixton/pixel-pet';

export function Screen() {
  return (
    <div style={{ position: 'relative', height: 160 }}>
      <PixelPet petName="Danko" variant="dog" />
    </div>
  );
}
```

The pet fills its nearest positioned ancestor and walks along its bottom edge. Clicks pass through the empty area, so the pet never blocks the content underneath it. Its speech bubble rises about 120px above the bottom edge for a one-line message and grows upward when the text wraps, so give the container enough height or leave its overflow visible.

The component is already marked as a client component, so in Next.js you can render it straight from a server component.

## Making it speak

Pass a ref to get the `say()` method. The component that holds the ref uses hooks, so in Next.js it needs `'use client'`:

```tsx
'use client';

import { useRef } from 'react';
import { PixelPet, type PixelPetHandle } from '@vrixton/pixel-pet';

export function Screen() {
  const pet = useRef<PixelPetHandle>(null);

  return (
    <div style={{ position: 'relative', height: 160 }}>
      <PixelPet ref={pet} petName="Danko" variant="dog" />
      <button onClick={() => pet.current?.say('Press the center button.', { emotion: 'curious' })}>
        Ask Danko
      </button>
    </div>
  );
}
```

The message shows right away, without hovering, and screen readers announce it. The pet wakes up if it was asleep and stands still while it talks. A new message replaces the current one, a click on the pet interrupts it, and hovering over the pet pauses the timer so the message can be read.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `emotion` | `'happy' \| 'angry' \| 'curious'` | none | Plays that emotion's animation and colors the bubble to match. Without it, the bubble is neutral. |
| `duration` | `number` | `5000` | How long the message stays, in milliseconds. |

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `petName` | `string` | `'Static'` | The name shown in the mood messages. |
| `variant` | `'cat' \| 'dog'` | `'cat'` | Which of the bundled sprites to use. |
| `spriteSrc` | `string` | none | A URL for your own sprite sheet. It takes priority over `variant`. |
| `label` | `string` | `petName` | The accessible name of the pet's button. |
| `walk` | `boolean` | `true` | Set it to `false` to keep the pet in place. |
| `messages` | `PetMessages` | English messages | Replaces the text shown for each emotion. |
| `dialogStyle` | `DialogStyleProps` | none | Styles for every bubble. |
| `emotionDialogStyles` | `Partial<Record<PetEmotion, DialogStyleProps>>` | none | Styles for the bubble of a single emotion. |
| `ref` | `Ref<PixelPetHandle>` | none | Gives you the `say()` method. |

## Translating the messages

Each message accepts any React node, so you can translate it and keep the colored words:

```tsx
<PixelPet
  petName="Danko"
  messages={{
    happy: (
      <>
        <span className="pixel-pet-highlight-pet">Danko</span> está{' '}
        <span className="pixel-pet-highlight-happy">feliz</span>.
      </>
    ),
    angry: 'Danko está abrumado.',
    curious: 'Danko tiene mucha curiosidad.',
  }}
/>
```

The highlight classes are `pixel-pet-highlight-pet`, `pixel-pet-highlight-happy`, `pixel-pet-highlight-angry`, and `pixel-pet-highlight-curious`. Any emotion you leave out keeps its English message.

## Styling the bubble

`dialogStyle` and `emotionDialogStyles` accept these fields:

| Field | Default |
| --- | --- |
| `backgroundColor` | Depends on the emotion |
| `textColor` | `'#ffffff'` |
| `borderColor` | Depends on the emotion |
| `borderWidth` | `'1px'` |
| `borderRadius` | `'5px'` |
| `fontFamily` | `'monospace'` |

A field set in `emotionDialogStyles` wins over the same field in `dialogStyle`, which wins over the default. Messages from `say()` without an emotion use `dialogStyle`.

## Custom sprites

A sheet passed through `spriteSrc` has to follow the same layout as the bundled ones, [cat-sprite.png](src/sprites/cat-sprite.png) and [dog-sprite.png](src/sprites/dog-sprite.png): one row per animation, in the order idle, walk, happy, sleep, angry, and curious, with nine frames per row.

## How it behaves

The pet wanders on its own, sometimes walking and sometimes standing, and turns around at the edges of the container. Every 30 seconds it may switch to a random mood for 5 seconds; hovering over it or focusing it with the keyboard shows what it's feeling. Clicking it shows its last mood, and clicking it more than five times in ten seconds makes it angry. After two minutes without mouse, touch, keyboard, or scroll wheel activity on the page, it falls asleep, and any activity wakes it up.

The pet is a real button, so it can be reached with the keyboard, has a visible focus outline, and is announced with its name. When the user prefers reduced motion, it stays still, its animation pauses, and the bubble appears without its pop-in effect.

## Development

You need Node.js 24 or later and pnpm.

```bash
pnpm install
pnpm playground
pnpm test
pnpm build
```

`pnpm playground` opens a local demo with Vite, `pnpm test` runs the tests with Vitest, and `pnpm build` builds the package with tsup.

## License

[MIT](LICENSE)
