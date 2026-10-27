// The animation set on each hero's real GLB (skinned on the CPU like the vertex shader does,
// core/rig/characterChecks.ts rigCharacter): the committed curl landmarks (HERO_CURL) re-measured,
// the curled body inside the shell, the run's planted foot held still at heroStride (with the
// surge), and every state of a scripted run kept above the floor.
import { beforeAll, describe, expect, it } from "vitest";
import { createPose } from "@/arcade3d/core/rig/poses";
import { rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { HERO_LANDMARKS, HERO_SCALE, M2_HERO_IDS, heroModelAsset } from "@/arcade3d/menu2/heroModels";
import { clearFloor, curlPose, heroRunPose, heroStride, legContact, runDuty } from "./heroPoses";
import { HERO_CURL, heroBallFit } from "./heroAnimLandmarks";
import { createHeroAnimState, createHeroMotion, heroStateName, stepHeroAnimState, type HeroMotion } from "./heroAnimState";
import { advanceHeroGait, composeHeroPose } from "./heroAnimPose";

for (const id of M2_HERO_IDS) {
   describe(`hero animation on m2Hero ${id}`, () => {
      const L = HERO_LANDMARKS[id];
      const S = HERO_SCALE[id];
      let hero: RiggedCharacter;
      beforeAll(async () => {
         hero = await rigCharacter(heroModelAsset(id));
      }, 60000);

      it("the curl: centre and 98 % radius as committed (within 5 mm), the curled body fits in the shell at its ball scale", () => {
         const world = hero.posed(clearFloor(curlPose(1, createPose()), L));
         const min = [Infinity, Infinity, Infinity];
         const max = [-Infinity, -Infinity, -Infinity];
         for (let i = 0; i < world.length; i++) {
            const a = i % 3;
            min[a] = Math.min(min[a], world[i]);
            max[a] = Math.max(max[a], world[i]);
         }
         const cx = (min[0] + max[0]) / 2;
         const cy = (min[1] + max[1]) / 2;
         const cz = (min[2] + max[2]) / 2;
         const d: number[] = [];
         for (let i = 0; i < world.length; i += 3) d.push(Math.hypot(world[i] - cx, world[i + 1] - cy, world[i + 2] - cz));
         d.sort((a, b) => a - b);
         const r98 = d[Math.floor(d.length * 0.98)];
         expect(Math.abs(cx)).toBeLessThan(0.01);
         expect(Math.abs(cy - HERO_CURL[id].centerY)).toBeLessThan(0.005);
         expect(Math.abs(cz - HERO_CURL[id].centerZ)).toBeLessThan(0.005);
         expect(Math.abs(r98 - HERO_CURL[id].radius)).toBeLessThan(0.005);
         // nothing of the curled body under the floor
         expect(min[1]).toBeGreaterThan(-0.005);
         // at the ball's body scale, 98 % of it is inside the shell
         const fit = heroBallFit(id);
         expect(r98 * S * fit.bodyScale).toBeLessThan(fit.radius * 0.93);
      });

      it("the run at heroStride: the planted sole holds still (with the surge) and no vertex dips under the floor", () => {
         const rest = hero.glb.cloud;
         // the left sole: below the ankle's blend, on the left (+x)
         const sole: number[] = [];
         for (let i = 0; i < rest.length / 3; i++) if (rest[i * 3 + 1] < L.ankleY - L.ankleBlend && rest[i * 3] > 0) sole.push(i);
         expect(sole.length).toBeGreaterThan(100);
         for (const amount of [0.6, 1]) {
            const pose = createPose();
            const extras = { surge: 0 };
            const stride = heroStride(amount, L);
            const duty = runDuty(amount);
            const N = 24;
            let zMin = Infinity;
            let zMax = -Infinity;
            let low = Infinity;
            // one stance of the left foot, sampled inside its planted window, plus a whole cycle for the floor
            for (let k = 0; k <= N; k++) {
               const theta = Math.PI / 2 + (k / N) * Math.PI * 2;
               heroRunPose(theta, amount, L, pose, extras);
               const world = hero.posed(pose);
               for (let i = 1; i < world.length; i += 3) low = Math.min(low, world[i]);
               if (legContact(theta, duty) < 0.999) continue;
               let z = 0;
               for (const i of sole) z += world[i * 3 + 2];
               z = z / sole.length + ((theta - Math.PI / 2) / (Math.PI * 2)) * stride + extras.surge;
               zMin = Math.min(zMin, z);
               zMax = Math.max(zMax, z);
            }
            expect((zMax - zMin) * S, `${id} amount ${amount}`).toBeLessThan(0.012);
            expect(low, `${id} amount ${amount}`).toBeGreaterThan(-0.008);
         }
      }, 60000);

      it("a scripted run through every state: every state is reached, and on the ground the mesh stays above the floor (within 8 mm)", () => {
         const s = createHeroAnimState();
         const m = createHeroMotion();
         const pose = createPose();
         const dt = 1 / 30;
         const steps: Array<[string, (m: HeroMotion) => void]> = [
            ["idle", () => {}],
            ["run", (x) => (x.vx = 6.5)],
            ["takeoff", (x) => {
               x.grounded = false;
               x.vy = 14;
               x.events.jumped = true;
            }],
            ["fall", (x) => (x.vy = -10)],
            ["flip", (x) => (x.events.airJumped = true)],
            ["ball", (x) => (x.rolling = true)],
            ["land", (x) => {
               x.rolling = false;
               x.grounded = true;
               x.vy = 0;
               x.vx = 0;
               x.events.landed = true;
               x.events.landSpeed = 20;
            }],
            ["dash", (x) => (x.power = "dash")],
            ["hurt", (x) => {
               x.power = null;
               x.events.hurt = true;
            }],
            ["cheer", (x) => (x.celebrating = true)],
            ["defeat", (x) => {
               x.celebrating = false;
               x.defeated = true;
            }],
         ];
         const seen = new Set<string>();
         for (const [, set] of steps) {
            set(m);
            for (let k = 0; k < 12; k++) {
               stepHeroAnimState(s, m, dt);
               advanceHeroGait(s, L, S, dt);
               composeHeroPose(s, L, pose);
               seen.add(heroStateName(s));
               // in the air the body turns about its middle (the flip, the ball): no floor there
               if (k % 3 || !m.grounded) continue;
               const world = hero.posed(pose);
               let low = Infinity;
               for (let i = 1; i < world.length; i += 3) low = Math.min(low, world[i]);
               expect(low, `${id} ${heroStateName(s)}`).toBeGreaterThan(-0.008);
            }
         }
         for (const name of ["idle", "run", "takeoff", "fall", "flip", "ball", "land", "dash", "hurt", "cheer", "defeat"]) expect(seen.has(name), name).toBe(true);
      }, 60000);
   });
}
