// Rooftop Roll Climb's five levels: pure data (no React, no three.js). core/README.md "Levels".
// One base city (roofs.ts) and five configurations of the same zigzag skyline (design card
// docs/menu2-super/world-1-ember-heights.md "2 Rooftop Roll Climb"):
// a block = a landing deck, a fire-escape climb (steps) to its top deck, then a slanted tin roof that
// falls away sideways to a lip over the street. You roll down the slope to bank speed and leap the
// street to the next, higher block, which faces the other way (the switchback).
import type { LevelId } from "@/arcade3d/types";

export type StreetKind = "gondola" | "crane";

export interface RoofSpec {
   /** switchback blocks (each: deck, climb, top deck, slope); the start deck is block 0's */
   blocks: number;
   /** climb steps per block, the top deck included (2 = deck -> step -> top deck) */
   steps: number;
   /** each climb step rises this much (m), well under the jump apex */
   stepRise: number;
   /** the slanted roof's length along x (m) and its drop per metre (tan of the angle) */
   slopeLen: number;
   grade: number;
   /** a curled ball accelerates downhill at this rate on a dry slope (m/s²) */
   accel: number;
   /** the street between a lip and the next deck (m), and how far that deck sits above the lip */
   gap: number;
   leapRise: number;
   /** landing deck size (x, z) and climb step size */
   deckW: number;
   deckD: number;
   stepW: number;
   stepD: number;
   /** every Nth block's deck is a checkpoint lamp (block 0's deck is the start) */
   checkpointEvery: number;
   /** a street with a mid-street mover (a landing pad you time the leap to): every Nth street, and which */
   streetEvery: number;
   street: StreetKind;
   /** every Nth slope is rain-wet tin (1.5x the roll, no braking); 0 = none */
   wetEvery: number;
   /** every Nth deck (not a checkpoint) blinks out; 0 = none */
   blinkEvery: number;
   /** every Nth deck (not a checkpoint) is a wet flat roof (low traction); 0 = none */
   slipEvery: number;
   /** every Nth block has a chimney updraft beside its climb (a vertical shortcut); 0 = none */
   chimneyEvery: number;
   /** every Nth slope has a neon spark arc across its roll line (2.8 s cycle); 0 = none */
   sparkEvery: number;
   /** L1 beat 3: the last block's slope leaps onto a second slope (keep the curl) before the helipad */
   chain: boolean;
   /** L1 beat 1: a low catch roof under the first street (a short leap lands there, a ladder leads back) */
   catchRoof: boolean;
   /** L5: the helipad is a half-pipe arena (deck, ramp, pad, ramp, deck) where Ashback is fought */
   arena: boolean;
}

export interface RoofLevel {
   id: LevelId;
   /** the plan's level name (meta.ts titles) */
   name: string;
   /** run clock cap (ms): reaching it ends the run "timeup" (unranked) */
   durationMs: number;
   spec: RoofSpec;
}

const base: RoofSpec = {
   blocks: 5,
   steps: 3,
   stepRise: 1.85,
   slopeLen: 7,
   grade: 0.3,
   accel: 6.5,
   gap: 7.5,
   leapRise: 1.5,
   deckW: 5.2,
   deckD: 4.4,
   stepW: 3.2,
   stepD: 2.4,
   checkpointEvery: 2,
   streetEvery: 0,
   street: "gondola",
   wetEvery: 0,
   blinkEvery: 0,
   slipEvery: 0,
   chimneyEvery: 0,
   sparkEvery: 0,
   chain: false,
   catchRoof: false,
   arena: false,
};

/** L1 Low Roofs: three beats (a rolled leap over a 7 m street, the switchback, two chained slopes). */
const low: RoofSpec = { ...base, blocks: 5, chain: true, catchRoof: true, deckW: 5.6, deckD: 4.8 };

/** L2 Office Roofs: window-cleaner gondolas slide mid-street; time the roll to meet one. */
const office: RoofSpec = { ...base, blocks: 6, streetEvery: 2, street: "gondola", accel: 7 };

/** L3 Moving Rooftops: crane-swung slabs, rain-wet tin slopes, blinking roofs. */
const moving: RoofSpec = { ...base, blocks: 7, streetEvery: 3, street: "crane", wetEvery: 2, blinkEvery: 3, accel: 7, deckW: 5, deckD: 4.2 };

/** L4 Night Skyline: chimney updrafts, neon spark arcs, taller climbs. */
const night: RoofSpec = { ...base, blocks: 7, steps: 3, chimneyEvery: 2, sparkEvery: 2, streetEvery: 3, street: "gondola", accel: 7.5, deckW: 5, deckD: 4.2 };

/** L5 High-Rise Climb: everything, and Ashback on the helipad arena. */
const high: RoofSpec = {
   ...base,
   blocks: 7,
   steps: 3,
   chimneyEvery: 3,
   sparkEvery: 3,
   streetEvery: 3,
   street: "crane",
   wetEvery: 3,
   blinkEvery: 3,
   slipEvery: 5,

   accel: 8,
   deckW: 5,
   deckD: 4.2,
   arena: true,
};

export const LEVELS: Record<LevelId, RoofLevel> = {
   1: { id: 1, name: "Low Roofs", durationMs: 90_000, spec: low },
   2: { id: 2, name: "Office Roofs", durationMs: 120_000, spec: office },
   3: { id: 3, name: "Moving Rooftops", durationMs: 150_000, spec: moving },
   4: { id: 4, name: "Night Skyline", durationMs: 180_000, spec: night },
   5: { id: 5, name: "High-Rise Climb", durationMs: 240_000, spec: high },
};
