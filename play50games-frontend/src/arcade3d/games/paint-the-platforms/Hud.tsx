"use client";

// The game HUD: paint blobs, the hero power and the flow meter on the left; the title and the level in
// a banner at the top centre with the card's timer counting down (red in the last 10 s) and one teaching
// line; the paint panel at the bottom centre: the share painted against the goal (a bar with the goal
// mark), the rows set, and a live mini-map of the arena (grey tiles, painted tiles in their colour, set
// rows outlined); on level 5 the Paint Blob's health bar (docked at the right on phones). The shell
// keeps Mute / Pause; its clock chip is off.
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useLevel } from "@/arcade3d/core/level";
import ComboMeter from "@/arcade3d/menu2/combo/ComboMeter";
import BossHealthBar from "@/arcade3d/menu2/boss/BossHealthBar";
import { phaseMarks } from "@/arcade3d/menu2/boss/boss";
import { playersStore, usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import HeroPicker from "@/arcade3d/menu2/heroes/HeroPicker";
import OrbitHud from "@/arcade3d/menu2/camera/OrbitHud";
import { HEROES, HERO_IDS, heroById, pickedHero, selectHero, subscribeHero } from "./heroes";
import { HINT, STAT, courseFor } from "./rules";
import type { PaintLevel } from "./levels";
import { TILE } from "./course";
import { arenaBounds } from "./camera";
import { BLOB, COMBO } from "./progression";
import { COLORS } from "./look";
import { LIVE } from "./live";
import { MultiplayerHud, MultiplayerButton } from "./MultiplayerHud";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.floor(ms / 1000);
   const tenths = Math.floor((ms % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

const HINT_TEXT: Record<number, string> = {
   [HINT.paint]: "Run over the grey tiles to paint them in your colour",
   [HINT.rows]: "Paint a whole row and it sets: nothing can wipe it",
   [HINT.blots]: "Grey blots wipe the paint they cross: keep clear, or set the rows",
   [HINT.raft]: "The tile rafts dock at each island for a moment: step on, ride, paint them too",
   [HINT.roller]: "The roller is coming down the glowing lane: get out of it",
   [HINT.slam]: "A slam is coming: get out of the dark ring",
   [HINT.splat]: "Its core is open: get close and press Action (E) to splat it",
   [HINT.died]: "Back on the last platform you stood on",
   [HINT.blob]: "Painted enough: now splat the Paint Blob",
   [HINT.last]: "Almost there: a few more tiles",
};

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? BLOB.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const seen = useArcadeStore((s) => s.stats[STAT.bossHp] !== undefined);
   if (!seen) return null;
   return (
      <div className={styles.boss}>
         <BossHealthBar name={BLOB.name} phaseName={BLOB.phases[phase]?.name} hp={hp} maxHp={BLOB.maxHp} marks={phaseMarks(BLOB)} vulnerable={open} flash={flash} accent="#e879f9" />
      </div>
   );
}

/** The arena from above: one rect per tile, recoloured from the live run a few times a second. */
function MiniMap({ level }: { level: 1 | 2 | 3 | 4 | 5 }) {
   const course = courseFor(level);
   const rects = useRef<(SVGRectElement | null)[]>([]);
   const layout = useMemo(() => {
      const b = arenaBounds(course);
      const w = b.maxX - b.minX;
      const h = b.maxZ - b.minZ;
      const k = Math.min(132 / w, 74 / h);
      return { k, w: w * k, h: h * k, x0: b.minX, z0: b.minZ };
   }, [course]);
   useEffect(() => {
      const id = window.setInterval(() => {
         const run = LIVE.run;
         if (!run || run.course !== course) return;
         const paint = run.board.paint;
         for (let i = 0; i < course.tiles.length; i++) {
            const r = rects.current[i];
            if (!r) continue;
            const p = paint[i];
            const fill = p < 0 ? COLORS.greyDark : COLORS.paint[p];
            if (r.getAttribute("fill") !== fill) r.setAttribute("fill", fill);
            const set = run.board.set[course.tiles[i].row] ? "1" : "0";
            if (r.dataset.set !== set) {
               r.dataset.set = set;
               r.setAttribute("stroke", set === "1" ? "#ffffff" : "none");
            }
         }
      }, 150);
      return () => window.clearInterval(id);
   }, [course]);
   const s = TILE * layout.k;
   return (
      <svg className={styles.map} viewBox={`-2 -2 ${layout.w + 4} ${layout.h + 4}`} width={layout.w + 4} height={layout.h + 4} aria-hidden="true">
         {course.tiles.map((t, i) => (
            <rect
               key={t.id}
               ref={(r) => {
                  rects.current[i] = r;
               }}
               x={(t.x - TILE / 2 - layout.x0) * layout.k + 0.4}
               y={(t.z - TILE / 2 - layout.z0) * layout.k + 0.4}
               width={s - 0.8}
               height={s - 0.8}
               rx={0.8}
               fill={COLORS.greyDark}
               strokeWidth={0.6}
            />
         ))}
      </svg>
   );
}

/** The share painted against the goal, the rows set, and the mini-map. */
function PaintPanel({ level }: { level: 1 | 2 | 3 | 4 | 5 }) {
   const painted = useArcadeStore((s) => s.stats[STAT.painted] ?? 0);
   const rows = useArcadeStore((s) => s.stats[STAT.rowsSet] ?? 0);
   const playing = useArcadeStore((s) => s.phase === "playing" || s.phase === "paused" || s.phase === "countdown");
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   if (!playing) return null;
   const c = courseFor(level);
   const total = c.tiles.length;
   const pct = Math.floor((painted * 100) / total);
   const goalPct = Math.round(c.cfg.goal * 100);
   const hero = heroById(heroStat === undefined || heroStat < 0 ? pick : HERO_IDS[heroStat] ?? "riko");
   const done = painted >= c.need;
   return (
      <div className={styles.lean} data-arcade-safe-area="" role="status" aria-label={`Painted ${pct} percent of ${goalPct} percent; ${rows} rows set`}>
         <MiniMap level={level} />
         <div className={styles.paintCol}>
            <div className={styles.paintTop}>
               <span className={styles.paintPct} style={{ color: done ? "#86efac" : "#fff" }}>{pct}%</span>
               <span className={styles.paintGoal}>/ {goalPct}%</span>
            </div>
            <div className={styles.bar} aria-hidden="true">
               <div className={styles.barFill} style={{ width: `${Math.min(100, (painted * 100) / total)}%`, background: hero.color }} />
               <div className={styles.barGoal} style={{ left: `${goalPct}%` }} />
            </div>
            <span className={styles.leanTag}>{done ? (c.boss ? "SPLAT THE BLOB" : "PAINTED!") : `${Math.max(0, c.need - painted)} TILES TO GO · ${rows} SET`}</span>
         </div>
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<PaintLevel>();
   const level = (config?.id ?? 1) as 1 | 2 | 3 | 4 | 5;
   const blobs = useArcadeStore((s) => s.stats[STAT.blobs] ?? 0);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const powerLeft = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const hint = useArcadeStore((s) => (s.phase === "playing" ? s.stats[STAT.hint] ?? 0 : 0));
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => s.stats[STAT.comboMult] ?? 100);
   const flow = useArcadeStore((s) => s.stats[STAT.comboFlow] ?? 0);
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined || heroStat < 0 ? pick : HERO_IDS[heroStat] ?? "riko");
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   const course = courseFor(level);
   const left = Math.max(0, course.durationMs - tenths * 100);
   const urgent = left <= 10_000;
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         <div className={styles.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <div className={styles.pill} aria-label={`Paint blobs ${blobs} of ${course.pickups.length}`}>
               <span className={styles.orb} aria-hidden="true" style={{ background: `radial-gradient(circle at 35% 30%, #ffffff 0, ${hero.color} 55%, #111827 100%)` }} />
               <span className={styles.value}>
                  {blobs}/{course.pickups.length}
               </span>
            </div>
            <div className={styles.pill} aria-label={`${hero.name} ${hero.powerLabel}${powerLeft > 0 ? `, ready in ${powerLeft} seconds` : ", ready"}`}>
               <span className={styles.swatch} style={{ background: hero.color }} aria-hidden="true" />
               <span className={styles.value}>{powerLeft > 0 ? `${powerLeft}s` : hero.powerLabel}</span>
            </div>
            <ComboMeter chain={chain} multiplier={mult / 100} flow={flow / 10} cap={COMBO.cap} />
         </div>
         <div className={styles.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Paint the Platforms</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "First Strokes"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Time left" style={urgent ? { color: "#fca5a5" } : undefined}>
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke={urgent ? "#fca5a5" : "#fff"} strokeWidth="2.4" />
                  <path d="M12 13 L12 8.5 M9.5 3 H14.5" stroke={urgent ? "#fca5a5" : "#fff"} strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{clockText(left)}</span>
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
         {!playing ? <PaintPanel level={level} /> : null}
      </>
   );
}
