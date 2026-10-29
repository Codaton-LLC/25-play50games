// The level end, Menu 2 style: the run's stars (menu2/stars), the no-hit badge and the secrets found go
// to progress (menu2/progress, through its storage adapter), and come back as store stats for the star
// screen (StarResult.tsx).
import { recordLevelResult, localProgressStorage, type ProgressStorage } from "@/arcade3d/menu2/progress/progressStore";
import { foundMask } from "@/arcade3d/menu2/secrets/secrets";
import { SECRETS } from "./progression";
import { runStars, type GongRun } from "./rules";

export const SLUG = "temple-gong-timing";

/** Records the run in progress and returns the star screen's stats (STAT keys). */
export function levelEndStats(run: GongRun, userId: number | null, storage: ProgressStorage = localProgressStorage) {
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
