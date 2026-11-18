// Ultimate Color Trial's five levels (docs/master-plan/PLAY50_MENU_2_50_COLOR_ROLL_HEROES_FULL.md
// "GAME 50", World 6 Prism Fortress: the mixed-mechanic finale). Plain data: course.ts turns a spec
// into the course the rules run on. One trial corridor (12 m wide, along +z, over the void of the
// fortress) made of sections, each one mechanic of the Menu 2 worlds: jump pads over the void, trial
// rings to pass in order, colour switches and colour doors, laser runways, survival arenas with
// rolling orbs, an energy core to carry to its receptor, and on level 5 the Chroma Sentinel's arena.
// A section with an objective (rings, doors, survival, core) has an exit gate that opens when it is
// done. Coordinates are metres, y up.
import type { LevelId } from "../../types";

/** The design card's signature. layouts.test.ts pins it. */
export const SIGNATURE = "one corridor, every mechanic, in sections";

export interface XZ {
   x: number;
   z: number;
}

export interface XYZ extends XZ {
   y: number;
}

/** The five trial colours, the heroes' own. A level plays the first `colors`. */
export const PALETTE = [
   { id: "red", name: "Red", hex: "#ef4444" },
   { id: "blue", name: "Blue", hex: "#3b82f6" },
   { id: "green", name: "Green", hex: "#22c55e" },
   { id: "yellow", name: "Yellow", hex: "#facc15" },
   { id: "purple", name: "Purple", hex: "#a855f7" },
] as const;

export type SectionKind = "jump" | "rings" | "gates" | "runner" | "survive" | "core" | "boss";

/** A round pad over the void (a jump section), or a sliding one on a runway. */
export interface PadSpec extends XYZ {
   r: number;
   /** slides across the corridor: x + dx x sin(2 pi t / periodMs + phase) */
   move?: { dx: number; periodMs: number; phase: number };
}

/** An upright trial ring in the plane z = ring.z: pass through it (the chest within r of its centre). */
export interface RingSpec extends XYZ {
   r: number;
}

export interface SwitchSpec extends XZ {
   color: number;
}

/** A row of colour doors across the corridor: a door opens for a hero charged with its colour; the rest is wall. */
export interface DoorRow {
   z: number;
   doors: { x0: number; x1: number; color: number }[];
}

/** A laser beam sweeping the runway toward the hero: at z = zb - ((t x speed + phase) mod (zb - za)). */
export interface LaserSpec {
   za: number;
   zb: number;
   /** m/s */
   speed: number;
   /** m */
   phase: number;
}

/** A rolling hazard orb circling (cx, cz) at radius r, one lap per periodMs. */
export interface BlobSpec {
   cx: number;
   cz: number;
   r: number;
   periodMs: number;
   phase: number;
}

export interface SectionSpec {
   kind: SectionKind;
   name: string;
   z0: number;
   z1: number;
   pads?: PadSpec[];
   rings?: RingSpec[];
   switches?: SwitchSpec[];
   rows?: DoorRow[];
   lasers?: LaserSpec[];
   blobs?: BlobSpec[];
   surviveMs?: number;
   core?: XZ;
   receptor?: XZ;
}

export interface GemSpec extends XYZ {
   main: boolean;
   /** only Zuno's magnet pulls it out of the floor light */
   hidden?: boolean;
}

/** A side alcove in the +x wall behind a barrier: Riko's crystal wall (shard) or Vexa's void gate (sticker). */
export interface NookSpec {
   z: number;
   kind: "wall" | "gate";
}

export interface TrialSpec {
   id: LevelId;
   name: string;
   timerMs: number;
   starTargetMs: number;
   /** colours in play (the first `colors` of PALETTE) */
   colors: number;
   start: XZ;
   finish: XZ;
   sections: SectionSpec[];
   nooks: [NookSpec, NookSpec];
   /** Nyla's sky ledge: a pad LEDGE_LIFT over the floor with her shard */
   ledge: XZ;
   gems: GemSpec[];
   /** in progression.ts SECRETS order: the gate sticker (Vexa), the wall shard (Riko), the ledge shard (Nyla) */
   secrets: XYZ[];
   boss: boolean;
   /** level 5: the boss hovers at the arena's far end; the beacon stands at its near end */
   boss5?: { x: number; z: number; beacon: XZ; rings: RingSpec[]; switches: SwitchSpec[]; row: DoorRow; core: XZ; receptor: XZ; blobs: BlobSpec[] };
}

/** The corridor's half width; the start strip and every solid section span it. */
export const HALF_W = 6;
/** Nyla's ledge floats this high over the floor (a plain jump tops out at 3.27 m). */
export const LEDGE_LIFT = 4.4;

// ---------------------------------------------------------------------------------------------
// section constructors

const PAD_R = 1.7;

/** Jump pads over the void, zigzagging across the corridor; `spacing` between centres; some raised, some sliding. */
function jump(z0: number, n: number, spacing: number, opts: { raise?: number[]; movers?: number[]; r?: number; name?: string } = {}): SectionSpec {
   const pads: PadSpec[] = [];
   for (let k = 0; k < n; k++) {
      // a gentle zigzag: the diagonal between pads stays inside a flat jump's 6 m reach
      const x = (k % 2 === 0 ? -1 : 1) * (0.9 + (k % 3) * 0.15);
      const y = opts.raise?.includes(k) ? 1.2 : 0;
      const mover = opts.movers?.includes(k);
      pads.push({ x: mover ? 0 : x, z: z0 + 3.2 + k * spacing, y, r: (opts.r ?? PAD_R) + (mover ? 0.5 : 0), move: mover ? { dx: 2, periodMs: 6000 + k * 300, phase: k } : undefined });
   }
   const z1 = z0 + 3.2 + (n - 1) * spacing + 3.4;
   return { kind: "jump", name: opts.name ?? "Jump", z0, z1, pads };
}

/** Trial rings every `step` m, zigzagging; the ones in `high` float at jump height. */
function rings(z0: number, n: number, step: number, high: number[] = [], name = "Rings"): SectionSpec {
   const list: RingSpec[] = [];
   for (let k = 0; k < n; k++) {
      const h = high.includes(k);
      list.push({ x: (k % 2 === 0 ? -1 : 1) * (1.5 + (k % 3) * 0.9), y: h ? 3.0 : 1.2, z: z0 + 4 + k * step, r: h ? 1.15 : 1.35 });
   }
   return { kind: "rings", name, z0, z1: z0 + 4 + (n - 1) * step + 4, rings: list };
}

/** Colour switches then a row of colour doors, `rowsN` times; the colours of each row are a permutation of the first `colors`. */
function gates(z0: number, rowsN: number, colors: number, perm: number[][], name = "Colour doors"): SectionSpec {
   const switches: SwitchSpec[] = [];
   const rows: DoorRow[] = [];
   const doorsN = Math.min(3, colors);
   for (let r = 0; r < rowsN; r++) {
      const zr = z0 + 12 + r * 13;
      const p = perm[r % perm.length];
      const sw = p.slice(0, Math.min(colors, 5));
      // the switches, spread across the corridor 6 m before the row
      sw.forEach((c, i) => switches.push({ x: -4.4 + (8.8 * i) / Math.max(1, sw.length - 1), z: zr - 6, color: c }));
      const doors: DoorRow["doors"] = [];
      for (let d = 0; d < doorsN; d++) {
         const x0 = -HALF_W + (2 * HALF_W * d) / doorsN + 0.5;
         doors.push({ x0, x1: x0 + (2 * HALF_W) / doorsN - 1, color: p[(d + r) % p.length] });
      }
      rows.push({ z: zr, doors });
   }
   return { kind: "gates", name, z0, z1: z0 + 12 + (rowsN - 1) * 13 + 3, switches, rows };
}

/** A laser runway: `n` beams sweeping toward the hero at `speed` m/s; optional sliding pads over void slots. */
function runner(z0: number, n: number, speed: number, len: number, name = "Runway"): SectionSpec {
   const lasers: LaserSpec[] = [];
   const za = z0 + 3;
   const zb = z0 + len - 3;
   for (let k = 0; k < n; k++) lasers.push({ za, zb, speed, phase: (k * (zb - za)) / n });
   return { kind: "runner", name, z0, z1: z0 + len, lasers };
}

/** A survival arena: rolling orbs circle its middle; its exit opens surviveMs after you step in. */
function survive(z0: number, len: number, orbs: number, surviveMs: number, name = "Survival round"): SectionSpec {
   const blobs: BlobSpec[] = [];
   const cz = z0 + len / 2;
   for (let k = 0; k < orbs; k++) blobs.push({ cx: 0, cz, r: 2.6 + (k % 2) * 1.8, periodMs: 3600 + k * 500, phase: (k * Math.PI * 2) / orbs });
   return { kind: "survive", name, z0, z1: z0 + len, blobs, surviveMs };
}

/** An energy core on one side, its receptor at the far end, orbs between. */
function core(z0: number, len: number, orbs: number, name = "Energy core"): SectionSpec {
   const blobs: BlobSpec[] = [];
   for (let k = 0; k < orbs; k++) blobs.push({ cx: (k % 2 === 0 ? -1 : 1) * 1.5, cz: z0 + len / 2, r: 2.2 + k * 0.6, periodMs: 3000 + k * 400, phase: k * 2 });
   return { kind: "core", name, z0, z1: z0 + len, core: { x: -3.8, z: z0 + 3.5 }, receptor: { x: 3.8, z: z0 + len - 3.5 }, blobs };
}

const Y_GEM = 0.9;
function gemLine(x: number, z0: number, z1: number, n: number, y = Y_GEM, main = true, hidden = false): GemSpec[] {
   const out: GemSpec[] = [];
   for (let i = 0; i < n; i++) out.push({ x, y, z: z0 + ((z1 - z0) * i) / Math.max(1, n - 1), main, hidden: hidden || undefined });
   return out;
}

/** Gems along the corridor's middle of every section, raised over jump pads. */
function trailGems(sections: SectionSpec[]): GemSpec[] {
   const out: GemSpec[] = [];
   for (const s of sections) {
      if (s.kind === "boss") continue;
      if (s.kind === "jump") {
         for (const p of s.pads ?? []) out.push({ x: p.x, y: p.y + Y_GEM, z: p.z, main: true });
      } else {
         const n = Math.max(2, Math.round((s.z1 - s.z0) / 9));
         out.push(...gemLine(s.kind === "survive" ? 4.5 : 0, s.z0 + 2.5, s.z1 - 2.5, n));
      }
   }
   return out;
}

/** The nook alcove's secret spot, the ledge's spot. */
export const NOOK_X = HALF_W + 1.8;
function secretsOf(nooks: [NookSpec, NookSpec], ledge: XZ): XYZ[] {
   const gate = nooks.find((n) => n.kind === "gate")!;
   const wall = nooks.find((n) => n.kind === "wall")!;
   return [
      { x: NOOK_X + 0.6, y: 1, z: gate.z },
      { x: NOOK_X + 0.6, y: 1, z: wall.z },
      { x: ledge.x, y: LEDGE_LIFT + 1, z: ledge.z },
   ];
}

function sideGems(nooks: [NookSpec, NookSpec], ledge: XZ): GemSpec[] {
   return [
      { x: NOOK_X - 0.4, y: Y_GEM, z: nooks[1].z - 0.5, main: false },
      { x: NOOK_X - 0.4, y: Y_GEM, z: nooks[1].z + 0.5, main: false },
      { x: ledge.x - 0.5, y: LEDGE_LIFT + Y_GEM, z: ledge.z, main: false },
      { x: ledge.x + 0.5, y: LEDGE_LIFT + Y_GEM, z: ledge.z, main: false },
   ];
}

// ---------------------------------------------------------------------------------------------
// the levels

const P3 = [
   [0, 1, 2],
   [2, 0, 1],
   [1, 2, 0],
];
const P4 = [
   [0, 1, 2, 3],
   [3, 2, 0, 1],
   [1, 3, 0, 2],
];
const P5 = [
   [0, 1, 2, 3, 4],
   [4, 2, 0, 3, 1],
   [1, 3, 4, 0, 2],
   [2, 0, 3, 1, 4],
];

function level1(): TrialSpec {
   const s1 = jump(8, 6, 4.4, { name: "Jump pads" });
   const s2 = rings(s1.z1, 4, 5, [], "Trial rings");
   // a guard orb circling a gem off the ring line (Kiro's shield walks through it; the rings' lanes stay clear)
   s2.blobs = [{ cx: -3.0, cz: s2.z0 + 17, r: 1.0, periodMs: 4000, phase: 0 }];
   const s3 = gates(s2.z1, 1, 3, P3, "Colour door");
   const sections = [s1, s2, s3];
   const nooks: [NookSpec, NookSpec] = [
      { z: s2.z0 + 6, kind: "gate" },
      { z: s3.z0 + 4, kind: "wall" },
   ];
   const ledge = { x: 4, z: s2.z0 + 12 };
   return {
      id: 1,
      name: "Jump Trial",
      timerMs: 100_000,
      starTargetMs: 75_000,
      colors: 3,
      start: { x: 0, z: 2 },
      finish: { x: 0, z: s3.z1 + 6 },
      sections,
      nooks,
      ledge,
      gems: [...trailGems(sections), ...sideGems(nooks, ledge), ...gemLine(-4.5, s3.z0 + 2, s3.z0 + 8, 3, 0.6, false, true), { x: -3.0, y: Y_GEM, z: s2.z0 + 17, main: false }],
      secrets: secretsOf(nooks, ledge),
      boss: false,
   };
}

function level2(): TrialSpec {
   const s1 = jump(8, 7, 4.5, { movers: [2, 5], name: "Sliding pads" });
   const s2 = runner(s1.z1, 2, 3, 26, "Laser runway");
   const s3 = rings(s2.z1, 5, 5, [2], "Trial rings");
   const s4 = gates(s3.z1, 2, 4, P4, "Colour doors");
   const sections = [s1, s2, s3, s4];
   const nooks: [NookSpec, NookSpec] = [
      { z: s3.z0 + 6, kind: "gate" },
      { z: s4.z0 + 4, kind: "wall" },
   ];
   const ledge = { x: 4, z: s2.z0 + 12 };
   return {
      id: 2,
      name: "Runner Trial",
      timerMs: 120_000,
      starTargetMs: 90_000,
      colors: 4,
      start: { x: 0, z: 2 },
      finish: { x: 0, z: s4.z1 + 6 },
      sections,
      nooks,
      ledge,
      gems: [...trailGems(sections), ...sideGems(nooks, ledge), ...gemLine(-4.5, s4.z0 + 2, s4.z0 + 8, 3, 0.6, false, true)],
      secrets: secretsOf(nooks, ledge),
      boss: false,
   };
}

function level3(): TrialSpec {
   const s1 = gates(8, 2, 5, P5, "Colour doors");
   const s2 = rings(s1.z1, 6, 5, [1, 4], "Trial rings");
   const s3 = jump(s2.z1, 8, 4.5, { raise: [3, 6], name: "Raised pads" });
   const s4 = core(s3.z1, 24, 2, "Energy core");
   const s5 = survive(s4.z1, 22, 3, 8000, "Survival round");
   const sections = [s1, s2, s3, s4, s5];
   const nooks: [NookSpec, NookSpec] = [
      { z: s2.z0 + 8, kind: "gate" },
      { z: s4.z0 + 12, kind: "wall" },
   ];
   const ledge = { x: 4, z: s1.z0 + 4 };
   return {
      id: 3,
      name: "Color Trial",
      timerMs: 150_000,
      starTargetMs: 105_000,
      colors: 5,
      start: { x: 0, z: 2 },
      finish: { x: 0, z: s5.z1 + 6 },
      sections,
      nooks,
      ledge,
      gems: [...trailGems(sections), ...sideGems(nooks, ledge), ...gemLine(-4.5, s1.z0 + 2, s1.z0 + 8, 3, 0.6, false, true)],
      secrets: secretsOf(nooks, ledge),
      boss: false,
   };
}

function level4(): TrialSpec {
   const s1 = runner(8, 3, 4, 36, "Fast runway");
   const s2 = jump(s1.z1, 9, 4.9, { movers: [1, 4, 7], raise: [5], r: 1.55, name: "Tight pads" });
   const s3 = gates(s2.z1, 3, 5, P5, "Colour doors");
   const s4 = rings(s3.z1, 7, 5, [1, 3, 5], "High rings");
   const s5 = survive(s4.z1, 24, 4, 10000, "Survival round");
   const s6 = core(s5.z1, 26, 3, "Energy core");
   const sections = [s1, s2, s3, s4, s5, s6];
   const nooks: [NookSpec, NookSpec] = [
      { z: s3.z0 + 4, kind: "gate" },
      { z: s4.z0 + 8, kind: "wall" },
   ];
   const ledge = { x: 4, z: s1.z0 + 12 };
   return {
      id: 4,
      name: "Mixed Trial",
      timerMs: 180_000,
      starTargetMs: 120_000,
      colors: 5,
      start: { x: 0, z: 2 },
      finish: { x: 0, z: s6.z1 + 6 },
      sections,
      nooks,
      ledge,
      gems: [...trailGems(sections), ...sideGems(nooks, ledge), ...gemLine(-4.5, s3.z0 + 2, s3.z0 + 8, 3, 0.6, false, true)],
      secrets: secretsOf(nooks, ledge),
      boss: false,
   };
}

function level5(): TrialSpec {
   const s1 = jump(8, 7, 4.7, { movers: [3], raise: [5], name: "Jump pads" });
   const s2 = runner(s1.z1, 3, 3.5, 34, "Laser runway");
   const s3 = rings(s2.z1, 6, 5, [1, 4], "Trial rings");
   const s4 = gates(s3.z1, 2, 5, P5, "Colour doors");
   const s5 = survive(s4.z1, 24, 4, 12000, "Survival round");
   const s6 = core(s5.z1, 26, 3, "Energy core");
   const z0 = s6.z1;
   const arena: SectionSpec = { kind: "boss", name: "Chroma Sentinel", z0, z1: z0 + 34 };
   const sections = [s1, s2, s3, s4, s5, s6, arena];
   const nooks: [NookSpec, NookSpec] = [
      { z: s3.z0 + 8, kind: "gate" },
      { z: s2.z0 + 10, kind: "wall" },
   ];
   const ledge = { x: 4, z: s4.z0 + 3 };
   return {
      id: 5,
      name: "Grand Hero Trial",
      timerMs: 240_000,
      starTargetMs: 150_000,
      colors: 5,
      start: { x: 0, z: 2 },
      finish: { x: 0, z: z0 + 30 },
      sections,
      nooks,
      ledge,
      gems: [...trailGems(sections), ...sideGems(nooks, ledge), ...gemLine(-4.5, s4.z0 + 2, s4.z0 + 8, 3, 0.6, false, true)],
      secrets: secretsOf(nooks, ledge),
      boss: true,
      boss5: {
         x: 0,
         z: z0 + 30,
         beacon: { x: 0, z: z0 + 4 },
         rings: [
            { x: -3.5, y: 1.2, z: z0 + 10, r: 1.35 },
            { x: 3.5, y: 3.0, z: z0 + 16, r: 1.15 },
            { x: 0, y: 1.2, z: z0 + 22, r: 1.35 },
         ],
         switches: [
            { x: -4.4, z: z0 + 8, color: 0 },
            { x: 0, z: z0 + 8, color: 1 },
            { x: 4.4, z: z0 + 8, color: 2 },
         ],
         row: {
            z: z0 + 24,
            doors: [
               { x0: -5.5, x1: -2.5, color: 2 },
               { x0: -1.5, x1: 1.5, color: 0 },
               { x0: 2.5, x1: 5.5, color: 1 },
            ],
         },
         core: { x: -4.5, z: z0 + 14 },
         receptor: { x: 4.5, z: z0 + 26 },
         blobs: [
            { cx: 0, cz: z0 + 14, r: 3.2, periodMs: 2600, phase: 0 },
            { cx: 0, cz: z0 + 14, r: 3.2, periodMs: 2600, phase: Math.PI },
            { cx: 0, cz: z0 + 20, r: 4.2, periodMs: 3200, phase: 1 },
            { cx: 0, cz: z0 + 20, r: 4.2, periodMs: 3200, phase: 1 + Math.PI },
         ],
      },
   };
}

export const LEVELS: Record<LevelId, TrialSpec> = { 1: level1(), 2: level2(), 3: level3(), 4: level4(), 5: level5() };
