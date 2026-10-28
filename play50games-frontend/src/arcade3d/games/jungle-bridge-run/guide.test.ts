// guide.ts: every obstacle gets the right cue (lane to take, jump or slide), in order, read-only.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { WARN_AHEAD, cueCode, cueHint, hitText, nextCue, nextObstacle, type Cue } from "./guide";
import { LANE_X, createRun, obstacleEnd } from "./rules";

const fresh = (): Cue => ({ obstacle: null, lane: -1, action: null, x: 0, z: 0 });

describe("jungle guide", () => {
   it("cues every obstacle of the track in order with the right action, never changing the run", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(11, LEVELS[id], id);
         const before = JSON.stringify(run);
         let last = -Infinity;
         let seen = 0;
         for (let z = 0; z < run.sections[run.sections.length - 1].gateZ; z += 0.5) {
            run.z = z;
            run.currentSection = Math.max(0, run.sections.findIndex((s) => z < s.gateZ));
            const c = nextCue(run, fresh());
            const next = nextObstacle(run);
            if (next) expect(obstacleEnd(next.obstacle)).toBeGreaterThanOrEqual(z - 0.3);
            if (!c.obstacle) continue;
            expect(c.obstacle.z - z).toBeLessThanOrEqual(WARN_AHEAD);
            if (c.obstacle.z !== last) {
               expect(c.obstacle.z).toBeGreaterThan(last);
               last = c.obstacle.z;
               seen += 1;
            }
            const kind = c.obstacle.kind;
            if (kind === "gap" || kind === "log") expect(c.action).toBe("jump");
            else if (kind === "vine") expect(c.action).toBe("slide");
            else {
               expect(c.action).toBe("go");
               expect(c.x).toBe(LANE_X[c.lane]);
            }
         }
         expect(seen).toBe(run.sections.reduce((n, s) => n + s.obstacles.length, 0));
         run.z = 0;
         run.currentSection = 0;
         expect(JSON.stringify(run)).toBe(JSON.stringify(JSON.parse(before)));
      }
   });

   it("says ready once the runner is on the safe lane, and names the touch gesture", () => {
      const run = createRun(3, LEVELS[1], 1);
      const pillarSec = run.sections.find((s) => s.obstacles.some((o) => o.kind === "pillar"))!;
      const pillar = pillarSec.obstacles.find((o) => o.kind === "pillar")!;
      run.currentSection = pillarSec.index;
      run.z = pillar.z - 6;
      const c = nextCue(run, fresh());
      run.lane = c.lane === 0 ? 1 : 0;
      expect(cueHint(cueCode(run, c), true).text).toMatch(/swipe/);
      run.lane = c.lane;
      expect(cueHint(cueCode(run, c), false).tone).toBe("ready");
   });

   it("pops what hit the runner", () => {
      expect(hitText("gap", true)).toBe("Fell! -1 life");
      expect(hitText("lava", false)).toBe("Burned!");
   });
});
