// A person, not a bot: heads for the frisbee's landing spot after a reaction delay (with a
// positional misjudgement), then presses Jump a human-timed beat before it lands. The rules must
// let that catch a frisbee on L3 and L5 (the honest bot chases the shadow and never does).
import { describe, expect, it } from "vitest";
import { createRng } from "@/arcade3d/core/math";
import { LEVELS } from "./levels";
import { createRun, idleInput, step, toyXZ, type DogInput } from "./rules";

const REACT_S = 0.3;
const MISJUDGE_M = 0.4;
const JUMP_LEAD_S = 0.25;
const JUMP_JITTER_S = 0.08;

function catchRate(id: 1 | 2 | 3 | 4 | 5, seeds: number): { thrown: number; caught: number; won: number } {
   const level = LEVELS[id];
   let thrown = 0;
   let caught = 0;
   let won = 0;
   for (let seed = 1; seed <= seeds; seed++) {
      const rng = createRng(seed * 977);
      const run = createRun(seed, level);
      const input: DogInput = idleInput();
      const dt = 1 / 60;
      let aim = { x: 0, z: 0 };
      let seen = -1;
      let jumpAt = 0;
      let jumped = false;
      const xz = { x: 0, z: 0 };
      for (let i = 0; i < level.durationMs / 1000 / dt && !run.over; i++) {
         input.jumpPressed = false;
         const th = run.active;
         const dog = run.dog;
         let gx = run.blanket.x;
         let gz = run.blanket.z;
         let hold = false;
         if (th && th.index !== seen && th.t === 0) {
            seen = th.index;
            if (th.kind === "frisbee") thrown++;
            aim = { x: th.lx + (rng() * 2 - 1) * MISJUDGE_M, z: th.lz + (rng() * 2 - 1) * MISJUDGE_M };
            jumpAt = th.flight - JUMP_LEAD_S + (rng() * 2 - 1) * JUMP_JITTER_S;
            jumped = false;
         }
         if (th && th.state !== "carried") {
            if (th.kind === "frisbee" && th.state === "flying") {
               gx = aim.x;
               gz = aim.z;
               if (th.t < REACT_S) hold = true;
               if (!jumped && th.t >= jumpAt) {
                  input.jumpPressed = true;
                  jumped = true;
               }
            } else {
               toyXZ(th, xz);
               gx = xz.x;
               gz = xz.z;
            }
         }
         const dx = gx - dog.x;
         const dz = gz - dog.z;
         const d = Math.hypot(dx, dz);
         const k = hold || d < 0.15 ? 0 : Math.min(1, d / 0.8);
         input.moveX = d > 1e-9 ? (dx / d) * k : 0;
         input.moveY = d > 1e-9 ? (dz / d) * k : 0;
         step(run, input, dt, level.durationMs - i * dt * 1000);
      }
      caught += run.caught;
      if (run.over === "win") won++;
   }
   return { thrown, caught, won };
}

describe("a person can catch a frisbee", () => {
   for (const [id, min] of [[3, 0.8], [5, 0.5]] as const) {
      it(`L${id}: reaction delay, misjudged landing spot, jump a beat early: at least ${min * 100} % caught`, () => {
         const r = catchRate(id, 40);
         console.log(`human L${id}`, JSON.stringify(r));
         expect(r.thrown).toBeGreaterThan(0);
         expect(r.caught / r.thrown).toBeGreaterThanOrEqual(min);
      }, 120_000);
   }
});
