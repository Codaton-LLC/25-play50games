import { evaluateStars } from "../../menu2/stars/stars";
import { recordLevelResult, localProgressStorage, type ProgressStorage } from "../../menu2/progress/progressStore";
import { foundMask } from "../../menu2/secrets/secrets";
import { SECRETS, starSpecFor } from "./progression";
import { runTimeMs, type FactoryRun } from "./rules";
export const SLUG = "robot-factory-run";
export function runStars(r: FactoryRun) {
   return evaluateStars(starSpecFor(r.level), { cleared: r.ended === "win", orbs: r.orbs, goalValue: r.ended === "win" ? runTimeMs(r.finishMs, r.orbs, r.combo.bonusTotal) : NaN, hits: r.hits + r.board.lost });
}
export function levelEndStats(r: FactoryRun, userId: number | null, storage: ProgressStorage = localProgressStorage) {
   const s = runStars(r);
   const summary = recordLevelResult(userId, { slug: SLUG, level: r.level, cleared: s.clear, stars: s.mask, noHit: s.noHit, secrets: SECRETS[r.level].filter((_, i) => r.secrets.found[i]).map((v) => ({ id: v.id, kind: v.kind })) }, storage);
   return { stars: s.mask, newStars: summary.newStars, noHit: s.noHit ? 1 : 0, secrets: foundMask(r.secrets), newSecrets: summary.newSecrets.length, xp: summary.xpGained };
}
