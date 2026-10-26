"use client";

// One useRunFrame steps rules.ts. Visuals read the run and animate with useGameTime.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
   BoxGeometry,
   Color,
   ConeGeometry,
   Matrix4,
   MeshStandardMaterial,
   OctahedronGeometry,
   SphereGeometry,
   TorusGeometry,
   Vector3,
   type Group,
} from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { playSfx, startLoop, type LoopHandle } from "@/arcade3d/core/audio";
import { EyeRig } from "@/arcade3d/core/EyeRig";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed } from "@/arcade3d/core/math";
import { hover, type BodyOffset } from "@/arcade3d/core/motion";
import { useQuality } from "@/arcade3d/core/quality";
import { Instanced, type InstancePart, type InstanceSpot } from "@/arcade3d/core/render";
import { HumanoidModel, aimArm, sitPose, useHumanoidPose } from "@/arcade3d/core/rig";
import { useEyeShift } from "@/arcade3d/core/useEyeShift";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { ASSETS, SEAT_Y, SEAT_Z } from "./assets";
import type { CarpetLevel } from "./levels";
import { BAND, COLORS, EYE_Y, FOV, PITCH, groundColor } from "./looks";
import { CarpetPrimitive, FinishArch, RiderFigure } from "./Primitives";
import { createRun, step, type Decor, type DecorKind, type Run } from "./rules";

const AT = { x: 0, y: 0, z: 0 };
const X = new Vector3();
const Y = new Vector3();
const Z = new Vector3();
const GOLD = new Color(COLORS.ring);
const DIM = new Color("#44403c");
const GLOW = new Color(COLORS.ringHot);
/** Half a turn about z: the rock (point up, cap down as authored) hangs point down, cap up. */
const FLIP = new Matrix4().makeRotationZ(Math.PI);
const HOVER: BodyOffset = { y: 0, roll: 0, yaw: 0, squash: 1 };

const RING_PARTS: InstancePart[] = [{
   geometry: new TorusGeometry(1.5, 0.1, 8, 20),
   material: new MeshStandardMaterial({ color: COLORS.ring, emissive: COLORS.ring, emissiveIntensity: 0.28, roughness: 0.32, metalness: 0.22 }),
}];

const STAR_PARTS: InstancePart[] = [{
   geometry: new OctahedronGeometry(0.36, 0),
   material: new MeshStandardMaterial({ color: COLORS.ringHot, emissive: COLORS.ring, emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.15 }),
}];

const ROCK_POINT = new ConeGeometry(0.72, 0.95, 7);
ROCK_POINT.translate(0, 0.12, 0);
const ROCK_CAP = new BoxGeometry(1.38, 0.22, 1.38);
ROCK_CAP.translate(0, -0.3, 0);
const ROCK_PARTS: InstancePart[] = [
   { geometry: ROCK_POINT, material: new MeshStandardMaterial({ color: COLORS.rockDark, roughness: 0.72 }) },
   { geometry: ROCK_CAP, material: new MeshStandardMaterial({ color: COLORS.rockTop, roughness: 0.48 }) },
];

const CLOUD_GEO = new SphereGeometry(1.15, 12, 8);
CLOUD_GEO.scale(1, 0.58, 1);
const CLOUD_PARTS: InstancePart[] = [{
   geometry: CLOUD_GEO,
   material: new MeshStandardMaterial({ color: COLORS.cloud, roughness: 0.9 }),
}];

const TOWER_BODY = new BoxGeometry(1.15, 2.7, 1.15);
const TOWER_CAP = new BoxGeometry(1.4, 0.26, 1.4);
TOWER_CAP.translate(0, 1.48, 0);
const TOWER_PARTS: InstancePart[] = [
   { geometry: TOWER_BODY, material: new MeshStandardMaterial({ color: COLORS.palace, roughness: 0.45 }) },
   { geometry: TOWER_CAP, material: new MeshStandardMaterial({ color: COLORS.palaceTrim, emissive: COLORS.accent, emissiveIntensity: 0.2, roughness: 0.4 }) },
];

function spotsOf(items: readonly Decor[], kind: DecorKind, decor: number): InstanceSpot[] {
   const all = items.filter((item) => item.kind === kind);
   const count = kind === "palace" ? all.length : all.length === 0 ? 0 : Math.max(1, Math.round(all.length * decor));
   return all.slice(0, count).map((item) => ({
      x: item.x, y: item.y, z: item.z, rotY: item.rotY, sx: item.sx, sy: item.sy, sz: item.sz,
   }));
}

function capsOf(spots: readonly InstanceSpot[], lift: number, shrink: number): InstanceSpot[] {
   return spots.map((spot) => ({
      x: spot.x,
      y: spot.y + (spot.sy ?? 1) * lift,
      z: spot.z,
      rotY: spot.rotY,
      sx: (spot.sx ?? 1) * shrink,
      sy: (spot.sy ?? 1) * 0.16,
      sz: (spot.sz ?? 1) * shrink,
   }));
}

/** The core seated pose, both hands forward on the carpet's edge; both arms up on a win. */
function sit(pose: Parameters<typeof sitPose>[1], win: boolean): void {
   sitPose(1, pose);
   if (win) {
      aimArm(pose, 1, 0.15, 0.9, 0.25, 0.05, 0.65, 0.45);
      aimArm(pose, -1, -0.15, 0.9, 0.25, -0.05, 0.65, 0.45);
   }
}

function LevelScene() {
   const { config } = useLevel<CarpetLevel>();
   const input = useInput();
   const fx = useFx();
   const time = useGameTime();
   const quality = useQuality();
   const eye = useEyeShift({ fov: FOV, eyeY: EYE_Y, pitch: PITCH, band: BAND, padding: 8 });
   const [run] = useState<Run>(() => createRun(randomSeed(), config));
   const camRef = useRef(run.cam);
   const yawRef = useRef(run.camYaw);
   const body = useRef<Group>(null);
   const ripple = useRef<Group>(null);
   const groundRef = useRef<Group>(null);
   const wind = useRef<LoopHandle | null>(null);
   const trail = useRef(0);
   const pose = useHumanoidPose((p) => sit(p, run.over === "win"));

   const roofs = useMemo(() => spotsOf(run.decor, "roof", quality.decor), [run, quality.decor]);
   const roofCaps = useMemo(() => capsOf(roofs, 0.46, 0.9), [roofs]);
   const mesas = useMemo(() => spotsOf(run.decor, "mesa", quality.decor), [run, quality.decor]);
   const mesaCaps = useMemo(() => capsOf(mesas, 0.5, 1.05), [mesas]);
   const lanterns = useMemo(() => spotsOf(run.decor, "lantern", quality.decor), [run, quality.decor]);
   const farClouds = useMemo(() => spotsOf(run.decor, "cloud", quality.decor), [run, quality.decor]);
   const palace = useMemo(() => spotsOf(run.decor, "palace", 1), [run]);
   const palaceCaps = useMemo(() => capsOf(palace, 0.46, 0.62), [palace]);
   const ground = groundColor(run.theme);
   const parts = run.theme === "cloud" ? CLOUD_PARTS : run.theme === "night" || run.theme === "palace" ? TOWER_PARTS : ROCK_PARTS;
   const obstacle = run.theme === "cloud" ? ASSETS.cloud : run.theme === "night" || run.theme === "palace" ? ASSETS.tower : ASSETS.rock;

   useEffect(() => {
      fx.warm("sparkle", "score");
      const loop = startLoop("hum", { volume: 0.05, pitch: 0.85 });
      wind.current = loop;
      return () => loop.stop();
   }, [fx]);

   useLayoutEffect(() => {
      body.current?.position.set(run.carpet.x, run.carpet.y, run.carpet.z);
      body.current?.rotation.set(-run.pitch, run.yaw, run.roll, "YXZ");
      groundRef.current?.position.set(run.carpet.x, run.carpet.y - 16, run.carpet.z);
   }, [run]);

   const placeRing = (index: number, matrix: Matrix4, color: Color) => {
      const ring = run.rings[index];
      if (!ring) return false;
      X.set(ring.rx, ring.ry, ring.rz);
      Y.set(ring.ux, ring.uy, ring.uz);
      Z.set(ring.tx, ring.ty, ring.tz);
      matrix.makeBasis(X, Y, Z);
      matrix.setPosition(ring.x, ring.y, ring.z);
      if (index === run.nextRing) color.copy(GLOW);
      else if (!ring.taken && ring.s < run.s - 0.5) color.copy(DIM);
      else color.copy(GOLD);
   };
   const placeStar = (index: number, matrix: Matrix4) => {
      const star = run.stars[index];
      if (!star || star.taken) return false;
      matrix.makeRotationY(run.time * 1.7 + index);
      matrix.setPosition(star.x, star.y, star.z);
   };
   const flipRock = obstacle === ASSETS.rock;
   const placeRock = (index: number, matrix: Matrix4) => {
      const rock = run.rocks[index];
      if (!rock) return false;
      matrix.makeRotationY(rock.rotY);
      if (flipRock) matrix.multiply(FLIP);
      matrix.setPosition(rock.x, rock.y, rock.z);
   };

   useRunFrame((_state, dt) => {
      const { moveX, moveY, jump } = input.current;
      const store = useArcadeStore.getState();
      const ev = step(run, { moveX, moveY, jump }, dt, store.timeLeftMs ?? 0);
      if (ev.score) store.addScore(ev.score);
      store.setStat("rings", run.ringsPassed);
      store.setStat("stars", run.starsTaken);
      store.setStat("boost", Math.round(run.stamina));
      store.setStat("needRings", run.needRings);
      store.setStat("needStars", run.needStars);
      yawRef.current = run.camYaw;
      wind.current?.set({
         volume: run.over ? 0 : run.boosting ? 0.22 : 0.06,
         pitch: run.boosting ? 1.18 : 0.84,
      });
      if (ev.ring >= 0) {
         const ring = run.rings[ev.ring];
         AT.x = ring.x;
         AT.y = ring.y;
         AT.z = ring.z;
         fx.burst("sparkle", AT, 14);
         fx.score(AT, "+50");
         playSfx("chime");
      }
      if (ev.star >= 0) {
         const star = run.stars[ev.star];
         AT.x = star.x;
         AT.y = star.y;
         AT.z = star.z;
         fx.burst("sparkle", AT, 8);
         fx.score(AT, "+30");
         playSfx("pickup");
      }
      if (ev.hit) {
         AT.x = run.carpet.x;
         AT.y = run.carpet.y;
         AT.z = run.carpet.z;
         fx.burst("puff", AT, 8);
         fx.shake(0.28);
         playSfx("hit");
      }
      if (ev.cloud) playSfx("whoosh", { volume: 0.4, pitch: 0.7 });
      if (ev.boostOn) playSfx("whoosh", { volume: 0.55, pitch: 1.25 });
      if (run.boosting && time.now - trail.current > 0.09) {
         trail.current = time.now;
         AT.x = run.carpet.x - run.tangent.x * 1.3;
         AT.y = run.carpet.y - run.tangent.y * 1.3;
         AT.z = run.carpet.z - run.tangent.z * 1.3;
         fx.burst("sparkle", AT, 4);
      }
      if (ev.won) playSfx("win");
      if (ev.lost) playSfx("lose");
      if (ev.lifeLost) store.loseLife();
      if (ev.won) store.end("win");
      else if (ev.lost && !ev.lifeLost) store.end("lose");
   });

   useFrame(() => {
      const group = body.current;
      if (!group) return;
      hover(time.now, 0.05, HOVER);
      group.position.set(run.carpet.x, run.carpet.y + HOVER.y * 0.25, run.carpet.z);
      group.rotation.set(-run.pitch, run.yaw, run.roll, "YXZ");
      const cloth = ripple.current;
      if (cloth) {
         cloth.position.y = HOVER.y;
         cloth.scale.y = 1 + Math.sin(time.now * 7) * 0.07;
      }
      groundRef.current?.position.set(run.carpet.x, run.carpet.y - 16, run.carpet.z);
   }, FRAME_PRIORITY.visuals);

   return (
      <>
         <EyeRig position={camRef} yaw={yawRef} pitch={PITCH} fov={FOV} shift={eye.shift} />
         <group ref={groundRef}>
            <mesh rotation-x={-Math.PI / 2} scale={[260, 260, 1]}>
               <planeGeometry args={[1, 1]} />
               <meshStandardMaterial color={ground} roughness={0.95} />
            </mesh>
         </group>
         {roofs.length > 0 && (
            <InstancedModel
               asset={ASSETS.roof}
               spots={roofs}
               fallback={
                  <>
                     <Instanced spots={roofs} name="roofs">
                        <boxGeometry args={[1, 1, 1]} />
                        <meshStandardMaterial color={COLORS.roof} roughness={0.7} />
                     </Instanced>
                     <Instanced spots={roofCaps} name="roof-caps">
                        <boxGeometry args={[1, 1, 1]} />
                        <meshStandardMaterial color={COLORS.roofTrim} roughness={0.55} />
                     </Instanced>
                  </>
               }
            />
         )}
         {mesas.length > 0 && (
            <InstancedModel
               asset={ASSETS.mesa}
               spots={mesas}
               fallback={
                  <>
                     <Instanced spots={mesas} name="mesas">
                        <boxGeometry args={[1, 1, 1]} />
                        <meshStandardMaterial color={COLORS.mesa} roughness={0.78} />
                     </Instanced>
                     <Instanced spots={mesaCaps} name="mesa-caps">
                        <boxGeometry args={[1, 1, 1]} />
                        <meshStandardMaterial color={COLORS.mesaCap} roughness={0.6} />
                     </Instanced>
                  </>
               }
            />
         )}
         {lanterns.length > 0 && (
            <InstancedModel
               asset={ASSETS.lantern}
               spots={lanterns}
               fallback={
                  <Instanced spots={lanterns} name="lanterns">
                     <boxGeometry args={[1, 1, 1]} />
                     <meshStandardMaterial color={COLORS.lantern} emissive={COLORS.lanternGlow} emissiveIntensity={0.85} roughness={0.35} />
                  </Instanced>
               }
            />
         )}
         {farClouds.length > 0 && (
            <Instanced spots={farClouds} name="far-clouds">
               <sphereGeometry args={[0.5, 10, 8]} />
               <meshStandardMaterial color={COLORS.cloud} roughness={0.92} />
            </Instanced>
         )}
         {palace.length > 0 && (
            <InstancedModel
               asset={ASSETS.palace}
               spots={palace}
               fallback={
                  <>
                     <Instanced spots={palace} name="palace">
                        <boxGeometry args={[1, 1, 1]} />
                        <meshStandardMaterial color={COLORS.palace} roughness={0.42} />
                     </Instanced>
                     <Instanced spots={palaceCaps} name="palace-caps">
                        <boxGeometry args={[1, 1, 1]} />
                        <meshStandardMaterial color={COLORS.palaceGold} emissive={COLORS.ring} emissiveIntensity={0.25} roughness={0.35} />
                     </Instanced>
                  </>
               }
            />
         )}
         <DynamicInstancedModel asset={ASSETS.ring} count={run.rings.length} update={placeRing} fallbackParts={RING_PARTS} tinted name="rings" />
         <DynamicInstancedModel asset={ASSETS.star} count={run.stars.length} update={placeStar} fallbackParts={STAR_PARTS} name="stars" />
         <DynamicInstancedModel asset={obstacle} count={run.rocks.length} update={placeRock} fallbackParts={parts} name="rocks" />
         <group position={[run.arch.x, run.arch.y, run.arch.z]} rotation={[0, run.arch.yaw, 0]}>
            <FinishArch />
         </group>
         <group ref={body}>
            <group ref={ripple}>
               <Model asset={ASSETS.carpet} fallback={<CarpetPrimitive />} />
            </group>
            <group position={[0, SEAT_Y, SEAT_Z]}>
               <HumanoidModel asset={ASSETS.rider} pose={pose} applyLift={false} fallback={<RiderFigure />} />
            </group>
         </group>
      </>
   );
}

export default function Scene() {
   return <LevelScene />;
}
