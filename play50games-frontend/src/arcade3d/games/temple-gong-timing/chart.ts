// Temple Gong Timing's stage and charts: pure data and geometry (no React, no three.js, no randomness).
//
// The stage is a round ruin floor (radius STAGE_R). Gongs stand on striker posts round its back, facing
// the middle; the hero strikes a gong from its strike point (in front of it). Ceremony drums stand on the
// floor (hold notes), Nami's high gongs sit on lantern pillars between the floor gongs, Vexa's ghost
// gong floats on the front of the stage, and level 5 raises the Great Gong in the middle.
//
// A chart is written bar by bar in a tiny language: a bar is 4 (quarters) or 8 (eighths) tokens.
//   gN  a tap on gong N          dN  a tap on drum N        DN  a hold on drum N for two beats
//   XN  Riko's cross-stage bonus note on gong N (worth double; only a dash gets there in time)
//   PN  Nami's bonus note on pillar gong N (strike it in the air: a double jump)
//   H   one note of Vexa's ghost-gong chord (bonus; all three in a level hold the shard)
//   G   the Great Gong (level 5's last note)
//   ~gN a silent note: no ring (the answer to a call)    !gN a call: the gong glows, nothing to hit
//   ^   an off-beat shockwave reaching the strike circle at this slot: jump it
//   .   rest
import type { LevelId } from "../../types";
import { LEVELS, type GongLevel } from "./levels";

export const TAU = Math.PI * 2;
/** the stage floor's radius; the hero stays inside WALK_R */
export const STAGE_R = 7.4;
export const WALK_R = 7;
/** the gongs stand this far out, their strike points (where the hero must be) this far */
export const GONG_R = 8.3;
export const STRIKE_R = 6.6;
/** a strike reaches this far from the strike point (m) */
export const REACH = 1.35;
/** a pillar gong is struck from the air: at least this high over the floor */
export const PILLAR_AIR = 1.7;
export const PILLAR_R = 8.9;
export const PILLAR_H = 3.4;
export const DRUM_R = 3.2;
export const GHOST_R = 3.6;
/** level 5's Great Gong stands in the middle; its strike point is in front of it */
export const GREAT_STRIKE = { x: 0, z: 2.1 } as const;
/** a shockwave runs out from the middle at this speed (m/s) */
export const SHOCK_SPEED = 9;

export type TargetKind = "gong" | "drum" | "pillar" | "ghost" | "great";
export interface Target {
   kind: TargetKind;
   i: number;
}

export type Bonus = "" | "cross" | "pillar" | "ghost";

export interface Note {
   id: number;
   /** the beat's time (ms of play) */
   t: number;
   target: Target;
   /** a hold note's length (ms), 0 for a tap */
   hold: number;
   bonus: Bonus;
   /** no ring is drawn (the answer to a call) */
   silent: boolean;
}

/** A call: the target glows on the beat (a lantern or Coilstone's tail plays it), nothing to strike. */
export interface Call {
   t: number;
   target: Target;
}

/** A shockwave reaching the strike circle at `t` (it set off from the middle STRIKE_R / SHOCK_SPEED earlier). */
export interface Shock {
   t: number;
}

export interface Chart {
   notes: Note[];
   calls: Call[];
   shocks: Shock[];
   /** the song's end (ms): levels 1-4 end the run here */
   endMs: number;
}

export interface Stage {
   level: LevelId;
   cfg: GongLevel;
   /** each gong's angle round the stage at time 0 (rad; the position is (sin a, cos a) x radius) */
   gongAngles: number[];
   drumAngles: number[];
   pillarAngles: number[];
   ghostAngle: number;
   great: boolean;
   beatMs: number;
}

// ---------- the stage ----------

const DEG = Math.PI / 180;
/** gongs on an arc round the back of the stage (the camera's far side), facing the middle */
function arc(n: number, spread: number): number[] {
   if (n === 1) return [Math.PI];
   return Array.from({ length: n }, (_, k) => Math.PI - (spread * DEG) / 2 + (k * spread * DEG) / (n - 1));
}

const STAGES: Record<LevelId, () => Omit<Stage, "level" | "cfg" | "beatMs">> = {
   1: () => ({ gongAngles: arc(4, 120), drumAngles: [Math.PI], pillarAngles: [Math.PI], ghostAngle: 0, great: false }),
   2: () => ({ gongAngles: arc(6, 150), drumAngles: [Math.PI], pillarAngles: [Math.PI - 45 * DEG, Math.PI + 45 * DEG], ghostAngle: 0, great: false }),
   3: () => ({ gongAngles: arc(6, 200), drumAngles: [Math.PI], pillarAngles: [Math.PI], ghostAngle: Math.PI, great: false }),
   4: () => ({ gongAngles: arc(8, 252), drumAngles: [Math.PI], pillarAngles: [Math.PI - 72 * DEG, Math.PI + 72 * DEG], ghostAngle: 0, great: false }),
   5: () => ({ gongAngles: arc(6, 150), drumAngles: [Math.PI], pillarAngles: [Math.PI], ghostAngle: 0, great: true }),
};

const STAGE_CACHE = new Map<LevelId, Stage>();
export function stageFor(level: LevelId): Stage {
   const hit = STAGE_CACHE.get(level);
   if (hit) return hit;
   const cfg = LEVELS[level];
   const s: Stage = { ...STAGES[level](), level, cfg, beatMs: 60_000 / cfg.bpm };
   STAGE_CACHE.set(level, s);
   return s;
}

/** A gong's angle now (level 3's gongs orbit the stage). */
export function gongAngle(stage: Stage, i: number, ms: number): number {
   return stage.gongAngles[i] + (stage.cfg.orbit * ms) / 1000;
}

/** Where the hero must be to strike `target` at `ms` (x, z) and how high off the floor (air). */
export function targetPoint(stage: Stage, target: Target, ms: number, out: { x: number; z: number; air: number }): { x: number; z: number; air: number } {
   let a = 0;
   let r = STRIKE_R;
   out.air = 0;
   switch (target.kind) {
      case "gong":
         a = gongAngle(stage, target.i, ms);
         break;
      case "drum":
         a = stage.drumAngles[target.i];
         r = DRUM_R + 1;
         break;
      case "pillar":
         a = stage.pillarAngles[target.i];
         out.air = PILLAR_AIR;
         break;
      case "ghost":
         a = stage.ghostAngle;
         r = GHOST_R - 1;
         break;
      case "great":
         out.x = GREAT_STRIKE.x;
         out.z = GREAT_STRIKE.z;
         return out;
   }
   out.x = r * Math.sin(a);
   out.z = r * Math.cos(a);
   return out;
}

/** The world point of the thing struck (the gong's face, the drum's top...), for the visuals and the fx. */
export function targetBody(stage: Stage, target: Target, ms: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   switch (target.kind) {
      case "gong": {
         const a = gongAngle(stage, target.i, ms);
         out.x = GONG_R * Math.sin(a);
         out.y = 1.9;
         out.z = GONG_R * Math.cos(a);
         return out;
      }
      case "drum": {
         const a = stage.drumAngles[target.i];
         out.x = DRUM_R * Math.sin(a);
         out.y = 1;
         out.z = DRUM_R * Math.cos(a);
         return out;
      }
      case "pillar": {
         const a = stage.pillarAngles[target.i];
         out.x = PILLAR_R * Math.sin(a);
         out.y = PILLAR_H + 0.6;
         out.z = PILLAR_R * Math.cos(a);
         return out;
      }
      case "ghost":
         out.x = GHOST_R * Math.sin(stage.ghostAngle);
         out.y = 1.6;
         out.z = GHOST_R * Math.cos(stage.ghostAngle);
         return out;
      case "great":
         out.x = 0;
         out.y = 2.2;
         out.z = 0;
         return out;
   }
}

// ---------- the chart language ----------

/** Lay `bars` out from `startMs` (each bar 4 beats) into the chart; returns the end time. */
export function writeBars(stage: Stage, bars: readonly string[], startMs: number, chart: Chart): number {
   const beat = stage.beatMs;
   let t0 = startMs;
   for (const bar of bars) {
      const tokens = bar.trim().split(/\s+/);
      const slot = (4 * beat) / tokens.length;
      tokens.forEach((tok, k) => {
         const t = t0 + k * slot;
         if (tok === ".") return;
         if (tok === "^") {
            chart.shocks.push({ t });
            return;
         }
         if (tok === "H") {
            chart.notes.push({ id: chart.notes.length, t, target: { kind: "ghost", i: 0 }, hold: 0, bonus: "ghost", silent: false });
            return;
         }
         if (tok === "G") {
            chart.notes.push({ id: chart.notes.length, t, target: { kind: "great", i: 0 }, hold: 0, bonus: "", silent: false });
            return;
         }
         let s = tok;
         let silent = false;
         let call = false;
         if (s[0] === "~") {
            silent = true;
            s = s.slice(1);
         } else if (s[0] === "!") {
            call = true;
            s = s.slice(1);
         }
         const i = Number(s.slice(1));
         const c = s[0];
         const target: Target = c === "g" || c === "X" ? { kind: "gong", i } : c === "d" || c === "D" ? { kind: "drum", i } : { kind: "pillar", i };
         if (call) {
            chart.calls.push({ t, target });
            return;
         }
         const hold = c === "D" ? 2 * beat : 0;
         const bonus: Bonus = c === "X" ? "cross" : c === "P" ? "pillar" : "";
         chart.notes.push({ id: chart.notes.length, t, target, hold, bonus, silent });
      });
      t0 += 4 * beat;
   }
   return t0;
}

const LEAD_IN = [". . . ."];

const SONGS: Record<1 | 2 | 3 | 4, string[]> = {
   // Slow Beat: one gong; then two alternating; then the drum hold; then all four, a cross note for
   // Riko, a pillar note for Nami and Vexa's ghost chord in the breaks
   1: [
      ...LEAD_IN,
      "g1 . g1 .", "g1 . g1 .", "g1 . g1 .", "g1 . g1 .", "g1 . g1 .", "g1 . g1 .",
      "g1 . g2 .", "g1 . g2 .", "g1 . g2 .", "g1 . g2 .", "g2 . g1 .", "g2 . g1 .",
      "D0 . . d0", "D0 . . d0", "D0 . . d0", "D0 . . d0",
      "g1 . g2 .", "g2 . g3 .", "g3 g3 g2 .", "g1 . g0 .",
      "g0 . . X3 . . . .", "g3 . g2 .", "g2 . P0 .", "g1 . g1 .",
      ". H H H", ". . . .",
      "g1 . g2 .", "g2 . g1 .", "g1 . . .",
      ". . . .",
   ],
   // Alternating Gongs: six gongs; the lanterns call a pattern (gongs glow), you answer with no rings
   2: [
      ...LEAD_IN,
      "g2 . g3 .", "g2 . g3 .", "g3 g3 g2 .", "g2 . g3 .",
      "!g2 !g2 !g3 !g3", "~g2 ~g2 ~g3 ~g3",
      "g3 . g4 .", "g4 . g4 .",
      "!g4 !g3 !g3 !g4", "~g4 ~g3 ~g3 ~g4",
      "g4 . g3 .", "g2 . g1 .",
      "!g1 !g1 !g2 !g1", "~g1 ~g1 ~g2 ~g1",
      "g1 . . X5 . . . .", "g5 . g4 .",
      "!g4 !g5 !g5 !g4", "~g4 ~g5 ~g5 ~g4",
      "g4 . g4 .", "g3 . P0 .", "g2 . g2 .",
      "!g2 !g3 !g2 !g2", "~g2 ~g3 ~g2 ~g2",
      ". . H H", "H . . .", ". . . .",
      "g2 . g3 .", "g3 g3 g2 g2", "g2 . g3 .", "g3 g3 g2 .", "g2 . . .",
      ". . . .",
   ],
   // Moving Targets: the gongs ride round the stage; lead your roll
   3: [
      ...LEAD_IN,
      "g2 . g2 .", "g2 . g3 .", "g3 . g3 .", "g3 . g4 .",
      "g4 g4 g4 .", "g4 . g3 .", "g3 . g2 .", "g2 g2 g2 .",
      "D0 . . .", ". . g1 .", "g1 . g0 .", "g0 . X3 .",
      "g3 . g4 .", "g4 . g5 .", "g5 g5 g5 .", "g5 . g4 .",
      "g4 . P0 .", "g3 . g3 .", "g3 . g2 .", "g2 g2 g2 g2",
      ". . . .", ". H H H", ". . . .",
      "g2 g2 g2 g2", "g2 . g3 .", "g3 g3 g3 g3", "g3 . g2 .",
      "g2 . g3 .", "g3 g3 g3 .", "g3 . . .",
      ". . . .",
   ],
   // Fast Rhythm: eight gongs, eighth notes on one gong, shockwaves on the off-beats
   4: [
      ...LEAD_IN,
      "g3 . g3 . g4 . g4 .", "g4 . g4 . g3 . . .",
      "g3 . g3 ^ g4 . . ^", "g4 . g4 ^ g5 . . ^",
      "g5 g5 g5 . g4 . . .", "g4 g4 g4 . g3 . . .",
      "g3 . . ^ g2 . . ^", "g2 g2 g2 . g2 . . .",
      "g2 . . . X6 . . .", "g6 . g6 ^ g5 . . ^",
      "g5 g5 . . g4 g4 . .", "g4 . g4 ^ P0 . . ^",
      "g3 . g3 . g3 g3 g3 .", "g3 . . ^ g2 . . ^",
      "g2 g2 g2 g2 g1 . . .", "g1 . g1 ^ g1 . . ^",
      ". . . . . . . .", ". . H . H . H .",
      "g2 . g2 . g3 . g3 .", "g3 g3 g3 g3 g4 . . .", "g4 . . . . . . .",
      ". . . . . . . .",
   ],
};

const CHARTS = new Map<LevelId, Chart>();

/** Levels 1-4: the whole song. Level 5's chart is built as the fight goes (bossUnit). */
export function chartFor(level: LevelId): Chart {
   const hit = CHARTS.get(level);
   if (hit) return hit;
   const stage = stageFor(level);
   const chart: Chart = { notes: [], calls: [], shocks: [], endMs: 0 };
   if (level !== 5) chart.endMs = writeBars(stage, SONGS[level], 0, chart);
   CHARTS.set(level, chart);
   return chart;
}

// ---------- level 5: Coilstone's units ----------

/**
 * Level 5's song is built unit by unit as the fight goes (rules.ts): each unit starts with a quiet
 * lead-in bar, and which unit comes next is decided when the last one ends, by Coilstone's phase.
 * P1 "call": its tail plays a pattern on three gongs, you echo it; a Perfect echo cracks a plate.
 * P2 "duel": an 8-bar phrase with off-beat shockwaves; 80 % in the phrase cracks a plate.
 * P3 "great": a 16-beat crescendo that ends on the Great Gong; a Perfect last strike frees it.
 */
export const BOSS_UNITS = {
   call: [
      [...LEAD_IN, "!g1 !g2 !g2 !g3", "~g1 ~g2 ~g2 ~g3"],
      [...LEAD_IN, "!g3 !g3 !g2 !g2", "~g3 ~g3 ~g2 ~g2"],
      [...LEAD_IN, "!g2 !g1 !g1 !g2", "~g2 ~g1 ~g1 ~g2"],
      [...LEAD_IN, "!g4 !g4 !g3 !g3", "~g4 ~g4 ~g3 ~g3"],
   ],
   duel: [
      [
         ...LEAD_IN,
         "g2 . g2 ^ g3 . . ^", "g3 . g3 ^ g3 . . ^", "g3 . g4 ^ g4 . . ^", "g4 g4 g4 . g3 . . .",
         "g3 . g3 ^ g2 . . ^", "g2 g2 g2 . g1 . . .", "g1 . g1 ^ g2 . . ^", "g2 . g2 . g2 . . .",
      ],
   ],
   great: [[...LEAD_IN, "g2 . g2 .", "g3 . g3 .", "g3 g3 g3 g3", ". . G ."]],
} as const;

export type UnitKind = keyof typeof BOSS_UNITS;

/** Write the next unit of kind `kind` (the n-th of that kind) from `startMs`; returns the end time. */
export function writeUnit(stage: Stage, kind: UnitKind, n: number, startMs: number, chart: Chart): number {
   const list = BOSS_UNITS[kind];
   return writeBars(stage, list[n % list.length], startMs, chart);
}
