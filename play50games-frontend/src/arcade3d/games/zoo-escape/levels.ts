// Zoo Escape's five levels: pure data, no React (docs/arcade-levels.md §6.3, README "Levels").
// One zoo, five configurations of the same three stages. Level 1 is today's game and must never
// change: 1.35 s of sight to catch, the meter decays 0.5/s, keepers investigate at 2.0 m/s, two
// bamboo bundles per stage, a catch costs 5 s. levels.test.ts pins it.
//
// The level brief proposed a two-stage 90 s level 1 with today's campaign at levels 3-4; level 1 must
// stay today's game, so every level is the full 3-stage, 180 s escape made harder. Only what the
// keepers do once they notice the panda changes: the map, the routes, the vision and hearing ranges
// and the searchlight stay, so the fairness proofs (fairness.test.ts: a safe route at every phase)
// hold on every level. Per-level lighting is not built (stage 3's dusk stays).
import type { LevelId } from "@/arcade3d/types";

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
}

export const LEVELS: Record<LevelId, ZooLevel> = {
   // Small Enclosure: today's game.
   1: { catchS: 1.35, decay: 0.5, investigate: 2.0, bundles: 2, penalty: 5 },
   // Safari Zone: keepers react a little quicker.
   2: { catchS: 1.25, decay: 0.45, investigate: 2.2, bundles: 2, penalty: 6 },
   // Bird Garden: one bamboo bundle per stage.
   3: { catchS: 1.15, decay: 0.4, investigate: 2.4, bundles: 1, penalty: 7 },
   // Central Zoo: sharper, faster keepers.
   4: { catchS: 1.05, decay: 0.35, investigate: 2.6, bundles: 1, penalty: 8 },
   // Night Escape: the sharpest keepers, a catch costs 10 s.
   5: { catchS: 0.95, decay: 0.3, investigate: 2.8, bundles: 1, penalty: 10 },
};
