# Menu 2 HUD placement (`menu2/hud`)

`HudStack.module.css` places every Menu 2 game HUD's two top blocks, so the boss bar, its hint line
and the meters never overlap on any screen. A game keeps its own look (pills, banner, clock) in its
`Hud.module.css`; only the placement lives here.

```tsx
import stack from "@/arcade3d/menu2/hud/HudStack.module.css";

<div className={stack.left} data-arcade-safe-area="">…pills, meters, ComboMeter…</div>
<div className={stack.center} data-arcade-safe-area="">
   <div className={styles.banner}>…</div>         {/* always the first child */}
   <div className={styles.clock}>…</div>
   <div className={stack.boss}>
      <BossHealthBar … />
      <div className={stack.hint}>Flood the ring basin…</div>
   </div>
</div>
```

| Screen | Left column | Centre column |
|---|---|---|
| wide (> 720 px) | under the shell's chip row | centred at the top: banner, clock, boss bar, hint |
| narrow portrait (<= 720 px, phones) | capped at `--m2-left-col` (min(176 px, 44vw)) | a grid across the top: the banner centred over both columns, then the clock, the boss bar and its hint stacked in the right-hand column beside the left pills |
| short landscape (<= 460 px tall) | one row right of the level chip | one row left of Mute / Pause |

Both blocks stay inside the `env(safe-area-inset-*)` insets and carry `data-arcade-safe-area`, so
`useSafeArea` / `useFittedView` and the orbit camera see them. Rules for a new HUD row: put it in one
of the two blocks (never a third absolutely placed block at the top), a boss hint goes inside
`stack.boss`, and the banner stays the centre block's first child.

Used by sky-tower-jump, cloud-hopper, lava-pillar-jump, rooftop-roll-climb and flooded-ruins-escape.
