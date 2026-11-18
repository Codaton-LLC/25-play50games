"use client";

// The game HUD: the ORDER (a chip per colour in play: how many cores of it are still wanted; full ones
// tick off), the wave, orbs, the hero power and the flow meter on the left; the title, the level, the
// run clock, the hits and the order's progress at the top centre; under it "Order complete: to the gate"
// once it is, the capsule prompt while a closed capsule is in reach, and on level 5 the Core Sprite's
// health bar with what to do in each phase. The shell keeps Mute / Pause; its clock chip is off.
// Local multiplayer: the "2-4 players" button, the join screen, per-player chips and the podium.
import { useEffect, useSyncExternalStore } from "react";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useLevel } from "@/arcade3d/core/level";
import ComboMeter from "@/arcade3d/menu2/combo/ComboMeter";
import BossHealthBar from "@/arcade3d/menu2/boss/BossHealthBar";
import { phaseMarks } from "@/arcade3d/menu2/boss/boss";
import { playersStore, usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import HeroPicker from "@/arcade3d/menu2/heroes/HeroPicker";
import OrbitHud from "@/arcade3d/menu2/camera/OrbitHud";
import stack from "@/arcade3d/menu2/hud/HudStack.module.css";
import { HEROES, heroById, pickedHero, selectHero, subscribeHero, type HeroId } from "./heroes";
import { STAT, runTimeMs } from "./rules";
import type { CoreLevel } from "./levels";
import { COMBO, CORE_SPRITE } from "./progression";
import { courseFor, COLOR_NAMES } from "./course";
import { CORE_COLORS } from "./look";
import { MultiplayerHud, MultiplayerButton } from "./MultiplayerHud";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.floor(ms / 1000);
   const tenths = Math.floor((ms % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

const HERO_STAT: HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

const PHASE_HINTS = ["Jump its shock ring, then touch it while it is dazed", "It rushes now: stay close, jump, touch", "Overcharged: one last core!"];

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? CORE_SPRITE.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const started = useArcadeStore((s) => s.stats[STAT.bossHp] !== undefined);
   if (!started) return null;
   return (
      <div className={stack.boss}>
         <BossHealthBar name={CORE_SPRITE.name} phaseName={CORE_SPRITE.phases[phase]?.name ?? ""} hp={hp} maxHp={CORE_SPRITE.maxHp} marks={phaseMarks(CORE_SPRITE)} vulnerable={open} flash={flash} accent="#c084fc" />
         <div className={stack.hint}>{hp > 0 ? PHASE_HINTS[phase] ?? "" : "The gate is open: go!"}</div>
      </div>
   );
}

const NEED = [STAT.need0, STAT.need1, STAT.need2, STAT.need3, STAT.need4] as const;

/** The order: one chip per colour in play, with how many of it are still wanted. */
function Order({ level }: { level: CoreLevel["id"] }) {
   const course = courseFor(level);
   const left = useArcadeStore((s) => NEED.map((k, c) => s.stats[k] ?? course.order[c]).join(","));
   const counts = left.split(",").map(Number);
   return (
      <div className={styles.order} aria-label="The order">
         {course.colors.map((c) => {
            if (course.order[c] === 0) return null;
            const n = counts[c];
            return (
               <span key={c} className={`${styles.chip} ${n === 0 ? styles.chipDone : ""}`} style={{ borderColor: CORE_COLORS[c] }} aria-label={`${COLOR_NAMES[c]}: ${n} more`}>
                  <span className={styles.dot} style={{ background: CORE_COLORS[c] }} aria-hidden="true" />
                  {n === 0 ? "✓" : n}
               </span>
            );
         })}
      </div>
   );
}

/** "Order complete" once the gate is open; the capsule prompt while a closed capsule is in reach. */
function Prompts() {
   const gate = useArcadeStore((s) => (s.stats[STAT.gate] ?? 0) === 1);
   const near = useArcadeStore((s) => (s.stats[STAT.near] ?? 0) > 0);
   const live = useArcadeStore((s) => s.phase === "playing");
   const playing = usePlayers((s) => s.phase === "playing");
   if (!live || playing) return null;
   if (gate)
      return (
         <div className={`${styles.prompt} ${styles.switchPrompt} ${styles.done}`} role="status">
            Order complete: to the gate!
         </div>
      );
   if (!near) return null;
   return (
      <div className={`${styles.prompt} ${styles.switchPrompt}`} role="status">
         <span className={styles.key}>E</span> Open the capsule
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<CoreLevel>();
   const level = config?.id ?? 1;
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const power = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const hits = useArcadeStore((s) => s.stats[STAT.hits] ?? 0);
   const wave = useArcadeStore((s) => s.stats[STAT.wave] ?? 1);
   const cores = useArcadeStore((s) => s.stats[STAT.cores] ?? 0);
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const comboMs = useArcadeStore((s) => s.stats[STAT.comboMs] ?? 0);
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => s.stats[STAT.comboMult] ?? 100);
   const flow = useArcadeStore((s) => s.stats[STAT.comboFlow] ?? 0);
   const shown = runTimeMs(tenths * 100, orbs, comboMs);
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined ? pick : HERO_STAT[heroStat] ?? "vexa");
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   const powerText = hero.id === "nami" ? "Double" : power > 0 ? `${power}s` : hero.powerLabel;
   void cores;
   const course = courseFor(level);
   const waves = course.waves.length;
   const total = course.order.reduce((x, y) => x + y, 0);
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         <div className={stack.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <Order level={level} />
            <div className={styles.pill} aria-label={`Wave ${Math.min(wave, waves)} of ${waves}`}>
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="7" fill="none" stroke="#5eead4" strokeWidth="2.4" />
                  <circle cx="12" cy="12" r="2.6" fill="#5eead4" />
               </svg>
               <span className={styles.value}>
                  {Math.min(wave, waves)}/{waves}
               </span>
            </div>
            <div className={styles.pill} aria-label={`Orbs ${orbs}`}>
               <span className={styles.orb} aria-hidden="true" />
               <span className={styles.value}>{orbs}</span>
            </div>
            <div className={styles.pill} aria-label={`${hero.name}: ${powerText}`}>
               <span className={styles.swatch} style={{ background: hero.color }} aria-hidden="true" />
               <span className={styles.value}>{powerText}</span>
            </div>
            <ComboMeter chain={chain} multiplier={mult / 100} flow={flow / 10} cap={COMBO.cap} />
         </div>
         <div className={stack.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Energy Core Hunt</span>
               <span className={styles.level}>
                  Level {level} · {config?.name ?? "Simple Hunt"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Run time">
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <path d="M12 13 L12 8.5 M9.5 3 H14.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{clockText(shown)}</span>
               {hits > 0 ? <span className={styles.catches} aria-label={`Hit ${hits} times`}>⚡ {hits}</span> : null}
            </div>
            <div className={styles.progress} aria-hidden="true">
               <div className={styles.progressFill} style={{ width: `${Math.round((cores / Math.max(1, total)) * 100)}%` }} />
            </div>
            <Prompts />
            {config?.boss && !playing ? <Boss /> : null}
         </div>
      </>
   );
}
