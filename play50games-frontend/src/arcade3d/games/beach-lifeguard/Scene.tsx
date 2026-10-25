"use client";

// Beach Lifeguard Scene. Steps rules.ts in useRunFrame, updates camera, audio, fx, and models.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3, type Group } from "three";
import { Model } from "@/arcade3d/core/assets";
import { playSfx } from "@/arcade3d/core/audio";
import CameraRig from "@/arcade3d/core/CameraRig";
import { Water } from "@/arcade3d/core/env/Water";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { TargetMarkers, type MarkerTarget } from "@/arcade3d/core/hud/TargetMarkers";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed } from "@/arcade3d/core/math";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { ASSETS } from "./assets";
import type { BeachLevel } from "./levels";
import { COLORS, DAMPING, FOLLOW, FOV, LOOK_AHEAD, beachBox, lookAtFor, viewFor } from "./looks";
import {
   AlertTorusMarker,
   BeachChairPrimitive,
   BeachCoolerPrimitive,
   BeachHutPrimitive,
   JetSkiPrimitive,
   LifeguardFigure,
   RescueFloatPrimitive,
   SandcastlePrimitive,
   SurfboardPrimitive,
   SwimmerFigure,
   TowerPrimitive,
} from "./Primitives";
import { TOWER_X, TOWER_Z, createRun, step, type PropItem, type Run } from "./rules";

const HERO_AT = { x: 0, y: 0.6, z: 0 };
const TARGETS: MarkerTarget[] = [{ x: 0, y: 0, z: 0, hidden: false }];

function PropMesh({ item }: { item: PropItem }) {
   return (
      <group position={[item.x, 0, item.z]} rotation={[0, item.rotY, 0]}>
         {item.kind === "chair" && <Model asset={ASSETS.chair} fallback={<BeachChairPrimitive />} />}
         {item.kind === "cooler" && <Model asset={ASSETS.cooler} fallback={<BeachCoolerPrimitive />} />}
         {item.kind === "hut" && <Model asset={ASSETS.hut} fallback={<BeachHutPrimitive />} />}
         {item.kind === "sandcastle" && <Model asset={ASSETS.sandcastle} fallback={<SandcastlePrimitive />} />}
         {item.kind === "surfboard" && <Model asset={ASSETS.surfboard} fallback={<SurfboardPrimitive />} />}
         {item.kind === "umbrella" && <Model asset={ASSETS.umbrella} />}
         {item.kind === "palm" && <Model asset={ASSETS.palm} />}
      </group>
   );
}

export default function Scene() {
   const { id, config } = useLevel<BeachLevel>();
   const view = useFittedView(viewFor(id));
   const input = useInput();
   const fx = useFx();
   const time = useGameTime();

   const [run] = useState<Run>(() => createRun(randomSeed(), config));
   const heroGroup = useRef<Group>(null);
   const cameraFocus = useRef({ x: run.hero.x, y: 0.8, z: run.hero.z }).current;
   const bounds = useMemo(() => beachBox(config), [config]);
   const look = useMemo(() => lookAtFor(config), [config]);

   useEffect(() => {
      fx.warm("sparks", "puff", "score");
      // Initial alert sound
      playSfx("alarm");
   }, [fx]);

   useRunFrame((_state, dt) => {
      const { moveX, moveY, action, actionPressed } = input.current;
      const store = useArcadeStore.getState();

      const ev = step(
         run,
         {
            moveX,
            moveY,
            actionPressed: actionPressed || action,
            yaw: view.yaw,
         },
         dt,
         store.timeLeftMs ?? 0,
      );

      // Store sync
      if (ev.score) store.addScore(ev.score);
      store.setStat("saved", run.saved);
      store.setStat("alert", Math.round(Math.max(0, run.alertTime / run.level.alertS) * 100));
      store.setStat("carrying", run.carrying ? 1 : 0);
      store.setStat("jetSki", run.onJetSki ? 1 : 0);

      // Camera follow target
      cameraFocus.x = run.hero.x + Math.sin(run.hero.yaw) * LOOK_AHEAD;
      cameraFocus.z = run.hero.z + Math.cos(run.hero.yaw) * LOOK_AHEAD;
      cameraFocus.y = 0.8;
      cameraFocus.x = Math.max(bounds.min.x, Math.min(bounds.max.x, cameraFocus.x));
      cameraFocus.z = Math.max(bounds.min.z, Math.min(bounds.max.z, cameraFocus.z));

      // Audio & VFX
      HERO_AT.x = run.hero.x;
      HERO_AT.y = 0.8;
      HERO_AT.z = run.hero.z;

      if (ev.alertAlarm) {
         playSfx("alarm");
      }
      if (ev.jetSkiMount) {
         playSfx("whoosh");
         fx.burst("puff", HERO_AT, 6);
      }
      if (ev.grabbed) {
         playSfx("pickup");
         fx.burst("sparks", HERO_AT, 8);
      }
      if (ev.rescued) {
         playSfx("pickup");
         fx.burst("sparks", HERO_AT, 14);
         fx.score(HERO_AT, `+${ev.score ?? 180}`);
      }
      if (ev.lifeLost) {
         store.loseLife();
         playSfx("buzz");
         fx.shake(0.25);
      }
      if (ev.won) {
         playSfx("win");
         store.end("win");
      }
      if (ev.lost) {
         store.end("lose");
      }
   });

   useFrame(() => {
      const g = heroGroup.current;
      if (!g) return;
      g.position.set(run.hero.x, 0, run.hero.z);
      g.rotation.y = run.hero.yaw;

      // Update target marker
      if (run.carrying) {
         TARGETS[0].x = run.hero.x;
         TARGETS[0].y = 0.2;
         TARGETS[0].z = 2.0;
         TARGETS[0].hidden = false;
      } else {
         const active = run.swimmers[run.activeSwimmer];
         if (active && !active.saved) {
            TARGETS[0].x = active.x;
            TARGETS[0].y = 0.2;
            TARGETS[0].z = active.z;
            TARGETS[0].hidden = false;
         } else {
            TARGETS[0].hidden = true;
         }
      }
   }, FRAME_PRIORITY.visuals);

   const activeSwimmer = run.swimmers[run.activeSwimmer];
   const bob = Math.sin(time.now * 3) * 0.08;

   return (
      <>
         <CameraRig
            camera={{ position: view.offset, fov: FOV, lookAt: look }}
            follow={cameraFocus}
            followFraction={FOLLOW}
            bounds={bounds}
            damping={DAMPING}
            offset={view.offset}
            shift={view.shift}
         />

         {/* Target Marker Arrow (screen edge) */}
         <TargetMarkers targets={TARGETS} color="#fb7185" />

         {/* Dry Sand Ground (z: 2 to 14) */}
         <mesh position={[0, -0.05, 8]} receiveShadow>
            <boxGeometry args={[config.width + 12, 0.1, 12]} />
            <meshStandardMaterial color={COLORS.sand} roughness={0.9} />
         </mesh>

         {/* Wet Sand Strip (z: 0 to 2) */}
         <mesh position={[0, -0.048, 1]} receiveShadow>
            <boxGeometry args={[config.width + 12, 0.1, 2]} />
            <meshStandardMaterial color={COLORS.wetSand} roughness={0.7} />
         </mesh>

         {/* Water Surface (z: 0 to -water) */}
         <Water
            size={[config.width + 16, config.water + 12]}
            position={[0, -0.02, -config.water / 2]}
            color={COLORS.waterShallow}
            deep={COLORS.waterDeep}
            foam={COLORS.waterFoam}
            amplitude={config.lighting === "sunset" ? 0.24 : 0.16}
         />

         {/* Lifeguard Tower at (0, 8) */}
         <group position={[TOWER_X, 0, TOWER_Z]}>
            <Model asset={ASSETS.tower} fallback={<TowerPrimitive />} />
            {/* Standby rescue float on tower */}
            {!run.carrying && (
               <group position={[0.7, 2.3, 0.6]} rotation={[0, 0, 0.3]}>
                  <Model asset={ASSETS.rescueFloat} fallback={<RescueFloatPrimitive />} />
               </group>
            )}
         </group>

         {/* Hero Lifeguard */}
         <group ref={heroGroup}>
            <Model asset={ASSETS.lifeguard} fallback={<LifeguardFigure carrying={run.carrying} />} />
         </group>

         {/* Active Alert Swimmer and Torus */}
         {activeSwimmer && !activeSwimmer.saved && !run.carrying && (
            <group position={[activeSwimmer.x, bob, activeSwimmer.z]}>
               <Model asset={ASSETS.swimmer} fallback={<SwimmerFigure />} />
               <AlertTorusMarker />
            </group>
         )}

         {/* Other Swimmers */}
         {run.swimmers.map((swimmer) => {
            if (swimmer.id === run.activeSwimmer || swimmer.saved) return null;
            return (
               <group key={swimmer.id} position={[swimmer.x, Math.sin(time.now * 2.5 + swimmer.id) * 0.08, swimmer.z]}>
                  <Model asset={ASSETS.swimmer} fallback={<SwimmerFigure />} />
               </group>
            );
         })}

         {/* Rescue Jet Ski (Levels 4 and 5) */}
         {config.jetSki && (
            <group position={[run.jetSki.x, 0.04 + (run.onJetSki ? bob * 0.5 : 0), run.jetSki.z]}>
               <Model asset={ASSETS.jetSki} fallback={<JetSkiPrimitive />} />
            </group>
         )}

         {/* Beach Props (outside swimmer corridors) */}
         {run.props.map((item, idx) => (
            <PropMesh key={`${item.kind}-${idx}`} item={item} />
         ))}
      </>
   );
}
