# Zipline Rush — Menu 2 #49

Five-level W2 cable rider. Pure 120 Hz rules, shell-owned levels/intro/timing, shared hero animation, orbit camera, particles, combo, boss, stars, secrets, progress and local multiplayer. Default hero: Nami. Development preview only; backend registration disabled.

Down tucks, Up brakes, Jump releases, sideways steers/hops between adjacent cables, Power uses the hero ability. Release near the mat with 6–8 m/s for a centre landing. The card's three teaching beats precede crossing cables, moving rafts/gulls, lighthouse night, and Volt Eel's cable/spiral/plunge fight.

Run checks from `play50games-frontend`:

```
npx tsc --noEmit
npx vitest run src/arcade3d/games/zipline-rush
node src/arcade3d/games/zipline-rush/verify.cjs
```

The standalone verifier is for sandboxes where esbuild cannot load Vitest. It uses installed TypeScript plus Node assertions and the actual arcade store; it does not replace browser QA or the normal Vitest suite.

Score ceilings are `320 × spans + 500 + (boss ? 1250 : 0)`: four unique orbs at 30 and one unique landing at up to 100 per span; each can add at most 20 from capped combo. Five boss HP hits pay 250 each, clear pays 500 once. Secrets and powers pay no points. Bounds: **1460, 1780, 2100, 2420, 3990**. Duration floors follow the maximum cable parameter speed, including the fastest 18% optional route. Tests pin every row against meta and the disabled backend registration.

Full implementation, proof, asset provenance, verification evidence and presentation limitations: `.handoff/K-m2-zipline/HANDOFF.md` at repository root.
