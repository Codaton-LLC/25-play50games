// Zoo Escape's five levels: pure data, no React (docs/arcade-levels.md §6.3, README "Levels").
// Each level is its own map (level.ts MAP_1 = today's zoo; maps.ts levels 2-5: Safari Zone with
// jeeps, Bird Garden with birds, Central Zoo with crowds, Night Escape with two searchlights) plus
// the keepers' settings, which ramp: quicker catches, slower decay, faster investigations, fewer
// bamboo bundles, dearer catches. Level 1 is today's game and must never change (levels.test.ts).
// Every map has its own fairness proof (fairness.test.ts, fairness.level-N.test.ts).
import type { LevelId } from "@/arcade3d/types";
import { MAP_1, type ZooMap } from "./level";
import { MAP_2, MAP_3, MAP_4, MAP_5 } from "./maps";

export interface ZooLevel {
   /** seconds of continuous sight to fill the meter (SUSPICION.catchS); the same for every device */
   catchS: number;
   /** meter decay per second out of sight (SUSPICION.decay) */
   decay: number;
   /** keeper speed while investigating, m/s (KEEPER.investigateSpeed) */
   investigate: number;
   /** bamboo bundles per stage (TOSS.perStage, at most 2) */
   bundles: number;
   /** clock seconds a catch costs (CATCH.penalty) */
   penalty: number;
   /** the level's map (level.ts MAP_1 = today's zoo; maps.ts levels 2-5) */
   map: ZooMap;
}

export const LEVELS: Record<LevelId, ZooLevel> = {
   // Small Enclosure: today's game.
   1: { catchS: 1.35, decay: 0.5, investigate: 2.0, bundles: 2, penalty: 5, map: MAP_1 },
   // Safari Zone: keepers react a little quicker.
   2: { catchS: 1.25, decay: 0.45, investigate: 2.2, bundles: 2, penalty: 6, map: MAP_2 },
   // Bird Garden: one bamboo bundle per stage.
   3: { catchS: 1.15, decay: 0.4, investigate: 2.4, bundles: 1, penalty: 7, map: MAP_3 },
   // Central Zoo: sharper, faster keepers.
   4: { catchS: 1.05, decay: 0.35, investigate: 2.6, bundles: 1, penalty: 8, map: MAP_4 },
   // Night Escape: the sharpest keepers, a catch costs 10 s.
   5: { catchS: 0.95, decay: 0.3, investigate: 2.8, bundles: 1, penalty: 10, map: MAP_5 },
};
