// Roll Cannon Jump's courses (the design card, .handoff/K-m2-cannon/world-1-cards.md "43"): a
// colour-drained big top crossed by firing yourself cannon-to-cannon. Pure, no Math.random: the
// same level is the same show for every seed (a time leaderboard). Built by hand per level (the
// card's five designs), each teaching its twist in its first beats.
//
// Coordinates: 1 unit = 1 m, forward is -z, up is +y. A cannon's (x, y, z) is its mouth; a
// platform's y is its walkable top. The bot (bot.ts) and the floor proof (rules.ts) both read the
// `plan`: the ordered nodes the main line visits (the hero starts inside the first cannon).
import type { LevelId } from "@/arcade3d/types";
import type { HeroId } from "./heroes";
import { LEVELS, type CannonLevel } from "./levels";

// ---------- the pieces ----------

export type CannonKind = "fixed" | "rail" | "wheel" | "auto";

/** A rail ride: offset = sway(travel, periodMs, phase, ms) along one axis (the card: 2.8 s rails on L3). */
export interface RailDef {
   axis: "x" | "z";
   travel: number;
   periodMs: number;
   phase: number;
}

export interface CannonDef {
   id: string;
   /** the mouth at rest (m) */
   x: number;
   y: number;
   z: number;
   kind: CannonKind;
   /** base yaw (rad, 0 = straight -z); a wheel cannon rotates this on a cycle */
   yaw: number;
   /** the resting pitch (rad); a mounted hero re-aims within the card's 20-70 deg */
   pitch: number;
   rail: RailDef | null;
   /** wheel cannons: the yaw sweep period (ms) and phase */
   wheelPeriodMs: number;
   wheelPhase: number;
   /** behind a cracked board: not catchable until the board is smashed (Riko) */
   hidden: boolean;
   /** auto cannons: fire alone after 1.5 s in the barrel at this fixed pulse (timing, not aiming) */
   autoPower: number;
}

export interface PlatformDef {
   x: number;
   y: number;
   z: number;
   hw: number;
   hd: number;
}

export interface TrampDef {
   x: number;
   y: number;
   z: number;
   r: number;
}

export interface BalloonDef {
   x: number;
   y: number;
   z: number;
   r: number;
}

/** A fire hoop on a bonus line: fly through for a flow link (never required). */
export interface HoopDef {
   x: number;
   y: number;
   z: number;
   r: number;
}

/** A cracked target board (Riko's dash smashes it, opening the hidden cannon behind). */
export interface BoardDef {
   x: number;
   y: number;
   z: number;
   hw: number;
   hh: number;
   /** board plane normal (rad, 0 = facing -z) */
   yaw: number;
}

/** A ghost tent pole: a solid cylinder that blocks the direct shot (Vexa's phase slips through). */
export interface PoleDef {
   x: number;
   z: number;
   y0: number;
   y1: number;
   r: number;
}

/** A grey smoke jet (from L3): knocks a flying hero off its arc (Kiro's shield passes). */
export interface JetDef {
   x: number;
   y: number;
   z: number;
   /** jet direction (unit-ish) and length */
   dx: number;
   dy: number;
   dz: number;
   len: number;
   r: number;
   periodMs: number;
   duty: number;
   phase: number;
}

/** A tent wall: a solid box (lob over it or thread under the trapeze). */
export interface WallDef {
   x0: number;
   x1: number;
   y0: number;
   y1: number;
   z0: number;
   z1: number;
}

export interface OrbDef {
   x: number;
   y: number;
   z: number;
   /** "main" counts for the all-orbs star; "bonus" orbs sit on a hero-gated route */
   kind: "main" | "bonus";
   /** only Zuno's magnet draws it out of the tent canvas */
   hidden: boolean;
   /** the hero whose route it is (bonus orbs) */
   hero: HeroId | null;
}

/** Orbs rained by a popped boss pod: inactive until the pod pops (deterministic, placed per pod). */
export interface RainOrbDef extends OrbDef {
   pod: number;
}

export interface FinishDef {
   x: number;
   y: number;
   z: number;
   r: number;
}

/** Crowd silhouettes on the stands: turn red as the hero passes (juice; rules expose the event). */
export interface CrowdDef {
   z0: number;
   z1: number;
   side: number;
}

/** Level 5's Ashbag arena (progression.ts ASHBAG drives the windows). */
export interface BossCourse {
   /** the circuit's centre (the blimp circles it) */
   cx: number;
   cy: number;
   cz: number;
   /** circuit radius and period (ms) */
   radius: number;
   periodMs: number;
   /** the three smoke-pod offsets (rotate with the blimp; one is vulnerable per circuit) */
   pods: { x: number; y: number; z: number }[];
   podR: number;
   /** the gondola (P2) and valve (P3) offsets from the centre */
   gondola: { x: number; y: number; z: number };
   gondolaR: number;
   valve: { x: number; y: number; z: number };
   valveR: number;
   /** the blimp's height by phase (it rises for P3) */
   yPhase2: number;
   yPhase3: number;
   /** paint bombs jam these arena cannons (P2), in turn */
   bombCannons: number[];
   bombR: number;
}

export type PlanKind = "catch" | "land" | "bounce" | "balloon" | "finish" | "pod" | "gondola" | "valve";

/** One node of the main line the hero visits, in order (the hero starts in cannon 0). */
export interface PlanStep {
   kind: PlanKind;
   /** cannon / platform / trampoline / balloon / hoop index, or -1 for boss nodes and the finish */
   index: number;
}

/** A mandatory stretch of the show for the floor proof: fly legs cover (d, dH), walk legs d at V_WALK. */
export interface LegDef {
   mode: "fly" | "walk";
   d: number;
   dH: number;
   /** a catch ends the leg: the 0.4 s hit-stop counts */
   catchEnd: boolean;
}

export interface Course {
   level: LevelId;
   /** below this the hero is falling (the tent floor is at y = 0) */
   killY: number;
   cannons: CannonDef[];
   platforms: PlatformDef[];
   tramps: TrampDef[];
   balloons: BalloonDef[];
   hoops: HoopDef[];
   boards: BoardDef[];
   poles: PoleDef[];
   jets: JetDef[];
   walls: WallDef[];
   orbs: OrbDef[];
   rainOrbs: RainOrbDef[];
   finish: FinishDef | null;
   crowd: CrowdDef[];
   /** where each secret floats, in progression.ts SECRETS order */
   secrets: { x: number; y: number; z: number }[];
   plan: PlanStep[];
   legs: LegDef[];
   /** the card's shortcut (L4's 100 % one-shot): an alternate, shorter leg list */
   altLegs: LegDef[] | null;
   boss: BossCourse | null;
   durationMs: number;
}

// ---------- movers (deterministic polynomials, the same in every engine) ----------

const D = Math.PI / 180;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** smoothstep(triangle) offset, polynomials only */
export function sway(travel: number, periodMs: number, phase: number, ms: number): number {
   const cycles = ms / periodMs + phase;
   const t = cycles - Math.floor(cycles);
   const tri = t < 0.5 ? 2 * t : 2 - 2 * t;
   const s = tri * tri * (3 - 2 * tri);
   return travel * (2 * s - 1);
}

/** A cannon mouth at rules ms (rail offset applied). */
export function cannonX(c: CannonDef, ms: number): number {
   return c.x + (c.rail && c.rail.axis === "x" ? sway(c.rail.travel, c.rail.periodMs, c.rail.phase, ms) : 0);
}

export function cannonZ(c: CannonDef, ms: number): number {
   return c.z + (c.rail && c.rail.axis === "z" ? sway(c.rail.travel, c.rail.periodMs, c.rail.phase, ms) : 0);
}

/** A wheel cannon's yaw sweep amplitude (rad): it sweeps the aim through the target; fire on timing. */
export const WHEEL_SWEEP = 55 * D;

/** A wheel cannon's base yaw at rules ms (the mounted hero rides it; fire on timing). */
export function cannonYaw(c: CannonDef, ms: number): number {
   if (c.kind !== "wheel") return c.yaw;
   return c.yaw + sway(WHEEL_SWEEP, c.wheelPeriodMs, c.wheelPhase, ms);
}

export function jetLive(j: JetDef, ms: number): boolean {
   const t = ms / j.periodMs + j.phase;
   return t - Math.floor(t) < j.duty;
}

// ---------- the builder ----------

class Builder {
   d: Course = {
      level: 1 as LevelId,
      killY: 2,
      cannons: [],
      platforms: [],
      tramps: [],
      balloons: [],
      hoops: [],
      boards: [],
      poles: [],
      jets: [],
      walls: [],
      orbs: [],
      rainOrbs: [],
      finish: null,
      crowd: [],
      secrets: [],
      plan: [],
      legs: [],
      altLegs: null,
      boss: null,
      durationMs: 0,
   };

   constructor(readonly level: CannonLevel) {
      this.d.level = level.id;
      this.d.durationMs = level.durationMs;
   }

   cannon(x: number, y: number, z: number, opts: Partial<CannonDef> = {}): number {
      this.d.cannons.push({
         id: `c${this.d.cannons.length}`,
         x: r2(x),
         y: r2(y),
         z: r2(z),
         kind: opts.kind ?? "fixed",
         yaw: opts.yaw ?? 0,
         pitch: opts.pitch ?? 45 * D,
         rail: opts.rail ?? null,
         wheelPeriodMs: opts.wheelPeriodMs ?? 0,
         wheelPhase: opts.wheelPhase ?? 0,
         hidden: opts.hidden ?? false,
         autoPower: opts.autoPower ?? 0.8,
      });
      return this.d.cannons.length - 1;
   }

   platform(x: number, y: number, z: number, hw: number, hd: number): number {
      this.d.platforms.push({ x: r2(x), y: r2(y), z: r2(z), hw: r2(hw), hd: r2(hd) });
      return this.d.platforms.length - 1;
   }

   tramp(x: number, y: number, z: number, r = 1.4): number {
      this.d.tramps.push({ x: r2(x), y: r2(y), z: r2(z), r: r2(r) });
      return this.d.tramps.length - 1;
   }

   balloon(x: number, y: number, z: number, r = 1.2): number {
      this.d.balloons.push({ x: r2(x), y: r2(y), z: r2(z), r: r2(r) });
      return this.d.balloons.length - 1;
   }

   hoop(x: number, y: number, z: number, r = 1.5): number {
      this.d.hoops.push({ x: r2(x), y: r2(y), z: r2(z), r: r2(r) });
      return this.d.hoops.length - 1;
   }

   board(x: number, y: number, z: number, yaw = 0): number {
      this.d.boards.push({ x: r2(x), y: r2(y), z: r2(z), hw: 0.9, hh: 0.9, yaw: r2(yaw) });
      return this.d.boards.length - 1;
   }

   pole(x: number, z: number, y0: number, y1: number, r = 0.45): number {
      this.d.poles.push({ x: r2(x), z: r2(z), y0: r2(y0), y1: r2(y1), r: r2(r) });
      return this.d.poles.length - 1;
   }

   jet(x: number, y: number, z: number, dy: number, periodMs: number, duty: number, phase = 0, r = 0.9, len = 3): number {
      this.d.jets.push({ x: r2(x), y: r2(y), z: r2(z), dx: 0, dy: r2(dy), dz: 0, len: r2(len), r: r2(r), periodMs, duty, phase: r2(phase) });
      return this.d.jets.length - 1;
   }

   wall(x0: number, x1: number, y0: number, y1: number, z: number, depth = 0.6): number {
      this.d.walls.push({ x0: r2(x0), x1: r2(x1), y0: r2(y0), y1: r2(y1), z0: r2(z - depth / 2), z1: r2(z + depth / 2) });
      return this.d.walls.length - 1;
   }

   orb(x: number, y: number, z: number, kind: "main" | "bonus" = "main", hero: HeroId | null = null, hidden = false): number {
      this.d.orbs.push({ x: r2(x), y: r2(y), z: r2(z), kind, hidden, hero });
      return this.d.orbs.length - 1;
   }

   finish(x: number, y: number, z: number, r = 1.7): void {
      this.d.finish = { x: r2(x), y: r2(y), z: r2(z), r: r2(r) };
   }

   secret(x: number, y: number, z: number): void {
      this.d.secrets.push({ x: r2(x), y: r2(y), z: r2(z) });
   }

   plan(kind: PlanKind, index: number): void {
      this.d.plan.push({ kind, index });
   }

   crowd(z0: number, z1: number, side: 1 | -1): void {
      this.d.crowd.push({ z0: r2(z0), z1: r2(z1), side });
   }

   /** node stand position for legs and the bot */
   nodePos(step: PlanStep): { x: number; y: number; z: number } {
      const d = this.d;
      switch (step.kind) {
         case "catch":
            return d.cannons[step.index];
         case "land":
            return d.platforms[step.index];
         case "bounce":
            return d.tramps[step.index];
         case "balloon":
            return d.balloons[step.index];
         case "finish":
            return d.finish!;
         case "pod":
         case "gondola":
         case "valve": {
            const b = d.boss!;
            return { x: b.cx, y: b.cy, z: b.cz };
         }
      }
   }

   /** derive legs from the plan: a platform -> the cannon standing on it is a walk, all else flies */
   legsFrom(plan: PlanStep[], fromCannon0: boolean): LegDef[] {
      const legs: LegDef[] = [];
      let prev = fromCannon0 ? { x: this.d.cannons[0].x, y: this.d.cannons[0].y, z: this.d.cannons[0].z } : null;
      let prevKind: PlanKind | "start" = "start";
      for (const step of plan) {
         const p = this.nodePos(step);
         if (prev) {
            const d = Math.hypot(p.x - prev.x, p.z - prev.z);
            const walk = prevKind === "land" && step.kind === "catch";
            legs.push({ mode: walk ? "walk" : "fly", d: r2(d), dH: r2(p.y - prev.y), catchEnd: step.kind === "catch" });
         }
         prev = p;
         prevKind = step.kind;
      }
      return legs;
   }
}

// ---------- the five shows ----------

function buildL1(b: Builder): void {
   const c0 = b.cannon(0, 8, 0, { pitch: 50 * D });
   const p1 = b.platform(0, 8, -13, 3, 7); // the wide runway: just press fire, land anywhere
   const c1 = b.cannon(0, 8, -18);
   const c2 = b.cannon(0, 8, -26);
   const t1 = b.tramp(0, 8, -34);
   const p2 = b.platform(0, 8, -40, 2.5, 4.5);
   const c3 = b.cannon(0, 8, -43);
   const c4 = b.cannon(0, 9, -57);
   const c5 = b.cannon(-1, 9, -64);
   b.finish(0, 9, -72);
   // main orbs on the arcs and the walk lanes
   b.orb(0, 8.8, -12);
   b.orb(0, 10, -22);
   b.orb(0, 8.8, -30);
   b.orb(0, 10.8, -35.5);
   b.orb(0, 8.8, -38.5);
   b.orb(0, 12.5, -49);
   b.orb(1.5, 10, -49);
   b.orb(-1, 10.2, -60.5);
   b.orb(0, 10.5, -68);
   b.orb(-1.5, 10, -70);
   b.hoop(0, 12.8, -47);
   b.hoop(0, 10.8, -70);
   b.crowd(-20, -30, 1);
   b.crowd(-50, -60, -1);
   b.secret(2.6, 8.6, -16); // the ticket stub on the runway's edge
   b.secret(-2.5, 11.5, -70); // the ribbon shard beside the finish ring
   b.plan("land", p1);
   b.plan("catch", c1);
   b.plan("catch", c2);
   b.plan("bounce", t1);
   b.plan("catch", c3);
   b.plan("catch", c4);
   b.plan("catch", c5);
   b.plan("finish", -1);
   b.d.legs = b.legsFrom(b.d.plan, true);
}

function buildL2(b: Builder): void {
   const c0 = b.cannon(0, 8, 0, { pitch: 50 * D });
   const p1 = b.platform(0, 8, -13, 3, 6);
   const c1 = b.cannon(0, 8, -18);
   // the trapeze bar: thread a flat shot under it (apex under y 10.6 at z -27)
   b.wall(-8, 8, 10.6, 13.5, -27, 0.5);
   const c2 = b.cannon(0, 8, -34);
   // the tent wall: lob over it (top 11.8 at z -47)
   b.wall(-8, 8, 8, 11.8, -47, 0.6);
   const c3 = b.cannon(0, 9.5, -57);
   const p2 = b.platform(0, 9.5, -63, 3, 2);
   const c4 = b.cannon(0, 9.5, -66);
   const c5 = b.cannon(2, 9.5, -74);
   const c6 = b.cannon(0, 10, -82);
   // Nami's high trapeze cannon, over the bar (a second arc reaches it from mid-flight)
   const ct = b.cannon(3.5, 12.5, -29, { yaw: -20 * D });
   b.orb(3.5, 13.2, -29, "bonus", "nami");
   b.orb(2.5, 12, -32, "bonus", "nami");
   // Riko's cracked board hides a bonus cannon line behind it
   b.board(4, 10.5, -74, 20 * D);
   const cr = b.cannon(6.5, 10.5, -77, { yaw: -35 * D, pitch: 55 * D, hidden: true });
   b.orb(7.5, 11.5, -81, "bonus", "riko");
   b.orb(6, 12, -85, "bonus", "riko");
   b.hoop(6.5, 12.5, -83, 1.4);
   b.finish(0, 10, -91);
   // main orbs
   b.orb(0, 8.8, -12);
   b.orb(0, 9.2, -24); // under the bar
   b.orb(0, 8.8, -31);
   b.orb(0, 13.5, -45); // over the wall
   b.orb(-1.5, 12, -45);
   b.orb(0, 10.7, -60);
   b.orb(1, 10.2, -70);
   b.orb(2, 10.2, -78);
   b.orb(0, 10.3, -87);
   b.orb(-1.5, 10, -88);
   b.hoop(0, 9.6, -26, 1.4);
   b.crowd(-20, -30, -1);
   b.crowd(-40, -50, 1);
   b.crowd(-70, -80, -1);
   b.secret(6.5, 11.8, -79); // the cracked-board shard on Riko's line
   b.secret(3.5, 13.8, -31); // the trapeze sticker on Nami's line
   b.plan("land", p1);
   b.plan("catch", c1);
   b.plan("catch", c2);
   b.plan("catch", c3);
   b.plan("land", p2);
   b.plan("catch", c4);
   b.plan("catch", c5);
   b.plan("catch", c6);
   b.plan("finish", -1);
   b.d.legs = b.legsFrom(b.d.plan, true);
   void ct;
   void cr;
}

function buildL3(b: Builder): void {
   const c0 = b.cannon(0, 8, 0, { pitch: 50 * D });
   const p1 = b.platform(0, 8, -11, 3, 5);
   const c1 = b.cannon(0, 8, -15);
   // a rail cannon (2.8 s cycle): catch it on the move
   const rc1 = b.cannon(0, 8.5, -24, { rail: { axis: "x", travel: 3, periodMs: 2800, phase: 0 } });
   const c2 = b.cannon(0, 9, -33);
   // a wheel cannon: it sweeps the aim, fire on timing
   const wc = b.cannon(0, 9.5, -42, { kind: "wheel", wheelPeriodMs: 3600, wheelPhase: 0, pitch: 50 * D });
   // the smoke jet gap: time it (Kiro flies through)
   b.jet(0, 9.5, -47.5, 1, 2400, 0.5, 0);
   const c3 = b.cannon(0, 9.5, -53);
   // the auto-cannon chain: caught, held 1.5 s, fired at a fixed calibrated pulse (timing replaces aiming)
   const a1 = b.cannon(0, 9.5, -59, { kind: "auto", yaw: -0.124, pitch: 40 * D, autoPower: 0.64 });
   const a2 = b.cannon(-1, 10, -67, { kind: "auto", yaw: 0.124, pitch: 22 * D, autoPower: 0.686 });
   const c4 = b.cannon(0, 10, -75);
   // a second rail ride, then home
   const rc2 = b.cannon(0, 10, -83, { rail: { axis: "x", travel: 2.5, periodMs: 2800, phase: 0.5 } });
   const p2 = b.platform(0, 10, -90, 3, 2);
   const c5 = b.cannon(0, 10, -93);
   b.finish(0, 10, -101);
   // Zuno's hidden canvas trail beside the jet gap
   b.orb(-5, 10, -44, "bonus", "zuno", true);
   b.orb(-5.5, 11.2, -48, "bonus", "zuno", true);
   b.orb(-5, 12.4, -52, "bonus", "zuno", true);
   // main orbs
   b.orb(0, 8.8, -11);
   b.orb(1.5, 9.3, -20);
   b.orb(-1.5, 9.8, -28);
   b.orb(0, 10.8, -37);
   b.orb(0, 10, -47.5); // the jet gap lane
   b.orb(1, 10, -55);
   b.orb(0, 10.5, -63);
   b.orb(-1, 10.3, -71);
   b.orb(1.5, 10.3, -79);
   b.orb(0, 10.3, -97);
   b.orb(-1.5, 10, -98);
   b.hoop(0, 10.6, -47.5, 1.4);
   b.crowd(-20, -30, 1);
   b.crowd(-45, -55, -1);
   b.crowd(-70, -80, 1);
   b.secret(4.5, 9.5, -24); // the rail shard, caught as rc1 sways out
   b.secret(0, 11, -50); // the smoke sticker past the jet
   b.plan("land", p1);
   b.plan("catch", c1);
   b.plan("catch", rc1);
   b.plan("catch", c2);
   b.plan("catch", wc);
   b.plan("catch", c3);
   b.plan("catch", a1);
   b.plan("catch", a2);
   b.plan("catch", c4);
   b.plan("catch", rc2);
   b.plan("land", p2);
   b.plan("catch", c5);
   b.plan("finish", -1);
   b.d.legs = b.legsFrom(b.d.plan, true);
}

function buildL4(b: Builder): void {
   const c0 = b.cannon(0, 8, 0, { pitch: 50 * D });
   const p1 = b.platform(0, 8, -11, 3, 5);
   const c1 = b.cannon(0, 8, -15);
   // long shot 1 (25 m): the jet on the lane must be timed or steered around
   b.jet(0, 8.5, -28, 1, 2600, 0.5, 0.25);
   const c2 = b.cannon(0, 8.5, -40);
   // the balloon gap: only a balloon re-aim crosses it
   const bl = b.balloon(0, 12, -49);
   const c3 = b.cannon(0, 9, -65);
   b.jet(0, 9, -77, 1, 2600, 0.5, 0);
   // a safety trampoline under the c3 -> c4 line (a short second chance, never required)
   b.tramp(0, 7.5, -77, 1.6);
   const c4 = b.cannon(0, 9, -90);
   const p2 = b.platform(0, 8.5, -98, 3, 3);
   const c5 = b.cannon(0, 8.5, -101);
   // the one-shot line: exactly 100 % pulse from c2 reaches this far perch, skipping the balloon,
   // c3 and c4 (three nodes); from the perch an ordinary shot rejoins the main platform
   const cone = b.cannon(6, 11, -76.5, { yaw: -14 * D });
   b.finish(0, 8.5, -110);
   // main orbs (7 on the show line; 3 canvas-trail bonus orbs only Zuno's magnet draws out)
   b.orb(0, 8.8, -11);
   b.orb(0, 10, -26);
   b.orb(0, 9.2, -34);
   b.orb(0, 10.5, -56);
   b.orb(0, 10, -73);
   b.orb(0, 9.6, -84);
   b.orb(0, 8.8, -104);
   // Zuno's canvas trail high on the tent wall
   b.orb(-7, 11, -50, "bonus", "zuno", true);
   b.orb(-7.5, 12.5, -58, "bonus", "zuno", true);
   b.orb(-7, 14, -66, "bonus", "zuno", true);
   b.hoop(0, 11.6, -45, 1.4);
   b.crowd(-20, -32, 1);
   b.crowd(-60, -75, -1);
   b.crowd(-95, -105, 1);
   b.secret(6, 12.3, -76.5); // the one-shot shard on the far perch
   b.secret(0, 13, -57); // the balloon sticker on the re-aim arc
   b.plan("land", p1);
   b.plan("catch", c1);
   b.plan("catch", c2);
   b.plan("balloon", bl);
   b.plan("catch", c3);
   b.plan("catch", c4);
   b.plan("land", p2);
   b.plan("catch", c5);
   b.plan("finish", -1);
   b.d.legs = b.legsFrom(b.d.plan, true);
   // the shortcut: c2 -> far perch (100 % only) -> the main platform -> the same tail home
   const altPlan: PlanStep[] = [
      { kind: "catch", index: cone },
      { kind: "land", index: p2 },
      { kind: "catch", index: c5 },
      { kind: "finish", index: -1 },
   ];
   const altFrom = { x: b.d.cannons[c2].x, y: b.d.cannons[c2].y, z: b.d.cannons[c2].z };
   const altLegs: LegDef[] = [];
   let prev = altFrom;
   let prevKind: PlanKind | "start" = "start";
   for (const step of altPlan) {
      const p = b.nodePos(step);
      const walk = prevKind === "land" && step.kind === "catch";
      altLegs.push({ mode: walk ? "walk" : "fly", d: r2(Math.hypot(p.x - prev.x, p.z - prev.z)), dH: r2(p.y - prev.y), catchEnd: step.kind === "catch" });
      prev = p;
      prevKind = step.kind;
   }
   b.d.altLegs = altLegs;
}

function buildL5(b: Builder): void {
   const c0 = b.cannon(0, 8, 0, { pitch: 50 * D });
   const p1 = b.platform(0, 8, -11, 3, 5);
   const c1 = b.cannon(0, 8, -15);
   // the arena: two ring cannons and a floor under the circling blimp (the cannons stand on the floor)
   const cA = b.cannon(0, 7.5, -42);
   const cB = b.cannon(0, 7.5, -50);
   const ap = b.platform(0, 7.5, -46, 5, 5);
   // P2's bounce trampolines on the floor, under the gondola line
   const ta = b.tramp(2.5, 7.5, -46, 1.3);
   const tb = b.tramp(-2.5, 7.5, -46, 1.3);
   // P3's upward auto-cannon chain and the launcher under it
   const cC = b.cannon(0, 7.5, -44);
   const ac0 = b.cannon(5, 14, -40, { kind: "auto", yaw: -0.69, pitch: 53 * D, autoPower: 0.788 });
   const ac1 = b.cannon(-5, 17, -52, { kind: "auto", yaw: 0.69, pitch: 53 * D, autoPower: 0.788 });
   const ac2 = b.cannon(5, 20, -40, { kind: "auto", yaw: -0.67, pitch: 28 * D, autoPower: 0.883 });
   const ac3 = b.cannon(-3, 23, -50, { kind: "auto", yaw: 2.5, pitch: 20 * D, autoPower: 0.686 });
   b.d.boss = {
      cx: 0,
      cy: 12,
      cz: -46,
      radius: 9,
      periodMs: 8000,
      pods: [
         { x: 3, y: 0, z: 0 },
         { x: -1.5, y: 0, z: 2.6 },
         { x: -1.5, y: 0, z: -2.6 },
      ],
      podR: 1.5,
      gondola: { x: 0, y: -2.6, z: 0 },
      gondolaR: 1.6,
      valve: { x: 0, y: 2.6, z: 0 },
      valveR: 1.5,
      yPhase2: 12,
      yPhase3: 21,
      bombCannons: [cA, cB],
      bombR: 1.4,
   };
   // pod rain: each popped pod rains 3 orbs (activate on the pop)
   for (let pod = 0; pod < 3; pod++) {
      for (let k = 0; k < 3; k++) {
         b.d.rainOrbs.push({ x: r2(-2 + k * 2), y: r2(9.5), z: r2(-46 - pod), pod, kind: "main", hidden: false, hero: null });
      }
   }
   // arena orbs
   b.orb(0, 8.8, -11);
   b.orb(1.5, 8.8, -20);
   b.orb(0, 9.5, -30);
   b.orb(2.5, 8.6, -43);
   b.orb(-2.5, 8.6, -49);
   b.crowd(-30, -40, 1);
   b.crowd(-50, -60, -1);
   b.secret(4, 8.1, -60); // the ash shard on the arena's edge
   b.secret(2, 24.8, -48); // the valve sticker up top
   b.plan("land", p1);
   b.plan("catch", c1);
   b.plan("catch", cA);
   b.plan("pod", -1);
   b.plan("land", ap);
   b.plan("catch", cA);
   b.plan("pod", -1);
   b.plan("land", ap);
   b.plan("catch", cA);
   b.plan("pod", -1);
   b.plan("land", ap);
   b.plan("catch", cB);
   b.plan("gondola", -1);
   b.plan("land", ap);
   b.plan("catch", cB);
   b.plan("gondola", -1);
   b.plan("land", ap);
   b.plan("catch", cC);
   b.plan("catch", ac0);
   b.plan("catch", ac1);
   b.plan("catch", ac2);
   b.plan("catch", ac3);
   b.plan("valve", -1);
   b.d.legs = b.legsFrom(b.d.plan, true);
}

// ---------- build ----------

const BUILDERS: Record<LevelId, (b: Builder) => void> = { 1: buildL1, 2: buildL2, 3: buildL3, 4: buildL4, 5: buildL5 };

const COURSES: Partial<Record<LevelId, Course>> = {};

export function buildCourse(level: CannonLevel = LEVELS[1]): Course {
   const b = new Builder(level);
   BUILDERS[level.id](b);
   if (b.d.secrets.length !== 2) throw new Error(`roll-cannon-jump L${level.id}: exactly 2 secrets are placed`);
   return b.d;
}

export function courseFor(level: LevelId): Course {
   return (COURSES[level] ??= buildCourse(LEVELS[level]));
}

/** All five courses (rules.ts COURSE). */
export const COURSE: Record<LevelId, Course> = {
   1: courseFor(1),
   2: courseFor(2),
   3: courseFor(3),
   4: courseFor(4),
   5: courseFor(5),
};
