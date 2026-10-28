import { evaluateStars } from "../../menu2/stars/stars";
import { localProgressStorage, recordLevelResult, type ProgressStorage } from "../../menu2/progress/progressStore";
import { SECRETS, starSpecFor } from "./progression";
import type { WindRun } from "./rules";
export function runStars(r: WindRun) {
   return evaluateStars(starSpecFor(r.level), { cleared: r.end === "win", orbs: r.orbs.filter((o) => o.taken && !o.bonus).length, goalValue: r.finishMs, hits: r.stormTouched ? 1 : 0 });
}
export function levelEndStats(r: WindRun, userId: number | null, storage: ProgressStorage = localProgressStorage) {
   const stars = runStars(r);
   const summary = recordLevelResult(userId, { slug: "wind-tunnel-escape", level: r.level, cleared: stars.clear, stars: stars.mask, noHit: stars.noHit, secrets: SECRETS.filter((_, k) => r.secrets[k]).map((s) => ({ id: s.id, kind: s.kind })) }, storage);
   return { stars: stars.mask, newStars: summary.newStars, noHit: stars.noHit ? 1 : 0, secrets: r.secrets.reduce((m, v, k) => m | (v ? 1 << k : 0), 0), newSecrets: summary.newSecrets.length, xp: summary.xpGained };
}
