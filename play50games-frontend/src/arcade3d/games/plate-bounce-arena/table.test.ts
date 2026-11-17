// The five tables follow the card: the orb counts, the sections in order, the boss on level 5, the
// pieces inside the table and clear of each other, the ramps returning down the left inlane.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { BALL_R, LEFT_X, LANE_X, MAIN_ORBS, buildTable, rampPoint, tableToWorld, TILT } from "./table";
import { SECRETS, ROLLO } from "./progression";
import { bossProblems } from "@/arcade3d/menu2/boss/boss";
import { secretProblems } from "@/arcade3d/menu2/secrets/secrets";

describe("tables", () => {
   it("main orbs 8 / 10 / 12 / 14 / 10 (the card), plus the hero pockets' bonus orbs", () => {
      for (const id of LEVEL_IDS) {
         const t = buildTable(id);
         expect(t.mainOrbs).toBe(MAIN_ORBS[id]);
         expect(t.orbs.filter((o) => !o.main).length).toBe(11);
      }
   });

   it("the card's sections in order, Rollo on level 5", () => {
      const kinds = LEVEL_IDS.map((id) => buildTable(id).objectives.map((o) => o.kind).join(","));
      expect(kinds).toEqual(["bumpers,ramp,lanterns", "orbits,bank", "bank,ramp,bank", "lanterns,ramp", "boss"]);
      expect(buildTable(2).objectives[0]).toMatchObject({ kind: "orbits", n: 3 });
      expect(buildTable(4).multiballAt).toBe(1);
      expect(buildTable(3).ice).toBe(true);
      expect(buildTable(5).boss).not.toBeNull();
      expect(bossProblems(ROLLO)).toEqual([]);
      for (const id of LEVEL_IDS) expect(secretProblems(SECRETS[id])).toEqual([]);
   });

   it("round pieces sit inside the playfield and leave a ball's width between them", () => {
      for (const id of LEVEL_IDS) {
         const t = buildTable(id);
         const solid = [...t.bumpers.filter((b) => b.layer === 0), ...t.mushrooms, ...t.targets, ...t.posts, ...(t.boss ? [] : [t.hole])];
         for (const c of solid) {
            expect(c.x - c.r, `L${id}`).toBeGreaterThan(LEFT_X);
            expect(c.x + c.r, `L${id}`).toBeLessThan(LANE_X);
            expect(c.z).toBeLessThan(-3);
         }
         for (let i = 0; i < solid.length; i++) {
            for (let j = i + 1; j < solid.length; j++) {
               const a = solid[i];
               const b = solid[j];
               const gap = Math.hypot(a.x - b.x, a.z - b.z) - a.r - b.r;
               // bank targets stand shoulder to shoulder on purpose
               const ba = (a as { bank?: number }).bank ?? -1;
               const bb = (b as { bank?: number }).bank ?? -1;
               if (ba >= 0 && ba === bb) continue;
               expect(gap, `L${id} ${i}-${j}`).toBeGreaterThan(2 * BALL_R * 0.9);
            }
         }
      }
   });

   it("ramps come back down the left side into the inlane, heading for the flipper", () => {
      for (const id of LEVEL_IDS) {
         for (const r of buildTable(id).ramps) {
            const end = r.path[r.path.length - 1];
            expect(end.x).toBeLessThan(-6);
            expect(end.z).toBeGreaterThan(-12);
            expect(end.h).toBe(0);
            const p = rampPoint(r, 0.5, { x: 0, z: 0, h: 0 });
            expect(p.h).toBeGreaterThan(1);
         }
      }
   });

   it("the tilt lifts the top of the table", () => {
      const top = tableToWorld(0, 0, -29, { x: 0, y: 0, z: 0 });
      expect(top.y).toBeCloseTo(29 * Math.sin(TILT), 6);
      expect(TILT).toBeCloseTo((7 * Math.PI) / 180, 6);
   });
});

describe("the left inlane", () => {
   it("a ball fits between every slingshot corner and the inlane guide", () => {
      const t = buildTable(1);
      const guide = t.segs.find((s) => s.ax === LEFT_X && s.az === -6.5 && s.kind === "wall")!;
      const dx = guide.bx - guide.ax;
      const dz = guide.bz - guide.az;
      const len = Math.hypot(dx, dz);
      const corners = t.segs.filter((s) => s.ax <= -3.9 && s.ax >= -5.6 && s.az > -9 && s.az < -4.5 && s !== guide);
      for (const s of corners) {
         for (const [x, z] of [[s.ax, s.az], [s.bx, s.bz]]) {
            const d = Math.abs((x - guide.ax) * dz - (z - guide.az) * dx) / len;
            expect(d - s.r - guide.r).toBeGreaterThan(2 * BALL_R + 0.05);
         }
      }
   });
});
