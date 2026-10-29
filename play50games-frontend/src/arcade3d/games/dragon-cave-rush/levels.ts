// Dragon Cave Rush's five levels: pure data (no React, no three.js). core/README.md "Levels".
// One crystal cave and five configurations of the same verb (CHASE CART, the design card): ride a mine
// cart on rails, lean into curves, hop gaps and rocks, duck beams and breath, with Cindermaw the dragon
// behind you. track.ts builds each level's rails and hazards; these are the numbers.
import type { LevelId } from "@/arcade3d/types";

export interface CaveLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** the run clock's cap (ms): reaching it ends the run "timeup" (unranked); also the time base */
   durationMs: number;
   /** the cart's track speed (m/s): the card's 14 m/s on L1 up to 22 m/s on L5 */
   speed: number;
   /** the third star: the submitted time at or under this */
   starTargetMs: number;
   /** the cave is dark (L3 Glow Tunnel): lit by glow mushrooms and the dragon's breath */
   dark: boolean;
   /** level 5: Cindermaw, the loop round her repeats until she is free */
   boss: boolean;
}

export const LEVELS: Record<LevelId, CaveLevel> = {
   1: { id: 1, name: "Crystal Entry", durationMs: 90_000, speed: 14, starTargetMs: 52_000, dark: false, boss: false },
   2: { id: 2, name: "Rockfall", durationMs: 110_000, speed: 16, starTargetMs: 60_000, dark: false, boss: false },
   3: { id: 3, name: "Glow Tunnel", durationMs: 120_000, speed: 18, starTargetMs: 64_000, dark: true, boss: false },
   4: { id: 4, name: "Deep Cave", durationMs: 130_000, speed: 20, starTargetMs: 68_000, dark: false, boss: false },
   5: { id: 5, name: "Dragon Hoard", durationMs: 180_000, speed: 22, starTargetMs: 100_000, dark: false, boss: true },
};
