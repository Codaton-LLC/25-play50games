// The five shows (the design card's levels). Each level is one big top with its own layout; the
// cannons stand on code-built stands and Hyper3D isles (Course.tsx). Every level carries all five
// hero lines (bonus orbs, never required): Riko's cracked board and hidden cannon, Nami's high
// trapeze orbs over the reach of any plain shot, Kiro's orbs inside a smoke column, Zuno's orb trail
// hidden in the canvas, Vexa's flat line through a ghost pole that everyone else must lob over.
// The `route` is the honest bot's (bot.ts); the proof (bound.ts) never reads it.
import type { LevelId } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { DEG, buildShow, yawTowards, type Course, type ShowBuilder, type ShowFn } from "./show";

const G = 20;
const V_MIN = 12;
const V_MAX = 22;

/**
 * The locked yaw and power of an auto / fixed cannon whose shot passes through (x1, y1, z1) at
 * `pitch` (the continuous arc; the 1 ms steps sink it about a centimetre). Throws when out of range.
 */
export function solveShot(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, pitch: number): { yaw: number; power: number } {
   const d = Math.hypot(x1 - x0, z1 - z0);
   const dy = y1 - y0;
   const c = Math.cos(pitch);
   const den = 2 * c * c * (d * Math.tan(pitch) - dy);
   if (!(den > 0)) throw new Error("roll-cannon-jump solveShot: unreachable at this pitch");
   const v = Math.sqrt((G * d * d) / den);
   const power = 0.6 + (0.4 * (v - V_MIN)) / (V_MAX - V_MIN);
   if (power < 0.6 || power > 1) throw new Error(`roll-cannon-jump solveShot: power ${power.toFixed(3)} out of range`);
   return { yaw: yawTowards(x0, z0, x1, z1), power };
}

/** A mouth sits 1.2 m over the top it stands on. */
const MOUTH = 1.2;

// ---------- L1 Short Launch: three beats, full arc preview ----------
function l1(b: ShowBuilder): void {
   // beat 1: a fixed cannon pointing at a wide platform: just press fire
   const c0 = b.cannon(0, 6, 0, { kind: "fixed", yaw: 0, pitch: 45 * DEG, power: 0.64 });
   const p1 = b.platform(0, 4.8, -10.5, 3, 4);
   b.orb(-1.4, 5.3, -9.5);
   b.orb(1.4, 5.3, -11.5);
   const c1 = b.cannon(0, 4.8 + MOUTH, -13.8, { at: [3.2, -21.5] });
   // beat 2: aim at a cannon 8 m away
   const c2 = b.cannon(3.2, 7, -21.5, { at: [1.5, -27.5] });
   b.orb(1.6, 8.6, -17.6);
   // beat 3: a short shot, a long shot, a trampoline catch, the finish ring
   const c3 = b.cannon(1.5, 7, -27.5, { at: [-3, -45] });
   b.orb(2.4, 8.2, -24.6);
   const c4 = b.cannon(-3, 8.5, -45, { at: [-3, -53.5] });
   b.orb(-0.7, 11.2, -36.2);
   b.hoop(0.2, 10.4, -33.5, yawTowards(1.5, -27.5, -3, -45));
   const t1 = b.tramp(-3, 4.6, -53.5, 1.4);
   b.orb(-3, 8.2, -49.4);
   const c5 = b.cannon(-3, 9.4, -55.8, { at: [0, -66] });
   b.orb(-3, 7.6, -54.4);
   b.finish(0, 9.8, -66, yawTowards(-3, -55.8, 0, -66));
   b.orb(-1.5, 10.8, -61);
   // Riko: a cracked target board right of the long shot hides a cannon with a bonus line
   const board = b.board(7, 8.4, -33.2, 1.3, 1.3, 0.18);
   b.cannon(7, 8.4, -34.6, { board, at: [-3, -45] });
   b.orbLine([6.5, 10.5, -36.5], [-1.5, 11.5, -43], 3, { hero: "riko" });
   // Nami: the high trapeze over the long shot (out of any plain shot's reach)
   b.wall(1.5, 5.5, 17.6, 17.8, -37.6, -37.4, "trapeze");
   b.orb(3.5, 18.6, -36.6, { hero: "nami" });
   b.orb(2, 18.8, -38.4, { hero: "nami" });
   // Kiro: two orbs inside a steady smoke column left of beat 2
   b.jet(-4.5, -21, 3, 13, 2400, 1);
   b.orb(-4.5, 8.4, -21, { hero: "kiro" });
   b.orb(-4.5, 10.2, -21, { hero: "kiro" });
   // Zuno: an orb trail hidden in the canvas along the trampoline drop
   b.orbLine([-6.6, 9.4, -46], [-6.4, 8.4, -52], 3, { hero: "zuno", hidden: true });
   // Vexa: a ghost pole on the flat line to the finish (everyone else lobs over it)
   b.pole(-1.5, -60.9, 0, 10.4, true);
   b.orb(-2.2, 9.6, -58.6, { hero: "vexa" });
   b.orb(-0.8, 9.7, -63.2, { hero: "vexa" });
   // secrets: the ember shard off to the left of beat 2 (aim wide), the trapeze sticker (Nami)
   b.secret(-6.5, 9.8, -16.5);
   b.secret(2.6, 19.4, -37.6);
   b.crowd(-14, -30, 1);
   b.crowd(-36, -58, -1);
   b.leg("platform", p1);
   b.leg("cannon", c1);
   b.leg("cannon", c2);
   b.leg("cannon", c3);
   b.leg("cannon", c4);
   b.leg("cannon", c5);
   b.leg("finish");
   void c0;
   void t1;
}

// ---------- L2 Angle Practice: lob over tent walls, flat under trapeze banners ----------
function l2(b: ShowBuilder): void {
   b.cannon(0, 6, 0, { at: [0, -8.5] });
   const c1 = b.cannon(0, 6.5, -8.5, { at: [0, -20.5] });
   b.orb(0, 7.6, -4.4);
   // a trapeze banner hangs from the top: fly flat under it
   b.wall(-6, 6, 8.4, 22, -14.7, -14.3, "trapeze");
   const c2 = b.cannon(0, 6.5, -20.5, { at: [1, -32] });
   b.orb(0, 7.4, -12);
   b.orb(0, 7.4, -17);
   // a tent wall: lob over it
   b.wall(-6, 6, 0, 10.2, -26.3, -25.7);
   const c3 = b.cannon(1, 6.5, -32, { at: [-3, -42] });
   b.orb(0.5, 11.6, -26);
   // a lower banner, then a higher wall
   b.wall(-7, 5, 9.2, 22, -37.2, -36.8, "trapeze");
   const c4 = b.cannon(-3, 7.5, -42, { at: [-3, -52] });
   b.orb(-1, 8.2, -37);
   b.wall(-8, 3, 0, 11, -47.3, -46.7);
   const c5 = b.cannon(-3, 7.5, -52, { at: [0, -61] });
   b.orb(-3, 12.4, -47);
   const c6 = b.cannon(0, 8, -61, { at: [0, -70] });
   b.orb(-1.5, 9.6, -56.5);
   b.finish(0, 9, -70, 0);
   b.orb(0, 10.2, -65.5);
   // Riko: the cracked board right of c5 hides a cannon whose line runs the orbs to the finish
   const board = b.board(4, 8.6, -55.5, 1.3, 1.3, 0.18);
   b.cannon(4, 8.6, -57, { board, at: [0, -70] });
   b.orbLine([3.4, 10.2, -59.5], [1, 10.4, -67], 3, { hero: "riko" });
   // Nami: high orbs over the first wall
   b.orb(1.5, 17.6, -27.5, { hero: "nami" });
   b.orb(0, 17.8, -29.5, { hero: "nami" });
   // Kiro: a smoke column with two orbs, right of the banner
   b.jet(5, -10, 3, 13, 2400, 1);
   b.orb(5, 8, -10, { hero: "kiro" });
   b.orb(5, 9.8, -10, { hero: "kiro" });
   // Zuno: the canvas trail along the second banner
   b.orbLine([-7, 9.6, -38], [-7, 9.6, -46], 3, { hero: "zuno", hidden: true });
   // Vexa: a ghost pole on the flat line c5 -> c6
   b.pole(-1.5, -56.5, 0, 9.4, true);
   b.orb(-2.2, 8.4, -54.6, { hero: "vexa" });
   b.orb(-0.6, 8.6, -58.6, { hero: "vexa" });
   // secrets: the ticket stub on top of the first wall (a lob that drops onto it), Riko's board shard
   b.secret(-4.5, 11.2, -26);
   b.secret(4, 10, -57.2);
   b.crowd(-6, -24, -1);
   b.crowd(-30, -52, 1);
   b.leg("cannon", c1);
   b.leg("cannon", c2);
   b.leg("cannon", c3);
   b.leg("cannon", c4);
   b.leg("cannon", c5);
   b.leg("cannon", c6);
   b.leg("finish");
}

// ---------- L3 Moving Pads: rails, a wheel, an auto chain, smoke jets ----------
function l3(b: ShowBuilder): void {
   b.cannon(0, 6, 0, { at: [0, -9] });
   // a rail cannon (2.8 s): catch it on the move
   const c1 = b.cannon(0, 6.5, -9, { at: [0, -17], rail: { ax: 1, ay: 0, az: 0, travel: 2.6, periodMs: 2800, phase: 0 } });
   b.orb(0, 7.8, -4.6);
   const c2 = b.cannon(0, 7, -17, { at: [-3, -25] });
   b.orb(0, 8.2, -13);
   // a wheel cannon: the barrel sweeps on its own, the power is fixed: fire on timing
   const w = b.cannon(-3, 7, -25, { kind: "wheel", yaw: yawTowards(-3, -25, -5, -37), sweep: 40 * DEG, sweepMs: 2400, pitch: 45 * DEG, power: 0.78 });
   b.orb(-1.5, 8.4, -21);
   const c4p = { x: -5, y: 7.5, z: -37.2 };
   const c4 = b.cannon(c4p.x, c4p.y, c4p.z, { at: [-5, -45] });
   b.orb(-4, 10.4, -31);
   // the auto chain: each fires on its own after 1.5 s (Jump fires it early) into the next
   const a1p = { x: -5, y: 8, z: -45 };
   const a2p = { x: -1, y: 9, z: -53 };
   const a3p = { x: 3, y: 9, z: -61 };
   const s1 = solveShot(a1p.x, a1p.y, a1p.z, a2p.x, a2p.y, a2p.z, 40 * DEG);
   const s2 = solveShot(a2p.x, a2p.y, a2p.z, a3p.x, a3p.y, a3p.z, 35 * DEG);
   const a1 = b.cannon(a1p.x, a1p.y, a1p.z, { kind: "auto", yaw: s1.yaw, pitch: 40 * DEG, power: s1.power });
   b.orb(-5, 9.4, -41);
   const a2 = b.cannon(a2p.x, a2p.y, a2p.z, { kind: "auto", yaw: s2.yaw, pitch: 35 * DEG, power: s2.power });
   b.orb(-3, 10.6, -49);
   const a3 = b.cannon(a3p.x, a3p.y, a3p.z, { at: [3, -71] });
   b.orb(1, 10.6, -57);
   // a smoke jet across the next shot: time it (Kiro flies straight through)
   b.jet(3, -66, 3, 14, 2400, 0.5, 0);
   const c5 = b.cannon(3, 9, -71, { at: [0, -80], rail: { ax: 1, ay: 0, az: 0, travel: 2.2, periodMs: 2800, phase: 0.5 } });
   b.orb(3, 11.4, -66);
   const c6 = b.cannon(0, 9.5, -80, { at: [0, -89] });
   b.orb(1.5, 11, -75.5);
   b.finish(0, 10, -89, 0);
   b.orb(0, 11, -84.5);
   // Riko: a cracked board on a side stand off c2 hides a cannon onto the chain
   const board = b.board(5, 8.4, -22.4, 1.3, 1.3, 0.18);
   b.cannon(5, 8.4, -24, { board, at: [-5, -37.2] });
   b.orbLine([4, 10.2, -27], [-3, 11, -34], 3, { hero: "riko" });
   // Nami: high orbs over the wheel
   b.orb(-3, 17.8, -29, { hero: "nami" });
   b.orb(-4, 18, -31, { hero: "nami" });
   // Kiro: orbs inside the timed jet (and the smoke sticker past it)
   b.orb(3, 9.8, -66, { hero: "kiro" });
   b.orb(3, 12.6, -66, { hero: "kiro" });
   // Zuno: a canvas trail along the chain
   b.orbLine([-8.6, 10, -44], [-5, 11, -55], 3, { hero: "zuno", hidden: true });
   // Vexa: a ghost pole on the flat line to the finish
   b.pole(0, -84.6, 0, 10.8, true);
   b.orb(-0.6, 10.2, -82.6, { hero: "vexa" });
   b.orb(0.6, 10.2, -86.8, { hero: "vexa" });
   // secrets: the rail shard where c1 swings out, the smoke sticker in the jet (Kiro)
   b.secret(4.2, 7.6, -12);
   b.secret(3, 11.2, -66.6);
   b.crowd(-8, -30, 1);
   b.crowd(-40, -64, -1);
   b.crowd(-70, -86, 1);
   b.leg("cannon", c1);
   b.leg("cannon", c2);
   b.leg("cannon", w);
   b.leg("cannon", c4);
   b.leg("cannon", a1);
   b.leg("cannon", a2);
   b.leg("cannon", a3);
   b.leg("cannon", c5);
   b.leg("cannon", c6);
   b.leg("finish");
}

// ---------- L4 Long Distance: 25 m shots across the big top, a balloon gap, smoke jets ----------
function l4(b: ShowBuilder): void {
   b.cannon(0, 11, 0, { at: [2, -26] });
   // long shot 1 (26 m, a drop of 4 m)
   const c1 = b.cannon(2, 7, -26, { at: [0, -40] });
   b.orb(1, 14.6, -12);
   b.orb(1.6, 12.6, -19);
   // the balloon gap: 36 m, too far for any shot; pop the bunch and re-aim in mid-air
   const bl = b.balloon(0, 12, -42);
   b.orb(0.8, 12.8, -34);
   const c2 = b.cannon(-2, 8, -62, { at: [2, -84] });
   b.orb(-1, 14.4, -51);
   // a smoke jet pair across long shot 3: time it, or steer between
   b.jet(0, -73, 3, 16, 2600, 0.5, 0);
   const c3 = b.cannon(2, 7.5, -84, { at: [0, -100] });
   b.orb(0, 12.8, -72.6);
   b.orb(1.2, 12.2, -78.5);
   const p2 = b.platform(0, 6, -102, 3, 3);
   const c4 = b.cannon(0, 6 + MOUTH, -104.4, { at: [0, -114] });
   b.orb(0, 6.5, -100.6);
   b.finish(0, 8, -114, 0);
   b.orb(0, 9, -109.5);
   // the one-shot line (the card's secret): exactly 100 % from c1 reaches a perch cannon 28 m on
   const perch = b.cannon(-3.5, 3.2, -52.8, { at: [2, -84] });
   b.orb(-2, 10.6, -44, {});
   // Riko: a cracked board left of c2 hides a cannon straight onto the platform
   const board = b.board(-6.5, 9.2, -64.5, 1.3, 1.3, 0.18);
   b.cannon(-6.5, 9.2, -66, { board, at: [0, -102] });
   b.orbLine([-6, 12, -70], [-2, 12.5, -94], 3, { hero: "riko" });
   // Nami: high orbs over the balloon
   b.orb(0, 22.6, -44, { hero: "nami" });
   b.orb(-0.5, 22.8, -47, { hero: "nami" });
   // Kiro: orbs in the jet
   b.orb(0, 10.6, -73, { hero: "kiro" });
   b.orb(0, 13.6, -73, { hero: "kiro" });
   // Zuno: a canvas trail along long shot 1
   b.orbLine([-3.4, 13, -8], [-2.6, 11, -22], 3, { hero: "zuno", hidden: true });
   // Vexa: ghost poles flank the platform's flat line
   b.pole(1, -93, 0, 9.6, true);
   b.orb(1.4, 8.2, -90.4, { hero: "vexa" });
   b.orb(0.6, 7.6, -95.6, { hero: "vexa" });
   // secrets: the one-shot shard over the perch, the ghost-pole sticker behind the poles (Vexa)
   b.secret(-3.5, 5.6, -52.8);
   b.secret(0.8, 8, -94.4);
   b.crowd(-4, -30, -1);
   b.crowd(-36, -66, 1);
   b.crowd(-72, -104, -1);
   b.leg("cannon", c1);
   b.leg("cannon", perch);
   b.leg("cannon", c3);
   b.leg("platform", p2);
   b.leg("cannon", c4);
   b.leg("finish");
   void bl;
   void c2;
}

// ---------- L5 Big Top Finale: everything, then Ashbag ----------
function l5(b: ShowBuilder): void {
   b.cannon(0, 7, 0, { at: [-2, -9] });
   const c1 = b.cannon(-2, 7.5, -9, { at: [1, -18] });
   b.orb(-1, 8.8, -4.6);
   const c2 = b.cannon(1, 8, -18, { at: [0, -27], rail: { ax: 1, ay: 0, az: 0, travel: 2, periodMs: 2800, phase: 0.25 } });
   b.orb(-0.5, 9.6, -13.6);
   const c3 = b.cannon(0, 8.5, -27, { at: [0, -46] });
   b.orb(0.5, 9.8, -22.4);
   // the stage under the circling blimp
   const sx = 0;
   const sz = -52;
   const sy = 6;
   const stage = b.platform(sx, sy, sz, 6.5, 6.5, true);
   b.orb(0, 12.6, -37);
   const stageCannons: number[] = [];
   for (const a of [45, 135, 225, 315]) {
      const r = 4.6;
      const x = sx + Math.sin(a * DEG) * r;
      const z = sz + Math.cos(a * DEG) * r;
      stageCannons.push(b.cannon(x, sy + MOUTH, z, { yaw: Math.atan2(-(x - sx), -(z - sz)) + Math.PI, pitch: 60 * DEG, stage: true }));
   }
   // P2's trampolines on their own stands just outside the stage, between the stage cannons
   const ta = b.tramp(sx + 9.5, sy - 1, sz, 1.4);
   const tb = b.tramp(sx - 9.5, sy - 1, sz, 1.4);
   // the P3 auto-cannon chain on the tent poles, up to the valve
   const chainPts = [
      { x: -8.5, y: 10, z: -47 },
      { x: -6.5, y: 15, z: -59 },
      { x: 2.5, y: 20, z: -61.5 },
      { x: 7.5, y: 24.5, z: -52 },
   ];
   const chain: number[] = [];
   const pitches = [50, 48, 45, 62];
   for (let k = 0; k < chainPts.length; k++) {
      const p = chainPts[k];
      const n = k + 1 < chainPts.length ? chainPts[k + 1] : { x: sx, y: 26 + 3 + 2.2, z: sz };
      const s = solveShot(p.x, p.y, p.z, n.x, n.y, n.z, pitches[k] * DEG);
      chain.push(b.cannon(p.x, p.y, p.z, { kind: "auto", yaw: s.yaw, pitch: pitches[k] * DEG, power: s.power }));
   }
   b.d.arena = {
      x: sx,
      y: sy,
      z: sz,
      r: 6.5,
      platform: stage,
      cannons: stageCannons,
      tramps: [ta, tb],
      podSpots: [0, 120, 240].map((a) => ({ x: sx + Math.sin(a * DEG) * 10, y: 13.5, z: sz + Math.cos(a * DEG) * 10 })),
      topSpot: { x: sx, y: 26, z: sz },
      chain,
      circleR: 11,
      circleY: 15,
   };
   // pod rain: each popped pod rains three orbs onto the stage under it
   for (let k = 0; k < 3; k++) {
      const a = k * 120 * DEG;
      for (let j = -1; j <= 1; j++) {
         const r = 3.4 + (j === 0 ? 0.9 : 0);
         const aa = a + j * 0.32;
         b.orb(sx + Math.sin(aa) * r, sy + 0.55, sz + Math.cos(aa) * r, { pod: k });
      }
   }
   // Riko: a cracked board over c1 hides a cannon onto the stage
   const board = b.board(-6, 9, -12, 1.3, 1.3, 0.18);
   b.cannon(-6, 9, -13.5, { board, at: [0, -46] });
   b.orbLine([-5.6, 11.2, -17], [-2, 12.4, -38], 3, { hero: "riko" });
   // Nami: high orbs over c3
   b.orb(0, 18.8, -31, { hero: "nami" });
   b.orb(0.5, 19, -33, { hero: "nami" });
   // Kiro: the smoke column beside the stage
   b.jet(9, -42, 3, 16, 2400, 1);
   b.orb(9, 9, -42, { hero: "kiro" });
   b.orb(9, 11, -42, { hero: "kiro" });
   // Zuno: a canvas trail along the rail
   b.orbLine([4.6, 9, -13], [4.4, 9.4, -22], 3, { hero: "zuno", hidden: true });
   // Vexa: a ghost pole on the flat line c1 -> c2
   b.pole(-0.5, -13.5, 0, 8.6, true);
   b.orb(-1.2, 8.4, -11.4, { hero: "vexa" });
   b.orb(0.2, 8.6, -15.6, { hero: "vexa" });
   // secrets: the ash shard under the stage's edge (hop off), the valve sticker over the blimp's top
   b.secret(0, 3.6, -59.4);
   b.secret(1.8, 31.6, -52);
   b.crowd(-4, -26, 1);
   b.crowd(-36, -66, -1);
   b.leg("cannon", c1);
   b.leg("cannon", c2);
   b.leg("cannon", c3);
   b.leg("boss");
}

const FNS: Record<LevelId, ShowFn> = { 1: l1, 2: l2, 3: l3, 4: l4, 5: l5 };

/** Builds a level's show; `fn` swaps the layout (tests' mutation probes). */
export function buildCourse(level = LEVELS[1], fn?: ShowFn): Course {
   return buildShow(level, fn ?? FNS[level.id]);
}

export const LAYOUTS = FNS;

const CACHE: Partial<Record<LevelId, Course>> = {};

export function courseFor(level: LevelId): Course {
   return (CACHE[level] ??= buildCourse(LEVELS[level]));
}
