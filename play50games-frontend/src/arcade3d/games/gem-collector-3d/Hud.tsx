"use client";

// The game HUD: the score toward the level's target, the train meter (links of 20 and what a bank
// would score now), orbs, the hero power (Riko's dash charges) and the flow meter on the left; the
// title and level and the round clock in the centre, level 1's coach line for its three beats and
// each level's twist line, and on level 5 the Glutton's health bar with its hint. The shell keeps
// Mute / Pause; its clock chip is off. Local multiplayer: the "2-4 players" button, the join screen,
// per-player chips, the podium. The shared hero picker shows between runs; the orbit camera's
// recenter button and hint (OrbitHud).
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
import { STAT } from "./rules";
import { BANK_CAP, MAX_LINKS } from "./arena";
import type { ArenaSpec } from "./levels";
import { COMBO, GLUTTON } from "./progression";
import { MultiplayerHud, MultiplayerButton } from "./MultiplayerHud";
import stack from "@/arcade3d/menu2/hud/HudStack.module.css";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.max(0, Math.ceil(ms / 1000));
   return `${String(Math.floor(s / 60)).padStart(1, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const HERO_STAT: HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];

/** One short line per beat or twist (teach by playing, no text walls); null when nothing to say. */
export function coachLine(level: number, elapsedMs: number, links: number, banks: number): string | null {
   if (level === 1) {
      if (banks === 0 && links === 0) return "Roll over the gems: they follow you";
      if (banks === 0) return "Drive into the beacon to bank them";
      if (banks === 1 && links < 8) return "Longer trains score more: links x links";
      if (elapsedMs < 45_000) return "Never cross your own tail";
      return null;
   }
   if (level === 2 && elapsedMs < 9_000) return "Tiles shake, then sink: keep off them";
   if (level === 3 && elapsedMs < 9_000) return "Slimes nibble your tail. Loop round a chewing one!";
   if (level === 4 && elapsedMs < 9_000) return "Bump the chests open. The beacon moves every 15 s";
   return null;
}

/** The Glutton's hint per phase (what opens him). */
export function bossHint(phase: number, open: boolean, stunned: boolean): string {
   if (phase === 0) return stunned ? "Stunned! Bank now!" : open ? "He squats, full: loop your train round him!" : "He eats your tail: keep away";
   if (phase === 1) return open ? "Lasso a mini-gummy!" : "Minis nibble: keep your tail clear";
   return open ? "He yawns: bank 10+ links into his mouth!" : "He holds the last beacon: build a 10+ train";
}

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? GLUTTON.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const on = useArcadeStore((s) => (s.stats[STAT.bossOn] ?? 0) === 1);
   const stunned = useArcadeStore((s) => (s.stats[STAT.bossStun] ?? 0) === 1);
   if (!on) return null;
   return (
      <div className={stack.boss}>
         <BossHealthBar name={GLUTTON.name} phaseName={GLUTTON.phases[phase]?.name} hp={hp} maxHp={GLUTTON.maxHp} marks={phaseMarks(GLUTTON)} vulnerable={open || stunned} flash={flash} accent="#fb7185" />
         {hp > 0 ? <div className={stack.hint}>{bossHint(phase, open, stunned)}</div> : null}
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<ArenaSpec>();
   const level = config?.id ?? 1;
   const boss = !!config?.boss;
   const score = useArcadeStore((s) => s.score);
   const links = useArcadeStore((s) => s.stats[STAT.links] ?? 0);
   const weight = useArcadeStore((s) => s.stats[STAT.weight] ?? 0);
   const banks = useArcadeStore((s) => s.stats[STAT.banks] ?? 0);
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const powerLeft = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const dashes = useArcadeStore((s) => s.stats[STAT.dashes] ?? 3);
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => s.stats[STAT.comboMult] ?? 100);
   const flow = useArcadeStore((s) => s.stats[STAT.comboFlow] ?? 0);
   const elapsed = useArcadeStore((s) => s.elapsedMs);
   const playingPhase = useArcadeStore((s) => s.phase === "playing" || s.phase === "countdown");
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined ? pick : HERO_STAT[heroStat] ?? "zuno");
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   const target = config?.targetScore ?? 0;
   const duration = config?.durationMs ?? 90_000;
   const coach = playingPhase && !boss ? coachLine(level, elapsed, links, banks) : null;
   const bankNow = Math.min(BANK_CAP, weight * weight);
   const orbTotal = config ? config.orbs.length : 5;
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         <div className={stack.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <div className={styles.pill} aria-label={target > 0 ? `Score ${score} of the ${target} target` : `Score ${score}`}>
               <span className={styles.beaconDot} aria-hidden="true" />
               <span className={styles.value}>{score}</span>
               {target > 0 ? <span className={styles.unit}>/{target}</span> : null}
            </div>
            <div className={styles.pill} aria-label={`Train ${links} of ${MAX_LINKS} links, a bank now scores ${bankNow}`}>
               <span className={styles.orb} aria-hidden="true" />
               <span className={styles.value}>
                  {links}/{MAX_LINKS}
               </span>
               <span className={styles.unit}>+{bankNow}</span>
            </div>
            <div className={styles.pill} aria-label={`Orbs ${orbs} of ${orbTotal}`}>
               <span className={styles.swatch} style={{ background: "#f472b6" }} aria-hidden="true" />
               <span className={styles.value}>
                  {orbs}/{orbTotal}
               </span>
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
               <span className={styles.title}>Gem Collector 3D</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "Vault Floor"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Time left">
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <path d="M12 13 L12 8.5 M9.5 3 H14.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{clockText(duration - elapsed)}</span>
            </div>
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
