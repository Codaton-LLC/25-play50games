// The looks at the finish (finishLooks.ts): the arch fading for a runner who jumped over the line
// (the real rules), and the cheering runner's post-side arm kept out of the arch's leg (the real,
// meshopt-decoded runner and arch GLBs, the runner skinned on the CPU as the vertex shader does).
// README "Scene and camera".
import { beforeAll, describe, expect, it } from "vitest";
import { cheerPose, bodyLift, createPose, type HumanoidPose } from "@/arcade3d/core/rig";
import { rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { RUNNER_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { ASSETS } from "./assets";
import { ARCH_FADED, ARCH_FADE_PAST, POST_ARM_RAMP, POST_ARM_REACH, archOpacity, clearPostArm, postArmWeight } from "./finishLooks";
import { ARCH, COURSE, LINES, NONE, RUNNER, V_RUN, createRun, step, type ObstacleRun, type StepInput } from "./rules";

// ---------- the arch fade ----------

/** A run with every checkpoint taken, the runner grounded on the finish pad at (x, p) running forward at `speed`. */
function onFinishPad(x: number, p: number, speed: number): ObstacleRun {
   const run = createRun();
   const pad = COURSE.supports[COURSE.finish.support];
   const r = run.runner;
   run.checkpoint = COURSE.checkpoints.length - 1;
   run.simMs = 20000;
   run.remainder = 0;
   r.x = x;
   r.y = pad.top;
   r.z = -p;
   r.vx = 0;
   r.vz = -speed;
   r.state = "run";
   r.grounded = true;
   r.support = COURSE.finish.support;
   r.arcStart = run.simMs;
   r.arcY0 = pad.top;
   r.arcV = 0;
   r.coyoteFrom = NONE;
   r.carryX = 0;
   r.knockDir = 0;
   r.timerMs = 0;
   run.pressMs = NONE;
   run.groundY = pad.top;
   run.maxP = p;
   return run;
}

const FORWARD: StepInput = { moveX: 0, moveZ: -1, jumpPressed: false };
const JUMP: StepInput = { moveX: 0, moveZ: -1, jumpPressed: true };

/** Steps the run in Scene-sized frames (`frameMs`) until it ends; the first frame presses Jump when `jump`. Returns the finish p. */
function finishP(run: ObstacleRun, frameMs: number, jump: boolean): number {
   for (let k = 0; k < 2000 && run.ended === null; k++) step(run, frameMs, jump && k === 0 ? JUMP : FORWARD);
   expect(run.ended).toBe("win");
   return -run.runner.z;
}

describe("obstacle-race finish looks: the arch fades for a cheer behind it", () => {
   it("only through the result delay of a win that ended more than ARCH_FADE_PAST past the line", () => {
      const past = -(LINES.finish + ARCH_FADE_PAST + 0.01);
      expect(archOpacity("over", "win", past)).toBe(ARCH_FADED);
      expect(archOpacity("over", "win", -(LINES.finish + ARCH_FADE_PAST - 0.01))).toBe(1);
      expect(archOpacity("over", "win", -LINES.finish)).toBe(1);
      for (const phase of ["loading", "ready", "countdown", "playing", "paused"] as const) expect(archOpacity(phase, null, past)).toBe(1);
      for (const reason of ["lose", "timeup", "quit"] as const) expect(archOpacity("over", reason, past)).toBe(1);
      // faded, never gone: the arch stays the course's landmark
      expect(ARCH_FADED).toBeGreaterThanOrEqual(0.2);
      expect(ARCH_FADED).toBeLessThanOrEqual(0.5);
   });

   it("a walked finish stops on the line, under the banner: the arch stays solid", () => {
      for (const frameMs of [1000 / 60, 1000 / 30, 50]) {
         for (const x of [0, 2.5, -2.5]) {
            const run = onFinishPad(x, LINES.finish - 1.5, V_RUN);
            const p = finishP(run, frameMs, false);
            expect(p - LINES.finish, `walk x ${x} frame ${frameMs}`).toBeLessThan(0.05);
            expect(archOpacity("over", "win", run.runner.z)).toBe(1);
         }
      }
   });

   it("a full-speed jump over the line lands 1.5-4.1 m past it, behind the banner: the arch fades", () => {
      // take-off anywhere on the finish pad before the line (the beam ends at its start, 113.6)
      for (let at = COURSE.supports[COURSE.finish.support].minP; at < LINES.finish - 0.05; at += 0.1) {
         const run = onFinishPad(0, at, V_RUN);
         const p = finishP(run, 1000 / 60, true);
         expect(p - LINES.finish, `take-off ${at.toFixed(2)}`).toBeGreaterThan(1.5);
         expect(p - LINES.finish, `take-off ${at.toFixed(2)}`).toBeLessThan(4.1);
         expect(archOpacity("over", "win", run.runner.z)).toBe(ARCH_FADED);
      }
   });
});

// ---------- the cheering runner's arm by a post ----------

/**
 * The arch as drawn (assets.ts scale x stretch, its own frame: the line at z 0) as a solid: a point
 * is inside when the rays from it along +z and along -z each cross the surface an odd number of
 * times (the mesh is closed, checked below). Triangles are bucketed by their xy bounds.
 */
async function archSolid() {
   const glb = await readCharacterGlb(ASSETS.finishArch.url);
   const s = ASSETS.finishArch.scale ?? 1;
   const k = ASSETS.finishArch.stretch ?? [1, 1, 1];
   const pos = new Float32Array(glb.cloud.length);
   for (let i = 0; i < pos.length; i += 3) {
      pos[i] = glb.cloud[i] * s * k[0];
      pos[i + 1] = glb.cloud[i + 1] * s * k[1];
      pos[i + 2] = glb.cloud[i + 2] * s * k[2];
   }
   const idx = glb.indices;
   const CELL = 0.1;
   const grid = new Map<string, number[]>();
   for (let t = 0; t < idx.length; t += 3) {
      const xs = [pos[idx[t] * 3], pos[idx[t + 1] * 3], pos[idx[t + 2] * 3]];
      const ys = [pos[idx[t] * 3 + 1], pos[idx[t + 1] * 3 + 1], pos[idx[t + 2] * 3 + 1]];
      for (let i = Math.floor(Math.min(...xs) / CELL); i <= Math.floor(Math.max(...xs) / CELL); i++) {
         for (let j = Math.floor(Math.min(...ys) / CELL); j <= Math.floor(Math.max(...ys) / CELL); j++) {
            const key = `${i},${j}`;
            const list = grid.get(key);
            if (list) list.push(t);
            else grid.set(key, [t]);
         }
      }
   }
   // closed: every edge (vertices welded by position) shared by exactly two triangles
   const weld = new Map<string, number>();
   const id = (v: number) => {
      const key = `${pos[v * 3].toFixed(4)},${pos[v * 3 + 1].toFixed(4)},${pos[v * 3 + 2].toFixed(4)}`;
      if (!weld.has(key)) weld.set(key, weld.size);
      return weld.get(key)!;
   };
   const edges = new Map<string, number>();
   for (let t = 0; t < idx.length; t += 3) {
      for (let e = 0; e < 3; e++) {
         const a = id(idx[t + e]);
         const b = id(idx[t + ((e + 1) % 3)]);
         const key = a < b ? `${a}-${b}` : `${b}-${a}`;
         edges.set(key, (edges.get(key) ?? 0) + 1);
      }
   }
   const closed = [...edges.values()].every((n) => n === 2);

   const inside = (x: number, y: number, z: number): boolean => {
      const list = grid.get(`${Math.floor(x / CELL)},${Math.floor(y / CELL)}`);
      if (!list) return false;
      let above = 0;
      let below = 0;
      for (const t of list) {
         const a = idx[t] * 3;
         const b = idx[t + 1] * 3;
         const c = idx[t + 2] * 3;
         const d = (pos[b + 1] - pos[c + 1]) * (pos[a] - pos[c]) + (pos[c] - pos[b]) * (pos[a + 1] - pos[c + 1]);
         if (Math.abs(d) < 1e-12) continue;
         const l1 = ((pos[b + 1] - pos[c + 1]) * (x - pos[c]) + (pos[c] - pos[b]) * (y - pos[c + 1])) / d;
         const l2 = ((pos[c + 1] - pos[a + 1]) * (x - pos[c]) + (pos[a] - pos[c]) * (y - pos[c + 1])) / d;
         const l3 = 1 - l1 - l2;
         if (l1 < 0 || l2 < 0 || l3 < 0) continue;
         if (l1 * pos[a + 2] + l2 * pos[b + 2] + l3 * pos[c + 2] > z) above++;
         else below++;
      }
      return above % 2 === 1 && below % 2 === 1;
   };
   return { closed, inside };
}

/** Where a runner stopped by a post can stand at the finish, unfaded: on the post's circle, from level with it to 0.6 m past. */
const CONTACT = ARCH.postRadius + RUNNER.radius;
const HUG = ARCH.postX - CONTACT;
const SPOTS: Array<[number, number]> = [0, 0.2, 0.4, 0.6].flatMap((past) => {
   const x = ARCH.postX - Math.sqrt(CONTACT ** 2 - past ** 2);
   return [
      [x, -past],
      [-x, -past],
   ] as Array<[number, number]>;
});
/** Facing the camera (the cheer's end), facing down the course (the finish), and on the turn between. */
const YAWS = [Math.PI, 0, 0.75 * Math.PI, 0.5 * Math.PI];
const HOPS = [0, 0.16, 0.32];
/** The cheer's wave, sampled over one period (cheerPose waves at 9 rad/s). */
const WAVE = Array.from({ length: 8 }, (_, i) => (i / 8) * ((2 * Math.PI) / 9));
/** The forearm and the hand: everything this far over the shoulder (m) with the arms up. */
const ABOVE_SHOULDER = 0.2;

describe("obstacle-race finish looks: the cheer keeps its hands out of the arch's legs", () => {
   let runner: RiggedCharacter;
   let solid: Awaited<ReturnType<typeof archSolid>>;
   // the joints the Scene's bodyLift uses (Scene.tsx LEGS), the runner asset's committed landmarks
   const landmarks = RUNNER_LANDMARKS;
   const SCALE = ASSETS.runner.scale ?? 1;
   const shoulder = landmarks.shoulderY * SCALE;

   beforeAll(async () => {
      runner = await rigCharacter(ASSETS.runner);
      solid = await archSolid();
   });

   /**
    * The deepest the forearm and hand get into the arch (m inside the leg's 0.57 m surface round the
    * post's axis), over the wave and the hop, for a runner at (x, past-the-line dz) turned to yaw:
    * the Scene's transform (group at the runner, yaw, the GLB's half turn and scale, bodyLift).
    */
   function deepest(x: number, dz: number, yaw: number, pose: (p: HumanoidPose, t: number) => void): number {
      const p = createPose();
      const turn = yaw + Math.PI;
      const c = Math.cos(turn);
      const s = Math.sin(turn);
      let depth = 0;
      for (const t of WAVE) {
         pose(p, t);
         const lift = bodyLift(p, landmarks) * SCALE;
         const world = runner.posed(p, false);
         for (const hop of HOPS) {
            for (let i = 0; i < world.length; i += 3) {
               const lx = world[i] * SCALE;
               const lz = world[i + 2] * SCALE;
               const y = world[i + 1] * SCALE + lift;
               if (y - shoulder < ABOVE_SHOULDER) continue;
               const wx = x + lx * c + lz * s;
               const wz = dz - lx * s + lz * c;
               if (solid.inside(wx, y + hop, wz)) depth = Math.max(depth, 0.57 - Math.hypot(Math.abs(wx) - ARCH.postX, wz), 1e-3);
            }
         }
      }
      return depth;
   }

   const scratch = createPose();
   const cheer = (p: HumanoidPose, t: number) => cheerPose(t, p);
   const cheerClear = (x: number, dz: number, yaw: number) => (p: HumanoidPose, t: number) => clearPostArm(cheerPose(t, p), x, -LINES.finish + dz, yaw, t, 1, scratch);

   it("the arch mesh is a closed solid: the post's axis and the banner inside, the lane and the space in front outside", () => {
      expect(solid.closed).toBe(true);
      expect(solid.inside(ARCH.postX, 1, 0)).toBe(true);
      expect(solid.inside(-ARCH.postX, 1, 0)).toBe(true);
      expect(solid.inside(0, 2.5, 0)).toBe(true);
      expect(solid.inside(0, 1, 0)).toBe(false);
      expect(solid.inside(0, 2.5, 0.3)).toBe(false);
      expect(solid.inside(ARCH.postX, 1, 0.7)).toBe(false);
      expect(solid.inside(HUG + 0.15, 1, 0)).toBe(false);
   });

   it("without the re-aim the cheer's V puts the post-side hand deep in the leg (the look this fixes)", () => {
      expect(deepest(HUG, 0, Math.PI, cheer)).toBeGreaterThan(0.15);
      expect(deepest(-HUG, 0, 0, cheer)).toBeGreaterThan(0.15);
   });

   it("with it, no forearm or hand is inside the arch anywhere a runner stopped by a post finishes", () => {
      for (const [x, dz] of SPOTS) {
         for (const yaw of YAWS) expect(deepest(x, dz, yaw, cheerClear(x, dz, yaw)), `x ${x.toFixed(3)} dz ${dz} yaw ${yaw.toFixed(2)}`).toBe(0);
      }
   });

   it("re-aims only the arm on the post's side, only near a post, and leaves the cheer as it is elsewhere", () => {
      // stopped by the right post, facing the camera: the character's L (+1) points at it; facing down the course, its R
      expect(postArmWeight(1, HUG, -LINES.finish, Math.PI)).toBe(1);
      expect(postArmWeight(-1, HUG, -LINES.finish, Math.PI)).toBe(0);
      expect(postArmWeight(-1, HUG, -LINES.finish, 0)).toBe(1);
      expect(postArmWeight(1, HUG, -LINES.finish, 0)).toBe(0);
      expect(postArmWeight(-1, -HUG, -LINES.finish, Math.PI)).toBe(1);
      expect(postArmWeight(1, -HUG, -LINES.finish, Math.PI)).toBe(0);
      // a quarter turn: both arms along z, neither at a post level with the runner
      expect(postArmWeight(1, HUG, -LINES.finish, Math.PI / 2)).toBeLessThan(1e-9);
      expect(postArmWeight(-1, HUG, -LINES.finish, Math.PI / 2)).toBeLessThan(1e-9);
      // out of reach of both posts: the cheer untouched (and the V clear of the legs there)
      const far = ARCH.postX - POST_ARM_REACH;
      for (const x of [0, 1.5, far, -far]) {
         for (const yaw of YAWS) {
            expect(postArmWeight(1, x, -LINES.finish, yaw)).toBe(0);
            expect(postArmWeight(-1, x, -LINES.finish, yaw)).toBe(0);
            const a = cheerPose(0.3, createPose());
            const b = clearPostArm(cheerPose(0.3, createPose()), x, -LINES.finish, yaw, 0.3, 1, scratch);
            expect(Array.from(b.q)).toEqual(Array.from(a.q));
         }
         expect(deepest(x, 0, Math.PI, cheer), `V at x ${x}`).toBe(0);
      }
      // through the ramp, from out of reach to stopped by the post, nothing clips either
      for (let x = far; x <= HUG + 1e-9; x += 0.05) {
         for (const yaw of [Math.PI, 0]) expect(deepest(x, 0, yaw, cheerClear(x, 0, yaw)), `ramp x ${x.toFixed(2)} yaw ${yaw}`).toBe(0);
      }
      // where the ramp is complete (POST_ARM_RAMP inside the reach) the V would already clip
      expect(deepest(ARCH.postX - POST_ARM_REACH + POST_ARM_RAMP + 0.1, 0, Math.PI, cheer)).toBeGreaterThan(0);
   });
});
