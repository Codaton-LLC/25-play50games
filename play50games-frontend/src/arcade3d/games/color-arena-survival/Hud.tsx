"use client";

// The game HUD: the hearts, the orbs, the hero power and the flow meter on the left; the title and level
// in a banner at the top centre with the run clock, the CALL chip under it (the called colour, its
// symbol, its name, the seconds left, a ring that fills as you lock in; it pulses over the last second)
// and the rounds survived; on level 5 the Prism Keeper's health bar with a hint for the phase. The shell
// keeps Mute / Pause; its clock chip is off (index.tsx). Local multiplayer (menu2/multiplayer): a "2-4
// players" button on the shared hero picker, the join screen, per-player chips and the podium.
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
import { COLOUR_NAMES, LIVES, PHASE_IDS, STAT, WARN_MS } from "./rules";
import type { ArenaLevel } from "./levels";
import { COMBO, KEEPER, ORBS_PER_LEVEL } from "./progression";
import { SYMBOLS, TILE_COLORS, type SymbolId } from "./look";
import { MultiplayerHud, MultiplayerButton } from "./MultiplayerHud";
import stack from "@/arcade3d/menu2/hud/HudStack.module.css";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.floor(ms / 1000);
   const tenths = Math.floor((ms % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

const HERO_STAT: HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];

const HINTS = [
   "Every third round: be on the beacon when the floor drops. Avoid its cracked tiles",
   "Jump its shock ring as the floor drops. Beacon rounds strike it",
   "It changes the colour halfway: watch the beacon's crown. The beacon stays put",
];

/** A colour's symbol (look.ts SYMBOLS), drawn in white: the floor reads without hue. */
export function SymbolIcon({ id, className }: { id: SymbolId; className?: string }) {
   const p = { fill: "#ffffff", stroke: "rgba(0,0,0,0.35)", strokeWidth: 1.2 };
   return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
         {id === "circle" && <circle cx="12" cy="12" r="8" {...p} />}
         {id === "square" && <rect x="4.5" y="4.5" width="15" height="15" rx="1.5" {...p} />}
         {id === "triangle" && <path d="M12 3.5 L21 19.5 H3 Z" {...p} />}
         {id === "star" && <path d="M12 2.8 L14.6 9 L21.3 9.4 L16.2 13.7 L17.8 20.3 L12 16.7 L6.2 20.3 L7.8 13.7 L2.7 9.4 L9.4 9 Z" {...p} />}
         {id === "diamond" && <path d="M12 2.5 L19 12 L12 21.5 L5 12 Z" {...p} />}
      </svg>
   );
}

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? KEEPER.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   return (
      <div className={stack.boss}>
         <BossHealthBar name={KEEPER.name} phaseName={KEEPER.phases[phase]?.name} hp={hp} maxHp={KEEPER.maxHp} marks={phaseMarks(KEEPER)} vulnerable={open} flash={flash} accent="#e879f9" />
         {hp > 0 ? <div className={stack.hint}>{HINTS[phase] ?? ""}</div> : null}
      </div>
   );
}

/** The CALL chip: the called colour, its symbol and name, the seconds left, the lock-in ring. */
function CallChip({ level }: { level: ArenaLevel | null }) {
   const phase = useArcadeStore((s) => s.stats[STAT.phase] ?? 0);
   const called = useArcadeStore((s) => s.stats[STAT.called] ?? 0);
   const left = useArcadeStore((s) => s.stats[STAT.callLeft] ?? 0);
   const lock = useArcadeStore((s) => s.stats[STAT.lock] ?? 0);
   const beacon = useArcadeStore((s) => (s.stats[STAT.beacon] ?? 0) === 1);
   const live = phase === PHASE_IDS.call || phase === PHASE_IDS.drop;
   const warn = phase === PHASE_IDS.call && left * 100 <= WARN_MS;
   const name = COLOUR_NAMES[called] ?? "";
   const r = 17;
   const circ = 2 * Math.PI * r;
   const label = live ? `Stand on ${name}${phase === PHASE_IDS.call ? `, ${(left / 10).toFixed(1)} seconds` : ", the floor drops"}` : "Get ready";
   return (
      <div className={`${styles.call} ${live ? "" : styles.callIdle} ${warn ? styles.callWarn : ""}`} style={{ background: TILE_COLORS[called] }} role="status" aria-live="polite" aria-label={label}>
         <span className={styles.symbolBox}>
            {live ? <SymbolIcon id={SYMBOLS[called] ?? "circle"} className={styles.symbol} /> : null}
            {!level?.boss ? (
               <svg className={styles.lockRing} viewBox="0 0 40 40" aria-hidden="true">
                  <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                  <circle cx="20" cy="20" r={r} fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${(lock / 100) * circ} ${circ}`} />
               </svg>
            ) : null}
         </span>
         <span className={styles.callName}>{live ? name : "Ready"}</span>
         {phase === PHASE_IDS.call ? <span className={styles.callLeft}>{(left / 10).toFixed(1)}</span> : null}
         {beacon ? <span className={styles.callLeft}>★ beacon</span> : null}
      </div>
   );
}

function Hearts({ lives }: { lives: number }) {
   return (
      <span className={styles.hearts}>
         {Array.from({ length: LIVES }, (_, i) => (
            <svg key={i} className={styles.heart} viewBox="0 0 24 24" aria-hidden="true">
               <path d="M12 21 C5 15 2 11.5 2 8 A5 5 0 0 1 12 5.5 A5 5 0 0 1 22 8 C22 11.5 19 15 12 21 Z" fill={i < lives ? "#f43f5e" : "rgba(255,255,255,0.18)"} stroke="#fff" strokeWidth="1.4" />
            </svg>
         ))}
      </span>
   );
}

export default function Hud() {
   const { config } = useLevel<ArenaLevel>();
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const lives = useArcadeStore((s) => s.stats[STAT.lives] ?? LIVES);
   const survived = useArcadeStore((s) => s.stats[STAT.survived] ?? 0);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const powerLeft = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => s.stats[STAT.comboMult] ?? 100);
   const flow = useArcadeStore((s) => s.stats[STAT.comboFlow] ?? 0);
   const level = config?.id ?? 1;
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined ? pick : (HERO_STAT[heroStat] ?? "riko"));
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         <div className={stack.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <div className={styles.pill} aria-label={`${lives} of ${LIVES} hearts`}>
               <Hearts lives={lives} />
            </div>
            <div className={styles.pill} aria-label={`Orbs ${orbs} of ${ORBS_PER_LEVEL}`}>
               <span className={styles.orb} aria-hidden="true" />
               <span className={styles.value}>
                  {orbs}/{ORBS_PER_LEVEL}
               </span>
            </div>
            <div className={styles.pill} aria-label={`${hero.name} ${hero.powerLabel}${powerLeft > 0 ? `, ready in ${powerLeft} seconds` : ", ready"}`}>
               <span className={styles.swatch} style={{ background: hero.color }} aria-hidden="true" />
               <span className={styles.value}>{powerLeft > 0 ? `${powerLeft}s` : hero.powerLabel}</span>
            </div>
            <ComboMeter chain={chain} multiplier={mult / 100} flow={flow / 10} cap={COMBO.cap} />
         </div>
         <div className={stack.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Color Arena Survival</span>
               <span className={styles.level}>
                  <span className={styles.levelLong}>
                     Level {level} — {config?.name ?? "Slow Rounds"}
                  </span>
                  <span className={styles.levelShort}>{config?.name ?? "Slow Rounds"}</span>
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Run time">
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <path d="M12 13 L12 8.5 M9.5 3 H14.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{clockText(tenths * 100)}</span>
            </div>
            <CallChip level={config ?? null} />
            {config && !config.boss ? (
               <div className={styles.rounds} aria-label={`Rounds survived ${survived} of ${config.rounds}`}>
                  Rounds {survived}/{config.rounds}
               </div>
            ) : null}
            {config?.boss && !playing ? <Boss /> : null}
         </div>
      </>
   );
}
