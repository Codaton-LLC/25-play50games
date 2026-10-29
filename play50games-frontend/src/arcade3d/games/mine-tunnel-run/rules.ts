// Mine Tunnel Run (Menu 2 #12, World 1): dig and drop. A side-on cross-section of a mine on a cell grid.
// Pure, deterministic, a fixed 120 Hz quantum (no browser, React or three.js). One World holds the grid,
// the boulders, beetles, water, rails, the rockfall and the boss; 1 to 4 heroes dig in it (solo = one).
//
// Cells are CELL m (1.6 m, so a 1.45 m hero fits a one-cell tunnel). Row 0 is the surface, rows grow
// downward; columns grow to the right (+x). Speeds follow the card in m/s.
import type { LevelId } from "../../types";
import { inputToWorld } from "../../core/math";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "../../menu2/combo/combo";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "../../menu2/boss/boss";
import { collectSecret, createSecretTracker, type SecretTracker } from "../../menu2/secrets/secrets";
import type { M2HeroId } from "../../menu2/heroModels";
import { LEVELS, parseLevel, type MineLevel, type ParsedLevel, T } from "./levels";
import { COMBO, COMBO_BASE_MS, ROCKJAW, SECRETS } from "./progression";

export { T } from "./levels";

export const FIXED_MS = 1000 / 120;
export const CELL = 1.6;
export const WALK = 6.5;
export const ROLL = 9;
export const ROLL_AFTER_MS = 350;
export const WATER_SLOW = 0.55;
export const DIG_MS = { soft: 200, packed: 500, ore: 450, gas: 300, up: 1.3 } as const;
export const FALL = { start: 7, gain: 3.5, max: 16, drop: 22 } as const;
export const HOP = { cells: 2, riseMs: 110, hangMs: 140, airMoves: 2, airMoveMs: 150 } as const;
export const CLIMB_MS = 220;
export const DASH = { cells: 4, cellMs: 70, cooldownMs: 2500, showMs: 320 } as const;
export const POWER_MS = { kiro: 3000, zuno: 3000, vexa: 2500 } as const;
export const POWER_COOLDOWN_MS = { riko: DASH.cooldownMs, nami: 600, kiro: 6000, zuno: 6000, vexa: 6000 } as const;
export const MAGNET_R = 2;
export const BOULDER = { wobbleMs: 800, start: 4, gain: 30, max: 14 } as const;
export const BEETLE = { speed: 2.4, turnMs: 300, digSoftMs: 1000, digPackedMs: 1600, fallMs: 150 } as const;
export const FLOOD_MS = 300;
export const RAIL_SPEED = 10;
export const ROCKFALL = { startMs: 15_000, rowMs: 600 } as const;
export const STUN_MS = 600;
export const DEAD_MS = 900;
export const GRACE_MS = 1200;
export const STUCK_MS = 2000;
export const ORB_BONUS_MS = 400;
export const ARENA = { refillMs: 3000 } as const;
/** The fastest any hero crosses one cell (Riko's dash bore; a roll-drop is 1.6 m at 22 m/s = 73 ms). */
export const MIN_CELL_MS = DASH.cellMs;

export type HeroAct = "idle" | "walk" | "dig" | "fall" | "rise" | "hang" | "climb" | "dash" | "ride" | "dead" | "won";

export interface StepInput {
   /** stick / keys, -1..1: x right, y down (screen) */
   x: number;
   y: number;
   /** the orbit camera's yaw: left / right follow the camera */
   yaw: number;
   jump: boolean;
   power: boolean;
}
export const idleInput = (): StepInput => ({ x: 0, y: 0, yaw: 0, jump: false, power: false });

export interface Hero {
   index: number;
   heroId: M2HeroId;
   col: number;
   row: number;
   /** the drawn position, in cells (col, row as floats) */
   px: number;
   py: number;
   fc: number;
   fr: number;
   tc: number;
   tr: number;
   t: number;
   dur: number;
   act: HeroAct;
   facing: 1 | -1;
   /** a dig in progress */
   dc: number;
   dr: number;
   digT: number;
   digDur: number;
   digMove: boolean;
   vfall: number;
   rollDrop: boolean;
   hopLeft: number;
   hangMs: number;
   airMoves: number;
   airJumped: boolean;
   sideMs: number;
   rolling: boolean;
   rideDir: number;
   riding: boolean;
   powerMs: number;
   cooldown: number;
   graceMs: number;
   deadMs: number;
   stuckMs: number;
   cpCol: number;
   cpRow: number;
   lit: number[];
   orbs: number;
   hits: number;
   finishMs: number;
   ended: "win" | "timeup" | null;
   pendingJump: boolean;
   pendingPower: boolean;
   combo: ComboState;
   comboMs: number;
   secrets: SecretTracker;
   /** one-frame events (cleared at the start of every step) */
   ev: HeroEvents;
}

export interface HeroEvents {
   dig: number;
   digTile: number;
   orb: number;
   land: boolean;
   landSpeed: number;
   hop: boolean;
   airJump: boolean;
   hit: boolean;
   died: boolean;
   respawn: boolean;
   lantern: boolean;
   secret: boolean;
   power: boolean;
   dash: boolean;
   crushBeetle: boolean;
   bossHit: boolean;
   won: boolean;
   ride: boolean;
}

const newEvents = (): HeroEvents => ({ dig: 0, digTile: 0, orb: 0, land: false, landSpeed: 0, hop: false, airJump: false, hit: false, died: false, respawn: false, lantern: false, secret: false, power: false, dash: false, crushBeetle: false, bossHit: false, won: false, ride: false });

export interface Boulder {
   col: number;
   row: number;
   state: "rest" | "wobble" | "fall";
   t: number;
   /** falling: the row as a float, and the speed m/s */
   y: number;
   v: number;
   alive: boolean;
}

export interface Beetle {
   col: number;
   row: number;
   fc: number;
   fr: number;
   dir: 1 | -1;
   t: number;
   dur: number;
   moving: boolean;
   waitMs: number;
   digMs: number;
   tunneller: boolean;
   alive: boolean;
   /** visual: ms since it was crushed (-1 alive) */
   deadMs: number;
}

export interface Rockjaw {
   state: BossState;
   ev: BossEvents;
   active: boolean;
   /** footprint centre column (float while sliding) and its target */
   x: number;
   target: number;
   /** P2: buried (hidden) */
   buried: boolean;
   flipped: boolean;
   /** visual: the column the dust telegraph shows at */
   dustCol: number;
   refill: number[];
   defeatedAtMs: number;
   /** the phase the arena was last set up for (hits change it outside the boss step) */
   phaseSeen: number;
}

export interface WorldEvents {
   boulderFall: number;
   boulderLand: number;
   wobble: number;
   /** where the last boulder started to wobble / landed this step (cells) */
   wobbleCol: number;
   wobbleRow: number;
   landCol: number;
   landRow: number;
   crack: number;
   flood: number;
   rockfall: number;
   bossTelegraph: boolean;
   bossAttack: boolean;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
   liftOpen: boolean;
}

export interface World {
   level: LevelId;
   cfg: MineLevel;
   map: ParsedLevel;
   w: number;
   h: number;
   tiles: Uint8Array;
   /** orbs still in ore / free / rock-orb cells (1 = there) */
   orb: Uint8Array;
   rail: Uint8Array;
   lantern: Uint8Array;
   lanternLit: Uint8Array;
   /** secret item id + 1 per cell (0 = none) */
   secret: Uint8Array;
   boulders: Boulder[];
   beetles: Beetle[];
   pocketOpened: Uint8Array;
   pocketOf: Int16Array;
   floodBudget: number;
   floodMs: number;
   floodLast: number;
   rockRow: number;
   boss: Rockjaw | null;
   liftOpen: boolean;
   ms: number;
   accumulator: number;
   ended: "win" | "timeup" | null;
   heroes: Hero[];
   ev: WorldEvents;
   /** bumped whenever a tile changes (renderers rebuild their instance buffers) */
   version: number;
}

const newWorldEvents = (): WorldEvents => ({ boulderFall: 0, boulderLand: 0, wobble: 0, wobbleCol: 0, wobbleRow: 0, landCol: 0, landRow: 0, crack: 0, flood: 0, rockfall: 0, bossTelegraph: false, bossAttack: false, bossHit: false, bossPhase: false, bossDefeated: false, liftOpen: false });

// ---------- the grid ----------

export const idx = (w: World, c: number, r: number) => r * w.w + c;
export const inside = (w: World, c: number, r: number) => c >= 0 && r >= 0 && c < w.w && r < w.h;
export const tileAt = (w: World, c: number, r: number) => (inside(w, c, r) ? w.tiles[idx(w, c, r)] : T.BEDROCK);
export const isOpen = (t: number) => t === T.EMPTY || t === T.WATER;
export const isDiggable = (t: number) => t === T.SOFT || t === T.PACKED || t === T.ORE || t === T.GAS;
export const digMsOf = (t: number) => (t === T.SOFT ? DIG_MS.soft : t === T.GAS ? DIG_MS.gas : t === T.ORE ? DIG_MS.ore : DIG_MS.packed);

function setTile(w: World, c: number, r: number, t: number) {
   const i = idx(w, c, r);
   if (w.tiles[i] === t) return;
   w.tiles[i] = t;
   w.version++;
}

/** Cells of the boss footprint (rows F-1..F, three columns) are solid for heroes and boulders. */
export function bossCell(w: World, c: number, r: number): boolean {
   const b = w.boss;
   if (!b || !b.active || b.buried || b.state.step === "done") return false;
   const a = w.map.arena!;
   const bc = Math.round(b.x);
   return r >= a.floor - 1 && r <= a.floor && Math.abs(c - bc) <= 1;
}

const liftCell = (w: World, c: number, r: number) => c === w.map.lift.col && r === w.map.lift.row;

function boulderAt(w: World, c: number, r: number): Boulder | null {
   for (const b of w.boulders) if (b.alive && b.col === c && (b.state !== "fall" ? b.row === r : Math.floor(b.y) === r || Math.ceil(b.y) === r)) return b;
   return null;
}

/** Can a hero stand on (c, r)? */
export function solidForHero(w: World, c: number, r: number, h?: Hero): boolean {
   const t = tileAt(w, c, r);
   if (isOpen(t)) return bossCell(w, c, r);
   if (t === T.GHOST && h && h.heroId === "vexa" && h.powerMs > 0) return false;
   return true;
}

/** May a hero enter (c, r) without digging? */
export function enterable(w: World, c: number, r: number, h: Hero): boolean {
   if (!inside(w, c, r)) return false;
   const t = tileAt(w, c, r);
   if (bossCell(w, c, r)) return false;
   if (isOpen(t)) {
      if (liftCell(w, c, r) && !w.liftOpen) return false;
      return true;
   }
   return t === T.GHOST && h.heroId === "vexa" && h.powerMs > 0;
}

const supported = (w: World, h: Hero) => h.riding || solidForHero(w, h.col, h.row + 1, h);

// ---------- creating ----------

function createHero(w: World, index: number, heroId: M2HeroId): Hero {
   const s = w.map.start;
   return {
      index, heroId, col: s.col, row: s.row, px: s.col, py: s.row, fc: s.col, fr: s.row, tc: s.col, tr: s.row, t: 0, dur: 0,
      act: "idle", facing: 1, dc: 0, dr: 0, digT: 0, digDur: 0, digMove: false, vfall: 0, rollDrop: false,
      hopLeft: 0, hangMs: 0, airMoves: 0, airJumped: false, sideMs: 0, rolling: false, rideDir: 0, riding: false,
      powerMs: 0, cooldown: 0, graceMs: 0, deadMs: 0, stuckMs: 0, cpCol: s.col, cpRow: s.row, lit: [],
      orbs: 0, hits: 0, finishMs: 0, ended: null, pendingJump: false, pendingPower: false,
      combo: createCombo(), comboMs: 0, secrets: createSecretTracker(SECRETS), ev: newEvents(),
   };
}

export function createWorld(level: LevelId = 1, heroIds: readonly M2HeroId[] = ["riko"]): World {
   const cfg = LEVELS[level];
   const map = parseLevel(cfg);
   const n = map.w * map.h;
   const w: World = {
      level, cfg, map, w: map.w, h: map.h, tiles: Uint8Array.from(map.tiles), orb: Uint8Array.from(map.orb), rail: Uint8Array.from(map.rail),
      lantern: Uint8Array.from(map.lantern), lanternLit: new Uint8Array(n), secret: Uint8Array.from(map.secret),
      boulders: map.boulders.map((b) => ({ col: b.col, row: b.row, state: "rest", t: 0, y: b.row, v: 0, alive: true })),
      beetles: map.beetles.map((b) => ({ col: b.col, row: b.row, fc: b.col, fr: b.row, dir: b.dir, t: 0, dur: 0, moving: false, waitMs: 0, digMs: 0, tunneller: b.tunneller, alive: true, deadMs: -1 })),
      pocketOpened: new Uint8Array(map.pockets.length), pocketOf: Int16Array.from(map.pocketOf), floodBudget: 0, floodMs: 0, floodLast: -1,
      rockRow: -1,
      boss: map.arena ? { state: createBoss(ROCKJAW), ev: createBossEvents(), active: false, x: map.arena.bossStart, target: map.arena.bossStart, buried: false, flipped: false, dustCol: -1, refill: map.arena.plugs.map(() => -1), defeatedAtMs: -1, phaseSeen: 0 } : null,
      liftOpen: !map.arena,
      ms: 0, accumulator: 0, ended: null, heroes: [], ev: newWorldEvents(), version: 0,
   };
   for (const b of w.boulders) w.tiles[idx(w, b.col, b.row)] = T.BOULDER;
   w.heroes = heroIds.slice(0, 4).map((id, i) => createHero(w, i, id));
   return w;
}

/** Solo convenience. */
export const createRun = (level: LevelId = 1, heroId: M2HeroId = "riko") => createWorld(level, [heroId]);

// ---------- heroes ----------

function award(w: World, h: Hero, base: number) {
   h.comboMs += comboHit(h.combo, COMBO, w.ms, base);
}

function hurt(w: World, h: Hero, kind: "crush" | "bite" | "gas" | "erupt" | "rubble") {
   if (h.act === "dead" || h.act === "won" || h.graceMs > 0) return;
   if (h.heroId === "kiro" && h.powerMs > 0) {
      h.powerMs = 0; // the shield takes the one hit
      h.graceMs = 600;
      return;
   }
   h.hits++;
   h.ev.hit = true;
   comboBreak(h.combo);
   h.graceMs = GRACE_MS;
   if (kind === "crush" || kind === "rubble") {
      h.act = "dead";
      h.deadMs = DEAD_MS;
      h.ev.died = true;
      h.riding = false;
      return;
   }
   // knocked back a cell if there is room, then a short stun
   const back = -h.facing;
   const c = h.col + back;
   h.act = "idle";
   h.riding = false;
   if (enterable(w, c, h.row, h) && !bossCell(w, c, h.row)) startMove(w, h, c, h.row, "walk", 180);
   h.cooldown = Math.max(h.cooldown, 0);
   h.stuckMs = 0;
   h.hangMs = 0;
   h.deadMs = -STUN_MS; // negative = stunned for this long
}

function respawn(w: World, h: Hero) {
   // the checkpoint: the last lit lantern still lit and above the rockfall line
   while (h.lit.length) {
      const i = h.lit[h.lit.length - 1];
      const r = Math.floor(i / w.w);
      if (w.lanternLit[i] && r > w.rockRow + 1 && isOpen(w.tiles[i])) break;
      h.lit.pop();
   }
   let c = w.map.start.col;
   let r = w.map.start.row;
   if (h.lit.length) {
      const i = h.lit[h.lit.length - 1];
      c = i % w.w;
      r = Math.floor(i / w.w);
   } else if (w.rockRow >= r) {
      // the rockfall buried the start: the first open cell under the line in the hero's column band
      const spot = openCellBelow(w, h.col, w.rockRow + 2);
      c = spot.col;
      r = spot.row;
   }
   h.col = h.fc = h.tc = c;
   h.row = h.fr = h.tr = r;
   h.px = c;
   h.py = r;
   h.act = "idle";
   h.vfall = 0;
   h.riding = false;
   h.rollDrop = false;
   h.hopLeft = 0;
   h.stuckMs = 0;
   h.ev.respawn = true;
}

function openCellBelow(w: World, col: number, fromRow: number): { col: number; row: number } {
   for (let r = Math.max(0, fromRow); r < w.h; r++) {
      for (let d = 0; d < w.w; d++) {
         for (const c of [col - d, col + d]) {
            if (!inside(w, c, r)) continue;
            if (isOpen(tileAt(w, c, r)) && !liftCell(w, c, r) && !isOpen(tileAt(w, c, r + 1))) return { col: c, row: r };
         }
      }
   }
   return { col: w.map.lift.col - 1, row: w.map.lift.row };
}

function startMove(w: World, h: Hero, c: number, r: number, act: HeroAct, ms: number) {
   h.fc = h.col;
   h.fr = h.row;
   h.tc = c;
   h.tr = r;
   h.t = 0;
   h.dur = Math.max(1, ms) / 1000;
   h.act = act;
   // the logical cell is the target as soon as the move starts (hazards see where the hero is going)
   h.col = c;
   h.row = r;
}

function inWater(w: World, h: Hero) {
   return tileAt(w, h.col, h.row) === T.WATER && !(h.heroId === "kiro" && h.powerMs > 0);
}

function walkMs(w: World, h: Hero, c: number, r: number): number {
   const speed = h.rolling ? ROLL : WALK;
   let ms = (CELL / speed) * 1000;
   if (inWater(w, h) || (tileAt(w, c, r) === T.WATER && !(h.heroId === "kiro" && h.powerMs > 0))) ms /= WATER_SLOW;
   return ms;
}

function startDig(w: World, h: Hero, c: number, r: number, move: boolean, up = false) {
   const t = tileAt(w, c, r);
   h.act = "dig";
   h.dc = c;
   h.dr = r;
   h.digT = 0;
   h.digDur = (digMsOf(t) * (up ? DIG_MS.up : 1)) / 1000;
   if (inWater(w, h)) h.digDur /= WATER_SLOW;
   h.digMove = move;
}

/** A cell dug out by a hero (or bored by a dash): the orb, the gas, the flood check. */
function clearCell(w: World, h: Hero | null, c: number, r: number) {
   const i = idx(w, c, r);
   const t = w.tiles[i];
   setTile(w, c, r, T.EMPTY);
   if (h) {
      h.ev.dig++;
      h.ev.digTile = t;
      if (w.orb[i] && t === T.ORE) {
         w.orb[i] = 0;
         gainOrb(w, h);
      }
      if (t === T.GAS && !(h.heroId === "kiro" && h.powerMs > 0)) hurt(w, h, "gas");
   }
   openPocketsNear(w, c, r);
}

function gainOrb(w: World, h: Hero) {
   h.orbs++;
   h.ev.orb++;
   award(w, h, COMBO_BASE_MS.orb);
}

function openPocketsNear(w: World, c: number, r: number) {
   for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const cc = c + dc;
      const rr = r + dr;
      if (!inside(w, cc, rr)) continue;
      const p = w.pocketOf[idx(w, cc, rr)];
      if (p >= 0 && !w.pocketOpened[p] && w.tiles[idx(w, cc, rr)] === T.WATER) {
         w.pocketOpened[p] = 1;
         w.floodBudget += w.map.pockets[p].volume;
         w.ev.flood++;
      }
   }
}

/** Arriving in a cell: orbs, secrets, lanterns, the lift, rails. */
function arrive(w: World, h: Hero) {
   const i = idx(w, h.col, h.row);
   if (w.orb[i] && isOpen(w.tiles[i])) {
      w.orb[i] = 0;
      gainOrb(w, h);
   }
   const s = w.secret[i];
   if (s) {
      // the L3 flooded room's shard counts only under Kiro's shield (the card)
      const needShield = w.map.shieldSecret === i;
      if (!needShield || (h.heroId === "kiro" && h.powerMs > 0)) {
         if (collectSecret(h.secrets, s - 1)) h.ev.secret = true;
      }
   }
   if (w.lantern[i] && isOpen(w.tiles[i])) {
      if (!w.lanternLit[i]) {
         w.lanternLit[i] = 1;
         h.ev.lantern = true;
      }
      if (h.lit[h.lit.length - 1] !== i) h.lit.push(i);
      h.cpCol = h.col;
      h.cpRow = h.row;
   }
   if (liftCell(w, h.col, h.row) && w.liftOpen && h.ended === null) {
      h.ended = "win";
      h.act = "won";
      h.finishMs = w.ms;
      h.ev.won = true;
   }
   if (w.rail[i] && !h.riding && h.act !== "won") {
      const seg = w.map.rails.find((s) => s.row === h.row && h.col >= s.c0 && h.col <= s.c1);
      if (seg) {
         // the cart runs to the line's far end
         h.riding = true;
         h.rideDir = h.col - seg.c0 >= seg.c1 - h.col ? -1 : 1;
         h.facing = h.rideDir as 1 | -1;
         h.ev.ride = true;
      }
   }
}

function heroBlocked(w: World, h: Hero): boolean {
   // nowhere to go: no side move, no step, nothing to dig, no room to hop
   for (const d of [-1, 1]) {
      const c = h.col + d;
      if (enterable(w, c, h.row, h) || isDiggable(tileAt(w, c, h.row))) return false;
      if (enterable(w, h.col, h.row - 1, h) && enterable(w, c, h.row - 1, h)) return false;
   }
   if (isDiggable(tileAt(w, h.col, h.row + 1)) || isDiggable(tileAt(w, h.col, h.row - 1))) return false;
   if (enterable(w, h.col, h.row - 1, h)) return false;
   return true;
}

function power(w: World, h: Hero, x: number, y: number) {
   if (h.cooldown > 0 || h.act === "dead" || h.act === "won") return;
   const airborne = h.act === "rise" || h.act === "hang" || h.act === "fall" || (h.act === "idle" && !supported(w, h));
   if (h.heroId === "nami") {
      if (!airborne || h.airJumped) return;
      h.airJumped = true;
      h.hopLeft = HOP.cells;
      h.hangMs = 0;
      h.vfall = 0;
      h.rollDrop = false;
      if (h.act === "fall") h.act = "idle";
      h.cooldown = POWER_COOLDOWN_MS.nami;
      h.ev.airJump = true;
      h.ev.power = true;
      return;
   }
   if (h.heroId === "riko") {
      if (h.act === "dig" || h.act === "climb" || h.act === "ride") return;
      // bore up to four cells: left / right with the stick, down with it held down, else ahead
      const dx = Math.abs(x) > 0.35 ? Math.sign(x) : y > 0.5 ? 0 : h.facing;
      const dy = dx === 0 ? 1 : 0;
      let c = h.col;
      let r = h.row;
      let n = 0;
      for (let k = 1; k <= DASH.cells; k++) {
         const cc = h.col + dx * k;
         const rr = h.row + dy * k;
         if (!inside(w, cc, rr) || bossCell(w, cc, rr) || liftCell(w, cc, rr)) break;
         const t = tileAt(w, cc, rr);
         if (isDiggable(t) || t === T.CRACKED) {
            if (t === T.CRACKED) w.ev.crack++;
            clearCell(w, h, cc, rr);
         } else if (!isOpen(t)) break;
         c = cc;
         r = rr;
         n = k;
      }
      h.cooldown = DASH.cooldownMs;
      h.powerMs = DASH.showMs;
      h.ev.power = true;
      h.ev.dash = true;
      if (n > 0) {
         if (dx !== 0) h.facing = dx as 1 | -1;
         h.riding = false;
         startMove(w, h, c, r, "dash", n * DASH.cellMs);
      }
      return;
   }
   h.powerMs = POWER_MS[h.heroId];
   h.cooldown = POWER_COOLDOWN_MS[h.heroId];
   h.ev.power = true;
}

function magnet(w: World, h: Hero) {
   for (let dr = -MAGNET_R; dr <= MAGNET_R; dr++) {
      for (let dc = -MAGNET_R; dc <= MAGNET_R; dc++) {
         const c = h.col + dc;
         const r = h.row + dr;
         if (!inside(w, c, r)) continue;
         const i = idx(w, c, r);
         // free orbs, and the orb trails sealed in rock: never an ore cell (that one is dug)
         if (w.orb[i] && w.tiles[i] !== T.ORE) {
            w.orb[i] = 0;
            gainOrb(w, h);
         }
      }
   }
}

function stepHero(w: World, h: Hero, input: StepInput, dt: number) {
   const ms = dt * 1000;
   h.cooldown = Math.max(0, h.cooldown - ms);
   h.powerMs = Math.max(0, h.powerMs - ms);
   h.graceMs = Math.max(0, h.graceMs - ms);
   comboTick(h.combo, COMBO, w.ms);
   if (h.ended) return;
   if (h.act === "dead") {
      h.deadMs -= ms;
      if (h.deadMs <= 0) respawn(w, h);
      return;
   }
   if (h.deadMs < 0) {
      // stunned
      h.deadMs = Math.min(0, h.deadMs + ms);
      if (h.act === "idle" && h.deadMs < 0) return;
   }
   const world = { x: 0, z: 0 };
   inputToWorld(input.x, 0, input.yaw, world);
   const x = Math.abs(world.x) > 0.35 ? Math.sign(world.x) : 0;
   const y = input.y > 0.5 ? 1 : input.y < -0.5 ? -1 : 0;
   const jump = h.pendingJump;
   const pw = h.pendingPower;
   h.pendingJump = false;
   h.pendingPower = false;
   if (pw) power(w, h, x, input.y);
   if (h.heroId === "zuno" && h.powerMs > 0) magnet(w, h);

   // a move in flight
   if (h.act === "walk" || h.act === "fall" || h.act === "rise" || h.act === "climb" || h.act === "dash" || h.act === "ride") {
      h.t += dt;
      const k = Math.min(1, h.t / h.dur);
      h.px = h.fc + (h.tc - h.fc) * k;
      h.py = h.fr + (h.tr - h.fr) * k;
      if (h.act === "fall" && y > 0) h.rollDrop = true;
      if (h.t < h.dur) return;
      const was = h.act;
      h.px = h.tc;
      h.py = h.tr;
      h.act = "idle";
      arrive(w, h);
      if (h.ended) return;
      if (was === "rise" && h.hopLeft <= 0) {
         h.act = "hang";
         h.hangMs = HOP.hangMs;
      }
      if (was === "rise" || was === "fall" || (was === "walk" && h.airMoves > 0)) {
         // landing check happens below with gravity
      }
   } else if (h.act === "dig") {
      h.digT += dt;
      if (h.digT < h.digDur) return;
      const t = tileAt(w, h.dc, h.dr);
      if (!isDiggable(t)) {
         h.act = "idle";
      } else {
         clearCell(w, h, h.dc, h.dr);
         h.act = "idle";
         if (h.ended) return;
         if (h.deadMs < 0) return; // gas knocked us back
      }
   }

   // the hop's apex: a short hang with air control (and Up digs while clinging)
   if (h.act === "hang") {
      h.hangMs -= ms;
      if (y > 0) h.rollDrop = true;
      if (x !== 0 && h.airMoves < HOP.airMoves && enterable(w, h.col + x, h.row, h)) {
         h.facing = x as 1 | -1;
         h.airMoves++;
         startMove(w, h, h.col + x, h.row, "walk", HOP.airMoveMs);
         return;
      }
      if (y < 0 && isDiggable(tileAt(w, h.col, h.row - 1))) {
         startDig(w, h, h.col, h.row - 1, false, true);
         return;
      }
      if (h.hangMs > 0 && !supported(w, h)) return;
      h.act = "idle";
   }
   if (h.act !== "idle") return;

   // rising
   if (h.hopLeft > 0) {
      if (enterable(w, h.col, h.row - 1, h)) {
         h.hopLeft--;
         startMove(w, h, h.col, h.row - 1, "rise", HOP.riseMs);
         return;
      }
      h.hopLeft = 0;
      h.act = "hang";
      h.hangMs = HOP.hangMs;
      return;
   }

   // riding a cart along a rail
   if (h.riding) {
      const c = h.col + h.rideDir;
      if (w.rail[idx(w, c, h.row)] && enterable(w, c, h.row, h)) {
         startMove(w, h, c, h.row, "ride", (CELL / RAIL_SPEED) * 1000);
         return;
      }
      h.riding = false;
   }

   // gravity
   if (!supported(w, h)) {
      // air control while falling: up to two side moves per jump or fall
      if (y > 0) h.rollDrop = true;
      if (x !== 0 && h.airMoves < HOP.airMoves && enterable(w, h.col + x, h.row, h) && h.vfall < FALL.max) {
         h.facing = x as 1 | -1;
         h.airMoves++;
         startMove(w, h, h.col + x, h.row, "walk", HOP.airMoveMs);
         return;
      }
      if (y > 0) h.rollDrop = true;
      const max = h.rollDrop ? FALL.drop : FALL.max;
      h.vfall = h.vfall <= 0 ? (h.rollDrop ? 16 : FALL.start) : Math.min(max, h.vfall + FALL.gain);
      let v = h.vfall;
      if (inWater(w, h)) v *= WATER_SLOW;
      startMove(w, h, h.col, h.row + 1, "fall", (CELL / v) * 1000);
      return;
   }
   if (h.vfall > 0 || h.airMoves > 0 || h.airJumped) {
      if (y > 0) h.rollDrop = true;
      h.ev.land = true;
      h.ev.landSpeed = h.vfall;
      rollDropLanding(w, h);
      h.vfall = 0;
      h.rollDrop = false;
      h.airMoves = 0;
      h.airJumped = false;
   }
   if (h.act !== "idle") return;
   if (h.deadMs < 0) return;

   // on the ground
   if (jump && enterable(w, h.col, h.row - 1, h)) {
      h.hopLeft = HOP.cells - 1;
      h.airMoves = 0;
      h.ev.hop = true;
      h.sideMs = 0;
      startMove(w, h, h.col, h.row - 1, "rise", HOP.riseMs);
      return;
   }
   if (x !== 0) {
      h.facing = x as 1 | -1;
      h.sideMs += ms;
      h.rolling = h.sideMs > ROLL_AFTER_MS;
      const c = h.col + x;
      const t = tileAt(w, c, h.row);
      if (enterable(w, c, h.row, h)) {
         startMove(w, h, c, h.row, "walk", walkMs(w, h, c, h.row));
         return;
      }
      if (isDiggable(t) && inside(w, c, h.row) && !bossCell(w, c, h.row)) {
         h.rolling = false;
         h.sideMs = 0;
         startDig(w, h, c, h.row, false);
         return;
      }
      // a step up onto a one-cell ledge
      if (enterable(w, h.col, h.row - 1, h) && enterable(w, c, h.row - 1, h)) {
         startMove(w, h, c, h.row - 1, "climb", CLIMB_MS);
         return;
      }
   } else {
      h.sideMs = 0;
      h.rolling = false;
   }
   if (y > 0) {
      const t = tileAt(w, h.col, h.row + 1);
      if (isDiggable(t) && !liftCell(w, h.col, h.row + 1)) {
         startDig(w, h, h.col, h.row + 1, false);
         return;
      }
   } else if (y < 0) {
      const t = tileAt(w, h.col, h.row - 1);
      if (isDiggable(t)) {
         startDig(w, h, h.col, h.row - 1, false, true);
         return;
      }
   }
   // a dig-out: boxed in for two seconds sends the hero back to the last lantern
   if (heroBlocked(w, h)) {
      h.stuckMs += ms;
      if (h.stuckMs >= STUCK_MS) respawn(w, h);
   } else h.stuckMs = 0;
}

function rollDropLanding(w: World, h: Hero) {
   const b = w.boss;
   if (!b || !b.active || !h.rollDrop) return;
   if (!bossCell(w, h.col, h.row + 1)) return;
   if (b.state.phase === 2 && b.flipped && b.state.step === "vulnerable") {
      const res = hitBoss(b.state, ROCKJAW, 1, b.ev);
      if (res !== "ignored") {
         h.ev.bossHit = true;
         w.ev.bossHit = true;
         award(w, h, COMBO_BASE_MS.boss);
         // bounce off the belly
         h.hopLeft = 1;
         h.airMoves = 0;
      }
   }
}

// ---------- boulders ----------

function boulderBlocked(w: World, c: number, r: number, self?: Boulder): boolean {
   if (!inside(w, c, r)) return true;
   if (liftCell(w, c, r)) return true;
   if (bossCell(w, c, r)) return false; // it falls onto the shell
   const t = tileAt(w, c, r);
   if (!isOpen(t)) return true;
   for (const b of w.boulders) if (b !== self && b.alive && b.state === "fall" && b.col === c && Math.floor(b.y) + 1 === r) return true;
   return false;
}

function stepBoulders(w: World, dt: number) {
   for (const b of w.boulders) {
      if (!b.alive) continue;
      if (b.state === "rest") {
         if (!boulderBlocked(w, b.col, b.row + 1) || bossCell(w, b.col, b.row + 1)) {
            if (bossCell(w, b.col, b.row + 1)) continue; // resting on the boss: it shrugs it off below
            b.state = "wobble";
            b.t = 0;
            w.ev.wobble++;
            w.ev.wobbleCol = b.col;
            w.ev.wobbleRow = b.row;
         }
         continue;
      }
      if (b.state === "wobble") {
         b.t += dt * 1000;
         if (boulderBlocked(w, b.col, b.row + 1) && !bossCell(w, b.col, b.row + 1)) {
            b.state = "rest";
            continue;
         }
         if (b.t >= BOULDER.wobbleMs) {
            b.state = "fall";
            b.y = b.row;
            b.v = BOULDER.start;
            setTile(w, b.col, b.row, T.EMPTY);
            w.ev.boulderFall++;
         }
         continue;
      }
      // falling
      b.v = Math.min(BOULDER.max, b.v + BOULDER.gain * dt);
      const before = Math.floor(b.y);
      b.y += (b.v * dt) / CELL;
      let r = Math.floor(b.y);
      for (let rr = before + 1; rr <= r; rr++) {
         if (crushCell(w, b, rr)) return;
         if (!b.alive) break;
         // the cell under the new row: land, or break a cracked floor
         if (boulderBlocked(w, b.col, rr + 1, b) || bossCell(w, b.col, rr + 1)) {
            const under = tileAt(w, b.col, rr + 1);
            if (bossCell(w, b.col, rr + 1)) {
               boulderOnBoss(w, b);
               break;
            }
            if (under === T.CRACKED) {
               setTile(w, b.col, rr + 1, T.EMPTY);
               w.ev.crack++;
               continue;
            }
            b.row = rr;
            b.y = rr;
            b.state = "rest";
            b.v = 0;
            setTile(w, b.col, rr, T.BOULDER);
            w.ev.boulderLand++;
            w.ev.landCol = b.col;
            w.ev.landRow = rr;
            r = rr;
            break;
         }
      }
      if (b.state === "fall") b.row = Math.floor(b.y);
   }
}

/** A falling boulder entering row rr: heroes and beetles in that cell are crushed. */
function crushCell(w: World, b: Boulder, rr: number): boolean {
   for (const h of w.heroes) {
      if (h.act === "dead" || h.ended) continue;
      if (h.col === b.col && (h.row === rr || Math.round(h.py) === rr)) hurt(w, h, "crush");
   }
   for (const be of w.beetles) {
      if (!be.alive) continue;
      if (be.col === b.col && be.row === rr) {
         be.alive = false;
         be.deadMs = 0;
         // the nearest hero gets the credit (the one who loosened it is usually there)
         let best: Hero | null = null;
         for (const h of w.heroes) if (!best || Math.abs(h.col - b.col) + Math.abs(h.row - rr) < Math.abs(best.col - b.col) + Math.abs(best.row - rr)) best = h;
         if (best) {
            best.ev.crushBeetle = true;
            award(w, best, COMBO_BASE_MS.crush);
         }
      }
   }
   return false;
}

function boulderOnBoss(w: World, b: Boulder) {
   b.alive = false;
   b.state = "rest";
   const boss = w.boss!;
   w.ev.boulderLand++;
   w.ev.landCol = b.col;
   w.ev.landRow = Math.floor(b.y);
   if (boss.state.phase < 2 && !boss.flipped) {
      const res = hitBoss(boss.state, ROCKJAW, 1, boss.ev);
      if (res !== "ignored") {
         w.ev.bossHit = true;
         let best: Hero | null = null;
         for (const h of w.heroes) if (!h.ended && (!best || Math.abs(h.col - b.col) < Math.abs(best.col - b.col))) best = h;
         if (best) {
            best.ev.bossHit = true;
            award(w, best, COMBO_BASE_MS.boss);
         }
      }
   }
}

// ---------- beetles ----------

function beetleFree(w: World, c: number, r: number): boolean {
   if (!inside(w, c, r) || liftCell(w, c, r)) return false;
   // a beetle never walks or drops onto a hero: it waits or turns (a bite is the hero walking into it)
   for (const h of w.heroes) if (!h.ended && h.act !== "dead" && h.col === c && h.row === r) return false;
   return isOpen(tileAt(w, c, r)) && !bossCell(w, c, r);
}

function stepBeetles(w: World, dt: number) {
   const ms = dt * 1000;
   for (const b of w.beetles) {
      if (!b.alive) {
         if (b.deadMs >= 0) b.deadMs += ms;
         continue;
      }
      if (b.row <= w.rockRow) {
         b.alive = false;
         b.deadMs = 0;
         continue;
      }
      if (b.moving) {
         b.t += dt;
         if (b.t >= b.dur) b.moving = false;
         else continue;
      }
      if (b.waitMs > 0) {
         b.waitMs -= ms;
         continue;
      }
      if (beetleFree(w, b.col, b.row + 1)) {
         beetleMove(b, b.col, b.row + 1, BEETLE.fallMs);
         continue;
      }
      const c = b.col + b.dir;
      // a beetle turns at a ledge: it never walks off into a shaft (it only drops when its own floor is dug)
      if (beetleFree(w, c, b.row) && !beetleFree(w, c, b.row + 1)) {
         beetleMove(b, c, b.row, (CELL / BEETLE.speed) * 1000);
         continue;
      }
      const t = tileAt(w, c, b.row);
      if (b.tunneller && (t === T.SOFT || t === T.PACKED) && inside(w, c, b.row) && c > 0 && c < w.w - 1) {
         b.digMs += ms;
         if (b.digMs >= (t === T.SOFT ? BEETLE.digSoftMs : BEETLE.digPackedMs)) {
            b.digMs = 0;
            setTile(w, c, b.row, T.EMPTY);
            openPocketsNear(w, c, b.row);
         }
         continue;
      }
      b.dir = -b.dir as 1 | -1;
      b.waitMs = BEETLE.turnMs;
   }
   // bites
   for (const h of w.heroes) {
      if (h.act === "dead" || h.ended || h.graceMs > 0) continue;
      for (const b of w.beetles) {
         if (!b.alive) continue;
         if (b.col === h.col && b.row === h.row) {
            h.facing = (h.col >= b.fc ? -1 : 1) as 1 | -1;
            hurt(w, h, "bite");
            break;
         }
      }
   }
}

function beetleMove(b: Beetle, c: number, r: number, ms: number) {
   b.fc = b.col;
   b.fr = b.row;
   b.col = c;
   b.row = r;
   b.t = 0;
   b.dur = ms / 1000;
   b.moving = true;
}

// ---------- water ----------

function stepFlood(w: World, dt: number) {
   if (w.floodBudget <= 0) return;
   w.floodMs += dt * 1000;
   while (w.floodMs >= FLOOD_MS && w.floodBudget > 0) {
      w.floodMs -= FLOOD_MS;
      // the lowest open cell touching the water (ties: nearest the last one filled)
      let best = -1;
      let bestRow = -1;
      let bestD = Infinity;
      for (let i = 0; i < w.tiles.length; i++) {
         if (w.tiles[i] !== T.WATER) continue;
         const c = i % w.w;
         const r = Math.floor(i / w.w);
         for (const [dc, dr] of [[0, 1], [1, 0], [-1, 0]]) {
            const cc = c + dc;
            const rr = r + dr;
            if (!inside(w, cc, rr)) continue;
            const j = idx(w, cc, rr);
            if (w.tiles[j] !== T.EMPTY || liftCell(w, cc, rr)) continue;
            if (boulderAt(w, cc, rr)) continue;
            const d = w.floodLast < 0 ? 0 : Math.abs((w.floodLast % w.w) - cc);
            if (rr > bestRow || (rr === bestRow && d < bestD)) {
               best = j;
               bestRow = rr;
               bestD = d;
            }
         }
      }
      if (best < 0) {
         w.floodBudget = 0;
         return;
      }
      w.tiles[best] = T.WATER;
      w.version++;
      w.floodLast = best;
      w.floodBudget--;
      w.ev.flood++;
      if (w.lantern[best]) w.lanternLit[best] = 0; // the water puts it out
   }
}

// ---------- the rockfall (L4) ----------

function stepRockfall(w: World) {
   const rf = w.cfg.rockfall;
   if (!rf) return;
   const row = Math.floor((w.ms - rf.startMs) / rf.rowMs);
   while (w.rockRow < Math.min(row, w.h - 1)) {
      w.rockRow++;
      const r = w.rockRow;
      for (let c = 1; c < w.w - 1; c++) {
         const i = idx(w, c, r);
         const t = w.tiles[i];
         if (t === T.ROCK || t === T.BEDROCK || liftCell(w, c, r)) continue;
         w.tiles[i] = T.RUBBLE;
         w.orb[i] = 0;
         w.lanternLit[i] = 0;
         for (const b of w.boulders) if (b.alive && b.col === c && b.row === r) b.alive = false;
      }
      w.version++;
      w.ev.rockfall++;
      for (const h of w.heroes) if (!h.ended && h.act !== "dead" && h.row <= r) {
         h.graceMs = 0;
         hurt(w, h, "rubble");
      }
   }
}

// ---------- Rockjaw (L5) ----------

function stepRockjaw(w: World, dt: number) {
   const b = w.boss;
   if (!b) return;
   const a = w.map.arena!;
   if (!b.active) {
      if (w.heroes.some((h) => !h.ended && h.row >= a.gallery && h.act !== "dead")) {
         b.active = true;
         b.ev = createBossEvents();
      } else return;
   }
   const before = b.state.step;
   const ev = b.ev;
   for (const k of Object.keys(ev) as (keyof BossEvents)[]) ev[k] = false;
   stepBoss(b.state, ROCKJAW, dt * 1000, ev);
   if (ev.defeated || (b.state.hp === 0 && b.defeatedAtMs < 0)) {
      b.defeatedAtMs = w.ms;
      w.liftOpen = true;
      w.ev.liftOpen = true;
      w.ev.bossDefeated = true;
   }
   if (b.state.phase !== b.phaseSeen) {
      b.phaseSeen = b.state.phase;
      w.ev.bossPhase = true;
      if (b.state.phase === 2) {
         // the ceiling gives: every plug and boulder above the chamber drops away, the chutes stand open
         for (const p of a.plugs) {
            setTile(w, p, a.gallery, T.EMPTY);
            for (const bo of w.boulders) if (bo.alive && bo.col === p && bo.row < a.gallery) {
               bo.alive = false;
               setTile(w, p, bo.row, T.EMPTY);
            }
         }
         b.flipped = true;
         b.buried = false;
      }
   }
   const hero = nearestHero(w);
   const step = b.state.step;
   if (step !== before) {
      if (step === "telegraph") {
         w.ev.bossTelegraph = true;
         if (b.state.phase === 0) b.target = plugNear(a, hero ? hero.col : b.x);
         else if (b.state.phase === 1) {
            b.buried = true;
            b.target = clampArena(a, hero ? hero.col : b.x);
            b.dustCol = b.target;
         } else {
            // flipped: it scrabbles away from the hero to the far half of the chamber
            const mid = (a.x0 + a.x1) / 2;
            b.target = hero && hero.col < mid ? a.x1 - 3 : a.x0 + 3;
         }
      }
      if (step === "attack") {
         w.ev.bossAttack = true;
         if (b.state.phase === 1) {
            b.x = b.target;
            b.buried = false;
            b.dustCol = -1;
         }
      }
   }
   // movement: it charges (P1) or slides (P3) toward its target during the attack
   if (step === "attack" && b.state.phase !== 1) {
      const d = b.target - b.x;
      const v = (b.state.phase === 0 ? 7 : 5) / CELL;
      b.x += Math.sign(d) * Math.min(Math.abs(d), v * dt);
   }
   if (step === "telegraph" && b.state.phase === 2) b.x += Math.sign(b.target - b.x) * Math.min(Math.abs(b.target - b.x), (4 / CELL) * dt);
   // it shoves the boulders on the chamber floor aside (they shatter)
   if (!b.buried) {
      for (const bo of w.boulders) {
         if (!bo.alive || bo.state !== "rest") continue;
         if (bo.row >= a.floor - 1 && bo.row <= a.floor && Math.abs(bo.col - Math.round(b.x)) <= 1) {
            bo.alive = false;
            setTile(w, bo.col, bo.row, T.EMPTY);
            w.ev.crack++;
         }
      }
   }
   // hazards: the charge, the eruption and the flailing legs
   if (step === "attack") {
      for (const h of w.heroes) {
         if (h.ended || h.act === "dead") continue;
         const near = Math.abs(h.col - b.x) <= (b.state.phase === 2 ? 2 : 1.5);
         if (b.state.phase === 1) {
            // the eruption bursts up through the gallery floor under the target column
            if (Math.abs(h.col - b.target) <= 1 && h.row >= a.gallery) hurt(w, h, "erupt");
         } else if (near && h.row >= a.floor - 2) hurt(w, h, "bite");
      }
   }
   // the plug boulders come back from the hopper
   if (b.state.phase < 2) {
      a.plugs.forEach((p, i) => {
         const there = w.boulders.some((bo) => bo.alive && bo.col === p && bo.row <= a.gallery);
         if (there) {
            b.refill[i] = -1;
            return;
         }
         if (b.refill[i] < 0) b.refill[i] = w.ms;
         if (w.ms - b.refill[i] < ARENA.refillMs) return;
         if (tileAt(w, p, a.gallery - 1) !== T.EMPTY && tileAt(w, p, a.gallery - 1) !== T.ROCK) return;
         if (w.heroes.some((h) => h.col === p && (h.row === a.gallery || h.row === a.gallery - 1))) return;
         if (w.boulders.some((bo) => bo.alive && bo.col === p && bo.state === "fall")) return;
         setTile(w, p, a.gallery, T.SOFT);
         setTile(w, p, a.gallery - 1, T.BOULDER);
         w.boulders.push({ col: p, row: a.gallery - 1, state: "rest", t: 0, y: a.gallery - 1, v: 0, alive: true });
         b.refill[i] = -1;
      });
   }
}

function nearestHero(w: World): Hero | null {
   let best: Hero | null = null;
   for (const h of w.heroes) if (!h.ended && h.act !== "dead" && (!best || h.row > best.row)) best = h;
   return best;
}

const clampArena = (a: NonNullable<ParsedLevel["arena"]>, c: number) => Math.max(a.x0 + 1, Math.min(a.x1 - 1, Math.round(c)));

function plugNear(a: NonNullable<ParsedLevel["arena"]>, c: number): number {
   let best = a.plugs[0];
   for (const p of a.plugs) if (Math.abs(p - c) < Math.abs(best - c)) best = p;
   return clampArena(a, best);
}

// ---------- the step ----------

const edges = new WeakMap<Hero, { jump: boolean; power: boolean }>();

export function stepWorld(w: World, dtMs: number, inputs: readonly StepInput[]) {
   for (const h of w.heroes) {
      const e = h.ev;
      for (const k of Object.keys(e) as (keyof HeroEvents)[]) (e as unknown as Record<string, number | boolean>)[k] = typeof e[k] === "number" ? 0 : false;
   }
   const we = w.ev;
   for (const k of Object.keys(we) as (keyof WorldEvents)[]) (we as unknown as Record<string, number | boolean>)[k] = typeof we[k] === "number" ? 0 : false;
   if (w.ended || !Number.isFinite(dtMs) || dtMs <= 0) return;
   w.accumulator += Math.min(250, dtMs);
   w.heroes.forEach((h, k) => {
      const i = inputs[k];
      if (!i) return;
      let p = edges.get(h);
      if (!p) edges.set(h, (p = { jump: false, power: false }));
      p.jump ||= i.jump;
      p.power ||= i.power;
   });
   while (w.accumulator + 1e-7 >= FIXED_MS && !w.ended) {
      quantum(w, inputs, FIXED_MS / 1000);
      w.accumulator -= FIXED_MS;
   }
}

function quantum(w: World, inputs: readonly StepInput[], dt: number) {
   w.ms += dt * 1000;
   if (w.ms >= w.cfg.durationMs) {
      w.ended = "timeup";
      for (const h of w.heroes) if (!h.ended) h.ended = "timeup";
      return;
   }
   w.heroes.forEach((h, k) => {
      const p = edges.get(h);
      const i = inputs[k] ?? idleInput();
      if (p) {
         h.pendingJump ||= p.jump;
         h.pendingPower ||= p.power;
         p.jump = p.power = false;
      }
      stepHero(w, h, sanitize(i), dt);
   });
   stepBoulders(w, dt);
   stepBeetles(w, dt);
   stepFlood(w, dt);
   stepRockfall(w);
   stepRockjaw(w, dt);
   if (w.heroes.every((h) => h.ended !== null)) w.ended = w.heroes.some((h) => h.ended === "win") ? "win" : "timeup";
}

function sanitize(i: StepInput): StepInput {
   const f = (v: number) => (Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);
   return { x: f(i.x), y: f(i.y), yaw: Number.isFinite(i.yaw) ? i.yaw : 0, jump: !!i.jump, power: !!i.power };
}

/** Solo convenience: one input for hero 0. */
export function step(w: World, dtMs: number, input: StepInput) {
   stepWorld(w, dtMs, [input]);
}

// ---------- scoring and limits ----------

/** The time a player sees and submits: finish ms minus the orb bonus and the flow bonus, never below 0. */
export function runTimeMs(finishMs: number, orbs: number, comboMs = 0): number {
   return Math.max(0, Math.round(finishMs - orbs * ORB_BONUS_MS - comboMs));
}
export const submittedMs = (h: Hero) => runTimeMs(h.finishMs, h.orbs, h.comboMs);

/** Every orb the level holds: ore cells, free orbs and the orb trails in rock. */
export function orbTotal(level: LevelId): number {
   const m = parseLevel(LEVELS[level]);
   let n = 0;
   for (const o of m.orb) n += o;
   return n;
}

/** What the level can feed the flow meter: every orb, every beetle crushed, every boss hit. */
export function comboSpecOf(level: LevelId): ComboLevelSpec {
   const m = parseLevel(LEVELS[level]);
   return {
      combo: COMBO,
      sources: [
         { count: orbTotal(level), base: COMBO_BASE_MS.orb },
         { count: m.beetles.length, base: COMBO_BASE_MS.crush },
         { count: m.arena ? ROCKJAW.maxHp : 0, base: COMBO_BASE_MS.boss },
      ],
   };
}

/**
 * The fewest cells any route from the start to `goal` crosses (4-neighbour steps), with rock and
 * bedrock as walls. Soil, ore, gas, cracked and ghost rock, boulders and water all count as passable,
 * so no power, dig order or tunnelling beetle can beat it.
 */
export function shortestCells(m: ParsedLevel, from: { col: number; row: number }, goal: (c: number, r: number) => boolean): number {
   const dist = new Int32Array(m.w * m.h).fill(-1);
   const q: number[] = [from.row * m.w + from.col];
   dist[q[0]] = 0;
   for (let head = 0; head < q.length; head++) {
      const i = q[head];
      const c = i % m.w;
      const r = Math.floor(i / m.w);
      if (goal(c, r)) return dist[i];
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
         const cc = c + dc;
         const rr = r + dr;
         if (cc < 0 || rr < 0 || cc >= m.w || rr >= m.h) continue;
         const j = rr * m.w + cc;
         if (dist[j] >= 0) continue;
         const t = m.tiles[j];
         if (t === T.ROCK || t === T.BEDROCK || t === T.RUBBLE) continue;
         dist[j] = dist[i] + 1;
         q.push(j);
      }
   }
   return Infinity;
}

/** The earliest rules ms Rockjaw can be down once it wakes: every vulnerable window hit at its first ms. */
export function bossMinMs(): number {
   const s = createBoss(ROCKJAW);
   const ev = createBossEvents();
   for (let ms = 1; ms < 600_000; ms++) {
      stepBoss(s, ROCKJAW, 1, ev);
      if (s.step === "vulnerable") hitBoss(s, ROCKJAW, 1, ev);
      if (s.step === "defeat" || s.step === "done") return ms;
   }
   return Infinity;
}

/** The least finish ms: the cells to the lift at the fastest crossing; on L5 the boss's floor too. */
export function minFinishMs(level: LevelId): number {
   const m = parseLevel(LEVELS[level]);
   const toLift = shortestCells(m, m.start, (c, r) => c === m.lift.col && r === m.lift.row) * MIN_CELL_MS;
   if (!m.arena) return toLift;
   const toArena = shortestCells(m, m.start, (_c, r) => r >= m.arena!.gallery) * MIN_CELL_MS;
   return Math.max(toLift, toArena + bossMinMs() - 10);
}

export function minDurationMsOf(level: LevelId): number {
   return Math.max(0, minFinishMs(level) - orbTotal(level) * ORB_BONUS_MS - comboMaxBonus(comboSpecOf(level)));
}

export interface LevelLimits {
   kind: "time";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   timeBaseMs: number;
}

/** minDurationMs = the proven bound rounded down to 100 ms (at least 100 ms). */
export function proposeLimits(id: LevelId): LevelLimits {
   const lb = minDurationMsOf(id);
   const minDurationMs = Math.max(100, Math.floor(lb / 100) * 100);
   const timeBaseMs = LEVELS[id].durationMs;
   return { kind: "time", maxScore: Math.floor((timeBaseMs - minDurationMs) / 10), minDurationMs, maxDurationMs: timeBaseMs, timeBaseMs };
}

export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = {
   1: proposeLimits(1),
   2: proposeLimits(2),
   3: proposeLimits(3),
   4: proposeLimits(4),
   5: proposeLimits(5),
};

export const STAT = {
   orbs: "orbs",
   finishMs: "finishMs",
   comboMs: "comboMs",
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
   depth: "depth",
   power: "power",
   bossHp: "bossHp",
   bossPhase: "bossPhase",
   bossOpen: "bossOpen",
   bossFlash: "bossFlash",
   hits: "hits",
   stars: "stars",
   newStars: "newStars",
   noHit: "noHit",
   secrets: "secrets",
   newSecrets: "newSecrets",
   xp: "xp",
   coach: "coach",
} as const;

export function finalScore(s: { score: number; endReason: string | null; stats: Record<string, number>; elapsedMs: number }): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.orbs] ?? 0, s.stats[STAT.comboMs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}
