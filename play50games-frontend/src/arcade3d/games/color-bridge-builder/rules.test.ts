import { describe, expect, it } from "vitest";
import { BLUE, LEVELS, RED, T, YELLOW, parseLevel, type BridgeLevel } from "./levels";
import { FALL_MS, KEEPER_WANTS, STAT, createRun, finalScore, flickerOn, idleInput, minFinishMs, plateColor, runTimeMs, step, walkable, type StepInput, type World } from "./rules";
import { botInput } from "./bot";
import { KEEPER } from "./progression";

const I = (o: Partial<StepInput> = {}): StepInput => ({ ...idleInput(), ...o });
const run = (w: World, ms: number, input: StepInput = I(), hz = 120) => {
   for (let t = 0; t < ms; t += 1000 / hz) step(w, 1000 / hz, input);
};
const put = (w: World, r: number, c: number) => {
   const t = w.teams[0];
   t.r = t.fr = t.safeR = r;
   t.c = t.fc = t.safeC = c;
   t.moving = null;
};
const bridgeAt = (w: World, r: number, c: number) => w.bridge[r * w.map.w + c];

describe("beams and bridges", () => {
   it("a beam that ends on an anchor lights a bridge of its colour over the chasm", () => {
      const w = createRun(1);
      expect(bridgeAt(w, 13, 2)).toBe(RED);
      expect(bridgeAt(w, 12, 2)).toBe(RED);
      // the dark node: no bridge until its switch is pressed
      expect(bridgeAt(w, 8, 5)).toBe(0);
   });
   it("crossing beams mix after the crossing: red + blue = purple", () => {
      const w = createRun(1);
      w.nodeColor[1] = RED;
      run(w, 20);
      expect(bridgeAt(w, 4, 3)).toBe(RED);
      expect(bridgeAt(w, 3, 3)).toBe(RED | BLUE);
      expect(bridgeAt(w, 2, 3)).toBe(RED | BLUE);
      // and the horizontal beam past the crossing too
      expect(bridgeAt(w, 3, 2)).toBe(RED | BLUE);
      expect(bridgeAt(w, 3, 6)).toBe(BLUE);
   });
   it("a prism turns a beam; bumping it rotates it once per push", () => {
      const w = createRun(2);
      expect(bridgeAt(w, 13, 5)).toBe(0);
      put(w, 16, 6);
      run(w, 60, I({ dc: -1 }));
      run(w, 200);
      expect(w.prismKind[0]).toBe(0);
      expect(bridgeAt(w, 13, 5)).toBe(YELLOW);
   });
   it("orange bridges flicker; white is anyone's", () => {
      expect(flickerOn(0)).toBe(true);
      expect(flickerOn(900)).toBe(false);
      const w = createRun(3);
      expect(bridgeAt(w, 13, 4)).toBe(RED | YELLOW);
      w.ms = 900;
      expect(walkable(w, w.teams[0], 13, 4)).toBe(false);
      w.ms = 100;
      expect(walkable(w, w.teams[0], 13, 4)).toBe(true);
   });
});

describe("walking, tagging, falling", () => {
   it("only the hero of a bridge's colour walks it; the wrong one falls and is back on its rock a second later", () => {
      const w = createRun(1, "nami");
      const t = w.teams[0];
      run(w, 420, I({ dr: -1 }));
      run(w, 60);
      expect(t.falls).toBe(1);
      run(w, FALL_MS + 50);
      expect([t.r, t.c]).toEqual([15, 2]);
      expect(walkable(w, t, 14, 2, "riko")).toBe(true);
   });
   it("Tag swaps to the hero the bridge ahead needs, else to the next hero", () => {
      const w = createRun(1, "nami");
      const t = w.teams[0];
      run(w, 185, I({ dr: -1 }));
      run(w, 40);
      expect(t.r).toBe(15);
      step(w, 10, I({ tag: -1 }));
      expect(t.heroId).toBe("riko");
      run(w, 200);
      step(w, 10, I({ tag: 4 }));
      expect(t.heroId).toBe("zuno");
   });
   it("a tag mid-step lands the new hero on the new colour (red -> purple as Vexa)", () => {
      const w = createRun(1, "riko");
      w.nodeColor[1] = RED;
      put(w, 4, 3);
      run(w, 20);
      step(w, 10, I({ dr: -1 }));
      run(w, 60);
      step(w, 10, I({ tag: 5 }));
      run(w, 300);
      const t = w.teams[0];
      expect(t.heroId).toBe("vexa");
      expect([t.r, t.c]).toEqual([3, 3]);
      expect(t.falls).toBe(0);
   });
   it("a switch cycles its node; the timed node goes dark after 10 s", () => {
      const w = createRun(4);
      put(w, 11, 9);
      run(w, 300, I({ dc: 1 }));
      expect(w.nodeColor[1]).toBe(RED);
      run(w, 10_200);
      expect(w.nodeColor[1]).toBe(0);
   });
});

describe("hero powers", () => {
   it("Riko's dash crosses gaps and smashes cracked rock (the hidden shard)", () => {
      const w = createRun(4, "riko");
      put(w, 6, 9);
      w.teams[0].facing = 1;
      step(w, 10, I({ action: true }));
      run(w, 500);
      expect(w.tiles[6 * w.map.w + 10]).toBe(T.ROCK);
      expect(w.teams[0].secrets.found[2]).toBeTruthy();
   });
   it("Nyla leaps two cells; Vexa's phase walks any light; Kiro's shield blocks a beam", () => {
      const n = createRun(1, "nami");
      put(n, 6, 8);
      n.teams[0].facing = 3;
      step(n, 10, I({ action: true }));
      run(n, 500);
      expect(n.teams[0].c).toBe(6);
      const v = createRun(1, "vexa");
      put(v, 15, 2);
      step(v, 10, I({ action: true }));
      run(v, 20);
      run(v, 250, I({ dr: -1 }));
      expect(v.teams[0].falls).toBe(0);
      const k = createRun(1, "kiro");
      put(k, 11, 2);
      run(k, 20);
      expect(k.bridge[12 * k.map.w + 2]).toBe(RED);
      step(k, 10, I({ action: true }));
      run(k, 20);
      // standing on the anchor, the shield swallows the beam: no anchor, no bridge
      expect(k.bridge[12 * k.map.w + 2]).toBe(0);
   });
   it("Zuno's magnet pulls a prism one cell toward him", () => {
      const def: BridgeLevel = { ...LEVELS[2], map: [...LEVELS[2].map] };
      const z = createRun(2, "zuno");
      put(z, 16, 8);
      z.teams[0].facing = 3;
      step(z, 10, I({ action: true }));
      run(z, 20);
      expect(z.prismCell[0]).toBe(16 * z.map.w + 6);
      void def;
   });
});

describe("the Bridge Keeper and the run", () => {
   it("the plate takes the middle beam with what it crossed; the bot answers all six colours", () => {
      const w = createRun(5);
      w.nodeColor = [BLUE, YELLOW, RED, BLUE, RED];
      run(w, 20);
      expect(plateColor(w)).toBe(7);
      expect(KEEPER_WANTS).toEqual([1, 2, 4, 3, 6, 7]);
      const b = createRun(5);
      for (let f = 0; f < 60 * 290 && !b.ended; f++) step(b, 1000 / 60, botInput(b));
      expect(b.ended).toBe("win");
      expect(b.keeper!.state.hp).toBe(0);
      expect(KEEPER.maxHp).toBe(6);
   }, 60_000);
   it("time ends a run unranked; a win submits finish minus the orb and flow bonus", () => {
      const w = createRun(1);
      run(w, LEVELS[1].durationMs + 100, I(), 30);
      expect(w.ended).toBe("timeup");
      expect(runTimeMs(10_000, 3, 500)).toBe(10_000 - 1200 - 500);
      expect(finalScore({ score: 0, endReason: "timeup", stats: {}, elapsedMs: 5000 }).durationMs).toBe(5000);
      expect(finalScore({ score: 1, endReason: "win", stats: { [STAT.finishMs]: 9000, [STAT.orbs]: 1, [STAT.comboMs]: 0 }, elapsedMs: 9100 }).durationMs).toBe(8600);
   });
   it("the lower bound never exceeds a bot's finish; every level parses", () => {
      for (const id of [1, 2, 3, 4, 5] as const) {
         expect(() => parseLevel(LEVELS[id])).not.toThrow();
         const w = createRun(id);
         for (let f = 0; f < 60 * 290 && !w.ended; f++) step(w, 1000 / 60, botInput(w));
         expect(w.ended).toBe("win");
         expect(minFinishMs(id)).toBeLessThanOrEqual(w.teams[0].finishMs);
      }
   }, 120_000);
});
