import { describe, expect, it } from "vitest";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVEL_IDS } from "@/arcade3d/types";
import { FIT } from "./assets";
import { LEVELS } from "./levels";
import { PITCH } from "./looks";
import {
   ACCEL,
   DOOR_OFFSET,
   FENCE_CENTER,
   FENCE_LEN,
   FENCE_Z,
   HOUSE_BACK,
   HOUSE_HZ,
   MAIL_OFFSET,
   OFFICE,
   RADIUS,
   REACH,
   SPEED,
   STREET_GAP,
   WRONG_STUN,
   createRun,
   refill,
   solid,
   step,
   syncStore,
   targetFor,
   type PostInput,
   type Run,
} from "./rules";

const DT = 1 / 60;
const idle = (): PostInput => ({ moveX: 0, moveY: 0, yaw: 0, actionPressed: false });
const press = (): PostInput => ({ moveX: 0, moveY: 0, yaw: 0, actionPressed: true });
const put = (run: Run, x: number, z: number) => {
   run.hero.x = x;
   run.hero.z = z;
   run.hero.vx = 0;
   run.hero.vz = 0;
};
/** stand at an item's mailbox (letters) or door (parcels), on the street side */
const standAt = (run: Run, index: number) => {
   const item = run.items[index];
   const t = targetFor(run, item);
   const h = run.houses[item.house - 1];
   put(run, t.x, t.z - h.side * 0.5);
};

describe("postman rules: determinism and the generator", () => {
   it("the same seed and inputs give the same run; seeds change the addresses", () => {
      for (const id of LEVEL_IDS) {
         const a = createRun(77, LEVELS[id]);
         const b = createRun(77, LEVELS[id]);
         expect(JSON.stringify(a)).toBe(JSON.stringify(b));
         for (let i = 0; i < 600; i++) {
            const inp = { moveX: Math.sin(i / 30), moveY: Math.cos(i / 47), yaw: 0, actionPressed: i % 50 === 0 };
            step(a, inp, DT);
            step(b, inp, DT);
         }
         expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      }
      const lists = new Set<string>();
      for (let seed = 1; seed <= 30; seed++) lists.add(createRun(seed, LEVELS[3]).items.map((i) => i.house).join(","));
      expect(lists.size).toBeGreaterThan(10);
   });

   for (const id of LEVEL_IDS) {
      it(`L${id}: 200 seeds: counts, unique addresses in route order, bag and parcel loads, hazards from the level`, () => {
         const level = LEVELS[id];
         for (let seed = 1; seed <= 200; seed++) {
            const run = createRun(seed, level);
            expect(run.level).toBe(level);
            expect(run.houses.length).toBe(level.streets * level.housesPerStreet);
            expect(run.items.length).toBe(level.letters + level.parcels);
            expect(run.items.filter((i) => i.kind === "parcel").length).toBe(level.parcels);
            expect(new Set(run.items.map((i) => i.house)).size).toBe(run.items.length);
            // letters first, then parcels; each kind in route order (street, then serpentine x)
            expect(run.items.slice(0, level.letters).every((i) => i.kind === "letter")).toBe(true);
            expect(run.dogs.length).toBe(level.dogs);
            expect(run.cars.length).toBe(level.traffic);
            expect(run.lives).toBe(level.lives ?? null);
            expect(run.bag).toBe(Math.min(level.bagCap, level.letters));
            expect(run.carrying).toBe(level.parcels > 0);
            expect(run.items.filter((i) => i.loaded && i.kind === "letter").length).toBe(run.bag);
            // every mailbox and door point is reachable: off the solids, inside the bounds
            for (const h of run.houses) {
               for (const z of [h.mailZ - h.side * 0.5, h.doorZ - h.side * 0.5]) {
                  expect(solid(run, h.x, z)).toBe(false);
                  expect(z).toBeGreaterThan(run.bounds.min.z + RADIUS);
                  expect(z).toBeLessThan(run.bounds.max.z - RADIUS);
               }
               expect(h.mailZ).toBe(h.street * STREET_GAP + h.side * MAIL_OFFSET);
               expect(h.doorZ).toBe(h.mailZ + h.side * DOOR_OFFSET);
            }
            // no dog guards the first stop's yard
            const first = run.houses[run.items[0].house - 1];
            for (const d of run.dogs) expect(d.homeX === first.x + 2 && d.homeZ === first.doorZ).toBe(false);
            expect(solid(run, OFFICE.x, OFFICE.z)).toBe(false);
         }
      });
   }
});

describe("postman rules: delivery", () => {
   it("a letter at its mailbox pays 140 in list order, 100 out of order; each item pays once", () => {
      const run = createRun(3, LEVELS[1]);
      standAt(run, 1);
      step(run, press(), DT);
      expect(run.event.score).toBe(100);
      expect(run.items[1].delivered).toBe(true);
      step(run, press(), DT); // the same mailbox again: nothing left for it -> a wrong-address stun
      expect(run.event.score).toBe(0);
      expect(run.event.wrong).toBe(true);
      run.hero.stun = 0;
      standAt(run, 0);
      step(run, press(), DT);
      expect(run.event.score).toBe(140);
      expect(run.score).toBe(240);
      expect(run.delivered).toBe(2);
   });
   it("a wrong mailbox stuns 0.40 s and keeps the letter; no movement while stunned", () => {
      const run = createRun(5, LEVELS[2]);
      const wrong = run.houses.find((h) => !run.items.some((i) => i.house === h.number))!;
      put(run, wrong.x, wrong.mailZ - wrong.side * 0.5);
      const bag = run.bag;
      step(run, press(), DT);
      expect(run.event.wrong).toBe(true);
      expect(run.hero.stun).toBe(WRONG_STUN);
      expect(run.bag).toBe(bag);
      expect(run.score).toBe(0);
      const x = run.hero.x;
      for (let t = 0; t < WRONG_STUN - 2 * DT; t += DT) step(run, { moveX: 1, moveY: 0, yaw: 0, actionPressed: true }, DT);
      expect(run.hero.x).toBe(x);
      expect(run.score).toBe(0);
   });
   it("letters only at mailboxes, parcels only at doors; the parcel slows the walk to 0.85", () => {
      const run = createRun(9, LEVELS[2]);
      const p = run.items.findIndex((i) => i.kind === "parcel" && i.loaded);
      const item = run.items[p];
      const h = run.houses[item.house - 1];
      put(run, h.x, h.mailZ - h.side * 0.5); // the parcel's house, at the mailbox
      step(run, press(), DT);
      expect(run.event.wrong).toBe(true);
      expect(item.delivered).toBe(false);
      run.hero.stun = 0;
      put(run, h.x, h.doorZ - h.side * 0.5);
      step(run, press(), DT);
      expect(item.delivered).toBe(true);
      expect(run.carrying).toBe(false);
      // carrying: top speed 0.85 x 4.6
      const r2 = createRun(9, LEVELS[2]);
      put(r2, 2, 0);
      for (let i = 0; i < 120; i++) step(r2, { moveX: 1, moveY: 0, yaw: 0, actionPressed: false }, DT);
      expect(r2.hero.vx).toBeCloseTo(SPEED * 0.85, 6);
   });
   it("the bag holds bagCap letters; a refill at the counter tops it up and takes one parcel", () => {
      const run = createRun(4, LEVELS[4]);
      expect(run.bag).toBe(4);
      expect(run.items.filter((i) => !i.loaded && i.kind === "letter").length).toBe(3);
      for (let i = 0; i < 4; i++) {
         standAt(run, i);
         step(run, press(), DT);
         expect(run.items[i].delivered).toBe(true);
      }
      expect(run.bag).toBe(0);
      put(run, OFFICE.x, OFFICE.z + 0.5);
      step(run, press(), DT);
      expect(run.event.refill).toBe(true);
      expect(run.bag).toBe(3);
      expect(run.items.filter((i) => i.loaded && i.kind === "parcel").length).toBe(1);
      refill(run);
      expect(run.bag).toBe(3);
      expect(run.items.filter((i) => i.loaded && !i.delivered).length).toBe(4);
   });
   it("win: every item delivered ends the run with +5 per full second left", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(6, LEVELS[id]);
         const last = run.items.length - 1;
         for (let i = 0; i < last; i++) {
            run.items[i].delivered = true;
            run.items[i].loaded = false;
         }
         run.delivered = last;
         run.items[last].loaded = true;
         run.carrying = run.items[last].kind === "parcel";
         run.elapsed = 50.25;
         standAt(run, last);
         step(run, press(), 0.01);
         expect(run.over).toBe("win");
         expect(run.event.score).toBe(140 + 5 * Math.floor(LEVELS[id].durationMs / 1000 - 50.26));
      }
   });
   it("timeup on each level's clock, not a second early", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(2, LEVELS[id]);
         run.elapsed = LEVELS[id].durationMs / 1000 - 1;
         step(run, idle(), 0.02);
         expect(run.over).toBeNull();
         run.elapsed = LEVELS[id].durationMs / 1000 - 0.01;
         step(run, idle(), 0.02);
         expect(run.over).toBe("timeup");
      }
   });
});

describe("postman rules: hazards", () => {
   it("a dog stuns 0.60 s with 0.80 s mercy and costs no life", () => {
      const run = createRun(1, LEVELS[3]);
      const d = run.dogs[0];
      put(run, d.homeX, d.homeZ - d.side * 1.5);
      for (let i = 0; i < 60 && !run.event.hit; i++) step(run, idle(), DT);
      expect(run.event.hit).toBe(true);
      expect(run.event.lifeLost).toBe(false);
      expect(run.hero.stun).toBeCloseTo(0.6, 9);
      expect(run.hero.mercy).toBeCloseTo(0.8, 9);
      expect(run.lives).toBeNull();
   });
   it("cars only on L4-L5: a hit spends a life and stuns; three hits lose", () => {
      for (const id of LEVEL_IDS) expect(createRun(1, LEVELS[id]).cars.length > 0).toBe(id >= 4);
      const run = createRun(1, LEVELS[4]);
      const store = createArcadeStore();
      store.getState().configure({ durationMs: LEVELS[4].durationMs, lives: LEVELS[4].lives });
      store.getState().markReady();
      store.getState().start();
      for (let hit = 1; hit <= 3; hit++) {
         const c = run.cars[0];
         run.hero.mercy = 0;
         run.hero.stun = 0;
         put(run, c.x + c.direction * 0.5, c.z);
         step(run, idle(), DT);
         syncStore(run, store);
         expect(run.event.lifeLost).toBe(true);
         expect(run.lives).toBe(3 - hit);
      }
      expect(run.over).toBe("lose");
      expect(store.getState().lives).toBe(0);
   });
   it("cars stop before the zebra while the postman is on it", () => {
      const run = createRun(1, LEVELS[4]);
      const c = run.cars.find((car) => car.direction > 0)!;
      c.x = -10;
      put(run, -5, c.street * STREET_GAP);
      step(run, idle(), DT);
      expect(c.stopped).toBe(true);
      expect(c.x).toBe(-10);
      put(run, 10, c.street * STREET_GAP - 4);
      step(run, idle(), DT);
      expect(c.stopped).toBe(false);
   });
});

describe("postman rules: movement and fairness", () => {
   it("on-foot mover: accel 22 to 4.6 m/s; houses, the office and the bounds are solid", () => {
      const run = createRun(1, LEVELS[1]);
      put(run, 2, 0);
      step(run, { moveX: 1, moveY: 0, yaw: 0, actionPressed: false }, 0.05);
      expect(run.hero.vx).toBeCloseTo(ACCEL * 0.05, 9);
      for (let i = 0; i < 60; i++) step(run, { moveX: 1, moveY: 0, yaw: 0, actionPressed: false }, DT);
      expect(run.hero.vx).toBeCloseTo(SPEED, 9);
      const h = run.houses[1];
      put(run, h.x, h.doorZ - h.side * 0.2);
      for (let i = 0; i < 60; i++) step(run, { moveX: 0, moveY: h.side, yaw: 0, actionPressed: false }, DT);
      expect(Math.abs(run.hero.z - h.z)).toBeGreaterThanOrEqual(HOUSE_HZ + RADIUS - 1e-6);
   });
   it("the picket fences are solid: a postman walking at one stops at it, and the gate gap stays open to the door", () => {
      const run = createRun(1, LEVELS[1]);
      const h = run.houses[1];
      const fenceZ = h.mailZ + h.side * FENCE_Z;
      const fx = h.x + FENCE_CENTER;
      expect(solid(run, fx, fenceZ)).toBe(true);
      expect(solid(run, h.x + FENCE_CENTER - FENCE_LEN / 2 + 0.01, fenceZ)).toBe(true);
      expect(solid(run, h.x, fenceZ)).toBe(false);
      expect(solid(run, h.x - FENCE_CENTER, fenceZ)).toBe(true);
      // walk toward the house, one metre inside the fence's span
      put(run, fx, h.mailZ - h.side * 0.5);
      for (let i = 0; i < 90; i++) step(run, { moveX: 0, moveY: h.side, yaw: 0, actionPressed: false }, DT);
      expect(Math.abs(run.hero.z - fenceZ)).toBeGreaterThanOrEqual(RADIUS - 1e-6);
      expect(h.side * (run.hero.z - fenceZ)).toBeLessThan(0);
      // and through the gate to the door
      put(run, h.x, h.mailZ - h.side * 0.5);
      for (let i = 0; i < 120; i++) step(run, { moveX: 0, moveY: h.side, yaw: 0, actionPressed: false }, DT);
      expect(h.side * (run.hero.z - fenceZ)).toBeGreaterThan(1);
   });
   it("keyboard and touch: one rule, one set of constants (a full stick equals a held key)", () => {
      const a = createRun(3, LEVELS[2]);
      const b = createRun(3, LEVELS[2]);
      for (let i = 0; i < 300; i++) {
         step(a, { moveX: 1, moveY: 0, yaw: 0, actionPressed: i === 200 }, DT);
         step(b, { moveX: Math.cos(1e-9), moveY: Math.sin(1e-9), yaw: 0, actionPressed: i === 200 }, DT);
      }
      expect(b.hero.x).toBeCloseTo(a.hero.x, 6);
      expect(b.score).toBe(a.score);
      expect(REACH).toBe(1.2);
   });
   it("sightline: from the camera's pitch the south-row bungalows never hide the postman at a door", () => {
      // the postman stands at most REACH from the door point; the bungalow's front is HOUSE_BACK - HOUSE_HZ behind it
      const front = HOUSE_BACK - HOUSE_HZ;
      const nearest = front + 0.5; // standing at the delivery spot, 0.5 m out from the door point
      // the line from his feet up toward the camera clears the bungalow's roof
      expect(nearest * Math.tan(PITCH)).toBeGreaterThan(FIT.houseHeightSouth - 0.05);
      // and from his head at a door he could reach from (on the street side, up to REACH out)
      expect((front + REACH * 0.5) * Math.tan(PITCH) + FIT.postmanHeight).toBeGreaterThan(FIT.houseHeightSouth);
   });
});
