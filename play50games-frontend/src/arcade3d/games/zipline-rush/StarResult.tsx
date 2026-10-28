"use client";
import { useArcadeStore } from "../../core/useArcadeStore";
import StarScreen from "../../menu2/stars/StarScreen";
import { starLabels } from "../../menu2/stars/stars";
import { usePlayers } from "../../menu2/multiplayer/players";
import { starSpecFor } from "./progression";
export default function StarResult() {
   const stats = useArcadeStore((s) => s.stats), level = useArcadeStore((s) => s.levelId), won = useArcadeStore((s) => s.endReason === "win");
   const multi = usePlayers((s) => s.phase === "playing");
   if (!won || multi) return null;
   const count = [1, 2, 4].filter((bit) => (stats.secrets ?? 0) & bit).length;
   return <StarScreen mask={stats.stars ?? 0} newMask={stats.newStars ?? 0} labels={starLabels(starSpecFor(level))} noHit={stats.noHit === 1} secrets={{ found: count, total: 3, newFound: stats.newSecrets ?? 0 }} xpGained={stats.xp ?? 0} />;
}
