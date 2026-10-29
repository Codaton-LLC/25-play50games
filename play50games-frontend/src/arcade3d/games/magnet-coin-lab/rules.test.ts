import { describe, expect, it } from "vitest";
import { LEVELS, T, parseRoom } from "./levels";
import { COIN, HOLD_MS, LAUNCH, PAD, createRun, createWorld, idleInput, minFinishMs, runTimeMs, step, submittedMs, finalScore, STAT, type StepInput, type World } from "./rules";
import { botInput } from "./bot";

const I = (o: Partial<StepInput> = {}): StepInput => ({ ...idleInput(), ...o });
const run = (w: World, ms: number, input: StepInput | ((w: World) => StepInput) = I(), hz = 120) => {
   for (let t = 0; t < ms; t += 1000 / hz) step(w, 1000 / hz, typeof input === "function" ? input(w) : input);
};
const settle = (w: World) => run(w, 400);
/** put hero 0 into room k at (x, y) */
const place = (w: World, k: number, x: number, y: number) => {
   const h = w.heroes[0];
   h.room = k;
   h.x = x;
   h.y = y;
   h.vx = h.vy = 0;
   h.latched = -1;
};

describe("parsing", () => {
   it("reads the legend: walls, gates, pads on floors launch, pads in the air pull", () => {
      const r = parseRoom(LEVELS[1].rooms[1]);
      expect(r.pads).toHaveLength(1);
      expect(r.pads[0].floor).toBe(false);
      const l = parseRoom(LEVELS[1].rooms[2]);
      expect(l.pads[0].floor).toBe(true);
      const g = parseRoom(LEVELS[2].rooms[0]);
      expect(g.tiles.includes(T.GATE_P)).toBe(true);
      // the door is two cells tall
      expect(r.tiles[(r.h - 1 - r.door.y - 1) * r.w + Math.floor(r.door.x)]).toBe(T.DOOR);
   });
   it("rejects a ragged or unknown map", () => {
      expect(() => parseRoom({ need: 1, hint: "", map: ["#S", "#E#"] })).toThrow();
      expect(() => parseRoom({ need: 1, hint: "", map: ["#SZE"] })).toThrow();
   });
});

describe("the sign: a tap flips, a hold fires the power", () => {
   it("a short tap flips on release; a hold past HOLD_MS fires the power and does not flip", () => {
      const w = createRun(1, "kiro");
      settle(w);
      const h = w.heroes[0];
      expect(h.sign).toBe(1);
      run(w, 100, I({ action: true }));
      run(w, 20);
      expect(h.sign).toBe(-1);
      run(w, HOLD_MS + 80, I({ action: true }));
      expect(h.powerMs).toBeGreaterThan(0);
      run(w, 20);
      expect(h.sign).toBe(-1);
   });
});

describe("pads", () => {
   it("an opposite hanging node pulls the hero over the gap and latches it; Jump lets go", () => {
      const w = createRun(1);
      const h = w.heroes[0];
      place(w, 1, 4.5, 1);
      h.sign = -1;
      run(w, 2500, I({ x: 0.3 }));
      expect(h.latched).toBe(0);
      const node = w.rooms[1].def.pads[0];
      expect(Math.abs(h.x - node.x)).toBeLessThan(0.3);
      step(w, 1000 / 120, I({ jump: true }));
      run(w, 60);
      expect(h.latched).toBe(-1);
      expect(h.vy).toBeGreaterThan(0);
   });
   it("a same-sign floor pad launches the hero about 8 m; an opposite one does nothing", () => {
      const w = createRun(1);
      const h = w.heroes[0];
      const pad = w.rooms[2].def.pads[0];
      place(w, 2, pad.x, 1);
      settle(w);
      let top = h.y;
      for (let t = 0; t < 1500; t += 1000 / 120) {
         step(w, 1000 / 120, I());
         top = Math.max(top, h.y);
      }
      expect(top).toBeGreaterThan(5.5);
      expect(LAUNCH).toBeCloseTo(Math.sqrt(2 * 30 * 8));
      const w2 = createRun(1);
      place(w2, 2, pad.x, 1);
      w2.heroes[0].sign = -1;
      let top2 = 0;
      for (let t = 0; t < 1500; t += 1000 / 120) {
         step(w2, 1000 / 120, I());
         top2 = Math.max(top2, w2.heroes[0].y);
      }
      expect(top2).toBeLessThan(1.5);
      expect(PAD.range).toBe(7);
   });
});

describe("coins", () => {
   it("a pile feeds the swarm one coin at a time; the swarm follows and is banked; the quota opens the door", () => {
      const w = createRun(1);
      const h = w.heroes[0];
      const pile = w.rooms[0].def.piles[0];
      place(w, 0, pile.x, 1);
      run(w, 40);
      expect(h.swarm).toBeLessThanOrEqual(2);
      run(w, 800);
      expect(h.swarm).toBe(6);
      expect(w.rooms[0].doorOpen).toBe(false);
      run(w, 4000, (ww) => I({ x: ww.heroes[0].x < ww.rooms[0].def.bank.x ? 1 : 0 }));
      expect(w.rooms[0].banked).toBeGreaterThanOrEqual(5);
      expect(w.rooms[0].doorOpen).toBe(true);
   });
   it("coins dropped into a pit are lost and come back to their pile after 3 s", () => {
      const w = createRun(1);
      place(w, 1, 20, 1);
      const r = w.rooms[1];
      const c = r.coins[0];
      c.state = "free";
      c.x = 7.5;
      c.y = 1.5;
      run(w, 600);
      expect(c.state).toBe("lost");
      run(w, COIN.respawnMs + 100);
      expect(c.state).toBe("pile");
   });
   it("a gate stops the coins of the wrong sign; the swarm flips with its hero", () => {
      const w = createRun(2);
      const h = w.heroes[0];
      const pile = w.rooms[0].def.piles[0];
      place(w, 0, pile.x, 1);
      run(w, 900);
      expect(h.swarm).toBe(6);
      // as -, the + gate (column 8) holds both the hero and the coins back
      run(w, 120, I({ action: true }));
      run(w, 20);
      expect(h.sign).toBe(-1);
      run(w, 2500, I({ x: 1 }));
      expect(h.x).toBeLessThan(8);
      for (const c of w.rooms[0].coins) if (c.state === "swarm") expect(c.x).toBeLessThan(8.2);
   });
});

describe("blocks, drones, hazards", () => {
   it("a same-sign hero pushes a block away along its row; an opposite one pulls it close", () => {
      const w = createRun(3);
      const h = w.heroes[0];
      const b = w.rooms[0].blocks[0];
      place(w, 0, b.x - 2, 1);
      const x0 = b.x;
      run(w, 600);
      expect(b.x).toBeGreaterThan(x0 + 0.5);
      h.sign = -1;
      const x1 = b.x;
      run(w, 600);
      expect(b.x).toBeLessThan(x1);
   });
   it("a - hero standing on a block rides it across the rail gap", () => {
      const w = createRun(3);
      const h = w.heroes[0];
      const b = w.rooms[3].blocks[0];
      place(w, 3, b.x, b.y + 1);
      h.sign = -1;
      settle(w);
      run(w, 1600, I({ x: 1 }));
      expect(h.x).toBeGreaterThan(14);
      expect(h.y).toBeGreaterThan(0.9);
   });
   it("a drone steals from the swarm; a + hero up close knocks the coins loose", () => {
      const w = createRun(4);
      const h = w.heroes[0];
      const d = w.rooms[0].drones[0];
      const pile = w.rooms[0].def.piles[0];
      place(w, 0, pile.x, 1);
      run(w, 1000);
      h.sign = -1;
      d.x = h.x;
      d.y = h.y + 1;
      run(w, 300);
      expect(d.carrying).toBeGreaterThan(0);
      h.sign = 1;
      d.x = h.x + 1;
      d.y = h.y + 1.2;
      run(w, 60);
      expect(d.carrying).toBe(0);
      expect(d.stunMs).toBeGreaterThan(0);
   });
   it("a spark floor stings and scatters the swarm; Kiro's shield crosses it", () => {
      for (const hero of ["zuno", "kiro"] as const) {
         const w = createRun(2, hero);
         const h = w.heroes[0];
         const pile = w.rooms[3].def.piles[0];
         place(w, 3, pile.x, 1);
         run(w, 1000);
         expect(h.swarm).toBe(6);
         if (hero === "kiro") run(w, HOLD_MS + 60, I({ action: true }));
         place(w, 3, 11.5, 1);
         w.heroes[0].room = 3;
         run(w, 100);
         if (hero === "kiro") expect(h.hits).toBe(0);
         else expect(h.hits).toBe(1);
      }
   });
});

describe("hero routes and secrets", () => {
   it("Vexa phases through the ghost wall to the storage-room shard; others cannot", () => {
      for (const hero of ["vexa", "riko"] as const) {
         const w = createRun(2, hero);
         const h = w.heroes[0];
         const r = w.rooms[2].def;
         place(w, 2, r.start.x, r.start.y);
         settle(w);
         run(w, HOLD_MS + 60, I({ action: true, x: -1 }));
         run(w, 1200, I({ x: -1 }));
         expect(!!h.secrets.found[0], hero).toBe(hero === "vexa");
      }
   });
   it("Zuno's overcharge pulls the prototype sticker through the glass", () => {
      for (const hero of ["zuno", "nami"] as const) {
         const w = createRun(4, hero);
         const h = w.heroes[0];
         const s = w.rooms[2].def.secrets.find((x) => x.id === 1)!;
         place(w, 2, s.x - 3.2, 1);
         settle(w);
         run(w, HOLD_MS + 200, I({ action: true }));
         expect(!!h.secrets.found[1], hero).toBe(hero === "zuno");
      }
   });
   it("pushing the block into the vent opens the hidden wall (the vault shard behind it)", () => {
      const w = createRun(3);
      place(w, 2, 2, 1);
      const r = w.rooms[2];
      const v = r.def.vents[0];
      r.blocks[0].x = v.x - 0.2;
      run(w, 200);
      expect(r.ventOpen).toBe(true);
   });
   it("Riko's dash breaks cracked glass to the spare coins", () => {
      const w = createRun(4, "riko");
      const h = w.heroes[0];
      const r = w.rooms[4];
      place(w, 4, 4.5, 1);
      h.facing = -1;
      settle(w);
      run(w, HOLD_MS + 200, I({ action: true, x: -1 }));
      expect(Array.from(r.tiles).includes(T.CRACKED)).toBe(false);
      run(w, 1200, I({ x: -1 }));
      expect(r.coins.some((c) => c.pile === 0 && c.state === "swarm")).toBe(true);
   });
});

describe("Scrap Magnus and the run", () => {
   it("the bot clears L5: Magnus loses all 7 hp across three phases and the arena door opens", () => {
      const w = createRun(5);
      const phases = new Set<number>();
      for (let f = 0; f < 60 * 200 && !w.ended; f++) {
         step(w, 1000 / 60, botInput(w));
         if (w.magnus?.active) phases.add(w.magnus.state.phase);
      }
      expect(w.ended).toBe("win");
      expect(w.magnus!.state.hp).toBe(0);
      expect([...phases].sort()).toEqual([0, 1, 2]);
   });
   it("an opposite-sign hero caught in the slam is hurt; a same-sign one is shoved clear", () => {
      for (const same of [true, false]) {
         const w = createRun(5);
         const m = w.magnus!;
         const h = w.heroes[0];
         place(w, 2, m.x - 3, 1);
         run(w, 100);
         // wait for the first slam
         let t = 0;
         while (m.state.step !== "attack" && t < 20000) {
            h.sign = same ? m.sign : m.sign === 1 ? -1 : 1;
            h.x = m.x - 3;
            step(w, 1000 / 120, I());
            t += 1000 / 120;
         }
         h.sign = same ? m.sign : m.sign === 1 ? -1 : 1;
         run(w, 300);
         expect(h.hits > 0, `same ${same}`).toBe(!same);
      }
   });
   it("time ends a run unranked; a win submits finish minus the orb and flow bonus", () => {
      const w = createRun(1);
      run(w, LEVELS[1].durationMs + 100, I(), 30);
      expect(w.ended).toBe("timeup");
      expect(runTimeMs(10_000, 3, 500)).toBe(10_000 - 1200 - 500);
      expect(finalScore({ score: 0, endReason: "timeup", stats: {}, elapsedMs: 5000 }).durationMs).toBe(5000);
      expect(finalScore({ score: 1, endReason: "win", stats: { [STAT.finishMs]: 9000, [STAT.orbs]: 1, [STAT.comboMs]: 0 }, elapsedMs: 9100 }).durationMs).toBe(8600);
   });
   it("the same inputs give the same run at any frame rate (fixed 120 Hz rules)", () => {
      const a = createRun(2);
      const b = createRun(2);
      for (let f = 0; f < 60 * 60 && !a.ended; f++) step(a, 1000 / 60, botInput(a));
      for (let f = 0; f < 144 * 60 && !b.ended; f++) step(b, 1000 / 144, botInput(b));
      expect(a.ended).toBe("win");
      expect(b.ended).toBe("win");
      expect(Math.abs(submittedMs(a.heroes[0]) - submittedMs(b.heroes[0]))).toBeLessThan(2500);
   });
   it("the lower bound never exceeds a bot's finish", () => {
      for (const id of [1, 2, 3, 4, 5] as const) {
         const w = createWorld(id, ["zuno"]);
         for (let f = 0; f < 60 * 200 && !w.ended; f++) step(w, 1000 / 60, botInput(w));
         expect(w.ended).toBe("win");
         expect(minFinishMs(id)).toBeLessThanOrEqual(w.heroes[0].finishMs);
      }
   }, 60_000);
});
