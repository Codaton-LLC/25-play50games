// The level end, Menu 2 style: the run's stars (menu2/stars), the "no dropped disc" badge and the
// secrets found go to progress (menu2/progress, through its storage adapter), and come back as store
// stats for the star screen (StarResult.tsx). Called by the Scene on a clear (before end("win")) and on
// a time-up (the secrets are kept).
import { evaluateStars, type StarResult } from "@/arcade3d/menu2/stars/stars";
import { recordLevelResult, localProgressStorage, type ProgressStorage } from "@/arcade3d/menu2/progress/progressStore";
import { foundMask } from "@/arcade3d/menu2/secrets/secrets";
import { SECRETS, starSpecFor } from "./progression";
import { badgeHits, type DiscRun } from "./rules";

export const SLUG = "disc-target-throw";

/** The run's stars: a clear, every orb, the clear at or under the target time. */
export function runStars(run: DiscRun): StarResult {
   const spec = starSpecFor(run.level, run.course.orbCount);
   const cleared = run.ended === "win";
   return evaluateStars(spec, { cleared, orbs: run.orbs, goalValue: cleared ? run.finishMs : Number.NaN, hits: badgeHits(run) });
}

/** Records the run in progress and returns the star screen's stats (STAT keys). */
export function levelEndStats(run: DiscRun, userId: number | null, storage: ProgressStorage = localProgressStorage) {
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
