"use client";

// The game HUD (menu2/hud HudStack placement, the Menu 2 HUD look): orbs, the wall-run meter (the run
// left on this wall: it drains, red at the end), the hero power and the kick-chain combo (x1-x5) on the
// left; the title and the level in a banner with the run clock (play time, the orb and flow bonus taken
// off), level 1's coach line for its three beats, and on level 5 Umbra's health bar with its hint. The
// shell keeps Mute / Pause; its clock chip is off (index.tsx clockChip: false). Local multiplayer: the
// "2-4 players" button, the join screen, per-player chips and the podium. The shared hero picker shows
// on the start card, the pause menu and the result; the orbit camera's recenter button and first-time
// hint come from menu2/camera's OrbitHud.
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
import type { WallLevel } from "./levels";
import { COMBO, UMBRA } from "./progression";
import { MultiplayerButton, MultiplayerHud } from "./MultiplayerHud";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.max(0, Math.floor(ms / 1000));
   const tenths = Math.floor((Math.max(0, ms) % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

const HERO_STAT: HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];

/** Level 1's coach line: one short line per beat (the card's "teach by playing", no text walls). */
export function coachLine(level: number, dist: number, mode: number): string | null {
   if (level !== 1) return null;
   if (dist < 18) return mode === 2 ? "Run! Drop onto the platform at the wall's end" : "Jump at the glyph wall to run along it";
   if (dist > 22 && dist < 46) return mode === 2 ? "Jump to kick across to the other wall" : "Two walls: kick from one to the other";
   if (dist > 46 && dist < 66) return mode === 3 ? "Whip!" : "Jump past the column at speed to whip round it";
   return null;
}

/** Umbra's hint per phase (what opens him). */
export function bossHint(phase: number, open: boolean): string {
   if (phase === 0) return open ? "He runs level with you: kick into him!" : "Dodge his shadow plates: rise or drop on the wall";
   if (phase === 1) return open ? "Whip round the column he waits at!" : "He cracks the walls: take the column route";
   return open ? "Reach the top glyph and slam it!" : "Out-climb him up the shaft";
}

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? UMBRA.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const x = useArcadeStore((s) => s.stats[STAT.distance] ?? 0);
   void x;
   return (
      <div className={stack.boss}>
         <BossHealthBar
            name={UMBRA.name}
            phaseName={UMBRA.phases[phase]?.name}
            hp={hp}
            maxHp={UMBRA.maxHp}
            marks={phaseMarks(UMBRA)}
            vulnerable={open}
            flash={flash}
            accent="#7c3aed"
         />
         <div className={stack.hint}>{hp > 0 ? bossHint(phase, open) : "The capstone falls!"}</div>
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<WallLevel>();
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const powerLeft = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const runLeft = useArcadeStore((s) => (s.stats[STAT.runLeft] ?? 0) / 20);
   const mode = useArcadeStore((s) => s.stats[STAT.mode] ?? 0);
   const x = useArcadeStore((s) => s.stats[STAT.distance] ?? 0);
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const comboMs = useArcadeStore((s) => s.stats[STAT.comboMs] ?? 0);
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => (s.stats[STAT.comboMult] ?? 100) / 100);
   const flow = useArcadeStore((s) => (s.stats[STAT.comboFlow] ?? 0) / 10);
   const playingPhase = useArcadeStore((s) => s.phase === "playing" || s.phase === "countdown");
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined ? pick : HERO_STAT[heroStat] ?? "nami");
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   const level = config?.id ?? 1;
   const shown = runTimeMs(tenths * 100, orbs, comboMs);
   const onWall = mode === 2;
   const coach = playingPhase ? coachLine(level, x, mode) : null;
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         <div className={stack.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <div className={styles.pill} aria-label={`Orbs ${orbs}`}>
               <span className={styles.orb} aria-hidden="true" />
               <span className={styles.value}>{orbs}</span>
            </div>
            <div className={styles.pill} aria-label={onWall ? `Wall run ${Math.round(runLeft * 100)} percent left` : "Off the wall"}>
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="15" y="2" width="6" height="20" rx="1.5" fill="#d6b98a" />
                  <circle cx="18" cy="8" r="1.6" fill="#fde047" />
                  <path d="M4 18 L9 12 L12 14" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" />
               </svg>
               <span className={styles.meter}>
                  <span className={`${styles.ropeFill} ${onWall && runLeft < 0.3 ? styles.runLow : ""}`} style={{ width: `${(onWall ? runLeft : 0) * 100}%` }} />
               </span>
            </div>
            <div className={styles.pill} aria-label={`${hero.name} ${hero.powerLabel}${powerLeft > 0 ? `, ready in ${powerLeft} seconds` : ", ready"}`}>
               <span className={styles.swatch} style={{ background: hero.color }} aria-hidden="true" />
               <span className={styles.value}>{powerLeft > 0 ? `${powerLeft}s` : hero.powerLabel}</span>
            </div>
            <ComboMeter chain={chain} multiplier={mult} flow={flow} cap={COMBO.cap} />
         </div>
         <div className={stack.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Wall Run Temple</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "Training Wall"}
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
            {coach ? (
               <div className={stack.boss}>
                  <div className={`${stack.hint} ${styles.coach}`}>{coach}</div>
               </div>
            ) : null}
         </div>
      </>
   );
}
