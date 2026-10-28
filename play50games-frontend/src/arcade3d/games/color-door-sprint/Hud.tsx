"use client";

// The game HUD: orbs, the speed meter, the true-door streak, the hero power (and on level 5 the red
// rush charge) and the flow meter on the left; the title and the level in a banner at the top centre,
// the run clock (the orb and flow bonus taken off), the rule card (a copy of the lamp in view: its
// colour and shape, crossed out for NOT, a speaker only for the dimmed sound rule, "after next" for an
// echo lamp), level 1's coach line for its three beats, and on level 5 Flicker's health bar with its
// hint. The shell keeps Mute / Pause; its clock chip is off (index.tsx clockChip: false). Local
// multiplayer (menu2/multiplayer): the "2-4 players" button, the join screen, per-player chips, the
// podium. The shared Menu 2 hero picker (menu2/heroes) shows on the start card, the pause menu and
// the result; the orbit camera's recenter button and first-time hint come from OrbitHud.
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
import { DOOR_COLORS, type ShapeId } from "./halls";
import { BOOST_CAP, RUSH_STREAK, STAT, runTimeMs } from "./rules";
import { LEVELS, type DoorLevel } from "./levels";
import { COMBO, FLICKER } from "./progression";
import { MultiplayerHud, MultiplayerButton } from "./MultiplayerHud";
import stack from "@/arcade3d/menu2/hud/HudStack.module.css";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.floor(ms / 1000);
   const tenths = Math.floor((ms % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

const HERO_STAT: HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];

/** Level 1's coach line: one short line per beat (teach by playing, no text walls). */
export function coachLine(level: number, walls: number, dist: number): string | null {
   if (level !== 1) return null;
   if (walls < 2) return dist < 12 ? "Swipe or press ← → to change lane" : "Run through the open door";
   if (walls < 5) return "Match the lamp's colour: the floor arrows show it too";
   if (walls < 8) return dist > 285 && dist < 320 ? "Jump the bar · roll (↓) under the beam" : "Read the lamp, then commit";
   return null;
}

/** Flicker's hint per phase (what opens him). */
export function bossHint(phase: number, open: boolean, rush: boolean): string {
   if (phase === 0) return open ? (rush ? "Fire the red rush (Power)!" : "Chain true doors to charge the rush") : "Jump the fire wave";
   if (phase === 1) return open ? (rush ? "Ram him with the red rush!" : "The true colour is held longest") : "Roll under the flame arc";
   return open ? "Take the flame that matches the lamp!" : "Leave the burning lane";
}

function Shape({ shape, color }: { shape: ShapeId; color: string }) {
   const p: Record<ShapeId, string> = {
      circle: "M12 3 A9 9 0 1 1 11.99 3 Z",
      triangle: "M12 3 L21.5 20 L2.5 20 Z",
      square: "M4 4 H20 V20 H4 Z",
      diamond: "M12 2 L20 12 L12 22 L4 12 Z",
      hex: "M12 2.5 L20.5 7.25 L20.5 16.75 L12 21.5 L3.5 16.75 L3.5 7.25 Z",
   };
   return <path d={p[shape]} fill={color} stroke="#fff" strokeWidth="1.6" />;
}

/** The rule card: a copy of the lamp the player can see right now. */
function RuleCard() {
   const color = useArcadeStore((s) => s.stats[STAT.lampColor] ?? -1);
   const mode = useArcadeStore((s) => s.stats[STAT.lampMode] ?? 0);
   const echo = useArcadeStore((s) => (s.stats[STAT.lampEcho] ?? 0) === 1);
   const playing = useArcadeStore((s) => s.phase === "playing");
   if (!playing || color < 0) return null;
   const c = DOOR_COLORS[color];
   const sound = mode === 1;
   const label = sound ? "Listen" : mode === 2 ? `Not ${c.name}` : c.name;
   return (
      <div className={`${styles.rule} ${echo ? styles.ruleEcho : ""}`} aria-label={`Rule: ${label}${echo ? ", for the wall after next" : ""}`}>
         <svg className={styles.ruleIcon} viewBox="0 0 24 24" aria-hidden="true">
            {sound ? (
               <path d="M4 9 H8 L13 5 V19 L8 15 H4 Z M16 8 Q19 12 16 16 M18.5 5.5 Q23.5 12 18.5 18.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            ) : (
               <Shape shape={c.shape} color={c.hex} />
            )}
            {mode === 2 && !sound ? <path d="M3 3 L21 21 M21 3 L3 21" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" /> : null}
         </svg>
         <span className={styles.ruleText}>
            {label}
            {echo ? <span className={styles.ruleNext}>after next</span> : null}
         </span>
      </div>
   );
}

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

function Boss() {
   const on = useArcadeStore((s) => (s.stats[STAT.bossOn] ?? 0) === 1);
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? FLICKER.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const rush = useArcadeStore((s) => (s.stats[STAT.rush] ?? 0) === 1);
   if (!on) return null;
   return (
      <div className={stack.boss}>
         <BossHealthBar name={FLICKER.name} phaseName={FLICKER.phases[phase]?.name} hp={hp} maxHp={FLICKER.maxHp} marks={phaseMarks(FLICKER)} vulnerable={open} flash={flash} accent="#f97316" />
         {hp > 0 ? <div className={stack.hint}>{bossHint(phase, open, rush)}</div> : <div className={stack.hint}>The doors swing open: run!</div>}
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<DoorLevel>();
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const dist = useArcadeStore((s) => s.stats[STAT.distance] ?? 0);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const powerLeft = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const speed = useArcadeStore((s) => (s.stats[STAT.speed] ?? 100) / 10);
   const walls = useArcadeStore((s) => s.stats[STAT.walls] ?? 0);
   const streak = useArcadeStore((s) => s.stats[STAT.streak] ?? 0);
   const rush = useArcadeStore((s) => (s.stats[STAT.rush] ?? 0) === 1);
   const rushStreak = useArcadeStore((s) => s.stats[STAT.rushStreak] ?? 0);
   const bossOn = useArcadeStore((s) => (s.stats[STAT.bossOn] ?? 0) === 1);
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const comboMs = useArcadeStore((s) => s.stats[STAT.comboMs] ?? 0);
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => s.stats[STAT.comboMult] ?? 100);
   const flow = useArcadeStore((s) => s.stats[STAT.comboFlow] ?? 0);
   const playingPhase = useArcadeStore((s) => s.phase === "playing" || s.phase === "countdown");
   const shown = runTimeMs(tenths * 100, orbs, comboMs);
   const level = config?.id ?? 1;
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined ? pick : HERO_STAT[heroStat] ?? "riko");
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   const base = LEVELS[level].speed;
   const speedFrac = Math.max(0, Math.min(1, speed / (base + BOOST_CAP)));
   const coach = playingPhase ? coachLine(level, walls, dist) : null;
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
                  <path d="M3 7 L10 12 L3 17 M11 7 L18 12 L11 17" fill="none" stroke="#fdba74" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
               </svg>
               <span className={styles.meter}>
                  <span className={`${styles.speedFill} ${speed > base + 0.5 ? styles.speedTop : ""}`} style={{ width: `${speedFrac * 100}%` }} />
               </span>
               <span className={styles.unit}>{speed.toFixed(0)}</span>
            </div>
            <div className={styles.pill} aria-label={`True doors ${walls}, streak ${streak}`}>
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 21 V5 Q6 3 8 3 H16 Q18 3 18 5 V21 Z" fill="#ef4444" stroke="#fff" strokeWidth="1.6" />
                  <circle cx="15" cy="13" r="1.4" fill="#fff" />
               </svg>
               <span className={styles.value}>{walls}</span>
               {streak >= 2 ? <span className={styles.unit}>x{streak}</span> : null}
            </div>
            <div className={styles.pill} aria-label={`${hero.name} ${hero.powerLabel}${powerLeft > 0 ? `, ready in ${powerLeft} seconds` : ", ready"}`}>
               <span className={styles.swatch} style={{ background: hero.color }} aria-hidden="true" />
               <span className={styles.value}>{powerLeft > 0 ? `${powerLeft}s` : hero.powerLabel}</span>
            </div>
            {bossOn ? (
               <div className={`${styles.pill} ${rush ? styles.rushReady : ""}`} aria-label={rush ? "Red rush ready" : `Red rush ${rushStreak} of ${RUSH_STREAK}`}>
                  <span className={styles.value}>{rush ? "RUSH!" : "Rush"}</span>
                  {!rush ? (
                     <span className={styles.pips} aria-hidden="true">
                        {Array.from({ length: RUSH_STREAK }, (_v, i) => (
                           <span key={i} className={i < rushStreak ? styles.pipOn : styles.pipOff} />
                        ))}
                     </span>
                  ) : null}
               </div>
            ) : null}
            <ComboMeter chain={chain} multiplier={mult / 100} flow={flow / 10} cap={COMBO.cap} />
         </div>
         <div className={stack.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Color Door Sprint</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "Two Doors"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Run time">
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <path d="M12 13 L12 8.5 M9.5 3 H14.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{clockText(shown)}</span>
            </div>
            {!playing ? <RuleCard /> : null}
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
