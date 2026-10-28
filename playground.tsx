import React, { useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
  PixelPet,
  type PetMenuAction,
  type PetMode,
  type PetVariant,
  type PixelPetHandle,
  type RestAt,
} from './src/index';
import './src/styles.css';
import './playground/styles.css';

interface GardenPet {
  variant: PetVariant;
  species: string;
  spriteSrc?: string;
  name: string;
  color: string;
  mode: PetMode;
  hasActions?: boolean;
}

const PETS: GardenPet[] = [
  { variant: 'cat', species: 'Cat', name: 'Minerva', color: '#da4cab', mode: 'live', hasActions: true },
  { variant: 'dog', species: 'Dog', name: 'Danko', color: '#D9925A', mode: 'showcase' },
  { variant: 'axolotl', species: 'Axolotl', name: 'Momo', color: '#F07A9C', mode: 'showcase' },
  { variant: 'parakeet', species: 'Parakeet', name: 'Kiwi', color: '#B8A6F5', mode: 'showcase' },
  { variant: 'hamster', species: 'Hamster', name: 'Nugget', color: '#F2C14E', mode: 'live' },
];

const LIVE_PETS = PETS.filter((pet) => pet.mode === 'live');
const SHOWCASE_PETS = PETS.filter((pet) => pet.mode === 'showcase');

const Plot = ({ variant, species, name, color, hasActions }: GardenPet) => {
  const pet = useRef<PixelPetHandle>(null);
  const [resting, setResting] = useState<RestAt | null>(null);

  const actions: PetMenuAction[] = [
    { id: 'curious', label: 'Be curious', onSelect: () => pet.current?.emote('curious') },
    { id: 'rest-left', label: 'Rest on the left', onSelect: () => pet.current?.rest('left') },
    { id: 'rest-right', label: 'Rest on the right', onSelect: () => pet.current?.rest('right') },
  ];

  return (
    <section className="plot" aria-labelledby={`plot-${variant}`}>
      <div className="sign">
        <h2 id={`plot-${variant}`}>{species}</h2>
        <code>variant="{variant}"</code>
        {hasActions && <code>resting={resting ? `"${resting}"` : '{null}'}</code>}
        <button type="button" onClick={() => pet.current?.say("Hi, I'm {name}! Nice to **meet** you.")}>
          Say hi
        </button>
      </div>
      <div className="path">
        {hasActions ? (
          <PixelPet
            ref={pet}
            petName={name}
            variant={variant}
            color={color}
            actions={actions}
            resting={resting}
            onRestingChange={setResting}
          />
        ) : (
          <PixelPet ref={pet} petName={name} variant={variant} color={color} />
        )}
      </div>
    </section>
  );
};

const Showcase = () => (
  <section className="showcase" aria-labelledby="showcase-title">
    <div className="sign sign-wide">
      <h2 id="showcase-title">Showcase</h2>
      <code>mode="showcase"</code>
      <p>These pets only idle and sleep. Click one to hear its name.</p>
    </div>
    <div className="pads">
      {SHOWCASE_PETS.map(({ variant, name, color }) => (
        <figure key={variant} className="pad">
          <div className="pad-stage">
            <PixelPet petName={name} variant={variant} color={color} mode="showcase" />
          </div>
          <figcaption>{name}</figcaption>
        </figure>
      ))}
    </div>
  </section>
);

const App = () => (
  <main className="garden">
    <header className="title">
      <h1>PixelPet</h1>
      <p>Pixel art pets for React. Tap the cat to open its menu, or the hamster to see how it feels.</p>
      <code className="install">pnpm add @vrixton/pixel-pet</code>
    </header>
    {LIVE_PETS.map((pet) => (
      <Plot key={pet.variant} {...pet} />
    ))}
    <Showcase />
  </main>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
