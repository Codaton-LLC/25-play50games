# Menu 2 code-built props

Small, bevelled set pieces for Color Roll Heroes. Dimensions are metres. Import from this folder's `index.ts`; pure geometry builders can be measured without a canvas. New props share cached geometry, use matte/satin materials, and allocate nothing in animation callbacks. Place animated props inside a GameShell Scene (`useGameTime`); parent groups own placement, collision and gameplay.

| Prop | Size / orientation | API | Batches |
|---|---|---|---|
| ArchWall | 4 x 3 x 0.5; open doorway 1.6 x 2.3 | `color?`, `accent?` | 2 |
| ArchCorridor | Five 4 x 3 arches; 14.5 m floor length, 3.8 m floor width | `color?`, `accent?` | 2 |
| CheckpointPad | Pad 2 across x 0.25; beacon above | `color?`, `accent?` | 2 |
| Domino | 0.5 x 1 x 0.15 | `color?`, `accent?`, group props | 3 |
| Flipper | 1.6 x 0.28 x 0.44 | `color?`, `accent?`, group props | 3 |
| SweeperBar | 3 x 0.5 x 0.6 | `color?`, `accent?`, group props | 3 |
| RailJunction | 4 x 0.51 x 1.37 | `color?`, `accent?`, group props | 2 |
| SpikeBlock | 1 x 1.15 x 1, including spikes | `color?`, `accent?`, group props | 2 |
| GrapplePost | 1.24 across; total height 4.93 | `color?`, `accent?` | 2 |
| TrainingDisc | 0.5 x 0.5 x 0.08; XY face, Z spin axis, centred origin | `color?` jade, `glow? = 0` (0..1) | 2 |
| GreatGong | Frame 3.12 x 3 x 0.5; gong diameter 2.2, centre y=1.35 | `strike? = 0` (0..1 hit envelope), `glow? = 0` (0..1) | 3 |
| MirrorGate | 1.64 x 2.4 x ~0.3; clear frame aperture 1.22 x 2.19 | `active? = true`, `color? = "#ad65ff"` | 3 |

`TrainingDisc` is balanced on both faces and has no autonomous spin: animate the parent for throws. `GreatGong.strike` is caller-owned: set to 1 on hit, then decay to 0 with game time; it scales a maximum 0.075-radian swing and an emissive pulse. `MirrorGate` has an open U-shaped frame and a thin shaped iridescent mirror membrane recessed behind it. Its physical material uses scene environment lighting when available and a subtle pause-safe emissive shimmer otherwise; it does not render a reflection camera.

The gong uses separate batches for stone, moving bronze/ropes and its glowing ring. The gate uses separate metal, neon and physical-mirror materials. These intentional three-batch exceptions preserve movement and material quality. Shared geometry is retained for the module lifetime (`dispose={null}`); per-instance custom/animated materials are disposed on unmount. Geometry builders return caller-owned geometries; dispose those after use.

Tests: `npx vitest run src/arcade3d/menu2/props` (one worker recommended on low-memory machines).
