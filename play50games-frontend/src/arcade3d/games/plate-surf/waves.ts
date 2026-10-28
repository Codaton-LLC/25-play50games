// Plate Surf's wave and its five rides (pure data, no three.js). The wave is a long ridge along z:
// x is the horizontal distance across its face, from the trough (x = 0, the flat sea in front of it)
// up to the lip (x = FACE_W, the crest, waveH high). The ride runs along -z; d below is the distance
// from the start (z = -d). The curl (the breaking part) chases the rider along -z (rules.ts).
// Each level is a script of beats placed by distance (the card's "Levels"); rules.ts reads the draft.
import type { LevelId } from "@/arcade3d/types";
import type { SurfLevel } from "./levels";

/** the face's horizontal width, trough to lip (m) */
export const FACE_W = 12;
/** the steepest part of the face: the glowing sweet band a down-carve must cross to pump */
export const BAND = { lo: 0.38 * FACE_W, hi: 0.62 * FACE_W } as const;
/** the lip zone (m from the crest): a jump press there airs off the lip */
export const LIP_W = 1.6;
/** the side lanes (Riko's lagoon, Vexa's inner lane): flat water in front of the wave, behind a reef ridge */
export const LANE = { x0: -5.5, x1: -1.2, ramp: 14 } as const;
/** a rider orb's centre over the face, and a lip (air) orb's height over the crest */
export const ORB_UP = 0.6;
/** out of reach while riding the crest (the middle is 0.6 up), in reach through most of an air */
export const LIP_ORB_UP = 2.0;
/** Nami's spray-ledge orbs float this high over the crest: one air's apex leaves them out of reach, a double air reaches them */
export const LEDGE_UP = 3.6;
/** a lip gate's centre over the crest and its radius: never passed while riding the crest */
export const GATE = { up: 2.1, r: 1.1 } as const;

/** The face's height at x (m): a smoothstep from the trough to the crest; flat sea in front, the crest's plateau behind. */
export function faceY(x: number, H: number): number {
   if (x <= 0) return 0;
   if (x >= FACE_W) return H;
   const t = x / FACE_W;
   return H * t * t * (3 - 2 * t);
}

/** The face's slope dy/dx at x (0 on the flats and the crest). */
export function faceSlope(x: number, H: number): number {
   if (x <= 0 || x >= FACE_W) return 0;
   const t = x / FACE_W;
   return (H * 6 * t * (1 - t)) / FACE_W;
}

export type OrbKind = "main" | "bonus";
/** who the orb is for: undefined = anyone; "zuno" = hidden in the foam until the magnet shows it */
export interface OrbDef {
   x: number;
   y: number;
   z: number;
   kind: OrbKind;
   hidden?: boolean;
}

export interface BuoyDef {
   x: number;
   z: number;
}

export interface RockDef {
   x: number;
   z: number;
   r: number;
}

export interface JellyDef {
   x: number;
   z: number;
   phase: number;
}

/** a lip gate: a ring floating over the crest, flown through in an air */
export interface GateDef {
   x: number;
   y: number;
   z: number;
   r: number;
}

/** a diving gull (level 4): circles over (x, z) and dives on its beat */
export interface GullDef {
   x: number;
   z: number;
   periodMs: number;
   phase: number;
}

/** Kiro's violet storm spray: over the lip (x >= x0) between z1 and z0 */
export interface SprayDef {
   z0: number;
   z1: number;
   x0: number;
}

/** a side lane behind the reef: "cracked" (Riko's dash breaks its wall) or "ghost" (Vexa phases its arch) */
export interface LaneDef {
   kind: "cracked" | "ghost";
   /** the wall's z (the lane's start) and the lane's end */
   z0: number;
   z1: number;
}

/** a stretch where the rideable face narrows (level 4's canyon): lo / hi bound the rider's x */
export interface NarrowDef {
   z0: number;
   z1: number;
   lo: number;
   hi: number;
}

export interface SecretSpot {
   x: number;
   y: number;
   z: number;
   /** "speed": taken only at the tube speed (the pearl in its hidden tube section) */
   need?: "speed";
}

export interface WaveDraft {
   orbs: OrbDef[];
   buoys: BuoyDef[];
   rocks: RockDef[];
   jellies: JellyDef[];
   gates: GateDef[];
   gulls: GullDef[];
   sprays: SprayDef[];
   lanes: LaneDef[];
   narrows: NarrowDef[];
   /** checkpoint beacons (z), in ride order */
   checkpoints: number[];
   secrets: Record<string, SecretSpot>;
   /** decor: cliff arches by Nami's ledges (z) and canyon walls (z0, z1) */
   arches: number[];
   canyon: { z0: number; z1: number } | null;
   /** level 5: King Breaker rises once the rider passes this z (NaN = no boss) */
   bossStart: number;
}

function draft(): WaveDraft {
   return { orbs: [], buoys: [], rocks: [], jellies: [], gates: [], gulls: [], sprays: [], lanes: [], narrows: [], checkpoints: [], secrets: {}, arches: [], canyon: null, bossStart: Number.NaN };
}

/** The placement helpers one level script uses (H = the level's wave height). */
function placer(H: number, d: WaveDraft) {
   const z = (dist: number) => -dist;
   return {
      /** a rider orb on the face at x */
      orb(dist: number, x: number, kind: OrbKind = "main") {
         d.orbs.push({ x, y: faceY(x, H) + ORB_UP, z: z(dist), kind });
      },
      /** an air orb over the lip */
      lip(dist: number, kind: OrbKind = "main") {
         d.orbs.push({ x: FACE_W - 0.5, y: H + LIP_ORB_UP, z: z(dist), kind });
      },
      /** a row of rider orbs along a line from (d0, x0) to (d1, x1) */
      line(d0: number, d1: number, n: number, x0: number, x1: number, kind: OrbKind = "main") {
         for (let i = 0; i < n; i++) {
            const k = n === 1 ? 0 : i / (n - 1);
            this.orb(d0 + (d1 - d0) * k, x0 + (x1 - x0) * k, kind);
         }
      },
      /** pump-line orbs: alternating high and low in the band's reach, every `step` m */
      pump(d0: number, n: number, step: number, hi = 7.9, lo = 4.1) {
         for (let i = 0; i < n; i++) this.orb(d0 + i * step, i % 2 === 0 ? hi : lo);
      },
      buoy(dist: number, x: number) {
         d.buoys.push({ x, z: z(dist) });
      },
      rock(dist: number, x: number, r = 1.2) {
         d.rocks.push({ x, z: z(dist), r });
      },
      jelly(dist: number, x: number, phase = 0) {
         d.jellies.push({ x, z: z(dist), phase });
      },
      gate(dist: number, withOrb = true) {
         d.gates.push({ x: FACE_W - 0.4, y: H + GATE.up, z: z(dist), r: GATE.r });
         if (withOrb) d.orbs.push({ x: FACE_W - 0.4, y: H + GATE.up, z: z(dist), kind: "main" });
      },
      gull(dist: number, x: number, periodMs = 2600, phase = 0) {
         d.gulls.push({ x, z: z(dist), periodMs, phase });
      },
      /** Kiro: storm spray over the lip with bonus orbs riding inside it */
      spray(d0: number, d1: number) {
         d.sprays.push({ z0: z(d0), z1: z(d1), x0: FACE_W - 2.6 });
         for (let k = d0 + 5; k <= d1 - 4; k += 8) d.orbs.push({ x: FACE_W - 1, y: faceY(FACE_W - 1, H) + ORB_UP, z: z(k), kind: "bonus" });
      },
      /** Zuno: a hidden orb trail in the trough foam */
      trail(d0: number, n: number, step = 9) {
         for (let i = 0; i < n; i++) d.orbs.push({ x: 0.7, y: faceY(0.7, H) + ORB_UP, z: z(d0 + i * step), kind: "bonus", hidden: true });
      },
      /** Riko / Vexa: a side lane with bonus orbs down its middle */
      lane(kind: LaneDef["kind"], d0: number, d1: number, orbs = 4) {
         d.lanes.push({ kind, z0: z(d0), z1: z(d1) });
         const mid = (LANE.x0 + LANE.x1) / 2;
         for (let i = 0; i < orbs; i++) d.orbs.push({ x: mid, y: ORB_UP, z: z(d0 + ((i + 1) * (d1 - d0)) / (orbs + 1)), kind: "bonus" });
      },
      /** Nami: a spray ledge by a cliff arch, a row of orbs over the crest only a double air reaches */
      ledge(dist: number, n = 3) {
         d.arches.push(z(dist + 4));
         for (let i = 0; i < n; i++) d.orbs.push({ x: FACE_W - 0.5, y: H + LEDGE_UP, z: z(dist + i * 4), kind: "bonus" });
      },
      checkpoint(dist: number) {
         d.checkpoints.push(z(dist));
      },
      narrow(d0: number, d1: number, lo: number, hi = FACE_W) {
         d.narrows.push({ z0: z(d0), z1: z(d1), lo, hi });
      },
      secret(id: string, dist: number, x: number, y: number, need?: "speed") {
         d.secrets[id] = { x, y, z: z(dist), ...(need ? { need } : {}) };
      },
   };
}

type Script = (p: ReturnType<typeof placer>, H: number, length: number, d: WaveDraft) => void;

/** Level 1, Training Swell: three safe beats (the card). */
const L1: Script = (p, H) => {
   // beat 1: a small wave; ride straight, then up and down the face, and watch the speed meter fill
   p.pump(30, 8, 15);
   p.trail(60, 5);
   p.spray(150, 178);
   p.checkpoint(170);
   // beat 2: a buoy line down the face's middle to carve round
   for (const k of [210, 240, 270, 300]) p.buoy(k, 6);
   p.orb(225, 3.4);
   p.orb(255, 8.6);
   p.orb(285, 3.4);
   p.orb(315, 8.6);
   p.lane("cracked", 232, 292);
   p.checkpoint(340);
   // beat 3: the lip opens: air for a first trick, then into the lagoon
   p.orb(358, 9.4);
   p.lip(400);
   p.lip(440);
   p.ledge(452);
   p.lip(480);
   p.lane("ghost", 495, 545, 3);
   p.secret("inner", 520, (LANE.x0 + LANE.x1) / 2, ORB_UP + 0.2);
   p.secret("pearl", 562, 9.6, faceY(9.6, H) + ORB_UP, "speed");
};

/** Level 2, Rocky Path: sea rocks and buoys in lanes; pick the high or the low line. */
const L2: Script = (p, H) => {
   p.pump(26, 7, 17);
   p.trail(70, 6);
   p.checkpoint(140);
   // rock garden 1: rocks in the band: the high line has the orbs, the low line the buoys
   for (const k of [170, 186, 202, 218]) p.rock(k, 6, 1.3);
   p.line(168, 222, 4, 9.6, 9.6);
   for (const k of [176, 208]) p.buoy(k, 2.8);
   p.lane("cracked", 240, 300);
   p.pump(244, 4, 17);
   p.checkpoint(320);
   // rock garden 2: rocks on the high line now, the orbs low
   for (const k of [350, 368, 386, 404]) p.rock(k, 8.6, 1.25);
   p.line(348, 410, 4, 3.0, 3.0);
   for (const k of [358, 395]) p.buoy(k, 6.4);
   p.spray(430, 460);
   p.lip(490);
   p.lip(520);
   p.checkpoint(540);
   // rock garden 3: alternating sides, carve the slalom
   p.rock(570, 3.4, 1.2);
   p.orb(570, 8.2);
   p.rock(596, 8.4, 1.2);
   p.orb(596, 3.6);
   p.rock(622, 3.4, 1.2);
   p.orb(622, 8.2);
   p.rock(648, 8.4, 1.2);
   p.orb(648, 3.6);
   p.ledge(668);
   p.lip(690);
   p.checkpoint(710);
   p.pump(722, 4, 17);
   p.lane("ghost", 728, 778, 3);
   p.secret("reef", 270, (LANE.x0 + LANE.x1) / 2, ORB_UP + 0.2);
   p.secret("pearl", 785, 9.6, faceY(9.6, H) + ORB_UP, "speed");
};

/** Level 3, Jump Gates: rings over the lip reached only by air, jellies bobbing in the trough. */
const L3: Script = (p, H) => {
   p.pump(26, 5, 17);
   p.gate(130);
   p.gate(165);
   for (const [k, x] of [[120, 1.4], [138, 0.9], [152, 1.7], [170, 1.1]] as const) p.jelly(k, x, k * 0.01);
   p.trail(185, 5);
   p.checkpoint(205);
   p.pump(215, 5, 17);
   p.gate(320);
   p.gate(350);
   p.gate(380);
   for (const [k, x] of [[300, 1.6], [322, 1.0], [344, 1.8], [366, 1.2], [388, 1.6]] as const) p.jelly(k, x, k * 0.013);
   p.spray(400, 428);
   p.checkpoint(440);
   p.lane("ghost", 455, 515, 3);
   p.pump(455, 5, 17);
   p.gate(560);
   p.gate(590);
   p.ledge(602);
   p.gate(625);
   for (const [k, x] of [[550, 1.8], [572, 1.2], [596, 1.6], [618, 0.9]] as const) p.jelly(k, x, k * 0.007);
   p.checkpoint(650);
   p.pump(665, 5, 17);
   p.lane("cracked", 670, 730);
   p.gate(770);
   p.gate(800);
   p.gate(830);
   for (const [k, x] of [[760, 1.4], [785, 0.8], [815, 1.7]] as const) p.jelly(k, x, k * 0.011);
   p.secret("inner", 485, (LANE.x0 + LANE.x1) / 2, ORB_UP + 0.2);
   p.secret("pearl", 870, 9.6, faceY(9.6, H) + ORB_UP, "speed");
};

/** Level 4, Speed Canyon: sea cliffs close in, the curl runs at 15 m/s, gulls dive. */
const L4: Script = (p, H, _len, d) => {
   p.pump(26, 6, 17);
   p.trail(60, 5);
   p.lane("cracked", 70, 125);
   p.checkpoint(135);
   p.lip(165);
   p.lip(195);
   p.spray(225, 252);
   // the canyon: sea cliffs both sides, the trough is cliff rock: the face narrows to x >= 3.2
   d.canyon = { z0: -255, z1: -935 };
   p.narrow(260, 930, 3.2);
   p.checkpoint(270);
   p.pump(285, 5, 17);
   p.gull(370, 6.2, 2600, 0.1);
   p.gull(395, 8.4, 2600, 0.55);
   p.gull(420, 5.0, 2400, 0.3);
   p.checkpoint(440);
   p.lip(470);
   p.lip(500);
   p.ledge(510);
   p.secret("cave", 516, FACE_W - 0.5, H + LEDGE_UP + 0.4);
   p.gull(545, 7.0, 2400, 0.7);
   p.rock(570, 5.2, 1.1);
   p.orb(570, 8.8);
   p.rock(600, 8.6, 1.1);
   p.orb(600, 4.6);
   p.checkpoint(620);
   p.pump(635, 4, 17);
   p.gull(705, 6.0, 2200, 0.2);
   p.gull(730, 8.0, 2200, 0.65);
   p.lip(765);
   p.lip(795);
   p.checkpoint(810);
   p.pump(825, 4, 17);
   p.gull(895, 5.6, 2200, 0.4);
   p.spray(905, 932);
   p.checkpoint(950);
   p.lane("ghost", 965, 1012, 3);
   p.pump(965, 3, 17);
   p.secret("pearl", 1030, 9.6, faceY(9.6, H) + ORB_UP, "speed");
};

/** Level 5, Plate Surf Master: a warm-up, then King Breaker rides ahead of you to the beach. */
const L5: Script = (p, H, _len, d) => {
   p.pump(30, 6, 17);
   p.trail(60, 5);
   p.checkpoint(140);
   p.lip(165);
   p.gate(200);
   p.spray(215, 245);
   // King Breaker rises here (rules.ts: the boss starts once you pass it)
   d.bossStart = -260;
   p.checkpoint(270);
   p.lane("cracked", 320, 380);
   p.pump(400, 4, 17);
   p.checkpoint(480);
   p.jelly(500, 1.2, 0.2);
   p.jelly(520, 1.6, 0.5);
   p.ledge(560);
   p.checkpoint(640);
   p.lane("ghost", 660, 720, 3);
   p.pump(740, 4, 17);
   p.checkpoint(800);
   p.pump(900, 4, 17);
   p.checkpoint(960);
   p.pump(1040, 4, 17);
   p.checkpoint(1120);
   p.pump(1180, 4, 17);
   p.checkpoint(1260);
   p.secret("reef", 350, (LANE.x0 + LANE.x1) / 2, ORB_UP + 0.2);
   p.secret("inner", 690, (LANE.x0 + LANE.x1) / 2, ORB_UP + 0.2);
   p.secret("pearl", 1300, 9.6, faceY(9.6, H) + ORB_UP, "speed");
};

export const SCRIPTS: Record<LevelId, Script> = { 1: L1, 2: L2, 3: L3, 4: L4, 5: L5 };

/** The level's draft: every prop placed by its script; each list sorted along the ride (z descending). */
export function buildDraft(level: SurfLevel, script: Script = SCRIPTS[level.id]): WaveDraft {
   const d = draft();
   script(placer(level.waveH, d), level.waveH, level.length, d);
   const byZ = (a: { z: number }, b: { z: number }) => b.z - a.z;
   d.orbs.sort(byZ);
   d.buoys.sort(byZ);
   d.rocks.sort(byZ);
   d.jellies.sort(byZ);
   d.gates.sort(byZ);
   d.gulls.sort(byZ);
   d.checkpoints.sort((a, b) => b - a);
   d.lanes.sort((a, b) => b.z0 - a.z0);
   return d;
}
