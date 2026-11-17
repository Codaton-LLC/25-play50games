// Portal Hop's courses: pure geometry (no three.js, React or DOM). Each level is a set of floating
// islands (walkable discs), portal pairs and the honest bot's route.
//
// A pair is one fixed ENTRY (a wall frame you run into, or a floor pad you fall into) and 1-4 ANCHOR
// obelisks; the EXIT opens in front of the selected anchor (one at a time, 0.4 s to move). Whatever
// speed goes in comes out along the exit's facing (yaw round y, pitch up from the horizon).
//
// World axes: x right, y up, z towards the camera's start; courses run towards -z. A yaw a faces
// (sin a, 0, cos a): 0 = +z (back towards the start), PI = -z (onwards).
import type { LevelId } from "../../types";
import type { HeroId } from "./heroes";
import { LEVELS, type PortalLevel } from "./levels";

export const TAU = Math.PI * 2;
const PI = Math.PI;
const DEG = PI / 180;

/** the exit frame stands this far in front of its obelisk, its centre this high over the obelisk's foot */
export const EXIT_OUT = 1.4;
export const EXIT_UP = 1.1;
/** a wall frame's opening: half width, half height round its centre (EXIT_UP over the foot) */
export const FRAME_HALF_W = 0.95;
export const FRAME_HALF_H = 1.1;

export interface Island {
   id: number;
   x: number;
   z: number;
   /** the walkable top */
   y: number;
   r: number;
   look: "isle" | "plateau" | "pillar" | "goal" | "ledge";
   /** a bridge disc that is only there once its pressure plate has been pressed (L4) */
   gate: number;
}

export interface Entry {
   pair: number;
   kind: "wall" | "floor";
   /** wall: the frame's foot (its opening is EXIT_UP over it); floor: the pad's centre */
   x: number;
   y: number;
   z: number;
   /** wall: the way its front faces (you run into it against this) */
   yaw: number;
   /** floor: the pad's radius */
   r: number;
}

export interface Anchor {
   id: number;
   pair: number;
   /** the obelisk's foot (an orbiting anchor: its position at ms 0) */
   x: number;
   y: number;
   z: number;
   yaw: number;
   pitch: number;
   /** L3: rides round (cx, cz) at radius r, facing outwards; its angle at ms 0 is a0 */
   orbit: { cx: number; cz: number; r: number; a0: number } | null;
   /** a secret anchor: selectable only while the hero stands within r of (x, z) on this island top */
   hidden: { x: number; z: number; y: number; r: number } | null;
   /** L5: the beacon spike this exit faces (the Wyrm bonks it), -1 for none */
   beacon: number;
   /** L5: this exit faces the other pair's entry (both pairs on loop anchors tie the Wyrm in a knot) */
   loop: boolean;
}

export interface Pair {
   id: number;
   entry: Entry;
   /** anchor ids */
   anchors: number[];
   /** the anchor index selected at the start (often a false lead: the player has to choose) */
   start: number;
}

export interface Orb {
   x: number;
   y: number;
   z: number;
   /** "" = anyone; a hero id = that hero's role reaches it (README "Heroes") */
   gate: "" | HeroId;
}

export interface Block {
   x: number;
   y: number;
   z: number;
}

export interface Plate {
   x: number;
   y: number;
   z: number;
   r: number;
   /** the bridge gate it opens */
   gate: number;
}

export interface Beacon {
   x: number;
   y: number;
   z: number;
}

/** The honest bot's route (bot.ts): commands it runs in order. */
export type Cmd =
   | { t: "go"; x: number; z: number; tol?: number }
   | { t: "pick"; anchor: number }
   | { t: "push"; dx: number; dz: number; until: "teleport" | "land" | "block" | "ms"; ms?: number }
   | { t: "jump"; dx: number; dz: number; run?: boolean }
   | { t: "fly" }
   | { t: "wait"; ms: number }
   | { t: "power" }
   | { t: "timing"; anchor: number; yaw: number; tol: number; edgeX: number; edgeZ: number; drop: number }
   | { t: "boss"; until: "vulnerable" | "phase"; phase?: number }
   | { t: "loop"; to: number; whileBoss: number };

export interface Course {
   level: LevelId;
   cfg: PortalLevel;
   islands: Island[];
   pairs: Pair[];
   anchors: Anchor[];
   orbs: Orb[];
   /** the first mainOrbs orbs are the star's orbs, reachable by every hero */
   mainOrbs: number;
   blocks: Block[];
   plates: Plate[];
   beacons: Beacon[];
   start: { x: number; y: number; z: number };
   /** the goal ring (levels 1-4): reach it to finish */
   goal: { x: number; y: number; z: number; r: number } | null;
   /** Vexa's colour shard behind a wall frame (only a phasing hero picks it up) */
   shard: { x: number; y: number; z: number } | null;
   /** under this the hero has fallen into the void */
   voidY: number;
   route: Cmd[];
}

// ---------- builders ----------

interface Draft {
   islands: Island[];
   pairs: Pair[];
   anchors: Anchor[];
}

function isle(d: Draft, x: number, y: number, z: number, r: number, look: Island["look"] = "isle", gate = -1): number {
   const id = d.islands.length;
   d.islands.push({ id, x, z, y, r, look, gate });
   return id;
}

function pair(d: Draft, entry: Omit<Entry, "pair" | "r"> & { r?: number }, start = 0): number {
   const id = d.pairs.length;
   d.pairs.push({ id, entry: { ...entry, pair: id, r: entry.r ?? 0 }, anchors: [], start });
   return id;
}

function anchor(d: Draft, p: number, x: number, y: number, z: number, yaw: number, pitchDeg = 0, extra: Partial<Anchor> = {}): number {
   const id = d.anchors.length;
   d.anchors.push({ id, pair: p, x, y, z, yaw, pitch: pitchDeg * DEG, orbit: null, hidden: null, beacon: -1, loop: false, ...extra });
   d.pairs[p].anchors.push(id);
   return id;
}

/** The yaw that faces from (x0, z0) towards (x1, z1). */
export function yawTo(x0: number, z0: number, x1: number, z1: number): number {
   return Math.atan2(x1 - x0, z1 - z0);
}

// ---------- level 1: Two Portals (three beats) ----------

function level1(): Course {
   const d: Draft = { islands: [], pairs: [], anchors: [] };
   isle(d, 0, 0, 0, 4); // 0 start
   isle(d, 0, 0, -20, 4.5); // 1
   isle(d, -7, 3, -33, 3, "plateau"); // 2 the orb plateau
   isle(d, 3, 0, -34, 4.5); // 3
   isle(d, 3, 8, -44, 3.5, "plateau"); // 4 the cliff
   isle(d, 3, 0, -58.2, 1.6, "pillar"); // 5 the launcher pillar
   isle(d, 3, 0, -76, 6, "goal"); // 6
   isle(d, 0, 0, -7.3, 1.4, "ledge"); // 7 Vexa's ledge behind the first frame
   // beat 1: walk in, pop out on the next island
   const p0 = pair(d, { kind: "wall", x: 0, y: 0, z: -3.85, yaw: 0 });
   anchor(d, p0, 0, 0, -16.2, PI);
   // beat 2: two anchors, one leads to the orb plateau
   const p1 = pair(d, { kind: "wall", x: 0, y: 0, z: -24.35, yaw: 0 }, 1);
   const plateau = anchor(d, p1, -7, 3, -30.4, PI);
   anchor(d, p1, 3, 0, -30, PI);
   // beat 3a: up onto the cliff
   const p2 = pair(d, { kind: "wall", x: 3, y: 0, z: -38.35, yaw: 0 });
   anchor(d, p2, 3, 8, -41, PI);
   // beat 3b: fall off the cliff into the floor pad, fling out of the pillar's exit across the gap
   const p3 = pair(d, { kind: "floor", x: 3, y: 0, z: -51.2, yaw: 0, r: 3.3 });
   anchor(d, p3, 3, 0, -58.2, PI, 30);
   const orbs: Orb[] = [
      { x: 0, y: 0.8, z: -19, gate: "" },
      { x: -7, y: 3.8, z: -34, gate: "" },
      { x: 5, y: 0.8, z: -36, gate: "" },
      { x: 3, y: 8.8, z: -45, gate: "" },
      { x: 1, y: 0.8, z: -77.5, gate: "" },
      { x: 3, y: 8 + 3.3, z: -44.5, gate: "nami" },
      { x: 8.8, y: 2.5, z: -20, gate: "zuno" },
      { x: -2.5, y: 0.8, z: -21, gate: "riko" },
   ];
   const route: Cmd[] = [
      { t: "push", dx: 0, dz: -1, until: "teleport" },
      { t: "go", x: 0, z: -19 },
      { t: "pick", anchor: plateau },
      { t: "push", dx: 0, dz: -1, until: "teleport" },
      { t: "go", x: -7, z: -34 },
      { t: "push", dx: 1, dz: 0, until: "land" },
      { t: "go", x: 5, z: -36 },
      { t: "go", x: 3, z: -35.5 },
      { t: "push", dx: 0, dz: -1, until: "teleport" },
      { t: "go", x: 3, z: -45 },
      { t: "push", dx: 0, dz: -1, until: "teleport" },
      { t: "fly" },
      { t: "go", x: 1, z: -77.5 },
      { t: "go", x: 6, z: -79, tol: 0.3 },
   ];
   return finish(1, d, orbs, route, { start: { x: 0, y: 0, z: 2.5 }, goal: { x: 6, y: 0, z: -79, r: 1.6 }, shard: { x: 0, y: 1.1, z: -4.6 } });
}

// ---------- level 2: Two Pairs (the speed stacks) ----------

function level2(): Course {
   const d: Draft = { islands: [], pairs: [], anchors: [] };
   isle(d, 0, 10, 0, 5, "plateau"); // 0 start plateau
   isle(d, 0, 18, -26, 1.6, "pillar"); // 1 the drop tower
   isle(d, -14, 0, -22, 6); // 2 the orb island
   isle(d, 0, 2, -48, 1.6, "pillar"); // 3 the launcher
   isle(d, 0, 0, -79, 6.5, "goal"); // 4
   isle(d, 15, 0, -66, 3); // 5 the hidden anchor's islet
   isle(d, 9.5, 0, -71, 1.8, "ledge"); // 6 a step from the islet to the goal
   // pair A: the floor pad under the start plateau
   const pa = pair(d, { kind: "floor", x: 0, y: 0, z: -8.7, yaw: 0, r: 3.3 }, 1);
   const drop = anchor(d, pa, 0, 18, -26, PI, -60);
   anchor(d, pa, -3.5, 10, -1, 0); // the false lead: back onto the plateau
   const orbRoute = anchor(d, pa, -14, 0, -15.2, PI);
   // pair B: the pad the drop falls into; its launcher flings you on to the goal
   const pb = pair(d, { kind: "floor", x: 0, y: 0, z: -35, yaw: 0, r: 3 }, 1);
   const launch = anchor(d, pb, 0, 2, -48, PI, 33);
   anchor(d, pb, 0, 2, -48, yawTo(0, -48, -14, -22), 30); // the false lead: back to the orb island
   anchor(d, pb, 0, 2, -48, yawTo(0, -48, 15, -66), 27, { hidden: { x: 3.6, z: 3.2, y: 10, r: 1.4 } });
   // the orb island's way back: a wall frame onto the plateau
   const pc = pair(d, { kind: "wall", x: -14, y: 0, z: -27.8, yaw: 0 });
   anchor(d, pc, 3, 10, -1.5, 0);
   const orbs: Orb[] = [
      { x: 0, y: 10.8, z: -3, gate: "" },
      { x: -14, y: 0.8, z: -21, gate: "" },
      { x: -11, y: 0.8, z: -25, gate: "" },
      { x: -2, y: 0.8, z: -79, gate: "" },
      { x: 0, y: 0.8, z: -83, gate: "" },
      { x: 0, y: 3.3, z: -81, gate: "nami" },
      { x: -21.5, y: 1.5, z: -22, gate: "zuno" },
      { x: -2.5, y: 10.8, z: 2.5, gate: "kiro" },
   ];
   const route: Cmd[] = [
      { t: "go", x: 0, z: -3 },
      { t: "pick", anchor: orbRoute },
      { t: "push", dx: 0, dz: -1, until: "teleport" },
      { t: "fly" },
      { t: "go", x: -14, z: -21 },
      { t: "go", x: -11, z: -25 },
      { t: "go", x: -14, z: -26 },
      { t: "push", dx: 0, dz: -1, until: "teleport" },
      { t: "go", x: 1, z: -3.2 },
      { t: "pick", anchor: drop },
      { t: "pick", anchor: launch },
      { t: "push", dx: 0, dz: -1, until: "teleport" },
      { t: "fly" },
      { t: "fly" },
      { t: "go", x: -2, z: -79 },
      { t: "go", x: 0, z: -83 },
      { t: "go", x: 4, z: -83, tol: 0.3 },
   ];
   return finish(2, d, orbs, route, { start: { x: 0, y: 10, z: 2.5 }, goal: { x: 4, y: 0, z: -83, r: 1.6 }, shard: { x: -14, y: 1.1, z: -28.6 } });
}

// ---------- level 3: Moving Portals ----------

/** L3's tower: three anchors ride round it, facing outwards. */
export const L3_TOWER = { x: 0, y: 4, z: -30, r: 2.2 } as const;

function level3(): Course {
   const d: Draft = { islands: [], pairs: [], anchors: [] };
   isle(d, 0, 10, 0, 5, "plateau"); // 0 start plateau
   isle(d, L3_TOWER.x, L3_TOWER.y, L3_TOWER.z, 3, "pillar"); // 1 the turning tower
   isle(d, 0, 0, -57, 6.5, "goal"); // 2 south
   isle(d, -30, 0, -33, 6.5); // 3 west: the orb island
   isle(d, 27, 0, -30, 4); // 4 east: Riko's crystal
   const pa = pair(d, { kind: "floor", x: 0, y: 0, z: -8.7, yaw: 0, r: 3.3 });
   const ids: number[] = [];
   for (let k = 0; k < 3; k++) {
      const a0 = (k * TAU) / 3;
      ids.push(anchor(d, pa, L3_TOWER.x + L3_TOWER.r * Math.sin(a0), L3_TOWER.y, L3_TOWER.z + L3_TOWER.r * Math.cos(a0), a0, 28, { orbit: { cx: L3_TOWER.x, cz: L3_TOWER.z, r: L3_TOWER.r, a0 } }));
   }
   // the side islands' way back: a wall frame each, onto the plateau
   const pw = pair(d, { kind: "wall", x: -30, y: 0, z: -39.35, yaw: 0 });
   anchor(d, pw, 2.5, 10, -1.5, 0);
   const pe = pair(d, { kind: "wall", x: 27, y: 0, z: -33.8, yaw: 0 });
   anchor(d, pe, -2.5, 10, -1.5, 0);
   const orbs: Orb[] = [
      { x: 0, y: 10.8, z: -3, gate: "" },
      { x: -31, y: 0.8, z: -31, gate: "" },
      { x: -28, y: 0.8, z: -36, gate: "" },
      { x: 0, y: 0.8, z: -54, gate: "" },
      { x: 2, y: 0.8, z: -58, gate: "" },
      { x: -30, y: 3.3, z: -33, gate: "nami" },
      { x: 4, y: 0.8, z: -61, gate: "kiro" },
      { x: 27, y: 0.8, z: -30, gate: "riko" },
   ];
   const west = -PI / 2;
   const route: Cmd[] = [
      { t: "go", x: 0, z: -3 },
      { t: "pick", anchor: ids[0] },
      { t: "timing", anchor: ids[0], yaw: west, tol: 0.12, edgeX: 0, edgeZ: -5.4, drop: 10 },
      { t: "push", dx: 0, dz: -1, until: "teleport" },
      { t: "fly" },
      { t: "go", x: -31, z: -31 },
      { t: "go", x: -28, z: -36 },
      { t: "go", x: -30, z: -37.6 },
      { t: "push", dx: 0, dz: -1, until: "teleport" },
      { t: "go", x: 0, z: -3 },
      { t: "timing", anchor: ids[0], yaw: PI, tol: 0.12, edgeX: 0, edgeZ: -5.4, drop: 10 },
      { t: "push", dx: 0, dz: -1, until: "teleport" },
      { t: "fly" },
      { t: "go", x: 0, z: -54 },
      { t: "go", x: 2, z: -58 },
      { t: "go", x: 0, z: -60, tol: 0.3 },
   ];
   return finish(3, d, orbs, route, { start: { x: 0, y: 10, z: 2.5 }, goal: { x: 0, y: 0, z: -60, r: 1.6 }, shard: { x: -30, y: 1.1, z: -40.1 } });
}

// ---------- level 4: Cargo ----------

function level4(): Course {
   const d: Draft = { islands: [], pairs: [], anchors: [] };
   isle(d, 0, 0, 0, 6); // 0 start
   isle(d, 0, 0, -22, 3.5); // 1 the plate island
   isle(d, -14, 0, -12, 3.5); // 2 the orb islet
   // 3-5 the bridge east: there only once the plate is pressed
   isle(d, 7.6, 0, 0, 2, "ledge", 0);
   isle(d, 11.2, 0, 0, 2, "ledge", 0);
   isle(d, 14.8, 0, 0, 2, "ledge", 0);
   isle(d, 20, 0, 0, 4.5); // 6 the second stage
   isle(d, 20, 0, -13, 3.6); // 7 the foot of the ledge
   isle(d, 20, 2.4, -21, 4.4, "goal"); // 8 the ledge: the goal on top
   // stage 1: push the crystal through the frame onto the plate
   const pa = pair(d, { kind: "wall", x: 0, y: 0, z: -5.85, yaw: 0 }, 1);
   const toPlate = anchor(d, pa, 0, 0, -19.4, PI);
   anchor(d, pa, 2, 0, -22, PI / 2); // the false lead: east off the plate island
   const toOrbs = anchor(d, pa, -14, 0, -9, PI);
   // the orb islet's way back
   const pq = pair(d, { kind: "wall", x: -14, y: 0, z: -15.35, yaw: 0 });
   anchor(d, pq, -3, 0, 1.5, 0);
   // stage 2: push the second crystal through to the ledge's foot and climb it
   const pb = pair(d, { kind: "wall", x: 20, y: 0, z: -4.35, yaw: 0 }, 1);
   const toFoot = anchor(d, pb, 20, 0, -9.9, PI);
   anchor(d, pb, 22, 0, -13, PI / 2); // the false lead: off the side
   anchor(d, pb, 17, 0, 2.5, 0); // the false lead: back to where you stand
   const orbs: Orb[] = [
      { x: 3, y: 0.8, z: -1, gate: "" },
      { x: -14, y: 0.8, z: -11, gate: "" },
      { x: -12, y: 0.8, z: -13, gate: "" },
      { x: 22, y: 0.8, z: 1.5, gate: "" },
      { x: 18, y: 3.2, z: -22, gate: "" },
      { x: 5, y: 1, z: -22, gate: "zuno" },
      { x: 16.5, y: 0.8, z: 2, gate: "kiro" },
      { x: 20, y: 2.4 + 3.3, z: -20, gate: "nami" },
   ];
   const route: Cmd[] = [
      { t: "pick", anchor: toPlate },
      { t: "go", x: 0, z: -0.6, tol: 0.15 },
      { t: "push", dx: 0, dz: -1, until: "block" },
      { t: "go", x: 3, z: -1 },
      { t: "pick", anchor: toOrbs },
      { t: "go", x: 0.4, z: -3.6, tol: 0.2 },
      { t: "push", dx: 0, dz: -1, until: "teleport" },
      { t: "go", x: -14, z: -11 },
      { t: "go", x: -12, z: -13 },
      { t: "go", x: -14, z: -14 },
      { t: "push", dx: 0, dz: -1, until: "teleport" },
      { t: "go", x: 5, z: 0 },
      { t: "go", x: 15, z: 0 },
      { t: "go", x: 22, z: 1.5 },
      { t: "pick", anchor: toFoot },
      { t: "go", x: 20, z: 1.6, tol: 0.15 },
      { t: "push", dx: 0, dz: -1, until: "block" },
      { t: "push", dx: 0, dz: -1, until: "teleport" },
      { t: "push", dx: 0, dz: -1, until: "ms", ms: 1800 },
      { t: "go", x: 20, z: -11.6, tol: 0.2 },
      { t: "jump", dx: 0, dz: -1, run: true },
      { t: "jump", dx: 0, dz: -1 },
      { t: "go", x: 18, z: -22 },
      { t: "go", x: 20, z: -23, tol: 0.3 },
   ];
   return finish(4, d, orbs, route, {
      start: { x: 0, y: 0, z: 3 },
      goal: { x: 20, y: 2.4, z: -23, r: 1.6 },
      shard: { x: -14, y: 1.1, z: -16.1 },
      blocks: [
         { x: 0, y: 0, z: -2.6 },
         { x: 20, y: 0, z: -1.4 },
      ],
      plates: [{ x: 0, y: 0, z: -22, r: 1.5, gate: 0 }],
   });
}

// ---------- level 5: Portal Master (the Portal Wyrm) ----------

/** L5's centre island: the Wyrm coils round it; its back crystal (phase 2) rests over the middle. */
export const L5_CENTRE = { x: 0, y: 0, z: 0, r: 7 } as const;

function level5(): Course {
   const d: Draft = { islands: [], pairs: [], anchors: [] };
   isle(d, 0, 0, 0, L5_CENTRE.r); // 0 the centre
   isle(d, -24, 0, 0, 5); // 1 west: pair A's anchors and the beacon spikes
   isle(d, 24, 10, 0, 4.5, "plateau"); // 2 east: the high plateau
   isle(d, 13, 0, 13, 1.6, "pillar"); // 3 the fling pillar
   // pair A: the west frame on the centre; the Wyrm swims through it (phase 1 and 3)
   const pa = pair(d, { kind: "wall", x: -6.85, y: 0, z: 0, yaw: PI / 2 }, 3);
   anchor(d, pa, -24, 0, -3.6, PI, 0, { beacon: 0 });
   anchor(d, pa, -27.6, 0, 0, -PI / 2, 0, { beacon: 1 });
   anchor(d, pa, -24, 0, 3.6, 0, 0, { beacon: 2 });
   const aLoop = anchor(d, pa, -20.4, 0, 0, PI / 2, 0, { loop: true });
   // pair B: the east frame on the centre: up onto the plateau (phase 2), or the loop (phase 3)
   const pb = pair(d, { kind: "wall", x: 6.85, y: 0, z: 0, yaw: -PI / 2 });
   const plateau = anchor(d, pb, 21, 10, 0, PI / 2);
   const bLoop = anchor(d, pb, 24, 10, -3.3, -PI / 2, 0, { loop: true });
   // pair C: the pad under the plateau's south edge; the pillar flings you onto the Wyrm's back
   const pc = pair(d, { kind: "floor", x: 24, y: 0, z: 8.2, yaw: 0, r: 3.3 });
   const fling = anchor(d, pc, 13, 0, 13, yawTo(13, 13, 0, 0), 22);
   const orbs: Orb[] = [
      { x: 3, y: 0.8, z: 3, gate: "" },
      { x: -3, y: 0.8, z: -3, gate: "" },
      { x: 24, y: 10.8, z: 2, gate: "" },
      { x: 26, y: 10.8, z: -1, gate: "" },
      { x: 0, y: 0.8, z: 3.5, gate: "" },
      { x: 24, y: 10 + 3.3, z: 0, gate: "nami" },
      { x: -4, y: 0.8, z: 4, gate: "kiro" },
   ];
   const route: Cmd[] = [
      { t: "go", x: 3, z: 3 },
      { t: "go", x: -3, z: -3 },
      { t: "go", x: 0, z: 3.5 },
      // phase 1: a beacon anchor before each dive (the bot picks the first intact one: bot.ts)
      { t: "boss", until: "phase", phase: 1 },
      // phase 2: up the plateau, off its edge into the pad, flung onto the Wyrm's back; twice
      { t: "boss", until: "vulnerable" },
      { t: "pick", anchor: plateau },
      { t: "go", x: 5.4, z: 0, tol: 0.2 },
      { t: "push", dx: 1, dz: 0, until: "teleport" },
      { t: "go", x: 24, z: 2 },
      { t: "go", x: 26, z: -1 },
      { t: "go", x: 24, z: 3.5 },
      { t: "pick", anchor: fling },
      { t: "push", dx: 0, dz: 1, until: "teleport" },
      { t: "fly" },
      { t: "loop", to: 4, whileBoss: 1 },
      // phase 3: both pairs on their loop anchors, then the knotted head
      { t: "pick", anchor: aLoop },
      { t: "pick", anchor: bLoop },
      { t: "boss", until: "phase", phase: 3 },
   ];
   return finish(5, d, orbs, route, {
      start: { x: 0, y: 0, z: 4 },
      goal: null,
      shard: { x: 7.6, y: 1.1, z: 0 },
      beacons: [
         { x: -24, y: 0, z: -9.5 },
         { x: -33.5, y: 0, z: 0 },
         { x: -24, y: 0, z: 9.5 },
      ],
   });
}

function finish(
   level: LevelId,
   d: Draft,
   orbs: Orb[],
   route: Cmd[],
   extra: { start: Course["start"]; goal: Course["goal"]; shard: Course["shard"]; blocks?: Block[]; plates?: Plate[]; beacons?: Beacon[] },
): Course {
   let low = Infinity;
   for (const i of d.islands) low = Math.min(low, i.y);
   for (const p of d.pairs) if (p.entry.kind === "floor") low = Math.min(low, p.entry.y);
   return {
      level,
      cfg: LEVELS[level],
      islands: d.islands,
      pairs: d.pairs,
      anchors: d.anchors,
      orbs,
      mainOrbs: 5,
      blocks: extra.blocks ?? [],
      plates: extra.plates ?? [],
      beacons: extra.beacons ?? [],
      start: extra.start,
      goal: extra.goal,
      shard: extra.shard,
      voidY: low - 14,
      route,
   };
}

const BUILDERS: Record<LevelId, () => Course> = { 1: level1, 2: level2, 3: level3, 4: level4, 5: level5 };
const CACHE = new Map<LevelId, Course>();

/** The level's course (built once; treat it as read-only). */
export function courseFor(level: LevelId): Course {
   let c = CACHE.get(level);
   if (!c) {
      c = BUILDERS[level]();
      CACHE.set(level, c);
   }
   return c;
}

// ---------- geometry reads ----------

export interface ExitPose {
   /** the exit opening's centre */
   x: number;
   y: number;
   z: number;
   /** the unit direction out */
   dx: number;
   dy: number;
   dz: number;
   /** the obelisk's foot now and its facing */
   ax: number;
   az: number;
   yaw: number;
}

/** An anchor's yaw at play time ms (an orbiting one turns with the level's orbit speed). */
export function anchorYaw(c: Course, a: Anchor, ms: number): number {
   return a.orbit ? a.orbit.a0 + c.cfg.orbit * (ms / 1000) : a.yaw;
}

/** Where an anchor's exit opens at play time ms, and which way it faces. */
export function exitPose(c: Course, a: Anchor, ms: number, out: ExitPose): ExitPose {
   const yaw = anchorYaw(c, a, ms);
   let ax = a.x;
   let az = a.z;
   if (a.orbit) {
      ax = a.orbit.cx + a.orbit.r * Math.sin(yaw);
      az = a.orbit.cz + a.orbit.r * Math.cos(yaw);
   }
   const sy = Math.sin(yaw);
   const cy = Math.cos(yaw);
   out.ax = ax;
   out.az = az;
   out.yaw = yaw;
   out.x = ax + sy * EXIT_OUT;
   out.y = a.y + EXIT_UP;
   out.z = az + cy * EXIT_OUT;
   out.dx = sy * Math.cos(a.pitch);
   out.dy = Math.sin(a.pitch);
   out.dz = cy * Math.cos(a.pitch);
   return out;
}

/** Is the island there (a gated bridge only once its gate is open)? */
export function islandOn(i: Island, gates: readonly boolean[]): boolean {
   return i.gate < 0 || gates[i.gate] === true;
}

/** Is (x, z) inside a floor pad's opening (no ground there)? */
export function overPad(c: Course, x: number, z: number, y: number): boolean {
   for (const p of c.pairs) {
      const e = p.entry;
      if (e.kind === "floor" && Math.abs(e.y - y) < 0.01 && Math.hypot(x - e.x, z - e.z) < e.r) return true;
   }
   return false;
}

export function wrapPi(a: number): number {
   let v = a % TAU;
   if (v > PI) v -= TAU;
   if (v < -PI) v += TAU;
   return v;
}
