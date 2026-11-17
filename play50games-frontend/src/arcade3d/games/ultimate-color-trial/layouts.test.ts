// The five trials against the card: the signature, the level twists, every pad gap inside a flat
// jump's reach (the only way over the void), rings in corridor order, every door's colour on a switch
// before its row, laser beams far enough apart to jump, every hero's route on every level, the
// secrets where their hero gets in.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { HALF_W, LEDGE_LIFT, LEVELS, NOOK_X, SIGNATURE, type SectionKind } from "./levels";
import { DASH_BOOST, POWER_MS } from "./heroes";
import { G, V_JUMP, V_RUN, courseFor } from "./rules";
import { SECRETS } from "./progression";

/** A flat jump's reach at V_RUN, and the furthest a flat jump with a dash goes (Riko). */
const airtime = (vy: number) => (2 * vy) / G;
const FLAT = V_RUN * airtime(V_JUMP);
const RIKO = FLAT + DASH_BOOST * (POWER_MS.dash / 1000);
const kinds = (id: 1 | 2 | 3 | 4 | 5): SectionKind[] => LEVELS[id].sections.map((s) => s.kind);

describe("the card", () => {
   it("is one corridor of sections with the card's twists per level", () => {
      expect(SIGNATURE).toBe("one corridor, every mechanic, in sections");
      expect(kinds(1)).toEqual(["jump", "rings", "gates"]);
      expect(LEVELS[1].colors).toBe(3);
      expect(kinds(2)).toContain("runner");
      expect(LEVELS[2].sections.some((s) => s.pads?.some((p) => p.move))).toBe(true);
      expect(LEVELS[2].colors).toBe(4);
      expect(kinds(3)).toEqual(expect.arrayContaining(["survive", "core"]));
      expect(LEVELS[3].colors).toBe(5);
      expect(new Set(kinds(4))).toEqual(new Set(["jump", "rings", "gates", "runner", "survive", "core"]));
      expect(LEVELS[5].boss).toBe(true);
      expect(kinds(5)[kinds(5).length - 1]).toBe("boss");
      expect(LEVELS[5].boss5).toBeDefined();
      // the timers and star targets climb with the level
      for (let id = 2; id <= 5; id++) {
         expect(LEVELS[id as 2].timerMs).toBeGreaterThan(LEVELS[(id - 1) as 1].timerMs);
         expect(LEVELS[id as 2].starTargetMs).toBeGreaterThan(LEVELS[(id - 1) as 1].starTargetMs);
      }
   });
});

describe("placement", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: every pad gap (and the floor edges) is inside a flat jump's reach; sections never overlap and run in corridor order`, () => {
         const c = courseFor(id);
         for (let i = 1; i < c.sections.length; i++) expect(c.sections[i].z0).toBeGreaterThanOrEqual(c.sections[i - 1].z1 - 1e-9);
         for (const s of c.sections.filter((q) => q.kind === "jump")) {
            const pads = c.pads.filter((p) => p.section === s.index).sort((a, b) => a.z - b.z);
            expect(pads.length).toBeGreaterThan(0);
            let px = 0;
            let pz = s.z0;
            let pr = 0;
            for (const p of pads) {
               const reach = (p.move ? p.move.dx : 0) + Math.hypot(p.x - px, p.z - pz) - p.r - pr;
               expect(reach, `L${id} ${s.name} pad ${p.index}`).toBeLessThan(FLAT - 0.4);
               px = p.x;
               pz = p.z;
               pr = p.r;
            }
            expect(Math.hypot(px, s.z1 - pz) - pr).toBeLessThan(FLAT - 0.4);
            // no two pads overlap at their closest slide
            for (let a = 0; a < pads.length; a++)
               for (let b = a + 1; b < pads.length; b++) {
                  const dz = Math.abs(pads[a].z - pads[b].z);
                  expect(dz).toBeGreaterThan(pads[a].r + pads[b].r - 1e-9);
               }
         }
      });

      it(`level ${id}: rings in corridor order, every door's colour on a switch before its row, beams far enough apart to jump`, () => {
         const c = courseFor(id);
         for (const s of c.sections.filter((q) => q.kind === "rings")) {
            const rings = c.rings.filter((r) => r.section === s.index);
            for (let k = 1; k < rings.length; k++) expect(rings[k].z).toBeGreaterThan(rings[k - 1].z);
            for (const r of rings) {
               expect(Math.abs(r.x) + r.r).toBeLessThan(HALF_W);
               expect(r.z).toBeGreaterThan(s.z0 + 1);
               expect(r.z).toBeLessThan(s.z1 - 1);
            }
         }
         for (const row of c.rows) {
            // a row's own switches: the line 6 m before it (the Sentinel's row reads the arena's three switches)
            const arena = c.sections[row.section].kind === "boss";
            const sw = c.switches.filter((w) => w.section === row.section && w.z < row.z && (arena || w.z >= row.z - 9));
            for (const d of row.doors) expect(sw.some((w) => w.color === d.color), `L${id} row ${row.index} colour ${d.color}`).toBe(true);
            for (const d of row.doors) expect(d.x1 - d.x0).toBeGreaterThanOrEqual(2.5);
         }
         for (const s of c.sections.filter((q) => q.kind === "runner")) {
            const beams = c.lasers.filter((l) => l.section === s.index);
            expect(beams.length).toBeGreaterThan(0);
            const span = beams[0].zb - beams[0].za;
            expect(span / beams.length, `L${id} ${s.name}`).toBeGreaterThanOrEqual(9);
            for (const l of beams) expect(l.speed).toBeLessThanOrEqual(V_RUN);
         }
         for (const s of c.sections.filter((q) => q.kind === "survive")) {
            expect(s.surviveMs).toBeGreaterThanOrEqual(8000);
            // the corner the bot holds stays outside every orb's path
            for (const b of c.blobs.filter((o) => o.section === s.index)) expect(Math.hypot(4.6 - b.cx, s.z0 + 2.4 - b.cz)).toBeGreaterThan(b.r + 1.15 + 0.3);
         }
         for (const s of c.sections.filter((q) => q.kind === "core")) {
            expect(s.core).not.toBeNull();
            expect(s.receptor).not.toBeNull();
            expect(Math.hypot(s.core!.x - s.receptor!.x, s.core!.z - s.receptor!.z)).toBeGreaterThan(6);
         }
      });

      it(`level ${id}: every hero's route and the secrets where their hero gets in; gems along the trail, hidden ones in the nooks`, () => {
         const c = courseFor(id);
         const spec = LEVELS[id];
         expect(c.nooks.some((n) => n.kind === "wall"), "Riko's wall").toBe(true);
         expect(c.nooks.some((n) => n.kind === "gate"), "Vexa's gate").toBe(true);
         expect(c.ledge.y).toBe(LEDGE_LIFT);
         expect(LEDGE_LIFT).toBeGreaterThan((V_JUMP * V_JUMP) / (2 * G) + 0.3);
         expect(c.gems.some((g) => !g.main), "Zuno's hidden gems").toBe(true);
         expect(c.blobs.length + c.lasers.length, "Kiro's hazards (orbs or beams)").toBeGreaterThan(0);
         expect(c.secrets).toHaveLength(SECRETS[id].length);
         c.secrets.forEach((s, i) => {
            const spec2 = SECRETS[id][i];
            if (spec2.id === "sky-shard") {
               expect(s.x).toBeCloseTo(spec.ledge.x, 6);
               expect(s.z).toBeCloseTo(spec.ledge.z, 6);
            } else {
               const nook = c.nooks.find((n) => n.kind === (spec2.id === "void-sticker" ? "gate" : "wall"))!;
               expect(s.x).toBeGreaterThan(NOOK_X);
               expect(Math.abs(s.z - nook.disc.z)).toBeLessThan(0.01);
            }
         });
         // every nook sits beside a floored section (never beside the void)
         for (const n of c.nooks) expect(c.floors.some((f) => f.kind === "floor" && n.disc.z >= f.z0 && n.disc.z <= f.z1), `L${id} nook ${n.kind}`).toBe(true);
         // the ledge is reachable: it sits over a floored stretch of the corridor
         expect(c.floors.some((f) => f.kind === "floor" && spec.ledge.z >= f.z0 && spec.ledge.z <= f.z1)).toBe(true);
         expect(RIKO).toBeGreaterThan(FLAT);
      });
   }
});
