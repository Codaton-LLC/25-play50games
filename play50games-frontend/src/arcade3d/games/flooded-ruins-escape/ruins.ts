// The drowned temple, level by level: stone blocks (ledges, chamber floors, tall walls, cracked
// brick and ghost panels), water chambers with their levels, stone levers and what each position
// does to the water, bubble spouts, steam jets, whirlpools, cave bats, floating crates, orbs,
// secrets and the boss arena, plus the route the honest bot follows. Pure data and small builders,
// no Math.random: a level is the same race for every seed (a time leaderboard).
//
// Units: 1 = 1 m, forward is -z, up is +y. A block is a box: its top is the walkable rectangle and
// its bottom the underside (walls reach high, ledges are 1.4 m thick). Chambers are trenches along
// -z between tall side walls, so the follow camera behind (+z) looks down the trench.
import type { LevelId } from "@/arcade3d/types";

export type SupportKind = "start" | "ledge" | "checkpoint" | "goal" | "floor" | "wall" | "crate";

/** A stone block. `top` is fixed except for a crate (it floats on its chamber's water). */
export interface Support {
   kind: SupportKind;
   cx: number;
   cz: number;
   hw: number;
   hd: number;
   top: number;
   bottom: number;
   /** cracked brick: Riko's dash breaks it (it is gone for the rest of the run) */
   crack: boolean;
   /** a ghost panel: Vexa passes through it while her phase is up */
   ghost: boolean;
   /** a floating crate: the chamber whose water lifts it, NONE for a stone block */
   float: number;
   /** a crate's top rests at floatMin on the chamber floor and never rises past floatMax */
   floatMin: number;
   floatMax: number;
   /** drawn by the Scene as a faint cut-away face (it still collides) */
   hidden: boolean;
}

/** A water chamber: the rectangle the water fills, its floor, the levels its levers set, the level it starts at. */
export interface Zone {
   minX: number;
   maxX: number;
   minZ: number;
   maxZ: number;
   floor: number;
   levels: number[];
   start: number;
}

/** What one lever position does: set these chambers to these level indices. */
export type LeverEffect = readonly [zone: number, level: number];

export interface Lever {
   x: number;
   y: number;
   z: number;
   positions: number;
   /** effects[pos]: applied when the lever reaches `pos` (pos 0 is the start, applied again when it cycles back) */
   effects: LeverEffect[][];
   /** a pressure lever springs back to 0 this long after a pull (0 = it stays) */
   holdMs: number;
   kind: "lever" | "pressure" | "gate";
}

/** A bubble column: inside it the air meter refills. */
export interface Spout {
   x: number;
   z: number;
   r: number;
   y0: number;
   y1: number;
}

/** A steam jet: live for `duty` of each cycle, a cylinder of radius r from y to y + h. */
export interface Jet {
   x: number;
   y: number;
   z: number;
   r: number;
   h: number;
   periodMs: number;
   duty: number;
   phase: number;
}

/** A whirlpool in a chamber: it pulls swimmers inside r towards its centre; the core drags them under. */
export interface Whirl {
   zone: number;
   x: number;
   z: number;
   r: number;
   core: number;
}

/** A cave bat roosting at (x, y, z): it swoops round a circle of `radius` while its chamber's water is under dryBelow. */
export interface Bat {
   x: number;
   y: number;
   z: number;
   zone: number;
   dryBelow: number;
   radius: number;
   periodMs: number;
   phase: number;
}

export interface Orb {
   x: number;
   y: number;
   z: number;
   /** a hero-gated bonus orb: not needed for the all-orbs star (it still takes its 0.4 s off) */
   bonus: boolean;
   /** buried in this chamber's floor: only Zuno's magnet pulls it out, and only while the water is under it (NONE = loose) */
   buried: number;
}

/** Where a secret floats; `sunken` = it only shows on its chamber's floor after the chamber was fully flooded and then drained. */
export interface SecretSpot {
   id: string;
   x: number;
   y: number;
   z: number;
   sunken: number;
}

/** The boss arena (level 5): the paths Umbra Roller rolls and the levers that beat it (rules.ts bossPose). */
export interface BossArena {
   /** phase 1: the roll down the spiral (a polyline of feet points), then stuck at its end */
   rollPath: [number, number, number][];
   /** phase 1: the ring chamber whose water has to be at least ringLevel for the stuck boss to float (stompable) */
   ring: number;
   ringLevel: number;
   /** phase 2: the drain at the floor's centre, the geyser's top, and the three pressure levers */
   drain: [number, number, number];
   geyserTop: number;
   pressure: number[];
   /** phase 3: the chase up the switchbacks (feet points), ending on the floodgate */
   chasePath: [number, number, number][];
   /** the floodgate lever: pulled while the boss sits on the gate (vulnerable) it drops the gate on it */
   gateLever: number;
}

/** A step of the honest bot's route (bot.ts): stand on a support, set a lever, wait for a water level, swim to a point, the boss moves. */
export type RouteStep =
   | { go: number }
   | { lever: number; pos: number }
   | { wait: number; atLeast?: number; atMost?: number }
   | { swim: [number, number]; dive?: number }
   | { walk: [number, number] }
   | { boss: "stomp" | "p2-wait" | "geyser" | "gate" };

export interface CourseDraft {
   supports: Support[];
   zones: Zone[];
   levers: Lever[];
   spouts: Spout[];
   jets: Jet[];
   whirls: Whirl[];
   bats: Bat[];
   orbs: Orb[];
   secrets: SecretSpot[];
   boss: BossArena | null;
   route: RouteStep[];
}

const NONE = -1;

/** A small course builder: boxes by their corners, so a chamber reads like a floor plan. */
export class RuinBuilder {
   readonly d: CourseDraft = { supports: [], zones: [], levers: [], spouts: [], jets: [], whirls: [], bats: [], orbs: [], secrets: [], boss: null, route: [] };

   /** A block from x0..x1, z0..z1 with this top; `bottom` defaults to a 1.4 m ledge. Returns its index. */
   block(kind: SupportKind, x0: number, x1: number, z0: number, z1: number, top: number, bottom = top - 1.4, opts: Partial<Pick<Support, "crack" | "ghost" | "hidden">> = {}): number {
      this.d.supports.push({
         kind,
         cx: (x0 + x1) / 2,
         cz: (z0 + z1) / 2,
         hw: Math.abs(x1 - x0) / 2,
         hd: Math.abs(z1 - z0) / 2,
         top,
         bottom,
         crack: opts.crack ?? false,
         ghost: opts.ghost ?? false,
         float: NONE,
         floatMin: top,
         floatMax: top,
         hidden: opts.hidden ?? false,
      });
      return this.d.supports.length - 1;
   }

   /** A centred ledge (cx, cz, width, depth). */
   ledge(cx: number, cz: number, top: number, w = 3.4, d = 3.6, kind: SupportKind = "ledge"): number {
      return this.block(kind, cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, top);
   }

   /** A floating crate (w x d, 0.9 m deep) in chamber `zone`: rests at floatMin, rises with the water to floatMax. */
   crate(zone: number, cx: number, cz: number, w: number, d: number, floatMin: number, floatMax: number): number {
      const i = this.block("crate", cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, floatMin, floatMin - 0.9);
      const s = this.d.supports[i];
      s.float = zone;
      s.floatMin = floatMin;
      s.floatMax = floatMax;
      return i;
   }

   zone(x0: number, x1: number, z0: number, z1: number, floor: number, levels: number[], start: number): number {
      this.d.zones.push({ minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1), floor, levels, start });
      return this.d.zones.length - 1;
   }

   lever(x: number, y: number, z: number, effects: LeverEffect[][], kind: Lever["kind"] = "lever", holdMs = 0): number {
      this.d.levers.push({ x, y, z, positions: effects.length, effects, holdMs, kind });
      return this.d.levers.length - 1;
   }

   orb(x: number, y: number, z: number, bonus = false, buried = NONE): void {
      this.d.orbs.push({ x, y, z, bonus, buried });
   }

   secret(id: string, x: number, y: number, z: number, sunken = NONE): void {
      this.d.secrets.push({ id, x, y, z, sunken });
   }

   spout(x: number, z: number, r: number, y0: number, y1: number): void {
      this.d.spouts.push({ x, z, r, y0, y1 });
   }

   jet(x: number, y: number, z: number, periodMs: number, phase: number, duty = 0.3, r = 0.7, h = 2.2): void {
      this.d.jets.push({ x, y, z, r, h, periodMs, duty, phase });
   }

   route(...steps: RouteStep[]): void {
      this.d.route.push(...steps);
   }
}

// ---------- Level 1: Drain Entry (the card's three beats) ----------
// Beat 1: drop into a dry trench, pull its lever, the trench floods and you float up to the high
// exit ledge. Beat 2 (the reverse): the next trench is flooded over a low door; pull the lever on the
// ledge to drain it and walk under the door. Beat 3: the storm tide starts behind you up a
// three-row switchback to the exit gate.
function drainEntry(): CourseDraft {
   const b = new RuinBuilder();
   // beat 1: the start, trench A (dry), its tall side walls, and the exit ledge E1 at the far end
   b.block("start", -3, 3, -3, 3, 2.8, -10);
   const aFloor = b.block("floor", -3, 3, -15, -3, -2, -10);
   b.block("wall", -5.5, -3, -15, 3, 9, -10);
   b.block("wall", 3, 5.5, -15, 3, 9, -10);
   const e1 = b.block("checkpoint", -3, 3, -19, -15, 4.4, -10);
   const zA = b.zone(-3, 3, -15, -3, -2, [-2, 2.4], 0);
   const lA = b.lever(1.8, -2, -7, [[[zA, 0]], [[zA, 1]]]);
   // beat 2: trench B, flooded over a low door, drained from the lever on E1
   const bFloor = b.block("floor", -3, 3, -37, -19, -1, -10);
   b.block("wall", 3, 5.5, -46, -15, 9.2, -10);
   b.block("wall", -5.5, -3, -44, -15, 9.2, -10);
   // Vexa's niche behind a ghost panel in the left wall beside c1 (outside the chamber)
   b.block("wall", -3.5, -3, -46, -44, 8, 5.2, { ghost: true });
   b.block("wall", -6.5, -5.0, -46, -44, 8, -10);
   b.block("floor", -5.0, -3.5, -46, -44, 5.2, -10);
   b.block("wall", -5.0, -3.5, -46, -44, 8, 7.0);
   b.block("wall", -5.5, -3, -49, -46, 8, -10);
   b.block("wall", -3, 3, -28, -27, 8, 0.9);
   // Nami's nest over the flooded trench: only her breach jump from the water reaches it
   b.block("ledge", 2.0, 3.0, -31, -29.8, 5.8, 5.2);
   const x1 = b.block("ledge", -3, 3, -40, -37, 1.2, -10);
   const x2 = b.block("ledge", -3, 3, -43, -40, 3.2, -10);
   const c1 = b.block("checkpoint", -3, 3, -49, -43, 5.2, -10);
   const zB = b.zone(-3, 3, -40, -19, -1, [-1, 2.6], 1);
   const lB = b.lever(2.0, 4.4, -17.2, [[[zB, 1]], [[zB, 0]]]);
   // beat 3: three switchback rows (the tide starts on c1)
   const r1 = [b.ledge(0, -52.5, 7.0), b.ledge(4.5, -52.5, 8.8), b.ledge(9, -52.5, 10.6)];
   const r2 = [b.ledge(9, -58.5, 12.4), b.ledge(4.5, -58.5, 14.2), b.ledge(0, -58.5, 16.0), b.ledge(-4.5, -58.5, 17.8)];
   const r3 = [b.ledge(-4.5, -64.5, 19.6), b.ledge(0, -64.5, 21.4), b.ledge(4.5, -64.5, 23.2), b.ledge(9, -64.5, 25.0)];
   const goal = b.ledge(9, -70, 26.8, 6, 5, "goal");
   // orbs on the way (15), Zuno's buried trail and Nami's nest (bonus)
   b.orb(1.4, -1.2, -10.5);
   b.orb(1.4, 1.6, -14.2);
   b.orb(0.5, 5.0, -15.8);
   b.orb(0, 0.2, -23);
   b.orb(0, 0.2, -27.5);
   b.orb(0, 0.2, -32);
   b.orb(0.1, 2.8, -37.5);
   b.orb(0, 4.2, -41.5);
   b.orb(0, 7.7, -51);
   b.orb(5.4, 11.5, -52.5);
   b.orb(9.2, 13.1, -56.7);
   b.orb(3.5, 17, -58.5);
   b.orb(-4.6, 20.3, -62.8);
   b.orb(5.6, 25.7, -64.5);
   b.orb(9.2, 27.9, -68.4);
   for (const z of [-6, -9, -12]) b.orb(-1.6, -1.3, z, true, zA);
   b.orb(2.5, 6.4, -30.1, true);
   b.orb(2.5, 6.4, -30.7, true);
   b.secret("sunken", 0.4, -1.3, -13, zA);
   b.secret("ghost-niche", -4.25, 5.9, -45);
   b.route(
      { go: aFloor },
      { lever: lA, pos: 1 },
            { go: e1 },
      { lever: lB, pos: 1 },
      { wait: zB, atMost: -0.6 },
      { go: bFloor },
      { go: x1 },
      { go: x2 },
      { go: c1 },
      ...r1.map((go) => ({ go })),
      ...r2.map((go) => ({ go })),
      ...r3.map((go) => ({ go })),
      { go: goal },
   );
   return b.d;
}

// ---------- Level 2: Pipe Maze (linked chambers) ----------
// Three trenches in a row. Each lever links two chambers: lowering one raises the next, so the order
// matters (and a wrong pull is undone by pulling again). A floods A (and drains B), so you float out
// of A; B's lever floods B (and drains C), so you float out of B and walk C's floor under its door,
// past the steam jets. Riko's dash breaks the cracked plug in A's far wall: a tunnel straight into B.
function pipeMaze(): CourseDraft {
   const b = new RuinBuilder();
   b.block("start", -3, 3, -3, 3, 2.8, -10);
   const aFloor = b.block("floor", -3, 3, -15, -3, -2, -10);
   b.block("wall", -5.5, -3, -15, 3, 9, -10);
   b.block("wall", 3, 5.5, -15, 3, 9, -10);
   // AB: the ledge over a tunnel; the tunnel's mouth is a cracked plug
   const ab = b.block("checkpoint", -3, 3, -19, -15, 4.4, 0.4);
   b.block("wall", -3, -1, -19, -15, 0.4, -10);
   b.block("wall", 1, 3, -19, -15, 0.4, -10);
   b.block("floor", -1, 1, -19, -15.5, -2, -10);
   b.block("wall", -1, 1, -15.5, -15, 0.4, -2, { crack: true });
   const zA = b.zone(-3, 3, -15, -3, -2, [-2, 2.4], 0);
   // chamber B
   const bFloor = b.block("floor", -3, 3, -35, -19, -1, -10);
   b.block("wall", -5.5, -3, -39, -15, 10.6, -10);
   b.block("wall", 3, 5.5, -39, -15, 10.6, -10);
   const zB = b.zone(-3, 3, -35, -19, -1, [-1, 4.0], 0);
   b.block("ledge", 2.0, 3.0, -28.6, -27.4, 7.2, 6.6);
   const bc = b.block("checkpoint", -3, 3, -39, -35, 6.4, -10);
   // chamber C, flooded over a low door
   const cFloor = b.block("floor", -3, 3, -55, -39, 2.0, -10);
   b.block("wall", -5.5, -3, -59, -35, 12, -10);
   b.block("wall", 3, 5.5, -62, -35, 12, -10);
   b.block("wall", -3, 3, -48, -47, 12, 3.9);
   const d1 = b.block("ledge", -3, 3, -58, -55, 4.0, -10);
   const d2 = b.block("checkpoint", -3, 3, -62, -58, 6.4, -10);
   const zC = b.zone(-3, 3, -58, -39, 2.0, [2.0, 6.0], 1);
   // Vexa's niche beside d2
   b.block("wall", -3.5, -3, -61, -59, 12, 6.4, { ghost: true });
   b.block("wall", -6.5, -5.0, -61, -59, 12, -10);
   b.block("floor", -5.0, -3.5, -61, -59, 6.4, -10);
   b.block("wall", -5.0, -3.5, -61, -59, 12, 8.2);
   b.block("wall", -5.5, -3, -62, -61, 12, -10);
   // the levers: each links two chambers
   const l1 = b.lever(1.8, -2, -7, [
      [[zA, 0], [zB, 1]],
      [[zA, 1], [zB, 0]],
   ]);
   const l2 = b.lever(1.8, -1, -24, [
      [[zB, 0], [zC, 1]],
      [[zB, 1], [zC, 0]],
   ]);
   // Kiro's steam jets in the doorway
   b.jet(0, 2.0, -47.5, 2600, 0, 0.4, 1.3, 2.2);
   // the climb (the tide starts on d2)
   const r1 = [b.ledge(0, -65.5, 8.2), b.ledge(4.5, -65.5, 10.0), b.ledge(9, -65.5, 11.8)];
   const r2 = [b.ledge(9, -71.5, 13.6), b.ledge(4.5, -71.5, 15.4), b.ledge(0, -71.5, 17.2), b.ledge(-4.5, -71.5, 19.0)];
   const goal = b.ledge(-4.5, -77.5, 20.8, 6, 5, "goal");
   for (const [x, y, z] of [
      [0.5, -0.7, -14.1], [0, 1.7, -14.7], [0.5, 5, -15.8], [0, 0.3, -22.8], [0.5, 0, -30],
      [0, 3.0, -34.7], [0, 4.4, -34.7], [0.5, 7, -35.8], [0, 2.8, -44], [0, 2.8, -51],
      [0, 4.8, -55.6], [0, 7, -58.6], [0, 9, -64], [5, 11, -65.5], [9.2, 14.2, -69.8], [4.2, 17.2, -71.5], [-4.6, 21.4, -75.9], [-0.5, 18.6, -71.5],
   ] as const) b.orb(x, y, z);
   for (const z of [-22, -27, -32]) b.orb(-1.6, -0.3, z, true, zB);
   b.orb(2.5, 7.8, -27.8, true);
   b.orb(2.5, 7.8, -28.2, true);
   b.secret("sunken", 0.4, -1.3, -13, zA);
   b.secret("cistern", 0, -1.2, -17.2);
   b.secret("ghost-niche", -4.25, 7.1, -60);
   b.route(
      { go: aFloor },
      { lever: l1, pos: 1 },
      { go: ab },
      { go: bFloor },
      { lever: l2, pos: 1 },
      { go: bc },
      { wait: zC, atMost: 2.4 },
      { go: cFloor },
      { go: d1 },
      { go: d2 },
      ...r1.map((go) => ({ go })),
      ...r2.map((go) => ({ go })),
      { go: goal },
   );
   return b.d;
}

// ---------- Level 3: Valve Shaft (the spiral round the flooded shaft) ----------

/** A point `s` metres along the square ring of half-size r round (0, cz), clockwise from the near side's middle (+x first). */
export function ringPoint(r: number, cz: number, s: number): { x: number; z: number } {
   const per = 8 * r;
   const t = ((s % per) + per) % per;
   if (t < r) return { x: t, z: cz + r };
   if (t < 3 * r) return { x: r, z: cz + r - (t - r) };
   if (t < 5 * r) return { x: r - (t - 3 * r), z: cz - r };
   if (t < 7 * r) return { x: -r, z: cz - r + (t - 5 * r) };
   return { x: -r + (t - 7 * r), z: cz + r };
}

/**
 * The shaft's spiral, 4 slots per side (the corners are slots 2, 6, 10, 14 of each 16-slot lap): per
 * slot, the ledge's top or null. Each gap is a whole side between two corner ledges (13.6 m of open
 * water, more than any jump), crossed by swimming at that ring's water level.
 */
export const SHAFT_SLOTS: readonly (number | null)[] = [
   0, 1.5, 3.0, null, null, null,
   4.5, 5.5, 6.5, 7.5, 8.5, null, null, null,
   10.0, 11.0, 12.0, 13.0, 14.0, null, null, null,
   15.5, 17.0, 18.5, 20.0, 21.5, 23.0,
];
export const SHAFT = { r: 8.3, cz: -12, step: 4.15, wall: 10.5, ringLevels: [-2, 2.7, 8.2, 13.7], ledge: 3.0 } as const;

// The central shaft: one chamber whose water the three rings of levers set. Each lap of the spiral
// ends in a collapsed stretch you can only swim across with the water at that ring's level, and
// the next ring's lever waits on the far side. Bats roost in a dry niche and swoop while the water
// is low. Kiro's shield walks through the rim jet; Vexa's ghost panel hides a sticker.
function valveShaft(): CourseDraft {
   const b = new RuinBuilder();
   const { r, cz, step, wall, ringLevels, ledge } = SHAFT;
   const W = wall;
   const H = 40;
   const last = SHAFT_SLOTS.length - 1;
   b.block("floor", -W, W, cz - W, cz + W, -2, -12);
   // the shaft walls: the near one is drawn as a cut-away face
   b.block("wall", -W - 1.5, -W, cz - W - 1.5, cz + W + 1.5, H, -12);
   b.block("wall", W, W + 1.5, cz - W - 1.5, cz + W + 1.5, H, -12);
   b.block("wall", -W, W, cz - W - 1.5, cz - W, H, -12);
   b.block("wall", -W, W, cz + W, cz + W + 1.5, H, -12, { hidden: true });
   const zS = b.zone(-W, W, cz - W, cz + W, -2, [...ringLevels], 0);
   const ledges: number[] = [];
   SHAFT_SLOTS.forEach((top, i) => {
      if (top === null) return;
      const p = ringPoint(r, cz, i * step);
      const kind = i === 0 ? "start" : i === last ? "goal" : i === 22 ? "checkpoint" : "ledge";
      const size = kind === "goal" || kind === "start" ? 3.8 : ledge;
      ledges[i] = b.ledge(p.x, p.z, top, size, size, kind);
   });
   // the rings of levers: on the start, then on the first ledge past each gap, on its shaft-side half
   const lever = (slot: number, ring: number) => {
      const p = ringPoint(r, cz, slot * step);
      const ix = p.x - Math.sign(p.x) * (Math.abs(p.x) > r - 0.5 ? 0.8 : 0);
      const iz = p.z - Math.sign(p.z - cz) * (Math.abs(p.z - cz) > r - 0.5 ? 0.8 : 0);
      return b.lever(ix, SHAFT_SLOTS[slot] as number, iz, [[[zS, ring - 1]], [[zS, ring]]]);
   };
   const l1 = lever(0, 1);
   const l2 = lever(6, 2);
   const l3 = lever(14, 3);
   // a bat in a dry niche over lap 2's far side, a steam jet on the last lap
   const bp = ringPoint(r, cz, 8 * step);
   b.d.bats.push({ x: bp.x, y: 9.4, z: bp.z, zone: zS, dryBelow: 6, radius: 1.2, periodMs: 2600, phase: 0 });
   const jp = ringPoint(r, cz, 24 * step);
   b.jet(jp.x, 18.5, jp.z, 3000, 0.2, 0.35, 0.9, 2.2);
   // orbs (placed on the honest route; README "Levels"), Zuno's trail on the floor, Nami's nest over gap 1
   for (const [x, y, z] of SHAFT_ORBS) b.orb(x, y, z);
   for (const x of [-3, 0, 3]) b.orb(x, -1.3, cz, true, zS);
   const np = ringPoint(r, cz, 4 * step);
   b.block("ledge", np.x - 0.6, np.x + 0.6, np.z - 0.6, np.z + 0.6, 5.9, 5.3);
   b.orb(np.x, 6.5, np.z, true);
   b.secret("sunken", 1.2, -1.3, cz + 1.2, zS);
   // Vexa: a ghost panel in the far wall hides a sticker niche behind slot 8
   const gp = ringPoint(r, cz, 8 * step);
   b.block("wall", gp.x - 1, gp.x + 1, cz - W - 0.6, cz - W, H, 6.5, { ghost: true });
   b.secret("ghost-spiral", gp.x, 7.4, cz - W - 0.3);
   b.route(
      { lever: l1, pos: 1 },
      { go: ledges[1] },
      { go: ledges[2] },
      { wait: zS, atLeast: ringLevels[1] - 0.05 },
      { swim: [r, cz - r + 2.4] },
      { go: ledges[6] },
      { lever: l2, pos: 1 },
      ...[7, 8, 9, 10].map((i) => ({ go: ledges[i] })),
      { wait: zS, atLeast: ringLevels[2] - 0.05 },
      { swim: [-r, cz + r - 2.4] },
      { go: ledges[14] },
      { lever: l3, pos: 1 },
      ...[15, 16, 17, 18].map((i) => ({ go: ledges[i] })),
      { wait: zS, atLeast: ringLevels[3] - 0.05 },
      { swim: [r, cz - r + 2.4] },
      ...[22, 23, 24, 25, 26, 27].map((i) => ({ go: ledges[i] })),
   );
   return b.d;
}

/** Level 3's orbs on the honest route (the climb and the three swims). */
const SHAFT_ORBS: readonly [number, number, number][] = [
   [0.15, 2.01, -4.23],
   [5.14, 4.01, -3.67],
   [8.53, 2.3, -7.59],
   [8.3, 3.2, -12],
   [8.3, 3.2, -16],
   [7.15, 7.86, -20.3],
   [2.87, 8.42, -20.3],
   [-1.02, 9.86, -20.3],
   [-5.36, 10.29, -20.3],
   [-8.47, 8.41, -17.25],
   [-8.39, 8.25, -12.01],
   [-8.33, 8.25, -8.01],
   [-7.15, 13.36, -3.7],
   [-2.88, 13.92, -3.7],
   [1.03, 15.36, -3.7],
   [5.38, 15.79, -3.7],
   [8.48, 13.91, -6.75],
   [8.39, 13.75, -11.99],
   [8.33, 13.75, -15.99],
   [6.71, 19.16, -20.3],
   [2.51, 20.16, -20.3],
   [-1.47, 22.03, -20.3],
   [-5.76, 23.16, -20.3],
];

// ---------- Level 4: Flood Rise (the fast tide and the air pockets) ----------
// The storm tide rises at 0.6 m/s. The shortcut is a flooded crypt under a stone roof: dive, swim
// from air pocket to air pocket (bubble spouts refill the air meter), and leap out at the far end
// before the tide reaches the crypt's water. The long dry route climbs the terraces on the right and
// stays above the tide. A hidden bubble in the crypt wall leads to a side grotto with a shard; Kiro's
// shield takes him through the whirlpool; Vexa's ghost panel hides a sticker by the last row.
function floodRise(): CourseDraft {
   const b = new RuinBuilder();
   const start = b.block("start", -3, 3, -3, 3, 4.0, -10);
   b.block("floor", -3, 3, -46, -3, -6, -10);
   b.block("wall", -5.5, -3, -33, -3, 12, -10);
   b.block("wall", -5.5, -3, -50, -35, 12, -10);
   b.block("wall", -5.5, -3, -35, -33, 12, 2.6);
   b.block("wall", 3, 5.5, -50, -6, 12, -10);
   const zP = b.zone(-3, 3, -46, -3, -6, [3.0], 0);
   // the crypt roof (drawn as a cut-away): three slabs under the waterline, two air pockets between
   b.block("wall", -3, 3, -15, -8, 8, 2.6, { hidden: true });
   b.block("wall", -3, 3, -27, -17, 8, 2.6, { hidden: true });
   b.block("wall", -3, 3, -40, -29, 8, 2.6, { hidden: true });
   b.spout(0, -16, 1.1, -6, 3.2);
   b.spout(0, -28, 1.1, -6, 3.2);
   // the side grotto behind the hidden bubble (its own pocket of the same water)
   b.block("floor", -5.0, -3, -35, -33, -6, -10);
   b.block("wall", -6.5, -5.0, -36, -32, 12, -10);
   b.block("wall", -5.0, -3, -36, -35, 12, -10);
   b.block("wall", -5.0, -3, -33, -32, 12, -10);
   b.zone(-5.0, -3, -35, -33, -6, [3.0], 0);
   b.spout(-4.0, -34, 0.8, -6, 3.2);
   b.d.whirls.push({ zone: zP, x: 2.1, z: -22, r: 2.2, core: 0.6 });
   const e = b.block("checkpoint", -3, 3, -50, -46, 5.5, -10);
   // the dry route: terraces on the right, high above the tide
   const dry = [b.ledge(8, 0, 5.6), b.ledge(12.5, 0, 7.4)];
   const tops = [9.2, 11.0, 12.8, 14.6, 14.6, 14.6, 14.6, 14.6, 14.6, 14.6, 14.6];
   tops.forEach((t, i) => dry.push(b.ledge(12.5, -5 - 5 * i, t)));
   // the climb to the gate: two rows
   const r1 = [b.ledge(0, -53.5, 7.3), b.ledge(4.5, -53.5, 9.1), b.ledge(9, -53.5, 10.9)];
   const r2 = [b.ledge(9, -59.5, 12.7), b.ledge(4.5, -59.5, 14.5), b.ledge(0, -59.5, 16.3), b.ledge(-4.5, -59.5, 18.1)];
   const goal = b.ledge(-4.5, -65.5, 19.9, 6, 5, "goal");
   // Vexa's niche beside the goal
   b.block("wall", -8.2, -7.5, -67, -64, 24, 19.9, { ghost: true });
   b.block("floor", -10, -8.2, -67, -64, 19.9, 17);
   b.block("wall", -10.5, -10, -67, -64, 24, 17);
   for (const [x, y, z] of FLOOD_ORBS) b.orb(x, y, z);
   b.orb(-4.0, -4.5, -34, true);
   b.secret("bubble-room", -4.0, -5.0, -34);
   b.secret("ghost-niche", -9.1, 20.6, -65.5);
   void start;
   void dry;
   b.route(
      { swim: [0, -6] },
      { swim: [0, -14], dive: 1.0 },
      { swim: [0, -16] },
      { swim: [0, -26], dive: 1.0 },
      { swim: [0, -28] },
      { swim: [0, -40.5], dive: 1.0 },
      { swim: [0, -44] },
      { go: e },
      ...r1.map((go) => ({ go })),
      ...r2.map((go) => ({ go })),
      { go: goal },
   );
   return b.d;
}

/** Level 4's orbs on the honest route (the crypt swim, the pockets, the climb). */
const FLOOD_ORBS: readonly [number, number, number][] = [
   [0, 2.6, -5],
   [0, 1.6, -11],
   [0, 1.99, -15.91],
   [0, 1.6, -20],
   [0, 1.6, -24],
   [0, 1.99, -27.91],
   [0, 1.6, -32],
   [0, 1.6, -36],
   [0, 2.6, -43],
   [0, 6.5, -47],
   [0, 8.5, -52],
   [5, 10.5, -53.5],
   [9.16, 13.43, -57.71],
   [3.97, 16.7, -59.46],
   [-0.55, 17.95, -59.5],
   [-4.62, 20.5, -63.87],
];

// ---------- Level 5: Final Escape (the boss, Umbra Roller) ----------
// Phase 1, the chase: Umbra Roller rolls down the steps from the top of the shaft into the ring
// basin. Flood the basin from the lever on the last step: it floats, loses its grip, and you land on
// its back. Phase 2, the drains: it curls in the arena's drain; pull the three pressure levers inside
// 5 s of each other and the geyser throws it up, then hit it in the air. Phase 3, the storm tide
// (0.8 m/s): it chases you up the switchbacks to the floodgate; pull the floodgate lever while it
// sits on the gate. The Tide Bell rings only once it is beaten.
function finalEscape(): CourseDraft {
   const b = new RuinBuilder();
   b.block("start", -3, 3, -3, 3, 9, -10);
   const d1 = b.ledge(0, -6.5, 7.2, 5, 4);
   const d2 = b.ledge(4.5, -11, 5.4, 5, 4);
   const d3 = b.ledge(4.5, -16, 3.6, 5, 4);
   // the ring basin
   b.block("floor", -4, 1.5, -23, -15, -1, -10);
   b.block("wall", -6, -4, -25, -13, 2.6, -10);
   b.block("wall", -4, 2, -15, -13, 2.6, -10);
   b.block("wall", 1.5, 2, -23, -15, 2.6, -10);
   // the rim between the basin and the arena is the arena's checkpoint
   const rim = b.block("checkpoint", -4, 2, -25, -23, 2.6, -10);
   const zR = b.zone(-4, 1.5, -23, -15, -1, [-1, 2.2], 0);
   const ring = b.lever(5.5, 3.6, -16.8, [[[zR, 0]], [[zR, 1]]]);
   // the drain arena
   const arena = b.block("floor", -6, 6, -36, -25, -1, -10);
   b.block("wall", -8.5, -6, -36, -25, 6, -10);
   b.block("wall", 6, 8.5, -36, -25, 6, -10);
   const pa = b.lever(-4.2, -1, -27.6, [[], []], "pressure", 5000);
   const pb = b.lever(4.2, -1, -27.6, [[], []], "pressure", 5000);
   const pc = b.lever(0, -1, -34.2, [[], []], "pressure", 5000);
   // the switchbacks, the floodgate, the lever over it, the Tide Bell
   const r1 = [b.ledge(0, -39.5, 0.8), b.ledge(4.5, -39.5, 2.6), b.ledge(9, -39.5, 4.4)];
   const r2 = [b.ledge(9, -45.5, 6.2), b.ledge(4.5, -45.5, 8.0), b.ledge(0, -45.5, 9.8), b.ledge(-4.5, -45.5, 11.6)];
   const gate = b.ledge(-4.5, -51.5, 13.4, 4, 4);
   const fl = b.ledge(1, -51.5, 15.2, 4, 4, "checkpoint");
   const gl = b.lever(1.6, 15.2, -51.0, [[], []], "gate");
   const goal = b.ledge(1, -57.5, 17.0, 6, 5, "goal");
   // Vexa's niche beside the bell
   b.block("wall", 4.0, 4.6, -60, -57, 22, 17.0, { ghost: true });
   b.block("floor", 4.6, 6.4, -60, -57, 17.0, 14);
   b.block("wall", 6.4, 7.0, -60, -57, 22, 14);
   b.d.boss = {
      rollPath: [
         [3.5, 10.5, -2],
         [0, 7.2, -6.5],
         [4.5, 5.4, -11],
         [-0.5, -1, -18.5],
      ],
      ring: zR,
      ringLevel: 2.0,
      drain: [0, -1, -30.5],
      geyserTop: 1.4,
      pressure: [pa, pb, pc],
      chasePath: [
         [0, -1, -30.5],
         [0, 0.8, -39.5],
         [9, 4.4, -39.5],
         [9, 6.2, -45.5],
         [-4.5, 11.6, -45.5],
         [-4.5, 13.4, -51.5],
      ],
      gateLever: gl,
   };
   for (const [x, y, z] of FINAL_ORBS) b.orb(x, y, z);
   for (const x of [-3, -1.25, 0.5]) b.orb(x, -0.3, -20.5, true, zR);
   b.secret("sunken", -2.5, -0.3, -17, zR);
   b.secret("ghost-niche", 5.5, 17.7, -58.5);
   b.route(
      { go: d1 },
      { go: d2 },
      { go: d3 },
      { lever: ring, pos: 1 },
      { walk: [2.7, -17.4] },
      { boss: "stomp" },
      { go: rim },
      { go: arena },
      { boss: "p2-wait" },
      { lever: pa, pos: 1 },
      { lever: pb, pos: 1 },
      { lever: pc, pos: 1 },
      { boss: "geyser" },
      ...r1.map((go) => ({ go })),
      ...r2.map((go) => ({ go })),
      { go: gate },
      { go: fl },
      { boss: "gate" },
      { go: goal },
   );
   return b.d;
}

/** Level 5's orbs on the honest route. */
const FINAL_ORBS: readonly [number, number, number][] = [
   [0, 9.6, -3.8], [2.2, 7.8, -8.8], [4.5, 6, -13.5], [-1, 3.0, -21], [-1, 3.6, -24], [0, 0.0, -27], [-3, 0, -29], [3, 0, -29],
   [0, 1.6, -37.5], [4.5, 3.4, -39.5], [9, 5.2, -42.5], [4.5, 8.8, -45.5], [0, 10.6, -45.5], [-4.5, 12.4, -48.5], [-1.5, 15.8, -51.5], [1, 17.8, -54.5],
];

const BUILDERS: Record<LevelId, () => CourseDraft> = {
   1: drainEntry,
   2: pipeMaze,
   3: valveShaft,
   4: floodRise,
   5: finalEscape,
};

export function buildRuins(level: LevelId): CourseDraft {
   return BUILDERS[level]();
}
