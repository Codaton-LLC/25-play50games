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
import { LEVELS, T, parseRoom } from "./levels";
import { COMBO, MAGNUS, SECRETS } from "./progression";
import { magnetCoinLabMeta } from "./meta";
import { createWorld, step } from "./rules";
import { botInput } from "./bot";
import { levelEndStats } from "./levelEnd";

describe("the five labs", () => {
   it("pins the card's names, room counts, twists and star targets", () => {
      expect(LEVEL_IDS.map((id) => LEVELS[id].name)).toEqual(["Basic Magnet", "Two Poles", "Moving Metal", "Drone Lab", "Scrap Magnus"]);
      expect(LEVEL_IDS.map((id) => LEVELS[id].rooms.length)).toEqual([5, 5, 5, 5, 3]);
      expect(LEVEL_IDS.map((id) => LEVELS[id].targetMs)).toEqual([90_000, 120_000, 150_000, 170_000, 180_000]);
      const rooms = (id: 1 | 2 | 3 | 4 | 5) => LEVELS[id].rooms.map(parseRoom);
      const has = (id: 1 | 2 | 3 | 4 | 5, t: number) => rooms(id).some((r) => r.tiles.includes(t));
      expect(has(1, T.GATE_P) || has(1, T.GATE_N)).toBe(false);
      expect(has(2, T.GATE_P) && has(2, T.GATE_N)).toBe(true);
      expect(rooms(3).every((r) => r.blocks.length > 0)).toBe(true);
      expect(rooms(4).filter((r) => r.drones.length > 0).length).toBeGreaterThanOrEqual(4);
      expect(rooms(5).filter((r) => r.boss).length).toBe(1);
      for (const id of LEVEL_IDS) expect(LEVELS[id].targetMs).toBeLessThan(LEVELS[id].durationMs);
   });
   for (const id of LEVEL_IDS) {
      it(`L${id}: every room 24 x 10 with a start, a door, a bank (or Magnus), coins enough for the quota and 1-3 orbs`, () => {
         for (const def of LEVELS[id].rooms) {
            const r = parseRoom(def);
            expect(r.w).toBe(24);
            expect(r.h).toBe(10);
            if (r.boss) {
               expect(r.need).toBe(0);
               continue;
            }
            expect(r.need).toBeGreaterThan(0);
            expect(r.piles.reduce((n, p) => n + p.count, 0)).toBeGreaterThanOrEqual(r.need);
            expect(r.orbs.length).toBeGreaterThanOrEqual(1);
            expect(r.orbs.length).toBeLessThanOrEqual(3);
         }
      });
   }
   it("the three secrets sit once each: storage shard behind a ghost wall, sticker behind glass, vault shard behind the vent's hidden wall", () => {
      const all = LEVEL_IDS.flatMap((id) => LEVELS[id].rooms.map((def) => ({ id, r: parseRoom(def) })));
      const where = (sid: number) => all.filter((x) => x.r.secrets.some((s) => s.id === sid));
      expect(where(0).map((x) => x.id)).toEqual([2]);
      expect(where(1).map((x) => x.id)).toEqual([4]);
      expect(where(2).map((x) => x.id)).toEqual([3]);
      expect(where(0)[0].r.tiles.includes(T.GHOST)).toBe(true);
      expect(where(1)[0].r.tiles.includes(T.GLASS)).toBe(true);
      expect(where(2)[0].r.tiles.includes(T.HIDDEN)).toBe(true);
   });
   it("the shared configs are valid: Magnus's three phases, the secrets, the combo", () => {
      expect(bossProblems(MAGNUS)).toEqual([]);
      expect(MAGNUS.phases.map((p) => p.id)).toEqual(["tug", "storm", "core"]);
      expect(secretProblems(SECRETS)).toEqual([]);
      expect(comboConfigProblems(COMBO)).toEqual([]);
      expect(defaultHeroFor("magnet-coin-lab", null)).toBe("zuno");
   });
   it("matches the disabled backend row and every per-level limit", () => {
      const json = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../../../play50games-backend/play50games/includes/arcade-games.json"), "utf8"));
      expect(serverSyncProblems(magnetCoinLabMeta, json.games["magnet-coin-lab"])).toEqual([]);
      expect(json.games["magnet-coin-lab"].enabled).toBe(false);
      expect(magnetCoinLabMeta.order).toBe(82);
   });
   it("records stars once, keeps progress and pays no repeat XP", () => {
      const w = createWorld(1, ["zuno"]);
      for (let f = 0; f < 60 * 120 && !w.ended; f++) step(w, 1000 / 60, botInput(w));
      expect(w.ended).toBe("win");
      const storage = memoryProgressStorage();
      const a = levelEndStats(w, w.heroes[0], null, storage);
      const b = levelEndStats(w, w.heroes[0], null, storage);
      expect(a.stars & 1).toBe(1);
      expect(a.noLoss).toBe(1);
      expect(a.xp).toBeGreaterThan(0);
      expect(b.xp).toBe(0);
      expect(JSON.stringify(loadProgress(null, storage))).toContain("magnet-coin-lab");
   });
});
