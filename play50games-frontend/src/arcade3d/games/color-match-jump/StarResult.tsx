"use client";

// The Menu 2 star screen at the top of the result card after a clear (levelEnd.ts published the stats).
import { useArcadeStore } from "../../core/useArcadeStore";
import { useLevel } from "../../core/level";
import StarScreen from "../../menu2/stars/StarScreen";
import { starLabels } from "../../menu2/stars/stars";
import { useProgress } from "../../menu2/progress/useProgress";
import { levelOf } from "../../menu2/progress/progress";
import { courseFor } from "./course";
import { STAT } from "./rules";
import { SECRETS, starSpecFor } from "./progression";
import { SLUG } from "./levelEnd";
import type { CmjLevel } from "./levels";

export default function StarResult() {
   const { config } = useLevel<CmjLevel>();
   const level = config?.id ?? 1;
   const endReason = useArcadeStore((s) => s.endReason);
   const stats = useArcadeStore((s) => s.stats);
   const { data } = useProgress();
   if (endReason !== "win") return null;
   const spec = starSpecFor(level, courseFor(level).orbTotal);
   const mask = stats[STAT.secrets] ?? 0;
   let found = 0;
   for (let i = 0; i < SECRETS[level].length; i++) if ((mask >> i) & 1) found += 1;
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
