import { describe, expect, it } from "vitest";
import { createInputController } from "../../core/inputController";
import { LEVEL_IDS } from "../../types";
import { LEVELS } from "./levels";
import {
   BARRIER_OFFSET, DEAD_ZONE, HIT_QUALITY, HOP_SECONDS, ON_TIME_BONUS, PAD_SECONDS, STRIKE_SPEED, VEHICLE,
   createRun, inside, stepRun, target, type Controls, type Run,
} from "./rules";

const idle: Controls = { moveX: 0, moveY: 0, jumpPressed: false };
function tick(r: Run, seconds: number, input: Controls = idle, hz = 60) {
   const n = Math.round(seconds * hz);
   for (let i = 0; i < n; i++) stepRun(r, input, 1 / hz);
}
/** Park the scooter on a point (a test shortcut: positions only, never quality or score). */
const park = (r: Run, p: { x: number; z: number }) => { r.player.x = p.x; r.player.z = p.z; r.player.speed = 0; };

describe("burger-delivery-scooter rules", () => {
   it("is deterministic per seed, and the seed changes the order, barriers and cars", () => {
      expect(createRun(42, 3)).toEqual(createRun(42, 3));
      const a = createRun(1, 5), b = createRun(2, 5);
      expect(JSON.stringify([a.doors, a.barriers, a.cars])).not.toBe(JSON.stringify([b.doors, b.barriers, b.cars]));
      const r1 = createRun(9, 2), r2 = createRun(9, 2);
      const drive: Controls = { moveX: 0.4, moveY: -1, jumpPressed: false };
      tick(r1, 3, drive); tick(r2, 3, drive);
      expect(r1).toEqual(r2);
   });

   it("the 1/120 s integrator plays the same at 30, 60 and 144 Hz (to the last substep)", () => {
      const runs = [30, 60, 144].map((hz) => { const r = createRun(5, 1); tick(r, 2, { moveX: 0.6, moveY: -1, jumpPressed: false }, hz); return r; });
      for (const r of runs.slice(1)) {
         expect(r.player.x).toBeCloseTo(runs[0].player.x, 1);
         expect(r.player.z).toBeCloseTo(runs[0].player.z, 1);
         expect(r.player.speed).toBeCloseTo(runs[0].player.speed, 1);
      }
   });

   it("the integrator: top speed 11, reverse 2.5, no turn at a standstill, drag, dead zone 0.2", () => {
      const r = createRun(1, 1);
      tick(r, 3, { moveX: 0, moveY: -1, jumpPressed: false });
      expect(r.player.speed).toBe(VEHICLE.topSpeed);
      const s = createRun(1, 1), yaw = s.player.yaw;
      tick(s, 1, { moveX: 1, moveY: 0, jumpPressed: false });
      expect(s.player.yaw).toBe(yaw);
      tick(s, 1, { moveX: 0, moveY: DEAD_ZONE * 0.9, jumpPressed: false });
      expect(s.player.speed).toBe(0);
      s.player.yaw = -Math.PI / 2; // facing west, so reversing runs east along the open street
      tick(s, 3, { moveX: 0, moveY: 1, jumpPressed: false });
      expect(s.player.speed).toBe(-VEHICLE.reverse);
      const d = createRun(1, 1); d.player.speed = 8; tick(d, 1);
      expect(d.player.speed).toBeCloseTo(8 * Math.exp(-VEHICLE.drag), 2);
      // turnScale: a slow scooter turns at 0.35 of the rate, a fast one at the full 2.6 rad/s
      const slow = createRun(1, 1), fast = createRun(1, 1);
      slow.player.speed = 0.5; fast.player.speed = 6;
      const y0 = slow.player.yaw;
      stepRun(slow, { moveX: 1, moveY: 0, jumpPressed: false }, 0.05); stepRun(fast, { moveX: 1, moveY: 0, jumpPressed: false }, 0.05);
      expect((slow.player.yaw - y0) / (fast.player.yaw - y0)).toBeCloseTo(0.35, 1);
   });

   it("the pad needs 0.45 s under 0.5 m/s, the same for every input source", () => {
      const r = createRun(1, 1);
      tick(r, PAD_SECONDS - 0.02);
      expect(r.carrying).toBe(false);
      tick(r, 0.05);
      expect(r.carrying).toBe(true);
      const fast = createRun(1, 1); fast.player.speed = 0.6; fast.player.yaw = 0;
      for (let i = 0; i < 40; i++) { stepRun(fast, idle, 1 / 60); fast.player.x = fast.shop.x; fast.player.z = fast.shop.z; fast.player.speed = 0.6; }
      expect(fast.carrying).toBe(false);
   });

   it("a delivery pays floor(quality) + 40 within the 25 s order clock, a late one only the quality", () => {
      const r = createRun(3, 2);
      tick(r, 0.5);
      park(r, target(r)); tick(r, 0.5);
      expect(r.score).toBe(100 + ON_TIME_BONUS);
      park(r, r.shop); tick(r, 0.5);
      expect(r.carrying).toBe(true);
      tick(r, 26);
      park(r, target(r)); tick(r, 0.5);
      expect(r.score).toBe(140 + 100);
   });

   it("barriers: -12 at any speed, ignored in the hop's middle 0.20 s; a hop costs no quality", () => {
      const r = createRun(1, 1);
      tick(r, 0.5); expect(r.carrying).toBe(true);
      const b = r.barriers[0];
      park(r, { x: b.x, z: b.z });
      r.hop = 0.25; stepRun(r, idle, 1 / 120);
      expect(r.quality).toBe(100);
      park(r, { x: b.x, z: b.z }); r.hop = 0.05; r.contact = false; stepRun(r, idle, 1 / 120);
      expect(r.quality).toBe(100 - HIT_QUALITY);
      // a hop in open street changes nothing but the height
      const h = createRun(1, 1); tick(h, 0.5);
      stepRun(h, { ...idle, jumpPressed: true }, 1 / 60);
      tick(h, HOP_SECONDS);
      expect(h.quality).toBe(100);
      expect(h.player.y).toBe(0);
   });

   it("cars cost quality only above the 3 m/s strike speed", () => {
      for (const id of [2, 5] as const) {
         const r = createRun(4, id); tick(r, 0.5);
         const c = r.cars[0];
         // from behind, along the curb lane (the block is beside it)
         r.player.x = c.x; r.player.z = c.z - c.hz - VEHICLE.radius - 0.05; r.player.yaw = 0;
         r.player.speed = STRIKE_SPEED - 0.5; stepRun(r, idle, 1 / 30);
         expect(r.quality).toBe(100);
         r.player.z = c.z - c.hz - VEHICLE.radius - 0.05; r.contact = false;
         r.player.speed = STRIKE_SPEED + 3; stepRun(r, idle, 1 / 30);
         expect(r.quality).toBe(100 - HIT_QUALITY);
         expect(r.player.speed).toBeLessThan(0);
      }
   });

   it("buildings are solid: the scooter never ends a step inside a block", () => {
      const r = createRun(2, 3);
      for (let i = 0; i < 1200; i++) {
         stepRun(r, { moveX: Math.sin(i / 37), moveY: -1, jumpPressed: false }, 1 / 60);
         for (const b of r.buildings) expect(inside(r.player, b)).toBe(false);
      }
   });

   it("a miss spends one life, restores 100, keeps the slot, and the slot pays once", () => {
      const r = createRun(2, 4); tick(r, 0.5);
      const slot = target(r);
      r.quality = 0; stepRun(r, idle, 1 / 60);
      expect(r.misses).toBe(1); expect(r.quality).toBe(100); expect(target(r)).toBe(slot); expect(r.score).toBe(0);
      park(r, slot); tick(r, 0.5);
      expect(r.delivered).toBe(1);
      const paid = r.score;
      tick(r, 1); expect(r.score).toBe(paid);
   });

   it("quality stays in 0..100; three misses lose", () => {
      const r = createRun(1, 5); tick(r, 0.5);
      for (let i = 0; i < 3; i++) { r.quality = 0; stepRun(r, idle, 1 / 60); expect(r.quality).toBeGreaterThanOrEqual(0); expect(r.quality).toBeLessThanOrEqual(100); }
      expect(r.end).toBe("lose"); expect(r.misses).toBe(3);
   });

   it("the average uses successes only; a full quota one point under the line loses at once, at the line wins", () => {
      for (const id of LEVEL_IDS) {
         const n = LEVELS[id].orders, line = LEVELS[id].qualityMin;
         for (const [q, end] of [[line - 1, "lose"], [line, "win"]] as const) {
            const r = createRun(1, id);
            r.delivered = n - 1; r.qualitySum = q * (n - 1); r.carrying = true; r.quality = q; r.misses = 2;
            park(r, target(r)); tick(r, 0.5);
            expect(r.end).toBe(end);
         }
      }
   });

   it("each level's clock, wet drain and win bonus come from that level", () => {
      for (const id of LEVEL_IDS) {
         const c = LEVELS[id];
         const idleRun = createRun(1, id);
         tick(idleRun, c.durationMs / 1000 - 0.5);
         expect(idleRun.end).toBeNull();
         tick(idleRun, 1);
         expect(idleRun.end).toBe("timeup");
         const wet = createRun(1, id); tick(wet, 0.5);
         if (c.wet) {
            park(wet, wet.wet[0]); tick(wet, 1);
            expect(100 - wet.quality).toBeCloseTo(c.wetDrain, 1);
         } else expect(wet.wet).toHaveLength(0);
         const win = createRun(1, id);
         win.delivered = c.orders - 1; win.qualitySum = 100 * (c.orders - 1); win.carrying = true; win.accepted = 0;
         park(win, target(win)); tick(win, 0.5);
         expect(win.end).toBe("win");
         expect(win.score).toBe(100 + 40 + 4 * Math.floor(c.durationMs / 1000 - win.elapsed));
      }
   });

   it("the clock ends a short quota with timeup", () => {
      const r = createRun(1, 1);
      tick(r, LEVELS[1].durationMs / 1000 + 1);
      expect(r.end).toBe("timeup");
      expect(r.score).toBe(0);
   });

   it("barriers stand 1.9 m off the centre line: a scooter on the line never touches one", () => {
      for (const id of LEVEL_IDS) for (let seed = 0; seed < 50; seed++) {
         const r = createRun(seed, id);
         for (const b of r.barriers) expect(b.hz + VEHICLE.radius).toBeLessThan(BARRIER_OFFSET);
      }
   });

   it("keyboard and touch play frame for frame the same (stop window, hop window, dead zone)", () => {
      const key = createInputController(), touch = createInputController();
      const a = createRun(3, 1), b = createRun(3, 1);
      for (let frame = 0; frame < 600; frame++) {
         if (frame === 30) { key.keyDown("KeyW"); touch.setJoystick(0, -1); }
         if (frame === 80) { key.keyDown("Space"); touch.setButton("jump", true); }
         if (frame === 81) { key.keyUp("Space"); touch.setButton("jump", false); }
         if (frame === 100) { key.keyDown("KeyD"); touch.setJoystick(1, -1); }
         if (frame === 140) { key.keyUp("KeyD"); touch.setJoystick(0, -1); }
         if (frame === 200) { key.keyUp("KeyW"); touch.setJoystick(0, 0); }
         key.latch(); touch.latch(); stepRun(a, key.state.current, 1 / 60); stepRun(b, touch.state.current, 1 / 60);
         expect(a).toEqual(b);
      }
   });
});

// Steering direction on screen. A heading (sin yaw, cos yaw) has its driver's LEFT at (cos yaw, -sin yaw)
// (three.js is right-handed, y up: facing +z, +x is on the left). A left turn rotates the heading
// towards that side, so cross(before, after).y > 0, and the vehicle drifts to its own left.
type Drive = "KeyA" | "ArrowLeft" | "KeyD" | "ArrowRight" | "stickLeft" | "stickRight";
const DRIVES: readonly Drive[] = ["KeyA", "ArrowLeft", "stickLeft", "KeyD", "ArrowRight", "stickRight"];
const isLeft = (d: Drive) => d === "KeyA" || d === "ArrowLeft" || d === "stickLeft";
function pressDrive(d: Drive) {
   const pad = createInputController();
   if (d === "stickLeft") pad.setJoystick(-1, -1);
   else if (d === "stickRight") pad.setJoystick(1, -1);
   else {
      pad.keyDown("KeyW");
      pad.keyDown(d);
   }
   pad.latch();
   return pad.state.current;
}
function turnOf(yaw0: number, x0: number, z0: number, yaw1: number, x1: number, z1: number) {
   const turn = Math.sin(yaw0) * Math.cos(yaw1) - Math.cos(yaw0) * Math.sin(yaw1);
   const side = (x1 - x0) * Math.cos(yaw0) - (z1 - z0) * Math.sin(yaw0);
   return { turn: -turn, side };
}

describe("burger-delivery-scooter steering", () => {
   it.each(DRIVES)("%s turns the scooter to the rider's matching side (keys and joystick)", (d) => {
      const r = createRun(3, 1);
      const input = pressDrive(d);
      const p = r.player;
      const yaw0 = p.yaw, x0 = p.x, z0 = p.z;
      tick(r, 0.7, { moveX: input.moveX, moveY: input.moveY, jumpPressed: false });
      const { turn, side } = turnOf(yaw0, x0, z0, p.yaw, p.x, p.z);
      const sign = isLeft(d) ? 1 : -1;
      expect(turn * sign).toBeGreaterThan(0.05);
      expect(side * sign).toBeGreaterThan(0);
   });
});
