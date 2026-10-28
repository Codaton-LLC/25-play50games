"use client";

import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useLevel } from "@/arcade3d/core/level";
import StarScreen from "@/arcade3d/menu2/stars/StarScreen";
import { starLabels } from "@/arcade3d/menu2/stars/stars";
import { useProgress } from "@/arcade3d/menu2/progress/useProgress";
import { levelOf } from "@/arcade3d/menu2/progress/progress";
import { courseFor, STAT } from "./rules";
import { SECRETS, starSpecFor } from "./progression";
import { SLUG } from "./levelEnd";
import type { SwingLevel } from "./levels";
import { usePlayers } from "@/arcade3d/menu2/multiplayer/players";

export default function StarResult() {
   const { config } = useLevel<SwingLevel>();
   const level = config?.id ?? 1;
   const endReason = useArcadeStore((s) => s.endReason);
   const stats = useArcadeStore((s) => s.stats);
   const { data } = useProgress();
   const multiplayer = usePlayers((s) => s.phase === "playing");
   if (endReason !== "win" || multiplayer) return null;
   const spec = starSpecFor(level, courseFor(level).mainOrbs);
   const secretsMask = stats[STAT.secrets] ?? 0;
   let found = 0;
   for (let i = 0; i < SECRETS[level].length; i++) if ((secretsMask >> i) & 1) found += 1;
   return (
      <StarScreen
         mask={stats[STAT.stars] ?? 0}
         newMask={stats[STAT.newStars] ?? 0}
         labels={starLabels(spec)}
         noHit={(stats[STAT.noHit] ?? 0) === 1}
         noHitEver={levelOf(data, SLUG, level)?.noHit ?? false}
         secrets={{ found, total: SECRETS[level].length, newFound: stats[STAT.newSecrets] ?? 0 }}
         xpGained={stats[STAT.xp] ?? 0}
      />
   );
}
