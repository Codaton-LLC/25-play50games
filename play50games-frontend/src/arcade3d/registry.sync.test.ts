import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ARCADE_GAMES } from "./registry";
import { levelMetaProblems } from "./levelMeta";
import { serverSyncProblems } from "./levelSync";
import { ARCADE_SLUGS } from "./types";

// The server limits live in the WordPress theme; they must match every game's meta.scoring and,
// for a game with five levels, every meta.levels[i].scoring (arcade-games.json v4 `levels`).
const WP_JSON = path.resolve(__dirname, "../../../play50games-backend/play50games/includes/arcade-games.json");
const wp = JSON.parse(fs.readFileSync(WP_JSON, "utf8")) as {
   version: number;
   games: Record<string, Record<string, unknown>>;
};

describe("arcade registry", () => {
   it("has every slug exactly once, in order", () => {
      expect(ARCADE_GAMES.map((g) => g.slug)).toEqual([...ARCADE_SLUGS]);
      // order 53 is left for flooded-ruins-escape (another branch); lava-pillar-jump is 54
      expect(ARCADE_GAMES.map((g) => g.order)).toEqual(ARCADE_SLUGS.map((slug, i) => (slug === "lava-pillar-jump" ? 54 : i + 1)));
   });

   it("WordPress arcade-games.json has the same games", () => {
      expect(Object.keys(wp.games).sort()).toEqual([...ARCADE_SLUGS].sort());
   });

   for (const game of ARCADE_GAMES) {
      it(`${game.slug}: scoring (and levels) match arcade-games.json`, () => {
         const server = wp.games[game.slug];
         expect(serverSyncProblems(game, server)).toEqual([]);
         if (game.status === "live") expect(server.enabled).toBe(true);
      });

      it(`${game.slug}: limits are consistent`, () => {
         const s = game.scoring;
         expect(s.minDurationMs).toBeLessThan(s.maxDurationMs);
         if (s.kind === "time") {
            // the best possible time score must fit under maxScore
            expect(Math.floor((s.timeBaseMs! - s.minDurationMs) / 10)).toBeLessThanOrEqual(s.maxScore);
            expect(s.display).toBe("time");
         }
         expect(levelMetaProblems(game)).toEqual([]);
         for (const level of game.levels ?? []) {
            const ls = level.scoring;
            if (ls.kind === "time") {
               expect(Math.floor((ls.timeBaseMs! - ls.minDurationMs) / 10)).toBeLessThanOrEqual(ls.maxScore);
            }
         }
      });
   }
});
