// feedback.ts + rules.missReason: the scoop meter, the pops and the aim arc read the rules and change nothing.
import { describe, expect, it } from "vitest";
import { aimArc, handBallRadius, missPop, scoopFill, scoopLabel, scoopOutcome, scoopPop, scoopZone } from "./feedback";
import { LEVELS } from "./levels";
import { GRAVITY, SCOOP, THROW, createRun, flightTime, highlightOf, missReason, type Run } from "./rules";

function duel(blocked: boolean): Run {
   const run = createRun(4, false);
   for (const f of run.forts) f.hp = 0;
   const fort = run.forts[0];
   if (blocked) fort.hp = 3;
   const [player, rival, other, sneaker] = run.kids;
   player.x = fort.x; player.z = fort.z + 2.4; player.ammo = 1;
   rival.x = fort.x; rival.z = fort.z - 2.4; rival.present = true; rival.alive = true;
   other.alive = false;
   sneaker.present = false;
   return run;
}

describe("scoop meter", () => {
   it("grey under 0.50 s, green from 0.50 s, red at 1.50 s; the fill is t / 1.50", () => {
      expect(SCOOP.min).toBe(0.5);
      expect(SCOOP.max).toBe(1.5);
      expect(scoopZone(0.3)).toBe("short");
      expect(scoopZone(0.4999)).toBe("short");
      expect(scoopZone(0.5)).toBe("ready");
      expect(scoopZone(1.0)).toBe("ready");
      expect(scoopZone(1.4998)).toBe("ready");
      expect(scoopZone(1.5)).toBe("roller");
      expect(scoopFill(0.75)).toBeCloseTo(0.5, 9);
      expect(scoopFill(3)).toBe(1);
      expect(scoopLabel("short", 0)).toBe("HOLD…");
      expect(scoopLabel("ready", 2)).toBe("LET GO!");
      expect(scoopLabel("ready", 3)).toBe("HANDS FULL");
      expect(scoopLabel("roller", 0)).toBe("ROLLER!");
   });

   it("names each release: packed, roller, too short, hands full", () => {
      expect(scoopOutcome(true, 0.8, 1, false, 1)).toBe("packed");
      expect(scoopOutcome(true, 1.49, 1, false, 2)).toBe("roller");
      expect(scoopOutcome(true, 0.3, 1, false, 0)).toBe("short");
      expect(scoopOutcome(true, 0.9, 3, false, 0)).toBe("full");
      expect(scoopOutcome(true, 0.3, 1, true, 0)).toBeNull();
      expect(scoopOutcome(false, 0, 1, false, 0)).toBeNull();
      expect(scoopPop("packed", 2)).toEqual({ text: "+1 snowball", kind: "good" });
      expect(scoopPop("roller", 0)?.text).toBe("Roller!");
      expect(scoopPop("short", 0)).toEqual({ text: "Too short", kind: "fail" });
      expect(scoopPop("full", 3)?.text).toBe("Hands full (3)");
      expect(scoopPop(null, 0)).toBeNull();
   });

   it("the hand ball grows while held and stays while a ball is packed", () => {
      expect(handBallRadius(true, 0, 0)).toBeCloseTo(0.04, 9);
      expect(handBallRadius(true, 1.5, 0)).toBeCloseTo(0.14, 9);
      expect(handBallRadius(false, 0, 2)).toBeGreaterThan(0);
      expect(handBallRadius(false, 0, 0)).toBe(0);
   });
});

describe("throw feedback", () => {
   it("a clear rival in the cone throws (no pop); away from it there is no target; a fort in the way is blocked", () => {
      const open = duel(false);
      const at = Math.atan2(open.kids[1].x - open.kids[0].x, open.kids[1].z - open.kids[0].z);
      expect(highlightOf(open, at)).toBe(1);
      expect(missReason(open, at)).toBeNull();
      expect(missReason(open, at + Math.PI)).toBe("none");
      const blocked = duel(true);
      expect(missReason(blocked, at)).toBe("blocked");
      blocked.kids[0].ammo = 0;
      expect(missReason(blocked, at)).toBe("ammo");
      blocked.throwCd = 0.2;
      expect(missReason(blocked, at)).toBeNull();
      expect(missPop("none", false)).toBe("No target in range");
      expect(missPop("blocked", false)).toBe("Blocked by cover");
      expect(missPop("ammo", false)).toBe("No snowball: hold E");
      expect(missPop("ammo", true)).toBe("No snowball: hold Scoop");
      expect(missPop(null, false)).toBeNull();
   });

   it("missReason changes nothing in the run", () => {
      const run = duel(true);
      const before = JSON.stringify(run);
      missReason(run, 0);
      missReason(run, Math.PI);
      expect(JSON.stringify(run)).toBe(before);
   });

   it("the aim arc is the rules' lob: from the hand at launch height to the target over the flight time", () => {
      const out = new Float32Array(10 * 3);
      const ft = aimArc(0, 0, 0, 0.62, -10, LEVELS[1], 10, out);
      expect(ft).toBeCloseTo(flightTime(10, LEVELS[1]), 9);
      expect(out[0]).toBeCloseTo(0, 6);
      expect(out[1]).toBeCloseTo(THROW.launchY, 6);
      expect(out[2]).toBeCloseTo(-THROW.launchForward, 6);
      expect(out[27]).toBeCloseTo(0, 6);
      expect(out[28]).toBeCloseTo(0.62, 5);
      expect(out[29]).toBeCloseTo(-10, 5);
      const apex = THROW.launchY + ((0.62 - THROW.launchY + 0.5 * GRAVITY * ft * ft) / ft) ** 2 / (2 * GRAVITY);
      let top = 0;
      for (let i = 0; i < 10; i++) top = Math.max(top, out[i * 3 + 1]);
      expect(top).toBeLessThanOrEqual(apex + 1e-6);
      expect(top).toBeGreaterThan(THROW.launchY);
   });
});
