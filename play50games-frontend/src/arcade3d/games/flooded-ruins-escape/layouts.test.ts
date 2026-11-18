// Flooded Ruins Escape plays its own verb, FLOOD (the card): you gain height by flooding a chamber
// and floating up, you open low doors by draining one, and the storm tide climbs behind you. Not
// a bounce climb (Sky Tower Jump), not a glide across (Cloud Hopper): no pads, no feathers, and the
// route needs the water. The card's level twists: L1's three beats, L2's linked chambers, L3's
// spiral valve shaft, L4's fast tide and air pockets, L5's Umbra Roller arena.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { SHAFT, SHAFT_SLOTS, ringPoint } from "./ruins";
import { UMBRA_ROLLER } from "./progression";
import { H_JUMP, V_RUN, courseFor } from "./rules";

const goSteps = (id: 1 | 2 | 3 | 4 | 5) => courseFor(id).route.filter((s): s is { go: number } => "go" in s).map((s) => s.go);

describe("the water is the lift (FLOOD, not bounce or glide)", () => {
   for (const id of [1, 2, 3] as const) {
      it(`level ${id}: the route climbs to a block no jump reaches from the block before it: the water has to lift you there`, () => {
         const c = courseFor(id);
         const tops = goSteps(id).map((i) => c.supports[i].top);
         const route = c.route;
         let lifted = 0;
         let prev = c.supports[c.checkpoints[0]].top;
         for (const st of route) {
            if (!("go" in st)) continue;
            const top = c.supports[st.go].top;
            if (top - prev > H_JUMP) lifted += 1;
            prev = top;
         }
         if (id === 3) {
            // the shaft: the three swims cross whole sides of open water at the ring's level
            expect(route.filter((s) => "swim" in s)).toHaveLength(3);
            expect(route.filter((s) => "wait" in s)).toHaveLength(3);
         } else expect(lifted, `level ${id} tops ${tops.join(",")}`).toBeGreaterThanOrEqual(1);
      });
   }

   it("level 1 is the card's three beats: flood up out of trench A, drain trench B to walk under its door, then three switchback rows with the tide", () => {
      const c = courseFor(1);
      const r = c.route;
      const kinds = r.map((s) => Object.keys(s)[0]);
      // beat 1: a lever that raises A; beat 2: a lever that lowers B, then wait for it to drain
      const lev = r.filter((s): s is { lever: number; pos: number } => "lever" in s);
      expect(lev).toHaveLength(2);
      const [[za, la]] = c.levers[lev[0].lever].effects[lev[0].pos];
      expect(c.zones[za].levels[la]).toBeGreaterThan(c.zones[za].levels[c.zones[za].start]);
      const [[zb, lb]] = c.levers[lev[1].lever].effects[lev[1].pos];
      expect(c.zones[zb].levels[lb]).toBeLessThan(c.zones[zb].levels[c.zones[zb].start]);
      expect(kinds).toContain("wait");
      // beat 3: three rows of ledges, each row running the other way and climbing; the tide starts on the checkpoint before them
      const rows = new Map<number, number[]>();
      for (const i of goSteps(1).slice(-12, -1)) {
         const s = c.supports[i];
         rows.set(s.cz, [...(rows.get(s.cz) ?? []), s.cx]);
      }
      const dirs = [...rows.values()].map((xs) => Math.sign(xs[xs.length - 1] - xs[0]));
      expect(dirs).toHaveLength(3);
      expect(dirs[0]).toBe(-dirs[1]);
      expect(dirs[1]).toBe(-dirs[2]);
      expect(LEVELS[1].tide.startCheckpoint).toBe(2);
      expect(LEVELS[1].tide.rate).toBe(0.25);
   });

   it("level 2 links its chambers: every lever floods one chamber and drains the next", () => {
      const c = courseFor(2);
      expect(c.zones.length).toBeGreaterThanOrEqual(3);
      const used = c.route.filter((s) => "lever" in s);
      expect(used.length).toBeGreaterThanOrEqual(2);
      for (const l of c.levers) expect(l.effects.every((e) => e.length === 2)).toBe(true);
   });

   it("level 3 is the spiral valve shaft: ledges wind round the flooded shaft more than 1.5 laps, three rings of levers, a bat in a dry niche", () => {
      const c = courseFor(3);
      const ledges = goSteps(3).map((i) => c.supports[i]);
      let turn = 0;
      let prev = Math.atan2(ledges[0].cx, ledges[0].cz - SHAFT.cz);
      for (const s of ledges.slice(1)) {
         const a = Math.atan2(s.cx, s.cz - SHAFT.cz);
         let d = a - prev;
         while (d > Math.PI) d -= 2 * Math.PI;
         while (d < -Math.PI) d += 2 * Math.PI;
         turn += d;
         prev = a;
         // every ledge sits on the ring, never over the shaft's middle
         expect(Math.max(Math.abs(s.cx), Math.abs(s.cz - SHAFT.cz))).toBeCloseTo(SHAFT.r, 6);
      }
      expect(Math.abs(turn) / (2 * Math.PI)).toBeGreaterThan(1.5);
      expect(c.levers).toHaveLength(3);
      expect(c.zones[0].levels).toEqual([...SHAFT.ringLevels]);
      expect(c.bats).toHaveLength(1);
      // each collapsed stretch is wider than any run-up jump (V_RUN for the jump's whole flight)
      const flight = (2 * Math.sqrt(2 * 30 * H_JUMP)) / 30;
      const p = ringPoint(SHAFT.r, SHAFT.cz, 2 * SHAFT.step);
      const q = ringPoint(SHAFT.r, SHAFT.cz, 6 * SHAFT.step);
      expect(Math.hypot(p.x - q.x, p.z - q.z) - SHAFT.ledge).toBeGreaterThan(V_RUN * flight);
      expect(SHAFT_SLOTS.filter((t) => t === null)).toHaveLength(9);
   });

   it("level 4 is the fast tide with air pockets: 0.6 m/s, a dive under the crypt roof between bubble spouts, no lever", () => {
      const c = courseFor(4);
      expect(LEVELS[4].tide.rate).toBe(0.6);
      expect(c.spouts.length).toBeGreaterThanOrEqual(2);
      expect(c.route.filter((s) => "swim" in s && s.dive !== undefined)).toHaveLength(3);
      expect(c.route.some((s) => "lever" in s)).toBe(false);
      expect(c.whirls).toHaveLength(1);
   });

   it("level 5 is Umbra Roller's arena: the roll ends in the ring basin, three pressure levers on the drain, the chase ends on the floodgate", () => {
      const c = courseFor(5);
      const a = c.boss!;
      expect(a).not.toBeNull();
      const end = a.rollPath[a.rollPath.length - 1];
      const ring = c.zones[a.ring];
      expect(end[0]).toBeGreaterThanOrEqual(ring.minX);
      expect(end[0]).toBeLessThanOrEqual(ring.maxX);
      expect(end[2]).toBeGreaterThanOrEqual(ring.minZ);
      expect(end[2]).toBeLessThanOrEqual(ring.maxZ);
      expect(ring.levels[ring.levels.length - 1]).toBeGreaterThanOrEqual(a.ringLevel);
      expect(a.pressure).toHaveLength(3);
      for (const li of a.pressure) expect(c.levers[li].kind).toBe("pressure");
      expect(c.levers[a.gateLever].kind).toBe("gate");
      const gateEnd = a.chasePath[a.chasePath.length - 1];
      expect(c.supports.some((s) => s.cx === gateEnd[0] && s.cz === gateEnd[2] && s.top === gateEnd[1])).toBe(true);
      expect(UMBRA_ROLLER.phases.map((p) => p.id)).toEqual(["chase", "drains", "tide"]);
      expect(LEVELS[5].tide.rate).toBe(0.8);
   });

   it("no level is a bounce or glide course: blocks are stone, floors, walls and crates only", () => {
      for (const id of LEVEL_IDS) {
         for (const s of courseFor(id).supports) expect(["start", "ledge", "checkpoint", "goal", "floor", "wall", "crate"]).toContain(s.kind);
      }
   });
});

describe("every hero matters (the card's hero roles)", () => {
   const roles = (id: 1 | 2 | 3 | 4 | 5) => {
      const c = courseFor(id);
      return {
         riko: c.supports.some((s) => s.crack),
         nami: c.orbs.some((o) => o.bonus && o.buried < 0 && o.y > 4),
         kiro: c.jets.length + c.whirls.length > 0,
         zuno: c.orbs.some((o) => o.buried >= 0),
         vexa: c.supports.some((s) => s.ghost),
      };
   };

   it("each hero's feature is in the game, and every level has at least two of them; every level hides a ghost panel for Vexa", () => {
      const all = { riko: 0, nami: 0, kiro: 0, zuno: 0, vexa: 0 };
      for (const id of LEVEL_IDS) {
         const r = roles(id);
         let n = 0;
         for (const k of Object.keys(all) as (keyof typeof all)[]) {
            if (r[k]) {
               all[k] += 1;
               n += 1;
            }
         }
         expect(n, `level ${id}`).toBeGreaterThanOrEqual(2);
         expect(r.vexa, `level ${id}`).toBe(true);
      }
      for (const v of Object.values(all)) expect(v).toBeGreaterThanOrEqual(1);
      expect(all.zuno).toBeGreaterThanOrEqual(3);
      expect(all.nami).toBeGreaterThanOrEqual(3);
      expect(all.kiro).toBeGreaterThanOrEqual(3);
   });
});
