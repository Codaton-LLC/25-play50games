// Roll Dash's rules: pure and deterministic (no three.js, React, DOM, Math.random or Date). Scene.tsx
// calls step() from one useRunFrame; the same level + lead + inputs always give the same run at any
// frame rate (the simulation advances in fixed 1000/120 ms steps).
//
// The signature mechanic (the World 6 card "Prism Locks"): a 3-lane ball-roll runner, auto-forward.
// Every Prism Lock carries a hero colour and glyph and opens only to that hero's power: Riko's dash
// breaks a red barricade, Nami's double jump clears a blue 3 m barrier, Kiro's shield passes a green
// spray, Zuno's magnet opens a yellow vault, Vexa phases through a purple ghost wall. The whole squad
// rolls together: TAG the right hero (1-5, or the portrait strip), then fire. A single lock blocks one
// lane (dodge it, or open it for its orbs); a full lock spans all three: you must answer it. A correct
// unlock gives +1 combo, a 1.5 s +1.5 m/s boost and repaints the street behind you. The forward speed is
// the level's base, plus the boost, plus Riko's dash; nothing else moves you faster (bound.ts).
import type { RunState } from "@/arcade3d/core/types";
import { BENCH_RECHARGE, HANDOFF_MS, LINGER_MS, TAG_COOLDOWN_MS } from "@/arcade3d/menu2/heroTag/rules";
import type { LevelId } from "../../types";
import { rngNext } from "@/arcade3d/core/math";
import { comboBreak, comboFlow, comboHit, comboMaxBonus, createCombo, type ComboState } from "@/arcade3d/menu2/combo/combo";
import { createBoss, createBossEvents, hitBoss, stepBoss, type BossEvents, type BossState } from "@/arcade3d/menu2/boss/boss";
import { collectSecret, createSecretTracker, type SecretTracker } from "@/arcade3d/menu2/secrets/secrets";
import { evaluateStars, type StarResult } from "@/arcade3d/menu2/stars/stars";
import { LANE_W, cartX, courseFor, laneX, type Course, type Item } from "./course";
import { DASH_BOOST, DEFAULT_HERO, HERO_IDS, MAGNET_REACH, heroById, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import { COMBO, COMBO_BASE_MS, HAWK, PLATE_FIRST_S, PLATE_GAP_S, SECRETS, secretIndex, starSpecFor } from "./progression";

// ---------- tuning ----------

export const STEP_MS = 1000 / 120;
export const MAX_FRAME_MS = 50;
/** a lane change takes this long */
export const LANE_MS = 180;
export const GRAV = 32;
/** a jump reaches 1.4 m (the card); Nami's second jump about as much again */
export const V_JUMP = Math.sqrt(2 * GRAV * 1.4);
export const V_JUMP2 = Math.sqrt(2 * GRAV * 1.4);
/** a tuck lasts this long; tucked, the body is this tall (else BODY_H) */
export const TUCK_MS = 600;
export const BODY_H = 1.3;
export const TUCK_H = 0.6;
/** the hero's half length along the street, half width across it */
export const BODY_HALF = 0.4;
export const BODY_W = 0.45;
/** an item's half width across its lane */
export const ITEM_W = 0.8;
/** a crate (and a cart) is this tall; a sign hangs from this height; a blue barrier is cleared over this */
export const CRATE_H = 1.0;
export const SIGN_LOW = 0.9;
export const SIGN_HIGH = 2.6;
export const BARRIER_H = 2.3;
/** a correct unlock: the boost */
export const BOOST = 1.5;
export const BOOST_MS = 1500;
/** a hit: stumble at half speed, invulnerable a while; a full lock answered wrong bounces you back */
export const STUMBLE_MS = 600;
export const INVULN_MS = 1200;
export const BOUNCE_M = 3;
export const HEARTS = 3;
/** the tag: global cooldown, hand-off window, an outgoing power lingers this long after a hand-off
 *  (World 6's shared values, menu2/heroTag) */
export { TAG_COOLDOWN_MS, HANDOFF_MS, LINGER_MS };
/** a clutch tag: within this before the lock opens */
export const CLUTCH_MS = 400;
/** a benched hero recharges this many times faster (menu2/heroTag) */
export { BENCH_RECHARGE };
export const ORB_REACH = { d: 0.9, x: 1.0, y: 1.0 } as const;

// ---------- the run ----------

export interface Hero {
   /** distance along the street (the body's centre) */
   d: number;
   lane: number;
   laneFrom: number;
   laneAt: number;
   x: number;
   /** feet height over the street */
   y: number;
   vy: number;
   grounded: boolean;
   airJumped: boolean;
   /** a fresh air action from a mid-air tag was used this airtime */
   freshUsed: boolean;
   tuckUntil: number;
}

export interface StepEvents {
   jumped: boolean;
   airJumped: boolean;
   landed: boolean;
   laneChanged: boolean;
   tucked: boolean;
   tagged: HeroId | "";
   handOff: boolean;
   tagRefused: boolean;
   powered: boolean;
   opened: number[];
   openCount: number;
   clutch: boolean;
   fullPrism: boolean;
   hurt: "" | "crate" | "sign" | "cart" | "lock" | "swoop";
   bounced: boolean;
   shielded: boolean;
   orbList: number[];
   orbCount: number;
   secretList: number[];
   secretCount: number;
   comboBonus: number;
   repainted: number;
   bossTelegraph: boolean;
   bossAttack: boolean;
   bossVulnerable: boolean;
   bossHit: boolean;
   bossPhase: boolean;
   bossDefeated: boolean;
   gust: number;
   finished: boolean;
   lost: boolean;
   timeup: boolean;
}

function createEvents(): StepEvents {
   return {
      jumped: false, airJumped: false, landed: false, laneChanged: false, tucked: false, tagged: "", handOff: false, tagRefused: false, powered: false,
      opened: [], openCount: 0, clutch: false, fullPrism: false, hurt: "", bounced: false, shielded: false, orbList: [], orbCount: 0, secretList: [], secretCount: 0,
      comboBonus: 0, repainted: -1, bossTelegraph: false, bossAttack: false, bossVulnerable: false, bossHit: false, bossPhase: false, bossDefeated: false, gust: 0,
      finished: false, lost: false, timeup: false,
   };
}

function resetEvents(ev: StepEvents): void {
   ev.jumped = ev.airJumped = ev.landed = ev.laneChanged = ev.tucked = ev.handOff = ev.tagRefused = ev.powered = ev.clutch = ev.fullPrism = false;
   ev.bounced = ev.shielded = ev.bossTelegraph = ev.bossAttack = ev.bossVulnerable = ev.bossHit = ev.bossPhase = ev.bossDefeated = false;
   ev.finished = ev.lost = ev.timeup = false;
   ev.tagged = "";
   ev.hurt = "";
   ev.openCount = ev.orbCount = ev.secretCount = ev.comboBonus = ev.gust = 0;
   ev.repainted = -1;
}

export interface StepInput {
   /** a lane press: -1 = towards -x, +1 = towards +x (the Scene turns the screen's left / right to it) */
   lane: number;
   jumpPressed: boolean;
   /** down: tuck (in the air: drop) */
   downPressed: boolean;
   actionPressed: boolean;
   /** 1-5: tag that hero (HERO_IDS order); -1 / +1 cycle; 0 nothing */
   tag: number;
   tagCycle: number;
}

export function createStepInput(): StepInput {
   return { lane: 0, jumpPressed: false, downPressed: false, actionPressed: false, tag: 0, tagCycle: 0 };
}

/** A street item and its live state (level 5 adds the Hawk's own at run time). */
export interface LiveItem extends Item {
   /** a lock's colour now (a repaint changes it) */
   now: HeroId | "";
   opened: boolean;
   /** resolved: hit, passed or opened (a full lock answered wrong re-arms) */
   done: boolean;
   /** level 5: a plate of the five (P3) or a feather-lock (P1) */
   boss: "" | "feather" | "plate";
}

export interface DashRun {
   seed: number;
   level: LevelId;
   lead: HeroId;
   course: Course;
   simMs: number;
   acc: number;
   pend: StepInput;
   hero: Hero;
   active: HeroId;
   tagReadyAt: number;
   lastTagMs: number;
   /** each hero's cooldown left (ms) */
   cool: Record<HeroId, number>;
   dashUntil: number;
   shieldUntil: number;
   magnetUntil: number;
   phaseUntil: number;
   /** the ms the active hero's last power ended (the hand-off window) */
   powerEndAt: number;
   boostUntil: number;
   stumbleUntil: number;
   invulnUntil: number;
   hearts: number;
   hits: number;
   items: LiveItem[];
   /** the next item index not yet behind the hero (a scan start) */
   scan: number;
   orbTaken: boolean[];
   orbs: number;
   locksOpened: number;
   locksMissed: number;
   /** the heroes that opened a lock in the current flow chain (Full Prism: all five) */
   chainHeroes: Set<HeroId>;
   fullPrismDone: boolean;
   /** how far the street has repainted behind the hero (the colour returning) */
   paintedTo: number;
   combo: ComboState;
   secrets: SecretTracker;
   rng: { s: number };
   boss: BossState | null;
   bossEvents: BossEvents;
   /** P2: the swoop's lane and its plate colour */
   swoopLane: number;
   plateColour: HeroId;
   /** P3: the five plates of this window answered right so far */
   platesRight: number;
   platesSeen: number;
   /** level 5: items the Hawk has spawned (their ids) */
   spawned: number;
   ended: "win" | "lose" | "timeup" | null;
   finishMs: number;
   ev: StepEvents;
}

const zeroCool = (): Record<HeroId, number> => ({ riko: 0, nami: 0, kiro: 0, zuno: 0, vexa: 0 });

function live(it: Item, boss: LiveItem["boss"] = ""): LiveItem {
   return { ...it, now: it.colour, opened: false, done: false, boss };
}

export function createRun(seed: number, level: LevelId = 1, lead: HeroId = DEFAULT_HERO): DashRun {
   const course = courseFor(level);
   return {
      seed, level, lead, course, simMs: 0, acc: 0, pend: createStepInput(),
      hero: { d: 0, lane: 1, laneFrom: 1, laneAt: -1e9, x: 0, y: 0, vy: 0, grounded: true, airJumped: false, freshUsed: false, tuckUntil: -1 },
      active: lead, tagReadyAt: 0, lastTagMs: -1e9, cool: zeroCool(),
      dashUntil: -1, shieldUntil: -1, magnetUntil: -1, phaseUntil: -1, powerEndAt: -1e9,
      boostUntil: -1, stumbleUntil: -1, invulnUntil: -1, hearts: HEARTS, hits: 0,
      items: course.items.map((it) => live(it)), scan: 0, orbTaken: course.orbs.map(() => false), orbs: 0, locksOpened: 0, locksMissed: 0,
      chainHeroes: new Set(), fullPrismDone: false, paintedTo: 0,
      combo: createCombo(), secrets: createSecretTracker(SECRETS[level]), rng: { s: (level * 7919) >>> 0 || 1 },
      boss: course.cfg.boss ? createBoss(HAWK) : null, bossEvents: createBossEvents(), swoopLane: 1, plateColour: "riko", platesRight: 0, platesSeen: 0, spawned: 0,
      ended: null, finishMs: 0, ev: createEvents(),
   };
}

// ---------- reads ----------

export const dashing = (run: DashRun): boolean => run.simMs < run.dashUntil;
export const shielded = (run: DashRun): boolean => run.simMs < run.shieldUntil;
export const magnetOn = (run: DashRun): boolean => run.simMs < run.magnetUntil;
export const phasing = (run: DashRun): boolean => run.simMs < run.phaseUntil;

/** The forward speed now (m/s): base + boost + Riko's dash, halved while stumbling. */
export function speedOf(run: DashRun): number {
   let v = run.course.cfg.speed;
   if (run.simMs < run.boostUntil) v += BOOST;
   if (dashing(run)) v += DASH_BOOST;
   if (run.simMs < run.stumbleUntil) v *= 0.5;
   return v;
}

/** May the player tag now (cooldown, Prism Lock zones)? */
export function canTag(run: DashRun): boolean {
   if (run.simMs < run.tagReadyAt) return false;
   for (const z of run.course.noTag) if (run.hero.d >= z.from && run.hero.d <= z.to) return false;
   return true;
}

/** Does the active hero's power open a lock of colour c right now? */
export function opens(run: DashRun, c: HeroId | ""): boolean {
   switch (c) {
      case "riko":
         return dashing(run);
      case "nami":
         return run.hero.y >= BARRIER_H;
      case "kiro":
         return shielded(run);
      case "zuno":
         return magnetOn(run);
      case "vexa":
         return phasing(run);
      default:
         return false;
   }
}

/** How tall the hero's body stands now. */
export const bodyHeight = (run: DashRun): number => (run.simMs < run.hero.tuckUntil && run.hero.grounded ? TUCK_H : BODY_H);

// ---------- the step ----------

function pushSecret(run: DashRun, id: string): void {
   const index = secretIndex(run.level, id);
   if (index < 0) return;
   if (!collectSecret(run.secrets, index)) return;
   run.ev.secretList[run.ev.secretCount++] = index;
}

function chain(run: DashRun, base: number): void {
   run.ev.comboBonus += comboHit(run.combo, COMBO, run.simMs, base);
}

function hurt(run: DashRun, why: StepEvents["hurt"]): void {
   if (run.simMs < run.invulnUntil) return;
   if (shielded(run) && why !== "lock") {
      run.ev.shielded = true;
      return;
   }
   run.hits += 1;
   run.hearts -= 1;
   run.ev.hurt = why;
   run.stumbleUntil = run.simMs + STUMBLE_MS;
   run.invulnUntil = run.simMs + INVULN_MS;
   comboBreak(run.combo);
   run.chainHeroes.clear();
   if (run.hearts <= 0 && run.ended === null) {
      run.ended = "lose";
      run.ev.lost = true;
   }
}

function endPower(run: DashRun, hero: HeroId, until: number): void {
   const p = heroById(hero).power;
   if (p === "dash") run.dashUntil = Math.min(run.dashUntil, until);
   else if (p === "shield") run.shieldUntil = Math.min(run.shieldUntil, until);
   else if (p === "magnet") run.magnetUntil = Math.min(run.magnetUntil, until);
   else if (p === "phase") run.phaseUntil = Math.min(run.phaseUntil, until);
}

function powerUntil(run: DashRun, hero: HeroId): number {
   const p = heroById(hero).power;
   return p === "dash" ? run.dashUntil : p === "shield" ? run.shieldUntil : p === "magnet" ? run.magnetUntil : p === "phase" ? run.phaseUntil : -1;
}

function tag(run: DashRun, to: HeroId): void {
   const ms = run.simMs;
   if (to === run.active) return;
   if (!canTag(run)) {
      run.ev.tagRefused = true;
      return;
   }
   const from = run.active;
   const ownUntil = powerUntil(run, from);
   const handOff = ms < ownUntil || (run.powerEndAt > 0 && ms - run.powerEndAt <= HANDOFF_MS);
   // the outgoing power ends with the tag, or lingers LINGER_MS on a hand-off
   endPower(run, from, handOff ? ms + LINGER_MS : ms);
   if (handOff) {
      run.ev.handOff = true;
      chain(run, 0);
   }
   run.active = to;
   run.tagReadyAt = ms + TAG_COOLDOWN_MS;
   run.lastTagMs = ms;
   run.powerEndAt = -1e9;
   // fresh legs: one fresh air action per airtime
   const h = run.hero;
   if (!h.grounded && !h.freshUsed) {
      h.airJumped = false;
      h.freshUsed = true;
   }
   run.ev.tagged = to;
}

function firePower(run: DashRun): void {
   const ms = run.simMs;
   const def = heroById(run.active);
   if (def.power === "doubleJump" || run.cool[run.active] > 0) return;
   run.cool[run.active] = def.cooldownMs;
   run.ev.powered = true;
   const until = ms + def.durationMs;
   if (def.power === "dash") run.dashUntil = until;
   else if (def.power === "shield") run.shieldUntil = until;
   else if (def.power === "magnet") run.magnetUntil = until;
   else if (def.power === "phase") run.phaseUntil = until;
   run.powerEndAt = until;
}

function openLock(run: DashRun, it: LiveItem): void {
   const ms = run.simMs;
   it.opened = true;
   it.done = true;
   run.locksOpened += 1;
   run.ev.opened[run.ev.openCount++] = it.id;
   run.boostUntil = ms + BOOST_MS;
   chain(run, COMBO_BASE_MS.lock);
   if (ms - run.lastTagMs <= CLUTCH_MS) {
      run.ev.clutch = true;
      chain(run, COMBO_BASE_MS.clutch);
   }
   if (it.now) run.chainHeroes.add(it.now);
   if (run.chainHeroes.size >= 5 && !run.fullPrismDone) {
      run.fullPrismDone = true;
      run.ev.fullPrism = true;
      chain(run, 0);
      pushSecret(run, "full-prism");
   }
   run.paintedTo = Math.max(run.paintedTo, it.d + 20);
   if (run.level === 2 && it.now === "vexa" && it.lane >= 0 && it.d > 550) pushSecret(run, "courtyard");
   if (run.level === 3 && it.now === "zuno" && it.lane >= 0 && it.d > 500) pushSecret(run, "alley");
   if (run.level === 4 && it.now === "riko" && !litAt(run, it.d)) pushSecret(run, "shop-window");
   const b = run.boss;
   if (b && it.boss === "feather" && b.step === "vulnerable" && b.phase === 0) bossHit(run);
}

function litAt(run: DashRun, d: number): boolean {
   const c = run.course;
   if (!c.cfg.night) return true;
   for (const x of c.lamps) if (Math.abs(x - d) <= 9) return true;
   return false;
}

/** Item it overlaps the hero across the street? */
function laneHit(run: DashRun, it: LiveItem): boolean {
   if (it.lane < 0) return true;
   const x = it.kind === "cart" ? cartX(it, run.simMs) : laneX(it.lane);
   return Math.abs(run.hero.x - x) < ITEM_W + BODY_W;
}

function resolveItem(run: DashRun, it: LiveItem): void {
   const h = run.hero;
   switch (it.kind) {
      case "crate":
      case "cart":
         if (laneHit(run, it) && h.y < CRATE_H) {
            it.done = true;
            hurt(run, it.kind);
         }
         return;
      case "sign": {
         if (!laneHit(run, it)) return;
         const top = h.y + bodyHeight(run);
         if (top > SIGN_LOW && h.y < SIGN_HIGH) {
            it.done = true;
            hurt(run, "sign");
         }
         return;
      }
      case "lock": {
         if (it.boss === "plate") {
            // P3: a plate is passed as its hero, or missed; it never blocks
            it.done = true;
            run.platesSeen += 1;
            if (run.active === it.now) run.platesRight += 1;
            return;
         }
         if (!laneHit(run, it)) return;
         if (opens(run, it.now)) {
            openLock(run, it);
            return;
         }
         run.locksMissed += 1;
         if (it.lane >= 0) {
            it.done = true;
            hurt(run, "lock");
            return;
         }
         // a full lock answered wrong: bounce back and lose a heart; it stays to be answered
         h.d = it.d - BOUNCE_M - BODY_HALF;
         run.ev.bounced = true;
         run.invulnUntil = Math.min(run.invulnUntil, run.simMs);
         hurt(run, "lock");
         return;
      }
   }
}

function bossHit(run: DashRun): void {
   const b = run.boss;
   if (!b) return;
   const r = hitBoss(b, HAWK, 1, run.bossEvents);
   if (r === "ignored") return;
   run.ev.bossHit = true;
   chain(run, COMBO_BASE_MS.boss);
   if (r === "phase") run.ev.bossPhase = true;
   if (r === "defeated") {
      run.ev.bossDefeated = true;
      if (run.fullPrismDone || run.platesRight >= 5) pushSecret(run, "prism-shard");
      finish(run);
   }
}

function finish(run: DashRun): void {
   if (run.ended !== null) return;
   if (run.level === 1 && run.locksMissed === 0 && run.hits === 0) pushSecret(run, "perfect-gate");
   run.ended = "win";
   run.finishMs = run.simMs;
   run.ev.finished = true;
}

function spawn(run: DashRun, kind: Item["kind"], d: number, lane: number, colour: HeroId | "", boss: LiveItem["boss"]): void {
   const it = live({ id: 100_000 + run.spawned++, kind, d, depth: kind === "lock" ? (colour === "nami" ? 0.6 : 1.0) : 1.0, lane, colour, repaint: "", cart: null }, boss);
   // keep the list sorted by distance from the scan point on
   let k = run.items.length;
   while (k > run.scan && run.items[k - 1].d > d) k -= 1;
   run.items.splice(k, 0, it);
}

const pickHero = (run: DashRun): HeroId => HERO_IDS[Math.floor(rngNext(run.rng) * 5) % 5];

/** Level 5: the Echo Storm Hawk's machine and its spawns. */
function stepHawk(run: DashRun): void {
   const b = run.boss;
   if (!b || run.ended !== null) return;
   const ev = run.ev;
   const bev = stepBoss(b, HAWK, STEP_MS, run.bossEvents);
   const h = run.hero;
   const v = speedOf(run);
   if (bev.telegraph) {
      ev.bossTelegraph = true;
      if (b.phase === 1) {
         run.swoopLane = Math.floor(rngNext(run.rng) * 3) % 3;
         run.plateColour = pickHero(run);
      }
   }
   if (bev.attack) {
      ev.bossAttack = true;
      // P1: it drops a crate ahead in a lane; P3: a gust pushes you one lane
      if (b.phase === 0) spawn(run, "crate", h.d + Math.max(12, v * 1.6), Math.floor(rngNext(run.rng) * 3) % 3, "", "");
      if (b.phase === 2) {
         const dir = h.lane === 0 ? 1 : h.lane === 2 ? -1 : rngNext(run.rng) < 0.5 ? -1 : 1;
         h.laneFrom = h.lane;
         h.lane += dir;
         h.laneAt = run.simMs;
         ev.gust = dir;
      }
   }
   if (bev.vulnerable) {
      ev.bossVulnerable = true;
      if (b.phase === 0) spawn(run, "lock", h.d + v * Math.max(1.2, run.course.cfg.leadS + 0.3), -1, pickHero(run), "feather");
      if (b.phase === 2) {
         run.platesRight = 0;
         run.platesSeen = 0;
         const order = [...HERO_IDS];
         for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(rngNext(run.rng) * (i + 1)) % (i + 1);
            [order[i], order[j]] = [order[j], order[i]];
         }
         for (let k = 0; k < 5; k++) spawn(run, "lock", h.d + v * (PLATE_FIRST_S + k * PLATE_GAP_S), -1, order[k], "plate");
      }
   }
   // P2: the swoop hurts in its lane on the ground; at the bottom, its plate: be its hero and jump into it
   if (b.phase === 1 && b.step === "attack" && Math.abs(h.x - laneX(run.swoopLane)) < 1.2 && h.y < 1.2) hurt(run, "swoop");
   if (b.phase === 1 && b.step === "vulnerable" && run.active === run.plateColour && !h.grounded && h.y > 0.6 && Math.abs(h.x - laneX(run.swoopLane)) < 1.2) bossHit(run);
   // P3: all five plates passed as their heroes
   if (b.phase === 2 && b.step === "vulnerable" && run.platesSeen >= 5) {
      if (run.platesRight >= 5) bossHit(run);
      run.platesSeen = 0;
   }
}

function subStep(run: DashRun, input: StepInput): void {
   const ms = run.simMs;
   const dt = STEP_MS / 1000;
   const h = run.hero;
   const ev = run.ev;
   const p = run.pend;
   // tags
   if (p.tag >= 1 && p.tag <= 5) tag(run, HERO_IDS[p.tag - 1]);
   else if (p.tagCycle !== 0) {
      const i = HERO_IDS.indexOf(run.active);
      tag(run, HERO_IDS[(i + p.tagCycle + 5) % 5]);
   }
   p.tag = 0;
   p.tagCycle = 0;
   // cooldowns: a benched hero recharges faster
   for (const id of HERO_IDS) if (run.cool[id] > 0) run.cool[id] = Math.max(0, run.cool[id] - STEP_MS * (id === run.active ? 1 : BENCH_RECHARGE));
   if (p.actionPressed) {
      p.actionPressed = false;
      if (ms >= run.stumbleUntil) firePower(run);
   }
   // lanes
   if (p.lane !== 0) {
      const to = Math.max(0, Math.min(2, h.lane + p.lane));
      if (to !== h.lane) {
         h.laneFrom = laneXInv(h.x);
         h.lane = to;
         h.laneAt = ms;
         ev.laneChanged = true;
      }
      p.lane = 0;
   }
   const k = Math.min(1, (ms - h.laneAt) / LANE_MS);
   const s = k * k * (3 - 2 * k);
   h.x = laneX(h.laneFrom) + (laneX(h.lane) - laneX(h.laneFrom)) * s;
   // jump, double jump, tuck
   if (p.jumpPressed) {
      p.jumpPressed = false;
      if (h.grounded) {
         h.vy = V_JUMP;
         h.grounded = false;
         ev.jumped = true;
      } else if (run.active === "nami" && !h.airJumped) {
         h.vy = V_JUMP2;
         h.airJumped = true;
         ev.airJumped = true;
      }
   }
   if (p.downPressed) {
      p.downPressed = false;
      h.tuckUntil = ms + TUCK_MS;
      if (!h.grounded) h.vy = Math.min(h.vy, -12);
      ev.tucked = true;
   }
   if (!h.grounded) {
      h.vy -= GRAV * dt;
      h.y += h.vy * dt;
      if (h.y <= 0) {
         h.y = 0;
         h.vy = 0;
         h.grounded = true;
         h.airJumped = false;
         h.freshUsed = false;
         ev.landed = true;
      }
   }
   // forward
   const v = speedOf(run);
   h.d += v * dt;
   // the items the body overlaps
   const front = h.d + BODY_HALF;
   const back = h.d - BODY_HALF;
   while (run.scan < run.items.length && run.items[run.scan].d + run.items[run.scan].depth < back - 2) run.scan += 1;
   for (let i = run.scan; i < run.items.length; i++) {
      const it = run.items[i];
      if (it.d > front) break;
      if (it.done || it.d + it.depth < back) continue;
      // level 3: a shadow roller repaints the lock once, 1 s before you reach it
      if (it.repaint && it.now === it.colour && it.d - h.d <= v * 1.0) {
         it.now = it.repaint;
         ev.repainted = it.id;
      }
      resolveItem(run, it);
   }
   // repaints happen a second ahead, not only on contact
   if (run.course.cfg.repaints) {
      for (let i = run.scan; i < run.items.length; i++) {
         const it = run.items[i];
         if (it.d - h.d > v * 1.0 + 1) break;
         if (it.repaint && !it.done && it.now === it.colour && it.d - h.d <= v * 1.0) {
            it.now = it.repaint;
            ev.repainted = it.id;
         }
      }
   }
   // orbs (Zuno's magnet pulls any within 6 m)
   const c = run.course;
   const cy = h.y + 0.6;
   for (let i = 0; i < c.orbs.length; i++) {
      if (run.orbTaken[i]) continue;
      const o = c.orbs[i];
      if (o.d > h.d + MAGNET_REACH + 1) break;
      const near = Math.abs(o.d - h.d) < ORB_REACH.d && Math.abs(laneX(o.lane) - h.x) < ORB_REACH.x && Math.abs(o.y - cy) < ORB_REACH.y;
      const pulled = magnetOn(run) && Math.hypot(o.d - h.d, laneX(o.lane) - h.x, o.y - cy) <= MAGNET_REACH;
      if (!near && !pulled) continue;
      run.orbTaken[i] = true;
      run.orbs += 1;
      ev.orbList[ev.orbCount++] = i;
   }
   stepHawk(run);
   run.simMs += STEP_MS;
   if (run.ended === null && !c.cfg.boss && h.d >= c.length) finish(run);
   if (run.ended === null && run.simMs >= LEVELS[run.level].durationMs) {
      run.ended = "timeup";
      ev.timeup = true;
   }
}

/** The lane index nearest x (for a lane change that starts mid-change). */
function laneXInv(x: number): number {
   return Math.max(0, Math.min(2, Math.round(x / LANE_W + 1)));
}

/** Advances the run by one rendered frame (any dt); returns this frame's events (reused object). */
export function step(run: DashRun, frameMs: number, input: StepInput): StepEvents {
   const ev = run.ev;
   resetEvents(ev);
   if (run.ended !== null) return ev;
   const p = run.pend;
   if (input.lane !== 0) p.lane = Math.sign(input.lane);
   if (input.jumpPressed) p.jumpPressed = true;
   if (input.downPressed) p.downPressed = true;
   if (input.actionPressed) p.actionPressed = true;
   if (input.tag !== 0) p.tag = input.tag;
   if (input.tagCycle !== 0) p.tagCycle = Math.sign(input.tagCycle);
   run.acc += Math.min(MAX_FRAME_MS, Math.max(0, frameMs));
   while (run.acc >= STEP_MS - 1e-9 && run.ended === null) {
      run.acc -= STEP_MS;
      subStep(run, input);
   }
   return ev;
}

// ---------- the boss reads (the scene) ----------

export const bossVulnerable = (run: DashRun): boolean => run.boss !== null && run.boss.step === "vulnerable";

// ---------- the score ----------

/** The submitted time: the finish less the flow bonus. */
export function runTimeMs(playMs: number, comboMs = 0): number {
   return Math.max(0, playMs - comboMs);
}

export const submittedMs = (run: DashRun): number => runTimeMs(run.finishMs, run.combo.bonusTotal);

/**
 * The orbs star: a run can't hold every lane at once (a lock reward and a free lane's line compete), so
 * the star asks for 60 % of the street's colour orbs; level 5 (its length is the fight's) for 20.
 */
export const orbTotal = (level: LevelId): number => (LEVELS[level].boss ? 20 : Math.ceil(courseFor(level).orbs.length * 0.6));

/** The run's stars (clear, every orb, the target time) and the no-hit badge. */
export function runStars(run: DashRun): StarResult {
   const cleared = run.ended === "win";
   return evaluateStars(starSpecFor(run.level, orbTotal(run.level)), { cleared, orbs: run.orbs, goalValue: cleared ? submittedMs(run) : Number.NaN, hits: run.hits });
}

export function flowOf(run: DashRun): number {
   return comboFlow(run.combo, COMBO, run.simMs);
}

// ---------- the limits (README "Server limits and why they hold"; bound.ts) ----------

export interface LevelLimits {
   kind: "time";
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   timeBaseMs: number;
}

/** The most the submitted time can be cut by the flow meter (ms): every lock once (+ a clutch), every Hawk hit. */
export function maxBonusMs(level: LevelId): number {
   const c = courseFor(level);
   const locks = c.cfg.boss ? HAWK.maxHp * 2 : c.items.filter((i) => i.kind === "lock").length;
   const sources = [
      { count: locks, base: COMBO_BASE_MS.lock },
      { count: locks, base: COMBO_BASE_MS.clutch },
      { count: c.cfg.boss ? HAWK.maxHp : 0, base: COMBO_BASE_MS.boss },
   ];
   return comboMaxBonus({ combo: COMBO, sources });
}

export { SECRETS, HAWK };

/** The shell's score for a win: the time game submits its submitted time. */
export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   if (s.endReason === "win" && finishMs > 0) return { score: s.score, durationMs: runTimeMs(finishMs, s.stats[STAT.comboMs] ?? 0) };
   return { score: s.score, durationMs: s.elapsedMs };
}

export const STAT = {
   orbs: "orbs",
   hearts: "hearts",
   distance: "distance",
   active: "active",
   finishMs: "finishMs",
   hits: "hits",
   comboMs: "comboMs",
   comboChain: "comboChain",
   comboMult: "comboMult",
   comboFlow: "comboFlow",
   spectrum: "spectrum",
   tagReady: "tagReady",
   noTag: "noTag",
   cool0: "cool0",
   cool1: "cool1",
   cool2: "cool2",
   cool3: "cool3",
   cool4: "cool4",
   bossHp: "bossHp",
   bossPhase: "bossPhase",
   bossOpen: "bossOpen",
   bossFlash: "bossFlash",
   stars: "stars",
   newStars: "newStars",
   noHit: "noHit",
   secrets: "secrets",
   newSecrets: "newSecrets",
   xp: "xp",
} as const;

/** The level limits proven in proof.test.ts: bound.ts proposeLimits, pinned. */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, LevelLimits> = {
   1: { kind: "time", maxScore: 10_460, minDurationMs: 45_400, maxDurationMs: 150_000, timeBaseMs: 150_000 },
   2: { kind: "time", maxScore: 12_180, minDurationMs: 58_200, maxDurationMs: 180_000, timeBaseMs: 180_000 },
   3: { kind: "time", maxScore: 14_000, minDurationMs: 70_000, maxDurationMs: 210_000, timeBaseMs: 210_000 },
   4: { kind: "time", maxScore: 15_990, minDurationMs: 80_100, maxDurationMs: 240_000, timeBaseMs: 240_000 },
   5: { kind: "time", maxScore: 28_090, minDurationMs: 19_100, maxDurationMs: 300_000, timeBaseMs: 300_000 },
};
