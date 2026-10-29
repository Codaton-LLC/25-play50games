// Stars, the no-ball-lost badge and the secrets, written to progress and published as store stats.
import { evaluateStars, type StarResult } from "@/arcade3d/menu2/stars/stars";
import { recordLevelResult, localProgressStorage, type ProgressStorage } from "@/arcade3d/menu2/progress/progressStore";
import { foundMask } from "@/arcade3d/menu2/secrets/secrets";
import { SECRETS, starSpecFor } from "./progression";
import { badgeHits, runTimeMs, type PinRun } from "./rules";

export const SLUG = "plate-bounce-arena";

/** Clear, every main orb, and the submitted time at or under the card's target. The badge is no ball lost. */
export function runStars(run: PinRun): StarResult {
   const spec = starSpecFor(run.level, run.table.mainOrbs);
   const cleared = run.ended === "win";
   return evaluateStars(spec, {
      cleared,
      orbs: run.mainOrbs,
      goalValue: cleared ? runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal) : Number.NaN,
      hits: badgeHits(run),
   });
}

export function levelEndStats(run: PinRun, userId: number | null, storage: ProgressStorage = localProgressStorage) {
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
