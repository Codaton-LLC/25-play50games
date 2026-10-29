"use client";

// The game HUD: the lap and beacon count, orbs, the speed pill (it glows red on a red lane), the hero
// power and the flow meter on the left; the title and level, the run clock (the orb and flow bonus
// taken off), level 1's coach line for its three beats and each level's twist line, and on level 5
// Greyout's health bar with its hint in the centre. The mini-map (your red network, the lit beacon,
// you, Greyout) top right and an arrow at the screen's edge toward the beacon when it is off screen
// (the card's fix for an open city on a phone). The shell keeps Mute / Pause; its clock chip is off.
// Local multiplayer: the "2-4 players" button, the join screen, per-player chips, the podium. The
// shared hero picker shows between runs; the orbit camera's recenter button and hint (OrbitHud).
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
import { STAT, V_RED, beaconPoint, litBeacon, runTimeMs } from "./rules";
import { CELL } from "./city";
import type { CitySpec } from "./levels";
import { COMBO, GREYOUT } from "./progression";
import { MultiplayerHud, MultiplayerButton } from "./MultiplayerHud";
import { hudFeed } from "./hudFeed";
import { COLORS } from "./look";
import stack from "@/arcade3d/menu2/hud/HudStack.module.css";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.floor(ms / 1000);
   const tenths = Math.floor((ms % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

const HERO_STAT: HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];

/** One short line per beat or twist (teach by playing, no text walls); null when nothing to say. */
export function coachLine(level: number, beacons: number, perLap: number, lap: number): string | null {
   if (level === 1) {
      if (beacons === 0) return "Run to the red beacon";
      if (beacons === 1) return "Cut through the cones, or take the clear avenue";
      if (lap >= 1 && beacons <= perLap + 1) return "Lap 2: your red streets are 30 % faster";
      return null;
   }
   if (level === 2 && beacons % perLap === 0) return "The beacon rides the bus: jump off the ramp onto its roof";
   if (level === 3 && beacons === 0) return "Gates turn red every 4 s: meet the green";
   if (level === 4 && beacons < perLap) return "Scout lap: build a loop you can race on";
   return null;
}

/** The boss's hint per phase (what opens it). */
export function bossHint(phase: number, open: boolean): string {
   if (phase === 0) return open ? "Off the ramp onto its roof brushes!" : "Get to the ramp it is heading for";
   if (phase === 1) return open ? "Roll down the red avenue into its valves!" : "Dodge the drones, keep a red lane";
   return open ? "Lead it under a gate as the light turns red!" : "It is hunting you: keep moving";
}

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? GREYOUT.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const on = useArcadeStore((s) => (s.stats[STAT.bossOn] ?? 0) === 1);
   if (!on) return null;
   return (
      <div className={stack.boss}>
         <BossHealthBar name={GREYOUT.name} phaseName={GREYOUT.phases[phase]?.name} hp={hp} maxHp={GREYOUT.maxHp} marks={phaseMarks(GREYOUT)} vulnerable={open} flash={flash} accent="#94a3b8" />
         {hp > 0 ? <div className={stack.hint}>{bossHint(phase, open)}</div> : null}
      </div>
   );
}

/** The mini-map: the city turned with the camera (up = where the camera looks). */
function MiniMap() {
   const canvas = useRef<HTMLCanvasElement>(null);
   const playing = useArcadeStore((s) => s.phase === "playing" || s.phase === "countdown" || s.phase === "paused");
   useEffect(() => {
      if (!playing) return;
      let raf = 0;
      const pt = { x: 0, y: 0, z: 0 };
      const draw = () => {
         raf = requestAnimationFrame(draw);
         const cv = canvas.current;
         const run = hudFeed.run;
         if (!cv || !run) return;
         const dpr = Math.min(2, window.devicePixelRatio || 1);
         const w = cv.clientWidth;
         if (cv.width !== Math.round(w * dpr)) {
            cv.width = Math.round(w * dpr);
            cv.height = Math.round(w * dpr);
         }
         const ctx = cv.getContext("2d");
         if (!ctx) return;
         const c = run.course;
         const span = Math.max(c.maxX - c.minX, c.maxZ - c.minZ) + 6;
         const k = (w * dpr) / span;
         const cx = (c.minX + c.maxX) / 2;
         const cz = (c.minZ + c.maxZ) / 2;
         ctx.setTransform(1, 0, 0, 1, 0, 0);
         ctx.clearRect(0, 0, cv.width, cv.height);
         // camera forward = (-sin yaw, -cos yaw) points up on the map
         const yaw = hudFeed.yaw;
         ctx.translate(cv.width / 2, cv.height / 2);
         ctx.rotate(Math.PI - yaw);
         ctx.scale(k, k);
         ctx.translate(-cx, -cz);
         // the map is drawn with +z down; rotate(π - yaw) turns the camera's forward up
         for (const b of c.blocks) {
            ctx.fillStyle = b.kind === "plaza" ? "#a8977f" : b.kind === "ghost" ? "#6d28d9" : b.kind === "site" ? (run.siteOpen ? "#57534e" : "#b45309") : b.kind === "lot" ? "#44403c" : "#1f2937";
            ctx.fillRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0);
         }
         ctx.lineCap = "round";
         for (let i = 0; i < c.edges.length; i++) {
            const e = c.edges[i];
            const painted = run.painted[i] === 1;
            const leg = run.leg[i] === 1;
            ctx.strokeStyle = painted ? COLORS.lane : leg ? COLORS.leg : "rgba(255,255,255,0.28)";
            ctx.lineWidth = painted ? 3 : leg ? 2 : 1.2;
            ctx.beginPath();
            ctx.moveTo(e.ax, e.az);
            ctx.lineTo(e.bx, e.bz);
            ctx.stroke();
         }
         if (c.rail) {
            ctx.strokeStyle = "rgba(251, 113, 133, 0.8)";
            ctx.lineWidth = 0.8;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(c.rail.ax, c.rail.az);
            ctx.lineTo(c.rail.bx, c.rail.bz);
            ctx.stroke();
            ctx.setLineDash([]);
         }
         if (run.boss && run.boss.hp > 0) {
            ctx.fillStyle = "#cbd5e1";
            ctx.save();
            ctx.translate(run.truck.x, run.truck.z);
            ctx.rotate(-run.truck.yaw);
            ctx.fillRect(-1.7, -3.2, 3.4, 6.4);
            ctx.restore();
         }
         const done = !c.boss && run.beaconIndex >= c.laps * c.beacons.length;
         if (!done) {
            beaconPoint(run, litBeacon(run), pt);
            const pulse = 2.2 + Math.sin(performance.now() / 160) * 0.6;
            ctx.fillStyle = "#ef4444";
            ctx.beginPath();
            ctx.arc(pt.x, pt.z, pulse, 0, Math.PI * 2);
            ctx.fill();
         }
         const h = run.hero;
         ctx.fillStyle = "#ffffff";
         ctx.beginPath();
         ctx.arc(h.x, h.z, 1.7, 0, Math.PI * 2);
         ctx.fill();
         void CELL;
      };
      raf = requestAnimationFrame(draw);
      return () => cancelAnimationFrame(raf);
   }, [playing]);
   if (!playing) return null;
   return (
      <div className={styles.map} data-arcade-safe-area="" aria-hidden="true">
         <canvas ref={canvas} />
      </div>
   );
}

/** An arrow at the screen's edge toward the lit beacon while it is off screen. */
function EdgeArrow() {
   const el = useRef<HTMLDivElement>(null);
   const playing = useArcadeStore((s) => s.phase === "playing");
   useEffect(() => {
      if (!playing) return;
      let raf = 0;
      const tick = () => {
         raf = requestAnimationFrame(tick);
         const d = el.current;
         if (!d) return;
         if (!hudFeed.edge) {
            d.style.display = "none";
            return;
         }
         const a = hudFeed.angle;
         const rx = window.innerWidth / 2 - 40;
         const ry = window.innerHeight / 2 - 70;
         const cx = Math.cos(a);
         const cy = Math.sin(a);
         const t = Math.min(rx / Math.max(1e-6, Math.abs(cx)), ry / Math.max(1e-6, Math.abs(cy)));
         d.style.display = "block";
         d.style.transform = `translate(${cx * t}px, ${-cy * t}px) rotate(${-a}rad)`;
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
   }, [playing]);
   if (!playing) return null;
   return (
      <div ref={el} className={styles.edge} style={{ display: "none" }} aria-hidden="true">
         <span />
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<CitySpec>();
   const level = config?.id ?? 1;
   const laps = config?.laps ?? 2;
   const perLap = config?.beacons.length ?? 4;
   const boss = !!config?.boss;
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const mainOrbs = useArcadeStore((s) => s.stats[STAT.mainOrbs] ?? 0);
   const lap = useArcadeStore((s) => s.stats[STAT.lap] ?? 0);
   const beacons = useArcadeStore((s) => s.stats[STAT.beacons] ?? 0);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const powerLeft = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const speed = useArcadeStore((s) => (s.stats[STAT.speed] ?? 0) / 10);
   const red = useArcadeStore((s) => (s.stats[STAT.red] ?? 0) === 1);
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const comboMs = useArcadeStore((s) => s.stats[STAT.comboMs] ?? 0);
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => s.stats[STAT.comboMult] ?? 100);
   const flow = useArcadeStore((s) => s.stats[STAT.comboFlow] ?? 0);
   const playingPhase = useArcadeStore((s) => s.phase === "playing" || s.phase === "countdown");
   const shown = runTimeMs(tenths * 100, orbs, comboMs);
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined ? pick : HERO_STAT[heroStat] ?? "riko");
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   const mainTotal = config ? config.orbs.filter((o) => o.main).length : 0;
   const coach = playingPhase && !boss ? coachLine(level, beacons, perLap, lap) : null;
   const speedFrac = Math.max(0, Math.min(1, speed / V_RED));
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         {!playing ? <MiniMap /> : null}
         {!playing ? <EdgeArrow /> : null}
         <div className={stack.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            {boss ? null : (
               <div className={styles.pill} aria-label={`Lap ${lap + 1} of ${laps}, beacon ${(beacons % perLap) + 1} of ${perLap}`}>
                  <span className={styles.beaconDot} aria-hidden="true" />
                  <span className={styles.value}>
                     {Math.min(laps, lap + 1)}/{laps}
                  </span>
                  <span className={styles.unit}>
                     ◆ {beacons >= laps * perLap ? perLap : (beacons % perLap) + 1}/{perLap}
                  </span>
               </div>
            )}
            <div className={styles.pill} aria-label={`Orbs ${mainOrbs} of ${mainTotal}, ${orbs} in all`}>
               <span className={styles.orb} aria-hidden="true" />
               <span className={styles.value}>
                  {mainOrbs}/{mainTotal}
               </span>
               {orbs > mainOrbs ? <span className={styles.unit}>+{orbs - mainOrbs}</span> : null}
            </div>
            <div className={`${styles.pill} ${red ? styles.red : ""}`} aria-label={`Speed ${speed.toFixed(1)} metres a second${red ? ", on a red lane" : ""}`}>
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 17 L11 7 L13 11 L20 5" fill="none" stroke={red ? "#f87171" : "#fff"} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 20 H21" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
               </svg>
               <span className={styles.value} style={{ width: 34, display: "inline-block" }}>
                  {speed.toFixed(1)}
               </span>
               <span className={styles.unit} style={{ opacity: speedFrac > 0.95 ? 1 : 0.6 }}>
                  m/s
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
               <span className={styles.title}>Color City Sprint</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "Red Block"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Run time">
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <path d="M12 13 L12 8.5 M9.5 3 H14.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{clockText(shown)}</span>
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
