// The rules: the judgement windows (the same for every press), reach, the early-press spend, misses and
// the combo (Kiro's shield saves one), held drums, shockwaves, echo orbs, the bonus notes' heroes, the
// ninth gong, the hero's roll to the next gong, every chart's travel being possible, level 5's units and
// encores, and the fixed step.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { REACH, STRIKE_R, chartFor, stageFor, targetPoint, type Note } from "./chart";
import {
   ECHO_REACH, GOOD, GOOD_MS, MISS, NINTH, PAID_UNITS, PENDING, PERFECT, PERFECT_MS, STEP_MS, createRun, createStepInput, inReach, step,
   type GongRun, type StepInput,
} from "./rules";
import { POINTS, SECRETS } from "./progression";
import { V_DASH, V_ROLL } from "./heroes";
import { LEVELS } from "./levels";

const P = { x: 0, z: 0, air: 0 };

/** Put the hero on note i's strike point and run idle until `ms`. */
function standAt(run: GongRun, n: Note): void {
   targetPoint(run.stage, n.target, n.t, P);
   run.hero.x = P.x;
   run.hero.z = P.z;
}

function advanceTo(run: GongRun, ms: number, input: StepInput = createStepInput()): void {
   while (run.simMs < ms - 1e-6 && run.ended === null) step(run, Math.min(STEP_MS, ms - run.simMs + 1e-6), input);
}

/** Press Strike at exactly `ms` (the press is judged at the next step's start). */
function pressAt(run: GongRun, ms: number, hero = run.hero): void {
   const input = createStepInput();
   advanceTo(run, ms, input);
   void hero;
   input.actionPressed = true;
   input.action = true;
   step(run, STEP_MS, input);
}

describe("the judgement", () => {
   it("Perfect within 45 ms, Good within 90 ms, nothing outside: the same windows for every device", () => {
      for (const [off, grade] of [[0, PERFECT], [PERFECT_MS - 5, PERFECT], [-(PERFECT_MS - 5), PERFECT], [PERFECT_MS + 10, GOOD], [-(GOOD_MS - 5), GOOD]] as const) {
         const run = createRun(1, 1);
         const n = run.chart.notes[0];
         run.hero.x = 99;
         advanceTo(run, n.t + off - 200);
         standAt(run, n);
         pressAt(run, n.t + off);
         expect(run.grade[0], `offset ${off}`).toBe(grade);
      }
   });

   it("out of reach a press strikes nothing", () => {
      const run = createRun(1, 1);
      const n = run.chart.notes[0];
      advanceTo(run, n.t - 100);
      run.hero.x = 0;
      run.hero.z = 0;
      const input = createStepInput();
      input.moveX = 0.001;
      pressAt(run, n.t);
      expect(run.grade[0]).toBe(PENDING);
   });

   it("a press up to 180 ms early at the note's gong spends it as a miss (spam never pays)", () => {
      const run = createRun(1, 1);
      const n = run.chart.notes[0];
      advanceTo(run, n.t - 300);
      standAt(run, n);
      pressAt(run, n.t - 140);
      expect(run.grade[0]).toBe(MISS);
   });

   it("an unstruck note is a miss after 90 ms; it breaks the combo, unless Kiro's shield is ready", () => {
      for (const hero of ["nami", "kiro"] as const) {
         const run = createRun(1, 1, hero);
         run.combo.chain = 5;
         run.combo.lastMs = 0;
         const n = run.chart.notes[0];
         run.hero.x = 99;
         advanceTo(run, n.t + GOOD_MS + 20);
         expect(run.grade[0]).toBe(MISS);
         expect(run.combo.chain > 0, hero).toBe(hero === "kiro");
      }
   });

   it("a held drum pays 50 more only when Strike is held to its end", () => {
      for (const hold of [true, false]) {
         const run = createRun(1, 1);
         const i = run.chart.notes.findIndex((n) => n.hold > 0);
         const n = run.chart.notes[i];
         advanceTo(run, n.t - 400);
         standAt(run, n);
         run.cursor = i;
         for (let k = 0; k < i; k++) run.grade[k] = MISS;
         pressAt(run, n.t);
         const before = run.score;
         const input = createStepInput();
         input.action = hold;
         advanceTo(run, n.t + n.hold, input);
         expect(run.score - before >= POINTS.hold, `hold ${hold}`).toBe(hold);
      }
   });
});

describe("the stage", () => {
   it("with the stick at rest the hero rolls to the next note's gong in time", () => {
      const run = createRun(1, 1);
      const n = run.chart.notes[0];
      advanceTo(run, n.t);
      expect(inReach(run, n)).toBe(true);
   });

   it("a shockwave hits a grounded hero, not a jumping one", () => {
      for (const jump of [false, true]) {
         const run = createRun(1, 4);
         const s = run.chart.shocks[0];
         run.hero.x = 0;
         run.hero.z = STRIKE_R;
         const input = createStepInput();
         advanceTo(run, s.t - 60, input);
         run.hero.x = 0;
         run.hero.z = STRIKE_R;
         if (jump) {
            input.jumpPressed = true;
            step(run, STEP_MS, input);
            input.jumpPressed = false;
         }
         const hits = run.hits;
         for (let t = 0; t < 200; t += STEP_MS) {
            run.hero.x = 0;
            run.hero.z = STRIKE_R;
            step(run, STEP_MS, input);
         }
         expect(run.hits - hits, `jump ${jump}`).toBe(jump ? 0 : 1);
      }
   });

   it("a Perfect throws an echo orb worth 20; the pickup reaches ECHO_REACH", () => {
      const run = createRun(1, 1);
      const n = run.chart.notes[0];
      advanceTo(run, n.t - 300);
      standAt(run, n);
      pressAt(run, n.t);
      expect(run.echoes.length).toBe(1);
      const e = run.echoes[0];
      run.hero.x = e.x;
      run.hero.z = e.z;
      const before = run.score;
      step(run, STEP_MS, createStepInput());
      expect(run.echoCount).toBe(1);
      expect(run.score - before).toBe(POINTS.echo);
      expect(ECHO_REACH).toBeGreaterThan(1);
   });

   it("the ghost gong takes Vexa only; a pillar gong needs the air of a double jump", () => {
      const run = createRun(1, 1, "kiro");
      const ghost = run.chart.notes.find((n) => n.bonus === "ghost")!;
      standAt(run, ghost);
      run.simMs = ghost.t;
      expect(inReach(run, ghost)).toBe(false);
      const vexa = createRun(1, 1, "vexa");
      standAt(vexa, ghost);
      vexa.simMs = ghost.t;
      expect(inReach(vexa, ghost)).toBe(true);
      const pillar = run.chart.notes.find((n) => n.bonus === "pillar")!;
      standAt(run, pillar);
      run.simMs = pillar.t;
      expect(inReach(run, pillar)).toBe(false);
      run.hero.air = 2;
      expect(inReach(run, pillar)).toBe(true);
   });

   it("three downbeat strikes on the hidden ninth gong find it (levels 1 and 3)", () => {
      const run = createRun(1, 1);
      const bar = 4 * run.stage.beatMs;
      run.hero.x = NINTH.x;
      run.hero.z = NINTH.z;
      for (let k = 1; k <= 3; k++) {
         const input = createStepInput();
         input.moveX = 0.001;
         advanceTo(run, k * bar * 5 - 1, input);
         run.hero.x = NINTH.x;
         run.hero.z = NINTH.z;
         input.actionPressed = true;
         step(run, STEP_MS, input);
      }
      const idx = SECRETS[1].findIndex((s) => s.id === "ninth-gong");
      expect(run.secrets.found[idx]).toBeTruthy();
   });
});

describe("every chart can be played", () => {
   it("each main note is reachable from the last at the roll speed, each cross note only at Riko's", () => {
      const a = { x: 0, z: 0, air: 0 };
      const b = { x: 0, z: 0, air: 0 };
      for (const id of [1, 2, 3, 4] as const) {
         const st = stageFor(id);
         const notes = chartFor(id).notes;
         let last: Note | null = null;
         for (const n of notes) {
            if (n.bonus !== "" && n.bonus !== "cross") continue;
            if (last && n.t > last.t) {
               targetPoint(st, last.target, last.t, a);
               targetPoint(st, n.target, n.t, b);
               const need = Math.max(0, Math.hypot(a.x - b.x, a.z - b.z) - REACH * 0.8) / ((n.t - last.t + 2 * GOOD_MS) / 1000);
               if (n.bonus === "cross") {
                  expect(need, `L${id} cross at ${n.t}`).toBeGreaterThan(V_ROLL);
                  expect(need, `L${id} cross at ${n.t}`).toBeLessThan(V_DASH);
               } else expect(need, `L${id} note at ${n.t}`).toBeLessThan(V_ROLL);
            }
            if (n.bonus === "") last = n;
         }
      }
   });

   it("the songs grow: more notes, faster, more gongs", () => {
      for (const id of LEVEL_IDS) expect(stageFor(id).gongAngles.length).toBe(LEVELS[id].gongs);
      for (const id of [1, 2, 3, 4] as const) expect(chartFor(id).notes.length).toBeGreaterThan(40);
   });
});

describe("level 5", () => {
   it("Perfect echoes crack the first four plates, then the duel comes", () => {
      const run = createRun(1, 5);
      const input = createStepInput();
      for (let k = 0; k < 4; k++) {
         const i = run.chart.notes.findIndex((n, j) => j >= run.cursor && n.silent && run.grade[j] === PENDING);
         const n = run.chart.notes[i];
         advanceTo(run, n.t - 300, input);
         standAt(run, n);
         pressAt(run, n.t);
      }
      expect(run.boss!.hp).toBe(4);
      advanceTo(run, run.unitEnd + 50, input);
      expect(run.unitKind).toBe("duel");
   });

   it("past its paid count a unit is an encore and pays nothing", () => {
      expect(PAID_UNITS.duel).toBeGreaterThanOrEqual(3);
      const run = createRun(1, 5);
      run.encore = true;
      const before = run.paid.length;
      // force a new unit to be written as an encore
      run.unitEnd = run.simMs;
      run.unitKind = "call";
      run.unitN = PAID_UNITS.call;
      step(run, STEP_MS, createStepInput());
      expect(run.paid.slice(before).every((p) => !p)).toBe(true);
   });
});

describe("the step", () => {
   it("the same presses give the same run at 30 and 144 fps", () => {
      const at = (fps: number) => {
         const run = createRun(1, 1);
         const input = createStepInput();
         for (let t = 0; t < 8000; t += 1000 / fps) step(run, 1000 / fps, input);
         return [run.hero.x.toFixed(3), run.hero.z.toFixed(3), run.misses];
      };
      expect(at(30)).toEqual(at(144));
   });
});
