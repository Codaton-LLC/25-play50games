"use client";
import { useArcadeStore } from "../../core/useArcadeStore";
import { useLevel } from "../../core/level";
import StarScreen from "../../menu2/stars/StarScreen";
import { starLabels } from "../../menu2/stars/stars";
import { usePlayers } from "../../menu2/multiplayer/players";
import { starSpecFor } from "./progression";
import type { WindLevel } from "./levels";
export default function StarResult() {
   const { config } = useLevel<WindLevel>();
   const stats = useArcadeStore((s) => s.stats);
   const win = useArcadeStore((s) => s.endReason === "win");
   const multi = usePlayers((s) => s.phase === "playing");
   if (!win || multi) return null;
   return <StarScreen mask={stats.stars ?? 0} newMask={stats.newStars ?? 0} labels={starLabels(starSpecFor(config?.id ?? 1))} noHit={stats.noHit === 1} secrets={{ found: [0, 1, 2].filter((k) => ((stats.secrets ?? 0) >> k) & 1).length, total: 3, newFound: stats.newSecrets ?? 0 }} xpGained={stats.xp ?? 0} />;
}
