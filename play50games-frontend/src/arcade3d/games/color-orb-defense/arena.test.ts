// The five arenas follow the card: 4 / 6 / 8 / 10 / 12 waves (level 5: 9 waves and the Mortar's three
// phases), 2 / 3 / 4 / 4 / 5 colours, the drone from level 2, blink orbs from level 3, pairs from level 4;
// every orb's colour has a zone on its lane; the schedule fits the clock.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { bossProblems } from "@/arcade3d/menu2/boss/boss";
import { secretProblems } from "@/arcade3d/menu2/secrets/secrets";
import { MORTAR, SECRETS } from "./progression";
import { BOSS_WAVES, R_ARENA, ZONE_R, buildArena } from "./arena";
import { LEVELS } from "./levels";

describe("arenas", () => {
   it("waves and colours per level (the card)", () => {
      expect(LEVEL_IDS.map((id) => buildArena(id).waves + (id === 5 ? BOSS_WAVES : 0))).toEqual([4, 6, 8, 10, 12]);
      expect(LEVEL_IDS.map((id) => buildArena(id).colors)).toEqual([2, 3, 4, 4, 5]);
      expect(LEVEL_IDS.map((id) => LEVELS[id].drone)).toEqual([false, true, true, true, true]);
      expect(buildArena(2).spawns.some((s) => s.periodMs > 0)).toBe(false);
      expect(buildArena(3).spawns.some((s) => s.periodMs > 0)).toBe(true);
      const pairs = (id: 3 | 4) => buildArena(id).spawns.some((s, i, all) => i > 0 && all[i - 1].t === s.t);
      expect(pairs(3)).toBe(false);
      expect(pairs(4)).toBe(true);
   });

   it("every orb's colours have a zone on its lane; the zones sit inside the arena, apart", () => {
      for (const id of LEVEL_IDS) {
         const a = buildArena(id);
         for (const s of a.spawns) {
            const colours = a.lanes[s.lane].zones.map((zi) => a.zones[zi].color);
            expect(colours).toContain(s.color);
            expect(colours).toContain(s.alt);
         }
         for (const z of a.zones) expect(Math.hypot(z.x, z.z) + ZONE_R).toBeLessThan(R_ARENA);
         for (let i = 0; i < a.zones.length; i++)
            for (let j = i + 1; j < a.zones.length; j++) expect(Math.hypot(a.zones[i].x - a.zones[j].x, a.zones[i].z - a.zones[j].z)).toBeGreaterThan(2 * ZONE_R);
      }
   });

   it("the waves end well inside the clock; the boss and the secrets are well formed", () => {
      for (const id of LEVEL_IDS) expect(buildArena(id).wavesEndMs).toBeLessThan(LEVELS[id].durationMs * 0.75);
      expect(bossProblems(MORTAR)).toEqual([]);
      for (const id of LEVEL_IDS) expect(secretProblems(SECRETS[id])).toEqual([]);
   });
});
