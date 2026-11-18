import { describe, expect, it } from "vitest";
import {
   bossProblems,
   bossTimeScale,
   createBoss,
   createBossEvents,
   currentAttack,
   hitBoss,
   hitsToDefeat,
   phaseForHp,
   phaseMarks,
   stepBoss,
   stepProgress,
   type BossConfig,
} from "./boss";

const BOSS: BossConfig = {
   id: "test-guardian",
   name: "Test Guardian",
   maxHp: 6,
   introMs: 1000,
   transitionMs: 800,
   hitFlashMs: 150,
   oneHitPerWindow: true,
   defeatMs: 2000,
   slowMo: { scale: 0.3, durationMs: 1500 },
   phases: [
      { id: "p1", name: "Stomp", endsAt: 0.5, attacks: [{ id: "stomp", telegraphMs: 600, attackMs: 400, vulnerableMs: 1000 }] },
      {
         id: "p2",
         name: "Fury",
         endsAt: 0,
         attacks: [
            { id: "sweep", telegraphMs: 400, attackMs: 300, vulnerableMs: 700 },
            { id: "slam", telegraphMs: 500, attackMs: 300, vulnerableMs: 600 },
         ],
      },
   ],
};

function until(s: ReturnType<typeof createBoss>, step: string, max = 20000) {
   const ev = createBossEvents();
   for (let t = 0; t < max && s.step !== step; t += 10) stepBoss(s, BOSS, 10, ev);
   expect(s.step).toBe(step);
}

describe("boss config", () => {
   it("validates", () => {
      expect(bossProblems(BOSS)).toEqual([]);
      expect(bossProblems({ ...BOSS, phases: [] }).length).toBeGreaterThan(0);
      expect(bossProblems({ ...BOSS, phases: [{ ...BOSS.phases[0], endsAt: 0.2 }] })).toContain("the last phase must end at 0");
      expect(bossProblems({ ...BOSS, phases: [BOSS.phases[1], BOSS.phases[0]] }).length).toBeGreaterThan(0);
      expect(bossProblems({ ...BOSS, phases: [{ ...BOSS.phases[1], attacks: [{ id: "x", telegraphMs: 100, attackMs: 1, vulnerableMs: 1 }] }] }).length).toBe(1);
      expect(bossProblems({ ...BOSS, slowMo: { scale: 0, durationMs: 5000 } })).toHaveLength(2);
   });

   it("phase by health and the bar's marks", () => {
      expect(phaseForHp(BOSS, 6)).toBe(0);
      expect(phaseForHp(BOSS, 4)).toBe(0);
      expect(phaseForHp(BOSS, 3)).toBe(1);
      expect(phaseForHp(BOSS, 0)).toBe(1);
      expect(phaseMarks(BOSS)).toEqual([0.5]);
      expect(hitsToDefeat(BOSS, 1)).toBe(6);
   });
});

describe("boss machine", () => {
   it("intro -> telegraph -> attack -> vulnerable -> next telegraph, events once each", () => {
      const s = createBoss(BOSS);
      const ev = createBossEvents();
      stepBoss(s, BOSS, 999, ev);
      expect(s.step).toBe("intro");
      stepBoss(s, BOSS, 1, ev);
      expect(s.step).toBe("telegraph");
      expect(ev.telegraph).toBe(true);
      stepBoss(s, BOSS, 300, ev);
      expect(ev.telegraph).toBe(false);
      expect(stepProgress(s, BOSS)).toBeCloseTo(0.5);
      stepBoss(s, BOSS, 300, ev);
      expect(s.step).toBe("attack");
      expect(ev.attack).toBe(true);
      stepBoss(s, BOSS, 400, ev);
      expect(s.step).toBe("vulnerable");
      stepBoss(s, BOSS, 1000, ev);
      expect(s.step).toBe("telegraph");
      expect(ev.recovered).toBe(true);
      expect(s.attack).toBe(1);
   });

   it("one big dt walks through several steps exactly", () => {
      const a = createBoss(BOSS);
      const b = createBoss(BOSS);
      const ev = createBossEvents();
      stepBoss(a, BOSS, 3333, ev);
      for (let i = 0; i < 3333; i++) stepBoss(b, BOSS, 1, ev);
      expect(a).toEqual(b);
   });

   it("hits count only while vulnerable, flash, phase change, defeat", () => {
      const s = createBoss(BOSS);
      const ev = createBossEvents();
      expect(hitBoss(s, BOSS, 1, ev)).toBe("ignored");
      until(s, "vulnerable");
      expect(hitBoss(s, BOSS, 1, ev)).toBe("hit");
      expect(s.flashMs).toBe(150);
      expect(s.step).toBe("telegraph"); // one hit per window
      until(s, "vulnerable");
      hitBoss(s, BOSS, 1, ev);
      until(s, "vulnerable");
      const r = hitBoss(s, BOSS, 1, ev);
      expect(r).toBe("phase");
      expect(ev.phaseChanged).toBe(true);
      expect(s.phase).toBe(1);
      expect(s.step).toBe("transition");
      until(s, "telegraph");
      expect(currentAttack(s, BOSS)!.id).toBe("sweep");
      for (let k = 0; k < 3; k++) {
         until(s, "vulnerable");
         hitBoss(s, BOSS, 1, createBossEvents());
      }
      expect(s.hp).toBe(0);
      expect(s.step).toBe("defeat");
      expect(s.hits).toBe(6);
      until(s, "done");
      expect(hitBoss(s, BOSS, 1, ev)).toBe("ignored");
   });

   it("phase 2 cycles its attacks", () => {
      const s = createBoss(BOSS);
      s.phase = 1;
      const ids: string[] = [];
      const ev = createBossEvents();
      for (let t = 0; t < 12000; t += 10) {
         stepBoss(s, BOSS, 10, ev);
         if (ev.telegraph) ids.push(currentAttack(s, BOSS)!.id);
      }
      expect(ids.slice(0, 4)).toEqual(["sweep", "slam", "sweep", "slam"]);
   });

   it("the slow-mo finish is visual only: the defeat runs on rules time", () => {
      const s = createBoss({ ...BOSS, maxHp: 1 });
      const ev = createBossEvents();
      expect(bossTimeScale(s, BOSS)).toBe(1);
      until(s, "vulnerable");
      expect(hitBoss(s, { ...BOSS, maxHp: 1 }, 5, ev)).toBe("defeated");
      expect(bossTimeScale(s, BOSS)).toBe(0.3);
      stepBoss(s, BOSS, 1300, ev);
      const easing = bossTimeScale(s, BOSS);
      expect(easing).toBeGreaterThan(0.3);
      expect(easing).toBeLessThan(1);
      stepBoss(s, BOSS, 300, ev);
      expect(bossTimeScale(s, BOSS)).toBe(1);
      stepBoss(s, BOSS, 400, ev);
      expect(s.step).toBe("done");
      expect(ev.done).toBe(true);
   });
});
