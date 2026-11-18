# Menu 2 hero animation (`menu2/heroAnim`)

The five Color Roll Heroes (`menu2/heroModels.ts`: their own T-pose GLBs on the core auto-rig) get a
full animation set from one hook. Sky Tower Jump is the reference adoption (`games/sky-tower-jump/Hero.tsx`).

## The set

| State | What it looks like | Pose (`heroPoses.ts`) + body (`heroBody.ts`) |
|---|---|---|
| idle | breathing (chest and arms), a sway, looking left / right / back on a 7 s loop | `heroIdlePose`, `lookAround` |
| run | walk to sprint; **feet planted**: at a run each foot is down for `RUN_DUTY` (0.3) of the cycle and the hero flies between steps, so the stride is `heroStride` (walkStride / (2 x duty), about 5 strides a second at 6.5 m/s); a few cm of body `surge` keeps the planted foot exactly still | `heroRunPose`, `advanceHeroGait` |
| takeoff, rise, fall, land | push-off with the arms swung up; tuck towards the apex; legs reaching down, arms out; a landing crouch (feet flat, deeper on a hard landing) plus a squash spring | `takeoffPose`, `risePose`, `fallPose`, `landPose` |
| flip | Nami's double jump: a tight tuck and one forward somersault about the curled body's middle (0.5 s) | `flipPose`, `body.roll` |
| ball | the signature move: the body curls (`curlPose`) and shrinks into an armoured shell (`HeroBall`: eight shingled plates in the hero's colours round the roll axis, glowing seams) that closes round it; the ball rests on the floor and rolls with the travel speed (`speed / radius`), then unrolls the short way back to upright | `curlPose`, `body.ball/shell/spin` |
| dash | hard forward lean, arms swept back, stretched along the facing; a streak of glints in the hero colour (juice) | `dashPose`, `body.streak` |
| hurt | recoil (back and head thrown back, arms out), a head shake, tipped along the push with a hop | `hurtPose`, `body.tiltX/tiltZ/hop` |
| cheer | arms up waving, hops | `heroCheerPose`, `body.hop` |
| defeat | sinks into a slumped squat, head down, slow shake | `defeatPose` |

Priority (highest first): defeat > hurt > cheer > ball > dash > flip > takeoff > rise / fall > land > run / idle.
Every change cross-fades at the new state's own speed (`HERO_FADE`); the weights always sum to 1.

## API

```ts
import { AnimatedHero, createHeroMotion, useHeroAnimator } from "@/arcade3d/menu2/heroAnim";

const motion = useMemo(createHeroMotion, []);          // HeroMotion, one per hero
// in the game's simulation (useRunFrame) or any frame callback before FRAME_PRIORITY.pose:
motion.vx = hero.vx; motion.vy = hero.vy; motion.vz = hero.vz;   // m/s, world
motion.grounded = hero.grounded;
motion.power = dashing ? "dash" : shieldUp ? "shield" : null;      // HeroPowerKind | null
motion.rolling = onBouncePad || falling;                           // the ball-roll
motion.celebrating = won;  motion.defeated = out;
if (ev.jumped) motion.events.jumped = true;            // one-frame events: the animator clears them
if (ev.doubleJump) motion.events.airJumped = true;
if (ev.landed) { motion.events.landed = true; motion.events.landSpeed = fallSpeed; }
if (ev.hit) { motion.events.hurt = true; motion.events.hurtX = pushX; motion.events.hurtZ = pushZ; }

const animator = useHeroAnimator(heroId, motion, { topSpeed: V_RUN, jumpSpeed: V_JUMP, ballRadius: 0.5, yaw: Math.PI });
<group position={[x, y, z]}>                            {/* the hero's feet point; the animator turns it */}
   <AnimatedHero animator={animator} fallback={<MyStandIn />} />
</group>
```

- `useHeroAnimator(heroId, motion | ref, options?)` → `{ heroId, pose, state, body, fit, motion, dt }`. It runs
  at `FRAME_PRIORITY.pose` on the juice's visual dt inside a `<JuiceLayer>` (hit-stop slows it), else on the
  run's game time (pause-safe). It never feeds anything back into the rules.
- `<AnimatedHero animator fallback? effects? visible?>` draws `<HumanoidModel>` (the hero's own GLB, its sole
  shifted onto the feet point), the body groups and `HeroBall`; with `effects` (default) and a `<JuiceLayer>`
  it streams the dash streak and the power aura (shield / magnet / phase) in the hero's colours.
- Pure, allocation-free, tested: `heroAnimState.ts` (`createHeroAnimState`, `stepHeroAnimState`,
  `pickHeroState`, `HS`, `HERO_TIMING`), `heroAnimPose.ts` (`composeHeroPose`, `advanceHeroGait`),
  `heroPoses.ts` (every pose, `heroRunPose`, `heroStride`, `clearFloor`), `heroBody.ts` (`stepHeroBody`).
- Per-hero landmarks (`heroAnimLandmarks.ts`): `HERO_CURL` (the curled body's centre and 98 % radius, measured
  on each real GLB), `heroBallFit(id, radius)` (metres as drawn), `HERO_LOOK` (ball plate / dark / glow
  colours), `heroAccent(id)`.

Draw calls: the hero is 1 skinned mesh; the ball adds 2 while it shows (plates + seams).

## Adoption guide (per game)

1. Keep the game's `rules.ts` as is. Make one `HeroMotion` (`createHeroMotion`) and write it every frame from
   the run, after the simulation and before `FRAME_PRIORITY.pose` (sky-tower: a `useFrame` at
   `FRAME_PRIORITY.camera + 0.1`, `writeHeroMotion` in `Hero.tsx`, pure and tested). Turn the game's own events
   into the one-frame `motion.events` (each once).
2. Decide what `rolling` means in your game (bounce flights, a roll power, the intro drop, a fall), and map
   your powers to `power` (`"dash"` gives the dash streak; shield / magnet / phase give the aura).
3. Replace the old hero group with `<group position={feet}><AnimatedHero animator={useHeroAnimator(...)} /></group>`.
   Remove any tinting or rigid "roll" of the model and any `walkPose`/`gaitPhaseStep` drive: the animator
   does the stride (`heroStride`) and the turn. Pop-ins, shrinks and the blob shadow stay the game's.
4. Wrap the Scene in `<JuiceLayer>` (menu2/juice) so the animator runs on the visual clock and the streak /
   aura show.
5. Tests: a pure test of your motion writer (see `sky-tower-jump/hero.test.ts`). The meshes are already
   covered here (`heroAnim.glb.test.ts`).

## Tests

- `heroPoses.test.ts` (22): the run's time warp, heroStride, the planted foot under 3 mm of slide per step
  with the surge at 5 amounts, no step in height, every pose clear of the floor.
- `heroAnimState.test.ts` (18): transitions, priorities, events cleared once read, weights sum to 1 and fade,
  dt 0 frozen, no allocation; the blend on all five heroes' joints; the body (turn, ball, flip, squash, hurt,
  cheer, aura).
- `heroAnim.glb.test.ts` (15, three per hero on the real GLB): the committed curl re-measured (5 mm) and inside
  the shell; the run's planted sole still within 1.2 cm and nothing under the floor; a scripted run through
  every state with the mesh above the floor whenever grounded.
- `heroBall.test.ts` (5): the shell geometry per hero colour.

## Open

- In the air the curled / flipping body is not floor-checked (it turns about its middle; the tail tip can
  hang up to about 9 cm under the feet point mid-flip, high above any floor).
- The fallback (a game's stand-in) is drawn inside the same groups, so it is shifted back by the GLB's sole
  offset (about 0.33 m); only seen when the GLB fails.
- Linear blend skinning: the deepest curl and the defeat squat fold the thighs into the belly; the shell hides
  the curl, the squat is seen. Needs a visual check.
