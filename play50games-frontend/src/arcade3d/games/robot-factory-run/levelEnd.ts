// The level end, Menu 2 style: stars (menu2/stars), the badge (no hit and no scrapped cell), the
// secrets found go to progress (menu2/progress) and come back as stats for the star screen.
import { evaluateStars, type StarResult } from "@/arcade3d/menu2/stars/stars";
import { recordLevelResult, localProgressStorage, type ProgressStorage } from "@/arcade3d/menu2/progress/progressStore";
import { foundMask } from "@/arcade3d/menu2/secrets/secrets";
import { SECRETS, starSpecFor } from "./progression";
import { badgeHits, mainOrbTotal, runTimeMs, type FactoryRun } from "./rules";

export const SLUG = "robot-factory-run";

export function runStars(run: FactoryRun): StarResult {
   const spec = starSpecFor(run.level, mainOrbTotal(run.floor));
   const cleared = run.ended === "win";
   return evaluateStars(spec, { cleared, orbs: run.mainOrbs, goalValue: cleared ? runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal) : Number.NaN, hits: badgeHits(run) });
}

export function levelEndStats(run: FactoryRun, userId: number | null, storage: ProgressStorage = localProgressStorage) {
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
