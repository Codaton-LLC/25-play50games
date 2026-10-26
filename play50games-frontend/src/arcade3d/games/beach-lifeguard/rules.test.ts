import { describe, expect, it } from "vitest";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import {
   CARRY_FACTOR,
   GRAB_RANGE,
   JET_SKI_DOCK,
   JET_SKI_SPEED,
   LIVES,
   MOUNT_RANGE,
   PROPOSED_LEVEL_LIMITS,
   RADIUS,
   RESCUE_BASE_POINTS,
   RESCUE_CLOCK_BONUS,
   SAFE_SAND_Z,
   SAND_DEPTH,
   SPEED_SAND,
   START_X,
   START_Z,
   SWIMMER_SPACING_X,
   SWIM_Z_MAX,
   TIME_BONUS_PER_SECOND,
   TOWER,
   TOWER_LANE,
   WATER_FACTOR,
   createRun,
   nextSwimmer,
   objectiveCeiling,
   propTarget,
   step,
   stepZ,
   syncStore,
   type BeachInput,
   type Run,
} from "./rules";

const still = (): BeachInput => ({ moveX: 0, moveY: 0, actionPressed: false, yaw: 0 });
const DT = 1 / 60;

/** Put the hero at (x, z) next to the active swimmer, carrying or not. */
function at(run: Run, x: number, z: number): Run {
   run.hero.x = x;
   run.hero.z = z;
   return run;
}

describe("beach-lifeguard rules: determinism and the generator", () => {
   it("the same seed, level and inputs give the same run", () => {
      for (const id of LEVEL_IDS) {
         const a = createRun(77, LEVELS[id], id);
         const b = createRun(77, LEVELS[id], id);
         expect(a).toEqual(b);
         const input: BeachInput = { moveX: 0.4, moveY: -1, actionPressed: false, yaw: 0 };
         for (let i = 0; i < 300; i++) {
            input.actionPressed = i % 37 === 0;
            step(a, input, DT, 100_000);
            step(b, input, DT, 100_000);
         }
         expect(a).toEqual(b);
      }
   });

   it("every level reads its own width, swim depth, rescues and alert clock (200 seeds)", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         for (let seed = 1; seed <= 200; seed++) {
            const run = createRun(seed, level, id);
            expect(run.level).toBe(level);
            expect(run.levelId).toBe(id);
            expect(run.alertTime).toBe(level.alertS);
            expect(run.swimmers).toHaveLength(level.rescues);
            for (const s of run.swimmers) {
               expect(s.z).toBeGreaterThanOrEqual(-level.water + 2 - 1e-9);
               expect(s.z).toBeLessThanOrEqual(SWIM_Z_MAX + 1e-9);
               expect(Math.abs(s.x)).toBeLessThanOrEqual(level.width / 2 - 3 + 1e-9);
               expect(Math.abs(s.x)).toBeGreaterThanOrEqual(TOWER_LANE - 1e-9);
               for (const o of run.swimmers) if (o !== s) expect(Math.abs(o.x - s.x)).toBeGreaterThanOrEqual(SWIMMER_SPACING_X - 1e-9);
            }
            for (const p of run.props) {
               // on the sand, inside the beach, outside every swimmer's straight return lane and the tower lane
               expect(p.box.min.z).toBeGreaterThan(SAFE_SAND_Z);
               expect(p.box.max.z).toBeLessThan(SAND_DEPTH);
               expect(p.box.min.x).toBeGreaterThanOrEqual(-level.width / 2);
               expect(p.box.max.x).toBeLessThanOrEqual(level.width / 2);
               for (const s of run.swimmers) expect(s.x < p.box.min.x - RADIUS || s.x > p.box.max.x + RADIUS).toBe(true);
               expect(START_X < p.box.min.x - RADIUS || START_X > p.box.max.x + RADIUS).toBe(true);
            }
         }
      }
   });

   it("L3 and up add four props on top of two per rescue, and the beach fits them", () => {
      expect(LEVEL_IDS.map((id) => propTarget(LEVELS[id], id))).toEqual([8, 10, 16, 18, 20]);
      for (const id of LEVEL_IDS) {
         let n = 0;
         for (let seed = 1; seed <= 50; seed++) n += createRun(seed, LEVELS[id], id).props.length;
         expect(n / 50).toBeGreaterThanOrEqual(0.9 * propTarget(LEVELS[id], id));
      }
   });

   it("swimmers come from the seeded spawn band (the even-slot last resort is never needed) and spread over it", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const xMin = -level.width / 2 + 3;
         let deepest = 0;
         let fallbacks = 0;
         for (let seed = 1; seed <= 200; seed++) {
            const run = createRun(seed, level, id);
            const sorted = run.swimmers.map((s) => s.x).sort((p, q) => p - q);
            const even = sorted.every((x, i) => Math.abs(x - (xMin + ((level.width - 6) * (i + 0.5)) / level.rescues)) < 1e-9);
            if (even) fallbacks++;
            for (const s of run.swimmers) deepest = Math.min(deepest, s.z);
         }
         expect(fallbacks).toBe(0);
         // and they use the whole width: the outermost swimmers reach the last 4 m on both sides
         let left = Infinity;
         let right = -Infinity;
         for (let seed = 1; seed <= 200; seed++) for (const s of createRun(seed, level, id).swimmers) {
            left = Math.min(left, s.x);
            right = Math.max(right, s.x);
         }
         expect(left).toBeLessThan(xMin + 4);
         expect(right).toBeGreaterThan(-xMin - 4);
         expect(deepest).toBeLessThan(-level.water + 3);
      }
   });

   it("the start is clear of the tower, and the tower is solid", () => {
      const run = createRun(1, LEVELS[1], 1);
      expect(run.hero).toMatchObject({ x: START_X, z: START_Z });
      expect(START_Z + RADIUS).toBeLessThan(TOWER.z - TOWER.halfZ);
      // walk into the tower from the front: stopped at its face
      for (let i = 0; i < 120; i++) step(run, { moveX: 0, moveY: 1, actionPressed: false, yaw: 0 }, DT, 100_000);
      expect(run.hero.z).toBeLessThanOrEqual(TOWER.z - TOWER.halfZ - RADIUS + 1e-6);
   });
});

describe("beach-lifeguard rules: moving", () => {
   it("water speed is exactly 0.62 of the sand speed, split inside the frame that crosses z = 0", () => {
      expect(stepZ(1, -SPEED_SAND, 0.1)).toBeCloseTo(1 - 0.5, 10);
      expect(stepZ(0.25, -SPEED_SAND, 0.1)).toBeCloseTo(-(0.1 - 0.05) * SPEED_SAND * WATER_FACTOR, 10);
      expect(stepZ(-1, -SPEED_SAND, 0.1)).toBeCloseTo(-1 - 0.1 * SPEED_SAND * WATER_FACTOR, 10);
      expect(stepZ(-0.155, SPEED_SAND, 0.1)).toBeCloseTo((0.1 - 0.155 / (SPEED_SAND * WATER_FACTOR)) * SPEED_SAND, 10);
      // x in the water as well
      const run = at(createRun(3, LEVELS[1], 1), 0, -5);
      step(run, { moveX: 1, moveY: 0, actionPressed: false, yaw: 0 }, 0.05, 100_000);
      expect(run.hero.x).toBeCloseTo(SPEED_SAND * WATER_FACTOR * 0.05, 10);
   });

   it("carrying is x 0.85; the same stick on any device moves the same", () => {
      const run = at(createRun(3, LEVELS[1], 1), -6, 1);
      run.carrying = true;
      step(run, { moveX: -1, moveY: 0, actionPressed: false, yaw: 0 }, 0.05, 100_000);
      expect(run.hero.x).toBeCloseTo(-6 - SPEED_SAND * CARRY_FACTOR * 0.05, 10);
   });

   it("the hero stays inside the beach and the swim zone", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(5, LEVELS[id], id);
         run.alertTime = 1e9;
         for (let i = 0; i < 600; i++) step(run, { moveX: -1, moveY: -1, actionPressed: false, yaw: 0 }, 0.05, 1e9);
         // pinned in the far corner of this level's swim zone
         expect(run.hero.x).toBeCloseTo(-LEVELS[id].width / 2 + RADIUS, 9);
         expect(run.hero.z).toBeCloseTo(-LEVELS[id].water + RADIUS, 9);
         for (let i = 0; i < 600; i++) step(run, { moveX: 1, moveY: 0, actionPressed: false, yaw: 0 }, 0.05, 1e9);
         expect(run.hero.x).toBeCloseTo(LEVELS[id].width / 2 - RADIUS, 9);
      }
   });
});

describe("beach-lifeguard rules: grab, rescue, alerts", () => {
   it("grabs at 1.20 m and not at 1.21 m, only on a press", () => {
      for (const [d, ok] of [
         [1.2, true],
         [1.21, false],
      ] as const) {
         const run = createRun(9, LEVELS[1], 1);
         const s = run.swimmers[0];
         at(run, s.x, s.z + d);
         step(run, still(), 1e-6, 100_000);
         expect(run.carrying).toBe(false);
         step(run, { ...still(), actionPressed: true }, 1e-6, 100_000);
         expect(run.carrying).toBe(ok);
      }
   });

   it("only the active swimmer can be grabbed", () => {
      const run = createRun(9, LEVELS[2], 2);
      const other = run.swimmers[1];
      at(run, other.x, other.z + 0.5);
      step(run, { ...still(), actionPressed: true }, 1e-6, 100_000);
      expect(run.carrying).toBe(false);
   });

   it("a rescue pays 180 + 70 above half the alert clock, 180 below it, at z >= 2", () => {
      for (const [left, pts] of [
         [0.52, RESCUE_BASE_POINTS + RESCUE_CLOCK_BONUS],
         [0.48, RESCUE_BASE_POINTS],
      ] as const) {
         const run = createRun(9, LEVELS[2], 2);
         run.carrying = true;
         run.alertTime = LEVELS[2].alertS * left;
         at(run, 0, SAFE_SAND_Z - 0.001);
         let ev = step(run, still(), 1e-6, 100_000);
         expect(ev.rescued).toBe(false);
         at(run, 0, SAFE_SAND_Z);
         ev = step(run, still(), 1e-6, 100_000);
         expect(ev.rescued).toBe(true);
         expect(ev.score).toBe(pts);
         expect(run.score).toBe(pts);
         expect(run.swimmers[0].saved).toBe(true);
         expect(run.activeSwimmer).toBe(1);
         expect(run.alertTime).toBe(LEVELS[2].alertS);
      }
   });

   it("the last rescue wins with +5 per full second left", () => {
      const run = createRun(9, LEVELS[1], 1);
      run.swimmers[0].saved = true;
      run.saved = 1;
      run.score = 250;
      run.activeSwimmer = 1;
      run.carrying = true;
      run.time = 30;
      at(run, 0, SAFE_SAND_Z);
      const ev = step(run, still(), 1e-6, 90_999);
      expect(ev.won).toBe(true);
      expect(run.over).toBe("win");
      expect(run.score).toBe(250 + 250 + 90 * TIME_BONUS_PER_SECOND);
      expect(run.uncapped).toBe(run.score);
   });

   it("an expired alert costs a life, drops the carry, pays nothing and alerts the next swimmer still out", () => {
      const run = createRun(9, LEVELS[3], 3);
      run.carrying = true;
      run.alertTime = 0.001;
      const ev = step(run, still(), DT, 100_000);
      expect(ev.lifeLost).toBe(true);
      expect(ev.score).toBe(0);
      expect(run.score).toBe(0);
      expect(run.carrying).toBe(false);
      expect(run.lives).toBe(LIVES - 1);
      expect(run.activeSwimmer).toBe(1);
      expect(run.alertTime).toBe(LEVELS[3].alertS);
      expect(run.swimmers[0].saved).toBe(false);
   });

   it("after an expiry the alert never lands on a swimmer already saved (regression: the helper cycled through saved ones)", () => {
      const run = createRun(9, LEVELS[3], 3);
      run.swimmers[0].saved = true;
      run.swimmers[1].saved = true;
      run.activeSwimmer = 3;
      run.alertTime = 0.001;
      step(run, still(), DT, 100_000);
      expect(run.activeSwimmer).toBe(2);
      expect(nextSwimmer(run, 2)).toBe(3);
      run.swimmers[2].saved = run.swimmers[3].saved = true;
      expect(nextSwimmer(run, 2)).toBe(-1);
   });

   it("three expired alerts lose the run, through the store as well", () => {
      const run = createRun(9, LEVELS[1], 1);
      const store = createArcadeStore();
      store.getState().configure({ durationMs: LEVELS[1].durationMs, lives: LIVES });
      store.getState().markReady();
      store.getState().start();
      while (store.getState().phase === "countdown") store.getState().tick(50);
      for (let k = 0; k < LIVES; k++) {
         run.alertTime = 0.001;
         const ev = step(run, still(), DT, 100_000);
         syncStore(run, ev, store);
      }
      expect(run.over).toBe("lose");
      expect(store.getState().phase).toBe("over");
      expect(store.getState().endReason).toBe("lose");
      expect(store.getState().score).toBe(0);
   });
});

describe("beach-lifeguard rules: the jet ski", () => {
   it("cannot mount on L1-L3 (jetSki false)", () => {
      for (const id of [1, 2, 3] as const) {
         const run = at(createRun(4, LEVELS[id], id), JET_SKI_DOCK.x, JET_SKI_DOCK.z);
         step(run, { ...still(), actionPressed: true }, DT, 100_000);
         expect(run.onJetSki).toBe(false);
      }
   });

   it("mounts within 1.2 m on L4-L5, rides at 8.5 on the water and drops off at the shore", () => {
      for (const id of [4, 5] as const) {
         const run = at(createRun(4, LEVELS[id], id), JET_SKI_DOCK.x, JET_SKI_DOCK.z + MOUNT_RANGE + 0.01);
         step(run, { ...still(), actionPressed: true }, 1e-6, 100_000);
         expect(run.onJetSki).toBe(false);
         at(run, JET_SKI_DOCK.x, JET_SKI_DOCK.z + MOUNT_RANGE);
         const ev = step(run, { ...still(), actionPressed: true }, 1e-6, 100_000);
         expect(ev.jetSkiMount).toBe(true);
         expect(run.carrying).toBe(false);
         const x0 = run.hero.x;
         step(run, { moveX: 1, moveY: 0, actionPressed: false, yaw: 0 }, 0.05, 100_000);
         expect(run.hero.x - x0).toBeCloseTo(JET_SKI_SPEED * 0.05, 10);
         for (let i = 0; i < 60 && run.onJetSki; i++) step(run, { moveX: 0, moveY: 1, actionPressed: false, yaw: 0 }, 0.05, 100_000);
         expect(run.onJetSki).toBe(false);
         expect(run.hero.z).toBeLessThanOrEqual(0.05 * SPEED_SAND + 1e-9);
         expect(run.jetSki).toEqual({ x: JET_SKI_DOCK.x, z: JET_SKI_DOCK.z });
      }
   });
});

describe("beach-lifeguard rules: score ceiling", () => {
   it("Bobj = 250 x rescues on every level, and the limits hold it plus the win bonus", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         expect(objectiveCeiling(level)).toBe(250 * level.rescues);
         expect(PROPOSED_LEVEL_LIMITS[id].base).toBe(objectiveCeiling(level));
      }
   });
});
