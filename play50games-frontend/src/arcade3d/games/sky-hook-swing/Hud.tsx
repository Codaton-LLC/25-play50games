"use client";

// The game HUD (menu2/hud HudStack placement, the Menu 2 HUD look): orbs, the rope meter (3-12 m; it
// flashes green in the peak window), the hero power and the flow meter on the left; the title and the
// level in a banner at the top centre with the run clock (play time, the orb and flow bonus taken off),
// level 1's coach line for its beats, and on level 5 the Gust Galleon's health bar with its hint. The
// shell keeps Mute / Pause; its clock chip is off (index.tsx clockChip: false). Local multiplayer
// (menu2/multiplayer): the "2-4 players" button, the join screen, per-player chips and the podium. The
// shared hero picker shows on the start card, the pause menu and the result; the orbit camera's
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
import { L_MAX, L_MIN, STAT, runTimeMs } from "./rules";
import type { SwingLevel } from "./levels";
import { COMBO, GUST_GALLEON } from "./progression";
import { MultiplayerButton, MultiplayerHud } from "./MultiplayerHud";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.max(0, Math.floor(ms / 1000));
   const tenths = Math.floor((Math.max(0, ms) % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

const HERO_STAT: HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];

/** Level 1's coach line: one short line per beat (the card's "teach by playing", no text walls). */
export function coachLine(level: number, x: number, mode: number): string | null {
   if (level !== 1) return null;
   if (x < 22) return mode === 2 ? "Hook again to let go: on the green flash" : "Aim at the glowing ring, press Hook";
   if (x > 26 && x < 46) return mode === 2 ? "Hold up to reel in over the wall" : "Hook the post, reel in for the wall";
   if (x > 50 && x < 74) return "Let go, then hook the next ring in the air";
   return null;
}

/** The galleon's hint per phase (what opens it). */
export function bossHint(phase: number, open: boolean): string {
   if (phase === 0) return open ? "The turret glows green: swing into it!" : "Wait on the deck for its window";
   if (phase === 1) return open ? "Hook the drone, swing into the mast!" : "The drones cut the hull rings";
   return open ? "Swing up the rings, ring the Tide Bell!" : "The galleon is falling: climb!";
}

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? GUST_GALLEON.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const x = useArcadeStore((s) => s.stats[STAT.distance] ?? 0);
   // the galleon comes alongside after the approach (course.ts level 5: its first ring at 60 m)
   if (x < 40 && phase === 0 && hp === GUST_GALLEON.maxHp) return null;
   return (
      <div className={stack.boss}>
         <BossHealthBar
            name={GUST_GALLEON.name}
            phaseName={GUST_GALLEON.phases[phase]?.name}
            hp={hp}
            maxHp={GUST_GALLEON.maxHp}
            marks={phaseMarks(GUST_GALLEON)}
            vulnerable={open}
            flash={flash}
            accent="#a855f7"
         />
         <div className={stack.hint}>{hp > 0 ? bossHint(phase, open) : "The Tide Bell rings!"}</div>
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<SwingLevel>();
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const powerLeft = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const rope = useArcadeStore((s) => (s.stats[STAT.rope] ?? 0) / 10);
   const mode = useArcadeStore((s) => s.stats[STAT.mode] ?? 0);
   const peak = useArcadeStore((s) => (s.stats[STAT.peak] ?? 0) === 1);
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
   const onRope = mode === 2;
   const ropeFrac = onRope ? Math.max(0, Math.min(1, (rope - L_MIN) / (L_MAX - L_MIN))) : 0;
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
            <div className={`${styles.pill} ${peak ? styles.peak : ""}`} aria-label={onRope ? `Rope ${rope.toFixed(1)} metres${peak ? ", release now" : ""}` : "Off the rope"}>
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="5" r="3.2" fill="none" stroke="#f5c542" strokeWidth="2.2" />
                  <path d="M12 8.2 C11 12 13 15 12 20" stroke="#f1e4c8" strokeWidth="2" fill="none" strokeLinecap="round" />
                  <path d="M9 20 L12 17 L15 20" stroke="#cbd5e1" strokeWidth="2" fill="none" strokeLinecap="round" />
               </svg>
               <span className={styles.meter}>
                  <span className={`${styles.ropeFill} ${peak ? styles.ropePeak : ""}`} style={{ width: `${ropeFrac * 100}%` }} />
               </span>
               <span className={styles.unit}>{onRope ? `${rope.toFixed(0)} m` : "—"}</span>
            </div>
            <div className={styles.pill} aria-label={`${hero.name} ${hero.powerLabel}${powerLeft > 0 ? `, ready in ${powerLeft} seconds` : ", ready"}`}>
               <span className={styles.swatch} style={{ background: hero.color }} aria-hidden="true" />
               <span className={styles.value}>{powerLeft > 0 ? `${powerLeft}s` : hero.powerLabel}</span>
            </div>
            <ComboMeter chain={chain} multiplier={mult} flow={flow} cap={COMBO.cap} />
         </div>
         <div className={stack.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Sky Hook Swing</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "Single Swing"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Flight time">
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
