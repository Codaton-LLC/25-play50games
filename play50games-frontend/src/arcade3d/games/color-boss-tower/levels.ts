// Color Boss Tower's five levels (docs/menu2-super/world-6-prism-fortress.md "30 Color Boss Tower";
// level names from docs/master-plan/menu2-index.json). Plain data. One base tower (the hollow tower of
// Shadow Plates' fortress: ledges spiral up its inner wall round the boss in the central shaft) and five
// configurations of it. The play is 2.5D on the cylinder: a hero is an arc position `a` (metres round
// the walking ring, radius R_PATH) and a height `y`. Ledge `i` of the spiral is centred at a = i * STEP_ARC
// and stands at y = i * RISE.
import type { LevelId } from "../../types";
import type { TagColour } from "../../menu2/heroTag/rules";

/** The design card's signature. layouts.test.ts pins it. */
export const SIGNATURE = "the boss fight is a climb, and the tower is your weapon";

/** the tower's inner wall and the ring the heroes walk */
export const R_WALL = 12;
export const R_PATH = 10.5;
export const STEPS_PER_LOOP = 12;
export const STEP_ARC = (2 * Math.PI * R_PATH) / STEPS_PER_LOOP;
export const RISE = 0.7;
export const LOOP_RISE = RISE * STEPS_PER_LOOP;
/** a ledge's length along the ring (the rest of a step is the gap you jump) */
export const LEDGE_LEN = 4.0;
/** Nami's loop skip: two skip ledges above a ledge, SKIP_RISE apart, then the ledge one loop up */
export const SKIP_RISE = LOOP_RISE / 3;
/** a yellow claw sits this high on the wall over its ledge: past a plain jump, inside Zuno's magnet */
export const YELLOW_LIFT = 4.5;

export interface ClawSpec {
   /** the ledge it stands on (its spiral index) */
   ledge: number;
   colour: TagColour;
   /** on a skip ledge (Nami) or high on the wall (Zuno's magnet reaches it from its ledge): height above the ledge */
   lift?: number;
}

export interface SecretSpec {
   kind: "ghostNiche" | "crackedWindow" | "highNiche";
   ledge: number;
   /** height above the ledge */
   lift: number;
}

export interface TowerSpec {
   id: LevelId;
   name: string;
   /** the level's ledges: 0 .. ledges - 1 */
   ledges: number;
   /** ledges with a Nami loop skip above them (skip ledges at +SKIP_RISE and +2 SKIP_RISE) */
   skips: number[];
   claws: ClawSpec[];
   /** L3: every ledge crumbles CRUMBLE_MS after you land on it, back after REFORM_MS */
   crumbling: boolean;
   /** L2+: hazard orbs roll down the spiral (one per boss telegraph) */
   hazardOrbs: boolean;
   /** the boss: hits to defeat (the card's cycles) and which config (progression.ts) */
   cycles: number;
   boss: "stone" | "grand";
   /** checkpoints: ledges you respawn on after a fall (the highest reached) */
   checkpoints: number[];
   /** 5 orbs, on the loop-skip ledges and the high claws' ledges: (ledge, lift) */
   orbs: { ledge: number; lift: number }[];
   secrets: SecretSpec[];
   /** the clock runs out: an unranked time-up */
   timerMs: number;
   /** the third star: the submitted time at or under this */
   starTargetMs: number;
   night: boolean;
}

export const LEVELS: Record<LevelId, TowerSpec> = {
   // L1 Training Guardian: three beats. Climb two loops and charge a red claw as Riko (the cannon fires
   // at the dozing guardian and he wakes); his slow sweep (jump it); a blue claw on a high ledge for Nami.
   1: {
      id: 1,
      name: "Training Guardian",
      ledges: 30,
      skips: [14],
      claws: [
         { ledge: 9, colour: "red" },
         { ledge: 14, colour: "blue", lift: 2 * 2.8 },
         { ledge: 20, colour: "green" },
         { ledge: 25, colour: "yellow", lift: YELLOW_LIFT },
      ],
      crumbling: false,
      hazardOrbs: false,
      cycles: 2,
      boss: "stone",
      checkpoints: [0, 12, 24],
      orbs: [
         { ledge: 14, lift: 2.8 + 1 },
         { ledge: 14, lift: 5.6 + 1 },
         { ledge: 6, lift: 1.2 },
         { ledge: 17, lift: 1.2 },
         { ledge: 27, lift: 1.2 },
      ],
      secrets: [
         { kind: "ghostNiche", ledge: 11, lift: 0 },
         { kind: "crackedWindow", ledge: 22, lift: 0 },
         { kind: "highNiche", ledge: 14, lift: 5.6 },
      ],
      timerMs: 150_000,
      starTargetMs: 70_000,
      night: false,
   },
   // L2 Two Colors: hazard orbs roll down the spiral (jump them or shield).
   2: {
      id: 2,
      name: "Two Colors",
      ledges: 40,
      skips: [10, 26],
      claws: [
         { ledge: 8, colour: "red" },
         { ledge: 10, colour: "blue", lift: 2 * 2.8 },
         { ledge: 18, colour: "purple" },
         { ledge: 26, colour: "blue", lift: 2 * 2.8 },
         { ledge: 31, colour: "yellow", lift: YELLOW_LIFT },
         { ledge: 35, colour: "green" },
      ],
      crumbling: false,
      hazardOrbs: true,
      cycles: 3,
      boss: "stone",
      checkpoints: [0, 12, 24, 36],
      orbs: [
         { ledge: 10, lift: 3.8 },
         { ledge: 26, lift: 3.8 },
         { ledge: 26, lift: 6.6 },
         { ledge: 15, lift: 1.2 },
         { ledge: 33, lift: 1.2 },
      ],
      secrets: [
         { kind: "ghostNiche", ledge: 19, lift: 0 },
         { kind: "crackedWindow", ledge: 29, lift: 0 },
         { kind: "highNiche", ledge: 10, lift: 5.6 },
      ],
      timerMs: 180_000,
      starTargetMs: 90_000,
      night: false,
   },
   // L3 Three Colors: the spiral crumbles (a ledge drops 2 s after you land on it; Riko sprints across).
   3: {
      id: 3,
      name: "Three Colors",
      ledges: 48,
      skips: [12, 30],
      claws: [
         { ledge: 7, colour: "green" },
         { ledge: 12, colour: "blue", lift: 2 * 2.8 },
         { ledge: 19, colour: "red" },
         { ledge: 25, colour: "yellow", lift: YELLOW_LIFT },
         { ledge: 30, colour: "blue", lift: 2 * 2.8 },
         { ledge: 37, colour: "purple" },
         { ledge: 43, colour: "red" },
      ],
      crumbling: true,
      hazardOrbs: true,
      cycles: 4,
      boss: "stone",
      checkpoints: [0, 12, 24, 36],
      orbs: [
         { ledge: 12, lift: 3.8 },
         { ledge: 30, lift: 3.8 },
         { ledge: 30, lift: 6.6 },
         { ledge: 22, lift: 1.2 },
         { ledge: 40, lift: 1.2 },
      ],
      secrets: [
         { kind: "ghostNiche", ledge: 16, lift: 0 },
         { kind: "crackedWindow", ledge: 34, lift: 0 },
         { kind: "highNiche", ledge: 12, lift: 5.6 },
      ],
      timerMs: 210_000,
      starTargetMs: 110_000,
      night: true,
   },
   // L4 Fast Switch Boss: the Stone Guardian at his fury. P1: four claw colours; P2: he climbs alongside
   // you and the cannons need a chain charge (two claws within 4 s) to fire.
   4: {
      id: 4,
      name: "Fast Switch Boss",
      ledges: 52,
      skips: [12, 36],
      claws: [
         { ledge: 6, colour: "red" },
         { ledge: 12, colour: "blue", lift: 2 * 2.8 },
         { ledge: 18, colour: "green" },
         { ledge: 23, colour: "yellow", lift: YELLOW_LIFT },
         { ledge: 29, colour: "purple" },
         { ledge: 33, colour: "red" },
         { ledge: 34, colour: "green" },
         { ledge: 41, colour: "purple" },
         { ledge: 42, colour: "red" },
         { ledge: 47, colour: "green" },
         { ledge: 48, colour: "purple" },
      ],
      crumbling: false,
      hazardOrbs: true,
      cycles: 5,
      boss: "stone",
      checkpoints: [0, 12, 24, 36, 48],
      orbs: [
         { ledge: 12, lift: 3.8 },
         { ledge: 36, lift: 3.8 },
         { ledge: 36, lift: 6.6 },
         { ledge: 26, lift: 1.2 },
         { ledge: 45, lift: 1.2 },
      ],
      secrets: [
         { kind: "ghostNiche", ledge: 21, lift: 0 },
         { kind: "crackedWindow", ledge: 39, lift: 0 },
         { kind: "highNiche", ledge: 12, lift: 5.6 },
      ],
      timerMs: 240_000,
      starTargetMs: 130_000,
      night: true,
   },
   // L5 Grand Color Guardian, the tower's crown. P1 Plate Armour: one claw lights at a time, its cannon
   // knocks that colour's plate off. P2 Spire Collapse: his beam drains a charged core after 6 s, so two
   // cannons must fire in one opening (a chain charge). P3 Grey Heart: the cannons die; five glyphs light
   // on his core one by one, tag through the heroes to hit each.
   5: {
      id: 5,
      name: "Grand Color Guardian",
      ledges: 44,
      skips: [10, 30],
      claws: [
         { ledge: 5, colour: "red" },
         { ledge: 8, colour: "green" },
         { ledge: 10, colour: "blue", lift: 2 * 2.8 },
         { ledge: 14, colour: "purple" },
         { ledge: 17, colour: "yellow", lift: YELLOW_LIFT },
         { ledge: 21, colour: "red" },
         { ledge: 22, colour: "green" },
         { ledge: 26, colour: "purple" },
         { ledge: 27, colour: "red" },
         { ledge: 33, colour: "green" },
         { ledge: 34, colour: "purple" },
      ],
      crumbling: false,
      hazardOrbs: true,
      cycles: 6,
      boss: "grand",
      checkpoints: [0, 12, 24, 36],
      orbs: [
         { ledge: 10, lift: 3.8 },
         { ledge: 30, lift: 3.8 },
         { ledge: 30, lift: 6.6 },
         { ledge: 19, lift: 1.2 },
         { ledge: 38, lift: 1.2 },
      ],
      secrets: [
         { kind: "ghostNiche", ledge: 15, lift: 0 },
         { kind: "crackedWindow", ledge: 35, lift: 0 },
         { kind: "highNiche", ledge: 10, lift: 5.6 },
      ],
      timerMs: 300_000,
      starTargetMs: 180_000,
      night: false,
   },
};
