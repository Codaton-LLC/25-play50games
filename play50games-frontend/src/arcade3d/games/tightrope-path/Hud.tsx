"use client";

// The game HUD: elements crossed, orbs (and the high orbs and coins a hero can add), the hero power and
// the flow meter on the left; the title and the level in a banner at the top centre with the run clock;
// the lean meter (the card's needle: green under 50 %, gold to 100 %, red past it, with the wobble
// flash, SPRINT and CROUCH tags) at the bottom centre over the touch buttons; one teaching line; and on
// level 5 Umbra's health bar. The needle is drawn from the store every animation frame without a React
// re-render (only its transform changes). The shell keeps Mute / Pause; its clock chip is off.
import { useEffect, useRef, useSyncExternalStore } from "react";
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
import { isBalance, mainRoute } from "./course";
import type { TightLevel } from "./levels";
import { COMBO, UMBRA } from "./progression";
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
   [HINT.walk]: "Walk on: push the stick sideways against the needle to stay upright",
   [HINT.lean]: "Leaning! Push the other way to bring the needle back",
   [HINT.gap]: "A gap: jump across",
   [HINT.gust]: "Wind coming (the leaves fly first): brace against it",
   [HINT.bag]: "Sandbag! Hold Action to crouch under it, or wait for it to pass",
   [HINT.dash]: "Riko: Action at the cracked rope's start to dash across",
   [HINT.ghost]: "Vexa: Action now to phase onto the ghost bridge",
   [HINT.stomp]: "Crouch to ride his stomp, then jump to stomp back while he wobbles",
   [HINT.shove]: "Walk up and shove (Action) when his needle tips",
   [HINT.balance]: "Stay upright 10 s on the spinning beam (crouch the plates), then shove",
   [HINT.wobble]: "Wobbling! Push hard the other way",
   [HINT.spin]: "The beam spins: the needle drifts its way",
};

/** The shared Menu 2 hero picker: on the start card, the result screen and the pause menu. */
function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? UMBRA.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const seen = useArcadeStore((s) => s.stats[STAT.bossHp] !== undefined);
   const steady = useArcadeStore((s) => s.stats[STAT.steadyMs] ?? 0);
   if (!seen) return null;
   return (
      <div className={styles.boss}>
         <BossHealthBar name={UMBRA.name} phaseName={UMBRA.phases[phase]?.name} hp={hp} maxHp={UMBRA.maxHp} marks={phaseMarks(UMBRA)} vulnerable={open} flash={flash} accent="#c4b5fd" />
         {phase === 2 ? (
            <div className={styles.hint} role="status" aria-label={`Upright ${Math.min(10, steady / 10).toFixed(1)} of 10 seconds`}>
               Upright {Math.min(10, steady / 10).toFixed(1)} / 10 s
            </div>
         ) : null}
      </div>
   );
}

/** The lean needle: a half-dial, -150 %..+150 % across, polled every animation frame. */
function LeanMeter() {
   const needle = useRef<SVGGElement>(null);
   const box = useRef<HTMLDivElement>(null);
   const sprint = useArcadeStore((s) => (s.stats[STAT.sprint] ?? 0) === 1);
   const crouch = useArcadeStore((s) => (s.stats[STAT.crouch] ?? 0) === 1);
   const playing = useArcadeStore((s) => s.phase === "playing" || s.phase === "paused" || s.phase === "countdown");
   useEffect(() => {
      let raf = 0;
      let last = Number.NaN;
      const tick = () => {
         const st = useArcadeStore.getState().stats;
         const lean = (st[STAT.lean] ?? 0) / 100;
         if (lean !== last) {
            last = lean;
            const a = Math.max(-1.5, Math.min(1.5, lean)) * 60;
            needle.current?.setAttribute("transform", `rotate(${a.toFixed(1)} 60 62)`);
            const abs = Math.abs(lean);
            const col = abs >= 1 ? COLORS.needleBad : abs > 0.5 ? COLORS.needleWarn : COLORS.needleOk;
            needle.current?.setAttribute("stroke", col);
            if (box.current) box.current.dataset.wobble = (st[STAT.wobble] ?? 0) === 1 ? "1" : "0";
         }
         raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
   }, []);
   if (!playing) return null;
   // arc points at +-60 deg (100 %) and +-90 deg (150 %)
   const pt = (deg: number, r: number) => [60 + r * Math.sin((deg * Math.PI) / 180), 62 - r * Math.cos((deg * Math.PI) / 180)];
   const arc = (d0: number, d1: number, r: number) => {
      const [x0, y0] = pt(d0, r);
      const [x1, y1] = pt(d1, r);
      return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
   };
   return (
      <div ref={box} className={styles.lean} data-arcade-safe-area="" role="img" aria-label="Lean meter">
         <svg viewBox="0 0 120 70" width="150" height="88" aria-hidden="true">
            <path d={arc(-90, -60, 50)} stroke={COLORS.needleBad} strokeWidth="9" fill="none" />
            <path d={arc(-60, -30, 50)} stroke={COLORS.needleWarn} strokeWidth="9" fill="none" />
            <path d={arc(-30, 30, 50)} stroke={COLORS.needleOk} strokeWidth="9" fill="none" />
            <path d={arc(30, 60, 50)} stroke={COLORS.needleWarn} strokeWidth="9" fill="none" />
            <path d={arc(60, 90, 50)} stroke={COLORS.needleBad} strokeWidth="9" fill="none" />
            <g ref={needle} stroke={COLORS.needleOk} strokeWidth="4" strokeLinecap="round">
               <line x1="60" y1="62" x2="60" y2="16" />
            </g>
            <circle cx="60" cy="62" r="6" fill="#fff" />
         </svg>
         <span className={styles.leanTag}>{crouch ? "CROUCH" : sprint ? "SPRINT" : " "}</span>
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<TightLevel>();
   const level = config?.id ?? 1;
   const crossed = useArcadeStore((s) => s.stats[STAT.crossed] ?? 0);
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const highs = useArcadeStore((s) => s.stats[STAT.highs] ?? 0);
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
   const hero = heroById(heroStat === undefined || heroStat < 0 ? pick : HERO_STAT[heroStat] ?? "kiro");
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   const course = courseFor(level);
   const total = mainRoute(course).filter((i) => isBalance(course.links[i])).length;
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         <div className={styles.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            {course.arenaStart >= 0 ? null : (
               <div className={styles.pill} aria-label={`Elements crossed ${Math.min(crossed, total)} of ${total}`}>
                  <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                     <path d="M2 9 Q12 15 22 9" stroke="#e9c46a" strokeWidth="2.6" fill="none" strokeLinecap="round" />
                     <path d="M4 6 V14 M20 6 V14" stroke="#c49a50" strokeWidth="2.4" strokeLinecap="round" />
                  </svg>
                  <span className={styles.value}>
                     {Math.min(crossed, total)}/{total}
                  </span>
               </div>
            )}
            <div className={styles.pill} aria-label={`Orbs ${orbs} of ${course.mainOrbs}`}>
               <span className={styles.orb} aria-hidden="true" style={{ background: "radial-gradient(circle at 35% 30%, #eafff1 0, #6ee7a8 35%, #22a15a 70%, #0f5f33 100%)" }} />
               <span className={styles.value}>
                  {orbs}/{course.mainOrbs}
               </span>
            </div>
            {highs + coins > 0 ? (
               <div className={styles.pill} aria-label={`${highs} high orbs, ${coins} coins`}>
                  <span className={styles.value} style={{ fontSize: "0.9rem" }}>
                     ✦{highs} ●{coins}
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
               <span className={styles.title}>Tightrope Path</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "Wide Beams"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Run time">
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <path d="M12 13 L12 8.5 M9.5 3 H14.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{clockText(tenths * 100)}</span>
            </div>
            {config?.boss && !playing ? <Boss /> : null}
            {hint > 0 && !playing ? (
               <div className={styles.hint} role="status">
                  {HINT_TEXT[hint]}
               </div>
            ) : null}
         </div>
         {!playing ? <LeanMeter /> : null}
      </>
   );
}
