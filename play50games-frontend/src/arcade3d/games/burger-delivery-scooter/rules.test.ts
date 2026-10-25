import { describe, expect, it } from "vitest";
import { createRun, stepRun, target, type Run, type Controls } from "./rules";
import { LEVELS } from "./levels";
import { LEVEL_IDS } from "../../types";
import { withinServerLimits } from "../../core/limits";
import { burgerDeliveryScooterMeta } from "./meta";
import { createArcadeStore } from "../../core/useArcadeStore";
import { advanceRunClock, playedFrameDt } from "../../core/frameLoop";
const idle: Controls = { moveX: 0, moveY: 0, jumpPressed: false };
function tick(r: Run, seconds: number, input = idle) {
   for (let i = 0; i < Math.round(seconds * 60); i++) stepRun(r, input, 1 / 60);
}
// Human-paced route follower: actual steering/acceleration/braking; no teleport or quality edits.
function drive(r: Run, retry = false, hz = 60) {
   const store = createArcadeStore();
   store.getState().configure({ durationMs: r.config.durationMs, lives: 3 });
   store.getState().markReady(); store.getState().start();
   for (let i = 0; i < 60; i++) advanceRunClock(store, 0.05);
   let waypoint = { x: r.player.x, z: r.player.z };
   let destination = "";
   for (let frame = 0; frame < r.config.durationMs / 1000 * hz + 10 && !r.end; frame++) {
      const detour = retry && r.carrying && r.delivered === 0 && r.misses === 0;
      const goal = detour ? r.wet[0] : target(r);
      const key = `${r.carrying}:${r.delivered}:${detour}`;
      if (key !== destination) {
         destination = key;
         waypoint = Math.abs(r.player.x - goal.x) > 1 ? { x: goal.x, z: r.player.z } : goal;
      }
      if (Math.hypot(waypoint.x - r.player.x, waypoint.z - r.player.z) < 0.45 && Math.abs(r.player.speed) < 0.1) waypoint = goal;
      const dx = waypoint.x - r.player.x, dz = waypoint.z - r.player.z;
      const distance = Math.hypot(dx, dz);
      const angle = Math.atan2(dx, dz);
      const error = Math.atan2(Math.sin(angle - r.player.yaw), Math.cos(angle - r.player.yaw));
      const desired = distance < 0.4 || Math.abs(error) > 0.12 ? 0 : Math.min(9, Math.sqrt(20 * Math.max(0, distance - 0.4)));
      const throttle = r.player.speed > desired + 0.05 ? 1 : r.player.speed < desired - 0.05 ? -1 : 0;
      advanceRunClock(store, 1 / hz);
      const dt = playedFrameDt(store.getState());
      if (dt === 0) { r.end = "timeup"; break; }
      const misses = r.misses;
      stepRun(r, { moveX: Math.max(-1, Math.min(1, error * 2)), moveY: throttle, jumpPressed: false }, dt);
      store.getState().setScore(r.score);
      for (let i = misses; i < r.misses; i++) store.getState().loseLife();
      if (r.end) store.getState().end(r.end);
      expect(r.elapsed * 1000).toBeLessThanOrEqual(store.getState().elapsedMs + 0.001);
      if (r.end === "win") expect(withinServerLimits(store.getState().score, store.getState().elapsedMs, burgerDeliveryScooterMeta.levels![r.id - 1].scoring)).toBe(true);
   }
   return r;
}
describe("delivery loop", () => {
   it("is deterministic and a stationary player cannot score", () => {
      expect(createRun(42, 1)).toEqual(createRun(42, 1));
      const r = createRun(42, 1); tick(r, 121);
      expect(r.score).toBe(0); expect(r.end).toBe("timeup");
   });
   for (const id of LEVEL_IDS) {
      it(`human-paced route clears L${id} inside server bounds`, () => {
         const r = drive(createRun(41, id));
         expect(r.end, JSON.stringify({ p: r.player, n: r.delivered, q: r.quality, carrying: r.carrying })).toBe("win"); expect(r.delivered).toBe(LEVELS[id].orders);
         expect(withinServerLimits(r.score, r.elapsed * 1000, burgerDeliveryScooterMeta.levels![id - 1].scoring)).toBe(true);
      });
      it(`spam cannot farm L${id}`, () => {
         const r = createRun(7, id); tick(r, LEVELS[id].durationMs / 1000 + 1, { moveX: 1, moveY: -1, jumpPressed: true });
         expect(r.score).toBe(0); expect(r.end).toBeTruthy();
      });
   }
   it("human bot spoils one order in a wet patch, retries the same slot and clears", () => {
      const r = drive(createRun(41, 4), true);
      expect(r.misses).toBe(1); expect(r.end, JSON.stringify({ p: r.player, delivered: r.delivered, goal: target(r) })).toBe("win");
      expect(r.delivered).toBe(6);
      expect(r.score).toBeLessThanOrEqual(6 * 140 + 4 * Math.floor(180 - r.elapsed));
      expect(withinServerLimits(r.score, r.elapsed * 1000, burgerDeliveryScooterMeta.levels![3].scoring)).toBe(true);
   });
   it("human-paced bot clears every level at 30 and 144 Hz through the real store", () => {
      for (const hz of [30, 144]) for (const id of LEVEL_IDS) {
         const r = drive(createRun(37, id), false, hz);
         expect(r.end).toBe("win");
      }
   });
   it("requires 0.45 stopped seconds, without counting a fast pass", () => {
      const r = createRun(1, 1); tick(r, 0.4333); expect(r.carrying).toBe(false);
      tick(r, 1 / 60); expect(r.carrying).toBe(true);
   });
   it("retry keeps the slot and does not pay; average uses successes only", () => {
      const r = createRun(2, 4); tick(r, 0.5);
      r.quality = 0; tick(r, 1 / 60);
      expect(r.misses).toBe(1); expect(r.delivered).toBe(0); expect(r.score).toBe(0); expect(r.quality).toBe(100);
      const goal = target(r); r.player.x = goal.x; r.player.z = goal.z; tick(r, 0.5);
      expect(r.delivered).toBe(1); expect(r.qualitySum).toBe(100); expect(r.score).toBe(140);
      tick(r, 0.5); expect(r.score).toBe(140);
   });
   it("a full quota one point below the quality line loses", () => {
      const r = createRun(1, 1); r.delivered = 2; r.qualitySum = 158; r.carrying = true; r.quality = 79;
      const g = target(r); r.player.x = g.x; r.player.z = g.z; tick(r, 0.5);
      expect(r.end).toBe("lose");
   });
   it("hop middle clears barriers, held presses cannot chain hops", () => {
      const r = createRun(1, 1); tick(r, 0.5); const b = r.barriers[0];
      r.player.x = b.x; r.player.z = b.z; r.hop = 0.15;
      tick(r, 1 / 60); expect(r.quality).toBe(100);
      r.hop = 0; tick(r, 1 / 60); expect(r.quality).toBe(88);
      tick(r, 2, { ...idle, jumpPressed: true }); expect(r.hop).toBe(0);
   });
   it("third miss loses and quality stays bounded", () => {
      const r = createRun(1, 5); tick(r, 0.5);
      for (let i = 0; i < 3; i++) { r.quality = 0; tick(r, 1 / 60); }
      expect(r.end).toBe("lose"); expect(r.misses).toBe(3); expect(r.quality).toBe(100);
   });
});
