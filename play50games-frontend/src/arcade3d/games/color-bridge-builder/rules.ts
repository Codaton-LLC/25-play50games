// Color Bridge Builder rules: pure, deterministic, stepped at a fixed 120 Hz. One team per player: five
// heroes, one of them active (Tag swaps to another). The hero moves cell to cell across rock isles; the
// beams are recomputed every quantum from the nodes (colour, timer), prisms, blockers (Kiro's shield,
// drones) and anchors; a beam that ends on an anchor lights a bridge over every chasm cell it crosses.
// Where beams cross, the colour after the crossing is the union of their colours. Standing on a bridge
// the active hero cannot walk (or on the chasm, or on an orange bridge in its dark half-beat) drops the
// hero; it reappears on its last rock cell a second later. L5: the Bridge Keeper (progression.ts).
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "../../menu2/boss/boss";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "../../menu2/combo/combo";
import { collectSecret, createSecretTracker, type SecretTracker } from "../../menu2/secrets/secrets";
import { M2_HERO_IDS, type M2HeroId } from "../../menu2/heroModels";
import type { LevelId } from "../../types";
import { DC, DR, LEVELS, T, parseLevel, type BridgeLevel, type Dir, type ParsedLevel } from "./levels";
import { COMBO, COMBO_BASE_MS, KEEPER, SECRETS } from "./progression";

export const FIXED_MS = 1000 / 120;
/** a step from one cell to the next */
export const STEP_MS = 190;
export const FALL_MS = 1000;
export const FLICKER_MS = 800;
export const TAG_MS = 150;
/** a prism turns once per push: holding against it turns it again only after this long */
export const BUMP_MS = 350;
export const DASH = { cells: 3, ms: 300, cooldownMs: 1500 } as const;
export const LEAP = { cells: 2, ms: 360, cooldownMs: 600 } as const;
export const POWER_MS = { kiro: 3000, vexa: 1500 } as const;
export const POWER_COOLDOWN_MS = { riko: DASH.cooldownMs, nami: LEAP.cooldownMs, kiro: 5000, zuno: 900, vexa: 4000 } as const;
export const MAGNET_REACH = 4;
export const ORB_BONUS_MS = 400;
/** the fastest a hero ever covers one cell (a dash) */
export const MIN_CELL_MS = DASH.ms / DASH.cells;

/** the colour each hero walks (red Riko, blue Nyla, yellow Zuno, purple Vexa, green Kiro) */
export const HERO_MASK: Record<M2HeroId, number> = { riko: 1, nami: 2, zuno: 4, vexa: 3, kiro: 6 };
export const MASK_NAME: Record<number, string> = { 0: "dark", 1: "red", 2: "blue", 4: "yellow", 3: "purple", 6: "green", 5: "orange", 7: "white" };

export interface StepInput {
   /** a one-frame move press, or a held direction: dr / dc in -1..1 (one of them 0) */
   dr: number;
   dc: number;
   /** Tag: -1 = the hero who walks the cell ahead (else the next one), 1..5 = that hero (M2_HERO_IDS order), 0 = none */
   tag: number;
   action: boolean;
}
export const idleInput = (): StepInput => ({ dr: 0, dc: 0, tag: 0, action: false });

export interface Beam {
   node: number;
   /** the cells it lights, in order, and its colour mask on each */
   cells: number[];
   colors: number[];
   anchored: boolean;
   /** where it ends: a prism / rock / plate cell index, or -1 off the map */
   end: number;
}

export interface Drone {
   r: number;
   c: number;
   seg: number;
   t: number;
   dir: 1 | -1;
}

export interface TeamEvents {
   step: boolean;
   tag: boolean;
   fell: boolean;
   respawn: boolean;
   switched: number;
   rotated: boolean;
   slid: boolean;
   broke: boolean;
   orb: boolean;
   secret: boolean;
   power: boolean;
   won: boolean;
   bossHit: boolean;
   stomped: boolean;
}
const newEvents = (): TeamEvents => ({ step: false, tag: false, fell: false, respawn: false, switched: -1, rotated: false, slid: false, broke: false, orb: false, secret: false, power: false, won: false, bossHit: false, stomped: false });

export interface Keeper {
   state: BossState;
   ev: BossEvents;
   active: boolean;
   /** the colour its plate wants this window */
   wants: number;
   /** the row its stomp hits (telegraph / attack) */
   stompRow: number;
   /** P2: a node its arm laser has greyed, and until when */
   greyNode: number;
   greyUntil: number;
   cycles: number;
}

export interface Team {
   index: number;
   heroId: M2HeroId;
   r: number;
   c: number;
   /** the move in progress (from -> to) */
   fr: number;
   fc: number;
   moveMs: number;
   moveDur: number;
   moving: "walk" | "dash" | "leap" | null;
   facing: Dir;
   safeR: number;
   safeC: number;
   fallMs: number;
   tagMs: number;
   bumpMs: number;
   cooldown: number;
   powerMs: number;
   orbsTaken: Uint8Array;
   orbs: number;
   falls: number;
   ended: "win" | "timeup" | null;
   finishMs: number;
   combo: ComboState;
   comboMs: number;
   secrets: SecretTracker;
   ev: TeamEvents;
}

export interface World {
   level: LevelId;
   cfg: BridgeLevel;
   map: ParsedLevel;
   tiles: Uint8Array;
   /** node colour masks now, and (timed nodes) when they go dark */
   nodeColor: number[];
   nodeUntil: number[];
   /** prism orientation per prism (0 "/", 1 "\") and cell */
   prismCell: number[];
   prismKind: number[];
   drones: Drone[];
   beams: Beam[];
   /** the bridge mask on every cell (0: none) */
   bridge: Uint8Array;
   teams: Team[];
   keeper: Keeper | null;
   exitOpen: boolean;
   ms: number;
   accumulator: number;
   ended: "win" | "timeup" | null;
   version: number;
}

function createTeam(w: World, index: number, heroId: M2HeroId): Team {
   const [r, c] = w.map.start;
   return {
      index, heroId, r, c, fr: r, fc: c, moveMs: 0, moveDur: 0, moving: null, facing: 0, safeR: r, safeC: c, fallMs: 0, tagMs: 0, bumpMs: 0, cooldown: 0, powerMs: 0,
      orbsTaken: new Uint8Array(w.map.orbs.length), orbs: 0, falls: 0, ended: null, finishMs: 0, combo: createCombo(), comboMs: 0, secrets: createSecretTracker(SECRETS), ev: newEvents(),
   };
}

export function createWorld(level: LevelId = 1, heroIds: readonly M2HeroId[] = ["riko"]): World {
   const cfg = LEVELS[level];
   const map = parseLevel(cfg);
   const w: World = {
      level, cfg, map, tiles: map.tiles.slice(),
      nodeColor: cfg.nodes.map((n) => n.color), nodeUntil: cfg.nodes.map(() => Infinity),
      prismCell: map.prisms.map(([r, c]) => r * map.w + c), prismKind: map.prisms.map((p) => p[2]),
      drones: cfg.drones.map((d) => ({ r: d.path[0][0], c: d.path[0][1], seg: 0, t: 0, dir: 1 })),
      beams: [], bridge: new Uint8Array(map.w * map.h), teams: [],
      keeper: cfg.boss ? { state: createBoss(KEEPER), ev: createBossEvents(), active: false, wants: 1, stompRow: -1, greyNode: -1, greyUntil: 0, cycles: 0 } : null,
      exitOpen: !cfg.boss, ms: 0, accumulator: 0, ended: null, version: 0,
   };
   w.teams = heroIds.slice(0, 4).map((id, i) => createTeam(w, i, id));
   computeBeams(w);
   return w;
}
export const createRun = (level: LevelId = 1, heroId: M2HeroId = "riko") => createWorld(level, [heroId]);

// ---------- cells ----------

export const tileAt = (w: World, r: number, c: number) => (r < 0 || c < 0 || r >= w.map.h || c >= w.map.w ? -1 : w.tiles[r * w.map.w + c]);
const blocksWalk = (t: number) => t === T.PRISM || t === T.CRACKED || t === T.PLATE || t < 0;
export const flickerOn = (ms: number) => Math.floor(ms / FLICKER_MS) % 2 === 0;

/** Can this hero stand on (r, c) right now? */
export function walkable(w: World, team: Team, r: number, c: number, hero: M2HeroId = team.heroId): boolean {
   const t = tileAt(w, r, c);
   if (t === T.EXIT) return w.exitOpen;
   if (t !== T.CHASM) return !blocksWalk(t);
   const m = w.bridge[r * w.map.w + c];
   if (!m) return false;
   if (m === 7) return true;
   // Vexa's phase walks any light, even an orange bridge's dark beat
   if (hero === "vexa" && team.powerMs > 0) return true;
   if (m === 5) return flickerOn(w.ms);
   return m === HERO_MASK[hero];
}

/** the hero who walks a bridge mask (orange and white: anyone, so null) */
export function heroForMask(m: number): M2HeroId | null {
   for (const id of M2_HERO_IDS) if (HERO_MASK[id] === m) return id;
   return null;
}

// ---------- beams ----------

const PRISM_TURN: Record<number, Dir[]> = {
   // "/": N->E, E->N, S->W, W->S ; "\": N->W, W->N, S->E, E->S
   0: [1, 0, 3, 2],
   1: [3, 2, 1, 0],
};

export function computeBeams(w: World) {
   const { map } = w;
   const W = map.w;
   const blockers = new Set<number>();
   for (const t of w.teams) if (t.heroId === "kiro" && t.powerMs > 0 && !t.moving) blockers.add(t.r * W + t.c);
   for (const d of w.drones) blockers.add(Math.round(d.r) * W + Math.round(d.c));
   const beams: Beam[] = [];
   map.nodes.forEach(([nr, nc], i) => {
      const color = w.keeper && w.keeper.greyNode === i && w.ms < w.keeper.greyUntil ? 0 : w.nodeColor[i];
      if (!color) return;
      let dir = w.cfg.nodes[i].dir;
      let r = nr;
      let c = nc;
      const b: Beam = { node: i, cells: [], colors: [], anchored: false, end: -1 };
      for (let n = 0; n < 200; n++) {
         r += DR[dir];
         c += DC[dir];
         const t = tileAt(w, r, c);
         if (t < 0) break;
         const k = r * W + c;
         if (blockers.has(k)) {
            b.end = k;
            break;
         }
         if (t === T.PRISM) {
            b.cells.push(k);
            dir = PRISM_TURN[w.prismKind[w.prismCell.indexOf(k)]][dir];
            continue;
         }
         if (t === T.ANCHOR || t === T.PLATE) {
            b.end = k;
            b.anchored = t === T.ANCHOR;
            b.cells.push(k);
            break;
         }
         if (t === T.CRACKED || t === T.NODE) {
            b.end = k;
            break;
         }
         b.cells.push(k);
      }
      b.colors = b.cells.map(() => color);
      beams.push(b);
   });
   // crossings: past a cell another beam lights, a beam carries both colours (a few passes settle chains)
   for (let pass = 0; pass < 4; pass++) {
      const at = new Map<number, number>();
      for (const b of beams) b.cells.forEach((k, i) => at.set(k, (at.get(k) ?? 0) | b.colors[i]));
      for (const b of beams) {
         let m = w.nodeColor[b.node];
         b.cells.forEach((k, i) => {
            m |= at.get(k) ?? 0;
            b.colors[i] = m;
         });
      }
   }
   w.bridge.fill(0);
   for (const b of beams) {
      if (!b.anchored) continue;
      b.cells.forEach((k, i) => {
         if (w.tiles[k] === T.CHASM) w.bridge[k] |= b.colors[i];
      });
   }
   w.beams = beams;
}

/** The colour reaching the Keeper's plate (0: none). */
export function plateColor(w: World): number {
   const p = w.map.plate;
   if (!p) return 0;
   const k = p[0] * w.map.w + p[1];
   let m = 0;
   for (const b of w.beams) if (b.end === k) m |= b.colors[b.colors.length - 1] ?? 0;
   return m;
}

// ---------- the team ----------

function award(w: World, t: Team, base: number) {
   t.comboMs += comboHit(t.combo, COMBO, w.ms, base);
}

function fall(t: Team) {
   if (t.fallMs > 0) return;
   t.fallMs = FALL_MS;
   t.falls++;
   t.moving = null;
   t.ev.fell = true;
   comboBreak(t.combo);
}

function arrive(w: World, t: Team) {
   const W = w.map.w;
   const tile = tileAt(w, t.r, t.c);
   if (!walkable(w, t, t.r, t.c)) {
      fall(t);
      return;
   }
   if (tile !== T.CHASM) {
      t.safeR = t.r;
      t.safeC = t.c;
   }
   if (tile === T.SWITCH) {
      const s = w.map.switches.find(([r, c]) => r === t.r && c === t.c)!;
      const node = w.cfg.nodes[s[2]];
      const cyc = node.cycle ?? [node.color];
      w.nodeColor[s[2]] = cyc[(cyc.indexOf(w.nodeColor[s[2]]) + 1) % cyc.length];
      if (node.timedMs) w.nodeUntil[s[2]] = w.ms + node.timedMs;
      t.ev.switched = s[2];
      w.version++;
   }
   w.map.orbs.forEach(([r, c], i) => {
      if (t.orbsTaken[i] || r !== t.r || c !== t.c) return;
      t.orbsTaken[i] = 1;
      t.orbs++;
      t.ev.orb = true;
      award(w, t, COMBO_BASE_MS.orb);
   });
   if (w.map.secret && w.map.secret[0] === t.r && w.map.secret[1] === t.c && collectSecret(t.secrets, w.cfg.secret)) t.ev.secret = true;
   if (tile === T.EXIT && w.exitOpen && !t.ended) {
      t.ended = "win";
      t.finishMs = w.ms;
      t.ev.won = true;
   }
   void W;
}

function startMove(w: World, t: Team, dir: Dir, kind: "walk" | "dash" | "leap") {
   const cells = kind === "walk" ? 1 : kind === "dash" ? DASH.cells : LEAP.cells;
   let r = t.r;
   let c = t.c;
   for (let n = 1; n <= cells; n++) {
      const nr = t.r + DR[dir] * n;
      const nc = t.c + DC[dir] * n;
      const tile = tileAt(w, nr, nc);
      if (tile < 0) break;
      if (tile === T.CRACKED && kind === "dash") {
         w.tiles[nr * w.map.w + nc] = T.ROCK;
         t.ev.broke = true;
         w.version++;
      } else if (blocksWalk(tile)) break;
      r = nr;
      c = nc;
   }
   if (r === t.r && c === t.c) {
      // bumped: a prism turns 90 degrees
      const nr = t.r + DR[dir];
      const nc = t.c + DC[dir];
      if (kind === "walk" && tileAt(w, nr, nc) === T.PRISM && t.bumpMs === 0) {
         t.bumpMs = BUMP_MS;
         const i = w.prismCell.indexOf(nr * w.map.w + nc);
         w.prismKind[i] ^= 1;
         t.ev.rotated = true;
         w.version++;
      }
      return;
   }
   t.fr = t.r;
   t.fc = t.c;
   t.r = r;
   t.c = c;
   t.moving = kind;
   t.moveMs = 0;
   t.moveDur = kind === "walk" ? STEP_MS : kind === "dash" ? DASH.ms : LEAP.ms;
   t.ev.step = true;
}

function power(w: World, t: Team) {
   if (t.cooldown > 0) return;
   switch (t.heroId) {
      case "riko":
         if (t.moving) return;
         startMove(w, t, t.facing, "dash");
         break;
      case "nami":
         if (t.moving) return;
         startMove(w, t, t.facing, "leap");
         break;
      case "zuno": {
         // the magnet: the nearest prism straight ahead slides one cell toward Zuno
         for (let n = 2; n <= MAGNET_REACH; n++) {
            const pr = t.r + DR[t.facing] * n;
            const pc = t.c + DC[t.facing] * n;
            const tile = tileAt(w, pr, pc);
            if (tile === T.PRISM) {
               const tr = pr - DR[t.facing];
               const tc = pc - DC[t.facing];
               const to = tileAt(w, tr, tc);
               if (to === T.ROCK || to === T.CHASM) {
                  const i = w.prismCell.indexOf(pr * w.map.w + pc);
                  w.tiles[pr * w.map.w + pc] = w.map.tiles[pr * w.map.w + pc] === T.PRISM ? T.ROCK : w.map.tiles[pr * w.map.w + pc];
                  w.tiles[tr * w.map.w + tc] = T.PRISM;
                  w.prismCell[i] = tr * w.map.w + tc;
                  t.ev.slid = true;
                  w.version++;
               }
               break;
            }
            if (tile !== T.CHASM && tile !== T.ROCK) break;
         }
         break;
      }
      default:
         t.powerMs = POWER_MS[t.heroId as "kiro" | "vexa"];
   }
   t.cooldown = POWER_COOLDOWN_MS[t.heroId];
   t.ev.power = true;
}

function doTag(w: World, t: Team, tag: number) {
   if (t.tagMs > 0) return;
   let next: M2HeroId | null = null;
   if (tag > 0) next = M2_HERO_IDS[tag - 1] ?? null;
   else {
      const r = t.r + DR[t.facing];
      const c = t.c + DC[t.facing];
      const m = tileAt(w, r, c) === T.CHASM ? w.bridge[r * w.map.w + c] : 0;
      next = heroForMask(m);
      if (!next || next === t.heroId) next = M2_HERO_IDS[(M2_HERO_IDS.indexOf(t.heroId) + 1) % M2_HERO_IDS.length];
   }
   if (!next || next === t.heroId) return;
   t.heroId = next;
   t.powerMs = 0;
   t.tagMs = TAG_MS;
   t.ev.tag = true;
}

function stepTeam(w: World, t: Team, input: StepInput, first: boolean, dt: number) {
   const ms = dt * 1000;
   t.cooldown = Math.max(0, t.cooldown - ms);
   t.powerMs = Math.max(0, t.powerMs - ms);
   t.tagMs = Math.max(0, t.tagMs - ms);
   t.bumpMs = Math.max(0, t.bumpMs - ms);
   comboTick(t.combo, COMBO, w.ms);
   if (t.ended) return;
   if (t.fallMs > 0) {
      t.fallMs -= ms;
      if (t.fallMs <= 0) {
         t.fallMs = 0;
         t.r = t.fr = t.safeR;
         t.c = t.fc = t.safeC;
         t.ev.respawn = true;
      }
      return;
   }
   if (first && input.tag) doTag(w, t, input.tag);
   if (t.moving) {
      t.moveMs += ms;
      if (t.moveMs >= t.moveDur) {
         t.moving = null;
         arrive(w, t);
      }
   } else {
      const dr = Math.sign(input.dr);
      const dc = dr ? 0 : Math.sign(input.dc);
      if (dr || dc) {
         const dir = (dr < 0 ? 0 : dr > 0 ? 2 : dc > 0 ? 1 : 3) as Dir;
         t.facing = dir;
         startMove(w, t, dir, "walk");
      }
   }
   if (first && input.action) power(w, t);
   // a bridge that goes away (or turns) under a standing hero drops it
   if (!t.moving && t.fallMs === 0 && !walkable(w, t, t.r, t.c)) fall(t);
}

// ---------- the world step ----------

function stepDrones(w: World, dt: number) {
   w.cfg.drones.forEach((def, i) => {
      const d = w.drones[i];
      const a = def.path[d.seg];
      const b = def.path[d.seg + d.dir] ?? def.path[d.seg];
      const len = Math.max(1, Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]));
      d.t += (def.speed * dt) / len;
      if (d.t >= 1) {
         d.t = 0;
         d.seg += d.dir;
         if (d.seg + d.dir < 0 || d.seg + d.dir >= def.path.length) d.dir = (-d.dir) as 1 | -1;
      }
      const p = def.path[d.seg];
      const q = def.path[d.seg + d.dir] ?? p;
      d.r = p[0] + (q[0] - p[0]) * d.t;
      d.c = p[1] + (q[1] - p[1]) * d.t;
   });
}

function stepKeeper(w: World, dt: number) {
   const k = w.keeper!;
   if (!k.active) {
      // it wakes when a hero reaches its arena (within ARENA_ROWS rows of the plate)
      if (!w.teams.some((t) => t.r <= (w.map.plate?.[0] ?? 0) + ARENA_ROWS)) return;
      k.active = true;
   }
   for (const key of Object.keys(k.ev) as (keyof BossEvents)[]) k.ev[key] = false;
   const before = k.state.step;
   stepBoss(k.state, KEEPER, dt * 1000, k.ev);
   const step = k.state.step;
   if (k.state.hp === 0 && !w.exitOpen) {
      w.exitOpen = true;
      w.version++;
   }
   if (step !== before) {
      if (step === "telegraph") {
         // its stomp: the row of the hero nearest it
         const t = w.teams[0];
         k.stompRow = t ? t.r : -1;
         if (k.state.phase === 1) {
            k.greyNode = k.cycles % w.map.nodes.length;
            k.greyUntil = w.ms + 4000;
         }
      }
      if (step === "attack") {
         for (const t of w.teams) {
            if (t.r === k.stompRow && t.fallMs === 0 && !t.ended && !(t.heroId === "kiro" && t.powerMs > 0)) {
               fall(t);
               t.ev.stomped = true;
            }
         }
      }
      if (step === "vulnerable") {
         k.wants = KEEPER_WANTS[KEEPER.maxHp - k.state.hp] ?? 7;
         k.cycles++;
      }
   }
   if (step === "vulnerable" && plateColor(w) === k.wants) {
      const res = hitBoss(k.state, KEEPER, 1, k.ev);
      if (res !== "ignored") for (const t of w.teams) {
         t.ev.bossHit = true;
         award(w, t, COMBO_BASE_MS.boss);
      }
   }
}

/** the Keeper's arena: the rows from its plate down */
export const ARENA_ROWS = 9;

/** what the plate wants, hit by hit: three primaries, two mixes, then white */
export const KEEPER_WANTS = [1, 2, 4, 3, 6, 7];

const latches = new WeakMap<Team, StepInput>();

export function stepWorld(w: World, dtMs: number, inputs: readonly StepInput[]) {
   for (const t of w.teams) {
      const e = t.ev as unknown as Record<string, number | boolean>;
      for (const k of Object.keys(e)) e[k] = typeof e[k] === "number" ? (k === "switched" ? -1 : 0) : false;
   }
   if (w.ended || !Number.isFinite(dtMs) || dtMs <= 0) return;
   w.teams.forEach((t, k) => {
      const i = inputs[k];
      let l = latches.get(t);
      if (!l) latches.set(t, (l = idleInput()));
      if (!i) return;
      l.dr = i.dr;
      l.dc = i.dc;
      if (i.tag) l.tag = i.tag;
      l.action ||= !!i.action;
   });
   w.accumulator += Math.min(250, dtMs);
   while (w.accumulator >= FIXED_MS && !w.ended) {
      w.accumulator -= FIXED_MS;
      w.ms += FIXED_MS;
      if (w.ms >= w.cfg.durationMs) {
         w.ended = "timeup";
         for (const t of w.teams) if (!t.ended) t.ended = "timeup";
         break;
      }
      // timed nodes run out
      w.nodeUntil.forEach((u, i) => {
         if (w.ms >= u) {
            w.nodeColor[i] = 0;
            w.nodeUntil[i] = Infinity;
            w.version++;
         }
      });
      stepDrones(w, FIXED_MS / 1000);
      computeBeams(w);
      for (const t of w.teams) {
         const l = latches.get(t) ?? idleInput();
         stepTeam(w, t, l, true, FIXED_MS / 1000);
         l.tag = 0;
         l.action = false;
      }
      if (w.keeper) stepKeeper(w, FIXED_MS / 1000);
      if (w.teams.every((t) => t.ended)) w.ended = w.teams.some((t) => t.ended === "win") ? "win" : "timeup";
   }
}

export function step(w: World, dtMs: number, input: StepInput) {
   stepWorld(w, dtMs, [input]);
}

// ---------- scoring ----------

export const runTimeMs = (finishMs: number, orbs: number, comboMs = 0) => Math.max(0, Math.round(finishMs - orbs * ORB_BONUS_MS - comboMs));
export const submittedMs = (t: Team) => runTimeMs(t.finishMs, t.orbs, t.comboMs);
export const orbTotal = (level: LevelId) => parseLevel(LEVELS[level]).orbs.length;

export function comboSpecOf(level: LevelId): ComboLevelSpec {
   return { combo: COMBO, sources: [{ count: orbTotal(level), base: COMBO_BASE_MS.orb }, { count: LEVELS[level].boss ? KEEPER.maxHp : 0, base: COMBO_BASE_MS.boss }] };
}

/** The earliest rules ms the Keeper can be down once it wakes: every vulnerable window hit at its first ms. */
export function bossMinMs(): number {
   const s = createBoss(KEEPER);
   const ev = createBossEvents();
   for (let ms = 1; ms < 600_000; ms++) {
      stepBoss(s, KEEPER, 1, ev);
      if (s.step === "vulnerable") hitBoss(s, KEEPER, 1, ev);
      if (s.step === "defeat" || s.step === "done") return ms;
   }
   return Infinity;
}

/**
 * The least finish ms: the hero has to cover at least the row distance from the start to the exit, one
 * cell at a time, and nothing moves it faster than a dash (MIN_CELL_MS a cell); L5 adds the Keeper's
 * fastest defeat.
 */
export function minFinishMs(level: LevelId): number {
   const m = parseLevel(LEVELS[level]);
   const cells = Math.abs(m.start[0] - m.exit[0]) + Math.abs(m.start[1] - m.exit[1]);
   return Math.floor(cells * MIN_CELL_MS + (LEVELS[level].boss ? bossMinMs() : 0));
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

export function proposeLimits(id: LevelId): LevelLimits {
   const lb = minDurationMsOf(id);
   const minDurationMs = Math.max(100, Math.floor(lb / 100) * 100);
   const timeBaseMs = LEVELS[id].durationMs;
   return { kind: "time", maxScore: Math.floor((timeBaseMs - minDurationMs) / 10), minDurationMs, maxDurationMs: timeBaseMs, timeBaseMs };
}

export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = { 1: proposeLimits(1), 2: proposeLimits(2), 3: proposeLimits(3), 4: proposeLimits(4), 5: proposeLimits(5) };

export const STAT = {
   orbs: "orbs",
   finishMs: "finishMs",
   comboMs: "comboMs",
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
   hero: "hero",
   under: "under",
   ahead: "ahead",
   power: "power",
   falls: "falls",
   coach: "coach",
   boss: "boss",
   bossHp: "bossHp",
   bossPhase: "bossPhase",
   bossOpen: "bossOpen",
   bossFlash: "bossFlash",
   bossWants: "bossWants",
   plate: "plate",
   stars: "stars",
   newStars: "newStars",
   noHit: "noHit",
   secrets: "secrets",
   newSecrets: "newSecrets",
   xp: "xp",
} as const;

export function finalScore(s: { score: number; endReason: string | null; stats: Record<string, number>; elapsedMs: number }): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.orbs] ?? 0, s.stats[STAT.comboMs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}
