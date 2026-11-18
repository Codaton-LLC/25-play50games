"use client";

// The game HUD: the distance meter (Cindermaw's distance behind the cart, 0-100, always visible: the
// card's fix for an unseen chaser), orbs, the hero power and the flow meter on the left; the title, the
// level, the run clock and the progress along the cave in a banner at the top centre, under it the
// breath warning (with the 1.0 s telegraph), the two-wheel tilt warning, and on level 5 Cindermaw's
// health bar with what to do in each phase. The shell keeps Mute / Pause; its clock chip is off. Local
// multiplayer: the "2-4 players" button on the shared hero picker (desktop and tablet), the join screen,
// per-player chips and the podium. The orbit camera's recenter button and first-time hint come from OrbitHud.
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
import { METER, STAT, runTimeMs } from "./rules";
import type { CaveLevel } from "./levels";
import { CINDERMAW, COMBO, DISTANCE_BADGE } from "./progression";
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

const PHASE_HINTS = ["Hop on the glowing plates: drop the crystals on her", "Swap to the outer track, hit the boost ramps", "Hop at each collar lock as you pass"];

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? CINDERMAW.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const started = useArcadeStore((s) => s.stats[STAT.bossHp] !== undefined);
   if (!started) return null;
   return (
      <div className={stack.boss}>
         <BossHealthBar name={CINDERMAW.name} phaseName={CINDERMAW.phases[phase]?.name ?? ""} hp={hp} maxHp={CINDERMAW.maxHp} marks={phaseMarks(CINDERMAW)} vulnerable={open} flash={flash} accent="#f97316" />
         {hp > 0 ? <div className={stack.hint}>{PHASE_HINTS[phase] ?? ""}</div> : <div className={stack.hint}>Ride out through the gate!</div>}
      </div>
   );
}

/** Cindermaw's distance: a bar from 0 (she has you) to 100, with the badge line at 50. */
function DistanceMeter() {
   const meter = useArcadeStore((s) => s.stats[STAT.meter] ?? METER.start);
   const awake = useArcadeStore((s) => (s.stats[STAT.awake] ?? 0) === 1);
   const low = awake && meter < 25;
   return (
      <div className={`${styles.meter} ${low ? styles.meterLow : ""}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={meter} aria-label={awake ? `Dragon distance ${meter}` : "The dragon sleeps"}>
         <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 14 C6 8 10 6 14 7 L19 4 L18 9 C21 11 21 15 18 17 L14 18 L12 21 L10 18 C6 18 4 17 3 14 Z" fill={awake ? "#f97316" : "#78716c"} />
            <circle cx="15.5" cy="10" r="1.3" fill="#fef3c7" />
         </svg>
         <div className={styles.meterBar}>
            <div className={styles.meterFill} style={{ width: `${Math.max(0, Math.min(100, meter))}%`, opacity: awake ? 1 : 0.4 }} />
            <div className={styles.meterMark} style={{ left: `${DISTANCE_BADGE}%` }} />
         </div>
         <span className={styles.value}>{awake ? meter : "zzz"}</span>
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<CaveLevel>();
   const level = config?.id ?? 1;
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const powerLeft = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const breath = useArcadeStore((s) => s.stats[STAT.breath] ?? 0);
   const tilt = useArcadeStore((s) => (s.stats[STAT.tilt] ?? 0) === 1);
   const awake = useArcadeStore((s) => (s.stats[STAT.awake] ?? 0) === 1);
   const progress = useArcadeStore((s) => s.stats[STAT.progress] ?? 0);
   const live = useArcadeStore((s) => s.phase === "playing");
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const comboMs = useArcadeStore((s) => s.stats[STAT.comboMs] ?? 0);
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => s.stats[STAT.comboMult] ?? 100);
   const flow = useArcadeStore((s) => s.stats[STAT.comboFlow] ?? 0);
   const shown = runTimeMs(tenths * 100, orbs, comboMs);
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined ? pick : HERO_STAT[heroStat] ?? "riko");
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         <div className={stack.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <DistanceMeter />
            <div className={styles.pill} aria-label={`Orbs ${orbs}`}>
               <span className={styles.orb} aria-hidden="true" />
               <span className={styles.value}>{orbs}</span>
            </div>
            <div className={styles.pill} aria-label={`${hero.name} ${hero.powerLabel}${powerLeft > 0 ? `, ready in ${powerLeft} seconds` : ", ready"}`}>
               <span className={styles.swatch} style={{ background: hero.color }} aria-hidden="true" />
               <span className={styles.value}>{powerLeft > 0 ? `${powerLeft}s` : hero.powerLabel}</span>
            </div>
            <ComboMeter chain={chain} multiplier={mult / 100} flow={flow / 10} cap={COMBO.cap} />
         </div>
         <div className={stack.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Dragon Cave Rush</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "Crystal Entry"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Run time">
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <path d="M12 13 L12 8.5 M9.5 3 H14.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{clockText(shown)}</span>
            </div>
            <div className={styles.progress} aria-hidden="true">
               <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
            {live && breath > 0 ? (
               <div className={styles.breath} role="alert">
                  {breath === 2 ? "Fire!" : "Breath! Duck or swap track"}
               </div>
            ) : null}
            {live && tilt ? (
               <div className={styles.tilt} role="alert">
                  Two wheels! Lean into the curve
               </div>
            ) : null}
            {live && !awake && !playing && level === 1 ? <div className={styles.sleep}>Cindermaw sleeps on her hoard…</div> : null}
            {config?.boss && !playing ? <Boss /> : null}
         </div>
      </>
   );
}
