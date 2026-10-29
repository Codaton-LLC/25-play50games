// The score proof's bound (README "Server limits and why they hold"). Pure, three-free.
//
// Every point comes from a note of the chart, once: a struck note pays its base (a Perfect: 100 on a
// main note, 150 on a pillar or ghost bonus note, 200 on a cross note) plus the combo's bonus on it, a
// held drum 50 more, and a Perfect's echo orb 20. The combo pays at most base x (multiplier - 1) on the
// i-th link with multiplier <= 2; menu2/combo comboMaxBonus is the exact most over every order and break
// pattern. A note can be struck from GOOD_MS before its beat at the earliest.
//
// Levels 1-4 play one fixed song: maxScore is every note at its best plus comboMaxBonus; the prefix
// bound S(t) (everything the notes whose window opened by t can pay) gives the rate row
// (S(t) <= base + maxPointsPerSec x t at every t). The run always lasts the whole song.
//
// Level 5's song is built as the fight goes, from Coilstone's units (chart.ts BOSS_UNITS): any run is a
// string of units from the start, so its points by time t are at most (the best points per ms of any
// unit) x t + (the most any one unit pays), every note counted at twice its base (the combo's cap) plus
// its echo. maxScore takes t = the cap. The least duration is the quickest defeat: one call unit, three
// duel units, then the Great Gong's note.
import type { LevelId } from "../../types";
import { comboMaxBonus } from "@/arcade3d/menu2/combo/combo";
import { BOSS_UNITS, chartFor, stageFor, writeUnit, type Chart, type Note, type UnitKind } from "./chart";
import { LEVELS } from "./levels";
import { COMBO, POINTS } from "./progression";
import { GOOD_MS, PAID_UNITS } from "./rules";

export interface LevelLimits {
   kind: "points";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   base: number;
   maxPointsPerSec: number;
}

/** A note's best base (a Perfect) and what it can add besides the combo (its echo, a held drum). */
export function noteBase(n: Note): number {
   return n.bonus === "cross" ? POINTS.crossPerfect : n.bonus !== "" ? POINTS.bonusPerfect : POINTS.perfect;
}
export function noteExtra(n: Note): number {
   return POINTS.echo + (n.hold > 0 ? POINTS.hold : 0);
}

/** The most the notes `notes` can pay together (bases, extras and the combo's best). */
export function notesMax(notes: readonly Note[]): number {
   let total = 0;
   const counts = new Map<number, number>();
   for (const n of notes) {
      total += noteBase(n) + noteExtra(n);
      counts.set(noteBase(n), (counts.get(noteBase(n)) ?? 0) + 1);
   }
   const sources = [...counts.entries()].map(([base, count]) => ({ base, count }));
   return total + comboMaxBonus({ combo: COMBO, sources });
}

/** S(t) for a fixed song: the most a run can hold at play time t (ms). */
export function prefixMax(chart: Chart, t: number): number {
   return notesMax(chart.notes.filter((n) => n.t - GOOD_MS <= t));
}

/** One unit of level 5 laid from 0 (its notes and its length). */
export function unitChart(kind: UnitKind, n: number): Chart {
   const c: Chart = { notes: [], calls: [], shocks: [], endMs: 0 };
   c.endMs = writeUnit(stageFor(5), kind, n, 0, c);
   return c;
}

/** Every level-5 unit's most points (each note at twice its base plus its extras) and its length. */
export function unitRates(): { max: number; ms: number }[] {
   const out: { max: number; ms: number }[] = [];
   for (const kind of Object.keys(BOSS_UNITS) as UnitKind[]) {
      for (let n = 0; n < BOSS_UNITS[kind].length; n++) {
         const c = unitChart(kind, n);
         let max = 0;
         for (const note of c.notes) max += 2 * noteBase(note) + noteExtra(note);
         out.push({ max, ms: c.endMs });
      }
   }
   return out;
}

/** Level 5's most points: each kind's paid units (PAID_UNITS) at that kind's best unit; encores pay nothing. */
export function paidMax(): number {
   let total = 0;
   for (const kind of Object.keys(BOSS_UNITS) as UnitKind[]) {
      let best = 0;
      for (let n = 0; n < BOSS_UNITS[kind].length; n++) {
         let max = 0;
         for (const note of unitChart(kind, n).notes) max += 2 * noteBase(note) + noteExtra(note);
         best = Math.max(best, max);
      }
      total += PAID_UNITS[kind] * best;
   }
   return total;
}

/** Level 5's least defeat time (ms): one call unit (four Perfect echoes), three duels, the Great Gong's note. */
export function bossMinMs(): number {
   const call = unitChart("call", 0).endMs;
   const duel = unitChart("duel", 0).endMs;
   const great = unitChart("great", 0);
   const g = great.notes.find((n) => n.target.kind === "great")!;
   return call + 3 * duel + g.t - GOOD_MS;
}

const r100 = (v: number) => Math.floor(v / 100) * 100;

/** The level's limits row. */
export function proposeLimits(id: LevelId): LevelLimits {
   const cfg = LEVELS[id];
   if (cfg.boss) {
      const units = unitRates();
      const rate = Math.max(...units.map((u) => u.max / u.ms)) * 1000;
      const burst = Math.max(...units.map((u) => u.max));
      const maxPointsPerSec = Math.ceil(rate);
      return {
         kind: "points",
         maxScore: paidMax(),
         minDurationMs: r100(bossMinMs() * 0.94),
         maxDurationMs: cfg.capMs + 2000,
         base: burst,
         maxPointsPerSec,
      };
   }
   const chart = chartFor(id);
   const maxScore = notesMax(chart.notes);
   // the rate row: S(t) <= base + pps t at every note's earliest moment (S only steps up there)
   const base = 400;
   let pps = 0;
   for (const n of chart.notes) {
      const t = Math.max(1, n.t - GOOD_MS);
      pps = Math.max(pps, (prefixMax(chart, t) - base) / (t / 1000));
   }
   return {
      kind: "points",
      maxScore,
      minDurationMs: r100(chart.endMs * 0.94),
      maxDurationMs: Math.ceil(chart.endMs + 2000),
      base,
      maxPointsPerSec: Math.ceil(pps),
   };
}
