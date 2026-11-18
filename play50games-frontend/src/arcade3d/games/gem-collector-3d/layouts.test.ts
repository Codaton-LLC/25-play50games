// Gem Collector 3D's five vaults: the signature, every gem on open floor inside the rim (or on its
// pedestal, in the pocket or the vault), every hero's route on every level (Riko's pocket, Nyla's
// pedestal gold, Kiro's tail hazard, Zuno's rim trail, Vexa's vault), beacons clear of the walls,
// five orbs, three secrets, and a target the level's gems can reach.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { BANK_R, LINK_WEIGHT, arenaFor, inBox, linkSupply } from "./arena";
import { LEVELS, SIGNATURE } from "./levels";
import { bankBound } from "./rules";
import { SECRETS } from "./progression";

describe("the vaults", () => {
   it("the card's signature: the gem train", () => {
      expect(SIGNATURE).toBe("the gem train");
   });

   for (const id of LEVEL_IDS) {
      it(`level ${id}: gems inside the rim, off the walls, pits and pedestal sides; beacons clear`, () => {
         const a = arenaFor(id);
         for (let i = 0; i < a.gems.length; i++) {
            const g = a.gems[i];
            expect(Math.hypot(g.x, g.z), `gem ${i}`).toBeLessThan(a.radius - 0.4);
            for (const s of a.solids) expect(inBox(s, g.x, g.z, 0.2), `gem ${i} in a wall`).toBe(false);
            if (g.y === 0) for (const p of a.pedestals) expect(Math.hypot(g.x - p.x, g.z - p.z), `gem ${i} on a pedestal side`).toBeGreaterThan(0.9);
         }
         for (const b of a.beacons) {
            expect(Math.hypot(b.x, b.z)).toBeLessThan(a.radius - BANK_R);
            for (const s of a.solids) expect(inBox(s, b.x, b.z, BANK_R)).toBe(false);
            for (const p of a.pedestals) expect(Math.hypot(b.x - p.x, b.z - p.z)).toBeGreaterThan(BANK_R + 1);
         }
         expect(Math.hypot(a.startX, a.startZ)).toBeLessThan(a.radius - 1);
      });

      it(`level ${id}: all five heroes have their route`, () => {
         const a = arenaFor(id);
         // Riko: gold behind the cracked wall (in the pocket)
         expect(a.gems.some((g) => g.kind === "gold" && inBox(a.pocket, g.x, g.z))).toBe(true);
         // Nyla: gold on the high pedestal (above a plain jump's 1.2 m apex)
         expect(a.gems.some((g) => g.kind === "gold" && g.y >= 2)).toBe(true);
         // Kiro: something that cuts the tail (a frost sweeper, slimes, or the Glutton's minis)
         expect(a.sweepers.length + a.spec.slimes.length + (a.spec.boss ? 1 : 0)).toBeGreaterThan(0);
         // Zuno: a hidden trail at the rim
         const trail = a.gems.filter((g) => g.hidden);
         expect(trail.length).toBeGreaterThanOrEqual(5);
         for (const g of trail) expect(Math.hypot(g.x, g.z)).toBeGreaterThan(a.radius - 2);
         // Vexa: the back vault behind the ghost wall, with gold and the sticker
         expect(a.gems.some((g) => inBox(a.vault, g.x, g.z))).toBe(true);
         expect(inBox(a.vault, a.secrets[0].x, a.secrets[0].z)).toBe(true);
      });

      it(`level ${id}: five orbs, three secrets, and a target the gems can reach`, () => {
         const a = arenaFor(id);
         expect(a.orbs).toHaveLength(5);
         expect(a.secrets).toHaveLength(SECRETS[id].length);
         for (const o of a.orbs) expect(Math.hypot(o.x, o.z)).toBeLessThan(a.radius - 0.4);
         // reachable without any power: the open floor's supply alone covers the target
         let open = 0;
         for (const g of a.gems) if (!g.hidden && g.y === 0 && !inBox(a.pocket, g.x, g.z) && !inBox(a.vault, g.x, g.z)) open += LINK_WEIGHT[g.kind];
         expect(bankBound(open)).toBeGreaterThan(LEVELS[id].targetScore * 1.5);
         expect(linkSupply(a)).toBeGreaterThanOrEqual(open);
      });
   }

   it("each level adds its own twist: tiles (2), slimes (3), chests and a moving beacon (4), the boss (5)", () => {
      expect(LEVELS[1].tiles).toBeNull();
      expect(LEVELS[2].tiles?.cells.length).toBe(16);
      expect(LEVELS[3].slimes.length).toBe(3);
      expect(LEVELS[4].chests.length).toBe(4);
      expect(LEVELS[4].beaconEveryMs).toBe(15_000);
      expect(LEVELS[4].night).toBe(true);
      expect(LEVELS[5].boss).toBe(true);
      expect(LEVEL_IDS.filter((id) => LEVELS[id].boss)).toEqual([5]);
      // the card's targets
      expect([1, 2, 3, 4].map((id) => LEVELS[id as 1].targetScore)).toEqual([300, 600, 900, 1200]);
   });
});
