import { evaluateStars } from "../../menu2/stars/stars";
import { recordLevelResult, localProgressStorage, type ProgressStorage } from "../../menu2/progress/progressStore";
import { foundMask } from "../../menu2/secrets/secrets";
import { starSpecFor, SECRETS } from "./progression";
import { orbTotal, submittedMs, type Hero, type World } from "./rules";

/** The three stars: clear, every orb, the target time (the submitted time, orb and flow bonus taken off). */
export const runStars = (w: World, h: Hero) =>
   evaluateStars(starSpecFor(w.level, orbTotal(w.level)), { cleared: h.ended === "win", orbs: h.orbs, goalValue: h.ended === "win" ? submittedMs(h) : Infinity, hits: h.hits });

export function levelEndStats(w: World, h: Hero, userId: number | null, storage: ProgressStorage = localProgressStorage) {
   const stars = runStars(w, h);
   const result = recordLevelResult(
      userId,
      { slug: "magnet-coin-lab", level: w.level, cleared: stars.clear, stars: stars.mask, noHit: stars.noHit, secrets: SECRETS.filter((_, i) => h.secrets.found[i]).map((s) => ({ id: s.id, kind: s.kind })) },
      storage
   );
   return { stars: stars.mask, newStars: result.newStars, noHit: stars.noHit ? 1 : 0, noLoss: h.lost === 0 ? 1 : 0, secrets: foundMask(h.secrets), newSecrets: result.newSecrets.length, xp: result.xpGained };
}
