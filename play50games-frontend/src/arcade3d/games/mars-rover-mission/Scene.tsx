"use client";

// Mars Rover Mission. One useRunFrame runs rules.frame(); visuals read the run and animate on useGameTime.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, Euler, Fog, Matrix4, Quaternion, RepeatWrapping, Vector3, type Group } from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { playSfx, startLoop, useMuted, type LoopHandle } from "@/arcade3d/core/audio";
import CameraRig from "@/arcade3d/core/CameraRig";
import { SkyDome, Starfield } from "@/arcade3d/core/env";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { TargetMarkers, type MarkerTarget } from "@/arcade3d/core/hud";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed } from "@/arcade3d/core/math";
import { spring } from "@/arcade3d/core/motion";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { DynamicInstanced, Instanced, useCanvasTexture, type InstanceSpot } from "@/arcade3d/core/render";
import { HumanoidModel, cheerPose, idlePose, useHumanoidPose } from "@/arcade3d/core/rig";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS, BOULDER_HALF_H } from "./assets";
import { LEVELS, type MarsLevel } from "./levels";
import { COLORS, DAMPING, FOV, LOOK_AHEAD, SKY, aimBounds, campSpots, fogRange, laneSpots, mesaSpots, viewFor, wallSpots } from "./looks";
import { AstronautFigure, BeaconPrimitive, ChargerPrimitive, PartsInstanced, RoverPrimitive, SampleRockPrimitive, boulderParts, mesaParts, rockParts, sampleParts, useParts, wallParts, CampPrimitive } from "./Primitives";
import { BASE_PAD_RADIUS, CHARGER_PAD_RADIUS, SITE_RING_RADIUS, BOULDER_RADIUS, createRun, createStoreSync, frame, type Run } from "./rules";

const V = new Vector3();
const Q = new Quaternion();
const E = new Euler();
const S = new Vector3(1, 1, 1);
const AT = { x: 0, y: 0, z: 0 };
const RING_IDLE = new Color(COLORS.siteRing);
const RING_HOLD = new Color(COLORS.siteRingActive);
const RING_DONE = new Color(COLORS.siteRingScanned);
const PAD_IDLE = new Color(COLORS.chargerPad);
const PAD_ON = new Color(COLORS.chargerPadActive);
/** beacons and stations stand at the north edge of their ring / pad: behind a parked rover from the camera */
const BEACON_OFFSET = SITE_RING_RADIUS + 0.7;
const STATION_OFFSET = CHARGER_PAD_RADIUS + 0.7;

/** Regolith: a rust / ochre ground with soft dunes, dust grain, pebbles and a few small rimmed craters. */
function drawRegolith(ctx: CanvasRenderingContext2D, w: number, h: number) {
   let seed = 7;
   const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
   ctx.fillStyle = COLORS.ground;
   ctx.fillRect(0, 0, w, h);
   // soft dunes: wide, faint light and dark swells (tiled: drawn with wrap-around copies)
   for (let i = 0; i < 26; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const r = 60 + rnd() * 140;
      const light = i % 2 === 0;
      for (const dx of [-w, 0, w]) {
         for (const dy of [-h, 0, h]) {
            const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
            g.addColorStop(0, light ? "rgba(208, 138, 85, 0.22)" : "rgba(138, 59, 30, 0.18)");
            g.addColorStop(1, "rgba(0, 0, 0, 0)");
            ctx.fillStyle = g;
            ctx.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r);
         }
      }
   }
   // dust grain
   for (let i = 0; i < 9000; i++) {
      ctx.globalAlpha = 0.06 + rnd() * 0.1;
      ctx.fillStyle = rnd() < 0.5 ? COLORS.groundLight : COLORS.groundDark;
      ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
   }
   // pebbles
   for (let i = 0; i < 260; i++) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = COLORS.groundDark;
      ctx.beginPath();
      ctx.arc(rnd() * w, rnd() * h, 1.2 + rnd() * 2.2, 0, Math.PI * 2);
      ctx.fill();
   }
   // small craters: a shaded bowl with a lit rim on the sun side
   for (let i = 0; i < 9; i++) {
      const x = 40 + rnd() * (w - 80);
      const y = 40 + rnd() * (h - 80);
      const r = 8 + rnd() * 22;
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = COLORS.groundDark;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = COLORS.groundDust;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r, Math.PI * 0.9, Math.PI * 1.9);
      ctx.stroke();
   }
   ctx.globalAlpha = 1;
}

function LevelScene() {
   const { id, config } = useLevel<MarsLevel>();
   const level = config ?? LEVELS[1];
   const view = useFittedView(viewFor(id));
   const input = useInput();
   const fx = useFx();
   const time = useGameTime();
   const quality = useQuality();
   const muted = useMuted();
   const phase = useArcadeStore((s) => s.phase);
   const [run] = useState<Run>(() => createRun(randomSeed(), level, id));
   const sync = useMemo(createStoreSync, []);
   const aim = useRef({ x: run.rover.x, y: 0.8, z: run.rover.z - LOOK_AHEAD }).current;
   const roverGroup = useRef<Group>(null);
   const roverBody = useRef<Group>(null);
   const tray = useRef<Group>(null);
   const susp = useRef({ x: 0, v: 0 }).current;
   const engine = useRef<LoopHandle | null>(null);
   const puffAt = useRef(0);
   const bounds = useMemo(() => aimBounds(level), [level]);
   const scene = useThree((state) => state.scene);
   // the fog starts past the aim at whatever distance the camera was fitted to (looks.ts fogRange)
   useEffect(() => {
      const fog = scene.fog;
      if (!(fog instanceof Fog)) return;
      const before = { near: fog.near, far: fog.far };
      const next = fogRange(id, view.distance);
      fog.near = next.near;
      fog.far = next.far;
      return () => {
         fog.near = before.near;
         fog.far = before.far;
      };
   }, [scene, id, view.distance]);
   const markers = useRef<MarkerTarget[]>([
      { x: 0, y: 1.5, z: 0, color: COLORS.accent },
      { x: 0, y: 1.5, z: 0, color: COLORS.chargerPad, hidden: true },
   ]).current;

   const walls = useMemo(() => wallSpots(level), [level]);
   const mesas = useMemo(() => {
      const all = mesaSpots(level, id);
      return all.slice(0, scaledCount(all.length, quality.decor));
   }, [level, id, quality.decor]);
   const camp = useMemo(() => campSpots(level), [level]);
   const rockSpots = useMemo<InstanceSpot[]>(() => run.rocks.map((r) => ({ x: r.x, y: 0, z: r.z, rotY: r.rotY })), [run]);
   const beaconSpots = useMemo<InstanceSpot[]>(() => run.sites.map((s) => ({ x: s.x, y: 0, z: s.z - BEACON_OFFSET })), [run]);
   const stationSpots = useMemo<InstanceSpot[]>(() => run.chargers.map((c) => ({ x: c.x, y: 0, z: c.z - STATION_OFFSET })), [run]);
   const panelSpots = useMemo<InstanceSpot[]>(() => run.chargers.map((c) => ({ x: c.x + 2.2, y: 0, z: c.z - STATION_OFFSET - 0.3, rotY: -0.3, scale: 2.2 })), [run]);
   const lanes = useMemo(() => laneSpots(level, run.boulders), [level, run]);

   const rockFallback = useParts(rockParts);
   const sampleFallback = useParts(sampleParts);
   const boulderFallback = useParts(boulderParts);
   const wallFallback = useParts(wallParts);
   const mesaFallback = useParts(mesaParts);

   const regolith = useCanvasTexture(1024, 1024, drawRegolith);
   useMemo(() => {
      regolith.wrapS = RepeatWrapping;
      regolith.wrapT = RepeatWrapping;
      regolith.repeat.set(25, 25); // a 16 m tile
      regolith.needsUpdate = true;
   }, [regolith]);

   useEffect(() => {
      fx.warm("sparks", "smoke", "debris", "score", "confetti");
   }, [fx]);

   useEffect(() => {
      if (phase !== "playing" || muted) return;
      engine.current = startLoop("engine", { volume: 0.12, pitch: 0.7 });
      return () => {
         engine.current?.stop();
         engine.current = null;
      };
   }, [phase, muted]);

   const astronautPose = useHumanoidPose((p) => {
      if (run.over === "win") cheerPose(time.now, p);
      else idlePose(time.now, p);
   });

   useRunFrame((_state, dt) => {
      const { moveX, moveY } = input.current;
      const ev = frame(run, { moveX, moveY }, dt, useArcadeStore, sync);
      const r = run.rover;
      // the camera aims ahead along the velocity
      aim.x = Math.min(bounds.max.x, Math.max(bounds.min.x, r.x + Math.sin(r.yaw) * LOOK_AHEAD * Math.sign(r.speed || 1) * Math.min(1, Math.abs(r.speed) / 2 + 0.3)));
      aim.z = Math.min(bounds.max.z, Math.max(bounds.min.z, r.z + Math.cos(r.yaw) * LOOK_AHEAD * Math.sign(r.speed || 1) * Math.min(1, Math.abs(r.speed) / 2 + 0.3)));
      const speedAbs = Math.abs(r.speed);
      engine.current?.set({ volume: 0.1 + Math.min(1, speedAbs / 7) * 0.3, pitch: 0.7 + Math.min(1, speedAbs / 7) * 0.6 });
      if (ev.rockHit) {
         playSfx("hit");
         fx.shake(0.35);
         AT.x = r.x; AT.y = 0.6; AT.z = r.z;
         fx.burst("debris", AT, 10);
      }
      if (ev.boulderHit) {
         playSfx("boom");
         fx.shake(0.5);
         AT.x = r.x; AT.y = 0.8; AT.z = r.z;
         fx.burst("debris", AT, 16);
      }
      if (ev.siteScanned >= 0) {
         const site = run.sites[ev.siteScanned];
         playSfx(ev.centerBonus ? "combo" : "pickup");
         AT.x = site.x; AT.y = 1.2; AT.z = site.z;
         fx.burst("sparks", AT, 16);
         fx.score(AT, ev.centerBonus ? "+180" : "+120", { color: COLORS.sampleGlow });
      }
      if (ev.won) {
         playSfx("win");
         AT.x = run.basePad.x; AT.y = 1.4; AT.z = run.basePad.z;
         fx.burst("confetti", AT, 30);
         if (ev.timeBonus > 0) fx.score(AT, `+${ev.timeBonus}`, { color: COLORS.basePadActive });
      }
      if (ev.lost) playSfx("lose");
      if (speedAbs > 1.5 && time.now > puffAt.current + 0.12) {
         puffAt.current = time.now;
         AT.x = r.x - Math.sin(r.yaw) * 1.1; AT.y = 0.15; AT.z = r.z - Math.cos(r.yaw) * 1.1;
         fx.burst("smoke", AT, 2);
      }
      // markers: the next site (then the base); the nearest charger while the battery is under 30
      let best = Infinity;
      let tx = run.basePad.x;
      let tz = run.basePad.z;
      for (const s of run.sites) {
         if (s.scanned) continue;
         const d = Math.hypot(s.x - r.x, s.z - r.z);
         if (d < best) { best = d; tx = s.x; tz = s.z; }
      }
      markers[0].x = tx;
      markers[0].z = tz;
      markers[0].color = best === Infinity ? COLORS.basePad : COLORS.accent;
      markers[1].hidden = true;
      if (r.battery < 30) {
         let cb = Infinity;
         for (const c of run.chargers) {
            const d = Math.hypot(c.x - r.x, c.z - r.z);
            if (d < cb) { cb = d; markers[1].x = c.x; markers[1].z = c.z; markers[1].hidden = false; }
         }
      }
   });

   // the rover: pose, a suspension bob on a spring, the sample tray
   useFrame(() => {
      const g = roverGroup.current;
      if (g) {
         g.position.set(run.rover.x, 0, run.rover.z);
         g.rotation.y = run.rover.yaw;
      }
      const body = roverBody.current;
      if (body) {
         const bump = Math.abs(run.rover.speed) > 0.5 ? Math.sin(time.now * 17) * 0.02 * Math.min(1, Math.abs(run.rover.speed) / 4) : 0;
         spring(susp, bump - run.rover.speed * 0.004, 120, -1, Math.min(0.05, time.delta || 0));
         body.position.y = susp.x;
         body.rotation.x = -susp.x * 0.6;
      }
      if (tray.current) tray.current.visible = run.samplesScanned > 0;
   }, FRAME_PRIORITY.visuals);

   const placeRing = (i: number, m: Matrix4, color: Color) => {
      const s = run.sites[i];
      if (!s) return false;
      const pulse = s.scanned ? 1 : 1 + Math.sin(time.now * 3 + i) * 0.03;
      V.set(s.x, 0.03, s.z);
      Q.identity();
      S.set(pulse, 1, pulse);
      m.compose(V, Q, S);
      color.copy(s.scanned ? RING_DONE : s.holdTime > 0 ? RING_HOLD : RING_IDLE);
   };
   const placeSample = (i: number, m: Matrix4) => {
      const s = run.sites[i];
      if (!s || s.scanned) return false;
      const lift = s.holdTime > 0 ? s.holdTime * 0.8 : 0;
      V.set(s.x, 0.25 + lift + Math.sin(time.now * 2.2 + i) * 0.06, s.z);
      E.set(0, time.now * 0.7 + i, 0);
      Q.setFromEuler(E);
      S.set(1, 1, 1);
      m.compose(V, Q, S);
   };
   const placePad = (i: number, m: Matrix4, color: Color) => {
      const c = run.chargers[i];
      if (!c) return false;
      V.set(c.x, 0.025, c.z);
      Q.identity();
      S.set(1, 1, 1);
      m.compose(V, Q, S);
      const on = run.charging && Math.hypot(c.x - run.rover.x, c.z - run.rover.z) <= CHARGER_PAD_RADIUS;
      color.copy(on ? PAD_ON : PAD_IDLE);
   };
   const placeBoulder = (i: number, m: Matrix4) => {
      const b = run.boulders[i];
      if (!b) return false;
      // a boulder rises out of the ground at the north end of its lane (it wraps there) and sinks at the south end
      const rise = Math.min(1, (b.z - b.minZ) / 2, (b.maxZ - b.z) / 2);
      V.set(b.x, BOULDER_HALF_H * (2 * Math.max(0, rise) - 1), b.z);
      E.set(b.rolled / BOULDER_RADIUS, 0, 0);
      Q.setFromEuler(E);
      S.set(1, 1, 1);
      m.compose(V, Q, S);
   };

   const allScanned = run.samplesScanned === run.sites.length;
   const sky = SKY[id];

   return (
      <>
         <CameraRig camera={{ position: view.offset, fov: FOV, lookAt: [aim.x, aim.y, aim.z] }} follow={aim} bounds={bounds} offset={view.offset} shift={view.shift} damping={DAMPING} />
         <SkyDome top={sky.top} bottom={sky.bottom} />
         {level.lighting === "space" && <Starfield count={scaledCount(900, quality.decor)} seed={43} upperOnly />}
         <TargetMarkers targets={markers} />

         {/* the ground reaches past the fog in every direction */}
         <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}>
            <planeGeometry args={[400, 400]} />
            <meshStandardMaterial map={regolith} roughness={0.95} />
         </mesh>
         {lanes.length > 0 && (
            <Instanced spots={lanes} name="lanes">
               <boxGeometry args={[1, 0.01, 1]} />
               <meshStandardMaterial color={COLORS.lane} roughness={1} transparent opacity={0.16} depthWrite={false} />
            </Instanced>
         )}

         <group ref={roverGroup}>
            <group ref={roverBody}>
               <Model asset={ASSETS.rover} fallback={<RoverPrimitive />} />
               <group ref={tray} position={[0, 1.05, -0.65]} visible={false}>
                  <Model asset={ASSETS.sample} fallback={<SampleRockPrimitive />} />
               </group>
            </group>
         </group>

         {/* base pad: a ring that lights up once every site is scanned */}
         <mesh rotation-x={-Math.PI / 2} position={[run.basePad.x, 0.02, run.basePad.z]}>
            <circleGeometry args={[BASE_PAD_RADIUS, 40]} />
            <meshStandardMaterial color={COLORS.basePad} transparent opacity={0.25} depthWrite={false} />
         </mesh>
         <BasePadRing run={run} radius={BASE_PAD_RADIUS} lit={allScanned} />

         {/* scan sites: tinted rings (one pool), the waiting samples, a tall beacon at each ring's north edge */}
         <DynamicInstanced count={run.sites.length} update={placeRing} name="site-rings" tinted>
            <ringGeometry args={[SITE_RING_RADIUS - 0.22, SITE_RING_RADIUS, 40]} />
            <meshBasicMaterial transparent opacity={0.9} depthWrite={false} />
         </DynamicInstanced>
         <DynamicInstancedModel asset={ASSETS.sample} count={run.sites.length} update={placeSample} fallbackParts={sampleFallback} name="samples" />
         <InstancedModel asset={ASSETS.beacon} spots={beaconSpots} fallback={<BeaconPrimitive spots={beaconSpots} />} />

         {/* chargers: a tinted pad (lit while charging), the station and a solar panel at its north edge */}
         <DynamicInstanced count={run.chargers.length} update={placePad} name="charger-pads" tinted>
            <ringGeometry args={[CHARGER_PAD_RADIUS - 0.3, CHARGER_PAD_RADIUS, 36]} />
            <meshBasicMaterial transparent opacity={0.9} depthWrite={false} />
         </DynamicInstanced>
         <InstancedModel asset={ASSETS.charger} spots={stationSpots} fallback={<ChargerPrimitive spots={stationSpots} />} />
         <InstancedModel asset={ASSETS.solarPanel} spots={panelSpots} fallback={null} />

         <InstancedModel asset={ASSETS.rock} spots={rockSpots} fallback={<PartsInstanced spots={rockSpots} parts={rockFallback} name="rocks" />} />
         {run.boulders.length > 0 && (
            <DynamicInstancedModel asset={ASSETS.boulder} count={run.boulders.length} update={placeBoulder} fallbackParts={boulderFallback} name="boulders" />
         )}

         <InstancedModel asset={ASSETS.wall} spots={walls} fallback={<PartsInstanced spots={walls} parts={wallFallback} name="walls" />} />
         <InstancedModel asset={ASSETS.mesa} spots={mesas} fallback={<PartsInstanced spots={mesas} parts={mesaFallback} name="mesas" />} />

         {/* the base camp, south of the wall */}
         <Model asset={ASSETS.base} position={[camp.base.x, 0, camp.base.z]} rotation-y={camp.base.rotY} scale={camp.base.scale} fallback={<CampPrimitive kind="base" />} />
         <Model asset={ASSETS.antenna} position={[camp.antenna.x, 0, camp.antenna.z]} rotation-y={camp.antenna.rotY} scale={camp.antenna.scale} fallback={<CampPrimitive kind="antenna" />} />
         <InstancedModel asset={ASSETS.crate} spots={camp.crates} fallback={null} />
         {id === 1 && <Model asset={ASSETS.capsule} position={[camp.capsule.x, 0, camp.capsule.z]} scale={camp.capsule.scale} fallback={<CampPrimitive kind="capsule" />} />}
         <group position={[camp.astronaut.x, 0, camp.astronaut.z]}>
            <HumanoidModel asset={ASSETS.astronaut} pose={astronautPose} fallback={<AstronautFigure />} />
         </group>
      </>
   );
}

/** The base pad's rim: dim until every site is scanned, then lit (one mesh, its material updated per frame). */
function BasePadRing({ run, radius, lit }: { run: Run; radius: number; lit: boolean }) {
   const mat = useRef<import("three").MeshBasicMaterial>(null);
   const time = useGameTime();
   useFrame(() => {
      if (!mat.current) return;
      const on = run.samplesScanned === run.sites.length;
      mat.current.opacity = on ? 0.75 + Math.sin(time.now * 5) * 0.2 : 0.5;
      mat.current.color.set(on ? COLORS.basePadActive : COLORS.basePad);
   });
   return (
      <mesh rotation-x={-Math.PI / 2} position={[run.basePad.x, 0.03, run.basePad.z]}>
         <ringGeometry args={[radius - 0.25, radius, 48]} />
         <meshBasicMaterial ref={mat} color={lit ? COLORS.basePadActive : COLORS.basePad} transparent opacity={0.5} depthWrite={false} />
      </mesh>
   );
}

export default function Scene() {
   return <LevelScene />;
}
