# Menu 2 juice (`menu2/juice`)

Particles, floating popups, camera kick and shake, hit-stop and squash/stretch for the Color Roll Heroes
games. Sky Tower Jump is the reference adoption (`games/sky-tower-jump/Scene.tsx`).

**Budget: at most 3 extra draw calls in total** (`JUICE_DRAW_CALLS`), 0 while nothing is alive:
1 additive "glow" InstancedMesh for every glint kind, 1 see-through "soft" InstancedMesh for dust, 1
instanced glyph mesh for every popup's every character (one canvas atlas). Pooled (384 glow + 96 soft
particles, 12 popups x 16 characters), no allocation per frame or per burst.

## API

```tsx
import { JuiceLayer, createJuiceEmitter, useJuice } from "@/arcade3d/menu2/juice";

<JuiceLayer>{/* the Scene */}</JuiceLayer>

const juice = useJuice();             // no-ops outside a JuiceLayer
juice.burst("pickup", orb, 14);                        // kinds: pickup, dust, trail, checkpoint, hit, aura
juice.burst("aura", chest, 14, { color: heroAccent(heroId) });   // options: color, vx/vy/vz (inherited), size
juice.stream("trail", hero, 60, emitter, { color });  // a steady stream, call every frame (emitter = createJuiceEmitter())
juice.popup(orb, "-0.4 s", { color: "#ffe08a", size: 0.06 });
juice.kick(0, -1, 0, 3);              // shove the camera along a direction (spring speed m/s); it springs back
juice.shake(0.3);                     // trauma 0..1
juice.hitStop(80);                    // ms, at most 140: the VISUAL clock dips, never the rules
juice.visualDt(); juice.timeScale();
```

- **Hit-stop is visual only.** The layer's clock is `useGameTime().delta x` the hit-stop scale; the hero
  animator, particles, popups and the camera kick run on it. A game's rules keep `useRunFrame`'s dt, so a
  run's time and score are identical with or without hit-stops (`juice.test.ts` "never touches the rules'
  dt"). Off (with the kick and shake) when the player prefers reduced motion.
- **Camera kick** is applied after every camera rig (`CameraRig` or a game's own follow camera) and taken off
  before the next frame's rigs, in last-on / first-off order with core FxLayer's shake. A game that wants the
  offset itself can use the pure `createCameraKick` / `kickCamera` / `stepCameraKick` (`offset` in world
  metres plus `shakeRight` / `shakeUp` along the camera).
- Pure helpers: `particles.ts` (`createJuicePool`, `emitJuice`, `stepJuice`, `JUICE_STYLES`), `popups.ts`
  (glyph layout, `popupLook`), `cameraKick.ts`, `hitStop.ts`, `squash.ts` (`createSpring` / `stepSpring` /
  `kickSpring`, `volumeScale`, `forwardStretch`, `airStretch`, `landSquash`, `popScale`).

## Adoption guide (per game)

1. Wrap the Scene's content in `<JuiceLayer>` (it must be inside the shell's Canvas; the Scene is).
2. Replace `useFx()` calls: `sparkle` -> `"pickup"`, `puff` (landing) -> `"dust"`, `confetti` (checkpoint,
   finish) -> `"checkpoint"`, `sparks` (hits, bounces) -> `"hit"`, `fx.score` -> `juice.popup`,
   `fx.shake` -> `juice.shake` (+ `juice.kick` for directional impacts). Do not mix with core `useFx` bursts,
   or each core kind adds its own draw call again.
3. Add hit-stops only on impacts (40-90 ms: a bounce, a checkpoint, a fall, a boss hit), never on pickups.
4. Popups are visual; a popup never adds score. Any new score source still goes into the level's maxScore
   proof.

## Tests

`juice.test.ts` (20): pools (pack, reuse, colours, flat dust, fountains, inherited velocity, per-kind gravity,
frozen at dt 0, no allocation), the steady emitter, popup layout / slots / look, the kick spring and shake
(decay, reduced motion, frozen at dt 0), hit-stop (dip, ease-out, cap, longer-wins, reduced motion, rules'
dt untouched), squash helpers (volume kept, stable spring, curves).

## Open

- The shader / canvas parts (`JuiceLayer.tsx`) are typed but not rendered in tests: they need the visual check.
- The popup font is the system UI font in a fixed-cell atlas (advances measured per glyph).
