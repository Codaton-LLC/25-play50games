// The level end, Menu 2 style: stars, the no-cut badge and the secrets go to progress and come back as
// store stats for the star screen. Called when the round runs out and on the Glutton's defeat.
import { evaluateStars, type StarResult } from "@/arcade3d/menu2/stars/stars";
import { recordLevelResult, localProgressStorage, type ProgressStorage } from "@/arcade3d/menu2/progress/progressStore";
import { foundMask } from "@/arcade3d/menu2/secrets/secrets";
import { SECRETS, starSpecFor } from "./progression";
import { badgeHits, levelCleared, type GemRun } from "./rules";

export const SLUG = "gem-collector-3d";

/** Clear (the target score, or the Glutton down), all five orbs, and the clear reached in time. */
export function runStars(run: GemRun): StarResult {
   const spec = starSpecFor(run.level, run.arena.orbs.length);
   const cleared = levelCleared(run);
   const when = run.boss ? run.simMs : run.reachedAt;
   return evaluateStars(spec, {
      cleared,
      orbs: run.orbs,
      goalValue: cleared ? when : Number.NaN,
      hits: badgeHits(run),
   });
}

export function levelEndStats(run: GemRun, userId: number | null, storage: ProgressStorage = localProgressStorage) {
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
