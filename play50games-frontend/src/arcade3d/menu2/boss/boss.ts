// Menu 2 level 5 bosses (00-framework.md pillar 4): a data-driven state machine. A boss is a config:
// phases by health, each cycling its attacks; every attack is telegraph -> attack -> vulnerable
// window. Hits land only in the vulnerable window, flash the boss, and can push it into the next
// phase (a short transition) or defeat it (a slow-mo finish that is visual only: the rules clock
// never slows). Pure, deterministic and allocation-free per step.

export interface BossAttack {
   id: string;
   /** wind-up the player can read (glow, sound) */
   telegraphMs: number;
   /** the attack itself (the game checks its hazard during this step) */
   attackMs: number;
   /** the boss is open: hits count */
   vulnerableMs: number;
   /** damage the attack deals to the hero (the game applies it) */
   damage?: number;
}

export interface BossPhase {
   id: string;
   name: string;
   /** this phase runs while hp / maxHp > endsAt (the last phase ends at 0) */
   endsAt: number;
   /** cycled in order */
   attacks: readonly BossAttack[];
}

export interface BossConfig {
   id: string;
   name: string;
   maxHp: number;
   phases: readonly BossPhase[];
   /** before the first attack (the boss's entrance) */
   introMs: number;
   /** between phases: no attacks, no hits */
   transitionMs: number;
   /** the hit flash */
   hitFlashMs: number;
   /** a hit closes the vulnerable window early when true (one hit per window) */
   oneHitPerWindow: boolean;
   /** the defeat: rules time until "done" */
   defeatMs: number;
   /** the visual slow-mo on the finish: the visuals' time scale, held for durationMs of the defeat */
   slowMo: { scale: number; durationMs: number };
}

export type BossStep = "intro" | "telegraph" | "attack" | "vulnerable" | "transition" | "defeat" | "done";

export interface BossState {
   step: BossStep;
   /** ms spent in the current step */
   stepMs: number;
   phase: number;
   /** the attack index inside the phase's list */
   attack: number;
   hp: number;
   /** ms left on the hit flash */
   flashMs: number;
   /** ms since the defeat began (-1 before) */
   defeatMs: number;
   hits: number;
}

/** What happened in one stepBoss call. Reused: reset at each call. */
export interface BossEvents {
   telegraph: boolean;
   attack: boolean;
   vulnerable: boolean;
   recovered: boolean;
   phaseChanged: boolean;
   defeated: boolean;
   done: boolean;
}

export function createBossEvents(): BossEvents {
   return { telegraph: false, attack: false, vulnerable: false, recovered: false, phaseChanged: false, defeated: false, done: false };
}

export function createBoss(cfg: BossConfig): BossState {
   return { step: "intro", stepMs: 0, phase: 0, attack: 0, hp: cfg.maxHp, flashMs: 0, defeatMs: -1, hits: 0 };
}

export function currentAttack(s: BossState, cfg: BossConfig): BossAttack | null {
   const p = cfg.phases[s.phase];
   return p && p.attacks.length > 0 ? p.attacks[s.attack % p.attacks.length] : null;
}

function stepLength(s: BossState, cfg: BossConfig): number {
   switch (s.step) {
      case "intro":
         return cfg.introMs;
      case "transition":
         return cfg.transitionMs;
      case "defeat":
         return cfg.defeatMs;
      case "done":
         return Infinity;
   }
   const a = currentAttack(s, cfg);
   if (!a) return Infinity;
   return s.step === "telegraph" ? a.telegraphMs : s.step === "attack" ? a.attackMs : a.vulnerableMs;
}

function enter(s: BossState, step: BossStep, ev: BossEvents): void {
   s.step = step;
   s.stepMs = 0;
   if (step === "telegraph") ev.telegraph = true;
   else if (step === "attack") ev.attack = true;
   else if (step === "vulnerable") ev.vulnerable = true;
   else if (step === "done") ev.done = true;
}

/** Advances the boss by dtMs of rules time. Several steps may pass in one call. */
export function stepBoss(s: BossState, cfg: BossConfig, dtMs: number, ev: BossEvents): BossEvents {
   ev.telegraph = ev.attack = ev.vulnerable = ev.recovered = ev.phaseChanged = ev.defeated = ev.done = false;
   if (!(dtMs > 0)) return ev;
   s.flashMs = Math.max(0, s.flashMs - dtMs);
   if (s.defeatMs >= 0) s.defeatMs += dtMs;
   let left = dtMs;
   for (let guard = 0; guard < 64 && s.step !== "done"; guard++) {
      const len = stepLength(s, cfg);
      if (s.stepMs + left < len) {
         s.stepMs += left;
         return ev;
      }
      left -= len - s.stepMs;
      advance(s, cfg, ev);
   }
   return ev;
}

function advance(s: BossState, cfg: BossConfig, ev: BossEvents): void {
   switch (s.step) {
      case "intro":
      case "transition":
         s.attack = 0;
         enter(s, "telegraph", ev);
         return;
      case "telegraph":
         enter(s, "attack", ev);
         return;
      case "attack":
         enter(s, "vulnerable", ev);
         return;
      case "vulnerable":
         s.attack += 1;
         ev.recovered = true;
         enter(s, "telegraph", ev);
         return;
      case "defeat":
         enter(s, "done", ev);
         return;
   }
}

/** The phase the health is in (hp / maxHp > endsAt). */
export function phaseForHp(cfg: BossConfig, hp: number): number {
   const f = hp / cfg.maxHp;
   for (let i = 0; i < cfg.phases.length; i++) if (f > cfg.phases[i].endsAt) return i;
   return cfg.phases.length - 1;
}

export type HitResult = "ignored" | "hit" | "phase" | "defeated";

/** A hit on the boss. Counts only in the vulnerable window. */
export function hitBoss(s: BossState, cfg: BossConfig, damage: number, ev: BossEvents): HitResult {
   if (s.step !== "vulnerable" || !(damage > 0)) return "ignored";
   s.hp = Math.max(0, s.hp - damage);
   s.hits += 1;
   s.flashMs = cfg.hitFlashMs;
   if (s.hp === 0) {
      s.defeatMs = 0;
      ev.defeated = true;
      enter(s, "defeat", ev);
      return "defeated";
   }
   const next = phaseForHp(cfg, s.hp);
   if (next !== s.phase) {
      s.phase = next;
      s.attack = 0;
      ev.phaseChanged = true;
      enter(s, "transition", ev);
      return "phase";
   }
   if (cfg.oneHitPerWindow) {
      s.attack += 1;
      ev.recovered = true;
      enter(s, "telegraph", ev);
   }
   return "hit";
}

/** The visuals' time scale (1 normally, cfg.slowMo.scale through the finish, eased back). Never feed it to the rules. */
export function bossTimeScale(s: BossState, cfg: BossConfig): number {
   if (s.defeatMs < 0) return 1;
   const d = cfg.slowMo.durationMs;
   if (s.defeatMs >= d) return 1;
   const ease = 0.8 * d;
   if (s.defeatMs <= ease) return cfg.slowMo.scale;
   const k = (s.defeatMs - ease) / (d - ease);
   return cfg.slowMo.scale + (1 - cfg.slowMo.scale) * k * k * (3 - 2 * k);
}

/** 0..1 through the current step (telegraph glow, attack sweep). */
export function stepProgress(s: BossState, cfg: BossConfig): number {
   const len = stepLength(s, cfg);
   return Number.isFinite(len) && len > 0 ? Math.min(1, s.stepMs / len) : 0;
}

/** The health bar's phase marks (fractions of max hp where a phase ends, not 0). */
export function phaseMarks(cfg: BossConfig): number[] {
   return cfg.phases.map((p) => p.endsAt).filter((f) => f > 0 && f < 1);
}

/** The most hits a vulnerable window can take (for a game's proof): one when oneHitPerWindow. */
export function hitsToDefeat(cfg: BossConfig, damage: number): number {
   return Math.ceil(cfg.maxHp / damage);
}

export function bossProblems(cfg: BossConfig): string[] {
   const out: string[] = [];
   if (!(cfg.maxHp > 0)) out.push("maxHp must be > 0");
   if (cfg.phases.length < 1 || cfg.phases.length > 3) out.push("a boss has 1 to 3 phases");
   let prev = 1;
   cfg.phases.forEach((p, i) => {
      if (!(p.endsAt < prev) || p.endsAt < 0) out.push(`phase ${p.id}: endsAt must fall (got ${p.endsAt} after ${prev})`);
      prev = p.endsAt;
      if (p.attacks.length === 0) out.push(`phase ${p.id}: needs an attack`);
      for (const a of p.attacks) {
         if (!(a.telegraphMs >= 300)) out.push(`${p.id}/${a.id}: telegraph under 300 ms is unreadable`);
         if (!(a.attackMs > 0) || !(a.vulnerableMs > 0)) out.push(`${p.id}/${a.id}: attack and vulnerable must be > 0`);
      }
      if (i === cfg.phases.length - 1 && p.endsAt !== 0) out.push("the last phase must end at 0");
   });
   if (!(cfg.slowMo.scale > 0 && cfg.slowMo.scale <= 1)) out.push("slowMo.scale must be in (0, 1]");
   if (cfg.slowMo.durationMs > cfg.defeatMs) out.push("slowMo must fit inside defeatMs");
   if (cfg.introMs < 0 || cfg.transitionMs < 0 || !(cfg.defeatMs > 0) || cfg.hitFlashMs < 0) out.push("timings must be >= 0 (defeat > 0)");
   return out;
}
