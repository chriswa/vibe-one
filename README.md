# Vibe One

A 2D canvas game built with TypeScript and Vite, deployed to GitHub Pages.

**Play:** https://chriswa.github.io/vibe-one/

## Controls

| Action | Keyboard / mouse | Touch |
| --- | --- | --- |
| Turn | `A` / `D` or `←` / `→` | drag the left half — the ship turns toward your thumb |
| Thrust | `W` or `↑` | push the stick past ~30% deflection |
| Fire | `Space` or click | hold anywhere on the right half |
| Pause | `P` or `Esc` | ⏸ button, bottom right |
| Mute | `M` | 🔈 button, bottom right |

The touch stick is floating: it springs to wherever your thumb lands rather
than sitting in a fixed spot. Both thumbs work at once, so you can steer and
fire together. The UI switches to touch hints and on-screen buttons the first
time a touch pointer is seen, so a laptop with a touchscreen still gets the
keyboard layout until it is actually touched.

## Development

```sh
npm install
npm run dev        # dev server with hot reload
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build locally
npm run typecheck  # types only
```

There are no runtime dependencies — Vite and TypeScript are the whole toolchain,
and the build output is a single self-contained bundle. Graphics are drawn with
the Canvas 2D API and sound is synthesised with Web Audio, so there are no
asset files.

## Deployment

`.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages on
every push to `main` (and on manual dispatch). It needs Pages configured once,
by hand:

**Settings → Pages → Build and deployment → Source: GitHub Actions**

`.github/workflows/ci.yml` runs the same typecheck-and-build on pull requests
and on pushes to other branches, so breakage is caught before it reaches `main`.

`vite.config.ts` sets `base: './'`, which keeps asset URLs relative so the build
works both at a domain root and under the `/vibe-one/` project path.

## Layout

```
src/
  main.ts            wires the pieces together and starts the loop
  engine/
    canvas.ts        letterboxed fixed-size viewport, DPI scaling
    input.ts         keyboard + multi-pointer state, level- and edge-triggered
    loop.ts          fixed-timestep update, decoupled render
    audio.ts         procedural Web Audio sound effects
    math.ts          scalar helpers and wrap-aware distance
  game/
    constants.ts     world size and all gameplay tuning
    entities.ts      entity shapes, movement, collision tests
    render.ts        drawing primitives (neon strokes, wrapping, text)
    touch.ts         floating steering stick, fire zone, on-screen buttons
    game.ts          state machine, spawning, collisions, HUD
```

The simulation runs at a fixed 120 Hz regardless of display refresh rate, and
the world is a fixed 1280×720 that letterboxes into the window, so gameplay is
identical on every machine. Gameplay numbers live in `src/game/constants.ts`.
