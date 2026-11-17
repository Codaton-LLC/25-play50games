import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "../../types";
import { serverSyncProblems } from "../../levelSync";
import { bossProblems } from "../../menu2/boss/boss";
import { secretProblems } from "../../menu2/secrets/secrets";
import { comboConfigProblems } from "../../menu2/combo/combo";
import { defaultHeroFor } from "../../menu2/heroes/heroPick";
import { memoryProgressStorage, loadProgress } from "../../menu2/progress/progressStore";
import { LEVELS, parseCourse } from "./levels";
import { COMBO, SECRETS, SENTINEL } from "./progression";
import { mirrorDashMeta } from "./meta";
import { createWorld, step } from "./rules";
import { botInput } from "./bot";
import { levelEndStats } from "./levelEnd";

describe("the five halls", () => {
   it("pins the card's names, twists, speeds and star targets", () => {
      expect(LEVEL_IDS.map((id) => LEVELS[id].name)).toEqual(["Mirror Lane", "Converge", "Frosted Glass", "Echo", "Glass Hall"]);
      const zones = (id: 1 | 2 | 3 | 4 | 5) => new Set(parseCourse(id).zones);
      expect([...zones(1)]).toEqual(["mirror"]);
      expect(zones(2).has("merge")).toBe(true);
      expect(zones(3).has("frost")).toBe(true);
      expect(zones(4).has("echo")).toBe(true);
      expect(zones(5)).toEqual(new Set(["mirror", "merge", "frost", "echo"]));
      expect(LEVELS[5].boss).toBe(true);
      for (const id of LEVEL_IDS) {
         expect(LEVELS[id].targetMs).toBeLessThan(LEVELS[id].durationMs);
         expect(LEVELS[id].speed[0]).toBeGreaterThanOrEqual(9);
         expect(LEVELS[id].speed[1]).toBeLessThanOrEqual(14);
      }
      // the first two levels stay slow enough to read six lanes on a phone
      expect(LEVELS[1].speed[1]).toBeLessThanOrEqual(11);
      expect(LEVELS[2].speed[1]).toBeLessThanOrEqual(11.5);
   });
   for (const id of LEVEL_IDS) {
      it(`L${id}: orbs on both runways (about half on the reflection's), checkpoints, a finish`, () => {
         const c = parseCourse(id);
         const refl = c.orbs.filter((o) => o.body === 1).length;
         expect(c.orbs.length).toBeGreaterThanOrEqual(6);
         expect(refl).toBeGreaterThanOrEqual(c.orbs.length / 2 - 1);
         expect(c.checkpoints.length).toBeGreaterThanOrEqual(2);
         expect(c.endS).toBeGreaterThan(200);
      });
   }
   it("the three secrets sit once each, on the levels the card names", () => {
      const where = (sid: number) => LEVEL_IDS.filter((id) => parseCourse(id).secrets.some((s) => s.secret === sid));
      expect(where(0)).toEqual([4]);
      expect(where(1)).toEqual([2]);
      expect(where(2)).toEqual([3]);
   });
   it("the shared configs are valid: the Sentinel's three phases, the secrets, the combo", () => {
      expect(bossProblems(SENTINEL)).toEqual([]);
      expect(SENTINEL.phases.map((p) => p.id)).toEqual(["rain", "shield", "chest"]);
      expect(secretProblems(SECRETS)).toEqual([]);
      expect(comboConfigProblems(COMBO)).toEqual([]);
      expect(defaultHeroFor("mirror-dash", null)).toBe("vexa");
   });
   it("matches the disabled backend row and every per-level limit", () => {
      const json = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../../../play50games-backend/play50games/includes/arcade-games.json"), "utf8"));
      expect(serverSyncProblems(mirrorDashMeta, json.games["mirror-dash"])).toEqual([]);
      expect(json.games["mirror-dash"].enabled).toBe(false);
      expect(mirrorDashMeta.order).toBe(88);
   });
   it("records stars once, keeps progress and pays no repeat XP", () => {
      const w = createWorld(1, ["vexa"]);
      for (let f = 0; f < 60 * 120 && !w.ended; f++) step(w, 1000 / 60, botInput(w));
      expect(w.ended).toBe("win");
      const storage = memoryProgressStorage();
      const a = levelEndStats(w, w.pairs[0], null, storage);
      const b = levelEndStats(w, w.pairs[0], null, storage);
      expect(a.stars & 3).toBe(3);
      expect(a.flawless).toBe(1);
      expect(a.xp).toBeGreaterThan(0);
      expect(b.xp).toBe(0);
      expect(JSON.stringify(loadProgress(null, storage))).toContain("mirror-dash");
   });
});
