"use client";

// The game HUD (menu2/hud HudStack placement, the Menu 2 HUD look): hearts, pickups, the hero power and
// the combo (x1-x5) on the left; the title and level in a banner with the run clock (play time, the
// pickup and flow bonus taken off), the gates passed and the streak, level 1's coach line, and on level 5
// Chroma's health bar with its hint. At the bottom the colour swatches: one button per colour in play,
// with its shape and its key (1-5); the current colour is lifted and ringed. The shell keeps Mute /
// Pause; its clock chip is off. Local multiplayer: the "2-4 players" button, the join screen, per-player
// chips and the podium. The shared hero picker shows on the start card, the pause menu and the result;
// the orbit camera's recenter button and first-time hint come from menu2/camera's OrbitHud.
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
import { HEARTS, STAT, courseFor, runTimeMs } from "./rules";
import { PALETTE, gatesToPass } from "./track";
import type { SwitchLevel } from "./levels";
import { CHROMA, COMBO } from "./progression";
import { queueColor } from "./colorQueue";
import { MultiplayerButton, MultiplayerHud } from "./MultiplayerHud";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.max(0, Math.floor(ms / 1000));
   const tenths = Math.floor((Math.max(0, ms) % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

const HERO_STAT: HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];

/** Level 1's coach line, by how far the hero has run (m). */
export function coachLine(level: number, dist: number): string | null {
   if (level !== 1) return null;
   if (dist < 40) return "Switch to the gate's colour: 1 / 2, a click, a tap or a swatch";
   if (dist < 100) return "Energy blocks: change lane (A / D or swipe)";
   return null;
}

/** Chroma's hint per phase (what opens him). */
export function bossHint(phase: number, open: boolean): string {
   if (phase === 0) return open ? "His core gate: match his colour!" : "Watch his colour: that is his next gate";
   if (phase === 1) return open ? "Split gate: switch, or take the lane in your colour!" : "He splits his gates by lane";
   return open ? "Blinking gate: switch as it changes!" : "Jump his prism sweepers";
}

/** An SVG path for each colour's shape (24 x 24). */
export function shapePath(shape: string): string {
   if (shape === "triangle") return "M12 4 L21 19 L3 19 Z";
   if (shape === "square") return "M5 5 H19 V19 H5 Z";
   if (shape === "diamond") return "M12 3 L21 12 L12 21 L3 12 Z";
   if (shape === "hexagon") return "M12 3 L20 7.5 L20 16.5 L12 21 L4 16.5 L4 7.5 Z";
   return "M12 4 A8 8 0 1 1 11.99 4 Z";
}

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? CHROMA.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const dist = useArcadeStore((s) => s.stats[STAT.distance] ?? 0);
   const { config } = useLevel<SwitchLevel>();
   const arena = courseFor(config?.id ?? 5).arenaZ;
   if (arena === null || dist < -arena - 2) return null;
   return (
      <div className={stack.boss}>
         <BossHealthBar name={CHROMA.name} phaseName={CHROMA.phases[phase]?.name} hp={hp} maxHp={CHROMA.maxHp} marks={phaseMarks(CHROMA)} vulnerable={open} flash={flash} accent="#a855f7" />
         <div className={stack.hint}>{hp > 0 ? bossHint(phase, open) : "Chroma shatters!"}</div>
      </div>
   );
}

function Swatches({ colors }: { colors: number }) {
   const current = useArcadeStore((s) => s.stats[STAT.color] ?? 0);
   return (
      <div className={styles.swatches} data-arcade-safe-area="" role="group" aria-label="Hero colour">
         {PALETTE.slice(0, colors).map((p, i) => (
            <button
               key={p.id}
               type="button"
               className={`${styles.swatch} ${i === current ? styles.swatchOn : ""}`}
               style={{ background: p.hex }}
               aria-label={`${p.name} (${p.key})`}
               aria-pressed={i === current}
               onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  queueColor(i);
               }}
            >
               <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.shape}>
                  <path d={shapePath(p.shape)} fill="rgba(255,255,255,0.92)" />
               </svg>
               <span className={styles.key}>{p.key}</span>
            </button>
         ))}
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<SwitchLevel>();
   const level = config?.id ?? 1;
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const powerLeft = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const hearts = useArcadeStore((s) => s.stats[STAT.hearts] ?? HEARTS);
   const passed = useArcadeStore((s) => s.stats[STAT.passed] ?? 0);
   const streak = useArcadeStore((s) => s.stats[STAT.streak] ?? 0);
   const dist = useArcadeStore((s) => s.stats[STAT.distance] ?? 0);
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const comboMs = useArcadeStore((s) => s.stats[STAT.comboMs] ?? 0);
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => (s.stats[STAT.comboMult] ?? 100) / 100);
   const flow = useArcadeStore((s) => (s.stats[STAT.comboFlow] ?? 0) / 10);
   const playingPhase = useArcadeStore((s) => s.phase === "playing" || s.phase === "countdown");
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined ? pick : HERO_STAT[heroStat] ?? "riko");
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   const shown = runTimeMs(tenths * 100, orbs, comboMs);
   const coach = playingPhase ? coachLine(level, dist) : null;
   const colors = courseFor(level).colors;
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         <div className={stack.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <div className={styles.pill} aria-label={`${hearts} hearts left`}>
               {Array.from({ length: HEARTS }, (_, i) => (
                  <svg key={i} className={`${styles.heart} ${i < hearts ? "" : styles.heartGone}`} viewBox="0 0 24 24" aria-hidden="true">
                     <path d="M12 21 C5 15 2 11.5 2 8 A5 5 0 0 1 12 6 A5 5 0 0 1 22 8 C22 11.5 19 15 12 21 Z" fill="#f43f5e" />
                  </svg>
               ))}
            </div>
            <div className={styles.pill} aria-label={`Pickups ${orbs}`}>
               <span className={styles.orb} aria-hidden="true" />
               <span className={styles.value}>{orbs}</span>
            </div>
            <div className={styles.pill} aria-label={`${hero.name} ${hero.powerLabel}${powerLeft > 0 ? `, ready in ${powerLeft} seconds` : ", ready"}`}>
               <span className={styles.heroDot} style={{ background: hero.color }} aria-hidden="true" />
               <span className={styles.value}>{powerLeft > 0 ? `${powerLeft}s` : hero.powerLabel}</span>
            </div>
            <ComboMeter chain={chain} multiplier={mult} flow={flow} cap={COMBO.cap} />
         </div>
         <div className={stack.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Switch Color Hero</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "Two Gates"}
               </span>
            </div>
            <div className={styles.row}>
               <div className={styles.clock} role="timer" aria-label="Run time">
                  <span className={styles.value}>{clockText(shown)}</span>
               </div>
               <div className={styles.clock} aria-label={`Gates ${passed} of ${gatesToPass(level)}`}>
                  <span className={styles.value}>
                     {passed}/{gatesToPass(level)}
                  </span>
                  {streak >= 3 ? <span className={styles.streak}>x{streak}</span> : null}
               </div>
            </div>
            {config?.boss && !playing ? <Boss /> : null}
            {coach ? (
               <div className={stack.boss}>
                  <div className={`${stack.hint} ${styles.coach}`}>{coach}</div>
               </div>
            ) : null}
         </div>
         {playingPhase && !playing ? <Swatches colors={colors} /> : null}
      </>
   );
}
