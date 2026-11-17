// Color Match Jump's five levels: pure data. The design card is docs/menu2-super/world-6-prism-fortress.md
// "21 Color Match Jump" (branch claude/m2-super-plan): hop across hex pillars over the void, where only a
// landing in your own colour holds; tag heroes in mid-air so the right colour touches down. course.ts
// lays each field from these numbers; rules.ts runs it.
import type { LevelId } from "../../types";

export interface CmjLevel {
   id: LevelId;
   /** the card's level name (meta.ts titles) */
   name: string;
   /** the run clock's cap (ms) = the time base of the score */
   durationMs: number;
   /** the third star: reach the crown within this (ms) */
   targetMs: number;
   /** hero colour indices in play (0 red, 1 blue, 2 green, 3 yellow, 4 purple) */
   palette: readonly number[];
   /** beacon codes to crack before the crown opens (the spec's colour-call rounds) */
   codes: number;
   /** colours per code */
   codeLen: number;
   /** field rows to the crown (L5: 0, the ring field) */
   rows: number;
   /** field columns */
   width: number;
   /** the sink wave: one rear row drops per this many ms (0 = no sinking) */
   sinkMs: number;
   /** the sink wave starts after this (ms) */
   sinkDelayMs: number;
   /** L3: every coloured hex steps to the next palette colour on this cycle (ms; 0 = fixed) */
   hueMs: number;
   /** L3: pillars rise and sink (m, amplitude) */
   bob: number;
   /** L4: share of glassy hexes (a landing skids) */
   glassy: number;
   /** L5: the Echo Frost Golem's ring field */
   boss: boolean;
}

export const LEVELS: Record<LevelId, CmjLevel> = {
   1: { id: 1, name: "Two-Tone Steps", durationMs: 90_000, targetMs: 30_000, palette: [0, 1], codes: 5, codeLen: 2, rows: 16, width: 4, sinkMs: 0, sinkDelayMs: 0, hueMs: 0, bob: 0, glassy: 0, boss: false },
   2: { id: 2, name: "Three Calls", durationMs: 120_000, targetMs: 45_000, palette: [0, 1, 3], codes: 8, codeLen: 3, rows: 24, width: 5, sinkMs: 3000, sinkDelayMs: 9000, hueMs: 0, bob: 0, glassy: 0, boss: false },
   3: { id: 3, name: "Shifting Hues", durationMs: 150_000, targetMs: 55_000, palette: [0, 1, 2, 3], codes: 12, codeLen: 3, rows: 30, width: 5, sinkMs: 2600, sinkDelayMs: 9000, hueMs: 4000, bob: 0.3, glassy: 0, boss: false },
   4: { id: 4, name: "Fast Countdown", durationMs: 180_000, targetMs: 90_000, palette: [0, 1, 2, 3, 4], codes: 16, codeLen: 4, rows: 38, width: 5, sinkMs: 1800, sinkDelayMs: 8000, hueMs: 0, bob: 0, glassy: 0.2, boss: false },
   5: { id: 5, name: "Frozen Crown", durationMs: 240_000, targetMs: 80_000, palette: [0, 1, 2, 3, 4], codes: 0, codeLen: 4, rows: 0, width: 0, sinkMs: 0, sinkDelayMs: 0, hueMs: 0, bob: 0, glassy: 0, boss: true },
};
