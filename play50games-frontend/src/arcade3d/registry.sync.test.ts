import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ARCADE_GAMES } from "./registry";
import { ARCADE_SLUGS } from "./types";

// The server limits live in the WordPress theme; they must match every game's meta.scoring.
const WP_JSON = path.resolve(__dirname, "../../../play50games-backend/play50games/includes/arcade-games.json");
const wp = JSON.parse(fs.readFileSync(WP_JSON, "utf8")) as {
   version: number;
   games: Record<string, Record<string, unknown>>;
};

describe("arcade registry", () => {
   it("has every slug exactly once, in order", () => {
      expect(ARCADE_GAMES.map((g) => g.slug)).toEqual([...ARCADE_SLUGS]);
      expect(ARCADE_GAMES.map((g) => g.order)).toEqual(ARCADE_SLUGS.map((_s, i) => i + 1));
   });

   it("WordPress arcade-games.json has the same games", () => {
      expect(Object.keys(wp.games).sort()).toEqual([...ARCADE_SLUGS].sort());
   });

   for (const game of ARCADE_GAMES) {
      it(`${game.slug}: scoring matches arcade-games.json`, () => {
         const s = game.scoring;
         const server = wp.games[game.slug];
         expect(server.kind).toBe(s.kind);
         expect(server.max_score).toBe(s.maxScore);
         expect(server.min_duration_ms).toBe(s.minDurationMs);
         expect(server.max_duration_ms).toBe(s.maxDurationMs);
         if (s.kind === "points") {
            expect(server.base).toBe(s.base);
            expect(server.max_pps).toBe(s.maxPointsPerSec);
         } else {
            expect(server.time_base_ms).toBe(s.timeBaseMs);
         }
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
      });
   }
});
