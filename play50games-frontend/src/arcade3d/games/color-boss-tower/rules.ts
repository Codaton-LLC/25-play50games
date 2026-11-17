// Color Boss Tower rules. Pure and deterministic: one run, stepped in whole milliseconds (the fraction
// carries, so 30, 60 and 144 fps agree). The play is 2.5D on the tower's inner wall: the hero is an arc
// position `a` round the walking ring (radius R_PATH; compared modulo the circumference) and a height
// `y`; left / right on the stick runs round the ring (camera-relative), Space jumps.
//
// The signature: the boss fight is a climb, and the tower is your weapon. The boss stands in the central
// shaft; you never hit him yourself. Colour claws on the ledges hold dormant cores: touch one as the
// hero of its colour (World 6's tag-switch, menu2/heroTag: the active hero's colour is yours) and its
// prism cannon charges. When his weak plate opens (the boss machine's vulnerable window), a charged
// cannon fires: one hit. Level 4's second phase and level 5's need a chain charge (two cannons charged
// within CHAIN_MS); level 5's first phase fires only the lit claw's colour; its last phase is the tag
// finish (five glyphs light on his core one by one: be that hero while it is lit).
//
// The score proof (README "Score limits"): a time game. Every hit happens inside a vulnerable window, so
// no run beats the boss before bossMinMs (every hit on the first instant of its window); the submitted
// time takes off every orb and the most flow bonus.
import type { RunState } from "@/arcade3d/core/types";
import { inputToWorld } from "@/arcade3d/core/math";
import type { LevelId } from "../../types";
import { comboBreak, comboHit, comboMaxBonus, comboTick, createCombo, type ComboLevelSpec, type ComboState } from "../../menu2/combo/combo";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossConfig, type BossEvents, type BossState } from "../../menu2/boss/boss";
import { collectSecret, createSecretTracker, type SecretTracker } from "../../menu2/secrets/secrets";
import {
   HERO_OF_COLOUR,
   TAG_COLOUR,
   TAG_ORDER,
   activeColour,
   createTagState,
   freshLegs,
   isLocked,
   prismLock,
   stepTagMs,
   tagTo,
   usePowerTag,
   type TagColour,
   type TagHeroId,
   type TagState,
} from "../../menu2/heroTag/rules";
import { LEDGE_LEN, LEVELS, RISE, R_PATH, SKIP_RISE, STEP_ARC, type TowerSpec } from "./levels";
import { COMBO, COMBO_BASE_MS, BOSSES, GLYPH_MS, SECRETS } from "./progression";

export const CIRC = 2 * Math.PI * R_PATH;
export const R_PATH_CONST = R_PATH;
export const V_RUN = 6.5;
export const ACCEL = 14;
export const G = 26;
export const V_JUMP = 9;
export const HERO_H = 1.2;
export const STEP_UP = 0.3;
export const SKIP_LEN = 2.4;
export const CLAW_REACH = 1.3;
export const MAGNET_REACH = 6;
export const KNOCK_V = 5;
export const STUN_MS = 450;
/** a fall this far under the highest checkpoint reached puts you back on it (m) */
export const FALL_CATCH = 4;
export const HEARTS = 3;
export const ORB_R = 0.9;
export const ORB_BONUS_MS = 200;
export const SECRET_R = 1.1;
export const CRUMBLE_MS = 2000;
export const REFORM_MS = 4000;
/** a chain charge: two claws charged within this of each other */
export const CHAIN_MS = 4000;
/** level 5 P2: his beam drains a charged core this long after it was charged */
export const DRAIN_MS = 6000;
/** the sweep: the arm goes once round the ring in the attack step; its half-width (rad); the band above the ground */
export const ARM_HALF = 0.16;
export const SWEEP_BAND = 1.0;
/** hazard orbs: speed down the spiral (m/s of arc), radius, lifetime */
export const HORB_SPEED = 5;
export const HORB_R = 0.45;
export const HORB_LIFE = 14_000;

/** A hazard orb rolls on the ledges (flat on each, a drop at each gap): its bottom height at spiral s. */
export function horbY(s: number): number {
   return Math.max(0, Math.round(s / STEP_ARC)) * RISE;
}
const COYOTE = 90;
const BUFFER = 110;
const MAX_STEP_MS = 50;

/** W6 tag tuning (the card's table): power duration and cooldown per hero (ms); Riko's dash speed */
export const POWER = {
   riko: { ms: 300, cooldown: 3000 },
   nami: { ms: 0, cooldown: 0 },
   kiro: { ms: 1500, cooldown: 5000 },
   zuno: { ms: 3000, cooldown: 7000 },
   vexa: { ms: 800, cooldown: 5000 },
} as const;
export const DASH_V = 20;

export interface StepInput {
   moveX: number;
   moveZ: number;
   yaw: number;
   jumpPressed: boolean;
   jumpHeld: boolean;
   actionPressed: boolean;
   /** a tag this frame: a hero, "next" / "prev", or null */
   tag: TagHeroId | "next" | "prev" | null;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, yaw: 0, jumpPressed: false, jumpHeld: false, actionPressed: false, tag: null };
}

export interface Hero {
   /** arc position (m, unbounded; compared modulo CIRC) */
   a: number;
   y: number;
   va: number;
   vy: number;
   grounded: boolean;
   coyote: number;
   buffer: number;
   airJumps: number;
   /** take-offs so far (fresh legs: one per airtime) */
   airtime: number;
   taggedInAir: boolean;
   dashUntil: number;
   dashDir: number;
   stunUntil: number;
   lastHitMs: number;
   /** the ledge it stands on (-1 floor / air) */
   ledge: number;
   /** -1 none, else 100 + skip index (skip ledges) */
   skip: number;
}

export interface Claw {
   ledge: number;
   colour: TagColour;
   a: number;
   /** the claw's centre height */
   y: number;
   /** charged at (ms), -1 dormant, -2 spent */
   chargedAt: number;
}

export interface HazardOrb {
   /** spiral arc position (m along the spiral from ledge 0) */
   s: number;
   born: number;
   alive: boolean;
}

export interface StepEvents {
   jumped: boolean;
   airJumped: boolean;
   landed: boolean;
   tagged: TagHeroId | null;
   handOff: boolean;
   tagRefused: boolean;
   powered: boolean;
   charged: number;
   fired: number;
   hit: boolean;
   bossPhase: boolean;
   bossDefeat: boolean;
   bossAttack: boolean;
   bossOpen: boolean;
   knocked: boolean;
   shielded: boolean;
   crumbled: number;
   orb: number;
   secret: string | null;
   glyph: number;
   locked: boolean;
   /** a fall caught: back on the highest checkpoint reached */
   respawned: boolean;
   /** a new checkpoint reached (its ledge), -1 none */
   checkpoint: number;
   ended: boolean;
}

export function createEvents(): StepEvents {
   return {
      jumped: false, airJumped: false, landed: false, tagged: null, handOff: false, tagRefused: false, powered: false,
      charged: -1, fired: -1, hit: false, bossPhase: false, bossDefeat: false, bossAttack: false, bossOpen: false,
      knocked: false, shielded: false, crumbled: -1, orb: -1, secret: null, glyph: -1, locked: false, respawned: false, checkpoint: -1, ended: false,
   };
}

function clearEvents(e: StepEvents): void {
   e.jumped = e.airJumped = e.landed = e.handOff = e.tagRefused = e.powered = e.hit = false;
   e.bossPhase = e.bossDefeat = e.bossAttack = e.bossOpen = e.knocked = e.shielded = e.locked = e.ended = e.respawned = false;
   e.checkpoint = -1;
   e.tagged = null;
   e.secret = null;
   e.charged = e.fired = e.crumbled = e.orb = e.glyph = -1;
}

export interface Tower {
   spec: TowerSpec;
   level: LevelId;
   /** ledge i: centre arc, top */
   la: Float64Array;
   ly: Float64Array;
   /** skip ledges: arc, top */
   skipA: number[];
   skipY: number[];
   claws: { ledge: number; colour: TagColour; a: number; y: number }[];
   orbs: { a: number; y: number }[];
   secrets: { a: number; y: number; kind: TowerSpec["secrets"][number]["kind"] }[];
   checkpoints: number[];
   bossCfg: BossConfig;
   topY: number;
}

export function buildTower(spec: TowerSpec): Tower {
   const n = spec.ledges;
   const la = new Float64Array(n);
   const ly = new Float64Array(n);
   for (let i = 0; i < n; i++) {
      la[i] = i * STEP_ARC;
      ly[i] = i * RISE;
   }
   const skipA: number[] = [];
   const skipY: number[] = [];
   for (const i of spec.skips) for (const k of [1, 2]) {
      skipA.push(la[i]);
      skipY.push(ly[i] + k * SKIP_RISE);
   }
   return {
      spec,
      level: spec.id,
      la,
      ly,
      skipA,
      skipY,
      claws: spec.claws.map((c) => ({ ledge: c.ledge, colour: c.colour, a: la[c.ledge], y: ly[c.ledge] + (c.lift ?? 0) + 1.0 })),
      orbs: spec.orbs.map((o) => ({ a: la[o.ledge], y: ly[o.ledge] + o.lift })),
      secrets: spec.secrets.map((s) => ({ a: la[s.ledge] + (s.kind === "highNiche" ? 0 : 1.2), y: ly[s.ledge] + s.lift + 0.9, kind: s.kind })),
      checkpoints: spec.checkpoints,
      bossCfg: BOSSES[spec.boss === "grand" ? "grand" : `stone${spec.cycles}` as keyof typeof BOSSES],
      topY: ly[n - 1],
   };
}

const CACHE = new Map<LevelId, Tower>();
export function towerFor(level: LevelId): Tower {
   let t = CACHE.get(level);
   if (!t) {
      t = buildTower(LEVELS[level]);
      CACHE.set(level, t);
   }
   return t;
}

/** The shortest signed arc from b to a (modulo the circumference). */
export function arcDelta(a: number, b: number): number {
   let d = (a - b) % CIRC;
   if (d > CIRC / 2) d -= CIRC;
   if (d < -CIRC / 2) d += CIRC;
   return d;
}

export interface CbtRun {
   seed: number;
   level: LevelId;
   tower: Tower;
   simMs: number;
   frac: number;
   hero: Hero;
   tag: TagState;
   hearts: number;
   claws: Claw[];
   /** level 3: ms a ledge was first stood on (Infinity: never), ms it reforms */
   ledgeTouched: Float64Array;
   ledgeBack: Float64Array;
   horbs: HazardOrb[];
   orbTaken: Uint8Array;
   orbs: number;
   secrets: SecretTracker;
   combo: ComboState;
   boss: BossState;
   bossEv: BossEvents;
   /** the sweep: the hero's ground height when it telegraphed, its start angle, hit once */
   sweepY: number;
   sweepA0: number;
   sweepHit: boolean;
   /** level 5 P3: which glyphs of this window are done */
   glyphs: Uint8Array;
   /** level 5: a glyph scores flow once per run (the proof counts five) */
   glyphScored: Uint8Array;
   highestCheckpoint: number;
   strikes: number;
   cannonsFired: number;
   finishMs: number;
   ended: "win" | "lose" | "timeup" | null;
   ev: StepEvents;
}

export function createRun(seed: number, level: LevelId = 1, lead: TagHeroId = "riko", tower: Tower = towerFor(level)): CbtRun {
   const t = tower;
   return {
      seed,
      level,
      tower: t,
      simMs: 0,
      frac: 0,
      hero: { a: -1.2, y: 0, va: 0, vy: 0, grounded: true, coyote: 0, buffer: 0, airJumps: 0, airtime: 0, taggedInAir: false, dashUntil: -1, dashDir: 1, stunUntil: -1, lastHitMs: -9999, ledge: 0, skip: -1 },
      tag: createTagState({ lead }),
      hearts: HEARTS,
      claws: t.claws.map((c) => ({ ...c, chargedAt: -1 })),
      ledgeTouched: new Float64Array(t.la.length).fill(Infinity),
      ledgeBack: new Float64Array(t.la.length).fill(-1),
      horbs: [],
      orbTaken: new Uint8Array(t.orbs.length),
      orbs: 0,
      secrets: createSecretTracker(SECRETS[level]),
      combo: createCombo(),
      boss: createBoss(t.bossCfg),
      bossEv: createBossEvents(),
      sweepY: 0,
      sweepA0: 0,
      sweepHit: false,
      glyphs: new Uint8Array(5),
      glyphScored: new Uint8Array(5),
      highestCheckpoint: 0,
      strikes: 0,
      cannonsFired: 0,
      finishMs: 0,
      ended: null,
      ev: createEvents(),
   };
}

/** Is ledge i solid now (level 3: a crumbled ledge is gone until it reforms)? */
export function ledgeSolid(run: CbtRun, i: number): boolean {
   if (!run.tower.spec.crumbling) return true;
   const t = run.ledgeTouched[i];
   if (t === Infinity) return true;
   return run.simMs < t + CRUMBLE_MS || run.simMs >= run.ledgeBack[i];
}

/** The surface under (a, y): the highest solid top at or below y + STEP_UP; -Infinity none (the floor is 0). */
function surfaceAt(run: CbtRun, a: number, y: number, out: { ledge: number; skip: number }): number {
   const t = run.tower;
   let best = -Infinity;
   out.ledge = -1;
   out.skip = -1;
   // ledges whose top could be under y: i from y
   const top = Math.min(t.la.length - 1, Math.floor((y + STEP_UP) / RISE) + 1);
   for (let i = top; i >= 0; i--) {
      const ty = t.ly[i];
      if (ty > y + STEP_UP) continue;
      if (ty <= best) break;
      if (Math.abs(arcDelta(a, t.la[i])) > LEDGE_LEN / 2) continue;
      if (!ledgeSolid(run, i)) continue;
      best = ty;
      out.ledge = i;
   }
   for (let k = 0; k < t.skipA.length; k++) {
      const ty = t.skipY[k];
      if (ty > y + STEP_UP || ty <= best) continue;
      if (Math.abs(arcDelta(a, t.skipA[k])) > SKIP_LEN / 2) continue;
      best = ty;
      out.ledge = -1;
      out.skip = 100 + k;
   }
   // the tower's floor ring under everything
   return best === -Infinity || best < 0 ? Math.max(best, y + STEP_UP >= 0 ? 0 : -Infinity) : best;
}

const SURF = { ledge: -1, skip: -1 };
const STICK = { x: 0, z: 0 };

function knock(run: CbtRun, ev: StepEvents, dir: number): void {
   const h = run.hero;
   const ms = run.simMs;
   if (ms - h.lastHitMs < 700) return;
   const tag = run.tag;
   if (tag.active === "kiro" && tag.powerUntil.kiro >= ms) {
      ev.shielded = true;
      return;
   }
   h.lastHitMs = ms;
   h.va = dir * KNOCK_V;
   h.vy = Math.max(h.vy, 4);
   h.grounded = false;
   h.stunUntil = ms + STUN_MS;
   run.hearts -= 1;
   run.strikes += 1;
   comboBreak(run.combo);
   ev.knocked = true;
   if (run.hearts <= 0) {
      run.ended = "lose";
      ev.ended = true;
   }
}

/** Advances the run by dtMs (capped at MAX_STEP_MS), 1 ms at a time. Returns the run's events object. */
export function step(run: CbtRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.ev;
   clearEvents(ev);
   if (run.ended) return ev;
   const total = Math.min(MAX_STEP_MS, Math.max(0, dtMs)) + run.frac;
   const whole = Math.floor(total);
   run.frac = total - whole;
   const h = run.hero;
   if (input.jumpPressed) h.buffer = BUFFER;
   if (input.tag) {
      const r = tagTo(run.tag, input.tag, run.simMs);
      if (r.ok) {
         ev.tagged = run.tag.active;
         ev.handOff = r.handOff;
         // a hand-off keeps the flow chain alive but scores nothing itself (tags never score)
         if (r.handOff) run.combo.lastMs = run.simMs;
         if (!h.grounded) h.taggedInAir = true;
      } else {
         ev.tagRefused = true;
         if (r.reason === "locked") ev.locked = true;
      }
   }
   usePower(run, input, ev);
   // the stick: its world direction projected on the ring's tangent at the hero (camera-relative)
   inputToWorld(input.moveX, input.moveZ, input.yaw, STICK);
   const th = h.a / R_PATH;
   const tx = Math.cos(th);
   const tz = -Math.sin(th);
   const along = Math.max(-1, Math.min(1, STICK.x * tx + STICK.z * tz));
   for (let i = 0; i < whole && !run.ended; i++) stepMs(run, ev, along);
   return ev;
}

function usePower(run: CbtRun, input: StepInput, ev: StepEvents): void {
   if (!input.actionPressed) return;
   const h = run.hero;
   const hero = run.tag.active;
   if (hero === "nami") return;
   const p = POWER[hero];
   if (!usePowerTag(run.tag, run.simMs, p.ms, p.cooldown)) return;
   if (hero === "riko") {
      h.dashUntil = run.simMs + p.ms;
      h.dashDir = h.va < -0.2 ? -1 : 1;
   }
   ev.powered = true;
}

function addCombo(run: CbtRun, base: number, hero: TagHeroId): void {
   comboHit(run.combo, COMBO, run.simMs, base);
   void hero;
}

function stepMs(run: CbtRun, ev: StepEvents, along: number): void {
   run.simMs += 1;
   const ms = run.simMs;
   const t = run.tower;
   const h = run.hero;
   comboTick(run.combo, COMBO, ms);
   stepTagMs(run.tag);
   stepBossMs(run, ev);
   if (run.ended) return;
   if (ms >= t.spec.timerMs) {
      run.ended = "timeup";
      ev.ended = true;
      return;
   }

   // --- around the ring
   const stunned = ms < h.stunUntil;
   if (h.dashUntil >= ms) h.va = h.dashDir * DASH_V;
   else {
      const target = stunned ? 0 : along * V_RUN;
      h.va += (target - h.va) * (1 - Math.exp(-ACCEL / 1000));
   }
   h.a += h.va * 0.001;

   // --- up
   if (h.buffer > 0) h.buffer -= 1;
   const nami = run.tag.active === "nami";
   if (h.buffer > 0 && (h.grounded || h.coyote > 0) && !stunned) {
      h.vy = V_JUMP;
      h.grounded = false;
      h.coyote = 0;
      h.buffer = 0;
      h.airtime += 1;
      h.taggedInAir = false;
      h.airJumps = nami ? 1 : 0;
      ev.jumped = true;
   } else if (h.buffer > 0 && !h.grounded && !stunned) {
      // Nami's second jump; fresh legs: a hero tagged in mid-air gets one fresh air action per airtime
      const fresh = freshLegs(run.tag, h.airtime, h.taggedInAir) ? (nami ? 1 : 0) : 0;
      if (h.airJumps + fresh > 0 && nami) {
         if (h.airJumps > 0) h.airJumps -= 1;
         h.vy = V_JUMP;
         h.buffer = 0;
         ev.airJumped = true;
      }
   }
   const surf = surfaceAt(run, h.a, h.y, SURF);
   if (h.grounded) {
      if (Math.abs(surf - h.y) <= STEP_UP && (SURF.ledge >= 0 || SURF.skip >= 0 || surf === 0)) {
         h.y = surf;
         h.vy = 0;
      } else {
         h.grounded = false;
         h.coyote = COYOTE;
         h.airJumps = nami ? 1 : 0;
      }
   }
   if (!h.grounded) {
      h.vy -= G * 0.001;
      h.y += h.vy * 0.001;
      if (h.coyote > 0) h.coyote -= 1;
      if (h.vy <= 0 && h.y <= surf && h.y >= surf - 0.8) {
         h.y = surf;
         h.vy = 0;
         h.grounded = true;
         ev.landed = true;
      }
   }
   // a fall: caught FALL_CATCH below the highest checkpoint reached, back on it
   const cp = run.highestCheckpoint;
   if (!h.grounded && cp > 0 && h.y < t.ly[cp] - FALL_CATCH) {
      h.a = t.la[cp];
      h.y = t.ly[cp];
      h.va = 0;
      h.vy = 0;
      h.grounded = true;
      h.stunUntil = ms + STUN_MS;
      SURF.ledge = cp;
      SURF.skip = -1;
      ev.respawned = true;
      comboBreak(run.combo);
   }
   h.ledge = h.grounded ? SURF.ledge : -1;
   h.skip = h.grounded ? SURF.skip : -1;
   if (h.grounded && h.ledge >= 0) {
      // (a checkpoint ledge never crumbles: it is where a fall is caught)
      if (t.spec.crumbling && run.ledgeTouched[h.ledge] === Infinity && !t.checkpoints.includes(h.ledge)) {
         run.ledgeTouched[h.ledge] = ms;
         run.ledgeBack[h.ledge] = ms + CRUMBLE_MS + REFORM_MS;
      }
      if (t.spec.crumbling && run.ledgeTouched[h.ledge] !== Infinity && ms === run.ledgeTouched[h.ledge] + CRUMBLE_MS) ev.crumbled = h.ledge;
      // a checkpoint reached
      for (const c of t.checkpoints) if (c === h.ledge && c > run.highestCheckpoint) {
         run.highestCheckpoint = c;
         ev.checkpoint = c;
      }
   }
   // level 3: a crumbled ledge reforms untouched
   if (t.spec.crumbling) for (let i = 0; i < run.ledgeBack.length; i++) if (run.ledgeBack[i] >= 0 && ms >= run.ledgeBack[i] && i !== h.ledge) {
      run.ledgeTouched[i] = Infinity;
      run.ledgeBack[i] = -1;
   }

   // --- claws: the active hero's colour charges its claw (Zuno's magnet: yellow from MAGNET_REACH)
   const colour = activeColour(run.tag);
   const magnet = run.tag.active === "zuno" && run.tag.powerUntil.zuno >= ms;
   for (let c = 0; c < run.claws.length; c++) {
      const cl = run.claws[c];
      if (cl.chargedAt !== -1 || cl.colour !== colour) continue;
      const d = Math.hypot(arcDelta(h.a, cl.a), h.y + 1 - cl.y);
      if (d > CLAW_REACH && !(magnet && cl.colour === "yellow" && d <= MAGNET_REACH)) continue;
      cl.chargedAt = ms;
      ev.charged = c;
      addCombo(run, COMBO_BASE_MS.charge, run.tag.active);
   }

   // --- hazards: the sweep arm and the hazard orbs
   const phased = run.tag.active === "vexa" && run.tag.powerUntil.vexa >= ms;
   const b = run.boss;
   if (b.step === "attack" && !run.sweepHit && !phased) {
      const atk = run.tower.bossCfg.phases[b.phase].attacks[0];
      const arm = run.sweepA0 + Math.PI + (2 * Math.PI * b.stepMs) / atk.attackMs;
      const heroAng = h.a / R_PATH;
      const d = Math.abs(((arm - heroAng) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
      if (d < ARM_HALF && h.y < run.sweepY + SWEEP_BAND && h.y + HERO_H > run.sweepY) {
         run.sweepHit = true;
         knock(run, ev, -1);
      }
   }
   for (const o of run.horbs) {
      if (!o.alive) continue;
      o.s -= HORB_SPEED * 0.001;
      if (o.s < 0 || ms - o.born > HORB_LIFE) {
         o.alive = false;
         continue;
      }
      const oy = horbY(o.s);
      if (!phased && Math.abs(arcDelta(h.a, o.s)) < HORB_R + 0.15 && h.y < oy + 2 * HORB_R && h.y + HERO_H > oy) {
         o.alive = false;
         knock(run, ev, -1);
      }
   }

   // --- orbs and secrets
   for (let k = 0; k < t.orbs.length; k++) {
      if (run.orbTaken[k]) continue;
      const o = t.orbs[k];
      if (Math.abs(arcDelta(h.a, o.a)) > ORB_R || Math.abs(h.y + 0.6 - o.y) > 1.2) continue;
      run.orbTaken[k] = 1;
      run.orbs += 1;
      ev.orb = k;
      addCombo(run, COMBO_BASE_MS.orb, run.tag.active);
   }
   for (let k = 0; k < t.secrets.length; k++) {
      const s = t.secrets[k];
      if (Math.abs(arcDelta(h.a, s.a)) > SECRET_R || Math.abs(h.y + 0.6 - s.y) > 1.2) continue;
      // the ghost niche is behind a ghost panel (Vexa's phase), the cracked window needs Riko's dash
      if (s.kind === "ghostNiche" && !phased) continue;
      if (s.kind === "crackedWindow" && h.dashUntil < ms) continue;
      if (collectSecret(run.secrets, k)) ev.secret = SECRETS[run.level][k].id;
   }
}

/** The boss: his machine, the sweep's telegraph, hazard orbs, the cannons, level 5's glyphs. */
function stepBossMs(run: CbtRun, ev: StepEvents): void {
   const b = run.boss;
   const cfg = run.tower.bossCfg;
   const be = run.bossEv;
   const ms = run.simMs;
   const h = run.hero;
   const phaseBefore = b.phase;
   stepBoss(b, cfg, 1, be);
   if (b.phase !== phaseBefore) {
      ev.bossPhase = true;
      run.hearts = HEARTS;
   }
   if (b.step === "done") {
      if (!run.ended) {
         run.ended = "win";
         run.finishMs = ms;
         ev.ended = true;
      }
      return;
   }
   if (b.step === "defeat") return;
   if (be.telegraph) {
      // the arm will sweep the band at the hero's ground height; orbs roll from 6 ledges up
      run.sweepY = h.grounded ? h.y : Math.max(0, h.y - 1);
      run.sweepA0 = h.a / R_PATH;
      run.sweepHit = false;
      if (run.tower.spec.hazardOrbs && b.phase < 2) {
         const from = Math.min(run.tower.la.length - 1, Math.max(0, Math.round(h.a / STEP_ARC) + 6));
         run.horbs.push({ s: from * STEP_ARC, born: ms, alive: true });
      }
      // level 5 P3: a Prism Lock at every telegraph (be the right hero before the moment)
      if (isGrand(run) && b.phase === 2) {
         prismLock(run.tag, ms, 2000);
         ev.locked = true;
      }
   }
   if (be.attack) ev.bossAttack = true;
   if (b.step !== "vulnerable") {
      if (isGrand(run) && b.phase === 2) run.glyphs.fill(0);
      return;
   }
   if (be.vulnerable) ev.bossOpen = true;
   // level 5 P2: a charged core drains after DRAIN_MS
   if (isGrand(run) && b.phase === 1) for (const c of run.claws) if (c.chargedAt >= 0 && ms - c.chargedAt > DRAIN_MS) c.chargedAt = -2;
   if (isGrand(run) && b.phase === 2) {
      // the tag finish: glyph k lit for GLYPH_MS each; the active colour while it is lit
      const k = Math.floor(b.stepMs / GLYPH_MS);
      if (k < 5 && !run.glyphs[k] && activeColour(run.tag) === TAG_COLOUR[TAG_ORDER[k]]) {
         run.glyphs[k] = 1;
         ev.glyph = k;
         if (!run.glyphScored[k]) {
            run.glyphScored[k] = 1;
            addCombo(run, COMBO_BASE_MS.glyph, run.tag.active);
         }
         if (run.glyphs.every((g) => g === 1)) fireHit(run, ev, -1);
      }
      return;
   }
   // the cannons fire at the opening of the weak plate (one hit per window)
   const chain = needsChain(run);
   const lit = litColour(run);
   const ready: number[] = [];
   for (let c = 0; c < run.claws.length; c++) {
      const cl = run.claws[c];
      if (cl.chargedAt < 0) continue;
      if (lit && cl.colour !== lit) continue;
      ready.push(c);
   }
   if (ready.length === 0) return;
   if (chain) {
      // two charged within CHAIN_MS of each other
      for (let i = 0; i < ready.length; i++) for (let j = i + 1; j < ready.length; j++) {
         const ci = run.claws[ready[i]];
         const cj = run.claws[ready[j]];
         if (Math.abs(ci.chargedAt - cj.chargedAt) <= CHAIN_MS) {
            ci.chargedAt = -2;
            cj.chargedAt = -2;
            fireHit(run, ev, ready[i]);
            return;
         }
      }
      return;
   }
   run.claws[ready[0]].chargedAt = -2;
   fireHit(run, ev, ready[0]);
}

function fireHit(run: CbtRun, ev: StepEvents, claw: number): void {
   const r = hitBoss(run.boss, run.tower.bossCfg, 1, run.bossEv);
   if (r === "ignored") return;
   ev.fired = claw;
   ev.hit = true;
   run.cannonsFired += 1;
   addCombo(run, COMBO_BASE_MS.hit, run.tag.active);
   if (r === "defeated") ev.bossDefeat = true;
}

export function isGrand(run: CbtRun): boolean {
   return run.tower.spec.boss === "grand";
}

/** Level 4's second phase and level 5's: two cannons in one opening (a chain charge). */
export function needsChain(run: CbtRun): boolean {
   const b = run.boss;
   if (run.level === 4) return b.phase === 1;
   if (isGrand(run)) return b.phase === 1;
   return false;
}

/** Level 5 P1: only this colour's claw fires, cycling through the heroes window by window. */
export function litColour(run: CbtRun): TagColour | null {
   if (!isGrand(run) || run.boss.phase !== 0) return null;
   const n = run.tower.bossCfg.maxHp - run.boss.hp;
   return (["red", "green", "purple"] as const)[n % 3];
}

/** Where the hero stands in the world (x, z) on the ring. */
export function heroXZ(run: CbtRun, out: { x: number; z: number }): { x: number; z: number } {
   const th = run.hero.a / R_PATH;
   out.x = Math.sin(th) * R_PATH;
   out.z = Math.cos(th) * R_PATH;
   return out;
}

// ---------------------------------------------------------------------------------------------
// the proof

/** The least rules-time to beat the boss: every hit on the first instant of its window. */
export function bossMinMs(cfg: BossConfig): number {
   const s = createBoss(cfg);
   const ev = createBossEvents();
   let t = 0;
   for (let guard = 0; guard < 2_000_000 && s.step !== "defeat" && s.step !== "done"; guard++) {
      if (s.step === "vulnerable") {
         const r = hitBoss(s, cfg, 1, ev);
         if (r === "defeated") return t;
         continue;
      }
      stepBoss(s, cfg, 1, ev);
      t += 1;
   }
   return t;
}

/** The least rules-time to finish: the defeat plays out (defeatMs) before the boss is "done". */
export function minFinishMs(t: Tower): number {
   return bossMinMs(t.bossCfg) + t.bossCfg.defeatMs;
}

export function comboSpecOf(t: Tower): ComboLevelSpec {
   return {
      combo: COMBO,
      sources: [
         { count: t.claws.length, base: COMBO_BASE_MS.charge },
         { count: t.bossCfg.maxHp, base: COMBO_BASE_MS.hit },
         { count: t.orbs.length, base: COMBO_BASE_MS.orb },
         { count: t.spec.boss === "grand" ? 5 : 0, base: COMBO_BASE_MS.glyph },
      ],
   };
}

export function minDurationMsOf(t: Tower): number {
   return Math.max(0, minFinishMs(t) - t.orbs.length * ORB_BONUS_MS - comboMaxBonus(comboSpecOf(t)));
}

export interface LevelLimits {
   kind: "time";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   timeBaseMs: number;
}

export function proposeLimits(_id: LevelId, t: Tower): LevelLimits {
   const least = minDurationMsOf(t);
   const minDurationMs = Math.floor((least * 0.95) / 100) * 100;
   const timeBaseMs = t.spec.timerMs;
   return { kind: "time", maxScore: Math.floor((timeBaseMs - minDurationMs) / 10), minDurationMs, maxDurationMs: timeBaseMs, timeBaseMs };
}

/** Pinned (literal) limits: equal to proposeLimits (rules.test.ts), meta.ts and arcade-games.json. */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = {
   1: { kind: "time", maxScore: 13920, minDurationMs: 10800, maxDurationMs: 150000, timeBaseMs: 150000 },
   2: { kind: "time", maxScore: 16570, minDurationMs: 14300, maxDurationMs: 180000, timeBaseMs: 180000 },
   3: { kind: "time", maxScore: 19210, minDurationMs: 17900, maxDurationMs: 210000, timeBaseMs: 210000 },
   4: { kind: "time", maxScore: 21620, minDurationMs: 23800, maxDurationMs: 240000, timeBaseMs: 240000 },
   5: { kind: "time", maxScore: 26880, minDurationMs: 31200, maxDurationMs: 300000, timeBaseMs: 300000 },
};

export function runTimeMs(playMs: number, orbs: number, comboMs = 0): number {
   return Math.max(0, playMs - orbs * ORB_BONUS_MS - comboMs);
}

export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.orbs] ?? 0, s.stats[STAT.comboMs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}

/** The no-hit badge: never knocked. */
export function badgeHits(run: CbtRun): number {
   return run.strikes;
}

export const STAT = {
   orbs: "orbs",
   finishMs: "finishMs",
   comboMs: "comboMs",
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
   hero: "hero",
   hearts: "hearts",
   charged: "charged",
   tagCd: "tagCd",
   power: "power",
   bossHp: "bossHp",
   bossPhase: "bossPhase",
   bossOpen: "bossOpen",
   bossFlash: "bossFlash",
   bossOn: "bossOn",
   glyph: "glyph",
   locked: "locked",
   /** the active hero's power: ms left to recharge (0 = ready) and each hero's, packed for the strip */
   cdRiko: "cdRiko",
   cdNami: "cdNami",
   cdKiro: "cdKiro",
   cdZuno: "cdZuno",
   cdVexa: "cdVexa",
   /** the charged claws waiting (fire at the next window) */
   ready: "ready",
   climb: "climb",
   stars: "stars",
   newStars: "newStars",
   noHit: "noHit",
   secrets: "secrets",
   newSecrets: "newSecrets",
   xp: "xp",
} as const;

void HERO_OF_COLOUR;
void isLocked;
