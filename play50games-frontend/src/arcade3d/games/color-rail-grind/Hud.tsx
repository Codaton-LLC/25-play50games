"use client";

// The game HUD: the main orbs (of the level's 25-40), the rings, the relight %, the hero power and the
// flow meter on the left; the title and the level in a banner at the top centre with the run clock (the
// orb, ring and flow bonus taken off), the switch card while a switch is lit ("Switch! E / tap", or
// "Frozen: jump + stomp", and where it points), from level 2 on the mini-map of the next two switches on
// your path (an orb branch, a dead end, a hero gate), level 1's coach line for its three beats, and on
// level 5 the Clockwork Express's health bar with its hint. The shell keeps Mute / Pause; its clock chip
// is off (index.tsx clockChip: false). Local multiplayer (menu2/multiplayer): the "2-4 players" button,
// the join screen, per-player chips, the podium. The shared Menu 2 hero picker (menu2/heroes) shows on
// the start card, the pause menu and the result; the orbit camera's recenter button and first-time hint
// come from OrbitHud.
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
import { BONUS_MS, STAT } from "./rules";
import { LEVELS, type RailLevel } from "./levels";
import { CLOCKWORK, COMBO } from "./progression";
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
export function coachLine(level: number, dist: number, lit: boolean, rings: number): string | null {
   if (level !== 1) return null;
   if (lit) return "Switch lit: press E / tap to take the branch";
   if (dist < 60 && rings < 3) return "Swipe or press ← → to hop rails for the rings";
   if (dist > 150 && dist < 200) return "Jump the gap through the ring";
   return null;
}

/** The Express's hint per phase. */
export function bossHint(phase: number, open: boolean, lit: boolean): string {
   if (phase === 0) return lit ? "Its switch is lit: throw it!" : "Throw its switches into the buffers";
   if (phase === 1) return open ? "Grind through the rings to charge" : "Wagon! Hop out of its rail";
   return open ? "Stomp the key: jump on the roof!" : "Ramp up onto its roof";
}

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

function Boss() {
   const on = useArcadeStore((s) => (s.stats[STAT.bossOn] ?? 0) === 1);
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? CLOCKWORK.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const lit = useArcadeStore((s) => (s.stats[STAT.switchLit] ?? 0) === 1);
   if (!on) return null;
   return (
      <div className={stack.boss}>
         <BossHealthBar name="Clockwork Express" phaseName={CLOCKWORK.phases[phase]?.name} hp={hp} maxHp={CLOCKWORK.maxHp} marks={phaseMarks(CLOCKWORK)} vulnerable={open} flash={flash} accent="#facc15" />
         {hp > 0 ? <div className={stack.hint}>{bossHint(phase, open, lit)}</div> : <div className={stack.hint}>The key spins out: grind home!</div>}
      </div>
   );
}

/** The switch card: lit (press E / tap), frozen (jump + stomp), where it points. */
function SwitchCard() {
   const lit = useArcadeStore((s) => (s.stats[STAT.switchLit] ?? 0) === 1);
   const frozen = useArcadeStore((s) => (s.stats[STAT.switchFrozen] ?? 0) === 1);
   const thrown = useArcadeStore((s) => (s.stats[STAT.switchThrown] ?? 0) === 1);
   const playing = useArcadeStore((s) => s.phase === "playing");
   if (!playing || !lit) return null;
   return (
      <div className={`${styles.switchCard} ${thrown ? styles.switchThrown : ""}`} role="status" aria-label={frozen ? "Frozen switch: jump and stomp" : "Switch lit: press E or tap"}>
         <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 20 L12 12 L12 3 M12 12 L20 20" fill="none" stroke="#facc15" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="3" r="2.2" fill="#facc15" />
         </svg>
         <span className={styles.switchText}>{frozen ? "Frozen: jump + stomp" : thrown ? "Branch set" : "Switch! E / tap"}</span>
      </div>
   );
}

const MAP_LABEL = ["", "orbs", "dead end", "gate"];

/** The mini-map (level 2 on): the next two switches on your path. */
function MiniMap() {
   const m1 = useArcadeStore((s) => s.stats[STAT.map1] ?? 0);
   const m2 = useArcadeStore((s) => s.stats[STAT.map2] ?? 0);
   const t1 = useArcadeStore((s) => (s.stats[STAT.map1Thrown] ?? 0) === 1);
   const t2 = useArcadeStore((s) => (s.stats[STAT.map2Thrown] ?? 0) === 1);
   const playing = useArcadeStore((s) => s.phase === "playing");
   if (!playing || (m1 === 0 && m2 === 0)) return null;
   const item = (code: number, thrown: boolean, k: number) =>
      code === 0 ? null : (
         <span key={k} className={`${styles.mapItem} ${code === 2 ? styles.mapDead : code === 3 ? styles.mapGate : styles.mapOrb} ${thrown ? styles.mapOn : ""}`}>
            <svg className={styles.mapIcon} viewBox="0 0 24 24" aria-hidden="true">
               <path d="M5 21 V12 Q5 8 9 6 L19 3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
               <path d="M5 12 V3" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
            {MAP_LABEL[code]}
         </span>
      );
   return (
      <div className={styles.map} aria-label={`Next switches: ${[m1, m2].filter(Boolean).map((c) => MAP_LABEL[c]).join(", ")}`}>
         {item(m1, t1, 1)}
         {item(m2, t2, 2)}
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<RailLevel>();
   const level = config?.id ?? 1;
   const mainOrbs = useArcadeStore((s) => s.stats[STAT.mainOrbs] ?? 0);
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const rings = useArcadeStore((s) => s.stats[STAT.rings] ?? 0);
   const relight = useArcadeStore((s) => s.stats[STAT.relight] ?? 100);
   const dist = useArcadeStore((s) => s.stats[STAT.distance] ?? 0);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const powerLeft = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const lit = useArcadeStore((s) => (s.stats[STAT.switchLit] ?? 0) === 1);
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const comboMs = useArcadeStore((s) => s.stats[STAT.comboMs] ?? 0);
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => s.stats[STAT.comboMult] ?? 100);
   const flow = useArcadeStore((s) => s.stats[STAT.comboFlow] ?? 0);
   const playingPhase = useArcadeStore((s) => s.phase === "playing" || s.phase === "countdown");
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined ? pick : HERO_STAT[heroStat] ?? "zuno");
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   const shown = Math.max(0, tenths * 100 - orbs * BONUS_MS.orb - rings * BONUS_MS.ring - comboMs);
   const coach = playingPhase ? coachLine(level, dist, lit, rings) : null;
   const total = LEVELS[level].orbs;
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         <div className={stack.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <div className={styles.pill} aria-label={`Orbs ${mainOrbs} of ${total}`}>
               <span className={styles.orb} aria-hidden="true" />
               <span className={styles.value}>
                  {mainOrbs}
                  <span className={styles.unit}>/{total}</span>
               </span>
            </div>
            <div className={styles.pill} aria-label={`Rings ${rings}`}>
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="8" fill="none" stroke="#facc15" strokeWidth="3" />
               </svg>
               <span className={styles.value}>{rings}</span>
            </div>
            <div className={styles.pill} aria-label={`Relight ${relight} percent`}>
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 3 H15 L16 8 H8 Z M8 8 H16 L15 17 H9 Z M10 17 V21 H14 V17" fill={relight >= 90 ? "#ffd257" : "#9ca3af"} stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
               </svg>
               <span className={styles.value}>{relight}%</span>
            </div>
            <div className={styles.pill} aria-label={`${hero.name} ${hero.powerLabel}${powerLeft > 0 ? `, ready in ${powerLeft} seconds` : ", ready"}`}>
               <span className={styles.swatch} style={{ background: hero.color }} aria-hidden="true" />
               <span className={styles.value}>{powerLeft > 0 ? `${powerLeft}s` : hero.powerLabel}</span>
            </div>
            <ComboMeter chain={chain} multiplier={mult / 100} flow={flow / 10} cap={COMBO.cap} />
         </div>
         <div className={stack.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Color Rail Grind</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "Station Yard"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Run time">
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <path d="M12 13 L12 8.5 M9.5 3 H14.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{clockText(shown)}</span>
            </div>
            {!playing ? <SwitchCard /> : null}
            {!playing && level >= 2 ? <MiniMap /> : null}
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
