// The level end, Menu 2 style: the run's stars (menu2/stars), the no-stumble badge (the card's) and the
// secrets found go to progress (menu2/progress, through its storage adapter), and come back as store
// stats for the star screen (StarResult.tsx). Called by the Scene at the end of every run.
import { evaluateStars, type StarResult } from "@/arcade3d/menu2/stars/stars";
import { recordLevelResult, localProgressStorage, type ProgressStorage } from "@/arcade3d/menu2/progress/progressStore";
import { foundMask } from "@/arcade3d/menu2/secrets/secrets";
import { SECRETS, starSpecFor } from "./progression";
import { badgeHits, bankOf, type TempleRun } from "./rules";

export const SLUG = "temple-coin-rush";

/**
 * The run's stars: clear, all three relic orbs (each behind a toll lane or a hero gate), and the coin
 * bank target at the finish (the card: L1 20 banked coins). The badge (StarResult.noHit) is the
 * card's: no stumble.
 */
export function runStars(run: TempleRun): StarResult {
   const spec = starSpecFor(run.level, run.course.orbs.length);
   const cleared = run.ended === "win";
   return evaluateStars(spec, { cleared, orbs: run.orbs, goalValue: cleared ? bankOf(run) : Number.NaN, hits: badgeHits(run) });
}

/** Records the run in progress and returns the star screen's stats (STAT keys). */
export function levelEndStats(run: TempleRun, userId: number | null, storage: ProgressStorage = localProgressStorage) {
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
