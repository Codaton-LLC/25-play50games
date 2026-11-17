// The rules: the round clock (call, lock-in, drop, rise), survival and falls, the safe marker, holes that
// never split the floor, swaps, the sweeper's face, the powers' limits, the Keeper's cycle and beacon,
// determinism and frame-rate independence.
import { describe, expect, it } from "vitest";
import { createBot, botInput } from "./bot";
import { LEVELS } from "./levels";
import { KEEPER } from "./progression";
import {
   DROP_MS, DROP_SOLID_MS, LOCK_MS, MIN_CALL_MS, RAINBOW, RISE_MS, START_MS, STEP_MS, TILE_P, createRun, createStepInput, safeTile, staysConnected, step, stepArena, tileAt, tileCentre, tileSafe, tileSolid,
   type ArenaRun,
} from "./rules";

const idle = createStepInput();
const c = { x: 0, z: 0 };

function advance(run: ArenaRun, ms: number, input = idle): void {
   for (let t = 0; t < ms; t += STEP_MS) step(run, STEP_MS, input);
}

/** Puts the hero on tile i, standing. */
function place(run: ArenaRun, i: number): void {
   tileCentre(run.arena, i, c);
   const h = run.hero;
   h.x = c.x;
   h.z = c.z;
   h.y = 0;
   h.vx = h.vy = h.vz = 0;
   h.grounded = true;
}

function firstTile(run: ArenaRun, pred: (i: number) => boolean): number {
   for (let i = 0; i < run.arena.colour.length; i++) if (pred(i)) return i;
   return -1;
}

describe("the round clock", () => {
   it("the first call starts START_MS in; without a lock-in the call runs callMs, then the drop and the rise", () => {
      const run = createRun(3, 1);
      const a = run.arena;
      advance(run, START_MS - 20);
      expect(a.phase).toBe("start");
      advance(run, 40);
      expect(a.phase).toBe("call");
      expect(a.round).toBe(1);
      // the hero walks off the floor's colours: hold it in the air so it cannot lock in
      run.hero.grounded = false;
      run.hero.y = 50;
      run.hero.vy = 0;
      const t0 = a.simMs;
      while (a.phase === "call") stepArena(a, STEP_MS);
      expect(a.simMs - t0).toBeGreaterThanOrEqual(LEVELS[1].callMs - STEP_MS - 1e-6);
      const t1 = a.simMs;
      while (a.phase === "drop") stepArena(a, STEP_MS);
      expect(a.simMs - t1).toBeGreaterThanOrEqual(DROP_MS - STEP_MS - 1e-6);
      expect(a.phase).toBe("rise");
      const t2 = a.simMs;
      while (a.phase === "rise") stepArena(a, STEP_MS);
      expect(a.simMs - t2).toBeGreaterThanOrEqual(RISE_MS - STEP_MS - 1e-6);
      expect(a.round).toBe(2);
   });

   it("standing still on the called colour locks in, but never before the call is MIN_CALL_MS old", () => {
      const run = createRun(4, 1);
      advance(run, START_MS + 20);
      const a = run.arena;
      place(run, firstTile(run, (i) => tileSafe(a, i)));
      const t0 = a.phaseMs;
      while (a.phase === "call") step(run, STEP_MS, idle);
      expect(a.phase).toBe("drop");
      expect(a.simMs).toBeGreaterThanOrEqual(START_MS + MIN_CALL_MS);
      expect(run.lockAt).toBeGreaterThanOrEqual(LOCK_MS - STEP_MS - 1e-6);
      expect(t0).toBeLessThan(100);
   });

   it("running across the called colour does not lock in (it needs a standing hero)", () => {
      const run = createRun(4, 1);
      advance(run, START_MS + 20);
      const a = run.arena;
      place(run, firstTile(run, (i) => tileSafe(a, i)));
      run.hero.vx = 6;
      for (let k = 0; k < 60; k++) {
         run.hero.vx = 6;
         run.hero.x = Math.max(-a.half + 0.5, Math.min(a.half - 0.5, run.hero.x));
         step(run, STEP_MS, { ...idle, moveX: 1 });
      }
      expect(run.lockMs).toBe(0);
   });
});

describe("survival and falls", () => {
   it("on the called colour you survive the drop; on another you fall, lose a heart and come back on the safe marker", () => {
      const ok = createRun(5, 2);
      advance(ok, START_MS + 20);
      place(ok, firstTile(ok, (i) => tileSafe(ok.arena, i)));
      while (ok.arena.dropsEnded === 0) step(ok, STEP_MS, idle);
      step(ok, STEP_MS, idle);
      expect(ok.survived).toBe(1);
      expect(ok.lives).toBe(3);

      const bad = createRun(5, 2);
      advance(bad, START_MS + 20);
      const wrong = firstTile(bad, (i) => !tileSafe(bad.arena, i) && !bad.arena.hole[i]);
      place(bad, wrong);
      let fell = false;
      for (let k = 0; k < 2000 && !fell; k++) fell = step(bad, STEP_MS, idle).fell;
      expect(fell).toBe(true);
      expect(bad.lives).toBe(2);
      expect(bad.hits).toBe(1);
      expect(bad.hero.state).toBe("play");
      expect(bad.respawnTile).toBeGreaterThanOrEqual(0);
      expect(tileSolid(bad.arena, bad.respawnTile)).toBe(true);
   });

   it("a wrong tile holds for DROP_SOLID_MS of the drop, then lets go", () => {
      const run = createRun(6, 1);
      advance(run, START_MS + 20);
      const a = run.arena;
      const wrong = firstTile(run, (i) => !tileSafe(a, i));
      while (a.phase === "call") stepArena(a, STEP_MS);
      expect(tileSolid(a, wrong)).toBe(true);
      while (a.phaseMs < DROP_SOLID_MS) stepArena(a, STEP_MS);
      expect(tileSolid(a, wrong)).toBe(false);
   });

   it("three falls end the run lose", () => {
      const run = createRun(7, 1);
      let lost = false;
      for (let k = 0; k < 20_000 && !lost; k++) {
         // walk straight off the north edge every time
         lost = step(run, 1000 / 60, { ...idle, moveZ: -1 }).lost;
      }
      expect(lost).toBe(true);
      expect(run.ended).toBe("lose");
      expect(run.lives).toBe(0);
   });

   it("the safe marker is a safe tile during a call", () => {
      const run = createRun(8, 3);
      advance(run, START_MS + 20);
      const t = safeTile(run.arena, 0, 0);
      expect(tileSafe(run.arena, t)).toBe(true);
   });
});

describe("the floor's rules by level", () => {
   it("level 1 has two colours in 2 x 2 patches and no holes; every call leaves at least three safe tiles", () => {
      const run = createRun(9, 1);
      const a = run.arena;
      advance(run, START_MS + 20);
      for (let r = 0; r < 5; r++) {
         let safe = 0;
         for (let i = 0; i < a.colour.length; i++) {
            if (a.colour[i] !== RAINBOW) expect(a.colour[i]).toBeLessThan(2);
            if (tileSafe(a, i)) safe++;
         }
         expect(safe).toBeGreaterThanOrEqual(3);
         const round = a.round;
         while (a.round === round) stepArena(a, STEP_MS);
      }
      expect([...a.hole].every((x) => x === 0)).toBe(true);
   });

   it("levels 2-4: holes accumulate but the floor never splits, and never drops under its share", () => {
      for (const level of [2, 3, 4] as const) {
         const run = createRun(10 + level, level);
         const a = run.arena;
         run.hero.y = 50;
         run.hero.grounded = false;
         for (let k = 0; k < 400_000 && a.round < LEVELS[level].rounds + 4; k++) {
            stepArena(a, STEP_MS);
            run.hero.y = 50;
         }
         const holes = [...a.hole].filter(Boolean).length;
         expect(holes).toBeGreaterThan(0);
         expect(a.n * a.n - holes).toBeGreaterThanOrEqual(Math.ceil(LEVELS[level].minFloorShare * a.n * a.n) - LEVELS[level].holesPerRound);
         expect(staysConnected(a, -1)).toBe(true);
      }
   });

   it("level 3: the swap tiles change colour halfway through the call", () => {
      const run = createRun(12, 3);
      const a = run.arena;
      advance(run, START_MS + 20);
      expect(a.swapTiles.length).toBeGreaterThan(0);
      const before = a.swapTiles.map((t) => a.colour[t]);
      while (a.phase === "call" && a.phaseMs < a.swapAt + STEP_MS) stepArena(a, STEP_MS);
      const after = a.swapTiles.map((t) => a.colour[t]);
      expect(after).toEqual(a.swapTo);
      expect(after).not.toEqual(before);
   });

   it("level 4: the sweeper's face knocks a standing hero; one in the air at its height is passed", () => {
      const knockAt = (y: number): boolean => {
         const run = createRun(13, 4);
         advance(run, START_MS + 20);
         const a = run.arena;
         // stand 3 m out, just ahead of the bar
         const ang = a.sweepAngle + 0.4;
         let knocked = false;
         for (let k = 0; k < 120 && !knocked; k++) {
            run.hero.x = Math.cos(ang) * 3;
            run.hero.z = Math.sin(ang) * 3;
            run.hero.y = y;
            run.hero.vx = run.hero.vz = run.hero.vy = 0;
            run.hero.grounded = y === 0;
            knocked = step(run, STEP_MS, idle).knocked;
         }
         return knocked;
      };
      expect(knockAt(0)).toBe(true);
      expect(knockAt(1.2)).toBe(false);
   });
});

describe("powers never beat the mechanic", () => {
   it("Vexa's phase holds her over a hole, but she cannot lock in while phased", () => {
      const run = createRun(14, 1, "vexa");
      advance(run, START_MS + 20);
      const a = run.arena;
      const t = firstTile(run, (i) => tileSafe(a, i));
      place(run, t);
      a.hole[t] = 1;
      step(run, STEP_MS, { ...idle, actionPressed: true });
      advance(run, 200);
      expect(run.hero.grounded).toBe(true);
      expect(run.lockMs).toBe(0);
   });

   it("Kiro's shield bounces him onto the safe marker instead of costing a heart", () => {
      const run = createRun(15, 1, "kiro");
      advance(run, START_MS + 20);
      const a = run.arena;
      place(run, firstTile(run, (i) => !tileSafe(a, i)));
      while (a.phase === "call") step(run, STEP_MS, idle);
      step(run, STEP_MS, { ...idle, actionPressed: true });
      let saved = false;
      for (let k = 0; k < 400 && !saved; k++) saved = step(run, STEP_MS, idle).saved;
      expect(saved).toBe(true);
      expect(run.lives).toBe(3);
   });
});

describe("level 5: the Prism Keeper", () => {
   it("its cycle is the round: telegraph = call, attack = drop, vulnerable = rise; a beacon every third round", () => {
      const run = createRun(16, 5);
      const a = run.arena;
      while (a.boss!.step === "intro") stepArena(a, STEP_MS);
      expect(a.phase).toBe("call");
      while (a.boss!.step === "telegraph") stepArena(a, STEP_MS);
      expect(a.phase).toBe("drop");
      while (a.boss!.step === "attack") stepArena(a, STEP_MS);
      expect(a.phase).toBe("rise");
      for (let k = 0; k < 400_000 && a.round < 3; k++) stepArena(a, STEP_MS);
      expect(a.beaconTile).toBeGreaterThanOrEqual(0);
      expect(a.colour[a.beaconTile]).toBe(a.called);
   });

   it("standing on the beacon when the window opens strikes the Keeper once", () => {
      const run = createRun(17, 5);
      const a = run.arena;
      for (let k = 0; k < 400_000 && a.round < 3; k++) step(run, STEP_MS, idle);
      place(run, a.beaconTile);
      let hits = 0;
      for (let k = 0; k < 2000 && a.boss!.step !== "vulnerable"; k++) {
         place(run, a.beaconTile);
         if (step(run, STEP_MS, idle).bossHit) hits++;
      }
      for (let k = 0; k < 60; k++) if (step(run, STEP_MS, idle).bossHit) hits++;
      expect(hits).toBe(1);
      expect(a.boss!.hp).toBe(KEEPER.maxHp - 1);
   });
});

describe("determinism", () => {
   it("the same seed, level, hero and inputs give the same run at 30, 60 and 144 fps", () => {
      const go = (fps: number): ArenaRun => {
         const run = createRun(21, 2, "nami");
         const bot = createBot(run, 1000 / fps);
         const input = createStepInput();
         for (let f = 0; f < 120 * fps && run.ended === null; f++) {
            botInput(bot, run, input);
            step(run, 1000 / fps, input);
         }
         return run;
      };
      const a = go(60);
      const b = go(60);
      expect(b.finishMs).toBe(a.finishMs);
      expect(Array.from(b.arena.hole)).toEqual(Array.from(a.arena.hole));
      for (const fps of [30, 144]) expect(go(fps).ended).toBe("win");
   });

   it("tileAt and tileCentre agree, and the seams belong to their tiles", () => {
      const run = createRun(1, 4);
      const a = run.arena;
      for (let i = 0; i < a.n * a.n; i++) {
         tileCentre(a, i, c);
         expect(tileAt(a, c.x, c.z)).toBe(i);
         expect(tileAt(a, c.x + TILE_P * 0.49, c.z)).toBe(i);
      }
      expect(tileAt(a, a.half + 0.01, 0)).toBe(-1);
   });
});
