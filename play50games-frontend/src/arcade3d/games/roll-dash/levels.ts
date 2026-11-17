// Roll Dash's five levels: pure data (no React, no three.js). The design cards: the spec
// (docs/master-plan/PLAY50_MENU_2_50_COLOR_ROLL_HEROES_FULL.md "GAME 11 — Roll Dash": a 3-lane endless
// runner, 600 / 900 / 1200 / 1500 / 2000 m, 60-120 s) and the World 6 card (docs/menu2-super/
// world-6-prism-fortress.md "11 Roll Dash": Prism Locks opened by the right hero's power, the hero
// tag-switch, the Echo Storm Hawk). course.ts lays out each level's street.
import type { LevelId } from "../../types";

export interface DashLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** the street's length (m); level 5 runs until the Hawk is beaten */
   length: number;
   /** the base roll speed (m/s) */
   speed: number;
   /** a lock lights up this long before you reach it (s) */
   leadS: number;
   /** the lock colours the level uses (hero ids) */
   locks: readonly ("riko" | "nami" | "kiro" | "zuno" | "vexa")[];
   /** obstacle segments (the spec's 3 / 4 / 5 / 6 / 8) */
   segments: number;
   /** L2 on: double locks (a ghost wall with a barricade 6 m behind) */
   doubles: boolean;
   /** L3: shadow rollers repaint a lock once, 1 s before you reach it; ore carts cross the lanes */
   repaints: boolean;
   /** L4: darkness (a lock shows its colour only in a street lamp's light) and Prism Lock zones (no tagging) */
   night: boolean;
   /** level 5: the Echo Storm Hawk; the win is its defeat */
   boss: boolean;
   /** the third star: the finish time at or under this (the spec's 60 / 75 / 90 / 105 / 120 s, the first
    *  three a few seconds looser: the card wants ~85 % correct unlocks to make it, and the honest bot's
    *  run, which dodges what it can't answer, sets that pace; level 5's is the fight's own pace, its
    *  120 s being the spec's clock, not a goal) */
   targetMs: number;
   /** the run clock's cap (ms): reaching it ends the run "timeup" (unranked) */
   durationMs: number;
}

export const LEVELS: Record<LevelId, DashLevel> = {
   1: { id: 1, name: "Gate Street", length: 600, speed: 9, leadS: 2.0, locks: ["riko", "nami"], segments: 3, doubles: false, repaints: false, night: false, boss: false, targetMs: 63_000, durationMs: 150_000 },
   2: { id: 2, name: "Market Lane", length: 900, speed: 11, leadS: 1.7, locks: ["riko", "nami", "kiro", "zuno", "vexa"], segments: 4, doubles: true, repaints: false, night: false, boss: false, targetMs: 78_000, durationMs: 180_000 },
   3: { id: 3, name: "Old Town", length: 1200, speed: 12.5, leadS: 1.5, locks: ["riko", "nami", "kiro", "zuno", "vexa"], segments: 5, doubles: true, repaints: true, night: false, boss: false, targetMs: 92_000, durationMs: 210_000 },
   4: { id: 4, name: "Night Causeway", length: 1500, speed: 14, leadS: 1.3, locks: ["riko", "nami", "kiro", "zuno", "vexa"], segments: 6, doubles: true, repaints: false, night: true, boss: false, targetMs: 105_000, durationMs: 240_000 },
   5: { id: 5, name: "Fortress Bridge", length: 0, speed: 15, leadS: 1.1, locks: ["riko", "nami", "kiro", "zuno", "vexa"], segments: 8, doubles: false, repaints: false, night: false, boss: true, targetMs: 45_000, durationMs: 300_000 },
};
