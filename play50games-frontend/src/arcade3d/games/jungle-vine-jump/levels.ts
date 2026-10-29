// Jungle Vine Jump's five levels: pure data (no React, no three.js). The design card
// (docs/menu2-super/world-3-wild-temples.md "8 Jungle Vine Jump"): climb a giant jungle tree by
// swinging on vines, sliding the grip up and down mid-swing. The climb's layouts are course.ts.
import type { LevelId } from "../../types";

/**
 * One beat of a climb, in order round the tree (course.ts turns them into pads and vines):
 * - `pad`: a platform `gap` m further round, its top `rise` m over the last platform's top (from a
 *   vine: over the vine's anchor less 5 m, so a release from the swing lands on it);
 * - `vine`: a vine `gap` m further round, its anchor `rise` m over the last anchor (from a platform:
 *   over the platform's top plus 4.6 m, so a jump off the platform reaches it);
 * - `net`: a safety leaf under the gap before it (the card's L1 third beat);
 * `r` a pad's radius, `kind` the vine's kind (dry vines snap, glow vines hide the secret).
 */
export type Beat =
   | { t: "pad"; gap: number; rise: number; r?: number; kind?: "branch" | "leaf" | "step" }
   | { t: "vine"; gap: number; rise: number; kind?: "live" | "dry" | "glow" | "arch" }
   | { t: "net"; under: number };

export interface VineLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** the climb (course.ts reads the beats) */
   beats: readonly Beat[];
   /** the third star: the submitted time at or under this (the card's target times, L1 75 s to L5 210 s) */
   targetMs: number;
   /** the run clock's cap (ms): reaching it ends the run "timeup" (unranked) */
   durationMs: number;
   /** L2: branches bob ±0.6 m and the vines rooted on them move with them */
   bob: boolean;
   /** L3: snapper plants bite on a 2 s cycle beside the landing pads */
   snappers: boolean;
   /** L4: fruit-throwing monkeys on perches beside the climb */
   monkeys: number;
   /** the dotted release arc (L1-L2 only, the card) */
   arcPreview: boolean;
   /** level 5: the Howler King in the crown; the win is his defeat, not the top */
   boss: boolean;
}

const pad = (gap: number, rise: number, r = 1.6, kind: "branch" | "leaf" | "step" = "branch"): Beat => ({ t: "pad", gap, rise, r, kind });
const vine = (gap: number, rise: number, kind: "live" | "dry" | "glow" | "arch" = "live"): Beat => ({ t: "vine", gap, rise, kind });
const net = (under: number): Beat => ({ t: "net", under });

/** Stairs up: hops from one branch stub to the next (1.5 m higher each; they never bob). */
const stairs = (n: number): Beat[] => Array.from({ length: n }, () => pad(2.6, 1.5, 1.3, "step"));
/** A climb block: stairs, then a vine run of `vines` vines to a platform (about 4.6 m up for two vines). */
const block = (vines: number, kinds: readonly ("live" | "dry" | "glow" | "arch")[] = [], landing: "branch" | "leaf" = "branch"): Beat[] => [
   ...stairs(2),
   vine(3.4, 0, kinds[0] ?? "live"),
   ...Array.from({ length: vines - 1 }, (_, i) => vine(7, 2, kinds[i + 1] ?? "live")),
   pad(5.6, 0, landing === "leaf" ? 1.8 : 1.6, landing),
];

export const LEVELS: Record<LevelId, VineLevel> = {
   1: {
      id: 1, name: "Green Start", targetMs: 75_000, durationMs: 200_000, bob: false, snappers: false, monkeys: 0, arcPreview: true, boss: false,
      beats: [
         // 1: one vine over a safe leaf pad: grab, pump, release
         vine(3.4, 0), pad(5.6, 0, 2.2, "leaf"),
         // 2: two vines far apart: slide down to reach the far one
         vine(3.4, 0), vine(8.2, 1.2), pad(5.6, 0),
         // 3: a vine-to-vine catch over a 4 m drop, with a net leaf under it
         vine(3.4, 0), net(1), vine(7, 2), pad(5.6, 0),
         ...stairs(2),
         vine(3.4, 0), vine(7, 2), vine(7, 2), pad(5.6, 0),
         ...stairs(2),
         vine(3.4, 0), vine(7, 2), pad(5.6, 0, 1.8, "leaf"),
         ...stairs(2),
         ...block(2), ...block(3, [], "leaf"), ...block(2),
         ...stairs(2),
         vine(3.4, 0, "glow"), vine(7, 2), pad(5.6, 0, 2.4),
      ],
   },
   2: {
      id: 2, name: "Branch Climb", targetMs: 105_000, durationMs: 240_000, bob: true, snappers: false, monkeys: 0, arcPreview: true, boss: false,
      beats: [
         vine(3.4, 0), vine(7, 2), pad(5.6, 0),
         ...stairs(2),
         vine(3.4, 0), vine(7, 2), vine(7.2, 2), pad(5.6, 0),
         ...stairs(1),
         vine(3.4, 0), vine(7.4, 1.8), pad(5.6, 0, 1.8, "leaf"),
         ...stairs(2),
         vine(3.4, 0), vine(7, 2), vine(7, 2), pad(5.6, 0),
         ...stairs(2),
         vine(3.4, 0, "glow"), vine(7.2, 2), pad(5.6, 0),
         ...block(3), ...block(2, [], "leaf"), ...block(3),
         ...stairs(1),
         vine(3.4, 0), vine(7, 2), pad(5.6, 0, 2.4),
      ],
   },
   3: {
      id: 3, name: "Swinging Vines", targetMs: 140_000, durationMs: 280_000, bob: false, snappers: true, monkeys: 0, arcPreview: false, boss: false,
      beats: [
         vine(3.4, 0), vine(7, 2, "dry"), pad(5.6, 0),
         ...stairs(2),
         vine(3.4, 0), vine(7, 2, "dry"), vine(7, 2), pad(5.6, 0),
         ...stairs(2),
         vine(3.4, 0), vine(7.2, 2), pad(5.6, 0, 1.8, "leaf"),
         ...stairs(1),
         vine(3.4, 0), vine(7, 2, "dry"), vine(7, 2), pad(5.6, 0),
         ...stairs(2),
         vine(3.4, 0, "glow"), vine(7, 2, "dry"), pad(5.6, 0),
         ...stairs(2),
         ...block(3, ["live", "dry", "live"]), ...block(2, ["live", "dry"], "leaf"), ...block(3, ["live", "live", "dry"]),
         ...block(2, ["live", "dry"]), ...block(3, ["live", "dry", "live"], "leaf"),
         ...stairs(2),
         vine(3.4, 0), vine(7, 2), vine(7, 2), pad(5.6, 0, 2.4),
      ],
   },
   4: {
      id: 4, name: "Ruins", targetMs: 170_000, durationMs: 320_000, bob: false, snappers: false, monkeys: 3, arcPreview: false, boss: false,
      beats: [
         vine(3.4, 0), vine(7, 2, "arch"), pad(5.6, 0),
         ...stairs(2),
         vine(3.4, 0), vine(7, 2), vine(7, 2, "arch"), pad(5.6, 0),
         ...stairs(2),
         vine(3.4, 0, "arch"), vine(7.2, 2), pad(5.6, 0, 1.8, "leaf"),
         ...stairs(2),
         vine(3.4, 0), vine(7, 2, "arch"), vine(7, 2), pad(5.6, 0),
         ...stairs(2),
         vine(3.4, 0, "glow"), vine(7, 2), vine(7, 2, "arch"), pad(5.6, 0),
         ...stairs(2),
         vine(3.4, 0), vine(7, 2), vine(7, 2), pad(5.6, 0),
         ...stairs(2),
         ...block(3, ["live", "arch", "live"]), ...block(2, ["arch", "live"], "leaf"), ...block(3, ["live", "live", "arch"]),
         ...block(2, ["live", "arch"]), ...block(3, ["arch", "live", "live"], "leaf"), ...block(2),
         ...stairs(2),
         vine(3.4, 0, "arch"), vine(7, 2), pad(5.6, 0, 2.4),
      ],
   },
   5: {
      id: 5, name: "Canopy Peak", targetMs: 210_000, durationMs: 400_000, bob: true, snappers: true, monkeys: 2, arcPreview: false, boss: true,
      beats: [
         vine(3.4, 0), vine(7, 2), pad(5.6, 0),
         ...stairs(2),
         vine(3.4, 0), vine(7, 2, "dry"), vine(7, 2, "arch"), pad(5.6, 0),
         ...stairs(2),
         vine(3.4, 0), vine(7.2, 2), pad(5.6, 0, 1.8, "leaf"),
         ...stairs(2),
         vine(3.4, 0, "glow"), vine(7, 2), vine(7, 2), pad(5.6, 0),
         ...stairs(2),
         ...block(3, ["live", "dry", "arch"]), ...block(2, ["arch", "live"], "leaf"), ...block(3, ["live", "dry", "live"]),
         ...block(2, ["live", "arch"]),
         ...stairs(2),
         vine(3.4, 0), vine(7, 2, "dry"), pad(5.6, 0, 3.2),
      ],
   },
};

/** The game's level config type (the shell's useLevel<VineLevel>). */
export type VineConfig = VineLevel;
