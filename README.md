# PixelPet

A pixel art pet for React: a cat, a dog, an axolotl, a parakeet, or a hamster. It walks along the bottom of its container, dozes off when nobody's around, reacts to clicks, changes its mood over time, and can speak on demand. It can also open a menu of actions that your app decides, and rest in a corner until the user wakes it up.

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

The message shows right away, without hovering, and screen readers announce it. The pet wakes up if it was dozing and stands still while it talks. While it is [resting](#resting), `say()` is ignored. A new message replaces the current one, a click on the pet interrupts it, and hovering over the pet pauses the timer so the message can be read.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `emotion` | `'happy' \| 'angry' \| 'curious'` | none | Plays that emotion's animation and colors the bubble to match. Without it, the bubble is neutral. |
| `duration` | `number` | `5000` | How long the message stays, in milliseconds. Pass `Infinity` to keep it until a new message replaces it, the user taps the pet, or the pet falls asleep. |

Call `pet.current?.hush()` to close the current message right away, for example when the user dismisses it.

## Reacting with an emotion

`emote()` plays one of the pet's emotions so it can react to your app's own events, such as a form that was sent:

```tsx
pet.current?.emote('happy');
```

It works like the pet's own mood changes: the animation plays for five seconds, and its message shows on hover or keyboard focus. `emote()` is behavior and `say()` is speech, so use `say(message, { emotion })` when the user should read something right away. `emote()` is ignored in showcase mode and while the pet is resting.

## Actions menu

Pass `actions` to turn the pet into a menu button. Each action is one item, and the pet calls its `onSelect` when the user picks it. The pet never interprets an action's `id`: it is only the React key and your own identifier.

```tsx
const actions: PetMenuAction[] = [
  { id: 'chat', label: 'Chat with Danko', onSelect: openChat },
  { id: 'rest', label: 'Rest on the right', onSelect: () => pet.current?.rest('right') },
];

<PixelPet ref={pet} petName="Danko" actions={actions} />
```

A click, a tap, Enter, or Space opens the menu above the pet. When the pet is close to an edge, the menu shifts sideways to stay inside the container, the same way the speech bubble does. While the menu is open, the pet stands still in its idle animation and hides its bubble.

The menu closes when the user picks an action, clicks outside, presses Escape, or uses the close button in its corner. The focus then goes back to the pet, before `onSelect` runs, so an action that opens something else can move the focus there.

The menu follows the WAI-ARIA menu button pattern: the arrow keys move between the items, Home and End jump to the first and last ones, and Tab closes it. ArrowDown and ArrowUp on the pet open it on the first or the last item. Use `menuLabels` to name the menu and its close button in another language. Both accept `{name}`:

```tsx
<PixelPet
  petName="Danko"
  actions={actions}
  menuLabels={{ menu: 'Acciones de {name}', close: 'Cerrar el menú' }}
/>
```

With actions, a click only opens the menu: the pet shows no emotion, so it never looks upset about the action the user is about to pick. Opening the menu four times in five seconds makes it angry instead: the menu stays closed, the angry message explains why, and the pet ignores clicks for two seconds.

Without `actions`, with an empty list, or in showcase mode, a click behaves as it always did.

## Resting

`rest()` sends the pet to the left, the center, or the right of its container, where it falls asleep. It walks there first, or appears there right away when it can't walk.

```tsx
pet.current?.rest('right');
```

While resting, only a direct click on the pet wakes it up. Scrolling, moving the mouse, typing, `say()`, and `emote()` leave it alone. A click while it is still on its way cancels the trip. Calling `rest()` again while it is resting or on its way does nothing, and it is ignored in showcase mode.

`onRestingChange` tells you when the state changes: it receives the spot once the pet is really asleep there, and `null` when the user wakes it up. A trip that was canceled reports nothing.

To remember the state, for example across visits, pass `resting` and keep the value yourself. The pet doesn't store anything:

```tsx
const [resting, setResting] = useState<RestAt | null>(() => readRestingFromStorage());

<PixelPet
  ref={pet}
  petName="Danko"
  resting={resting}
  onRestingChange={(at) => {
    setResting(at);
    saveRestingToStorage(at);
  }}
/>
```

When `resting` already holds a spot on the first render, the pet appears asleep there without walking. Changing it later sends the pet there. With `resting`, the prop is the source of truth: a click reports `null` through `onRestingChange`, but the pet keeps sleeping until the prop changes. If you pass `resting` and ignore `onRestingChange`, the pet never wakes up.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `petName` | `string` | `'Minerva'` | The name shown in the mood messages. |
| `variant` | `'cat' \| 'dog' \| 'axolotl' \| 'parakeet' \| 'hamster'` | `'cat'` | Which of the bundled sprites to use. |
| `spriteSrc` | `string` | none | A URL for your own sprite sheet. It takes priority over `variant`. |
| `color` | `string` | `'#FDDBA0'` | The pet's main color, used for its name and for the border of neutral speech bubbles. |
| `label` | `string` | `petName` | The accessible name of the pet's button. |
| `mode` | `'live' \| 'showcase'` | `'live'` | Use `'showcase'` for a pet on display, such as in a pet picker: it only idles, falls asleep, and says its name when clicked. |
| `walk` | `boolean` | `true` | Set it to `false` to keep the pet in place. |
| `messages` | `PetMessages` | English messages | Replaces the text shown for each emotion and the showcase greeting. |
| `actions` | `PetMenuAction[]` | none | Turns a click into a menu with these actions. See [Actions menu](#actions-menu). Ignored in showcase mode. |
| `menuLabels` | `PetMenuLabels` | `'{name} actions'`, `'Close menu'` | The accessible names of the menu and its close button. |
| `resting` | `'left' \| 'center' \| 'right' \| null` | none | Controls where the pet is resting, or `null` when it is awake. See [Resting](#resting). |
| `onRestingChange` | `(at) => void` | none | Called with the spot once the pet falls asleep there, and with `null` when the user wakes it up. |
| `dialogStyle` | `DialogStyleProps` | none | Styles for every bubble. |
| `emotionDialogStyles` | `Partial<Record<PetEmotion, DialogStyleProps>>` | none | Styles for the bubble of a single emotion. |
| `onClick` | `(event) => void` | none | Called when the user clicks or taps the pet. Call `event.preventDefault()` inside it to skip the pet's own reaction, including opening the menu. |
| `ref` | `Ref<PixelPetHandle>` | none | Gives you the `say()`, `hush()`, `emote()`, and `rest()` methods. |

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
    greeting: '¡Hola, soy {name}!',
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

The pet wanders on its own, sometimes walking and sometimes standing, and turns around at the edges of the container. Every 30 seconds it may switch to a random mood for 5 seconds. Focusing it with the keyboard shows what it's feeling, and so does hovering over it with a mouse or a pen, which also holds the mood and keeps the pet in place until the pointer leaves, so the message can be read. Touch screens have no hover, so there the message only shows on a click. Without `actions`, clicking it shows its last mood for three seconds, and clicking it more than five times in ten seconds makes it angry. After a click, the bubble stays hidden while the pointer rests on the pet; moving the pointer away and back shows it again.

After two minutes without mouse, touch, keyboard, or scroll wheel activity on the page, it dozes off for a couple of seconds and wakes up by itself with a little start. It does it again every two minutes while the page stays quiet. It only stays asleep when you ask it to [rest](#resting), so a sleeping pet always means the same thing.

With `mode="showcase"`, the pet stays in place playing its idle animation, with no random moods and no bubble on hover. Clicking it shows `messages.greeting`, or "Hi, I'm {name}!" by default, for three seconds, without getting angry however many times it is clicked. It still falls asleep after two minutes without activity and wakes up with any activity, because a showcase pet can't rest, so its sleep can't be confused with resting. `say()` and `hush()` keep working.

The pet is a real button, so it can be reached with the keyboard, has a visible focus outline, and is announced with its name. With actions, it is announced as a menu button and its menu can be used entirely from the keyboard. When the user prefers reduced motion, it stays still, its animation pauses, and the bubble, the menu, and the start after a doze appear without motion.

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
