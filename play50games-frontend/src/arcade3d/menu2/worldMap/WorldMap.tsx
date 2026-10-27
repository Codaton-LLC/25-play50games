"use client";

// The Menu 2 menu page: Shadow Plates drained the colour; six worlds on a map, each game a node on a
// winding trail with its stars and its state (soon, locked, new, played, cleared). Each world's
// colour fills in as its games are cleared. /3d shows it for the "rollheroes" collection on preview
// builds (app/3d/page.tsx). The model is pure (mapModel.ts); this file only draws it.
import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import type { ArcadeGameMeta } from "@/arcade3d/types";
import { ARCADE_LEVELS } from "@/arcade3d/flags";
import { useProgress } from "../progress/useProgress";
import { totals, xpLevel } from "../progress/progress";
import { HERO_GLB } from "../heroModels";
import { buildMap, gamesToW6, isPerfect, type BuiltGame, type MapNode, type MapWorld } from "./mapModel";
import styles from "./WorldMap.module.css";

export interface WorldMapProps {
   /** the visible Color Roll Heroes games (registry) */
   games: readonly ArcadeGameMeta[];
   /** preview builds: every built game is open (a switch lets you see the real locks) */
   preview?: boolean;
}

const COLS = 4;
/** a node row's height (rem) and the node centre's offset in it: the trail goes through the centres */
const ROW_REM = 7.4;
const CENTRE_REM = 2.05;

function cellOf(i: number): { row: number; col: number } {
   const row = Math.floor(i / COLS);
   const k = i % COLS;
   return { row, col: row % 2 === 0 ? k : COLS - 1 - k };
}

function pointOf(i: number, rows: number): { x: number; y: number } {
   const { row, col } = cellOf(i);
   return { x: ((col + 0.5) / COLS) * 100, y: ((row * ROW_REM + CENTRE_REM) / (rows * ROW_REM)) * 100 };
}

/** The trail through the node centres: straight along a row, a round bend at the row's end. */
function trailPath(from: number, to: number, rows: number): string {
   let d = "";
   for (let i = from; i <= to; i++) {
      const p = pointOf(i, rows);
      if (i === from) {
         d += `M ${p.x} ${p.y}`;
         continue;
      }
      const a = pointOf(i - 1, rows);
      if (cellOf(i).row === cellOf(i - 1).row) d += ` L ${p.x} ${p.y}`;
      else {
         const out = a.x > 50 ? 11 : -11;
         d += ` C ${a.x + out} ${a.y} ${p.x + out} ${p.y} ${p.x} ${p.y}`;
      }
   }
   return d;
}

function StarGlyph({ className }: { className?: string }) {
   return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
         <path d="M12 2.2l3 6.3 6.9.9-5 4.8 1.3 6.8L12 17.7 5.8 21l1.3-6.8-5-4.8 6.9-.9z" />
      </svg>
   );
}

function LockGlyph() {
   return (
      <svg viewBox="0 0 24 24" className={styles.lock} aria-hidden="true">
         <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
         <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" strokeWidth="2.2" />
      </svg>
   );
}

const STATE_TEXT: Record<MapNode["state"], string> = {
   soon: "coming soon",
   locked: "locked",
   new: "new",
   unlocked: "in progress",
   cleared: "cleared",
};

function Node({ node, index, thumb }: { node: MapNode; index: number; thumb: string | null }) {
   const { row, col } = cellOf(index);
   const place = { gridRow: row + 1, gridColumn: col + 1 } as CSSProperties;
   const label = `${node.index}. ${node.title}, ${STATE_TEXT[node.state]}${node.playable || node.stars > 0 ? `, ${node.stars} of ${node.maxStars} stars` : ""}`;
   const face = (
      <>
         <span className={styles.plate}>
            {thumb && node.state !== "soon" ? <img className={styles.thumb} src={thumb} alt="" loading="lazy" decoding="async" /> : null}
            <span className={styles.num}>{node.state === "locked" ? <LockGlyph /> : node.index}</span>
            {node.state === "new" && <span className={styles.newDot}>New</span>}
            {node.state === "cleared" && (
               <span className={`${styles.clearMark} ${isPerfect(node) ? styles.perfect : ""}`} aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                     <path d="M6 12.5l4 4 8-9" />
                  </svg>
               </span>
            )}
         </span>
         <span className={styles.nodeTitle}>{node.title}</span>
         {node.state === "soon" ? (
            <span className={styles.nodeMeta}>Soon</span>
         ) : (
            <span className={styles.nodeMeta}>
               <StarGlyph className={styles.metaStar} />
               {node.stars}/{node.maxStars}
            </span>
         )}
      </>
   );
   const cls = `${styles.node} ${styles[node.state]}`;
   return (
      <li className={styles.cell} style={place}>
         {node.playable ? (
            <Link href={`/3d/${node.slug}`} className={cls} aria-label={label}>
               {face}
            </Link>
         ) : (
            <span className={cls} aria-label={label} role="img">
               {face}
            </span>
         )}
      </li>
   );
}

function WorldPanel({ mw, thumbs, toW6 }: { mw: MapWorld; thumbs: Record<string, string | null>; toW6: number }) {
   const { world, nodes } = mw;
   const rows = Math.ceil(nodes.length / COLS);
   // the lit trail runs up to the furthest open node
   let lastOpen = -1;
   nodes.forEach((n, i) => {
      if (n.playable) lastOpen = i;
   });
   const style = {
      "--w": world.colour,
      "--w2": world.glow,
      "--fill": mw.fill,
      "--rows": rows,
      "--row-h": `${ROW_REM}rem`,
   } as CSSProperties;
   const pct = Math.round(mw.fill * 100);
   const hero = world.hero ? HERO_GLB[world.hero].name : "All five heroes";
   return (
      <section className={`${styles.world} ${mw.unlocked ? "" : styles.worldLocked}`} style={style} aria-labelledby={`m2-world-${world.id}`}>
         <span className={styles.wash} aria-hidden="true" />
         <header className={styles.worldHead}>
            <span className={styles.worldNo}>W{world.id}</span>
            <div className={styles.worldText}>
               <h3 id={`m2-world-${world.id}`} className={styles.worldName}>
                  {world.name}
               </h3>
               <p className={styles.worldFeel}>
                  {world.colourName} · {hero}
               </p>
            </div>
            <div className={styles.restore} aria-label={`${world.colourName} restored ${pct} percent`}>
               <span className={styles.restoreRing} aria-hidden="true" />
               <span className={styles.restorePct}>{pct}%</span>
            </div>
         </header>
         <p className={styles.worldBlurb}>{world.feel}</p>
         <div className={styles.board}>
            <svg className={styles.trail} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
               <path d={trailPath(0, nodes.length - 1, rows)} className={styles.trailBase} vectorEffect="non-scaling-stroke" />
               {lastOpen > 0 && <path d={trailPath(0, lastOpen, rows)} className={styles.trailLit} vectorEffect="non-scaling-stroke" />}
            </svg>
            <ol className={styles.nodes}>
               {nodes.map((n, i) => (
                  <Node key={n.slug} node={n} index={i} thumb={thumbs[n.slug] ?? null} />
               ))}
            </ol>
         </div>
         <footer className={styles.worldFoot}>
            <span>
               {mw.cleared}/{nodes.length} cleared
            </span>
            <span className={styles.footStars}>
               <StarGlyph className={styles.metaStar} />
               {mw.stars}/{mw.maxStars}
            </span>
         </footer>
         {!mw.unlocked && (
            <div className={styles.gate}>
               <LockGlyph />
               <p className={styles.gateTitle}>Shadow Plates&apos; fortress is sealed</p>
               <p className={styles.gateText}>
                  Clear half of every other world to open it{toW6 > 0 ? ` (${toW6} more ${toW6 === 1 ? "game" : "games"}).` : "."}
               </p>
            </div>
         )}
      </section>
   );
}

export default function WorldMap({ games, preview = false }: WorldMapProps) {
   const { data } = useProgress();
   const [openAll, setOpenAll] = useState(preview);
   const { built, thumbs } = useMemo(() => {
      const b: Record<string, BuiltGame> = {};
      const t: Record<string, string | null> = {};
      for (const g of games) {
         b[g.slug] = { levelCount: ARCADE_LEVELS && g.levels?.length ? g.levels.length : 1 };
         t[g.slug] = g.thumbnail;
      }
      return { built: b, thumbs: t };
   }, [games]);
   const opts = { built, unlockAll: preview && openAll };
   const map = buildMap(data, opts);
   const toW6 = gamesToW6(data, opts);
   const sum = totals(data);
   const maxStars = map.reduce((n, w) => n + w.maxStars, 0);
   const lv = xpLevel(sum.xp);
   const restored = map.reduce((n, w) => n + w.cleared, 0);
   return (
      <div className={styles.map}>
         <div className={styles.top}>
            <div className={styles.story}>
               <p className={styles.eyebrow}>Menu 2 · Color Roll Heroes</p>
               <p className={styles.storyText}>
                  Shadow Plates drained the colour from the world. Roll through six worlds and bring it back, one game at a time.
               </p>
            </div>
            <ul className={styles.stats}>
               <li className={styles.stat}>
                  <StarGlyph className={styles.statStar} />
                  <span className={styles.statValue}>{sum.stars}</span>
                  <span className={styles.statLabel}>/ {maxStars} stars</span>
               </li>
               <li className={styles.stat}>
                  <span className={styles.statShard} aria-hidden="true" />
                  <span className={styles.statValue}>{sum.shards}</span>
                  <span className={styles.statLabel}>shards</span>
               </li>
               <li className={`${styles.stat} ${styles.xpStat}`} style={{ "--xp": lv.into / lv.need } as CSSProperties}>
                  <span className={styles.statValue}>Lv {lv.level}</span>
                  <span className={styles.xpBar} aria-hidden="true">
                     <span />
                  </span>
                  <span className={styles.statLabel}>{sum.xp} XP</span>
               </li>
               <li className={styles.stat}>
                  <span className={styles.statValue}>{restored}</span>
                  <span className={styles.statLabel}>/ 50 restored</span>
               </li>
            </ul>
            {preview && (
               <label className={styles.previewSwitch}>
                  <input type="checkbox" checked={openAll} onChange={(e) => setOpenAll(e.target.checked)} />
                  <span className={styles.switchTrack} aria-hidden="true" />
                  Preview: open every game
               </label>
            )}
         </div>
         <div className={styles.worlds}>
            {map.map((mw) => (
               <WorldPanel key={mw.world.id} mw={mw} thumbs={thumbs} toW6={toW6} />
            ))}
         </div>
      </div>
   );
}
