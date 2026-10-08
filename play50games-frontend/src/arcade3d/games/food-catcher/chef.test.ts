// The auto-rig on the real chef (public/models/3d/food-catcher/chef.glb, the v2 chef of 2026-10-07):
// the measured CHEF_LANDMARKS match what the heuristics find, its poses keep the feet on the floor,
// the hands clear of the tunic and the bearded head and toque rigid, and the tunic's skirt hangs
// between the stepping legs (core/rig/characterChecks.ts); its scale keeps it 1.82 m tall. A new
// chef.glb must be re-measured. Then the game's own chef
// (poses.ts) on the same mesh: the catch's reach never swings the arms out through the T-pose, the
// dash's lean keeps the feet out of the floor, the walk's stride, cadence and facing, and on a slow
// drag the planted foot stays put. Last, the Scene stands the chef on the worktop's top face.
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { Quaternion, Vector3 } from "three";
import { BONE, contactStride, createPose, walkStride } from "@/arcade3d/core/rig";
import { describeCharacter, rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { bodyLift } from "@/arcade3d/core/rig/gait";
import { gaitSlide, meshFeet } from "@/arcade3d/core/rig/stanceSlide";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { ASSETS, CHEF_LANDMARKS } from "./assets";
import {
   CHEF_MAX_CADENCE,
   CHEF_RUN_SPEED,
   CHEF_SCALE,
   CHEF_TURN_SPEED,
   REACH_S,
   chefPose,
   chefRootRoll,
   createChefGait,
   stepChefGait,
   type ChefGait,
} from "./poses";
import { COUNTER, WORKTOP, WORKTOP_TOP_Y } from "./Primitives";
import { CHEF } from "./rules";

describe("food-catcher chef.glb", () => {
   describeCharacter("chef", {
      asset: ASSETS.chef,
      landmarks: CHEF_LANDMARKS,
      height: 1.869,
      reach: 0.95,
      estimate: {
         // the head joint on the collar (the beard hides the neck): 1.27 for the estimate's 1.359
         tolerance: { headY: 0.1 },
      },
      // the head joint on the collar: everything above its blend (the beard from just under the chin, the face, the toque) is rigid
      headFrom: 1.285,
      hipHalfWidth: 0.24,
      // the tunic's skirt: from its front hem to the crotch, in front of the thighs (their front is at about z 0.16)
      apron: { hemY: 0.545, topY: 0.623, frontZ: 0.18 },
   });

   it("its scale draws it 1.82 m tall, the ChefPrimitive's height (the GLB's 1.90 longest side is the arm span, not the height)", async () => {
      const glb = await readCharacterGlb(ASSETS.chef.url);
      let top = 0;
      let reach = 0;
      for (let i = 0; i < glb.cloud.length; i += 3) {
         top = Math.max(top, glb.cloud[i + 1]);
         reach = Math.max(reach, Math.abs(glb.cloud[i]));
      }
      expect(2 * reach).toBeGreaterThan(top);
      expect(top * (ASSETS.chef.scale ?? 1)).toBeCloseTo(1.82, 2);
   });
});

/** The chef's gait as Scene.tsx holds it at a steady state. */
function gaitAt(amount: number, phase: number, yaw: number, lean: number): ChefGait {
   return Object.assign(createChefGait(), { amount, phase, yaw, lean });
}

/** Runs stepChefGait at a constant speed long enough for the eased amount, yaw and lean to settle. */
function settle(v: number, dt = 1 / 60): ChefGait {
   const gait = createChefGait();
   for (let i = 0; i < 240; i++) stepChefGait(gait, v, dt);
   return gait;
}

describe("food-catcher chef (poses.ts) on chef.glb", () => {
   let chef: RiggedCharacter;
   beforeAll(async () => {
      chef = await rigCharacter(ASSETS.chef);
   });

   /** The hands' widest reach from the body's middle (|x| in the chef's own frame) and the lowest vertex once lifted. */
   function measure(world: Float32Array, lift: number): { hands: number; low: number } {
      const rest = chef.glb.cloud;
      let hands = 0;
      let low = Infinity;
      for (let i = 0; i < rest.length / 3; i++) {
         low = Math.min(low, world[i * 3 + 1] + lift);
         if (Math.abs(rest[i * 3]) > CHEF_LANDMARKS.wristX) hands = Math.max(hands, Math.abs(world[i * 3]));
      }
      return { hands, low };
   }

   it("the bare thighs below the tunic's hem follow their own leg only: no skirt weights there (the estimate's hem, 0.499, is where the close inner thighs touch)", () => {
      const index = chef.skin.geometry.getAttribute("skinIndex");
      const weight = chef.skin.geometry.getAttribute("skinWeight");
      const LEFT: number[] = [BONE.upperLegL, BONE.lowerLegL, BONE.footL];
      const RIGHT: number[] = [BONE.upperLegR, BONE.lowerLegR, BONE.footR];
      const rest = chef.glb.cloud;
      let thighs = 0;
      for (let i = 0; i < rest.length / 3; i++) {
         const x = rest[i * 3];
         const y = rest[i * 3 + 1];
         // the trousers between the knee and the tunic's front hem (0.543 in the mesh; the cloth fades in
         // over half a knee blend below hemY, from 0.519), away from the inner thighs' crotch blend
         if (y < 0.4 || y > 0.515 || Math.abs(x) < 0.06) continue;
         thighs++;
         const other = x > 0 ? RIGHT : LEFT;
         let share = 0;
         for (let k = 0; k < 4; k++) if (other.includes(index.getComponent(i, k))) share += weight.getComponent(i, k);
         expect(share, `vertex ${i} at (${x.toFixed(3)}, ${y.toFixed(3)})`).toBeLessThan(0.01);
      }
      expect(thighs).toBeGreaterThan(200);
   });

   const STILL = { amount: 0, yaw: 0, lean: 0 };
   const WALK = { amount: 0.5, yaw: Math.PI / 2, lean: 0.03 * 0.5 * CHEF_RUN_SPEED };
   const DASH = { amount: 1, yaw: -Math.PI / 2, lean: -0.03 * CHEF.maxSpeed };
   const PHASES = [0, 1.6, 3.1, 4.7];

   it("a catch reaches up and down again without swinging the arms out through the T-pose: the hands stay within 0.5 of the middle (the T reach is 0.95), still, walking or dashing", () => {
      const out = createPose();
      const scratch = createPose();
      for (const [name, base] of [
         ["still", STILL],
         ["walk", WALK],
         ["dash", DASH],
      ] as const) {
         for (const phase of base === STILL ? [0] : PHASES) {
            for (const t of base === STILL ? [0.3, 1.7] : [1]) {
               let top = 0;
               for (let s = 0; s <= 24; s++) {
                  const gait = gaitAt(base.amount, phase, base.yaw, base.lean);
                  chefPose(gait, t, (s / 24) * REACH_S, out, scratch);
                  const { hands } = measure(chef.posed(out, false), 0);
                  expect(hands, `${name} phase ${phase} t ${t} k ${s}/24`).toBeLessThan(0.5);
                  top = Math.max(top, hands);
               }
               // ...and the reach does go up: the hands come off the hanging arms' sides
               expect(top).toBeGreaterThan(0.3);
            }
         }
      }
   });

   it("at the reach's peak the forearms are up in front of the chest (the hands above the shoulders' height)", () => {
      const out = createPose();
      const scratch = createPose();
      chefPose(gaitAt(0, 0, 0, 0), 1, REACH_S / 2, out, scratch);
      const world = chef.posed(out, false);
      const rest = chef.glb.cloud;
      let handY = -Infinity;
      for (let i = 0; i < rest.length / 3; i++) if (Math.abs(rest[i * 3]) > CHEF_LANDMARKS.wristX) handY = Math.max(handY, world[i * 3 + 1]);
      expect(handY).toBeGreaterThan(CHEF_LANDMARKS.shoulderY);
   });

   it("dashing at 9 m/s (turned to face the way it runs, its spine leaning into the speed), walking and still: nothing below the floor once lifted", () => {
      const out = createPose();
      const scratch = createPose();
      for (const v of [9, -9, 3.75, 2.5, 0.6]) {
         const settled = settle(v);
         for (const phase of [0, 0.8, 1.6, 2.4, 3.1, 3.9, 4.7, 5.5]) {
            const gait = gaitAt(settled.amount, phase, settled.yaw, settled.lean);
            chefPose(gait, 1, -1, out, scratch);
            expect(gait.lift).toBeCloseTo(bodyLift(out, CHEF_LANDMARKS) * CHEF_SCALE, 9);
            const { low } = measure(chef.posed(out, false), bodyLift(out, CHEF_LANDMARKS));
            expect(low, `v ${v} phase ${phase}`).toBeGreaterThan(-0.005);
         }
      }
   });

   it("leans into the speed in the spine, never about the feet: the GLB's root roll is 0 (the stand-in keeps its own)", () => {
      const dash = settle(9);
      expect(dash.lean).toBeCloseTo(0.03 * 9, 3);
      expect(Math.abs(dash.yaw - Math.PI / 2)).toBeLessThan(0.01);
      expect(settle(-9).lean).toBeCloseTo(-0.03 * 9, 3);
      expect(chefRootRoll(9, true)).toBe(0);
      expect(chefRootRoll(9, false)).toBeCloseTo(-0.27, 9);
      // the spine's top tips towards the world's +x: forward when turned to face it, to its own left (+x) facing the camera
      const scratch = createPose();
      const up = (yaw: number, lean: number) => {
         const p = chefPose(gaitAt(1, 1, yaw, lean), 1, -1, createPose(), scratch);
         const o = BONE.spine * 4;
         return new Vector3(0, 1, 0).applyQuaternion(new Quaternion(p.q[o], p.q[o + 1], p.q[o + 2], p.q[o + 3]));
      };
      const forward = up(Math.PI / 2, 0.27).sub(up(Math.PI / 2, 0));
      expect(forward.z).toBeGreaterThan(0.2);
      expect(Math.abs(forward.x)).toBeLessThan(0.03);
      const side = up(0, 0.27).sub(up(0, 0));
      expect(side.x).toBeGreaterThan(0.2);
      expect(Math.abs(side.z)).toBeLessThan(0.03);
   });
});

describe("food-catcher chef gait (stepChefGait)", () => {
   const TAU = Math.PI * 2;
   let chefMesh: RiggedCharacter;
   beforeAll(async () => {
      chefMesh = await rigCharacter(ASSETS.chef);
   });
   /** The stride (m) the phase implies at a constant speed, and the strides a second. */
   function strideAt(v: number): { stride: number; cadence: number; gait: ChefGait } {
      const dt = 1 / 60;
      const gait = settle(v, dt);
      const before = gait.phase;
      stepChefGait(gait, v, dt);
      const step = (gait.phase - before + TAU) % TAU;
      return { stride: (v * dt * TAU) / step, cadence: step / TAU / dt, gait };
   }

   it("standing still the phase does not advance", () => {
      const gait = settle(0);
      const before = gait.phase;
      stepChefGait(gait, 0, 1 / 60);
      expect(gait.phase).toBe(before);
      expect(gait.amount).toBeLessThan(1e-6);
   });

   it("at every speed up to the 9 m/s dash the stride is the contact stride (the walk's own at a walk), so the planted foot stays put: the cadence cap never binds", () => {
      expect(CHEF_RUN_SPEED).toBe(5);
      let peak = 0;
      for (const v of [0.3, 0.6, 1.5, 2.5, 3.5, 4, 4.5, 5, 6, 7, 8, CHEF.maxSpeed]) {
         const { stride, cadence, gait } = strideAt(v);
         expect(stride, `v ${v}`).toBeCloseTo(contactStride(gait.amount, CHEF_LANDMARKS) * CHEF_SCALE, 6);
         if (v <= 2.5) expect(stride / (walkStride(gait.amount, CHEF_LANDMARKS) * CHEF_SCALE), `walk v ${v}`).toBeCloseTo(1, 2);
         peak = Math.max(peak, cadence);
      }
      // the most at the dash: 5.03 strides a second on the full run's 1.79 m contact stride
      expect(strideAt(CHEF.maxSpeed).cadence).toBeCloseTo(5.03, 1);
      expect(peak).toBeLessThan(CHEF_MAX_CADENCE);
      expect(CHEF_MAX_CADENCE).toBeLessThan(5.2);
   });

   it("the planted sole's net travel per stance is under 3 % of the body's from 0.5 m/s to the dash (the old cadence cap of 4 slid it 19 % at the dash; chef.glb's soles)", () => {
      const feet = meshFeet(chefMesh);
      for (const v of [0.5, 1, 2.5, 5, 7, CHEF.maxSpeed]) {
         const gait = createChefGait();
         const r = gaitSlide(CHEF_LANDMARKS, CHEF_SCALE, feet, (dt) => {
            stepChefGait(gait, v, dt);
            return { phase: gait.phase, amount: gait.amount, speed: v };
         });
         expect(r.stances, `v ${v}`).toBeGreaterThan(4);
         expect(r.net, `v ${v}`).toBeLessThan(0.03);
      }
      // the old gait at the dash: the same amount, the stride stretched to 9 / 4 m
      const old = { phase: 0, amount: 0 };
      const before = gaitSlide(CHEF_LANDMARKS, CHEF_SCALE, feet, (dt) => {
         old.amount += (1 - old.amount) * (1 - Math.exp(-12 * dt));
         old.phase += ((CHEF.maxSpeed * dt) / Math.max(walkStride(old.amount, CHEF_LANDMARKS) * CHEF_SCALE, CHEF.maxSpeed / 4)) * TAU;
         return { phase: old.phase, amount: old.amount, speed: CHEF.maxSpeed };
      });
      expect(before.net).toBeGreaterThan(0.15);
   });

   it("turns towards the way it runs by |v| / CHEF_TURN_SPEED of a quarter turn (all of it at and above 0.5 m/s), back to the camera when it stops, never flipping", () => {
      expect(CHEF_TURN_SPEED).toBe(0.5);
      expect(settle(CHEF_TURN_SPEED).yaw).toBeCloseTo(Math.PI / 2, 3);
      expect(settle(CHEF.maxSpeed).yaw).toBeCloseTo(Math.PI / 2, 3);
      expect(settle(-CHEF.maxSpeed).yaw).toBeCloseTo(-Math.PI / 2, 3);
      expect(settle(CHEF_TURN_SPEED * 0.5).yaw).toBeCloseTo(Math.PI / 4, 3);
      expect(settle(-CHEF_TURN_SPEED * 0.5).yaw).toBeCloseTo(-Math.PI / 4, 3);
      expect(settle(0).yaw).toBe(0);
      // stopping after a run turns it back to the camera
      const stop = settle(3);
      for (let i = 0; i < 240; i++) stepChefGait(stop, 0, 1 / 60);
      expect(stop.yaw).toBeCloseTo(0, 3);
      // continuous in the speed: a finger jittering around a slow drag moves the facing a little, never by a quarter
      for (let v = -1; v < 1; v += 0.01) expect(Math.abs(settle(v + 0.01).yaw - settle(v).yaw), `v ${v.toFixed(2)}`).toBeLessThan(0.04);
      // a frame's hitch in a 0.8 m/s drag (a short step, then a long one: 0.27 and 2.2 m/s, as a stalled
      // frame does in the headless playtest) leaves the facing side-on: it follows the eased speed
      const drag = settle(0.8);
      let worst = 0;
      for (const v of [0.27, 2.2, 0.8, 0.8, 0.8]) {
         stepChefGait(drag, v, 1 / 60);
         worst = Math.max(worst, Math.abs(drag.yaw - Math.PI / 2));
      }
      expect(worst).toBeLessThan(0.02);
   });
});

describe("food-catcher chef on a slow drag (stepChefGait + chefPose on chef.glb)", () => {
   let chef: RiggedCharacter;
   beforeAll(async () => {
      chef = await rigCharacter(ASSETS.chef);
   });

   /**
    * Drives the gait at a steady `v` (m/s) for a second, then for a second more skins the real mesh
    * every frame and follows the planted foot: the lower one (each sole over its own lowest, the right
    * sole sits 9 mm above the left in the mesh), its sole centroid on the floor plane as the Scene
    * draws it (turned by gait.yaw, scaled, carried along x). How far it travels while it stays the
    * planted one, over how far the body does: 0 = it stays put, 1 = it slides with the body.
    */
   function plantedSlip(v: number): number {
      const rest = chef.glb.cloud;
      let floor = Infinity;
      for (let i = 1; i < rest.length; i += 3) floor = Math.min(floor, rest[i]);
      const soles: [number[], number[]] = [[], []];
      for (let i = 0; i < rest.length / 3; i++) if (rest[i * 3 + 1] < floor + 0.035) soles[rest[i * 3] > 0 ? 0 : 1].push(i);
      const dt = 1 / 60;
      const gait = createChefGait();
      const out = createPose();
      const scratch = createPose();
      let x = 0;
      const frames: Array<{ x: number; feet: number[][] }> = [];
      for (let f = 0; f < 120; f++) {
         stepChefGait(gait, v, dt);
         x += v * dt;
         chefPose(gait, f * dt, -1, out, scratch);
         if (f < 60) continue;
         const world = chef.posed(out, false);
         const c = Math.cos(gait.yaw);
         const s = Math.sin(gait.yaw);
         frames.push({
            x,
            feet: soles.map((ids) => {
               let fx = 0;
               let fz = 0;
               let low = Infinity;
               for (const i of ids) {
                  fx += world[i * 3];
                  fz += world[i * 3 + 2];
                  low = Math.min(low, world[i * 3 + 1]);
               }
               fx /= ids.length;
               fz /= ids.length;
               return [x + (fx * c + fz * s) * CHEF_SCALE, (fz * c - fx * s) * CHEF_SCALE, low];
            }),
         });
      }
      const base = [0, 1].map((k) => Math.min(...frames.map((fr) => fr.feet[k][2])));
      const planted = (fr: { feet: number[][] }) => (fr.feet[0][2] - base[0] <= fr.feet[1][2] - base[1] ? 0 : 1);
      let slip = 0;
      let body = 0;
      for (let i = 1; i < frames.length; i++) {
         const a = frames[i - 1];
         const b = frames[i];
         body += Math.abs(b.x - a.x);
         const k = planted(b);
         if (planted(a) === k) slip += Math.hypot(b.feet[k][0] - a.feet[k][0], b.feet[k][1] - a.feet[k][1]);
      }
      return slip / body;
   }

   it("from 0.45 m/s the planted foot stays put (its slip under 0.3 of the body's travel; facing the camera below 1 m/s it slid 1.3 times as far), and at 0.3 m/s it slides under 0.8", () => {
      for (const v of [0.45, 0.65, 0.8, -0.65, 1.5]) expect(plantedSlip(v), `v ${v}`).toBeLessThan(0.3);
      expect(plantedSlip(0.3)).toBeLessThan(0.8);
   });
});

describe("food-catcher chef on the worktop (Primitives.tsx, Scene.tsx)", () => {
   it("the chef's root stands on the worktop's top face (y 0.05), so its soles are on the board and not 5 cm inside it", () => {
      // the counter box's top is the rules' floor (y 0); the worktop on it is sunk 1 cm into it, so
      // there is no gap under it and its top face never coincides with the counter's (no z-fighting)
      expect(COUNTER.y + COUNTER.h / 2).toBeCloseTo(0, 9);
      expect(WORKTOP.y - WORKTOP.h / 2).toBeCloseTo(-0.01, 9);
      expect(WORKTOP_TOP_Y).toBeCloseTo(0.05, 9);
      const scene = readFileSync(new URL("./Scene.tsx", import.meta.url), "utf8");
      expect(scene).toMatch(/<group ref=\{root\} position=\{\[0, WORKTOP_TOP_Y, CHEF_Z\]\} name="chef">/);
      // the GLB chef and its stand-in both hang under that root group (the rest of the Chef component)
      const at = scene.indexOf('name="chef">');
      const chef = scene.slice(at, scene.indexOf("});", at));
      expect(chef).toContain("<HumanoidModel");
      expect(chef).toContain("<ChefPrimitive />");
   });
});
