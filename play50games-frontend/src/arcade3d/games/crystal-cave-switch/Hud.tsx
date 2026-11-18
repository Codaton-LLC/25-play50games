"use client";

// The game HUD: orbs, the hero power and the flow meter on the left; the title and the level in a
// banner at the top centre with the run clock and one teaching line; the sequence panel at the bottom
// centre: the room's colour order as glyphs (ruby triangle, sapphire square, emerald diamond, topaz
// circle: read by shape, not hue alone), struck ones filled, the next one pulsing, and a timed room's
// countdown; and on level 5 the Hollow Prism's health bar (docked at the right on phones; its colour
// code is drawn over the Prism itself). The shell keeps Mute / Pause; its clock chip is off.
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
import type { CaveLevel } from "./levels";
import type { ColorId } from "./course";
import { COMBO, PRISM } from "./progression";
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
   [HINT.strike]: "Stand at a crystal and press Action (E) to strike it, in the order the beacon shows",
   [HINT.order]: "The beacon by the gate shows the order: struck crystals light up",
   [HINT.timer]: "Timed room: finish the sequence before the lights fade",
   [HINT.hidden]: "A hidden crystal glows only when you come near",
   [HINT.slab]: "Ride the moving slab out to the crystal island",
   [HINT.beam]: "Its beam follows the lane it paints: step out of it",
   [HINT.code]: "Its core is open: strike the colours it shows, in order",
   [HINT.died]: "Back at the room's entrance: what you lit stays lit",
};

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? PRISM.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const seen = useArcadeStore((s) => s.stats[STAT.bossHp] !== undefined);
   if (!seen) return null;
   return (
      <div className={styles.boss}>
         <BossHealthBar name={PRISM.name} phaseName={PRISM.phases[phase]?.name} hp={hp} maxHp={PRISM.maxHp} marks={phaseMarks(PRISM)} vulnerable={open} flash={flash} accent="#f0abfc" />
      </div>
   );
}

/** A colour's glyph in SVG (cx, cy, r): triangle, square, diamond, circle. */
function Glyph({ color, x, filled, next }: { color: ColorId; x: number; filled: boolean; next: boolean }) {
   const c = COLORS.gem[color];
   const fill = filled ? c : "none";
   const stroke = c;
   const w = next ? 4 : 3;
   const op = filled || next ? 1 : 0.55;
   const y = 30;
   const r = 15;
   if (color === 0) return <polygon points={`${x},${y - r} ${x + r},${y + r * 0.8} ${x - r},${y + r * 0.8}`} fill={fill} stroke={stroke} strokeWidth={w} opacity={op} />;
   if (color === 1) return <rect x={x - r * 0.85} y={y - r * 0.85} width={r * 1.7} height={r * 1.7} rx="3" fill={fill} stroke={stroke} strokeWidth={w} opacity={op} />;
   if (color === 2) return <polygon points={`${x},${y - r * 1.1} ${x + r * 0.85},${y} ${x},${y + r * 1.1} ${x - r * 0.85},${y}`} fill={fill} stroke={stroke} strokeWidth={w} opacity={op} />;
   return <circle cx={x} cy={y} r={r * 0.9} fill={fill} stroke={stroke} strokeWidth={w} opacity={op} />;
}

/** The room's colour order (struck filled), and a timed room's countdown. */
function SequencePanel({ level }: { level: number }) {
   const room = useArcadeStore((s) => s.stats[STAT.room] ?? -1);
   const progress = useArcadeStore((s) => s.stats[STAT.progress] ?? 0);
   const timer = useArcadeStore((s) => s.stats[STAT.timer] ?? -1);
   const playing = useArcadeStore((s) => s.phase === "playing" || s.phase === "paused" || s.phase === "countdown");
   if (!playing || room < 0) return null;
   const c = courseFor(level as 1 | 2 | 3 | 4 | 5);
   const r = c.rooms[room];
   if (!r) return null;
   const colors = r.seq.map((id) => c.switches[id].color);
   const n = colors.length;
   const width = Math.max(120, n * 42 + 16);
   const names = ["ruby", "sapphire", "emerald", "topaz"];
   return (
      <div className={styles.lean} data-arcade-safe-area="" role="img" aria-label={`Room ${room + 1}: strike ${colors.map((k) => names[k]).join(", ")}; ${progress} of ${n} done${timer >= 0 ? `, ${(timer / 10).toFixed(1)} seconds left` : ""}`}>
         <svg viewBox={`0 0 ${width} 60`} width={width} height="60" aria-hidden="true">
            {colors.map((col, k) => (
               <Glyph key={k} color={col} x={8 + 21 + k * 42} filled={k < progress} next={k === progress} />
            ))}
         </svg>
         <span className={styles.leanTag}>{progress >= n ? "GATE OPEN" : timer >= 0 ? `${(timer / 10).toFixed(1)} s` : `ROOM ${room + 1}`}</span>
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<CaveLevel>();
   const level = config?.id ?? 1;
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
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
               <span className={styles.title}>Crystal Cave Switch</span>
               <span className={styles.level}>
                  Level {level} · {config?.name ?? "Two Crystals"}
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
         {!playing ? <SequencePanel level={level} /> : null}
      </>
   );
}
