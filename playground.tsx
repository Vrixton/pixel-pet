import React, { useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { PixelPet, type PetVariant, type PixelPetHandle } from './src/index';
import './src/styles.css';
import './playground/styles.css';

interface GardenPet {
  variant: PetVariant;
  species: string;
  spriteSrc?: string;
  name: string;
  color: string;
}

const PETS: GardenPet[] = [
  { variant: 'cat', species: 'Cat', name: 'Static', color: '#F8C38E' },
  { variant: 'dog', species: 'Dog', name: 'Danko', color: '#D9925A' },
  { variant: 'axolotl', species: 'Axolotl', name: 'Momo', color: '#F07A9C' },
  { variant: 'parakeet', species: 'Parakeet', name: 'Kiwi', color: '#B8A6F5' },
  { variant: 'hamster', species: 'Hamster', name: 'Nugget', color: '#F2C14E' },
];

const Plot = ({ variant, species, name, color }: GardenPet) => {
  const pet = useRef<PixelPetHandle>(null);

  return (
    <section className="plot" aria-labelledby={`plot-${variant}`}>
      <div className="sign">
        <h2 id={`plot-${variant}`}>{species}</h2>
        <code>variant="{variant}"</code>
        <button type="button" onClick={() => pet.current?.say("Hi, I'm {name}! Nice to **meet** you.")}>
          Say hi
        </button>
      </div>
      <div className="path">
        <PixelPet ref={pet} petName={name} variant={variant} color={color} />
      </div>
    </section>
  );
};

const App = () => (
  <main className="garden">
    <header className="title">
      <h1>PixelPet</h1>
      <p>Pixel art pets for React. Tap or click a pet to see how it feels.</p>
      <code className="install">pnpm add @vrixton/pixel-pet</code>
    </header>
    {PETS.map((pet) => (
      <Plot key={pet.variant} {...pet} />
    ))}
  </main>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
