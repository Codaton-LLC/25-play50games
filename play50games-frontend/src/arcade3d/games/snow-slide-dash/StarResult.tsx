"use client";
import { useArcadeStore } from "../../core/useArcadeStore";
import { useLevel } from "../../core/level";
import StarScreen from "../../menu2/stars/StarScreen";
import { starLabels } from "../../menu2/stars/stars";
import { useProgress } from "../../menu2/progress/useProgress";
import { levelOf } from "../../menu2/progress/progress";
import { usePlayers } from "../../menu2/multiplayer/players";
import { STAT } from "./rules";
import { SECRETS, starSpecFor } from "./progression";
import type { SnowLevel } from "./levels";
export default function StarResult() {
   const { config } = useLevel<SnowLevel>(), id = config?.id ?? 1;
   const stats = useArcadeStore((s) => s.stats), reason = useArcadeStore((s) => s.endReason);
   const multi = usePlayers((s) => s.phase === "playing"), { data } = useProgress();
   if (reason !== "win" || multi) return null;
   const mask = stats[STAT.secrets] ?? 0;
   return <StarScreen mask={stats[STAT.stars] ?? 0} newMask={stats[STAT.newStars] ?? 0} labels={starLabels(starSpecFor(id))}
      noHit={stats[STAT.noHit] === 1} noHitEver={levelOf(data, "snow-slide-dash", id)?.noHit ?? false}
      secrets={{ found: SECRETS[id].filter((_, i) => mask & (1 << i)).length, total: SECRETS[id].length, newFound: stats[STAT.newSecrets] ?? 0 }} xpGained={stats[STAT.xp] ?? 0} />;
}
