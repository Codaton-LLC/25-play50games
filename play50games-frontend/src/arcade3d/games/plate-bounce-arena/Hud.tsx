"use client";

// The game HUD (menu2/hud HudStack placement, the Menu 2 HUD look): balls left, orbs, the hero power,
// the table points and the combo (x1-x5) on the left; the title and the level in a banner with the run
// clock (play time, the orb and flow bonus taken off), the current section's goal with its count, the
// plunger gauge (gold band = the skill shot) while the ball sits on the plunger, and on level 5 Rollo's
// health bar with its hint. The shell keeps Mute / Pause; its clock chip is off (index.tsx clockChip:
// false). Local multiplayer: the "2-4 players" button, the join screen, per-player chips and the podium.
// The shared hero picker shows on the start card, the pause menu and the result; the orbit camera's
// recenter button and first-time hint come from menu2/camera's OrbitHud.
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
import { BALLS, SKILL_HI, SKILL_LO, STAT, courseFor, runTimeMs } from "./rules";
import type { PinLevel } from "./levels";
import { COMBO, ROLLO } from "./progression";
import { MultiplayerButton, MultiplayerHud } from "./MultiplayerHud";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.max(0, Math.floor(ms / 1000));
   const tenths = Math.floor((Math.max(0, ms) % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

const HERO_STAT: HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];

/** The current section's goal line, with its count. */
export function goalLine(level: number, stage: number, count: number): string {
   const t = courseFor((level >= 1 && level <= 5 ? level : 1) as 1 | 2 | 3 | 4 | 5);
   const o = t.objectives[stage];
   if (!o) return t.boss ? "Rollo is down!" : "Exit open: sink the ball in the hole!";
   if (o.kind === "bumpers" || o.kind === "ramp" || o.kind === "orbits") return `${o.label} ${Math.min(count, o.n)}/${o.n}`;
   return o.label;
}

/** Rollo's hint per phase (what opens him). */
export function bossHint(phase: number, open: boolean, golden: boolean, jam: number): string {
   if (phase === 0) return open ? "His pockets glow: hit him hard!" : "Dodge him: wait for the glow";
   if (phase === 1) return golden ? (open ? "Golden! Hit him now!" : "Golden: wait for his glow") : "Shoot the ramp to turn golden";
   const side = jam === 1 ? "left" : jam === 2 ? "right" : "";
   return open ? "Jackpot ramp: launch onto him!" : `He jams your ${side} flipper: use the other one`;
}

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? ROLLO.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const golden = useArcadeStore((s) => (s.stats[STAT.golden] ?? 0) === 1);
   const jam = useArcadeStore((s) => s.stats[STAT.jam] ?? 0);
   return (
      <div className={stack.boss}>
         <BossHealthBar name={ROLLO.name} phaseName={ROLLO.phases[phase]?.name} hp={hp} maxHp={ROLLO.maxHp} marks={phaseMarks(ROLLO)} vulnerable={open} flash={flash} accent="#7c3aed" />
         <div className={stack.hint}>{hp > 0 ? bossHint(phase, open, golden, jam) : "Rollo is down!"}</div>
      </div>
   );
}

function Gauge({ charge }: { charge: number }) {
   return (
      <div className={styles.pill} aria-label={`Plunger ${Math.round(charge * 100)} percent`}>
         <span className={styles.gaugeLabel}>Hold Flip, let go</span>
         <span className={styles.meter}>
            <span className={styles.gold} style={{ left: `${SKILL_LO * 100}%`, width: `${(SKILL_HI - SKILL_LO) * 100}%` }} />
            <span className={styles.ropeFill} style={{ width: `${charge * 100}%` }} />
         </span>
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<PinLevel>();
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const powerLeft = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const balls = useArcadeStore((s) => s.stats[STAT.balls] ?? BALLS);
   const points = useArcadeStore((s) => s.stats[STAT.points] ?? 0);
   const stage = useArcadeStore((s) => s.stats[STAT.stage] ?? 0);
   const count = useArcadeStore((s) => s.stats[STAT.count] ?? 0);
   const charge = useArcadeStore((s) => s.stats[STAT.charge] ?? -1);
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const comboMs = useArcadeStore((s) => s.stats[STAT.comboMs] ?? 0);
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => (s.stats[STAT.comboMult] ?? 100) / 100);
   const flow = useArcadeStore((s) => (s.stats[STAT.comboFlow] ?? 0) / 10);
   const playingPhase = useArcadeStore((s) => s.phase === "playing" || s.phase === "countdown");
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined ? pick : HERO_STAT[heroStat] ?? "zuno");
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   const level = config?.id ?? 1;
   const shown = runTimeMs(tenths * 100, orbs, comboMs);
   const powerText = powerLeft < 0 ? "Used" : powerLeft > 0 ? `${powerLeft}s` : hero.powerLabel;
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         <div className={stack.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <div className={styles.pill} aria-label={`${balls} balls left`}>
               {Array.from({ length: BALLS }, (_, i) => (
                  <span key={i} className={`${styles.ball} ${i < balls ? "" : styles.ballGone}`} style={{ background: hero.color }} aria-hidden="true" />
               ))}
            </div>
            <div className={styles.pill} aria-label={`Orbs ${orbs}`}>
               <span className={styles.orb} aria-hidden="true" />
               <span className={styles.value}>{orbs}</span>
            </div>
            <div className={styles.pill} aria-label={`${hero.name} ${hero.powerLabel}: ${powerText}`}>
               <span className={styles.swatch} style={{ background: hero.color }} aria-hidden="true" />
               <span className={styles.value}>{powerText}</span>
            </div>
            <div className={styles.pill} aria-label={`${points} points`}>
               <span className={styles.points}>{points.toLocaleString("en-US")}</span>
            </div>
            <ComboMeter chain={chain} multiplier={mult} flow={flow} cap={COMBO.cap} />
         </div>
         <div className={stack.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Plate Bounce Arena</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "Practice Table"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Run time">
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <path d="M12 13 L12 8.5 M9.5 3 H14.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{clockText(shown)}</span>
            </div>
            {config?.boss && !playing ? <Boss /> : null}
            {playingPhase && !playing && !config?.boss ? (
               <div className={stack.boss}>
                  <div className={`${stack.hint} ${styles.coach}`}>{goalLine(level, stage, count)}</div>
               </div>
            ) : null}
            {playingPhase && charge >= 0 ? <Gauge charge={charge / 20} /> : null}
         </div>
      </>
   );
}
