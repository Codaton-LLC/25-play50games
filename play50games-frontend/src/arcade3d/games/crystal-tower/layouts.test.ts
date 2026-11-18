// The five towers against the card: the signature, the level twists, every route pad in jumping
// reach of the next, every crystal on a pad (and clear of the landing spot in the pad's middle),
// beacons apart, the hazards never on a crystal pad, the sequences well formed, every hero's route
// on every level, the secrets where their hero gets in.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEDGE_LIFT, LEVELS, PALETTE, SIGNATURE } from "./levels";
import { routePadOf, jumpAirtime } from "./bot";
import { CRYSTAL_OUT } from "./levels";
import { BEACON_R, CRYSTAL_R, HERO_R, RING, STORM_R, crystalAt, padTopSpeed, type Course } from "./tower";
import { G, V_AIR, V_JUMP, V_RUN, courseFor, createRun } from "./rules";
import { SECRETS } from "./progression";

/** The farthest a plain jump lands when it rises `rise` m, at the run speed. */
const reach = (rise: number) => V_RUN * jumpAirtime(rise);
const apex = (V_JUMP * V_JUMP) / (2 * G);
const namiApex = apex + (V_AIR * V_AIR) / (2 * G);

describe("the card", () => {
   it("is a memory climb with the card's twists per level", () => {
      expect(SIGNATURE).toBe("remember the colours, then climb and touch them in order");
      expect(LEVELS[1].colors).toBe(3);
      expect(LEVELS[1].tiers.filter((t) => t.seqLen > 0)).toHaveLength(3);
      expect(LEVELS[2].colors).toBe(4);
      expect(LEVELS[2].pads.some((p) => p.move)).toBe(true);
      expect(LEVELS[3].colors).toBe(5);
      expect(LEVELS[3].pads.some((p) => p.crumble)).toBe(true);
      expect(LEVELS[3].pads.some((p) => p.slick)).toBe(true);
      expect(LEVELS[4].tiers.every((t) => t.crystals.every((c) => c.bob))).toBe(true);
      expect(LEVELS[4].drones.length).toBeGreaterThan(0);
      expect(LEVELS[5].boss).toBe(true);
      expect(LEVELS[5].arena).toBeDefined();
      expect(LEVELS[5].tiers.filter((t) => t.seqLen > 0)).toHaveLength(4);
      // eight sequences on level 5: four tiers and Prism Shade's four hits
      expect(LEVELS[5].bossSeqLen).toEqual([5, 5, 6]);
      // the card's platform counts, near enough: 10 / 14 / 18 / 22 / 28
      expect(LEVEL_IDS.map((id) => LEVELS[id].pads.length)).toEqual([14, 14, 22, 26, 24]);
      for (const id of LEVEL_IDS) for (const t of LEVELS[id].tiers) for (const c of t.crystals) expect(c.color).toBeLessThan(LEVELS[id].colors);
   });
});

describe("placement", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: every route pad is in jumping reach of the next; no pad slides faster than the hero`, () => {
         const c = courseFor(id);
         for (let i = 0; i + 1 < c.routeCount; i++) {
            const a = c.pads[i];
            const b = c.pads[i + 1];
            const rise = b.y - a.y;
            expect(rise, `pad ${i} -> ${i + 1}`).toBeLessThan(apex - 0.5);
            // from a's middle to b's middle, less a little, is within a jump; and the gap is a real gap
            const d = Math.hypot(a.x - b.x, a.z - b.z);
            if (b.kind !== "arena") {
               expect(d - 0.3, `pad ${i} -> ${i + 1}`).toBeLessThan(reach(Math.max(0, rise)));
               expect(d).toBeGreaterThan(a.r + b.r - 0.6);
            }
            expect(padTopSpeed(a)).toBeLessThan(V_RUN);
         }
      });

      it(`level ${id}: every crystal floats at a route pad's edge, clear of the pad's middle and of every solid; a bobbing one tops out of reach`, () => {
         const c = courseFor(id);
         for (const cr of c.crystals) {
            const pad = routePadOf(c, cr.x, cr.z, cr.y);
            expect(pad, `crystal ${cr.index}`).toBeGreaterThanOrEqual(0);
            const p = c.pads[pad];
            const d = Math.hypot(p.x - cr.x, p.z - cr.z);
            expect(d).toBeCloseTo(CRYSTAL_OUT, 6);
            expect(d).toBeLessThan(p.r);
            // a hero landing in the pad's middle never touches it
            expect(d).toBeGreaterThan(CRYSTAL_R + 0.4);
            for (const w of [...c.walls, ...c.gates]) if (Math.abs(w.y0 - cr.y) < 4) expect(Math.hypot(w.x - cr.x, w.z - cr.z)).toBeGreaterThan(w.r + HERO_R + CRYSTAL_R);
            expect(p.storm).toBeUndefined();
            expect(p.crumble).toBeUndefined();
            if (cr.bob) {
               let hi = 0;
               for (let ms = 0; ms < cr.bob.periodMs; ms += 20) hi = Math.max(hi, crystalAt(cr, ms, { x: 0, y: 0, z: 0 }).y - cr.y);
               expect(hi).toBeGreaterThan(0.6 + CRYSTAL_R);
            }
         }
         // every colour in play has one crystal per tier
         for (const t of c.tiers) {
            if (t.seqLen === 0) continue;
            const cols = new Set<number>();
            for (let k = 0; k < t.count; k++) cols.add(c.crystals[t.first + k].color);
            expect(cols.size).toBe(c.colors);
         }
      });

      it(`level ${id}: the beacons stand on route pads, apart from one another; the storms' columns miss the crystals; the sequences never repeat a colour in a row`, () => {
         const c = courseFor(id);
         for (let i = 0; i < c.tiers.length; i++) {
            const b = c.tiers[i].beacon;
            expect(routePadOf(c, b.x, b.z, b.y)).toBeGreaterThanOrEqual(0);
            for (let j = i + 1; j < c.tiers.length; j++) {
               const o = c.tiers[j].beacon;
               expect(Math.hypot(b.x - o.x, b.z - o.z) > 2 * RING + 0.5 || Math.abs(b.y - o.y) > 3).toBe(true);
            }
            // a hero standing on the beacon (the ring's middle) never touches a crystal
            for (const cr of c.crystals) expect(Math.hypot(b.x - cr.x, b.z - cr.z) > CRYSTAL_R + 0.3 || Math.abs(b.y - cr.y) > 1.5).toBe(true);
            expect(BEACON_R).toBeLessThan(CRYSTAL_OUT);
         }
         for (const p of c.pads) if (p.storm !== undefined) for (const cr of c.crystals) expect(Math.hypot(p.x - cr.x, p.z - cr.z) > STORM_R + CRYSTAL_R || Math.abs(p.y - cr.y) > 1.5).toBe(true);
         for (let seed = 1; seed <= 5; seed++) {
            const run = createRun(seed, id);
            for (const ts of run.tiers) for (let i = 1; i < ts.seq.length; i++) if (i < run.course.tiers[run.tiers.indexOf(ts)].seqLen) expect(ts.seq[i]).not.toBe(ts.seq[i - 1]);
         }
      });

      it(`level ${id}: every hero's route: a crystal wall and nook (Riko), a sky ledge only the double jump reaches (Nami), a storm (Kiro), hidden gems (Zuno), a void gate and nook (Vexa); the secrets sit where their hero gets in`, () => {
         const c = courseFor(id);
         expect(c.walls.length).toBeGreaterThan(0);
         expect(c.gates.length).toBeGreaterThan(0);
         expect(c.pads.filter((p) => p.kind === "nook")).toHaveLength(2);
         const ledge = c.pads.find((p) => p.kind === "ledge")!;
         expect(ledge).toBeDefined();
         const under = c.spec.pads.find((p) => Math.abs(p.y + LEDGE_LIFT - ledge.y) < 0.01)!;
         expect(under).toBeDefined();
         expect(LEDGE_LIFT).toBeGreaterThan(apex + 0.75);
         expect(LEDGE_LIFT).toBeLessThan(namiApex - 0.3);
         // the ledge hangs outside its pad, so a jump between pads never lands on it
         expect(Math.hypot(ledge.x - under.x, ledge.z - under.z)).toBeGreaterThan(ledge.r + 0.9);
         expect(c.pads.some((p) => p.storm !== undefined)).toBe(true);
         expect(c.orbs.some((o) => o.hidden)).toBe(true);
         const list = SECRETS[id];
         c.secrets.forEach((s, i) => {
            if (list[i].id === "void-sticker") expect(c.gates.some((g) => Math.hypot(g.x - s.x, g.z - s.z) < 3 && Math.abs(g.y0 - s.y) < 2)).toBe(true);
            else if (list[i].id === "wall-shard") expect(c.walls.some((w) => Math.hypot(w.x - s.x, w.z - s.z) < 3 && Math.abs(w.y0 - s.y) < 2)).toBe(true);
            else expect(Math.hypot(ledge.x - s.x, ledge.z - s.z) < ledge.r && Math.abs(ledge.y + 1 - s.y) < 0.1).toBe(true);
         });
         // the nooks sit behind their barrier, off the route
         for (const n of c.pads.filter((p) => p.kind === "nook")) expect([...c.walls, ...c.gates].some((d) => Math.hypot(d.x - n.x, d.z - n.z) < n.r + d.r + 0.3)).toBe(true);
      });
   }

   it("level 5's arena: five slots on the rim, one per colour, apart from one another and inside the arena", () => {
      const c: Course = courseFor(5);
      expect(c.slots).toHaveLength(PALETTE.length);
      for (let i = 0; i < 5; i++) {
         const s = c.slots[i];
         expect(Math.hypot(s.x - c.arena!.x, s.z - c.arena!.z)).toBeLessThan(c.arena!.r - 1);
         for (let j = i + 1; j < 5; j++) expect(Math.hypot(s.x - c.slots[j].x, s.z - c.slots[j].z)).toBeGreaterThan(2 * CRYSTAL_R + 1);
      }
   });
});
