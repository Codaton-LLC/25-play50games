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
import { LEVELS, T, parseLevel } from "./levels";
import { COMBO, ROCKJAW, SECRETS } from "./progression";
import { mineTunnelRunMeta } from "./meta";
import { createWorld, shortestCells, step } from "./rules";
import { botInput } from "./bot";
import { levelEndStats } from "./levelEnd";

describe("the five mines", () => {
   it("pins the card's names, the twists and the star targets", () => {
      expect(LEVEL_IDS.map((id) => LEVELS[id].name)).toEqual(["Dry Tunnel", "Pipe Zone", "Water Gaps", "Fast Tunnel", "Deep Mine Sprint"]);
      const m = LEVEL_IDS.map((id) => parseLevel(LEVELS[id]));
      expect(m[0].w).toBe(20);
      expect(m[0].h).toBe(40);
      expect(LEVELS[1].durationMs).toBe(90_000);
      expect(m[1].rails.length).toBeGreaterThanOrEqual(3);
      expect(m[2].pockets.length).toBeGreaterThanOrEqual(3);
      expect(LEVELS[4].rockfall).toEqual({ startMs: 15_000, rowMs: 600 });
      expect(m[3].beetles.filter((b) => b.tunneller).length).toBeGreaterThanOrEqual(4);
      expect(m[4].arena?.plugs.length).toBe(4);
      for (const id of LEVEL_IDS) expect(LEVELS[id].targetMs).toBeLessThan(LEVELS[id].durationMs);
   });
   for (const id of LEVEL_IDS) {
      it(`L${id}: 20-28 cells wide, 40-80 deep, a start, a reachable lift, lanterns, orbs and all three secrets`, () => {
         const m = parseLevel(LEVELS[id]);
         expect(m.w).toBeGreaterThanOrEqual(20);
         expect(m.w).toBeLessThanOrEqual(28);
         expect(m.h).toBeGreaterThanOrEqual(40);
         expect(m.h).toBeLessThanOrEqual(80);
         expect(shortestCells(m, m.start, (c, r) => c === m.lift.col && r === m.lift.row)).toBeLessThan(Infinity);
         expect(m.lantern.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(id === 1 ? 2 : 2);
         expect(m.orb.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(3);
         const secrets = new Set(Array.from(m.secret).filter((s) => s > 0));
         expect(secrets).toEqual(new Set([1, 2, 3]));
         // the lift is never under a boulder column (boulders never seal it)
         for (const b of m.boulders) expect(b.col === m.lift.col && b.row < m.lift.row && m.tiles[(b.row + 1) * m.w + b.col] === T.EMPTY).toBe(false);
      });
   }
   it("the shared configs are valid: Rockjaw's three phases, the secrets, the combo", () => {
      expect(bossProblems(ROCKJAW)).toEqual([]);
      expect(ROCKJAW.phases.map((p) => p.id)).toEqual(["drop", "burrow", "flipped"]);
      expect(ROCKJAW.phases[1].attacks[0].telegraphMs).toBe(1000);
      expect(secretProblems(SECRETS)).toEqual([]);
      expect(comboConfigProblems(COMBO)).toEqual([]);
      expect(defaultHeroFor("mine-tunnel-run", null)).toBe("riko");
   });
   it("matches the disabled backend row and every per-level limit", () => {
      const json = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../../../play50games-backend/play50games/includes/arcade-games.json"), "utf8"));
      expect(serverSyncProblems(mineTunnelRunMeta, json.games["mine-tunnel-run"])).toEqual([]);
      expect(json.games["mine-tunnel-run"].enabled).toBe(false);
      expect(mineTunnelRunMeta.order).toBe(64);
   });
   it("records stars once, keeps progress and pays no repeat XP", () => {
      const w = createWorld(1, ["riko"]);
      for (let f = 0; f < 60 * 90 && !w.ended; f++) step(w, 1000 / 60, botInput(w));
      expect(w.ended).toBe("win");
      const storage = memoryProgressStorage();
      const a = levelEndStats(w, w.heroes[0], null, storage);
      const b = levelEndStats(w, w.heroes[0], null, storage);
      expect(a.stars & 1).toBe(1);
      expect(a.xp).toBeGreaterThan(0);
      expect(b.xp).toBe(0);
      expect(JSON.stringify(loadProgress(null, storage))).toContain("mine-tunnel-run");
   });
});
