// The level end, Menu 2 style: the run's stars (menu2/stars), the no-hit badge (this game's: never
// swallowed by the curl) and the secrets found go to progress (menu2/progress, through its storage
// adapter), and come back as store stats for the star screen (StarResult.tsx). Called by the Scene on
// a win (before end("win")), on a time-up and when the hearts run out.
import { evaluateStars, type StarResult } from "@/arcade3d/menu2/stars/stars";
import { recordLevelResult, localProgressStorage, type ProgressStorage } from "@/arcade3d/menu2/progress/progressStore";
import { foundMask } from "@/arcade3d/menu2/secrets/secrets";
import { SECRETS, starSpecFor } from "./progression";
import { badgeHits, runTimeMs, type SurfRun } from "./rules";

export const SLUG = "plate-surf";

/**
 * The run's stars: clear, every main orb (the hero-gated bonus orbs are extra), the submitted time at
 * or under the level's target. The badge (StarResult.noHit) is the card's: never swallowed by the curl.
 */
export function runStars(run: SurfRun): StarResult {
   const spec = starSpecFor(run.level, run.course.mainOrbs);
   const cleared = run.ended === "win";
   return evaluateStars(spec, { cleared, orbs: run.mainOrbs, goalValue: cleared ? runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal) : Number.NaN, hits: badgeHits(run) });
}

/** Records the run in progress and returns the star screen's stats (STAT keys). */
export function levelEndStats(run: SurfRun, userId: number | null, storage: ProgressStorage = localProgressStorage) {
   const r = runStars(run);
   const list = SECRETS[run.level];
   const summary = recordLevelResult(
      userId,
      {
         slug: SLUG,
         level: run.level,
         cleared: r.clear,
         stars: r.mask,
         noHit: r.noHit,
         secrets: list.filter((_, i) => run.secrets.found[i]).map((s) => ({ id: s.id, kind: s.kind })),
      },
      storage,
   );
   return {
      stars: r.mask,
      newStars: summary.newStars,
      noHit: r.noHit ? 1 : 0,
      secrets: foundMask(run.secrets),
      newSecrets: summary.newSecrets.length,
      xp: summary.xpGained,
   };
}
