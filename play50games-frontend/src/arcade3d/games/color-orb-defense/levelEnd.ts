// Stars, the clean-defence badge and the secrets, written to progress and published as store stats.
import { evaluateStars, type StarResult } from "@/arcade3d/menu2/stars/stars";
import { recordLevelResult, localProgressStorage, type ProgressStorage } from "@/arcade3d/menu2/progress/progressStore";
import { foundMask } from "@/arcade3d/menu2/secrets/secrets";
import { SECRETS, starSpecFor } from "./progression";
import { PROPOSED_LEVEL_LIMITS, badgeHits, type DefenseRun } from "./rules";

export const SLUG = "color-orb-defense";

/** Clear (every wave survived), every regular orb blocked, and the score target. The badge: no leak, no knock. */
export function runStars(run: DefenseRun): StarResult {
   const spec = starSpecFor(run.level, run.arena.spawns.length, PROPOSED_LEVEL_LIMITS[run.level].maxScore);
   const cleared = run.ended === "win";
   return evaluateStars(spec, { cleared, orbs: run.orbsBlocked, goalValue: cleared ? run.score : Number.NaN, hits: badgeHits(run) });
}

export function levelEndStats(run: DefenseRun, userId: number | null, storage: ProgressStorage = localProgressStorage) {
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
