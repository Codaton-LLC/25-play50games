// An honest cannon bot: it reads only what a player sees (the cannons where they are now, the pulse,
// the next node of the show) and plays through step() with the stick and the Jump press. Pure; used
// by the tests (the limits proof's "best real run") and later by the preview-only ?autoplay=1.
//
// In a cannon it solves the shot: scan pitch over the card's 20-70 deg, for each pitch take the
// speed that carries the arc to the target, keep the fastest solution, then wait for the pulse to
// reach that speed and fire (never past the 2.4 s aim timeout). Moving targets (rail cannons, the
// blimp's pods) are led: the target pose is taken at the predicted arrival ms. In flight it nudges
// toward the line and uses the hero power only when the course gates it (Vexa through a pole, Kiro
// through a jet, Nami when the arc lands short, Riko on the long flats). On a platform it walks to
// the next cannon; the 1.2 m auto-catch mounts it.
import { copyCombo } from "@/arcade3d/menu2/combo/combo";
import { copySecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { cannonX, cannonYaw, cannonZ, jetLive, type Course, type PlanStep } from "./course";
import {
   AIM_TIMEOUT_MS,
   CATCH_R,
   G,
   NONE,
   PITCH_MAX,
   PITCH_MIN,
   V_MAX,
   arcPoint,
   createRun,
   podPos,
   pulseAt,
   pulseForSpeed,
   step,
   type CannonRun,
   type StepInput,
} from "./rules";

export interface Bot {
   frameMs: number;
   /** the plan node the hero is working toward */
   target: number;
   /** the solved shot for the current aim: yaw, pitch, the pulse to wait for */
   aim: { yaw: number; pitch: number; pulse: number } | null;
   /** last frame's pulse (crossing detection at low fps) */
   lastPulse: number;
   /** the pulse two frames ago (crossing detection) */
   crossPulse: number;
   scratch: CannonRun;
   scratchInput: StepInput;
}

/** A target for the solver: world position + how forgiving it is. */
interface Target {
   x: number;
   y: number;
   z: number;
   r: number;
}

/** The plan step's target, posed at the rules ms (moving targets led by the caller). */
export function stepTarget(course: Course, stepDef: PlanStep, ms: number): Target {
   switch (stepDef.kind) {
      case "catch": {
         const c = course.cannons[stepDef.index];
         return { x: cannonX(c, ms), y: c.y, z: cannonZ(c, ms), r: CATCH_R };
      }
      case "land": {
         const p = course.platforms[stepDef.index];
         return { x: p.x, y: p.y, z: p.z, r: Math.min(p.hw, p.hd) };
      }
      case "bounce": {
         const t = course.tramps[stepDef.index];
         return { x: t.x, y: t.y, z: t.z, r: t.r };
      }
      case "balloon": {
         const b = course.balloons[stepDef.index];
         return { x: b.x, y: b.y, z: b.z, r: b.r };
      }
      case "finish":
         return { x: course.finish!.x, y: course.finish!.y, z: course.finish!.z, r: course.finish!.r };
      case "pod": {
         const b = course.boss!;
         const k = 0; // the vulnerable pod index is read live in solveShot
         const p = podPos(course, ms, k, 0);
         return { x: p.x, y: p.y, z: p.z, r: b.podR };
      }
      case "gondola": {
         const b = course.boss!;
         return { x: b.cx, y: b.cy + b.gondola.y, z: b.cz + b.gondola.z, r: b.gondolaR };
      }
      case "valve": {
         const b = course.boss!;
         return { x: b.cx, y: b.yPhase3 + b.valve.y, z: b.cz + b.valve.z, r: b.valveR };
      }
   }
}

export function createBot(run: CannonRun, frameMs = 1000 / 60): Bot {
   return {
      frameMs,
      target: 0,
      aim: null,
      lastPulse: 0,
      crossPulse: 0,
      scratch: createRun(run.seed, run.level, run.heroId),
      scratchInput: { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, jumpHeld: false, actionPressed: false },
   };
}

/** Copies the mutable run state (not the course or the events) from `src` into `dst` (look-ahead). */
export function copyRun(src: CannonRun, dst: CannonRun): void {
   dst.simMs = src.simMs;
   dst.remainder = src.remainder;
   dst.stepMs = src.stepMs;
   dst.heroId = src.heroId;
   Object.assign(dst.hero, src.hero);
   dst.pressMs = src.pressMs;
   dst.actionMs = src.actionMs;
   dst.powerReadyAt = src.powerReadyAt;
   dst.shots = src.shots;
   dst.collected.set(src.collected);
   dst.rainActive.set(src.rainActive);
   dst.orbs = src.orbs;
   dst.mainOrbs = src.mainOrbs;
   dst.popped.set(src.popped);
   dst.broken.set(src.broken);
   dst.caught.set(src.caught);
   dst.hooped.set(src.hooped);
   dst.crowdPassed.set(src.crowdPassed);
   dst.jamUntil.set(src.jamUntil);
   copyCombo(src.combo, dst.combo);
   copySecretTracker(src.secrets, dst.secrets);
   dst.hits = src.hits;
   dst.finishMs = src.finishMs;
   dst.ended = src.ended;
   if (src.ghost) {
      dst.ghost ??= { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, v: 0, from: 0 };
      Object.assign(dst.ghost, src.ghost);
   }
   if (src.boss && dst.boss) Object.assign(dst.boss, src.boss);
   Object.assign(dst.blimp, src.blimp);
}

/**
 * Solve a cannon shot from (x0, y0, z0) to the target. Scans the pitch over the card's 20-70 deg;
 * for each pitch the speed that lands the arc on the target comes from the range equation, then the
 * arc is checked exactly (integration beats) and the target pose is re-led once at the found flight
 * time (rail cannons, the blimp). Returns the fastest feasible shot and the pulse it needs.
 */
export function solveShot(
   x0: number,
   y0: number,
   z0: number,
   baseYaw: number,
   t0: Target,
   leadMs: (tSec: number) => Target,
   preferSlow = false,
): { yaw: number; pitch: number; v: number; t: number } | null {
   let best: { yaw: number; pitch: number; v: number; t: number } | null = null;
   for (let deg = Math.ceil((PITCH_MIN * 180) / Math.PI); deg <= Math.floor((PITCH_MAX * 180) / Math.PI); deg += 2) {
      const pitch = (deg * Math.PI) / 180;
      const dx = t0.x - x0;
      const dz = t0.z - z0;
      const dH = t0.y - y0;
      const dist = Math.hypot(dx, dz);
      if (dist < 1e-6) continue;
      const yaw = baseYaw + Math.atan2(dx, -dz);
      const sp = Math.sin(pitch);
      const cp = Math.cos(pitch);
      // range to fall dH: R = v cp (v sp + sqrt(v^2 sp^2 + 2 G max(0, -dH))) / G (exact at v)
      const solveV = (drop: number): number | null => {
         // scan v upward for R(v) = dist
         let prevV = 1;
         let prevR = -Infinity;
         for (let v = 1; v <= V_MAX + 0.01; v += 0.25) {
            const t = (v * sp + Math.sqrt(Math.max(0, v * v * sp * sp + 2 * G * drop))) / G;
            const r = v * cp * t;
            if (r >= dist) {
               // linear interpolate back
               const k = prevR === -Infinity ? 0 : (dist - prevR) / (r - prevR);
               return prevV + (v - prevV) * Math.max(0, Math.min(1, k));
            }
            prevV = v;
            prevR = r;
         }
         return null;
      };
      const v0 = solveV(Math.max(0, -dH));
      if (v0 === null) continue;
      // exact check at three speeds around the solution: the fired pulse is quantized (a frame can
      // land up to ~0.35 m/s off), so a shot only counts if all three pass through the target
      const probes = [v0 - 0.35, v0, v0 + 0.35];
      let ok = true;
      let tSum = 0;
      for (const v of probes) {
         if (v < 4 || v > V_MAX) {
            ok = false;
            break;
         }
         const tFly = dist / (v * cp);
         const led = leadMs(tFly);
         const ldx = led.x - x0;
         const ldz = led.z - z0;
         const ld = Math.hypot(ldx, ldz);
         const lyaw = baseYaw + Math.atan2(ldx, -ldz);
         const lt = ld / (v * cp);
         const p = arcPoint(x0, y0, z0, lyaw, pitch, v, lt);
         const missY = p.y - led.y;
         const missX = (p.x - led.x) ** 2 + (p.z - led.z) ** 2;
         if (Math.abs(missY) > led.r * 0.72 || missX > led.r * led.r * 0.55) {
            ok = false;
            break;
         }
         // descending through the target plane (a catch lands, not sails over)
         const vy = v * sp - G * lt;
         if (led.r <= 1.4 && vy > 0.5) {
            ok = false;
            break;
         }
         tSum += lt;
      }
      if (!ok) continue;
      const lt = tSum / probes.length;
      const lyaw = baseYaw + Math.atan2(t0.x - x0, -(t0.z - z0));
      if (!best) best = { yaw: lyaw, pitch, v: v0, t: lt };
      else if (preferSlow ? v0 < best.v - 0.05 : lt < best.t) best = { yaw: lyaw, pitch, v: v0, t: lt };
   }
   return best;
}

/** The aim stick for a wanted yaw/pitch: moveX = yaw offset, moveZ = pitch. */
function aimStick(yawOff: number, pitch: number, input: StepInput): void {
   input.moveX = Math.max(-1, Math.min(1, yawOff / (Math.PI / 3)));
   input.moveZ = Math.max(-1, Math.min(1, (45 * Math.PI / 180 - pitch) / ((25 * Math.PI) / 180)));
}

/** Advance the plan pointer: a node is done once the hero passed it (landed, caught, popped...). */
function planAdvance(bot: Bot, run: CannonRun): void {
   const stepDef = run.course.plan[bot.target];
   if (!stepDef) return;
   const h = run.hero;
   const ms = run.simMs;
   const near = (t: Target, rPad: number) => {
      const dx = h.x - t.x;
      const dy = h.y - t.y;
      const dz = h.z - t.z;
      const r = t.r + rPad;
      return dx * dx + dy * dy + dz * dz <= r * r;
   };
   switch (stepDef.kind) {
      case "catch":
         if ((h.mode === "aim" || h.mode === "catch") && h.cannon === stepDef.index && !h.balloonAim) bot.target += 1;
         break;
      case "land":
         if (h.grounded && near(stepTarget(run.course, stepDef, ms), 1)) bot.target += 1;
         break;
      case "bounce":
         if (run.events.bounced === stepDef.index) bot.target += 1;
         break;
      case "balloon":
         if (run.popped[stepDef.index]) bot.target += 1;
         break;
      case "finish":
         break;
      case "pod":
      case "gondola":
      case "valve":
         // boss nodes advance through the skip loop (bossNodeDone) and the hit events
         break;
   }
}

/** Ordinal of this step among the plan's same-kind boss nodes (P1 has 3 pods, P2 two gondola hits). */
function bossOrdinal(course: Course, target: number): number {
   let n = 0;
   for (let i = 0; i < target && i < course.plan.length; i++) if (course.plan[i].kind === course.plan[target].kind) n += 1;
   return n;
}

/** Is the hero's current boss phase past this node? (P1 has 3 pod hits, P2 two gondola hits.) */
function bossNodeDone(run: CannonRun, stepDef: PlanStep): boolean {
   const b = run.boss!;
   const ord = bossOrdinal(run.course, Math.min(run.course.plan.indexOf(stepDef), run.course.plan.length - 1));
   if (stepDef.kind === "pod") return b.phase > 0 || b.hits >= ord + 1;
   if (stepDef.kind === "gondola") return b.phase > 1 || b.hits >= 3 + ord + 1;
   return false;
}

/** The live target for the current plan step (the vulnerable pod is led; the gondola rides the blimp). */
function liveTarget(run: CannonRun, stepDef: PlanStep): Target {
   const course = run.course;
   const ms = run.simMs;
   if (stepDef.kind === "pod" && run.boss) {
      const k = run.boss.attack % 3;
      const p = podPos(course, ms, k, 0);
      return { x: p.x, y: p.y, z: p.z, r: course.boss!.podR };
   }
   if (stepDef.kind === "gondola" && run.boss) {
      const c = run.blimp;
      const g = course.boss!.gondola;
      return { x: c.x + g.x, y: c.y + g.y, z: c.z + g.z, r: course.boss!.gondolaR };
   }
   if (stepDef.kind === "valve" && run.boss) {
      const c = run.blimp;
      const v = course.boss!.valve;
      return { x: c.x + v.x, y: c.y + v.y, z: c.z + v.z, r: course.boss!.valveR };
   }
   return stepTarget(course, stepDef, ms);
}

/** Fills `input` for this frame. */
export function botInput(bot: Bot, run: CannonRun, input: StepInput): void {
   const h = run.hero;
   const ms = run.simMs;
   const course = run.course;
   input.yaw = 0;
   input.jumpPressed = false;
   input.actionPressed = false;
   input.jumpHeld = false;
   bot.crossPulse = bot.lastPulse;
   bot.lastPulse = pulseAt(ms);
   if (run.ended !== null || h.mode === "done") {
      input.moveX = 0;
      input.moveZ = 0;
      return;
   }
   // advance the plan pointer every frame (each case is guarded; events reset per step)
   planAdvance(bot, run);
   if (run.events.respawned || run.events.caught || run.events.mounted || run.events.landed) {
      bot.aim = null;
   }
   // skip boss nodes the run has already passed (phase changed while walking back)
   while (bot.target < course.plan.length && course.plan[bot.target].kind !== "finish" && course.plan[bot.target].kind !== "valve" && bossNodeDone(run, course.plan[bot.target])) {
      bot.target += 1;
   }
   const stepDef = course.plan[Math.min(bot.target, course.plan.length - 1)];

   if (h.mode === "aim") {
      aimBot(bot, run, stepDef, input);
      return;
   }
   if (h.grounded) {
      // boss windows: wait on the floor for the open window, then walk in and mount
      if ((stepDef.kind === "pod" || stepDef.kind === "gondola") && run.boss && !bossWindowOpen(run)) {
         input.moveX = 0;
         input.moveZ = 0;
         return;
      }
      // walk at the next cannon's mouth (or the nearest un-popped plan node)
      const t = liveTarget(run, stepDef);
      const dx = t.x - h.x;
      const dz = t.z - h.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.1) {
         input.moveX = dx / d;
         input.moveZ = dz / d;
      }
      pickupsSteer(bot, run, input);
      return;
   }
   // in flight: steer the nudge at the live target, detour for main orbs, dodge live jets,
   // and use the power when the course gates it
   const t = liveTarget(run, stepDef);
   steerTo(run, t.x, t.z, input);
   orbDetour(run, input);
   jetDodge(run, input);
   powerWhenGated(bot, run, t, input);
   // the valve needs the dive held on contact
   if (stepDef.kind === "valve" && h.y > t.y - 1) input.moveZ = 1;
}

/** Steer at the nearest uncollected main orb the arc is about to miss (they pay the time back). */
function orbDetour(run: CannonRun, input: StepInput): void {
   const h = run.hero;
   let best = 2.2;
   let bx = 0;
   let bz = 0;
   for (let i = 0; i < run.course.orbs.length; i++) {
      if (run.collected[i]) continue;
      const o = run.course.orbs[i];
      if (o.kind !== "main" || o.hidden) continue;
      const dx = o.x - h.x;
      const dz = o.z - h.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 4.84 || d2 < 1e-6) continue;
      // only when the orb is roughly ahead (a detour never turns the flight round)
      if (dz > 0.5 && Math.abs(dx) < 2) continue;
      if (d2 < best * best) {
         best = Math.sqrt(d2);
         bx = dx;
         bz = dz;
      }
   }
   if (best < 2.2) {
      const k = 1 / Math.max(0.2, best);
      input.moveX = bx * k;
      input.moveZ = bz * k;
   }
}

/** Sidestep a live smoke jet on the line (any hero; Kiro may just shield through instead). */
function jetDodge(run: CannonRun, input: StepInput): void {
   const h = run.hero;
   const ms = run.simMs;
   for (const j of run.course.jets) {
      if (!jetLive(j, ms)) continue;
      const dz = j.z - h.z;
      if (dz > -6 || dz < -0.5) continue;
      const dx = j.x - h.x;
      if (Math.abs(dx) > 2.5) continue;
      if (Math.abs(h.y - (j.y + j.len / 2)) > j.len) continue;
      // around it: pick the nearer side and lean off the jet axis
      input.moveX = (dx >= 0 ? -1 : 1) * Math.max(0.5, Math.abs(input.moveX));
   }
}

/** True while the boss can be hit right now (or no boss): the grounded bot only then walks in. */
function bossWindowOpen(run: CannonRun): boolean {
   const b = run.boss;
   if (!b) return true;
   return b.step === "vulnerable";
}

function steerTo(run: CannonRun, tx: number, tz: number, input: StepInput): void {
   const h = run.hero;
   const dx = tx - h.x;
   const dz = tz - h.z;
   const d = Math.hypot(dx, dz);
   const k = d > 0.4 ? 1 / d : 2.5;
   input.moveX = dx * k;
   input.moveZ = dz * k;
}

/** Detour for an uncollected main orb near the hero's line (they pay the submitted time back). */
function pickupsSteer(bot: Bot, run: CannonRun, input: StepInput): void {
   const h = run.hero;
   for (let i = 0; i < run.course.orbs.length; i++) {
      if (run.collected[i]) continue;
      const o = run.course.orbs[i];
      if (o.kind !== "main" || o.hidden) continue;
      const dx = o.x - h.x;
      const dz = o.z - h.z;
      if (dx * dx + dz * dz < 2.4 * 2.4) {
         const d = Math.max(0.1, Math.hypot(dx, dz));
         input.moveX = dx / d;
         input.moveZ = dz / d;
         return;
      }
   }
   void bot;
}

function powerWhenGated(bot: Bot, run: CannonRun, t: Target, input: StepInput): void {
   const h = run.hero;
   const course = run.course;
   const ms = run.simMs;
   if (run.simMs < run.powerReadyAt) return;
   const power = h.dashUntil >= ms || ms <= h.shieldUntil || ms <= h.magnetUntil || ms <= h.phaseUntil;
   if (power) return;
   const distTo = (x: number, y: number, z: number) => Math.hypot(h.x - x, h.y - y, h.z - z);
   switch (run.heroId) {
      case "vexa": {
         for (const p of course.poles) {
            if (h.y > p.y0 && h.y < p.y1 && distTo(p.x, h.y, p.z) < 3) {
               input.actionPressed = true;
               return;
            }
         }
         break;
      }
      case "kiro": {
         for (const j of course.jets) {
            if (distTo(j.x, j.y, j.z) < j.len + 2.5) {
               input.actionPressed = true;
               return;
            }
         }
         break;
      }
      case "nami": {
         // a second arc if the current one lands well short of the target
         const tLand = (V_MAX + Math.sqrt(V_MAX * V_MAX + 2 * G * Math.max(0, h.y - t.y))) / G;
         const dLand = Math.hypot(h.x + h.vx * tLand - t.x, h.z + h.vz * tLand - t.z);
         if (dLand > 6 && h.vy < 0) input.actionPressed = true;
         break;
      }
      case "riko": {
         // the dash smashes the cracked board on its line (the hidden cannon line is a bonus)
         for (const b of course.boards) {
            if (!run.broken[course.boards.indexOf(b)] && distTo(b.x, b.y, b.z) < 4) input.actionPressed = true;
         }
         break;
      }
      case "zuno": {
         const nearHidden = course.orbs.some((o, i) => o.hidden && !run.collected[i] && distTo(o.x, o.y, o.z) < 5);
         if (nearHidden || course.orbs.some((o, i) => !run.collected[i] && o.kind === "main" && distTo(o.x, o.y, o.z) < 1.8)) input.actionPressed = true;
         break;
      }
   }
   void bot;
}

function aimBot(bot: Bot, run: CannonRun, stepDef: PlanStep, input: StepInput): void {
   const h = run.hero;
   const ms = run.simMs;
   const course = run.course;
   const cannon = h.balloonAim ? null : course.cannons[h.cannon];

   // auto cannons and the boss windows fire on their own timing: wait
   if (cannon && cannon.kind === "auto") {
      input.moveX = 0;
      input.moveZ = 0;
      return;
   }
   // a wheel cannon keeps rotating under the hero: re-solve every frame
   if (cannon && cannon.kind === "wheel") bot.aim = null;
   // boss targets: only fire while the window is open (and for the valve, from high enough)
   if (stepDef.kind === "pod" && run.boss && run.boss.step !== "vulnerable") {
      bot.aim = null;
      input.moveX = 0;
      input.moveZ = 0;
      return;
   }
   if (stepDef.kind === "gondola" && run.boss && run.boss.step !== "vulnerable") {
      bot.aim = null;
      input.moveX = 0;
      input.moveZ = 0;
      return;
   }

   // (re)solve when stale
   if (!bot.aim) {
      const t = liveTarget(run, stepDef);
      const lead = (tSec: number): Target => {
         const at = stepTarget(course, stepDef, ms + tSec * 1000);
         if (stepDef.kind === "pod" && run.boss) {
            const k = run.boss.attack % 3;
            const p = podPos(course, ms + tSec * 1000, k, 0);
            return { x: p.x, y: p.y, z: p.z, r: t.r };
         }
         if (stepDef.kind === "gondola" || stepDef.kind === "valve") {
            const c = blimpLead(course, ms + tSec * 1000, run.boss ? run.boss.phase : 2);
            const off = stepDef.kind === "gondola" ? course.boss!.gondola : course.boss!.valve;
            return { x: c.x + off.x, y: c.y + off.y, z: c.z + off.z, r: t.r };
         }
         return at;
      };
      const baseYaw = cannon ? cannonYaw(cannon, ms) : 0;
      const solved = solveShot(h.x, h.y, h.z, baseYaw, t, lead, stepDef.kind === "bounce");
      if (!solved) {
         // no clean shot (moving target out of sweep): hold, re-solve next frame
         input.moveX = 0;
         input.moveZ = 0;
         return;
      }
      bot.aim = { yaw: solved.yaw, pitch: solved.pitch, pulse: pulseForSpeed(solved.v) };
   }
   const aim = bot.aim;
   const yawOff = aim.yaw - (cannon ? cannonYaw(cannon, ms) : 0);
   aimStick(yawOff, aim.pitch, input);

   // fire when the pulse is on the solution, or crossed it since the last frame (30 fps skips the window)
   const p = bot.lastPulse;
   const crossed = (bot.crossPulse < aim.pulse && p >= aim.pulse) || (bot.crossPulse > aim.pulse && p <= aim.pulse);
   if (Math.abs(p - aim.pulse) <= 0.012 || crossed) {
      input.jumpPressed = true;
      bot.aim = null;
   } else if (ms - h.aimFrom > AIM_TIMEOUT_MS - 300) {
      // never let the timeout beat us to a wild shot: fire at whatever is closest on this cycle
      input.jumpPressed = true;
      bot.aim = null;
   }
   if (stepDef.kind === "valve" && h.y < 22) {
      input.jumpPressed = false; // the chain is not up yet
      bot.aim = null;
   }
}

function blimpLead(course: Course, ms: number, phase: number): { x: number; y: number; z: number } {
   const b = course.boss!;
   // P3: it rises to the tent top and hovers (the valve sits still for the dive)
   if (phase >= 2) return { x: b.cx, y: b.yPhase3, z: b.cz };
   const angle = (2 * Math.PI * (ms % b.periodMs)) / b.periodMs;
   return { x: b.cx + b.radius * Math.cos(angle), y: b.yPhase2, z: b.cz + b.radius * Math.sin(angle) };
}

void NONE;
