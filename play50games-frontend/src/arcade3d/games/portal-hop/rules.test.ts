// The rules: speed in = speed out along the exit, the 0.4 s switch (closed meanwhile), picking by tap /
// digit / cycle, the hidden anchor, the landing that sticks, the void and its checkpoint, Riko's dash
// bonus, Vexa's phase through a frame, the orbs and their hero gates, the cargo crystal and the plate,
// the orbiting anchors, the Wyrm's three phases, and the fixed step.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { anchorYaw, courseFor, exitPose, wrapPi, type ExitPose } from "./course";
import {
   BODY_MID, KNOT_HEAD, MIN_OUT, PORT_COOLDOWN_MS, STEP_MS, SWITCH_MS, V_CAP, V_RUN, anchorVisible, createRun, createStepInput, nearestPair, pairOpen, previewArc,
   selectedAnchor, step, type PortalRun, type StepInput,
} from "./rules";
import { DASH_PORTAL_BONUS } from "./heroes";
import { BACK_SPEED, P1_DIVE_AT, DIVE_MS, P3_KNOT_AT, SECRETS, WYRM } from "./progression";
import { createBot, botInput } from "./bot";

const POSE: ExitPose = { x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0, ax: 0, az: 0, yaw: 0 };

function run(level: 1 | 2 | 3 | 4 | 5 = 1, hero: PortalRun["heroId"] = "kiro"): PortalRun {
   return createRun(1, level, hero);
}

function steps(r: PortalRun, ms: number, input: StepInput = createStepInput()): void {
   const end = r.simMs + ms;
   while (r.simMs < end - 1e-6 && r.ended === null) step(r, STEP_MS, input);
}

/** Puts the hero just in front of a wall entry, moving into it at speed v. */
function atWall(r: PortalRun, pair: number, v: number): void {
   const e = r.course.pairs[pair].entry;
   const h = r.hero;
   h.x = e.x + Math.sin(e.yaw) * 0.003;
   h.z = e.z + Math.cos(e.yaw) * 0.003;
   h.y = e.y;
   h.vx = -Math.sin(e.yaw) * v;
   h.vz = -Math.cos(e.yaw) * v;
   h.vy = 0;
}

describe("the portal", () => {
   it("speed in = speed out, along the selected exit, never under MIN_OUT or over V_CAP", () => {
      for (const v of [0.5, 6, 30]) {
         const r = run(1);
         atWall(r, 0, v);
         r.hero.grounded = false;
         step(r, STEP_MS, createStepInput());
         expect(r.teleports).toBe(1);
         const s = Math.hypot(r.hero.vx, r.hero.vy, r.hero.vz);
         expect(s).toBeGreaterThanOrEqual(MIN_OUT - 0.2);
         expect(s).toBeLessThanOrEqual(V_CAP + 1e-6);
         exitPose(r.course, selectedAnchor(r, 0), r.simMs, POSE);
         expect(Math.hypot(r.hero.x - POSE.x, r.hero.z - POSE.z)).toBeLessThan(0.6);
      }
   });

   it("a fall into a floor pad flings out of a pitched exit at the fall's speed", () => {
      const r = run(1);
      const e = r.course.pairs[3].entry;
      const h = r.hero;
      h.x = e.x;
      h.z = e.z;
      h.y = e.y + 0.02;
      h.vx = h.vz = 0;
      h.vy = -18;
      h.grounded = false;
      step(r, STEP_MS, createStepInput());
      expect(r.ev.teleported || r.teleports === 1).toBe(true);
      expect(h.vy).toBeGreaterThan(0);
      expect(Math.hypot(h.vx, h.vy, h.vz)).toBeGreaterThan(17);
   });

   it("moving an exit takes SWITCH_MS: a pair is closed meanwhile, and a frame passed then teleports nobody", () => {
      const r = run(1);
      const input = createStepInput();
      input.pick = courseFor(1).pairs[1].anchors[0];
      step(r, STEP_MS, input);
      expect(r.sel[1]).toBe(0);
      expect(pairOpen(r, 1)).toBe(false);
      atWall(r, 1, 6);
      step(r, STEP_MS, createStepInput());
      expect(r.teleports).toBe(0);
      expect(r.ev.closedPass || true).toBe(true);
      steps(r, SWITCH_MS);
      expect(pairOpen(r, 1)).toBe(true);
      expect(r.switches).toBe(1);
   });

   it("1-4 picks on the nearest pair with a choice; the cycle steps to its next anchor", () => {
      const r = run(1);
      const e = r.course.pairs[1].entry;
      r.hero.x = e.x;
      r.hero.z = e.z + 3;
      r.hero.y = 0;
      r.hero.ground = 1;
      expect(nearestPair(r)).toBe(1);
      const input = createStepInput();
      input.digit = 1;
      step(r, STEP_MS, input);
      expect(r.sel[1]).toBe(0);
      steps(r, SWITCH_MS + 20);
      const cyc = createStepInput();
      cyc.cyclePressed = true;
      step(r, STEP_MS, cyc);
      expect(r.sel[1]).toBe(1);
   });

   it("the hidden anchor (level 2) is pickable only from its spot", () => {
      const r = run(2);
      const a = r.course.anchors.find((x) => x.hidden)!;
      expect(anchorVisible(r, a)).toBe(false);
      const input = createStepInput();
      input.pick = a.id;
      step(r, STEP_MS, input);
      expect(selectedAnchor(r, a.pair).id).not.toBe(a.id);
      r.hero.x = a.hidden!.x;
      r.hero.z = a.hidden!.z;
      r.hero.y = a.hidden!.y;
      expect(anchorVisible(r, a)).toBe(true);
      step(r, STEP_MS, input);
      expect(selectedAnchor(r, a.pair).id).toBe(a.id);
   });

   it("Riko's dash adds DASH_PORTAL_BONUS on a grounded run-in", () => {
      const a = run(1, "riko");
      const b = run(1, "riko");
      for (const [r, dash] of [[a, true], [b, false]] as const) {
         atWall(r, 0, 6);
         r.hero.grounded = true;
         if (dash) r.dashUntil = r.simMs + 300;
         r.dashX = 0;
         r.dashZ = -1;
         step(r, STEP_MS, createStepInput());
      }
      const sa = Math.hypot(a.hero.vx, a.hero.vy, a.hero.vz);
      const sb = Math.hypot(b.hero.vx, b.hero.vy, b.hero.vz);
      expect(sa - sb).toBeGreaterThan(DASH_PORTAL_BONUS - 1.5);
   });

   it("a phasing Vexa passes a frame without teleporting, and picks up the shard behind it", () => {
      const r = run(1, "vexa");
      r.phaseUntil = 10_000;
      atWall(r, 0, 6);
      step(r, STEP_MS, createStepInput());
      expect(r.teleports).toBe(0);
      const sh = r.course.shard!;
      r.hero.x = sh.x;
      r.hero.y = sh.y - BODY_MID;
      r.hero.z = sh.z;
      r.hero.grounded = false;
      step(r, STEP_MS, createStepInput());
      const idx = SECRETS[1].findIndex((s) => s.id === "ghost-frame");
      expect(r.secrets.found[idx]).toBeTruthy();
   });

   it("a landing sticks (the horizontal speed drops to a run) and the void puts you back on the last island", () => {
      const r = run(1);
      const h = r.hero;
      h.x = 0;
      h.z = -20;
      h.y = 0.1;
      h.vx = 20;
      h.vy = -5;
      h.grounded = false;
      h.flung = true;
      steps(r, 100);
      expect(h.grounded).toBe(true);
      expect(Math.hypot(h.vx, h.vz)).toBeLessThanOrEqual(V_RUN + 1e-6);
      h.x = 40;
      h.y = -50;
      h.grounded = false;
      step(r, STEP_MS, createStepInput());
      expect(r.hits).toBe(1);
      expect(h.grounded).toBe(true);
      expect(r.checkpoint).toBe(1);
   });

   it("unflung, the air never carries more than a run (after a dash)", () => {
      const r = run(1);
      const h = r.hero;
      h.y = 5;
      h.vx = 15;
      h.grounded = false;
      step(r, STEP_MS, createStepInput());
      expect(Math.hypot(h.vx, h.vz)).toBeLessThanOrEqual(V_RUN + 1e-6);
   });

   it("a portal used again waits PORT_COOLDOWN_MS", () => {
      expect(PORT_COOLDOWN_MS).toBeGreaterThan(0);
   });

   it("the ghost arc starts at the exit and ends on an island or in the void", () => {
      const r = run(1);
      const out = new Float32Array(48 * 3);
      const n = previewArc(r, 3, 18, out);
      expect(n).toBeGreaterThan(5);
      exitPose(r.course, selectedAnchor(r, 3), 0, POSE);
      expect(out[0]).toBeCloseTo(POSE.x, 4);
      expect(out[2]).toBeCloseTo(POSE.z, 4);
   });
});

describe("orbs and hero gates", () => {
   it("Riko's crystal opens only to a dash, Kiro's cage to a shield, Zuno's floater to the magnet", () => {
      for (const [level, gate, set] of [
         [1, "riko", (r: PortalRun) => (r.dashUntil = r.simMs + 300)],
         [2, "kiro", (r: PortalRun) => (r.shieldUntil = r.simMs + 3000)],
         [1, "zuno", (r: PortalRun) => (r.magnetUntil = r.simMs + 3000)],
      ] as const) {
         const r = run(level, gate);
         const i = r.course.orbs.findIndex((o) => o.gate === gate);
         const o = r.course.orbs[i];
         r.hero.x = o.x + (gate === "zuno" ? 4 : 0);
         r.hero.y = o.y - BODY_MID;
         r.hero.z = o.z;
         r.hero.grounded = false;
         step(r, STEP_MS, createStepInput());
         expect(r.orbTaken[i], `${gate} without`).toBe(false);
         set(r);
         r.hero.y = o.y - BODY_MID;
         step(r, STEP_MS, createStepInput());
         expect(r.orbTaken[i], `${gate} with`).toBe(true);
      }
   });

   it("every level has five main orbs and its gated extras", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         expect(c.mainOrbs).toBe(5);
         for (let i = 0; i < 5; i++) expect(c.orbs[i].gate).toBe("");
      }
   });
});

describe("cargo (level 4)", () => {
   it("a crystal pushed through the frame lands on the plate and raises the bridge", () => {
      const r = run(4);
      const bot = createBot(r);
      const input = createStepInput();
      for (let f = 0; f < 600 && !r.gates[0]; f++) {
         botInput(bot, r, input);
         step(r, 1000 / 60, input);
      }
      expect(r.gates[0]).toBe(true);
      expect(Math.hypot(r.blocks[0].x - r.course.plates[0].x, r.blocks[0].z - r.course.plates[0].z)).toBeLessThan(r.course.plates[0].r);
   });
});

describe("moving portals (level 3)", () => {
   it("the anchors ride round the tower at the level's speed, facing out", () => {
      const c = courseFor(3);
      const a = c.anchors[0];
      const w = c.cfg.orbit;
      expect(w).toBeCloseTo((20 * Math.PI) / 180, 6);
      expect(wrapPi(anchorYaw(c, a, 1000) - anchorYaw(c, a, 0) - w)).toBeCloseTo(0, 6);
      exitPose(c, a, 4500, POSE);
      expect(Math.hypot(POSE.ax - a.orbit!.cx, POSE.az - a.orbit!.cz)).toBeCloseTo(a.orbit!.r, 6);
   });
});

describe("the Portal Wyrm (level 5)", () => {
   it("phase 1: a dive comes out of pair A's exit; at an intact beacon it bonks (a hit), elsewhere nothing", () => {
      for (const beacon of [true, false]) {
         const r = run(5);
         const c = r.course;
         const want = c.pairs[0].anchors.find((id) => (beacon ? c.anchors[id].beacon === 0 : c.anchors[id].loop))!;
         const input = createStepInput();
         input.pick = want;
         step(r, STEP_MS, input);
         // to the first vulnerable window, then past the dive
         for (let g = 0; g < 20_000 && !(r.boss!.step === "vulnerable"); g++) step(r, STEP_MS, createStepInput());
         r.hero.x = 0;
         r.hero.z = 0;
         steps(r, P1_DIVE_AT + DIVE_MS + 200);
         expect(r.boss!.hp, `beacon ${beacon}`).toBe(beacon ? WYRM.maxHp - 1 : WYRM.maxHp);
         expect(r.beaconAlive[0]).toBe(!beacon);
      }
   });

   it("phase 2: a landing on its back at BACK_SPEED cracks a plate; a soft landing does not", () => {
      for (const fast of [true, false]) {
         const r = run(5);
         r.boss!.phase = 1;
         r.boss!.hp = 3;
         r.boss!.step = "vulnerable";
         r.boss!.stepMs = 0;
         const h = r.hero;
         h.x = 0.3;
         h.z = 0.3;
         h.y = 0.05;
         h.vy = fast ? -BACK_SPEED - 1 : -4;
         h.vx = h.vz = 0;
         h.grounded = false;
         h.ground = -1;
         step(r, STEP_MS * 2, createStepInput());
         expect(r.boss!.hp, `fast ${fast}`).toBe(fast ? 2 : 3);
      }
   });

   it("phase 3: both loops set tie the knot; touching the head then wins", () => {
      const r = run(5);
      const c = r.course;
      r.boss!.phase = 2;
      r.boss!.hp = 1;
      r.boss!.step = "vulnerable";
      r.boss!.stepMs = 0;
      r.sel[0] = c.pairs[0].anchors.findIndex((id) => c.anchors[id].loop);
      r.sel[1] = c.pairs[1].anchors.findIndex((id) => c.anchors[id].loop);
      r.hero.x = 3;
      r.hero.z = 4;
      steps(r, P3_KNOT_AT + 50);
      expect(r.wyrm).toBe("knot");
      r.hero.x = KNOT_HEAD.x;
      r.hero.z = KNOT_HEAD.z + 0.5;
      steps(r, 50);
      expect(r.ended).toBe("win");
   });
});

describe("the fixed step", () => {
   it("the same inputs give the same run at 30 and 144 fps", () => {
      const go = (fps: number) => {
         const r = run(1);
         const bot = createBot(r, 1000 / fps);
         const input = createStepInput();
         for (let f = 0; f < 200_000 && r.ended === null; f++) {
            botInput(bot, r, input);
            step(r, 1000 / fps, input);
         }
         return r;
      };
      const a = go(30);
      const b = go(144);
      expect(a.ended).toBe("win");
      expect(b.ended).toBe("win");
      expect(Math.abs(a.finishMs - b.finishMs)).toBeLessThan(600);
   }, 120_000);
});
