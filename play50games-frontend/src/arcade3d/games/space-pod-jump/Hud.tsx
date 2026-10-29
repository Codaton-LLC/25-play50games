"use client";

// The game HUD: the main orbs, the jet fuel gauge, the speed, the hero power and the flow meter on the
// left; the title and level banner with the run clock (the orb, gate and flow bonus taken off) at the top
// centre, the pod card (stand on a cradle: "Hold Jump to charge"; charging: the charge bar and "aim with
// the stick, let go to launch"), "Lost in space" while drifting off the map, level 1's coach line for its
// three beats, and on level 5 the Orbit Warden's health bar with its hint. The camera switch ("Up:
// rolling / fixed", the card's motion-sickness option) sits with the orbit camera's buttons. The shell
// keeps Mute / Pause; its clock chip is off. Local multiplayer: the "2-4 players" button, the join
// screen, per-player chips, the podium. The shared Menu 2 hero picker shows on the start card, pause and result.
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
import { STAT, courseFor } from "./rules";
import type { PodLevel } from "./levels";
import { COMBO, WARDEN } from "./progression";
import { setUpFixed, subscribeUp, upFixed } from "./upPref";
import { MultiplayerHud, MultiplayerButton } from "./MultiplayerHud";
import stack from "@/arcade3d/menu2/hud/HudStack.module.css";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.floor(ms / 1000);
   const tenths = Math.floor((ms % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

const HERO_STAT: HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];

/** Level 1's coach line: one short line per beat (teach by playing). */
export function coachLine(level: number, dist: number, mainOrbs: number, onPod: boolean, charging: boolean): string | null {
   if (level !== 1) return null;
   if (charging) return "Aim with ← →, let go to launch for the dock";
   if (onPod) return "Hold Jump to charge the pod";
   if (mainOrbs < 6) return "Walk all the way round: ← → (down is always the ground)";
   if (dist < 9) return "Jump towards the next planetoid: you fall into it";
   return null;
}

export function bossHint(phase: number, open: boolean): string {
   if (phase === 0) return open ? "Land on a glowing vent!" : "Mines bend your arc: read the dots";
   if (phase === 1) return "Through the belt's gap, then walk to the thruster";
   return "Hit it fast: a full pod launch or a slingshot off its moon";
}

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

function Boss() {
   const on = useArcadeStore((s) => (s.stats[STAT.bossOn] ?? 0) === 1);
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? WARDEN.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   if (!on) return null;
   return (
      <div className={stack.boss}>
         <BossHealthBar name="Orbit Warden" phaseName={WARDEN.phases[phase]?.name} hp={hp} maxHp={WARDEN.maxHp} marks={phaseMarks(WARDEN)} vulnerable={open} flash={flash} accent="#b26bff" />
         {hp > 0 ? <div className={stack.hint}>{bossHint(phase, open)}</div> : <div className={stack.hint}>It powers down: launch for the dock!</div>}
      </div>
   );
}

function PodCard() {
   const onPod = useArcadeStore((s) => (s.stats[STAT.onPod] ?? 0) === 1);
   const charge = useArcadeStore((s) => s.stats[STAT.charge] ?? -1);
   const lost = useArcadeStore((s) => (s.stats[STAT.lost] ?? 0) === 1);
   const playing = useArcadeStore((s) => s.phase === "playing");
   if (!playing) return null;
   if (lost) return <div className={`${styles.podCard} ${styles.podLost}`}>Lost in space…</div>;
   if (charge >= 0)
      return (
         <div className={styles.podCard} aria-label={`Charging ${charge} percent`}>
            <span className={styles.podText}>Aim ← →, let go</span>
            <span className={styles.meter}>
               <span className={styles.chargeFill} style={{ width: `${charge}%` }} />
            </span>
         </div>
      );
   if (onPod) return <div className={styles.podCard}>Pod: hold Jump to charge</div>;
   return null;
}

function UpSwitch() {
   const fixed = useSyncExternalStore(subscribeUp, upFixed, upFixed);
   return (
      <button type="button" className={styles.upBtn} onClick={() => setUpFixed(!fixed)} aria-pressed={fixed} data-arcade-safe-area="">
         Up: {fixed ? "fixed" : "rolling"}
      </button>
   );
}

export default function Hud() {
   const { config } = useLevel<PodLevel>();
   const level = config?.id ?? 1;
   const mainOrbs = useArcadeStore((s) => s.stats[STAT.mainOrbs] ?? 0);
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const gates = useArcadeStore((s) => s.stats[STAT.gates] ?? 0);
   const fuel = useArcadeStore((s) => s.stats[STAT.fuel] ?? 100);
   const speed = useArcadeStore((s) => (s.stats[STAT.speed] ?? 0) / 10);
   const dist = useArcadeStore((s) => s.stats[STAT.distance] ?? 0);
   const onPod = useArcadeStore((s) => (s.stats[STAT.onPod] ?? 0) === 1);
   const charging = useArcadeStore((s) => (s.stats[STAT.charge] ?? -1) >= 0);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const powerLeft = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const comboMs = useArcadeStore((s) => s.stats[STAT.comboMs] ?? 0);
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => s.stats[STAT.comboMult] ?? 100);
   const flow = useArcadeStore((s) => s.stats[STAT.comboFlow] ?? 0);
   const playingPhase = useArcadeStore((s) => s.phase === "playing" || s.phase === "countdown");
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined ? pick : HERO_STAT[heroStat] ?? "vexa");
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   const shown = tenths * 100;
   void orbs;
   void gates;
   void comboMs;
   const total = courseFor(level).mainOrbs;
   const coach = playingPhase ? coachLine(level, dist, mainOrbs, onPod, charging) : null;
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         {!playing ? <UpSwitch /> : null}
         <div className={stack.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <div className={styles.pill} aria-label={`Orbs ${mainOrbs} of ${total}`}>
               <span className={styles.orb} aria-hidden="true" />
               <span className={styles.value}>
                  {mainOrbs}
                  <span className={styles.unit}>/{total}</span>
               </span>
            </div>
            <div className={styles.pill} aria-label={`Jet fuel ${fuel} percent`}>
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 3 H16 V14 L12 21 L8 14 Z" fill="none" stroke="#7ee8ff" strokeWidth="2.2" strokeLinejoin="round" />
               </svg>
               <span className={styles.meter}>
                  <span className={styles.fuelFill} style={{ width: `${fuel}%` }} />
               </span>
            </div>
            <div className={styles.pill} aria-label={`Speed ${speed.toFixed(1)} metres a second`}>
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 7 L10 12 L3 17 M11 7 L18 12 L11 17" fill="none" stroke="#c4b5fd" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
               </svg>
               <span className={styles.value}>{speed.toFixed(1)}</span>
               <span className={styles.unit}>m/s</span>
            </div>
            <div className={styles.pill} aria-label={`${hero.name} ${hero.powerLabel}${powerLeft > 0 ? `, ready in ${powerLeft} seconds` : ", ready"}`}>
               <span className={styles.swatch} style={{ background: hero.color }} aria-hidden="true" />
               <span className={styles.value}>{powerLeft > 0 ? `${powerLeft}s` : hero.powerLabel}</span>
            </div>
            <ComboMeter chain={chain} multiplier={mult / 100} flow={flow / 10} cap={COMBO.cap} />
         </div>
         <div className={stack.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Space Pod Jump</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "Dock"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Run time">
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <path d="M12 13 L12 8.5 M9.5 3 H14.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{clockText(shown)}</span>
            </div>
            {!playing ? <PodCard /> : null}
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
