import { evaluateStars } from "../../menu2/stars/stars";
import { recordLevelResult, localProgressStorage, type ProgressStorage } from "../../menu2/progress/progressStore";
import { foundMask } from "../../menu2/secrets/secrets";
import { SECRETS, starSpecFor } from "./progression";
import type { SnowRun } from "./rules";
export const SLUG = "snow-slide-dash";
export function runStars(r: SnowRun) {
   return evaluateStars(starSpecFor(r.level), { cleared: r.ended === "win", orbs: r.orbs, goalValue: r.finishMs || Infinity, hits: r.hits });
}
export function levelEndStats(r: SnowRun, userId: number | null, storage: ProgressStorage = localProgressStorage) {
   const stars = runStars(r);
   const summary = recordLevelResult(userId, { slug: SLUG, level: r.level, cleared: stars.clear, stars: stars.mask,
      noHit: stars.noHit, secrets: SECRETS[r.level].filter((_, i) => r.secrets.found[i]).map((s) => ({ id: s.id, kind: s.kind })) }, storage);
   return { stars: stars.mask, newStars: summary.newStars, noHit: stars.noHit ? 1 : 0, secrets: foundMask(r.secrets), newSecrets: summary.newSecrets.length, xp: summary.xpGained };
}
