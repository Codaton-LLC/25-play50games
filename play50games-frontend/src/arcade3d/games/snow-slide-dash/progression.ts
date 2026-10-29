import type { LevelId } from "../../types";
import type { BossConfig } from "../../menu2/boss/boss";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { StarSpec } from "../../menu2/stars/stars";
import { LEVELS } from "./levels";
export const COMBO = { windowMs: 4000, gain: 0.25, cap: 2 };
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [{ id: "gully", kind: "shard", name: "Hidden gully", hero: "vexa" }],
   2: [{ id: "gully", kind: "shard", name: "Hidden gully", hero: "vexa" }, { id: "rooftop", kind: "shard", name: "Cabin rooftop" }],
   3: [{ id: "gully", kind: "shard", name: "Frozen gully", hero: "vexa" }],
   4: [{ id: "gully", kind: "shard", name: "Lantern gully", hero: "vexa" }, { id: "hats", kind: "sticker", name: "Snowman hat-trick" }],
   5: [{ id: "gully", kind: "shard", name: "Big Drift's gully", hero: "vexa" }],
};
export const starSpecFor = (id: LevelId): StarSpec => ({ orbTotal: LEVELS[id].orbs, goal: { kind: "time", targetMs: LEVELS[id].starTargetMs } });
// Event-driven hits use generous readable vulnerable windows; only real gate/trick events deal damage.
export const BIG_DRIFT: BossConfig = {
   id: "big-drift", name: "Big Drift", maxHp: 5, introMs: 600, transitionMs: 700,
   hitFlashMs: 180, oneHitPerWindow: false, defeatMs: 1800, slowMo: { scale: 0.2, durationMs: 1500 },
   phases: [
      { id: "outrun", name: "Outrun · chain three gates", endsAt: 0.8, attacks: [{ id: "chase", telegraphMs: 600, attackMs: 400, vulnerableMs: 6000 }] },
      { id: "barrage", name: "Barrage · trick, then gate", endsAt: 0.2, attacks: [{ id: "snowball", telegraphMs: 900, attackMs: 600, vulnerableMs: 8000 }] },
      { id: "cliff", name: "Cliff · two spins, aim centre", endsAt: 0, attacks: [{ id: "head", telegraphMs: 600, attackMs: 400, vulnerableMs: 8000 }] },
   ],
};
