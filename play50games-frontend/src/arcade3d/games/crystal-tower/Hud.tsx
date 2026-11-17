"use client";

// The game HUD: the tier, the gems, the hero power (Riko's dash charges) and the flow meter on the
// left; the title and level, the run clock (the gem and flow bonus taken off), the sequence strip
// (the beacon's colours as they show, then hidden dots that fill as you touch the right crystals),
// level 1's coach lines and each level's twist line, and on level 5 Prism Shade's health bar with
// its hint in the centre. The shell keeps Mute / Pause; its clock chip is off. Local multiplayer:
// the "2-4 players" button, the join screen, per-player chips, the podium. The shared hero picker
// shows between runs; the orbit camera's recenter button and hint (OrbitHud).
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
import { STAT, runTimeMs } from "./rules";
import { PALETTE, type TowerSpec } from "./levels";
import { COMBO, PRISM } from "./progression";
import { MultiplayerHud, MultiplayerButton } from "./MultiplayerHud";
import stack from "@/arcade3d/menu2/hud/HudStack.module.css";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.floor(ms / 1000);
   const tenths = Math.floor((ms % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

const HERO_STAT: HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];

/** One short line per beat or twist (teach by playing, no text walls); null when nothing to say. */
export function coachLine(level: number, tier: number, seqState: number): string | null {
   if (level === 1) {
      if (tier === 0 && seqState === 0) return "Stand in the beacon's ring and watch";
      if (tier === 0 && seqState === 1) return "Remember the colours";
      if (tier === 0 && seqState === 2) return "Climb and touch the crystals in that order";
      if (tier === 1 && seqState === 2) return "A wrong crystal starts the sequence over";
      return null;
   }
   if (level === 2 && tier === 0 && seqState === 2) return "Four colours now: the bridges slide";
   if (level === 3 && tier === 0 && seqState === 2) return "Glass pads slip; the plain ones crumble under you";
   if (level === 4 && tier === 0 && seqState === 2) return "The crystals bob: touch them as they sink";
   if (level === 5 && tier === 0 && seqState === 0) return "Everything at once, then Prism Shade on the summit";
   return null;
}

/** The boss's hint per phase (what opens it). */
export function bossHint(phase: number, open: boolean, trick: number): string {
   if (!open) return phase === 0 ? "Watch his colours: the shockwave shuffles the crystals" : phase === 1 ? "Watch where each colour stands: the shockwave blacks them out" : "Watch his colours: the shockwave flips the order";
   if (trick === 2) return "Reversed! Touch them last to first";
   if (trick === 1) return "Blackout! Touch them where they stood";
   return "Touch them in his order";
}

/** The colours shown so far, from the packed stat (base 8 digits, colour + 1, step 0 lowest). */
export function unpackShown(packed: number): number[] {
   const out: number[] = [];
   let v = packed;
   while (v > 0) {
      out.push((v % 8) - 1);
      v = Math.floor(v / 8);
   }
   return out;
}

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

/** The sequence strip: during the show the colours appear one by one; after it the dots are hidden and fill as you pick. */
function Sequence() {
   const len = useArcadeStore((s) => s.stats[STAT.seqLen] ?? 0);
   const progress = useArcadeStore((s) => s.stats[STAT.seqProgress] ?? 0);
   const shown = useArcadeStore((s) => s.stats[STAT.seqShown] ?? 0);
   const state = useArcadeStore((s) => s.stats[STAT.seqState] ?? 0);
   const trick = useArcadeStore((s) => s.stats[STAT.bossTrick] ?? 0);
   if (len <= 0 || state === 0) return null;
   const colours = unpackShown(shown);
   const dots = [];
   for (let i = 0; i < len; i++) {
      if (state === 1) {
         const col = colours[i];
         dots.push(<span key={i} className={`${styles.dot} ${col !== undefined ? styles.dotShown : ""}`} style={col !== undefined ? { background: PALETTE[col].hex, borderColor: "#fff" } : undefined} aria-label={col !== undefined ? PALETTE[col].name : "hidden"} />);
      } else {
         const done = i < progress;
         dots.push(<span key={i} className={`${styles.dot} ${done ? styles.dotDone : i === progress ? styles.dotNext : ""}`} aria-label={done ? "done" : "to find"} />);
      }
   }
   return (
      <div className={styles.seq} role="status" aria-label={state === 1 ? "Watch the sequence" : `${progress} of ${len} crystals`}>
         <span className={styles.seqLabel}>{state === 1 ? "Watch" : trick === 2 ? "Reverse" : "Touch"}</span>
         {dots}
         {state === 2 && trick === 1 ? <span className={styles.trick}>Blackout</span> : null}
      </div>
   );
}

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? PRISM.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const on = useArcadeStore((s) => (s.stats[STAT.bossOn] ?? 0) === 1);
   const trick = useArcadeStore((s) => s.stats[STAT.bossTrick] ?? 0);
   if (!on) return null;
   return (
      <div className={stack.boss}>
         <BossHealthBar name={PRISM.name} phaseName={PRISM.phases[phase]?.name} hp={hp} maxHp={PRISM.maxHp} marks={phaseMarks(PRISM)} vulnerable={open} flash={flash} accent="#e879f9" />
         {hp > 0 ? <div className={stack.hint}>{bossHint(phase, open, trick)}</div> : null}
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<TowerSpec>();
   const level = config?.id ?? 1;
   const boss = !!config?.boss;
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const mainOrbs = useArcadeStore((s) => s.stats[STAT.mainOrbs] ?? 0);
   const tier = useArcadeStore((s) => s.stats[STAT.tier] ?? 0);
   const tiers = useArcadeStore((s) => s.stats[STAT.tiers] ?? (config ? config.tiers.filter((t) => t.seqLen > 0).length : 0));
   const seqState = useArcadeStore((s) => s.stats[STAT.seqState] ?? 0);
   const bossOn = useArcadeStore((s) => (s.stats[STAT.bossOn] ?? 0) === 1);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const powerLeft = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const dashes = useArcadeStore((s) => s.stats[STAT.dashes] ?? 3);
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const comboMs = useArcadeStore((s) => s.stats[STAT.comboMs] ?? 0);
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => s.stats[STAT.comboMult] ?? 100);
   const flow = useArcadeStore((s) => s.stats[STAT.comboFlow] ?? 0);
   const playingPhase = useArcadeStore((s) => s.phase === "playing" || s.phase === "countdown");
   const shown = runTimeMs(tenths * 100, orbs, comboMs);
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined ? pick : HERO_STAT[heroStat] ?? "vexa");
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   const mainTotal = config ? config.orbs.filter((o) => o.main).length : 0;
   const coach = playingPhase && !bossOn ? coachLine(level, tier, seqState) : null;
   const tierShown = Math.min(tiers, tier + 1);
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         <div className={stack.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <div className={styles.pill} aria-label={bossOn ? "On the summit" : `Tier ${tierShown} of ${tiers}`}>
               <span className={styles.beaconDot} aria-hidden="true" />
               <span className={styles.value}>{bossOn ? "Summit" : `${tierShown}/${tiers}`}</span>
            </div>
            <div className={styles.pill} aria-label={`Gems ${mainOrbs} of ${mainTotal}, ${orbs} in all`}>
               <span className={styles.orb} aria-hidden="true" />
               <span className={styles.value}>
                  {mainOrbs}/{mainTotal}
               </span>
               {orbs > mainOrbs ? <span className={styles.unit}>+{orbs - mainOrbs}</span> : null}
            </div>
            <div className={styles.pill} aria-label={`${hero.name} ${hero.powerLabel}${powerLeft > 0 ? `, ready in ${powerLeft} seconds` : ", ready"}`}>
               <span className={styles.swatch} style={{ background: hero.color }} aria-hidden="true" />
               <span className={styles.value}>{powerLeft > 0 ? `${powerLeft}s` : hero.powerLabel}</span>
               {hero.id === "riko" ? <span className={styles.unit}>x{dashes}</span> : null}
            </div>
            <ComboMeter chain={chain} multiplier={mult / 100} flow={flow / 10} cap={COMBO.cap} />
         </div>
         <div className={stack.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Crystal Tower</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "3-Color Sequence"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Run time">
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <path d="M12 13 L12 8.5 M9.5 3 H14.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{clockText(shown)}</span>
            </div>
            {playingPhase ? <Sequence /> : null}
            {boss && !playing ? <Boss /> : null}
            {coach ? (
               <div className={stack.boss}>
                  <div className={stack.hint}>{coach}</div>
               </div>
            ) : null}
         </div>
      </>
   );
}
