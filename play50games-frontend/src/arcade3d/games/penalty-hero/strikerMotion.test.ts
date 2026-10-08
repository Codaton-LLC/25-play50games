// The striker's motion (strikerMotion.ts) frame by frame through real runs (rules.ts step at 60 fps),
// drawn as Scene.tsx draws it (strikerFrame for the group, strikerPose eased by drawStrikerPose) and
// skinned on the real striker.glb: after each shot it walks back to its spot on planted feet (a boot
// on the grass stays put), it really steps, and nothing pops or sinks into the grass.
import { beforeAll, describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { BONE } from "@/arcade3d/core/rig/humanoid";
import { createPose } from "@/arcade3d/core/rig/poses";
import { rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { applyHumanoidPose } from "@/arcade3d/core/rig/skinning";
import { ASSETS } from "./assets";
import { RUNUP, STRIKER_ROOT, strikerPlacement } from "./layout";
import { HOLD_MS, createRun, step, type RunState } from "./rules";
import { createStrikerFrame, drawStrikerPose, returnEndMs, returnProgress, strikerFrame, strikerPose, type StrikerFrame } from "./strikerMotion";

interface Boot {
   x: number;
   z: number;
   /** its lowest vertex over the grass (m) */
   low: number;
}
interface Frame {
   phase: RunState["phase"];
   mode: StrikerFrame["mode"];
   shot: number;
   gx: number;
   gz: number;
   yaw: number;
   boots: [Boot, Boot];
   /** the drawn legs' largest turn (rad) */
   legTurn: number;
}

/** The legs' bones: the hips, the upper and lower legs, the feet. */
const LEG_BONES = [BONE.hips, BONE.upperLegL, BONE.lowerLegL, BONE.footL, BONE.upperLegR, BONE.lowerLegR, BONE.footR];
const PLANT = 0.01;
const RETURN = Math.hypot(RUNUP.x, RUNUP.z);

describe("penalty-hero striker's motion on striker.glb", () => {
   let striker: RiggedCharacter;
   const boots: [number[], number[]] = [[], []];
   beforeAll(async () => {
      striker = await rigCharacter(ASSETS.striker);
      // the boots: everything under the ankle's blend (0.155), each side's own
      const rest = striker.glb.cloud;
      for (let i = 0; i < rest.length / 3; i++) if (rest[i * 3 + 1] < 0.15) boots[rest[i * 3] > 0 ? 0 : 1].push(i);
   });

   /**
    * Plays a run at 60 fps, shooting (Space) once each aim has lasted `aims[shot]` ms, then the
    * result's delay (the scene on screen, the run no longer stepping); records every drawn frame.
    */
   function play(aims: number[], seed = 7): Frame[] {
      const run = createRun(seed);
      const frame = createStrikerFrame();
      const target = createPose();
      const scratch = createPose();
      const pose = createPose();
      const v = new Vector3();
      const dt = 1 / 60;
      const scale = ASSETS.striker.scale;
      const frames: Frame[] = [];
      let now = 0;
      let aimFor = 0;
      const draw = () => {
         strikerFrame(run, frame);
         drawStrikerPose(pose, target, strikerPose(run, frame, now, target, scratch), dt);
         applyHumanoidPose(striker.rig, pose, true);
         striker.rig.root.updateMatrixWorld(true);
         const turn = ASSETS.striker.rotationY + frame.yaw;
         const c = Math.cos(turn);
         const s = Math.sin(turn);
         const drawn = boots.map((list) => {
            let x = 0;
            let z = 0;
            let low = Infinity;
            for (const i of list) {
               striker.skin.applyBoneTransform(i, v.fromBufferAttribute(striker.position, i)).applyMatrix4(striker.skin.matrixWorld);
               x += v.x / list.length;
               z += v.z / list.length;
               low = Math.min(low, v.y * scale);
            }
            return { x: frame.x + scale * (x * c + z * s), z: frame.z + scale * (-x * s + z * c), low };
         }) as [Boot, Boot];
         let legTurn = 0;
         for (const bone of LEG_BONES) legTurn = Math.max(legTurn, 2 * Math.acos(Math.min(1, Math.abs(pose.q[bone * 4 + 3]))));
         frames.push({ phase: run.phase, mode: frame.mode, shot: run.shotsDone, gx: frame.x, gz: frame.z, yaw: frame.yaw, boots: drawn, legTurn });
      };
      for (let f = 0; f < 60 * 60 && !run.ended; f++) {
         const shoot = run.phase === "aim" && aimFor >= (aims[run.shotsDone] ?? 0);
         aimFor = run.phase === "aim" ? aimFor + dt * 1000 : 0;
         step(run, dt * 1000, { jumpPressed: shoot });
         now += dt;
         draw();
      }
      expect(run.ended).toBe("win");
      for (let f = 0; f < 48; f++) {
         now += dt;
         draw();
      }
      return frames;
   }

   /** Shot `shot`'s walk back: its hold, then the next aim while the striker still walks (after the last shot, the hold and the result's delay). */
   const walkBack = (shot: number) => (f: Frame) => (f.shot === shot && f.phase === "hold") || (f.shot === shot + 1 && f.phase === "aim" && f.mode === "return");

   /** Per boot: its travel (m) while it is on the grass (lowest vertex within 1 cm) in two frames running, over the frames `pick` keeps. */
   function plantedTravel(frames: Frame[], pick: (f: Frame) => boolean): [number, number] {
      const out: [number, number] = [0, 0];
      for (let i = 1; i < frames.length; i++) {
         const a = frames[i - 1];
         const b = frames[i];
         if (!pick(a) || !pick(b)) continue;
         for (const side of [0, 1] as const) {
            if (a.boots[side].low < PLANT && b.boots[side].low < PLANT) out[side] += Math.hypot(b.boots[side].x - a.boots[side].x, b.boots[side].z - a.boots[side].z);
         }
      }
      return out;
   }

   // full walks back (1.5 s aims), a shot 150 ms and one 0 ms into a walk back, and the last shot's
   const AIMS = [800, 1500, 150, 1500, 0, 1500, 1500, 1500, 1500, 1500];
   /** the shots whose walk back runs its whole way (the next aim lasts 1.5 s) */
   const FULL = [0, 2, 5];
   let frames: Frame[];
   beforeAll(() => {
      frames = play(AIMS);
   }, 60_000);

   it("its group walks back at an even pace: from the ball to its spot, never forwards, at most 1.4 m/s (the old slide peaked at 4 m/s)", () => {
      const place = { x: 0, z: 0, yaw: 0 };
      let last = returnProgress(0, false);
      expect(last).toBe(1);
      let peak = 0;
      for (let tau = 1; tau <= returnEndMs(false); tau++) {
         const e = returnProgress(tau, false);
         expect(e).toBeLessThanOrEqual(last);
         peak = Math.max(peak, (last - e) * RETURN * 1000);
         last = e;
      }
      expect(last).toBe(0);
      expect(peak).toBeLessThan(1.4);
      // after the last shot it stays at the ball
      expect(returnProgress(300, true)).toBe(1);
      expect(strikerPlacement(returnProgress(returnEndMs(false), false), place).x).toBeCloseTo(STRIKER_ROOT[0], 9);
   });

   it("walks back to its spot after each shot on planted feet: a boot on the grass travels less than 5 cm through the hold and on into the next aim (it slid 0.56 m), the group 0.72 m", () => {
      for (let shot = 0; shot < 10; shot++) {
         const pick = walkBack(shot);
         const [l, r] = plantedTravel(frames, pick);
         expect(l, `shot ${shot} left boot`).toBeLessThan(0.05);
         expect(r, `shot ${shot} right boot`).toBeLessThan(0.05);
         // the group's way back: the whole run-up when the next aim lasts, none after the last shot
         const kept = frames.filter(pick);
         const back = Math.hypot(kept[kept.length - 1].gx - kept[0].gx, kept[kept.length - 1].gz - kept[0].gz);
         if (shot === 9) expect(back, `shot ${shot}`).toBeLessThan(1e-6);
         else if (AIMS[shot + 1] >= 1500) expect(back, `shot ${shot}`).toBeCloseTo(RETURN, 3);
         else expect(back, `shot ${shot}`).toBeGreaterThan(0.05);
      }
   });

   it("steps back: in a full walk back each boot leaves the grass twice, by 5 cm or more (the kick leg's landing besides)", () => {
      for (const shot of FULL) {
         const kept = frames.filter(walkBack(shot));
         for (const side of [0, 1] as const) {
            let lifts = 0;
            let up = kept[0].boots[side].low > 0.05;
            for (const f of kept) {
               const now = f.boots[side].low > 0.05;
               if (now && !up) lifts++;
               up = now;
            }
            expect(lifts, `shot ${shot} side ${side}`).toBe(2);
         }
      }
   });

   it("ends where the idle stands: on the start spot, unturned, the legs straight (the idle's); after the last shot at the ball, its feet together", () => {
      for (const shot of FULL) {
         const next = frames.filter((f) => f.shot === shot + 1 && f.phase === "aim");
         const idle = next.filter((f) => f.mode === "idle");
         // the walk back is over inside the 1.5 s aim, 820 ms after the hold
         expect(idle.length).toBeGreaterThan(0);
         expect(Math.abs(next.length - idle.length - ((returnEndMs(false) - HOLD_MS) * 60) / 1000)).toBeLessThanOrEqual(1);
         const first = idle[0];
         expect(first.gx).toBeCloseTo(STRIKER_ROOT[0], 6);
         expect(first.gz).toBeCloseTo(STRIKER_ROOT[2], 6);
         expect(first.yaw).toBeCloseTo(0, 6);
         // the drawn legs, as the walk back left them, are the idle's (straight, unturned): no pop
         expect(first.legTurn).toBeLessThan(1e-3);
      }
      const last = frames[frames.length - 1];
      expect(last.mode).toBe("idle");
      expect(last.gx).toBeCloseTo(STRIKER_ROOT[0] + RUNUP.x, 6);
      expect(last.gz).toBeCloseTo(STRIKER_ROOT[2] + RUNUP.z, 6);
      expect(last.legTurn).toBeLessThan(1e-3);
   });

   it("never sinks or pops: through the whole run the boots stay above the grass, the group moves less than 4 cm a frame (a shot during the walk back runs up from where it stands) and outside the kick a boot less than 10 cm", () => {
      let lowest = Infinity;
      let group = 0;
      let boot = 0;
      let where = "";
      for (let i = 1; i < frames.length; i++) {
         const a = frames[i - 1];
         const b = frames[i];
         group = Math.max(group, Math.hypot(b.gx - a.gx, b.gz - a.gz));
         // the kick itself (the run-up and the follow-through) swings the boot fast
         const kick = (a.mode === "runup" || a.mode === "flight") && (b.mode === "runup" || b.mode === "flight");
         for (const side of [0, 1] as const) {
            lowest = Math.min(lowest, b.boots[side].low);
            const d = Math.hypot(b.boots[side].x - a.boots[side].x, b.boots[side].z - a.boots[side].z, b.boots[side].low - a.boots[side].low);
            if (!kick && d > boot) [boot, where] = [d, `${b.shot} ${a.phase}/${a.mode} -> ${b.phase}/${b.mode} side ${side}`];
         }
      }
      expect(lowest).toBeGreaterThan(-0.005);
      expect(group).toBeLessThan(0.04);
      expect(boot, where).toBeLessThan(0.1);
   });
});
