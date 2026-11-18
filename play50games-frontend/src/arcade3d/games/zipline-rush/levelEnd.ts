import { evaluateStars } from "../../menu2/stars/stars";
import { recordLevelResult, localProgressStorage, type ProgressStorage } from "../../menu2/progress/progressStore";
import { foundMask } from "../../menu2/secrets/secrets";
import { starSpecFor, SECRETS } from "./progression";
import type { ZipRun } from "./rules";
export const runStars = (r: ZipRun) => evaluateStars(starSpecFor(r.level), { cleared: r.ended === "win", orbs: r.orbs, goalValue: r.finishMs, hits: r.hits + r.cfg.sections - r.centres });
export function levelEndStats(r: ZipRun, userId: number | null, storage: ProgressStorage = localProgressStorage) {
   const stars = runStars(r);
   const result = recordLevelResult(userId, { slug: "zipline-rush", level: r.level, cleared: stars.clear, stars: stars.mask, noHit: stars.noHit, secrets: SECRETS.filter((_, i) => r.secrets.found[i]).map((s) => ({ id: s.id, kind: s.kind })) }, storage);
   return { stars: stars.mask, newStars: result.newStars, noHit: stars.noHit ? 1 : 0, secrets: foundMask(r.secrets), newSecrets: result.newSecrets.length, xp: result.xpGained };
}
