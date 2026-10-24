// The client/server limit comparison behind registry.sync.test.ts (meta.ts vs arcade-games.json),
// levels included (docs/arcade-levels.md §4.1). Pure; tested on fixtures in levelMeta.test.ts.
import type { ArcadeGameMeta, ScoringRules } from "./types";

/** Problems between one set of server limits (snake_case) and the client's rules; [] = equal. */
export function limitMismatches(server: Record<string, unknown>, rules: ScoringRules): string[] {
   const out: string[] = [];
   const check = (key: string, value: unknown) => {
      if (server[key] !== value) out.push(`${key}: server ${String(server[key])}, client ${String(value)}`);
   };
   check("max_score", rules.maxScore);
   check("min_duration_ms", rules.minDurationMs);
   check("max_duration_ms", rules.maxDurationMs);
   if (rules.kind === "points") {
      check("base", rules.base);
      check("max_pps", rules.maxPointsPerSec);
   } else {
      check("time_base_ms", rules.timeBaseMs);
   }
   return out;
}

/** Problems between a game's meta and its arcade-games.json entry, levels included; [] = in sync. */
export function serverSyncProblems(game: ArcadeGameMeta, server: Record<string, unknown>): string[] {
   const out: string[] = [];
   if (server.kind !== game.scoring.kind) out.push(`kind: server ${String(server.kind)}, client ${game.scoring.kind}`);
   out.push(...limitMismatches(server, game.scoring));
   const levels = server.levels;
   if (!game.levels) {
      if (levels !== undefined) out.push("the server has `levels`, meta.ts has none");
      return out;
   }
   if (!Array.isArray(levels) || levels.length !== game.levels.length) {
      out.push(`levels: server has ${Array.isArray(levels) ? levels.length : "none"}, meta.ts has ${game.levels.length}`);
      return out;
   }
   game.levels.forEach((level, index) => {
      const entry = levels[index] as Record<string, unknown>;
      for (const problem of limitMismatches(entry, level.scoring)) out.push(`level ${index + 1} ${problem}`);
   });
   // levels[0] equals the top level (the v3 PHP reads only the top-level keys = level 1)
   for (const problem of limitMismatches(levels[0] as Record<string, unknown>, game.scoring)) out.push(`levels[0] vs top level ${problem}`);
   return out;
}
