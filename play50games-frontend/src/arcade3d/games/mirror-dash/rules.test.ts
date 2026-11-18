import { describe, expect, it } from "vitest";
import { LEVELS, parseCourse, zoneAt, type ObstacleKind } from "./levels";
import { CRACKS, ECHO_MS, createRun, idleInput, minFinishMs, runTimeMs, step, submittedMs, finalScore, STAT, type StepInput, type World } from "./rules";
import { botInput } from "./bot";

const I = (o: Partial<StepInput> = {}): StepInput => ({ ...idleInput(), ...o });
const run = (w: World, ms: number, input: StepInput = I(), hz = 120) => {
   for (let t = 0; t < ms; t += 1000 / hz) step(w, 1000 / hz, input);
};
/** the first obstacle of a kind on a level (and body) */
const first = (level: 1 | 2 | 3 | 4 | 5, kind: ObstacleKind, body?: 0 | 1) => parseCourse(level).obstacles.find((o) => o.kind === kind && (body === undefined || o.body === body))!;
/** put pair 0 just before s with both bodies on lanes */
const at = (w: World, s: number, hero: number, refl: number) => {
   const p = w.pairs[0];
   p.s = s;
   p.bodies[0].lane = p.bodies[0].off = hero;
   p.bodies[1].lane = p.bodies[1].off = refl;
   p.checkpoint = 0;
};

describe("the course", () => {
   it("reads rows: two runways of three lanes, flags for zones and checkpoints", () => {
      const c = parseCourse(2);
      expect(c.zones.includes("merge")).toBe(true);
      expect(c.checkpoints[0]).toBe(0);
      expect(c.obstacles.every((o) => o.lane >= -1 && o.lane <= 1)).toBe(true);
      expect(zoneAt(c, -5)).toBe("mirror");
      expect(zoneAt(c, 1e6)).toBe("mirror");
      // sorted by distance (the step relies on it)
      for (let i = 1; i < c.obstacles.length; i++) expect(c.obstacles[i].s).toBeGreaterThanOrEqual(c.obstacles[i - 1].s);
   });
});

describe("one input, two bodies", () => {
   it("a lane change is mirrored for the reflection; jumps and slides are copied", () => {
      const w = createRun(1);
      const p = w.pairs[0];
      step(w, 10, I({ right: true }));
      expect(p.bodies[0].lane).toBe(1);
      expect(p.bodies[1].lane).toBe(-1);
      step(w, 10, I({ jump: true }));
      run(w, 100);
      expect(p.bodies[0].y).toBeGreaterThan(0.3);
      expect(p.bodies[1].y).toBeCloseTo(p.bodies[0].y, 5);
   });
   it("frosted glass: the reflection copies the lane change", () => {
      const w = createRun(3);
      const p = w.pairs[0];
      const s = parseCourse(3).zones.indexOf("frost");
      at(w, 30 + s * 8, 0, 0);
      run(w, 20);
      expect(p.zone).toBe("frost");
      step(w, 10, I({ left: true }));
      expect(p.bodies[0].lane).toBe(-1);
      expect(p.bodies[1].lane).toBe(-1);
   });
   it("echo: the reflection repeats the press half a second later (mirrored)", () => {
      const w = createRun(4);
      const p = w.pairs[0];
      const s = parseCourse(4).zones.indexOf("echo");
      at(w, 30 + s * 8, 0, 0);
      run(w, 20);
      expect(p.zone).toBe("echo");
      step(w, 10, I({ right: true }));
      expect(p.bodies[0].lane).toBe(1);
      expect(p.bodies[1].lane).toBe(0);
      run(w, ECHO_MS + 30);
      expect(p.bodies[1].lane).toBe(-1);
   });
   it("merge: both bodies in the inner lanes meet and crack", () => {
      const w = createRun(2);
      const p = w.pairs[0];
      const s = parseCourse(2).zones.indexOf("merge");
      at(w, 30 + s * 8 - 3, 1, -1);
      run(w, 900);
      expect(p.merge).toBeGreaterThan(0.8);
      expect(p.hits).toBeGreaterThan(0);
   });
});

describe("obstacles and cracks", () => {
   it("a block cracks the pair (both slow down); a jump clears a hurdle; a slide passes under a bar", () => {
      const b = first(1, "B", 0);
      const w = createRun(1);
      at(w, b.s - 3, b.lane, -b.lane);
      run(w, 500);
      expect(w.pairs[0].hits).toBe(1);
      expect(w.pairs[0].cracks).toBe(1);
      const l = first(1, "L", 0);
      const w2 = createRun(1);
      at(w2, l.s - 2.4, l.lane, -l.lane);
      step(w2, 10, I({ jump: true }));
      run(w2, 600);
      expect(w2.pairs[0].hits).toBe(0);
      const h = first(1, "H", 1);
      const w3 = createRun(1);
      at(w3, h.s - 2, -h.lane, h.lane);
      step(w3, 10, I({ slide: true }));
      run(w3, 500);
      expect(w3.pairs[0].hits).toBe(0);
   });
   it("three cracks shatter the pair back to its checkpoint, whole again; a checkpoint heals cracks", () => {
      const w = createRun(1);
      const p = w.pairs[0];
      const cp = parseCourse(1).checkpoints[1];
      at(w, cp - 1, 0, 0);
      p.cracks = 2;
      run(w, 200);
      expect(p.checkpoint).toBe(cp);
      expect(p.cracks).toBe(0);
      const b = first(1, "B", 1);
      at(w, b.s - 2, -b.lane, b.lane);
      p.checkpoint = cp;
      p.cracks = CRACKS - 1;
      run(w, 400);
      expect(p.shatters).toBe(1);
      expect(p.cracks).toBe(0);
      expect(p.s).toBeLessThan(cp + 20);
   });
});

describe("hero powers", () => {
   it("Riko's dash breaks a cracked block", () => {
      const c = first(2, "C", 0);
      for (const hero of ["riko", "nami"] as const) {
         const w = createRun(2, hero);
         at(w, c.s - 4, c.lane, -c.lane);
         step(w, 10, I({ action: true }));
         run(w, 1300);
         const p = w.pairs[0];
         expect(p.hits, hero).toBe(hero === "riko" ? 0 : 1);
         if (hero === "riko") expect(p.secrets.found[1]).toBeTruthy();
      }
   });
   it("Vexa's phase passes ghost glass to the ghost-runway shard; Kiro's shield passes a laser", () => {
      const g = first(4, "G", 0);
      const w = createRun(4, "vexa");
      at(w, g.s - 4, g.lane, -g.lane);
      step(w, 10, I({ action: true }));
      run(w, 1200);
      expect(w.pairs[0].hits).toBe(0);
      expect(w.pairs[0].secrets.found[0]).toBeTruthy();
      const z = first(1, "Z", 0);
      const k = createRun(1, "kiro");
      at(k, z.s - 4, z.lane, -z.lane);
      step(k, 10, I({ action: true }));
      run(k, 500);
      expect(k.pairs[0].hits).toBe(0);
   });
   it("Zuno's magnet takes orbs from both runways at once; Nyla jumps twice", () => {
      const o = parseCourse(1).orbs.filter((x) => x.s === parseCourse(1).orbs.find((y) => y.body === 0)!.s);
      const w = createRun(1, "zuno");
      at(w, o[0].s - 5, 0, 0);
      step(w, 10, I({ action: true }));
      run(w, 800);
      expect(w.pairs[0].orbs).toBeGreaterThanOrEqual(o.length);
      const n = createRun(1, "nami");
      step(n, 10, I({ jump: true }));
      run(n, 200);
      const y1 = n.pairs[0].bodies[0].y;
      step(n, 10, I({ jump: true }));
      run(n, 150);
      expect(n.pairs[0].bodies[0].y).toBeGreaterThan(y1);
   });
});

describe("the Glass Sentinel and the run", () => {
   it("the bot clears L5: the Sentinel loses all 5 hp across its three phases", () => {
      const w = createRun(5);
      const phases = new Set<number>();
      for (let f = 0; f < 60 * 200 && !w.ended; f++) {
         step(w, 1000 / 60, botInput(w));
         const g = w.pairs[0].boss!;
         if (g.active) phases.add(g.state.phase);
      }
      expect(w.ended).toBe("win");
      expect(w.pairs[0].boss!.state.hp).toBe(0);
      expect([...phases].sort()).toEqual([0, 1, 2]);
   }, 60_000);
   it("time ends a run unranked; a win submits finish minus the orb and flow bonus", () => {
      const w = createRun(1);
      w.pairs[0].finishS = Infinity;
      run(w, LEVELS[1].durationMs + 100, I(), 30);
      expect(w.ended).toBe("timeup");
      expect(runTimeMs(10_000, 3, 500)).toBe(10_000 - 1200 - 500);
      expect(finalScore({ score: 0, endReason: "timeup", stats: {}, elapsedMs: 5000 }).durationMs).toBe(5000);
      expect(finalScore({ score: 1, endReason: "win", stats: { [STAT.finishMs]: 9000, [STAT.orbs]: 1, [STAT.comboMs]: 0 }, elapsedMs: 9100 }).durationMs).toBe(8600);
   });
   it("the lower bound never exceeds a bot's finish, and frame rate barely moves the time", () => {
      for (const id of [1, 2, 3, 4, 5] as const) {
         const a = createRun(id);
         const b = createRun(id);
         for (let f = 0; f < 60 * 200 && !a.ended; f++) step(a, 1000 / 60, botInput(a));
         for (let f = 0; f < 144 * 200 && !b.ended; f++) step(b, 1000 / 144, botInput(b));
         expect(a.ended).toBe("win");
         expect(b.ended).toBe("win");
         expect(minFinishMs(id)).toBeLessThanOrEqual(a.pairs[0].finishMs);
         expect(Math.abs(submittedMs(a.pairs[0]) - submittedMs(b.pairs[0]))).toBeLessThan(2500);
      }
   }, 300_000);
});
