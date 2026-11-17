"use client";

// The game HUD: orbs and coins, the hero power and the flow meter on the left; the title and the level
// in a banner at the top centre with the run clock and one teaching line; the flip panel at the bottom
// centre: the big glyph of the solid set (a filled square for A, a filled triangle for B, so it reads
// by shape) and the parity of the jumps since the checkpoint (even / odd: the parity shard wants even);
// and on level 5 Flipframe's health bar (docked at the right on phones). The shell keeps Mute / Pause;
// its clock chip is off.
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
import { HINT, STAT, courseFor } from "./rules";
import type { NeonLevel } from "./levels";
import { COMBO, FLIPFRAME } from "./progression";
import { COLORS } from "./look";
import { MultiplayerHud, MultiplayerButton } from "./MultiplayerHud";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.floor(ms / 1000);
   const tenths = Math.floor((ms % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

const HERO_STAT: HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];

const HINT_TEXT: Record<number, string> = {
   [HINT.flip]: "Every jump flips which cubes are solid: jump, and the wireframes ahead turn solid",
   [HINT.noBack]: "The cube behind you vanishes on your next jump: no going back",
   [HINT.moving]: "Moving cubes slide only while solid: time your jumps to park them",
   [HINT.rogue]: "Ring cubes blink on their own clock: watch the pulse, jump in time",
   [HINT.laser]: "A laser is live while its set is solid: your jumps switch them",
   [HINT.stomp]: "It stomps the set it shows (and the floor): be on the other set",
   [HINT.core]: "Jump so the core's wireframe cube turns solid, and land on it",
   [HINT.overdrive]: "Overdrive: the field flips by itself too. Climb the tower to the core",
   [HINT.died]: "Back to the checkpoint: the field resets with you",
};

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? FLIPFRAME.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const seen = useArcadeStore((s) => s.stats[STAT.bossHp] !== undefined);
   if (!seen) return null;
   return (
      <div className={styles.boss}>
         <BossHealthBar name={FLIPFRAME.name} phaseName={FLIPFRAME.phases[phase]?.name} hp={hp} maxHp={FLIPFRAME.maxHp} marks={phaseMarks(FLIPFRAME)} vulnerable={open} flash={flash} accent="#f0abfc" />
      </div>
   );
}

/** The solid set's glyph, big, and the jump parity since the checkpoint. */
function FlipPanel() {
   const solid = useArcadeStore((s) => s.stats[STAT.solid] ?? 0);
   const parity = useArcadeStore((s) => s.stats[STAT.parity] ?? 0);
   const playing = useArcadeStore((s) => s.phase === "playing" || s.phase === "paused" || s.phase === "countdown");
   if (!playing) return null;
   const a = solid === 0;
   const color = a ? COLORS.a : COLORS.b;
   return (
      <div className={styles.lean} data-arcade-safe-area="" role="img" aria-label={`Solid set ${a ? "A, square" : "B, triangle"}; jumps since the checkpoint ${parity === 0 ? "even" : "odd"}`}>
         <svg viewBox="0 0 120 64" width="150" height="80" aria-hidden="true">
            {/* the solid set, filled */}
            {a ? <rect x="16" y="10" width="40" height="40" rx="5" fill={color} /> : <polygon points="36,8 58,50 14,50" fill={color} />}
            {/* the other set, outlined (the holograms) */}
            {a ? <polygon points="88,16 104,46 72,46" fill="none" stroke={COLORS.b} strokeWidth="3" opacity="0.6" /> : <rect x="74" y="16" width="28" height="28" rx="4" fill="none" stroke={COLORS.a} strokeWidth="3" opacity="0.6" />}
         </svg>
         <span className={styles.leanTag}>{parity === 0 ? "EVEN" : "ODD"} JUMPS</span>
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<NeonLevel>();
   const level = config?.id ?? 1;
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const coins = useArcadeStore((s) => s.stats[STAT.coins] ?? 0);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const powerLeft = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const hint = useArcadeStore((s) => (s.phase === "playing" ? s.stats[STAT.hint] ?? 0 : 0));
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => s.stats[STAT.comboMult] ?? 100);
   const flow = useArcadeStore((s) => s.stats[STAT.comboFlow] ?? 0);
   const bonus = useArcadeStore((s) => s.stats[STAT.bonusMs] ?? 0);
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined || heroStat < 0 ? pick : HERO_STAT[heroStat] ?? "vexa");
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   const course = courseFor(level);
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         <div className={styles.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <div className={styles.pill} aria-label={`Orbs ${orbs} of ${course.orbs.length}`}>
               <span className={styles.orb} aria-hidden="true" style={{ background: "radial-gradient(circle at 35% 30%, #eafff1 0, #6ee7a8 35%, #22a15a 70%, #0f5f33 100%)" }} />
               <span className={styles.value}>
                  {orbs}/{course.orbs.length}
               </span>
            </div>
            {coins > 0 ? (
               <div className={styles.pill} aria-label={`${coins} coins`}>
                  <span className={styles.value} style={{ fontSize: "0.9rem" }}>
                     ◆ {coins}
                  </span>
               </div>
            ) : null}
            <div className={styles.pill} aria-label={`${hero.name} ${hero.powerLabel}${powerLeft > 0 ? `, ready in ${powerLeft} seconds` : ", ready"}`}>
               <span className={styles.swatch} style={{ background: hero.color }} aria-hidden="true" />
               <span className={styles.value}>{powerLeft > 0 ? `${powerLeft}s` : hero.powerLabel}</span>
            </div>
            {bonus > 0 ? (
               <div className={styles.pill} aria-label={`${(bonus / 1000).toFixed(1)} seconds off`}>
                  <span className={styles.value} style={{ fontSize: "0.95rem" }}>
                     −{(bonus / 1000).toFixed(1)} s
                  </span>
               </div>
            ) : null}
            <ComboMeter chain={chain} multiplier={mult / 100} flow={flow / 10} cap={COMBO.cap} />
         </div>
         <div className={styles.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Neon Cube Jump</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "Static Grid"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Run time">
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <path d="M12 13 L12 8.5 M9.5 3 H14.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{clockText(tenths * 100)}</span>
            </div>
            {config?.boss && !playing ? (
               <div className={styles.bossCenter}>
                  <Boss />
               </div>
            ) : null}
            {hint > 0 && !playing ? (
               <div className={styles.hint} role="status">
                  {HINT_TEXT[hint]}
               </div>
            ) : null}
         </div>
         {config?.boss && !playing ? (
            <div className={styles.bossDock} data-arcade-safe-area="">
               <Boss />
            </div>
         ) : null}
         {!playing ? <FlipPanel /> : null}
      </>
   );
}
