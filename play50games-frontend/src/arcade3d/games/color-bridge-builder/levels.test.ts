import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "../../types";
import { serverSyncProblems } from "../../levelSync";
import { bossProblems } from "../../menu2/boss/boss";
import { secretProblems } from "../../menu2/secrets/secrets";
import { comboConfigProblems } from "../../menu2/combo/combo";
import { memoryProgressStorage, loadProgress } from "../../menu2/progress/progressStore";
import { LEVELS, T, parseLevel } from "./levels";
import { COMBO, KEEPER, SECRETS } from "./progression";
import { colorBridgeBuilderMeta } from "./meta";
import { createWorld, step } from "./rules";
import { botInput } from "./bot";
import { levelEndStats } from "./levelEnd";

describe("the five canyons", () => {
   it("pins the card's names, twists and star targets", () => {
      expect(LEVEL_IDS.map((id) => LEVELS[id].name)).toEqual(["Two Switches", "Prisms", "Split Bridge", "Timed Bridge", "Canyon Gate"]);
      expect(parseLevel(LEVELS[1]).prisms).toHaveLength(0);
      expect(parseLevel(LEVELS[2]).prisms.length).toBeGreaterThan(0);
      expect(LEVELS[4].drones.length).toBeGreaterThan(0);
      expect(LEVELS[4].nodes.some((n) => n.timedMs === 10_000)).toBe(true);
      expect(LEVELS[5].boss).toBe(true);
      expect(parseLevel(LEVELS[5]).plate).not.toBeNull();
      for (const id of LEVEL_IDS) expect(LEVELS[id].targetMs).toBeLessThan(LEVELS[id].durationMs);
   });
   for (const id of LEVEL_IDS) {
      it(`L${id}: a start, an exit, every node's switch, orbs; every switch cycles a node that has a cycle`, () => {
         const m = parseLevel(LEVELS[id]);
         expect(m.tiles[m.start[0] * m.w + m.start[1]]).toBe(T.ROCK);
         expect(m.tiles[m.exit[0] * m.w + m.exit[1]]).toBe(T.EXIT);
         expect(m.orbs.length).toBeGreaterThanOrEqual(2);
         for (const [, , node] of m.switches) expect(LEVELS[id].nodes[node].cycle?.length).toBeGreaterThan(1);
      });
   }
   it("the three secrets sit once each: the flicker shard (L3), the green-ledge sticker (L2), the cracked-rock shard (L4)", () => {
      const where = (sid: number) => LEVEL_IDS.filter((id) => LEVELS[id].secret === sid && parseLevel(LEVELS[id]).secret);
      expect(where(0)).toEqual([3]);
      expect(where(1)).toEqual([2]);
      expect(where(2)).toEqual([4]);
   });
   it("the shared configs are valid: the Keeper's three phases, the secrets, the combo", () => {
      expect(bossProblems(KEEPER)).toEqual([]);
      expect(KEEPER.phases.map((p) => p.id)).toEqual(["primaries", "mixes", "white"]);
      expect(secretProblems(SECRETS)).toEqual([]);
      expect(comboConfigProblems(COMBO)).toEqual([]);
   });
   it("matches the disabled backend row and every per-level limit", () => {
      const json = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../../../play50games-backend/play50games/includes/arcade-games.json"), "utf8"));
      expect(serverSyncProblems(colorBridgeBuilderMeta, json.games["color-bridge-builder"])).toEqual([]);
      expect(json.games["color-bridge-builder"].enabled).toBe(false);
      expect(colorBridgeBuilderMeta.order).toBe(98);
   });
   it("records stars once, keeps progress and pays no repeat XP", () => {
      const w = createWorld(1, ["riko"]);
      for (let f = 0; f < 60 * 120 && !w.ended; f++) step(w, 1000 / 60, botInput(w));
      expect(w.ended).toBe("win");
      const storage = memoryProgressStorage();
      const a = levelEndStats(w, w.teams[0], null, storage);
      const b = levelEndStats(w, w.teams[0], null, storage);
      expect(a.stars & 3).toBe(3);
      expect(a.xp).toBeGreaterThan(0);
      expect(b.xp).toBe(0);
      expect(JSON.stringify(loadProgress(null, storage))).toContain("color-bridge-builder");
   });
});
