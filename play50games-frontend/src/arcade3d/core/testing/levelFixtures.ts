// Test fixtures: a real game's meta with five levels added (no game has levels yet). Each level's
// limits grow a little; points levels 1-4 clear at `clearAt(id)`, level 5 has no target; time
// levels clear only on a win.
import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type LevelMeta } from "../../types";

export const LEVEL_TITLES: Record<LevelId, string> = { 1: "First Steps", 2: "Busy Floor", 3: "Copy Room", 4: "Night Shift", 5: "Boss Floor" };

/** points levels: the clear target of level `id` (none on level 5) */
export const clearAt = (id: LevelId): number | undefined => (id === 5 ? undefined : 400 + id * 100);

export function withLevels(meta: ArcadeGameMeta): ArcadeGameMeta {
   const levels: LevelMeta[] = LEVEL_IDS.map((id) => {
      const scoring =
         id === 1
            ? meta.scoring
            : meta.scoring.kind === "points"
              ? { ...meta.scoring, maxScore: meta.scoring.maxScore + (id - 1) * 100, base: meta.scoring.base + (id - 1) * 10 }
              : { ...meta.scoring, timeBaseMs: meta.scoring.timeBaseMs! + (id - 1) * 1000, maxScore: meta.scoring.maxScore + (id - 1) * 100 };
      const clearScore = meta.scoring.kind === "points" ? clearAt(id) : undefined;
      return { id, title: LEVEL_TITLES[id], scoring, ...(clearScore !== undefined ? { clearScore } : {}) };
   });
   return { ...meta, levels };
}
