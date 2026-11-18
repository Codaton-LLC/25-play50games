// The level end, Menu 2 style: stars (menu2/stars), the no-crack badge and the secrets go to progress
// (menu2/progress) and come back as store stats for the star screen (StarResult.tsx).
import { evaluateStars, type StarResult } from "../../menu2/stars/stars";
import { recordLevelResult, localProgressStorage, type ProgressStorage } from "../../menu2/progress/progressStore";
import { foundMask } from "../../menu2/secrets/secrets";
import { SECRETS, starSpecFor } from "./progression";
import type { CmjRun } from "./rules";

export const SLUG = "color-match-jump";

/** Clear / every orb / the crown inside the target time. No-hit = no cracked landing and no heart lost. */
export function runStars(r: CmjRun): StarResult {
   const cleared = r.ended === "win";
   return evaluateStars(starSpecFor(r.level, r.course.orbTotal), { cleared, orbs: r.orbs, goalValue: cleared ? r.finishMs : Number.NaN, hits: r.hits });
}

export function levelEndStats(r: CmjRun, userId: number | null, storage: ProgressStorage = localProgressStorage) {
   const s = runStars(r);
   const summary = recordLevelResult(
      userId,
      { slug: SLUG, level: r.level, cleared: s.clear, stars: s.mask, noHit: s.noHit, secrets: SECRETS[r.level].filter((_, i) => r.secrets.found[i]).map((x) => ({ id: x.id, kind: x.kind })) },
      storage,
   );
   return { stars: s.mask, newStars: summary.newStars, noHit: s.noHit ? 1 : 0, secrets: foundMask(r.secrets), newSecrets: summary.newSecrets.length, xp: summary.xpGained };
}
