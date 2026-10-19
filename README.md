# PixelPet

A pixel art pet for React: a cat, a dog, an axolotl, a parakeet, or a hamster. It walks along the bottom of its container, falls asleep when nobody's around, reacts to clicks, changes its mood over time, and can speak on demand.

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
| `duration` | `number` | `5000` | How long the message stays, in milliseconds. Pass `Infinity` to keep it until a new message replaces it, the user taps the pet, or the pet falls asleep. |

Call `pet.current?.hush()` to close the current message right away, for example when the user dismisses it.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `petName` | `string` | `'Static'` | The name shown in the mood messages. |
| `variant` | `'cat' \| 'dog' \| 'axolotl' \| 'parakeet' \| 'hamster'` | `'cat'` | Which of the bundled sprites to use. |
| `spriteSrc` | `string` | none | A URL for your own sprite sheet. It takes priority over `variant`. |
| `color` | `string` | `'#FDDBA0'` | The pet's main color, used for its name and for the border of neutral speech bubbles. |
| `label` | `string` | `petName` | The accessible name of the pet's button. |
| `walk` | `boolean` | `true` | Set it to `false` to keep the pet in place. |
| `messages` | `PetMessages` | English messages | Replaces the text shown for each emotion. |
| `dialogStyle` | `DialogStyleProps` | none | Styles for every bubble. |
| `emotionDialogStyles` | `Partial<Record<PetEmotion, DialogStyleProps>>` | none | Styles for the bubble of a single emotion. |
| `onClick` | `(event) => void` | none | Called when the user clicks or taps the pet. Call `event.preventDefault()` inside it to skip the pet's own reaction. |
| `ref` | `Ref<PixelPetHandle>` | none | Gives you the `say()` and `hush()` methods. |

## Reusing a configuration

`PixelPetProps` is exported, so you can keep a pet's settings in one typed object and spread it:

```tsx
import { PixelPet, type PixelPetProps } from '@vrixton/pixel-pet';

const danko: PixelPetProps = {
  petName: 'Danko',
  variant: 'dog',
  color: '#8BE383',
};

<PixelPet {...danko} />
<PixelPet {...danko} walk={false} />
```

## Translating the messages

Messages can be plain strings with two markers, so they fit in translation files as they are:

```tsx
<PixelPet
  petName="Danko"
  label="{name}, the pet"
  messages={{
    happy: '{name} está **feliz**.',
    angry: '{name} está **abrumado**.',
    curious: '{name} tiene mucha **curiosidad**.',
  }}
/>
```

`{name}` becomes the pet's name in its color, `__word__` shows any word in the pet's color, and `**word**` shows that word in the color of the emotion. If your translation system already fills in `{name}` itself, wrap it as `__{name}__`, so the pet receives `__Bit__` and still paints the name. The markers also work in `say()`: there, `**word**` takes the color of the requested emotion, or the pet's color when there is none. In `label`, which screen readers read aloud, only `{name}` is replaced. Any emotion you leave out keeps its English message.

Messages can also be any React node when you need more control. The highlight classes are `pixel-pet-highlight-pet`, `pixel-pet-highlight-happy`, `pixel-pet-highlight-angry`, and `pixel-pet-highlight-curious`.

## Styling the bubble

`dialogStyle` and `emotionDialogStyles` accept these fields:

| Field | Default |
| --- | --- |
| `backgroundColor` | Depends on the emotion |
| `textColor` | `'#ffffff'` |
| `borderColor` | Depends on the emotion |
| `borderWidth` | `'1px'` |
| `borderRadius` | `'0'` |
| `fontFamily` | `'monospace'` |

A field set in `emotionDialogStyles` wins over the same field in `dialogStyle`, which wins over the default. Messages from `say()` without an emotion use `dialogStyle`.

The `color` prop sets the `--pixel-pet-color` CSS variable on the pet. You can also set that variable from your own stylesheet on any element that contains the pet.

## Custom sprites

A sheet passed through `spriteSrc` has to follow the same layout as the bundled ones in [src/sprites](src/sprites): one row per animation, in the order idle, walk, happy, sleep, angry, and curious, with nine frames per row.

## How it behaves

The pet wanders on its own, sometimes walking and sometimes standing, and turns around at the edges of the container. Every 30 seconds it may switch to a random mood for 5 seconds; hovering over it or focusing it with the keyboard shows what it's feeling. Clicking it shows its last mood for three seconds, and clicking it more than five times in ten seconds makes it angry. After a click, the bubble stays hidden while the pointer rests on the pet; moving the pointer away and back shows it again. After two minutes without mouse, touch, keyboard, or scroll wheel activity on the page, it falls asleep, and any activity wakes it up.

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
