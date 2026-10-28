"use client";

// Mars Rover Mission. One useRunFrame runs rules.frame(); everything else is visual: a chase camera behind
// the rover (left on the stick is left on screen), the terrain, the sky, the mission objects with their
// light pillars, the hazards, the rover's actions (drill, scanner beam) and the delivery celebration.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Fog } from "three";
import { playSfx, startLoop, useMuted, type LoopHandle } from "@/arcade3d/core/audio";
import ChaseRig from "@/arcade3d/core/ChaseRig";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { TargetMarkers, type MarkerTarget } from "@/arcade3d/core/hud";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed } from "@/arcade3d/core/math";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { GOAL, TOAST } from "./Hud";
import { LEVELS, type MarsLevel } from "./levels";
import { CHASE, COLORS, FOG, FOV, MISSION_COLOR, ORBIT_SPEED, fogAt } from "./looks";
import { Rover } from "./Rover";
import { CHARGER_PAD_RADIUS, SCAN_HOLD_S, axis, createRun, createStoreSync, frame, type Run } from "./rules";
import { DustStorm, MarsSky } from "./Sky";
import { Sites, type Guide } from "./Sites";
import { Terrain } from "./Ground";
import { flatsFor, makeHeight } from "./terrain";
import { createVis } from "./visual";
import { Decor, DustTrail, GuideArrow, Hazards, Tracks } from "./World";

const AT = { x: 0, y: 0, z: 0 };

function LevelScene() {
   const { id, config } = useLevel<MarsLevel>();
   const level = config ?? LEVELS[1];
   const input = useInput();
   const fx = useFx();
   const time = useGameTime();
   const muted = useMuted();
   const phase = useArcadeStore((s) => s.phase);
   const [run] = useState<Run>(() => createRun(randomSeed(), level, id));
   const sync = useMemo(createStoreSync, []);
   const height = useMemo(() => makeHeight(level, id, flatsFor(run), run.boulders.map((b) => b.x)), [level, id, run]);
   const vis = useRef(createVis()).current;
   const guide = useRef<Guide>({ target: -1, lowBattery: false, allDone: false }).current;
   const goal = useRef<{ x: number; z: number; color: string; on: boolean }>({ x: 0, z: 0, color: COLORS.accent, on: true }).current;
   const doneAt = useMemo(() => new Float32Array(run.sites.length).fill(-1), [run]);
   const cam = useRef({ x: run.rover.x, y: 0, z: run.rover.z, yaw: run.rover.yaw }).current;
   const orbit = useRef({ value: 0 }).current;
   const storm = useRef({ value: 0 }).current;
   const hud = useRef({ dist: -1, goal: -1, work: -1, toastN: 0, low: false }).current;
   const engine = useRef<LoopHandle | null>(null);
   const hum = useRef<LoopHandle | null>(null);
   const sparkAt = useRef(0);
   const scene = useThree((s) => s.scene);
   const markers = useRef<MarkerTarget[]>([
      { x: 0, y: 2, z: 0, color: MISSION_COLOR[level.mission] },
      { x: 0, y: 2, z: 0, color: COLORS.chargerPad, hidden: true },
   ]).current;

   const toast = (code: number) => {
      const s = useArcadeStore.getState();
      s.setStat("toast", code);
      s.setStat("toastN", ++hud.toastN);
   };

   // fog: the haze per level; L4's storm closes in as the clock runs down
   useEffect(() => {
      const fog = scene.fog;
      if (!(fog instanceof Fog)) return;
      const before = { near: fog.near, far: fog.far, color: fog.color.getHex() };
      fog.color.set(FOG[id].color);
      fog.near = FOG[id].near;
      fog.far = FOG[id].far;
      return () => {
         fog.near = before.near;
         fog.far = before.far;
         fog.color.setHex(before.color);
      };
   }, [scene, id]);

   useEffect(() => {
      fx.warm("sparks", "sparkle", "debris", "puff", "confetti", "smoke");
   }, [fx]);

   useEffect(() => {
      if (phase !== "playing" || muted) return;
      engine.current = startLoop("engine", { volume: 0.1, pitch: 0.6 });
      hum.current = startLoop("hum", { volume: 0, pitch: 1.4 });
      return () => {
         engine.current?.stop();
         hum.current?.stop();
         engine.current = null;
         hum.current = null;
      };
   }, [phase, muted]);

   useRunFrame((_state, dt) => {
      const { moveX, moveY } = input.current;
      const ev = frame(run, { moveX, moveY }, dt, useArcadeStore, sync);
      const r = run.rover;
      const store = useArcadeStore.getState();
      const k = 1 - Math.exp(-10 * dt);
      vis.steer += (axis(moveX) - vis.steer) * k;
      vis.throttle += (-axis(moveY) - vis.throttle) * k;
      const speedAbs = Math.abs(r.speed);
      engine.current?.set({ volume: 0.08 + Math.min(1, speedAbs / 7) * 0.28, pitch: 0.6 + Math.min(1, speedAbs / 7) * 0.7 });

      // the site being worked, its progress and the beam's target
      vis.active = -1;
      vis.progress = 0;
      for (const s of run.sites) {
         if (s.scanned || s.holdTime <= 0) continue;
         vis.active = s.index;
         vis.progress = Math.min(1, s.holdTime / SCAN_HOLD_S);
         const prop = run.props.find((p) => p.site === s.index);
         vis.beamX = prop ? prop.x : s.x;
         vis.beamZ = prop ? prop.z : s.z;
         vis.beamY = height(vis.beamX, vis.beamZ) + (prop?.kind === "beacon" ? 2.2 : prop?.kind === "relic" ? 1.7 : 0.6);
      }
      hum.current?.set({ volume: vis.active >= 0 ? 0.18 : 0, pitch: 1.1 + vis.progress * 0.9 });
      if (vis.active >= 0 && time.now > sparkAt.current + 0.09) {
         sparkAt.current = time.now;
         if (level.mission === "crystal") {
            AT.x = r.x;
            AT.y = height(r.x, r.z) + 0.15;
            AT.z = r.z;
            fx.burst("sparkle", AT, 2);
            fx.burst("puff", AT, 1);
         } else {
            AT.x = vis.beamX;
            AT.y = vis.beamY;
            AT.z = vis.beamZ;
            fx.burst(level.mission === "panel" ? "sparks" : "sparkle", AT, 3);
         }
      }

      // events: hits, falls, scans, the win
      if (ev.rockHit) {
         playSfx("hit");
         fx.shake(0.35);
         AT.x = r.x; AT.y = height(r.x, r.z) + 0.6; AT.z = r.z;
         fx.burst("debris", AT, 10);
         toast(TOAST.rock);
      }
      if (ev.boulderHit) {
         playSfx("boom");
         fx.shake(0.55);
         AT.x = r.x; AT.y = height(r.x, r.z) + 0.8; AT.z = r.z;
         fx.burst("debris", AT, 16);
         toast(TOAST.boulder);
      }
      if (ev.propBump) {
         playSfx("thud");
         fx.shake(0.15);
      }
      if (ev.fell) {
         playSfx("whoosh", { pitch: 0.6 });
         playSfx("thud");
         fx.shake(0.6);
         AT.x = r.x; AT.y = height(r.x, r.z) + 0.3; AT.z = r.z;
         fx.burst("puff", AT, 12);
         toast(TOAST.fell);
      }
      if (ev.siteScanned >= 0) {
         const site = run.sites[ev.siteScanned];
         doneAt[site.index] = time.now;
         playSfx(ev.centerBonus ? "combo" : "chime");
         const prop = run.props.find((p) => p.site === site.index);
         AT.x = prop ? prop.x : site.x;
         AT.y = height(AT.x, prop ? prop.z : site.z) + (prop ? 2 : 1);
         AT.z = prop ? prop.z : site.z;
         fx.burst("sparkle", AT, 22);
         fx.burst("sparks", AT, 12);
         fx.score(AT, ev.centerBonus ? "+180 PERFECT" : "+120", { color: ev.centerBonus ? "#fde047" : "#fef3c7", size: 0.08 });
         fx.shake(0.12);
         if (level.mission === "crystal") {
            vis.flyT = 0;
            vis.flySite = site.index;
            vis.carried += 1;
         }
         toast(run.samplesScanned === run.sites.length ? TOAST.allDone : ev.centerBonus ? TOAST.perfect : TOAST.done);
      }
      if (ev.won) {
         playSfx("win");
         vis.winT = 0;
         const lander = run.props.find((p) => p.kind === "lander");
         AT.x = lander ? lander.x : run.basePad.x;
         AT.y = height(AT.x, run.basePad.z) + 3;
         AT.z = lander ? lander.z : run.basePad.z;
         fx.burst("confetti", AT, 40);
         fx.burst("sparkle", AT, 24);
         if (ev.timeBonus > 0) fx.score(AT, `+${ev.timeBonus} time bonus`, { color: COLORS.basePadActive, size: 0.08 });
         toast(TOAST.delivered);
      }
      if (ev.lost) playSfx("lose");
      if (run.charging && r.battery >= 99.9 && !hud.low) {
         hud.low = true;
         toast(TOAST.full);
         playSfx("pickup", { pitch: 1.4 });
      }
      if (!run.charging) hud.low = false;

      // the guide: the nearest site still to do, then the base; the nearest charger while the battery is low
      let best = Infinity;
      let target = -1;
      for (const s of run.sites) {
         if (s.scanned) continue;
         const d = Math.hypot(s.x - r.x, s.z - r.z);
         if (d < best) {
            best = d;
            target = s.index;
         }
      }
      guide.target = target;
      guide.allDone = target < 0;
      guide.lowBattery = r.battery < 30;
      let gx = target >= 0 ? run.sites[target].x : run.basePad.x;
      let gz = target >= 0 ? run.sites[target].z : run.basePad.z;
      let goalKind: number = target >= 0 ? GOAL.site : GOAL.base;
      goal.color = target >= 0 ? MISSION_COLOR[level.mission] : COLORS.basePadActive;
      markers[0].x = gx;
      markers[0].z = gz;
      markers[0].y = height(gx, gz) + 2;
      markers[0].color = goal.color;
      markers[1].hidden = true;
      if (guide.lowBattery) {
         let cb = Infinity;
         for (const c of run.chargers) {
            const d = Math.hypot(c.x - r.x, c.z - r.z);
            if (d < cb) {
               cb = d;
               markers[1].x = c.x;
               markers[1].z = c.z;
               markers[1].y = height(c.x, c.z) + 2;
               markers[1].hidden = false;
            }
         }
         // the battery comes first: point the arrow at the pad until it is charged
         if (!(run.charging && cb <= CHARGER_PAD_RADIUS)) {
            gx = markers[1].x;
            gz = markers[1].z;
            goalKind = GOAL.charger;
            goal.color = COLORS.chargerPad;
         }
      }
      goal.x = gx;
      goal.z = gz;
      const dist = Math.round(Math.hypot(gx - r.x, gz - r.z));
      if (dist !== hud.dist) store.setStat("dist", (hud.dist = dist));
      if (goalKind !== hud.goal) store.setStat("goal", (hud.goal = goalKind));
      const work = vis.active >= 0 ? Math.round(vis.progress * 20) * 5 : 0;
      if (work !== hud.work) store.setStat("work", (hud.work = work));
      storm.value = Math.min(1, run.time / (level.durationMs / 1000));
   });

   // visuals: the camera's target, the win orbit, the crystal flight, the storm's fog
   useFrame(() => {
      const dt = Math.min(0.05, time.delta || 0);
      const r = run.rover;
      cam.x = r.x;
      cam.z = r.z;
      cam.y = height(r.x, r.z) + 0.6;
      cam.yaw = r.yaw;
      if (vis.winT >= 0) {
         vis.winT += dt;
         orbit.value += dt * ORBIT_SPEED * Math.min(1, vis.winT);
      }
      if (vis.flyT >= 0 && vis.flyT < 1) vis.flyT = Math.min(1, vis.flyT + dt / 0.5);
      if (level.storm && scene.fog instanceof Fog) {
         const f = fogAt(id, level, storm.value);
         scene.fog.near = f.near;
         scene.fog.far = f.far;
      }
   }, FRAME_PRIORITY.visuals);

   return (
      <>
         <ChaseRig target={cam} options={CHASE} ground={height} yawOffset={orbit} fov={FOV} />
         <MarsSky id={id} level={level} />
         {level.storm && <DustStorm share={storm} />}
         {level.lighting === "night" && <hemisphereLight args={["#6d7fc4", "#2a120a", 0.35]} />}
         {level.storm && <hemisphereLight args={["#f4b07a", "#3b1a10", 0.35]} />}
         <TargetMarkers targets={markers} />
         <Terrain level={level} height={height} />
         <Rover run={run} vis={vis} level={level} height={height} />
         <Sites run={run} vis={vis} level={level} height={height} guide={guide} doneAt={doneAt} />
         <Hazards run={run} level={level} height={height} />
         <Decor run={run} level={level} id={id} height={height} />
         <DustTrail run={run} height={height} />
         <Tracks run={run} height={height} />
         <GuideArrow run={run} height={height} goal={goal} vis={vis} />
      </>
   );
}

export default function Scene() {
   return <LevelScene />;
}
