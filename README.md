# PixelPet

A pixel art cat for React. It walks, sleeps, reacts to clicks, and changes its mood over time.

It's being built for the handheld-console interface of [V-DEX](https://v-dex.vercel.app), where it will live inside the device's screen.

## Status

Work in progress. The component runs in the local playground, but it isn't published as a package yet, and its API may still change.

## Running the playground

You need Node.js 24 or later and pnpm.

```bash
pnpm install
pnpm playground
```

Then open the address that Vite prints in the terminal.

## Built with

React and TypeScript, with plain CSS for the animations. The playground runs on Vite, and the library is built with tsup.