"use client";

// One useRunFrame steps rules.ts (step + syncStore); visuals read the run and animate on useGameTime.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Euler, Matrix4, Quaternion, Vector3, type Group } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { playSfx } from "@/arcade3d/core/audio";
import { SkyDome } from "@/arcade3d/core/env";
import { Water } from "@/arcade3d/core/env/Water";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { TargetMarkers, type MarkerTarget } from "@/arcade3d/core/hud";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed } from "@/arcade3d/core/math";
import { hover, type BodyOffset } from "@/arcade3d/core/motion";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { HumanoidModel, cheerPose, gaitPhaseStep, idlePose, useHumanoidPose, walkPose, wrapPhase } from "@/arcade3d/core/rig";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS, LIFEGUARD_LANDMARKS, LIFEGUARD_SCALE } from "./assets";
import type { LevelId } from "@/arcade3d/types";
import type { BeachLevel } from "./levels";
import { COLORS, DAMPING, FOV, LOOK_AHEAD, aimBounds, decorSpots, viewFor } from "./looks";
import {
   AlertTorusMarker,
   BeachChairPrimitive,
   BeachCoolerPrimitive,
   JetSkiPrimitive,
   LifeguardFigure,
   RescueFloatPrimitive,
   SandcastlePrimitive,
   TowerPrimitive,
} from "./Primitives";
import { SAFE_SAND_Z, SAND_DEPTH, SPEED_SAND, TOWER, createRun, step, syncStore, type PropKind, type Run } from "./rules";

const V = new Vector3();
const Q = new Quaternion();
const E = new Euler();
const S = new Vector3(1, 1, 1);
const AT = { x: 0, y: 0, z: 0 };
const BOB: BodyOffset = { y: 0, roll: 0, yaw: 0, squash: 1 };

const PROP_FALLBACK: Record<PropKind, () => JSX.Element> = {
   chair: () => <BeachChairPrimitive />,
   cooler: () => <BeachCoolerPrimitive />,
   sandcastle: () => <SandcastlePrimitive />,
   umbrella: () => (
      <mesh position={[0, 1, 0]}>
         <cylinderGeometry args={[0.04, 0.04, 2, 8]} />
         <meshStandardMaterial color="#e2e8f0" />
      </mesh>
   ),
};

function Props({ run }: { run: Run }) {
   const byKind = useMemo(() => {
      const out: Record<PropKind, InstanceSpot[]> = { chair: [], cooler: [], sandcastle: [], umbrella: [] };
      for (const p of run.props) out[p.kind].push({ x: p.x, y: 0, z: p.z, rotY: p.rotY });
      return out;
   }, [run]);
   return (
      <>
         {(Object.keys(byKind) as PropKind[]).map((kind) =>
            byKind[kind].length === 0 ? null : (
               <InstancedModel
                  key={kind}
                  asset={ASSETS[kind]}
                  spots={byKind[kind]}
                  fallback={byKind[kind].map((s, i) => (
                     <group key={i} position={[s.x, 0, s.z]} rotation-y={s.rotY}>
                        {PROP_FALLBACK[kind]()}
                     </group>
                  ))}
               />
            )
         )}
      </>
   );
}

function Decor({ id }: { id: LevelId }) {
   const quality = useQuality();
   const decor = useMemo(() => {
      const d = decorSpots(id);
      return { palms: d.palms.slice(0, scaledCount(d.palms.length, quality.decor)), huts: d.huts };
   }, [id, quality.decor]);
   return (
      <>
         <InstancedModel
            asset={ASSETS.palm}
            spots={decor.palms}
            fallback={
               <Instanced spots={decor.palms} name="palm-stand-in">
                  <coneGeometry args={[0.3, 1, 8]} />
                  <meshStandardMaterial color="#4d7c0f" roughness={0.8} />
               </Instanced>
            }
         />
         <InstancedModel
            asset={ASSETS.hut}
            spots={decor.huts}
            fallback={
               <Instanced spots={decor.huts} name="hut-stand-in">
                  <boxGeometry args={[0.7, 1, 0.9]} />
                  <meshStandardMaterial color={COLORS.hutWood} roughness={0.8} />
               </Instanced>
            }
         />
      </>
   );
}

export default function Scene() {
   const { id, config } = useLevel<BeachLevel>();
   const view = useFittedView(viewFor(id));
   const input = useInput();
   const fx = useFx();
   const time = useGameTime();
   const [run] = useState<Run>(() => createRun(randomSeed(), config, id));
   const hero = useRef<Group>(null);
   const handFloat = useRef<Group>(null);
   const towerFloat = useRef<Group>(null);
   const torus = useRef<Group>(null);
   const ski = useRef<Group>(null);
   const gait = useRef({ phase: 0 }).current;
   const aim = useRef({ x: run.hero.x, y: 0.8, z: run.hero.z - LOOK_AHEAD }).current;
   const bounds = useMemo(() => aimBounds(config), [config]);
   const markers = useRef<MarkerTarget[]>([{ x: 0, y: 0.4, z: 0, hidden: true, color: COLORS.accent }]).current;

   useEffect(() => {
      fx.warm("sparks", "splash", "puff", "score");
   }, [fx]);

   const pose = useHumanoidPose((p) => {
      const speed = Math.hypot(run.hero.vx, run.hero.vz);
      const amount = Math.min(1, speed / SPEED_SAND);
      if (run.over === "win") cheerPose(time.now, p);
      else if (run.onJetSki || amount < 0.06) idlePose(time.now, p);
      else {
         gait.phase = wrapPhase(gait.phase + gaitPhaseStep(Math.max(0.3, amount), LIFEGUARD_LANDMARKS, LIFEGUARD_SCALE, speed, time.delta, 4));
         walkPose(gait.phase, Math.max(0.3, amount), p);
      }
   });

   useRunFrame((_state, dt) => {
      const { moveX, moveY, actionPressed } = input.current;
      const store = useArcadeStore.getState();
      const ev = step(run, { moveX, moveY, actionPressed, yaw: view.yaw }, dt, store.timeLeftMs ?? 0);
      syncStore(run, ev, useArcadeStore);
      const h = run.hero;
      aim.x = Math.min(bounds.max.x, Math.max(bounds.min.x, h.x + h.vx * (LOOK_AHEAD / SPEED_SAND)));
      aim.z = Math.min(bounds.max.z, Math.max(bounds.min.z, h.z + h.vz * (LOOK_AHEAD / SPEED_SAND)));
      AT.x = h.x;
      AT.y = 1;
      AT.z = h.z;
      if (ev.alertAlarm) playSfx("alarm", { volume: 0.5 });
      if (ev.jetSkiMount) {
         playSfx("whoosh");
         fx.burst("splash", AT, 10);
      }
      if (ev.grabbed) {
         playSfx("pickup");
         fx.burst("splash", AT, 14);
      }
      if (ev.rescued) {
         playSfx(ev.won ? "win" : "chime");
         fx.burst("sparks", AT, 16);
         fx.score(AT, `+${ev.score}`, { color: COLORS.accent });
      }
      if (ev.lifeLost) {
         playSfx("buzz");
         fx.shake(0.25);
      }
   });

   useFrame(() => {
      const h = run.hero;
      if (hero.current) {
         hero.current.position.set(h.x, run.onJetSki ? 0.55 : 0, h.z);
         hero.current.rotation.y = h.yaw;
      }
      if (handFloat.current) handFloat.current.visible = run.carrying;
      if (towerFloat.current) towerFloat.current.visible = !run.carrying;
      if (ski.current) {
         ski.current.position.set(run.jetSki.x, Math.sin(time.now * 2.2) * 0.04, run.jetSki.z);
         ski.current.rotation.y = run.onJetSki ? h.yaw : 0;
      }
      const s = run.swimmers[run.activeSwimmer];
      const alert = !!s && !s.saved && !run.carrying && !run.over;
      if (torus.current) {
         torus.current.visible = alert;
         if (s) torus.current.position.set(s.x, 0.12, s.z);
         const k = 1 + Math.sin(time.now * 6) * 0.06;
         torus.current.scale.set(k, 1, k);
      }
      const m = markers[0];
      if (run.carrying) {
         m.x = h.x;
         m.z = SAFE_SAND_Z + 0.3;
         m.hidden = false;
      } else if (alert && s) {
         m.x = s.x;
         m.z = s.z;
         m.hidden = false;
      } else m.hidden = true;
   }, FRAME_PRIORITY.visuals);

   // swimmers wait in the water, bobbing; the one carried is hidden (the float in the hand stands for it)
   const placeSwimmer = (i: number, m: Matrix4) => {
      const s = run.swimmers[i];
      if (!s || s.saved || (run.carrying && i === run.activeSwimmer)) return false;
      hover(time.now + i * 1.3, 0.06, BOB);
      const flail = i === run.activeSwimmer ? Math.sin(time.now * 7 + i) * 0.12 : 0;
      E.set(flail, Math.sin(time.now * 0.6 + i) * 0.3, BOB.roll);
      Q.setFromEuler(E);
      V.set(s.x, BOB.y, s.z);
      S.set(1, 1, 1);
      m.compose(V, Q, S);
   };

   const sandW = config.width + 80;
   return (
      <>
         <CameraRig camera={{ position: view.offset, fov: FOV, lookAt: [aim.x, aim.y, aim.z] }} follow={aim} bounds={bounds} offset={view.offset} shift={view.shift} damping={DAMPING} />
         <SkyDome top={config.lighting === "sunset" ? "#7c2d12" : "#0ea5e9"} bottom={config.background} />
         <TargetMarkers targets={markers} />

         {/* sand to the horizon behind the beach and past both ends, wet sand along the shore, the safe line */}
         <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 60]}>
            <planeGeometry args={[sandW + 120, 120]} />
            <meshStandardMaterial color={COLORS.sandFar} roughness={0.95} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, SAND_DEPTH / 2]}>
            <planeGeometry args={[config.width + 12, SAND_DEPTH]} />
            <meshStandardMaterial color={COLORS.sand} roughness={0.92} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, 0.0, SAFE_SAND_Z / 2]}>
            <planeGeometry args={[sandW, SAFE_SAND_Z]} />
            <meshStandardMaterial color={COLORS.wetSand} roughness={0.7} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, SAFE_SAND_Z]}>
            <planeGeometry args={[config.width, 0.08]} />
            <meshBasicMaterial color={COLORS.safeLine} transparent opacity={0.55} depthWrite={false} />
         </mesh>
         <Water
            size={[sandW + 120, config.water + 90]}
            position={[0, -0.06, -(config.water + 90) / 2]}
            color={COLORS.waterShallow}
            deep={COLORS.waterDeep}
            foam={COLORS.waterFoam}
            amplitude={id === 5 ? 0.24 : 0.14}
            foamEdge={0.02}
         />

         <Model asset={ASSETS.tower} position={[TOWER.x, 0, TOWER.z]} rotation-y={Math.PI} fallback={<TowerPrimitive />} />
         <group ref={towerFloat} position={[TOWER.x + 0.95, 0.9, TOWER.z - 0.2]} rotation={[0, 0, Math.PI / 2]}>
            <Model asset={ASSETS.rescueFloat} fallback={<RescueFloatPrimitive />} />
         </group>

         <group ref={hero}>
            <HumanoidModel
               asset={ASSETS.lifeguard}
               pose={pose}
               fallback={<LifeguardFigure />}
               attach={{
                  // the float hangs from the right hand along the arm (-x = towards the fingertips)
                  handR: (
                     <group ref={handFloat} visible={false} position={[-0.42, -0.08, 0]} rotation-y={Math.PI / 2}>
                        <Model asset={ASSETS.rescueFloat} fallback={<RescueFloatPrimitive />} />
                     </group>
                  ),
               }}
            />
         </group>

         <DynamicInstancedModel asset={ASSETS.swimmer} count={run.swimmers.length} update={placeSwimmer} name="swimmers" />
         <group ref={torus}>
            <AlertTorusMarker />
         </group>
         {config.jetSki && (
            <group ref={ski}>
               <Model asset={ASSETS.jetSki} fallback={<JetSkiPrimitive />} />
            </group>
         )}

         <Props run={run} />
         <Decor id={id} />
      </>
   );
}
