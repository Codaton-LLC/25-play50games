// The level end, Menu 2 style: the run's stars (menu2/stars), the no-hit badge and the secrets found
// go to progress (menu2/progress, through its storage adapter), and come back as store stats for the
// star screen (StarResult.tsx, M3). The par-shots badge (the card's golf bonus) rides along as a
// store stat: the shot count is stored for the badge but never feeds the score.
import { evaluateStars, type StarResult } from "@/arcade3d/menu2/stars/stars";
import { recordLevelResult, localProgressStorage, type ProgressStorage } from "@/arcade3d/menu2/progress/progressStore";
import { foundMask } from "@/arcade3d/menu2/secrets/secrets";
import { LEVELS } from "./levels";
import { SECRETS, starSpecFor } from "./progression";
import { badgeHits, runTimeMs, type CannonRun } from "./rules";

export const SLUG = "roll-cannon-jump";

/**
 * The run's stars: clear, every main orb (the hero-gated bonus orbs are extra), the submitted time at
 * or under the show target. The badge (StarResult.noHit) is this game's clean show: no fall at all.
 */
export function runStars(run: CannonRun): StarResult {
   const spec = starSpecFor(run.level, run.course.mainOrbs);
   const cleared = run.ended === "win";
   return evaluateStars(spec, { cleared, orbs: run.mainOrbs, goalValue: cleared ? runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal) : Number.NaN, hits: badgeHits(run) });
}

/**
 * Records the run in progress and returns the star screen's stats (STAT keys). `par` is this run's
 * par-shots badge: 1 when the show finished at or under the level's par (LEVELS[level].parShots).
 */
export function levelEndStats(run: CannonRun, userId: number | null, storage: ProgressStorage = localProgressStorage) {
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
      /** the golf badge: 1 when the show took no more shots than par (stored, never scored) */
      par: run.ended === "win" && run.shots <= LEVELS[run.level].parShots ? 1 : 0,
      shots: run.shots,
   };
}
