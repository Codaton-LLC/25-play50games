"use client";

// One useRunFrame steps rules.ts; visuals read the run and animate on useGameTime.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Euler, Matrix4, Quaternion, RepeatWrapping, Vector3, type Group } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { useCameraViews } from "@/arcade3d/core/camera/CameraViews";
import { DynamicInstanced } from "@/arcade3d/core/render";
import { playSfx, startLoop, useMuted, type LoopHandle } from "@/arcade3d/core/audio";
import { SkyDome } from "@/arcade3d/core/env";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { TargetMarkers, type MarkerTarget } from "@/arcade3d/core/hud";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
import { inputToWorld, randomSeed } from "@/arcade3d/core/math";
import { bank, hover, type BodyOffset } from "@/arcade3d/core/motion";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { Instanced, useCanvasTexture, type InstanceSpot } from "@/arcade3d/core/render";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { FLAP_TIME, patchWings } from "./wings";
import { ASSETS, BRANCH_UPRIGHT, FIT } from "./assets";
import { LEVELS, type BeeLevel } from "./levels";
import { COLORS, DAMPING, FOV, LEVEL_LOOKS, LOOK_AHEAD, aimBounds, decorSpots, soilSpots, viewFor } from "./looks";
import {
   BeehivePrimitive,
   BeePrimitive,
   BranchPrimitive,
   FLOWER_COLOR,
   PartsInstanced,
   canParts,
   flowerParts,
   leafParts,
   mushroomParts,
   orbParts,
   planterParts,
   treeParts,
   useParts,
   webParts,
} from "./Primitives";
import { FLOWER_TYPES, TUNING, createRun, stepRun, type RunState } from "./rules";

const V = new Vector3();
const Q = new Quaternion();
const E = new Euler();
const S = new Vector3();
const AT = { x: 0, y: 0, z: 0 };
const Q2 = new Quaternion();

/** Mowing stripes: two greens in bands, a faint grain; repeated along the garden. */
function drawStripes(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.fillStyle = COLORS.garden;
   ctx.fillRect(0, 0, w, h);
   ctx.fillStyle = COLORS.gardenStripe;
   ctx.fillRect(0, 0, w / 2, h);
   ctx.globalAlpha = 0.05;
   for (let i = 0; i < 160; i++) {
      ctx.fillStyle = i % 2 ? "#14532d" : "#d9f99d";
      ctx.fillRect((i * 37) % w, (i * 91) % h, 3, 3);
   }
   ctx.globalAlpha = 1;
}

function LevelScene() {
   const { id, config } = useLevel<BeeLevel>();
   const level = config ?? LEVELS[1];
   const look = LEVEL_LOOKS[id];
   const view = useFittedView(viewFor(id));
   const input = useInput();
   const fx = useFx();
   const time = useGameTime();
   const quality = useQuality();
   const muted = useMuted();
   const phase = useArcadeStore((s) => s.phase);
   const [run] = useState<RunState>(() => createRun(randomSeed(), level, id));
   // camera views (core/camera): the rules map the stick with the drawn camera's yaw. The garden
   // has no walls and every obstacle (branches, hive) sits below the views' camera height, so no solids.
   const cam = useCameraViews({
      slug: "bee-garden",
      subject: "character",
      steering: "camera",
      defaultYaw: view.yaw,
      target: (o) => {
         const b = run.bee;
         o.x = b.x;
         o.y = b.y;
         o.z = b.z;
         o.heading = b.heading;
         o.vx = b.vx;
         o.vz = b.vz;
      },
   });
   const bee = useRef<Group>(null);
   const body = useRef<BodyOffset>({ y: 0, roll: 0, yaw: 0, squash: 1 }).current;
   const hum = useRef<LoopHandle | null>(null);
   const dir = useRef({ x: 0, z: 0 }).current;
   const aim = useRef({ x: run.bee.x, y: TUNING.altitude, z: run.bee.z - LOOK_AHEAD }).current;
   const bounds = useMemo(() => aimBounds(level), [level]);
   const markers = useRef<MarkerTarget[]>([
      { x: run.hive.x, y: 1.6, z: run.hive.z, hidden: true, color: COLORS.hive },
      { x: 0, y: 1.15, z: 0, hidden: true, color: COLORS.nectar },
   ]).current;

   // static spots, built once per run
   const flowerSpots = useMemo(
      () => FLOWER_TYPES.map((type) => run.flowers.filter((f) => f.type === type).map((f): InstanceSpot => ({ x: f.x, y: 0, z: f.z, rotY: (f.id * 2.399) % (Math.PI * 2) }))),
      [run]
   );
   const soil = useMemo(() => soilSpots(run.flowers), [run]);
   const webSpots = useMemo(() => run.webs.map((w): InstanceSpot => ({ x: w.x, y: 0, z: w.z, rotY: w.rotY })), [run]);
   const webRings = useMemo(() => run.webs.map((w): InstanceSpot => ({ x: w.x, y: 0.02, z: w.z })), [run]);
   const decor = useMemo(() => {
      const d = decorSpots(id);
      const keep = (spots: InstanceSpot[]) => spots.slice(0, scaledCount(spots.length, quality.decor));
      return { leaves: keep(d.leaves), mushrooms: keep(d.mushrooms), planters: d.planters, cans: d.cans, trees: keep(d.trees) };
   }, [id, quality.decor]);

   const flowerFallback = [useParts(() => flowerParts(FLOWER_COLOR.A)), useParts(() => flowerParts(FLOWER_COLOR.B)), useParts(() => flowerParts(FLOWER_COLOR.C))];
   const orbFallback = useParts(orbParts);
   const webFallback = useParts(webParts);
   const leafFallback = useParts(leafParts);
   const mushroomFallback = useParts(mushroomParts);
   const planterFallback = useParts(planterParts);
   const canFallback = useParts(canParts);
   const treeFallback = useParts(treeParts);

   useEffect(() => {
      fx.warm("sparkle", "puff", "confetti", "score");
   }, [fx]);

   useEffect(() => {
      if (phase !== "playing" || muted) return;
      hum.current = startLoop("hum", { volume: 0.18 });
      return () => {
         hum.current?.stop();
         hum.current = null;
      };
   }, [phase, muted]);

   useRunFrame((_state, dt) => {
      const { moveX, moveY, jump } = input.current;
      inputToWorld(moveX, moveY, cam.yaw(), dir);
      stepRun(run, { dirX: dir.x, dirZ: dir.z, jump }, dt, useArcadeStore);
      hum.current?.set({ pitch: run.boosting ? 1.4 : 1, volume: run.stunTimer > 0 ? 0.08 : 0.18 });
      // the camera aims ahead of the bee along its velocity
      const speed = Math.hypot(run.bee.vx, run.bee.vz);
      const ahead = speed > 0.3 ? LOOK_AHEAD / speed : 0;
      aim.x = Math.min(bounds.max.x, Math.max(bounds.min.x, run.bee.x + run.bee.vx * ahead));
      aim.z = Math.min(bounds.max.z, Math.max(bounds.min.z, run.bee.z + run.bee.vz * ahead));
      for (const ev of run.events) {
         AT.x = run.bee.x;
         AT.y = run.bee.y;
         AT.z = run.bee.z;
         if (ev === "pickup") {
            playSfx("pickup", { volume: 0.4, pitch: 1 + run.carried.length * 0.12 });
            fx.burst("sparkle", AT, 12);
         } else if (ev === "web_hit") {
            playSfx("hit", { volume: 0.45 });
            fx.shake(0.3);
            fx.burst("puff", AT, 14);
         } else if (ev === "deposit") {
            AT.x = run.hive.x;
            AT.y = FIT.hiveHeight + 0.3;
            AT.z = run.hive.z;
            playSfx(run.lastDeposit > 60 ? "combo" : "chime", { volume: 0.5 });
            fx.burst("sparkle", AT, 20);
            fx.score(AT, `+${run.lastDeposit}`, { color: COLORS.accent });
         } else if (ev === "win") {
            AT.x = run.hive.x;
            AT.y = FIT.hiveHeight + 0.6;
            AT.z = run.hive.z;
            fx.burst("confetti", AT, 36);
         }
      }
   });

   // bee body: hover bob, bank on turns, a quick spin while stunned; markers
   useFrame(() => {
      const g = bee.current;
      FLAP_TIME.value = time.now;
      if (g) {
         patchWings(g);
         hover(time.now * 3.2, 0.06, body);
         const stun = run.stunTimer > 0 ? Math.sin(time.now * 40) * 0.25 : 0;
         const roll = bank(-run.bee.lateralAccel * 2.5, 0.4);
         g.position.set(run.bee.x, run.bee.y + body.y, run.bee.z);
         g.rotation.set(0.08, run.bee.heading + stun, roll + body.roll, "YXZ");
      }
      const carrying = run.carried.length > 0;
      markers[0].hidden = !carrying;
      let best = Infinity;
      markers[1].hidden = true;
      if (!carrying) {
         for (const f of run.flowers) {
            if (!f.hasNectar) continue;
            const d = Math.hypot(f.x - run.bee.x, f.z - run.bee.z);
            if (d < best) {
               best = d;
               markers[1].x = f.x;
               markers[1].z = f.z;
               markers[1].hidden = false;
            }
         }
      }
   }, FRAME_PRIORITY.visuals);

   // nectar waiting on the blooms: bob and turn
   const placeOrb = (i: number, m: Matrix4) => {
      const f = run.flowers[i];
      if (!f || !f.hasNectar) return false;
      V.set(f.x, FIT.orbY + Math.sin(time.now * 2.4 + i) * 0.04, f.z);
      E.set(0, time.now * 0.8 + i, 0);
      Q.setFromEuler(E);
      S.set(1, 1, 1);
      m.compose(V, Q, S);
   };
   const placeGlow = (i: number, m: Matrix4) => {
      const f = run.flowers[i];
      if (!f || !f.hasNectar) return false;
      const pulse = 1 + Math.sin(time.now * 3 + i) * 0.12;
      V.set(f.x, FIT.orbY + FIT.orbSize / 2 + Math.sin(time.now * 2.4 + i) * 0.04, f.z);
      Q.identity();
      S.setScalar(pulse);
      m.compose(V, Q, S);
   };
   // the carry: up to three small drops swinging under the bee
   const placeCarry = (i: number, m: Matrix4) => {
      if (i >= run.carried.length) return false;
      const a = time.now * 3 + (i * Math.PI * 2) / 3;
      V.set(run.bee.x + Math.cos(a) * 0.22, run.bee.y + body.y - 0.32 - (i % 2) * 0.03, run.bee.z + Math.sin(a) * 0.22);
      Q.identity();
      S.setScalar(0.45);
      m.compose(V, Q, S);
   };
   // big leaves sway; on the breezy level they lean east with the wind
   const lean = level.breeze ? 0.22 : 0;
   const placeLeaf = (i: number, m: Matrix4) => {
      const s = decor.leaves[i];
      if (!s) return false;
      V.set(s.x, 0, s.z);
      E.set(0, s.rotY ?? 0, 0);
      Q.setFromEuler(E);
      const sway = Math.sin(time.now * (level.breeze ? 2.6 : 1.2) + i * 1.7) * (level.breeze ? 0.08 : 0.04);
      E.set(0, 0, -(lean + sway));
      Q.premultiply(Q2.setFromEuler(E));
      S.setScalar(s.scale ?? 1);
      m.compose(V, Q, S);
   };

   const halfX = level.width / 2;
   const halfZ = level.depth / 2;
   const stripes = useCanvasTexture(128, 64, drawStripes);
   useMemo(() => {
      stripes.wrapS = RepeatWrapping;
      stripes.wrapT = RepeatWrapping;
      stripes.repeat.set(level.width / 4.4, 1);
      stripes.needsUpdate = true;
   }, [stripes, level.width]);

   return (
      <>
         <CameraRig
            camera={{ position: view.offset, fov: FOV, lookAt: [aim.x, aim.y, aim.z] }}
            follow={aim}
            bounds={bounds}
            offset={view.offset}
            shift={view.shift}
            damping={DAMPING}
         />
         <SkyDome top={look.skyTop} bottom={look.skyBottom} />
         <TargetMarkers targets={markers} />

         {/* the lawn reaches past the fog, the garden is a brighter mown rectangle inside a stone kerb */}
         <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}>
            <circleGeometry args={[160, 48]} />
            <meshStandardMaterial color={COLORS.lawnFar} roughness={0.95} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, 0]}>
            <planeGeometry args={[level.width, level.depth]} />
            <meshStandardMaterial map={stripes} roughness={0.9} />
         </mesh>
         <Kerb halfX={halfX} halfZ={halfZ} />
         <Instanced spots={soil} name="soil">
            <cylinderGeometry args={[0.3, 0.36, 0.03, 18]} />
            <meshStandardMaterial color={COLORS.soil} roughness={0.95} />
         </Instanced>

         {/* the hive pad and the hive */}
         <mesh rotation-x={-Math.PI / 2} position={[run.hive.x, 0.02, run.hive.z]}>
            <circleGeometry args={[run.hive.radius, 40]} />
            <meshStandardMaterial color={COLORS.hivePad} roughness={0.8} transparent opacity={0.55} depthWrite={false} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[run.hive.x, 0.025, run.hive.z]}>
            <ringGeometry args={[run.hive.radius - 0.1, run.hive.radius, 48]} />
            <meshBasicMaterial color={COLORS.accent} />
         </mesh>
         <Model asset={ASSETS.beehive} position={[run.hive.x, 0, run.hive.z]} fallback={<BeehivePrimitive />} />

         <group ref={bee}>
            <Model asset={ASSETS.bee} tint={look.beeTint} fallback={<BeePrimitive tint={look.beeTint} />} />
         </group>
         <DynamicInstancedModel asset={ASSETS.nectarOrb} count={3} update={placeCarry} fallbackParts={orbFallback} name="carry" />

         {FLOWER_TYPES.map((type, k) => (
            <InstancedModel
               key={type}
               asset={k === 0 ? ASSETS.flowerA : k === 1 ? ASSETS.flowerB : ASSETS.flowerC}
               spots={flowerSpots[k]}
               fallback={<PartsInstanced spots={flowerSpots[k]} parts={flowerFallback[k]} name={`flower${type}`} />}
            />
         ))}
         <DynamicInstancedModel asset={ASSETS.nectarOrb} count={run.flowers.length} update={placeOrb} fallbackParts={orbFallback} name="nectar" />
         <DynamicInstanced count={run.flowers.length} update={placeGlow} name="nectar-glow">
            <sphereGeometry args={[FIT.orbSize * 0.8, 14, 10]} />
            <meshBasicMaterial color={COLORS.nectar} transparent opacity={0.22} blending={AdditiveBlending} depthWrite={false} />
         </DynamicInstanced>

         {run.branches.map((b) => (
            <group key={b.id} position={[b.x, 0, b.z]} rotation-y={b.rotY}>
               <Model asset={ASSETS.branch} position={BRANCH_UPRIGHT.position} rotation={BRANCH_UPRIGHT.rotation} fallback={<BranchPrimitive />} />
            </group>
         ))}
         {webSpots.length > 0 && (
            <>
               <InstancedModel asset={ASSETS.spiderWeb} spots={webSpots} fallback={<PartsInstanced spots={webSpots} parts={webFallback} name="web" />} />
               <Instanced spots={webRings} name="web-rings">
                  <ringGeometry args={[TUNING.webRadius - 0.07, TUNING.webRadius, 32]} />
                  <meshBasicMaterial color={COLORS.webRing} transparent opacity={0.6} depthWrite={false} />
               </Instanced>
            </>
         )}

         {/* decor: outside the fly rectangle, short on the camera's (south) side */}
         <DynamicInstancedModel asset={ASSETS.bigLeaf} count={decor.leaves.length} update={placeLeaf} fallbackParts={leafFallback} name="leaves" />
         <InstancedModel asset={ASSETS.mushroom} spots={decor.mushrooms} fallback={<PartsInstanced spots={decor.mushrooms} parts={mushroomFallback} name="mushroom" />} />
         <InstancedModel asset={ASSETS.planter} spots={decor.planters} fallback={<PartsInstanced spots={decor.planters} parts={planterFallback} name="planter" />} />
         <InstancedModel asset={ASSETS.wateringCan} spots={decor.cans} fallback={<PartsInstanced spots={decor.cans} parts={canFallback} name="can" />} />
         {decor.trees.length > 0 && (
            <InstancedModel asset={ASSETS.leafyTree} spots={decor.trees} fallback={<PartsInstanced spots={decor.trees} parts={treeFallback} name="tree" />} />
         )}
      </>
   );
}

/** A low stone kerb round the garden: two instanced boxes (body + light cap), one per side. */
function Kerb({ halfX, halfZ }: { halfX: number; halfZ: number }) {
   const sides = useMemo<InstanceSpot[]>(
      () => [
         { x: 0, y: 0.06, z: -halfZ - 0.15, sx: 2 * halfX + 0.6, sy: 0.12, sz: 0.3 },
         { x: 0, y: 0.06, z: halfZ + 0.15, sx: 2 * halfX + 0.6, sy: 0.12, sz: 0.3 },
         { x: -halfX - 0.15, y: 0.06, z: 0, sx: 0.3, sy: 0.12, sz: 2 * halfZ },
         { x: halfX + 0.15, y: 0.06, z: 0, sx: 0.3, sy: 0.12, sz: 2 * halfZ },
      ],
      [halfX, halfZ]
   );
   const caps = useMemo(() => sides.map((s) => ({ ...s, y: 0.13, sy: 0.03, sx: (s.sx ?? 1) * 0.98, sz: (s.sz ?? 1) * 0.9 })), [sides]);
   return (
      <>
         <Instanced spots={sides} name="kerb">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.kerb} roughness={0.85} />
         </Instanced>
         <Instanced spots={caps} name="kerb-cap">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.kerbTop} roughness={0.7} />
         </Instanced>
      </>
   );
}

export default function Scene() {
   return <LevelScene />;
}
