"use client";

// The game HUD: orbs, the distance, the speed meter (it fills as you pump, gold at top speed), the
// curl meter (red as the curl closes in), the hearts, the hero power, the tricks and the flow meter on
// the left; the title and the level in a banner at the top centre with the run clock (the ride time so
// far, the orb and flow bonus taken off), level 1's coach line for its three beats, and on level 5
// King Breaker's health bar with its hint. The shell keeps Mute / Pause; its clock chip is off
// (index.tsx clockChip: false). Local multiplayer (menu2/multiplayer): the "2-4 players" button, the
// join screen, per-player chips and the podium. The shared Menu 2 hero picker (menu2/heroes) shows on
// the start card, the pause menu and the result; the orbit camera's recenter button and first-time
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
import { HEROES, heroById, pickedHero, selectHero, subscribeHero, type HeroId } from "./heroes";
import { CURL, HEARTS, STAT, V_MAX, runTimeMs } from "./rules";
import type { SurfLevel } from "./levels";
import { COMBO, KING_BREAKER } from "./progression";
import { MultiplayerHud, MultiplayerButton } from "./MultiplayerHud";
import stack from "@/arcade3d/menu2/hud/HudStack.module.css";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.floor(ms / 1000);
   const tenths = Math.floor((ms % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

const HERO_STAT: HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];

/** Level 1's coach line: one short line per beat (the card's "teach by playing", no text walls). */
export function coachLine(level: number, dist: number, speed: number): string | null {
   if (level !== 1) return null;
   if (dist < 140) return speed < 15 ? "Carve up, then down through the glow to pump" : "Keep pumping: up, then down through the glow";
   if (dist > 195 && dist < 320) return "Carve round the buoys";
   if (dist > 360 && dist < 490) return "Jump at the lip, hold a direction for a trick";
   return null;
}

/** The boss's hint per phase (what opens it). */
export function bossHint(phase: number, open: boolean): string {
   if (phase === 0) return open ? "Air off the lip onto its shell!" : "Dodge the claw's shadow";
   if (phase === 1) return open ? "Trick into its eyes, fast!" : "Pump past the bubbles, ride high";
   return open ? "Carve into it at speed!" : "Ride the barrel, keep your speed";
}

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? KING_BREAKER.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const dist = useArcadeStore((s) => s.stats[STAT.distance] ?? 0);
   // King Breaker rises at 260 m (waves.ts L5 bossStart)
   if (dist < 250) return null;
   return (
      <div className={stack.boss}>
         <BossHealthBar
            name={KING_BREAKER.name}
            phaseName={KING_BREAKER.phases[phase]?.name}
            hp={hp}
            maxHp={KING_BREAKER.maxHp}
            marks={phaseMarks(KING_BREAKER)}
            vulnerable={open}
            flash={flash}
            accent="#f87171"
         />
         {hp > 0 ? <div className={stack.hint}>{bossHint(phase, open)}</div> : <div className={stack.hint}>Ring the Tide Bell on the beach!</div>}
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<SurfLevel>();
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const dist = useArcadeStore((s) => s.stats[STAT.distance] ?? 0);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const powerLeft = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const speed = useArcadeStore((s) => (s.stats[STAT.speed] ?? 130) / 10);
   const curl = useArcadeStore((s) => s.stats[STAT.curl] ?? CURL.startGap);
   const hearts = useArcadeStore((s) => s.stats[STAT.hearts] ?? HEARTS);
   const tricks = useArcadeStore((s) => s.stats[STAT.tricks] ?? 0);
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const comboMs = useArcadeStore((s) => s.stats[STAT.comboMs] ?? 0);
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => s.stats[STAT.comboMult] ?? 100);
   const flow = useArcadeStore((s) => s.stats[STAT.comboFlow] ?? 0);
   const playingPhase = useArcadeStore((s) => s.phase === "playing" || s.phase === "countdown");
   const shown = runTimeMs(tenths * 100, orbs, comboMs);
   const level = config?.id ?? 1;
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined ? pick : HERO_STAT[heroStat] ?? "nami");
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   const speedFrac = Math.max(0, Math.min(1, speed / V_MAX));
   const curlFrac = Math.max(0, Math.min(1, curl / CURL.maxGap));
   const coach = playingPhase ? coachLine(level, dist, speed) : null;
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
            <div className={styles.pill} aria-label={`Speed ${speed.toFixed(0)} metres a second`}>
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 16 C7 6 15 4 21 8 C16 8 12 11 10 17 Z" fill="#a5f3fc" />
                  <path d="M3 19 H21" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
               </svg>
               <span className={styles.meter}>
                  <span className={`${styles.speedFill} ${speed >= V_MAX - 0.5 ? styles.speedTop : ""}`} style={{ width: `${speedFrac * 100}%` }} />
               </span>
               <span className={styles.unit}>{speed.toFixed(0)}</span>
            </div>
            <div className={styles.pill} aria-label={`The curl is ${curl} metres behind`}>
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 20 C3 9 11 3 19 6 C14 6 11 10 13 14 C9 14 7 17 7 20 Z" fill="#e0f2fe" />
                  <circle cx="17" cy="9" r="1.6" fill="#7dd3fc" />
               </svg>
               <span className={styles.meter}>
                  <span className={`${styles.curlFill} ${curl < 8 ? styles.curlDanger : curl < 16 ? styles.curlNear : ""}`} style={{ width: `${curlFrac * 100}%` }} />
               </span>
            </div>
            <div className={styles.pill} aria-label={`Hearts ${hearts} of ${HEARTS}`}>
               <span className={styles.hearts} aria-hidden="true">
                  {Array.from({ length: HEARTS }, (_v, i) => (
                     <span key={i} className={i < hearts ? styles.heartOn : styles.heartOff}>
                        ♥
                     </span>
                  ))}
               </span>
               <span className={styles.unit}>{dist} m</span>
            </div>
            <div className={styles.pill} aria-label={`${hero.name} ${hero.powerLabel}${powerLeft > 0 ? `, ready in ${powerLeft} seconds` : ", ready"}`}>
               <span className={styles.swatch} style={{ background: hero.color }} aria-hidden="true" />
               <span className={styles.value}>{powerLeft > 0 ? `${powerLeft}s` : hero.powerLabel}</span>
            </div>
            {tricks > 0 ? (
               <div className={styles.pill} aria-label={`Tricks ${tricks}`}>
                  <span className={styles.value}>↻ {tricks}</span>
               </div>
            ) : null}
            <ComboMeter chain={chain} multiplier={mult / 100} flow={flow / 10} cap={COMBO.cap} />
         </div>
         <div className={stack.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Plate Surf</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "Training Swell"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Ride time">
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <path d="M12 13 L12 8.5 M9.5 3 H14.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{clockText(shown)}</span>
            </div>
            {config?.boss && !playing ? <Boss /> : null}
            {coach ? (
               <div className={stack.boss}>
                  <div className={stack.hint}>{coach}</div>
               </div>
            ) : null}
         </div>
      </>
   );
}
