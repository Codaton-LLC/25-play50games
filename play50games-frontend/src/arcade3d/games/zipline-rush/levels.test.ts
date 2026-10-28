import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { LEVEL_IDS } from "../../types";
import { serverSyncProblems } from "../../levelSync";
import { bossProblems } from "../../menu2/boss/boss";
import { secretProblems } from "../../menu2/secrets/secrets";
import { memoryProgressStorage, loadProgress } from "../../menu2/progress/progressStore";
import { LEVELS } from "./levels";
import { SECRETS, VOLT_EEL } from "./progression";
import { levelEndStats } from "./levelEnd";
import { ziplineRushMeta } from "./meta";
import { createRun, step } from "./rules";
import { botInput } from "./bot";

describe("five approved levels", () => {
   it("pins names, exact star targets, distinct twists and the three boss phases", () => {
      expect(LEVEL_IDS.map((id) => LEVELS[id].targetMs)).toEqual([50000, 65000, 80000, 90000, 130000]);
      expect(LEVEL_IDS.map((id) => LEVELS[id].name)).toEqual(["Training Line", "Twin Lines", "Moving Landing", "Lighthouse Night", "Zipline Master"]);
      expect(LEVELS[2].crossing && LEVELS[3].moving && LEVELS[4].night && LEVELS[5].boss).toBe(true);
      expect(bossProblems(VOLT_EEL)).toEqual([]);
      expect(VOLT_EEL.phases.map((p) => p.id)).toEqual(["cables", "coiled", "plunge"]);
      expect(VOLT_EEL.phases[0].attacks[0].telegraphMs).toBe(1500);
      expect(secretProblems(SECRETS)).toEqual([]);
   });
   it("matches the disabled backend row and every per-level limit", () => {
      const json = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../../../play50games-backend/play50games/includes/arcade-games.json"), "utf8"));
      expect(serverSyncProblems(ziplineRushMeta, json.games["zipline-rush"])).toEqual([]);
      expect(json.games["zipline-rush"].enabled).toBe(false);
   });
   it("records stars once, preserves progress and awards no repeat XP", () => {
      const r = createRun(1); for (let f = 0; f < 12000 && !r.ended; f++) step(r, 1000 / 60, botInput(r));
      const storage = memoryProgressStorage(); const a = levelEndStats(r, null, storage), b = levelEndStats(r, null, storage);
      expect(a.stars & 1).toBe(1); expect(a.xp).toBeGreaterThan(0); expect(b.xp).toBe(0);
      expect(JSON.stringify(loadProgress(null, storage))).toContain("zipline-rush");
   });
});
