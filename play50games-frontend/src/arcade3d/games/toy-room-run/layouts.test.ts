// The five playrooms against the card: the signature, the level twists, gaps no jump crosses (so the
// wave's bridge or the drum is the way over), every gap bridged, spares beside their slots, every
// hero's route on every level, the secrets where their hero gets in.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS, SIGNATURE } from "./levels";
import { DASH_BOOST, POWER_MS } from "./heroes";
import { V_AIR, V_JUMP, V_RUN, G, courseFor } from "./rules";
import { inZone } from "./room";
import { SECRETS } from "./progression";

/** The longest jump anyone makes on flat ground: Nami's double, or Riko's dash in the air. */
const airtime = (vy: number) => (2 * vy) / G;
const NAMI = V_RUN * (V_JUMP / G + V_AIR / G + Math.sqrt((2 * ((V_JUMP * V_JUMP) / 60 + (V_AIR * V_AIR) / 60)) / G));
const RIKO = V_RUN * airtime(V_JUMP) + DASH_BOOST * (POWER_MS.dash / 1000);

describe("the card", () => {
   it("is a domino wave with the card's twists per level", () => {
      expect(SIGNATURE).toBe("ride the domino wave");
      expect(LEVELS[1].chains[0].untimed).toBe(true);
      expect(LEVELS[1].drums.length).toBe(1);
      expect(LEVELS[2].chains.some((c) => c.missing?.length)).toBe(true);
      expect(LEVELS[2].chains.some((c) => c.from)).toBe(true);
      expect(LEVELS[3].cars.length).toBeGreaterThanOrEqual(3);
      expect(LEVELS[4].night).toBe(true);
      expect(Math.max(...LEVELS[4].chains.map((c) => c.speed))).toBe(9);
      expect(LEVELS[4].tops.length).toBeGreaterThan(0);
      expect(LEVELS[5].boss).toBe(true);
      // the card: the wave is never far slower than the hero (bar the untimed first beat)
      for (const id of LEVEL_IDS) for (const c of LEVELS[id].chains) if (!c.untimed) expect(c.speed).toBeGreaterThanOrEqual(4);
   });
});

describe("placement", () => {
   for (const id of [1, 2, 3, 4] as const) {
      it(`level ${id}: every gap between desks is wider than any jump, and a chain bridges it (or a drum throws you over)`, () => {
         const c = courseFor(id);
         const desks = c.plats.filter((p) => p.y === 0).sort((a, b) => a.z0 - b.z0);
         for (let g = 0; g < desks.length - 1; g++) {
            const z0 = desks[g].z1;
            const z1 = desks[g + 1].z0;
            expect(z1 - z0, `gap ${g}`).toBeGreaterThan(Math.max(NAMI, RIKO) + 0.5);
            const bridged = c.pieces.some((p) => p.gap && p.z > z0 && p.z < z1);
            const drum = c.drums.some((d) => d.z < z0 && d.z > desks[g].z0) && c.plats.some((p) => p.kind === "shelf" && p.z0 < z0 && p.z1 > z1);
            expect(bridged || drum, `gap ${g}`).toBe(true);
         }
         // the finish is on the last desk
         const last = desks[desks.length - 1];
         expect(c.finish.z).toBeGreaterThan(last.z0);
         expect(c.finish.z).toBeLessThan(last.z1);
      });
   }

   for (const id of LEVEL_IDS) {
      it(`level ${id}: spares lie beside their slots (Zuno's 5 m), the secrets sit where their hero gets in`, () => {
         const c = courseFor(id);
         c.chains.forEach((ch) => {
            for (const sp of ch.spec.spares ?? []) {
               const p = c.pieces[ch.first + sp.slot];
               expect(p.missing).toBe(true);
               expect(Math.hypot(p.x - sp.x, p.z - sp.z)).toBeLessThan(5);
               expect(p.gap).toBe(false);
            }
         });
         const list = SECRETS[id];
         c.secrets.forEach((s, i) => {
            if (list[i].id === "castle-sticker") expect(c.castles.some((z) => inZone(z, s.x, s.z))).toBe(true);
            else if (list[i].id === "wall-shard") expect(c.walls.some((z) => inZone(z, s.x, s.z, 0.6))).toBe(true);
            else expect(c.plats.some((p) => p.kind === "ledge" && s.x >= p.x0 && s.x <= p.x1 && s.z >= p.z0 && s.z <= p.z1)).toBe(true);
         });
      });
   }

   it("every level has every hero's route: a cracked wall (Riko), a pencil and a ledge (Nami), a cascade (Kiro), hidden coins (Zuno), a ghost door (Vexa)", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         expect(c.walls.length, `L${id}`).toBeGreaterThan(0);
         expect(c.pencils.length).toBeGreaterThan(0);
         expect(c.plats.some((p) => p.kind === "ledge")).toBe(true);
         expect(c.cascades.length).toBeGreaterThan(0);
         expect(c.orbs.some((o) => o.hidden)).toBe(true);
         expect(c.ghosts.length).toBeGreaterThan(0);
      }
   });
});
