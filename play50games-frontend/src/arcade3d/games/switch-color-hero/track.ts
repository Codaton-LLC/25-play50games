// Switch Color Hero's five tracks: pure data. A floating neon track runs along -z in three lanes; full
// width energy gates of one colour (or one colour per lane: split gates; or two colours that alternate:
// blink gates) must be passed with the hero switched to the matching colour. Between the gates: energy
// walls (change lane, Riko's dash or Vexa's phase), low walls (jump), beams (slide), gaps (jump), sweepers
// (a low bar sliding across the lanes). Energy pickups in lines, checkpoints, three secrets. Level 5 ends
// in Chroma's arena, an endless stretch where the golem throws its core gates (rules.ts spawns them).
//
// The layout is generated from a fixed seed per level, so every run of a level is the same track.
import type { LevelId } from "@/arcade3d/types";
import { createRng } from "@/arcade3d/core/math";

export const LANE_W = 2.6;
export const LANES = [-LANE_W, 0, LANE_W] as const;
export const START_Z = 0;

/** The palette: index 0..4. Every colour also has a shape for colour-blind players (HUD, gates). */
export const PALETTE = [
   { id: "red", name: "Red", hex: "#EF4444", shape: "circle", key: "1" },
   { id: "blue", name: "Blue", hex: "#3B82F6", shape: "triangle", key: "2" },
   { id: "green", name: "Green", hex: "#22C55E", shape: "square", key: "3" },
   { id: "yellow", name: "Yellow", hex: "#FACC15", shape: "diamond", key: "4" },
   { id: "purple", name: "Purple", hex: "#A855F7", shape: "hexagon", key: "5" },
] as const;

export type GateKind = "full" | "split" | "blink";

export interface Gate {
   z: number;
   kind: GateKind;
   /** the colour per lane (all three equal for full and blink gates) */
   colors: [number, number, number];
   /** blink gates: the other colour and the half period (ms) */
   alt: number;
   periodMs: number;
}

export type ObstacleKind = "block" | "wall" | "beam" | "gap" | "sweeper";

export interface Obstacle {
   kind: ObstacleKind;
   z: number;
   /** block / wall: the lane it stands in (-1: all three, for beams and gaps) */
   lane: number;
   /** gap: its length along the track (m) */
   len: number;
   /** sweeper: the period of one sweep across the lanes (ms) and its phase */
   periodMs: number;
   phase: number;
}

export interface Pickup {
   x: number;
   y: number;
   z: number;
   /** counts toward the "all pickups" star (high ones over gaps are Nyla's bonus) */
   main: boolean;
}

export interface Track {
   level: LevelId;
   colors: number;
   gates: Gate[];
   obstacles: Obstacle[];
   pickups: Pickup[];
   mainPickups: number;
   checkpoints: number[];
   /** where the course ends: the finish line, or level 5's arena start */
   finishZ: number;
   /** level 5: the arena begins here; the run is won by beating Chroma */
   arenaZ: number | null;
   /** secrets: 0 the high prism (over a gap), 2 the ghost lane shard (behind a block); 1 is the colour streak */
   high: { x: number; y: number; z: number };
   ghost: { x: number; y: number; z: number };
   ghostBlock: number;
   /** the course length the proof uses (m from the start to finishZ) */
   length: number;
}

interface Spec {
   colors: number;
   gates: number;
   spacing: number;
   kinds: GateKind[];
   obstacles: ObstacleKind[];
   perSegment: number;
   seed: number;
}

const SPECS: Record<LevelId, Spec> = {
   1: { colors: 2, gates: 8, spacing: 30, kinds: ["full"], obstacles: ["block"], perSegment: 1, seed: 11 },
   2: { colors: 3, gates: 12, spacing: 30, kinds: ["full"], obstacles: ["block", "wall"], perSegment: 1, seed: 23 },
   3: { colors: 4, gates: 16, spacing: 28, kinds: ["full", "full", "blink"], obstacles: ["block", "wall", "sweeper"], perSegment: 2, seed: 37 },
   4: { colors: 4, gates: 20, spacing: 28, kinds: ["full", "split", "blink"], obstacles: ["block", "wall", "beam", "gap", "sweeper"], perSegment: 2, seed: 41 },
   5: { colors: 5, gates: 19, spacing: 28, kinds: ["full", "split", "blink"], obstacles: ["block", "wall", "beam", "gap", "sweeper"], perSegment: 2, seed: 53 },
};

/** Chroma's core gates (level 5): passed in his windows, they count toward the 25. */
export const BOSS_GATES = 6;

/** The card's gate counts: 8 / 12 / 16 / 20 / 25. */
export function gatesToPass(level: LevelId): number {
   return SPECS[level].gates + (level === 5 ? BOSS_GATES : 0);
}

const LEAD_IN = 34;
const RUN_OUT = 26;
/** no obstacle this close before or after a gate (m): the colour read and the switch need room */
export const GATE_CLEAR = 7;

function build(level: LevelId): Track {
   const s = SPECS[level];
   const rng = createRng(s.seed);
   const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length)];
   const color = (not = -1) => {
      let c = Math.floor(rng() * s.colors);
      if (c === not) c = (c + 1) % s.colors;
      return c;
   };
   const gates: Gate[] = [];
   const obstacles: Obstacle[] = [];
   const pickups: Pickup[] = [];
   const checkpoints: number[] = [START_Z];
   // gate positions first: from level 3 every fourth gate comes in a fast pair, 9 m after the one before
   const zs: number[] = [];
   let z = START_Z - LEAD_IN;
   for (let i = 0; i < s.gates; i++) {
      const fast = level >= 3 && i % 4 === 2 && i > 0;
      const gz = fast ? zs[i - 1] - 9 : z;
      zs.push(gz);
      z = gz - s.spacing;
   }
   const endZ = zs[zs.length - 1] - RUN_OUT;
   let prev = -1;
   for (let i = 0; i < s.gates; i++) {
      const gz = zs[i];
      const kind: GateKind = i < 2 ? "full" : pick(s.kinds);
      const c = color(prev);
      const g: Gate = { z: gz, kind, colors: [c, c, c], alt: c, periodMs: 0 };
      if (kind === "split") {
         const a = color();
         const b = color(a);
         const d = color(b);
         g.colors = [a, b, d];
      } else if (kind === "blink") {
         g.alt = color(c);
         g.periodMs = level >= 5 ? 1000 : 1300;
      }
      gates.push(g);
      prev = c;
      // the stretch up to the next gate: obstacles clear of both gates, a pickup line after this one
      const next = i + 1 < s.gates ? zs[i + 1] : endZ;
      const room = gz - GATE_CLEAR - (next + GATE_CLEAR);
      const n = i === 0 ? 0 : s.perSegment;
      for (let k = 0; k < n && room > 6; k++) {
         const oz = gz - GATE_CLEAR - (room * (k + 1)) / (n + 1);
         const kindO = i < 2 ? s.obstacles[0] : pick(s.obstacles);
         const o: Obstacle = { kind: kindO, z: oz, lane: -1, len: 0, periodMs: 0, phase: 0 };
         if (kindO === "block" || kindO === "wall") o.lane = Math.floor(rng() * 3);
         if (kindO === "gap") {
            // a gap keeps its own slot: at least 2.2 m of deck to land on before the next hazard
            o.len = Math.min(3.5 + rng() * 1.5, room / (n + 1) - 2.2, oz - (next + GATE_CLEAR));
            if (o.len < 2) {
               o.kind = "beam";
               o.len = 0;
            }
         }
         if (kindO === "sweeper") {
            o.periodMs = 2600 + Math.floor(rng() * 800);
            o.phase = rng();
         }
         obstacles.push(o);
      }
      if (gz - next > 10) {
         const pl = Math.floor(rng() * 3);
         for (let k = 0; k < 3; k++) pickups.push({ x: LANES[pl], y: 0.9, z: gz - 3.2 - k * 1.6, main: true });
      }
      if (i % 4 === 3) checkpoints.push(gz - 2.5);
   }
   const finishZ = endZ;
   // the high prism: over the first gap (Nyla's double jump), else over the middle of the course
   const gap = obstacles.find((o) => o.kind === "gap");
   const midZ = (START_Z + finishZ) / 2;
   const high = { x: 0, y: 3.4, z: gap ? gap.z - gap.len / 2 : midZ };
   if (gap) for (let k = 0; k < 2; k++) pickups.push({ x: 0, y: 3.1, z: gap.z - gap.len / 2 + (k ? -1.5 : 1.5), main: false });
   // the ghost lane: a block in the right lane with the shard just behind it
   let ghostBlock = obstacles.findIndex((o, i) => o.kind === "block" && i > 0);
   if (ghostBlock < 0) {
      obstacles.push({ kind: "block", z: midZ + 4, lane: 2, len: 0, periodMs: 0, phase: 0 });
      ghostBlock = obstacles.length - 1;
   }
   const gb = obstacles[ghostBlock];
   const ghost = { x: LANES[gb.lane], y: 0.9, z: gb.z - 1.6 };
   const mainPickups = pickups.filter((p) => p.main).length;
   return {
      level,
      colors: s.colors,
      gates,
      obstacles,
      pickups,
      mainPickups,
      checkpoints,
      finishZ,
      arenaZ: level === 5 ? finishZ : null,
      high,
      ghost,
      ghostBlock,
      length: START_Z - finishZ,
   };
}

const TRACKS: Partial<Record<LevelId, Track>> = {};

export function buildTrack(level: LevelId): Track {
   return (TRACKS[level] ??= build(level));
}

/** The colour a gate shows in lane `lane` at rules time `ms`. */
export function gateColor(g: Gate, lane: number, ms: number): number {
   if (g.kind === "blink") return Math.floor(ms / g.periodMs) % 2 === 0 ? g.colors[0] : g.alt;
   return g.colors[Math.max(0, Math.min(2, lane))];
}

/** A sweeper's x at rules time `ms`: it slides across all three lanes and back. */
export function sweeperX(o: Obstacle, ms: number): number {
   const u = ((ms / o.periodMs + o.phase) % 1 + 1) % 1;
   const tri = u < 0.5 ? u * 2 : 2 - u * 2;
   return -LANE_W + tri * 2 * LANE_W;
}
