"use client";

// One useRunFrame steps rules.ts. Visuals read the run and animate with useGameTime.
// Real metres (rules.ts U): a 4.55 m cab on a 6.5 m road between raised pavements, a 1.75 m rider.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, Matrix4, MeshStandardMaterial, Quaternion, RepeatWrapping, Shape, ShapeGeometry, SphereGeometry, Vector3, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { InstancedModel, Model } from "@/arcade3d/core/assets";
import { playSfx, startLoop, type LoopHandle } from "@/arcade3d/core/audio";
import CameraRig from "@/arcade3d/core/CameraRig";
import { useCameraViews } from "@/arcade3d/core/camera/CameraViews";
import { SkyDome } from "@/arcade3d/core/env";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { TargetMarkers } from "@/arcade3d/core/hud";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed } from "@/arcade3d/core/math";
import { hop, type BodyOffset } from "@/arcade3d/core/motion";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { DynamicInstanced, Instanced, useCanvasTexture, type InstancePart, type InstanceSpot } from "@/arcade3d/core/render";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS, FIT } from "./assets";
import { CoinPop, GuideArrow, PaintReflections, TyreSmoke, useCoinPop } from "./Effects";
import type { TaxiLevel } from "./levels";
import { COLORS, DAMPING, FOV, KERB, LOOK_AHEAD, RIDER_SIDE, citySpots, cityBox, coneSpots, drawAsphalt, drawFacade, drawPaving, lightPoles, lookAtFor, skyFor, stopBars, viewFor } from "./looks";
import { PartsInstanced, RiderPrimitive, useCityParts } from "./Primitives";
import { CALM_POINTS, CLOSE_POINTS, DROP_POINTS, PAD_R, TOP_SPEED, U, createRun, signalRed, step, type Run } from "./rules";
import { Vehicles, type CabState } from "./Vehicles";

const Q = new Quaternion();
const V = new Vector3();
const S = new Vector3(1, 1, 1);
const AT = { x: 0, y: 0, z: 0 };
const OFF: BodyOffset = { y: 0, roll: 0, yaw: 0, squash: 1 };
const RED = new Color(COLORS.bulbRed);
const GREEN = new Color(COLORS.bulbGreen);
/** The signal bulb's height on the fitted traffic light (0.91 of the pole). */
const BULB_Y = KERB + FIT.lightHeight * 0.91;

function LevelScene() {
   const { id, config } = useLevel<TaxiLevel>();
   const view = useFittedView(viewFor(id));
   const input = useInput();
   const fx = useFx();
   const time = useGameTime();
   const quality = useQuality();
   const run = useMemo<Run>(() => createRun(randomSeed(), config), [config]);
   // The fitted follow camera is already the classic chase view.
   // TaxiInput has no yaw: the stick always steers the cab itself.
   useCameraViews({
      slug: "taxi-rush-3d",
      subject: "vehicle",
      steering: "vehicle",
      defaultYaw: view.yaw,
      views: ["default", "front", "top", "free"],
      framing: { top: { distance: 20 * U } },
      target: (o) => {
         o.x = run.x;
         o.y = 1.2;
         o.z = run.z;
         o.heading = run.yaw;
         o.vx = Math.sin(run.yaw) * run.speed;
         o.vz = Math.cos(run.yaw) * run.speed;
      },
      solids: (out) => {
         const count = Math.min(out.length, run.buildings.length);
         for (let i = 0; i < count; i++) {
            Object.assign(out[i].min, run.buildings[i].min);
            Object.assign(out[i].max, run.buildings[i].max);
         }
         return count;
      },
   });
   const aim = useRef({ x: run.x, y: 1.1, z: run.z + LOOK_AHEAD }).current;
   const cab = useRef<CabState>({ steer: 0, roll: 0 }).current;
   const rider = useRef<Group>(null);
   const pad = useRef<Mesh>(null);
   const padFill = useRef<Mesh>(null);
   const engine = useRef<LoopHandle | null>(null);
   const synced = useRef({ rides: -1, fare: -1 }).current;
   const bounds = useMemo(() => cityBox(config), [config]);
   const look = useMemo(() => lookAtFor(config), [config]);
   const sky = useMemo(() => skyFor(config), [config]);
   const city = useMemo(() => citySpots(id), [id]);
   const trees = useMemo(() => city.trees.slice(0, scaledCount(city.trees.length, quality.decor)), [city, quality.decor]);
   const lamps = useMemo(() => city.lamps.slice(0, scaledCount(city.lamps.length, quality.decor)), [city, quality.decor]);
   const poles = useMemo(() => lightPoles(run), [run]);
   const bars = useMemo(() => stopBars(run), [run]);
   const asphalt = useCanvasTexture(256, 256, drawAsphalt);
   const paving = useCanvasTexture(128, 128, drawPaving);
   const facade = useCanvasTexture(128, 128, drawFacade);
   const ground = 440 * U;
   useMemo(() => {
      asphalt.wrapS = RepeatWrapping;
      asphalt.wrapT = RepeatWrapping;
      asphalt.repeat.set(ground / 6, ground / 6);
      asphalt.anisotropy = 4;
      asphalt.needsUpdate = true;
      paving.wrapS = RepeatWrapping;
      paving.wrapT = RepeatWrapping;
      // one tile = 4 x 4 slabs of 0.75 m over the 26 m pavement block
      paving.repeat.set(8.7, 8.7);
      paving.anisotropy = 4;
      paving.needsUpdate = true;
   }, [asphalt, paving, ground]);
   // the night level keeps a lighter asphalt so the streets never read as a void under its dim light
   const night = config.lighting === "night";
   // night only: warm pools of light on the road under every street lamp and signal pole
   const pools = useMemo<InstanceSpot[]>(() => {
      if (!night) return [];
      const at = [...city.lamps, ...poles];
      return at.map((p) => ({ x: p.x, y: KERB + 0.02, z: p.z, sx: 13, sy: 1, sz: 13 }));
   }, [night, city.lamps, poles]);
   const cones = useMemo(() => coneSpots(run), [run]);
   // the off-screen marker, gold for the pickup and green for the drop-off
   const marker = useRef<{ x: number; y: number; z: number; hidden: boolean; color: string }>({ x: 0, y: 1, z: 0, hidden: true, color: COLORS.pad }).current;
   const markers = useMemo(() => [marker], [marker]);
   const parts = useCityParts();
   const { coins, pop } = useCoinPop();

   // a painted one-way arrow, 1.3 m wide and 3.4 m long, its tip along +z
   const arrowGeo = useMemo(() => {
      const s = new Shape();
      s.moveTo(0, 1.7);
      s.lineTo(0.65, 0.5);
      s.lineTo(0.22, 0.5);
      s.lineTo(0.22, -1.7);
      s.lineTo(-0.22, -1.7);
      s.lineTo(-0.22, 0.5);
      s.lineTo(-0.65, 0.5);
      s.closePath();
      return new ShapeGeometry(s).rotateX(-Math.PI / 2).rotateY(Math.PI);
   }, []);
   useEffect(() => () => arrowGeo.dispose(), [arrowGeo]);

   const bulbParts = useMemo<InstancePart[]>(() => [{ geometry: new SphereGeometry(0.22, 12, 10), material: new MeshStandardMaterial({ color: "#ffffff", emissive: "#ffffff", emissiveIntensity: 0.9, roughness: 0.3 }) }], []);
   useEffect(
      () => () => {
         bulbParts[0].geometry.dispose();
         (bulbParts[0].material as MeshStandardMaterial).dispose();
      },
      [bulbParts]
   );

   useEffect(() => {
      fx.warm("sparkle", "puff", "confetti", "sparks", "score");
   }, [fx]);

   useEffect(() => {
      engine.current = startLoop("engine", { volume: 0.04, pitch: 0.7 });
      return () => {
         engine.current?.stop();
         engine.current = null;
      };
   }, []);

   useRunFrame((_state, dt) => {
      const store = useArcadeStore.getState();
      const ev = step(run, { moveX: input.current.moveX, moveY: input.current.moveY }, dt, store.timeLeftMs ?? 0);
      if (ev.score) store.addScore(ev.score);
      const fare = Math.round(Math.max(0, run.patience) * 100);
      if (synced.rides !== run.dropoffs) store.setStat("rides", (synced.rides = run.dropoffs));
      if (synced.fare !== fare) store.setStat("fare", (synced.fare = fare));
      const dir = run.speed < -0.2 ? -1 : 1;
      aim.x = Math.min(bounds.max.x, Math.max(bounds.min.x, run.x + Math.sin(run.yaw) * dir * LOOK_AHEAD));
      aim.z = Math.min(bounds.max.z, Math.max(bounds.min.z, run.z + Math.cos(run.yaw) * dir * LOOK_AHEAD));
      if (ev.pickup) {
         AT.x = run.riderX + RIDER_SIDE;
         AT.y = 1.4;
         AT.z = run.riderZ;
         fx.burst("sparkle", AT, 14);
         AT.x = run.x;
         AT.z = run.z;
         AT.y = 2.2;
         fx.score(AT, "Hop in!", { color: COLORS.pad });
         playSfx("click");
      }
      if (ev.drop) {
         AT.x = run.x;
         AT.y = 2.4;
         AT.z = run.z;
         fx.burst("sparkle", AT, 18);
         fx.burst("sparks", AT, 10);
         fx.score(AT, `+${DROP_POINTS + (ev.close ? CLOSE_POINTS : 0) + (ev.calm ? CALM_POINTS : 0)}`, { color: COLORS.pad });
         pop(run.x, run.z);
         playSfx(ev.close ? "combo" : "chime");
      }
      if (ev.hit || ev.red) {
         AT.x = run.x;
         AT.y = 1.1;
         AT.z = run.z;
         fx.burst("puff", AT, 12);
         fx.shake(ev.hit ? 0.3 : 0.18);
         playSfx(ev.red ? "alarm" : "hit");
      }
      if (ev.miss) playSfx("buzz");
      for (let n = 0; n < ev.lives; n++) store.loseLife();
      if (ev.won) {
         playSfx("win");
         fx.burst("confetti", { x: run.x, y: 2.6, z: run.z }, 28);
         store.end("win");
      }
   });

   useFrame(() => {
      const person = rider.current;
      if (person) {
         const hopping = run.hop > 0 && run.hop < Math.PI;
         person.visible = run.phase === 0 || hopping;
         if (hopping) hop(run.hop, 0.32, OFF);
         else {
            OFF.y = 0;
            OFF.squash = 1;
         }
         // the rider waits on the pavement beside the pad, facing the street
         person.position.set(run.riderX + RIDER_SIDE, KERB + OFF.y, run.riderZ);
         person.rotation.y = -Math.PI / 2;
         person.scale.set(1, OFF.squash, 1);
      }
      const show = !run.marker.hidden && run.phase !== 2;
      const tone = run.phase === 1 ? COLORS.dropPad : COLORS.pad;
      marker.x = run.marker.x;
      marker.z = run.marker.z;
      marker.y = 1;
      marker.hidden = !show;
      marker.color = tone;
      for (const ring of [pad.current, padFill.current]) {
         if (!ring) continue;
         ring.visible = show;
         if (!show) continue;
         const pulse = 1 + Math.sin(time.now * 4) * 0.04;
         ring.position.set(run.marker.x, KERB + 0.03, run.marker.z);
         ring.scale.set(pulse, pulse, 1);
         (ring.material as MeshBasicMaterial).color.set(tone);
      }
      const speed = Math.abs(run.speed);
      engine.current?.set({ volume: 0.05 + Math.min(0.2, (speed / TOP_SPEED) * 0.2), pitch: 0.62 + Math.min(0.7, speed / TOP_SPEED) });
   }, FRAME_PRIORITY.visuals);

   // one bulb per pole: the even pole shows the north-south signal, the odd one the east-west signal
   const placeBulb = (index: number, matrix: Matrix4, color: Color) => {
      const pole = poles[index];
      if (!pole) return false;
      const light = Math.floor(index / 2);
      const ns = index % 2 === 0;
      V.set(pole.x, BULB_Y, pole.z);
      Q.identity();
      S.set(1, 1, 1);
      matrix.compose(V, Q, S);
      color.copy(signalRed(light, run.time, ns) ? RED : GREEN);
   };

   return (
      <>
         <CameraRig camera={{ position: view.offset, fov: FOV, lookAt: look }} follow={aim} bounds={bounds} offset={view.offset} shift={view.shift} damping={DAMPING} />
         <SkyDome top={sky.top} bottom={sky.bottom} radius={300} />
         <PaintReflections intensity={night ? 0.25 : 0.55} />
         {/* asphalt to the fog (dark grey with grain), pavements, courtyards, road paint */}
         <mesh rotation-x={-Math.PI / 2} position={[run.width / 2, -0.01, run.depth / 2]}>
            <planeGeometry args={[ground, ground]} />
            <meshStandardMaterial map={asphalt} color="#ffffff" roughness={0.92} emissiveMap={night ? asphalt : null} emissive={night ? "#8b97b0" : "#000000"} emissiveIntensity={night ? 0.55 : 0} />
         </mesh>
         {night && (
            <>
               <hemisphereLight args={["#a5b4fc", "#475569", 0.85]} />
               <Instanced spots={pools} name="lamp-pools">
                  <cylinderGeometry args={[0.5, 0.5, 0.01, 28]} />
                  <meshBasicMaterial color="#fde68a" transparent opacity={0.3} depthWrite={false} blending={AdditiveBlending} />
               </Instanced>
            </>
         )}
         <Instanced spots={city.slabs} name="pavements">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial map={paving} color={COLORS.sidewalk} roughness={0.85} />
         </Instanced>
         <Instanced spots={city.courts} name="courtyards">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.court} roughness={0.9} />
         </Instanced>
         <Instanced spots={city.dashes} name="dashes">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.roadLine} roughness={0.5} />
         </Instanced>
         <Instanced spots={city.arrows} name="one-way-arrows">
            <primitive object={arrowGeo} attach="geometry" />
            <meshStandardMaterial color={COLORS.roadLine} roughness={0.55} />
         </Instanced>
         <Instanced spots={city.edges} name="edge-lines">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.edgeLine} roughness={0.55} />
         </Instanced>
         <Instanced spots={city.zebras} name="zebras">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.roadLine} roughness={0.55} />
         </Instanced>
         {bars.length > 0 && (
            <Instanced spots={bars} name="stop-bars">
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial color={COLORS.roadLine} roughness={0.5} />
            </Instanced>
         )}
         {/* code buildings: three facade tones (one window texture), slate roof caps */}
         {([COLORS.facadeA, COLORS.facadeB, COLORS.facadeC] as const).map((tone, k) => (
            <Instanced key={tone} spots={city.boxes[k]} name={`facade-${k}`}>
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial map={facade} color={tone} roughness={0.8} />
            </Instanced>
         ))}
         <Instanced spots={city.roofs} name="roofs">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.roof} roughness={0.7} />
         </Instanced>
         <InstancedModel asset={ASSETS.townhouseBlock} spots={city.houses} fallback={<PartsInstanced spots={city.houses} parts={parts.house} name="house" />} />
         <InstancedModel asset={ASSETS.cornerShop} spots={city.shops} fallback={<PartsInstanced spots={city.shops} parts={parts.shop} name="shop" />} />
         <InstancedModel asset={ASSETS.busStop} spots={city.busStops} fallback={<PartsInstanced spots={city.busStops} parts={parts.bus} name="bus" />} />
         <InstancedModel asset={ASSETS.lamp} spots={lamps} fallback={<PartsInstanced spots={lamps} parts={parts.lamp} name="lamp" />} />
         <InstancedModel asset={ASSETS.tree} spots={trees} fallback={<PartsInstanced spots={trees} parts={parts.tree} name="tree" />} />
         {cones.length > 0 && <InstancedModel asset={ASSETS.trafficCone} spots={cones} fallback={<PartsInstanced spots={cones} parts={parts.cone} name="cone" />} />}
         {poles.length > 0 && (
            <>
               <InstancedModel asset={ASSETS.trafficLight} spots={poles} fallback={<PartsInstanced spots={poles} parts={parts.light} name="light" />} />
               <DynamicInstanced count={poles.length} update={placeBulb} parts={bulbParts} tinted name="bulbs" />
            </>
         )}
         <Vehicles run={run} night={night} lamps={config.lighting !== "day"} cab={cab} />
         <mesh ref={padFill} rotation-x={-Math.PI / 2} position={[run.marker.x, KERB + 0.03, run.marker.z]} renderOrder={2}>
            <circleGeometry args={[PAD_R - 0.5 * U, 40]} />
            <meshBasicMaterial color={COLORS.pad} transparent opacity={0.16} depthWrite={false} toneMapped={false} />
         </mesh>
         <mesh ref={pad} rotation-x={-Math.PI / 2} position={[run.marker.x, KERB + 0.03, run.marker.z]} renderOrder={3}>
            <ringGeometry args={[PAD_R - 0.5 * U, PAD_R, 48]} />
            <meshBasicMaterial color={COLORS.pad} transparent opacity={0.92} depthWrite={false} toneMapped={false} />
         </mesh>
         <group ref={rider}>
            <Model asset={ASSETS.travellerNpc} fallback={<RiderPrimitive />} />
         </group>
         <GuideArrow run={run} />
         <TyreSmoke run={run} />
         <CoinPop coins={coins} />
         <TargetMarkers targets={markers} color={COLORS.pad} />
      </>
   );
}

export default function Scene() {
   return <LevelScene />;
}
