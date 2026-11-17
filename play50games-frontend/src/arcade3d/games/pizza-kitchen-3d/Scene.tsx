"use client";

// One useRunFrame steps rules.ts (frame); visuals read the run. The static kitchen renders once per
// run; only <Live> (the pizzas, the oven glow, the station ring) re-renders, at 12 Hz.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RepeatWrapping, type Group } from "three";
import { InstancedModel, Model } from "@/arcade3d/core/assets";
import CameraRig from "@/arcade3d/core/CameraRig";
import { useCameraViews } from "@/arcade3d/core/camera/CameraViews";
import { playSfx } from "@/arcade3d/core/audio";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
import { inputToWorld, randomSeed } from "@/arcade3d/core/math";
import { Instanced, useCanvasTexture, type InstanceSpot } from "@/arcade3d/core/render";
import { CHEF_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { HumanoidModel, carryPose, cheerPose, idlePose, reachPose, useHumanoidPose, walkPose, walkStride, wrapPhase } from "@/arcade3d/core/rig";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS, FIT, GLB_SIZE } from "./assets";
import { SHARED_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import { useKitchenHud } from "./hudStore";
import { LEVELS, type PizzaLevel } from "./levels";
import { AIM_Z, COLORS, FOV, KITCHENS, panHalf, viewFor, type KitchenLook } from "./looks";
import Decor from "./Decor";
import { TUNING, createRun, frame, kitchenHalf, nearestStation, type Pizza as PizzaState, type Run } from "./rules";

const COUNTER_Z = -2.05;
const TOP = FIT.counterTop;
const AT = { x: 0, y: 0, z: 0 };
const CHEF_SCALE = ASSETS.chef.scale;
const BOX_H = GLB_SIZE.pizzaBoxClosed.height * (ASSETS.box.scale ?? 1);

const TILE_DRAWS = new Map<KitchenLook, (ctx: CanvasRenderingContext2D, w: number, h: number) => void>();

/** The room's floor tiles, drawn once per look (a stable function, so the texture is drawn once). */
function tilesFor(look: KitchenLook) {
   let draw = TILE_DRAWS.get(look);
   if (!draw) {
      draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
         ctx.fillStyle = look.grout;
         ctx.fillRect(0, 0, w, h);
         const n = 4;
         const s = w / n;
         for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
               ctx.fillStyle = (i + j) % 2 ? look.tile : look.tileAlt;
               ctx.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
            }
         }
      };
      TILE_DRAWS.set(look, draw);
   }
   return draw;
}

function Disc({ radius, color, y = 0, height = 0.03 }: { radius: number; color: string; y?: number; height?: number }) {
   return (
      <mesh position={[0, y, 0]}>
         <cylinderGeometry args={[radius, radius, height, 28]} />
         <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
   );
}

const TOPPING_SPOTS: InstanceSpot[] = Array.from({ length: 5 }, (_, i) => ({ x: Math.cos(i * 2.4) * 0.17, y: 0.085, z: Math.sin(i * 2.4) * 0.17 }));

/** A pizza as the build reads: the base GLB, a sauce disc, a cheese disc, then each topping in place. */
function Pizza({ pizza, run }: { pizza: PizzaState; run: Run }) {
   const ings = run.tickets[pizza.ticket].ingredients;
   const r = FIT.base / 2;
   return (
      <group>
         <Model asset={ASSETS.pizzaBase} fallback={<Disc radius={r} color={COLORS.dough} y={0.03} height={0.06} />} />
         {pizza.added > 0 && <Disc radius={r * 0.82} color={COLORS.sauce} y={0.07} height={0.012} />}
         {pizza.added > 1 && <Disc radius={r * 0.76} color={COLORS.cheese} y={0.078} height={0.012} />}
         {ings.slice(2, pizza.added).map((ing, k) => {
            const spots = TOPPING_SPOTS.slice(k, 5).filter((_, i) => i % 2 === 0);
            const ball = (
               <Instanced spots={spots}>
                  <sphereGeometry args={[0.035, 8, 6]} />
                  <meshStandardMaterial color={COLORS[ing]} roughness={0.5} />
               </Instanced>
            );
            if (ing === "pepperoni" || ing === "tomato" || ing === "onion") return <InstancedModel key={ing} asset={ASSETS[ing]} spots={spots} fallback={ball} />;
            return <group key={ing}>{ball}</group>;
         })}
      </group>
   );
}

function Chef({ run }: { run: Run }) {
   const ref = useRef<Group>(null);
   const time = useGameTime();
   const gait = useRef({ phase: 0, yaw: Math.PI });
   const pose = useHumanoidPose((p) => {
      const speed = Math.hypot(run.player.vx, run.player.vz);
      const amount = Math.min(1, speed / TUNING.speed) * 0.85;
      if (amount > 0.05) gait.current.phase = wrapPhase(gait.current.phase + ((speed * time.delta) / (walkStride(Math.max(0.3, amount), CHEF_LANDMARKS) * CHEF_SCALE)) * Math.PI * 2);
      if (run.end === "win") cheerPose(time.now, p);
      else if (run.time < run.reachUntil && !run.carried) reachPose(1, 0.5, p);
      else if (run.carried) carryPose(0.15, p);
      else if (amount > 0.05) walkPose(gait.current.phase, amount, p);
      else idlePose(time.now, p);
   });
   useFrame(() => {
      const g = ref.current;
      if (!g) return;
      const speed = Math.hypot(run.player.vx, run.player.vz);
      const want = speed > 0.3 ? Math.atan2(run.player.vx, run.player.vz) : run.time < run.reachUntil || speed <= 0.3 ? Math.PI : gait.current.yaw;
      let d = want - gait.current.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      gait.current.yaw += d * Math.min(1, time.delta * 12);
      g.position.set(run.player.x, 0, run.player.z);
      g.rotation.y = gait.current.yaw;
   }, FRAME_PRIORITY.visuals);
   return (
      <group ref={ref}>
         <HumanoidModel
            asset={ASSETS.chef}
            pose={pose}
            fallback={
               <group>
                  <mesh position={[0, 0.9, 0]}>
                     <capsuleGeometry args={[0.24, 0.7, 6, 12]} />
                     <meshStandardMaterial color={COLORS.tile} />
                  </mesh>
                  <mesh position={[0, 1.6, 0]}>
                     <sphereGeometry args={[0.18, 14, 10]} />
                     <meshStandardMaterial color={COLORS.skin} />
                  </mesh>
               </group>
            }
         />
      </group>
   );
}

/** The parts that change: the counter pizza, the carried pizza on its peel, the ovens' glow, the station ring. */
function Live({ run }: { run: Run }) {
   const [, setTick] = useState(0);
   const acc = useRef(0);
   const time = useGameTime();
   useFrame(() => {
      acc.current += time.delta;
      if (acc.current >= 1 / 12) {
         acc.current = 0;
         useKitchenHud.getState().publish(run);
         setTick((v) => (v + 1) % 1e6);
      }
   });
   const active = nearestStation(run);
   const dough = run.stations[0];
   return (
      <>
         {active && (
            <mesh position={[active.x, 0.012, TUNING.minZ]} rotation-x={-Math.PI / 2}>
               <ringGeometry args={[0.42, 0.5, 32]} />
               <meshBasicMaterial color={COLORS.accent} />
            </mesh>
         )}
         {run.prep && (
            <group position={[dough.x + 0.8, TOP, COUNTER_Z + 0.5]}>
               <Pizza pizza={run.prep} run={run} />
            </group>
         )}
         {run.carried && (
            <group position={[run.player.x, 1.0, run.player.z + 0.55]}>
               <Model asset={ASSETS.peel} rotation-y={Math.PI / 2} fallback={<Disc radius={0.36} color={COLORS.wood} />} />
               <group position={[0, 0.04, 0]}>
                  {run.carried.boxed ? <Model asset={ASSETS.box} fallback={<Disc radius={0.32} color={COLORS.tile} height={0.12} />} /> : <Pizza pizza={run.carried} run={run} />}
               </group>
            </group>
         )}
         {run.ovens.map((o, i) => {
            const s = run.stations.find((x) => x.id === `oven${i}`)!;
            const age = o ? run.time - o.startedAt : 0;
            const golden = o && age >= run.level.bakeS;
            return (
               <mesh key={i} position={[s.x, 0.62, COUNTER_Z + 0.62]}>
                  <circleGeometry args={[0.3, 24]} />
                  <meshBasicMaterial color={golden ? "#fde047" : o ? COLORS.glow : "#44403c"} transparent opacity={o ? 0.9 : 0.5} />
               </mesh>
            );
         })}
      </>
   );
}

function LevelScene() {
   const { id, config } = useLevel<PizzaLevel>();
   const level = config ?? LEVELS[1];
   const portrait = useThree((s) => s.size.width < s.size.height);
   const view = useFittedView(viewFor(id, portrait));
   const pan = panHalf(level, portrait);
   const aimBounds = useMemo(() => ({ min: { x: -pan, y: 0, z: AIM_Z }, max: { x: pan, y: 0, z: AIM_Z } }), [pan]);
   const input = useInput();
   const fx = useFx();
   const [run] = useState<Run>(() => createRun(randomSeed(), level));
   const dir = useRef({ x: 0, z: 0 }).current;
   // camera views (core/camera): the stick turns with the drawn camera's yaw
   const cam = useCameraViews({
      slug: "pizza-kitchen-3d",
      subject: "character",
      steering: "camera",
      defaultYaw: view.yaw,
      target: (o) => {
         const p = run.player;
         o.x = p.x;
         o.y = 1.1;
         o.z = p.z;
         if (Math.hypot(p.vx, p.vz) > 0.3) o.heading = Math.atan2(p.vx, p.vz);
         else if (o.heading === 0) o.heading = Math.PI; // before the first step: facing the counters
         o.vx = p.vx;
         o.vz = p.vz;
      },
   });
   // the camera pans along the row with the cook (L3-L5 on narrow screens), never past its ends
   const aim = useRef({ x: Math.max(-pan, Math.min(pan, run.player.x)), y: 0, z: AIM_Z }).current;
   const half = kitchenHalf(level);
   const crateTop = SHARED_GLB_SIZE.crate.height * (ASSETS.crate.scale ?? 1);

   const counters = useMemo(() => run.stations.filter((s) => !s.id.startsWith("oven")).map((s): InstanceSpot => ({ x: s.x, y: 0, z: COUNTER_Z })), [run]);
   const ovens = useMemo(() => run.stations.filter((s) => s.id.startsWith("oven")).map((s): InstanceSpot => ({ x: s.x, y: 0, z: COUNTER_Z - 0.05 })), [run]);
   const steelBowls = useMemo(
      () => run.stations.filter((s) => s.id === "pepperoni" || s.id === "tomato" || s.id === "onion").map((s): InstanceSpot => ({ x: s.x, y: TOP, z: COUNTER_Z + 0.1 })),
      [run]
   );
   const room = KITCHENS[level.theme];
   const floor = useCanvasTexture(256, 256, tilesFor(room));
   useMemo(() => {
      floor.wrapS = RepeatWrapping;
      floor.wrapT = RepeatWrapping;
      floor.repeat.set(30, 20);
      floor.needsUpdate = true;
   }, [floor]);

   useEffect(() => {
      fx.warm("sparkle", "puff", "confetti", "score");
      useKitchenHud.getState().publish(run);
      return () => useKitchenHud.setState({ run: null });
   }, [run, fx]);

   useRunFrame((_s, dt) => {
      const { moveX, moveY, actionPressed } = input.current;
      inputToWorld(moveX, moveY, cam.yaw(), dir);
      frame(run, dt, dir.x, dir.z, actionPressed, useArcadeStore);
      aim.x = Math.max(-pan, Math.min(pan, run.player.x));
      for (const ev of run.events) {
         AT.x = run.player.x;
         AT.y = 1.4;
         AT.z = run.player.z;
         if (ev === "serve") {
            playSfx("chime");
            fx.burst("sparkle", AT, 16);
            fx.score(AT, `+${run.lastPoints}`, { color: "#fde68a" });
            if (run.end === "win") {
               playSfx("win");
               fx.burst("confetti", AT, 36);
            }
         } else if (ev === "spoil" || ev === "burnt") {
            playSfx("buzz");
            fx.shake(0.15);
            fx.burst("puff", AT, 10);
         } else if (ev === "add" || ev === "dough" || ev === "box") playSfx("pop", { volume: 0.5 });
         else if (ev === "ovenIn") playSfx("whoosh", { volume: 0.5 });
         else if (ev === "takeOut") playSfx(run.carried?.perfect ? "combo" : "pickup");
         else if (ev === "expire") playSfx("lose", { volume: 0.5 });
      }
   });

   return (
      <>
         <CameraRig camera={{ position: view.offset, fov: FOV, lookAt: [aim.x, 0, AIM_Z] }} follow={aim} bounds={aimBounds} offset={view.offset} shift={view.shift} damping={5} />
         {/* tiled floor and a long back wall reach past the view on every screen */}
         <mesh rotation-x={-Math.PI / 2} position={[0, 0, 6]}>
            <planeGeometry args={[60, 40]} />
            <meshStandardMaterial map={floor} roughness={0.75} />
         </mesh>
         <mesh position={[0, 2.2, COUNTER_Z - 0.75]}>
            <boxGeometry args={[60, 4.4, 0.2]} />
            <meshStandardMaterial color={room.wall} roughness={0.9} />
         </mesh>
         <mesh position={[0, 0.08, COUNTER_Z - 0.62]}>
            <boxGeometry args={[60, 0.16, 0.06]} />
            <meshStandardMaterial color={room.skirting} roughness={0.7} />
         </mesh>
         {/* side counters close the line at both ends */}
         <InstancedModel
            asset={ASSETS.counter}
            spots={counters}
            fallback={
               <>
                  <Instanced spots={counters.map((s) => ({ ...s, y: TOP / 2, sx: 1.56, sy: TOP, sz: 0.9 }))}>
                     <boxGeometry />
                     <meshStandardMaterial color={room.darkWood} roughness={0.7} />
                  </Instanced>
                  <Instanced spots={counters.map((s) => ({ ...s, y: TOP, sx: 1.6, sy: 0.06, sz: 0.95 }))}>
                     <boxGeometry />
                     <meshStandardMaterial color={room.wood} roughness={0.55} />
                  </Instanced>
               </>
            }
         />
         <InstancedModel
            asset={ASSETS.oven}
            spots={ovens}
            fallback={
               <Instanced spots={ovens.map((s) => ({ ...s, y: 0.62, sx: 1.4, sy: 1.24, sz: 1.1 }))}>
                  <boxGeometry />
                  <meshStandardMaterial color={room.oven} roughness={0.5} metalness={0.3} />
               </Instanced>
            }
         />
         {steelBowls.length > 0 && (
            <Instanced spots={steelBowls}>
               <cylinderGeometry args={[0.22, 0.17, 0.12, 20]} />
               <meshStandardMaterial color={COLORS.steel} metalness={0.6} roughness={0.3} />
            </Instanced>
         )}
         {run.stations.map((s) => {
            const at: [number, number, number] = [s.x, TOP, COUNTER_Z + 0.1];
            if (s.id === "dough") return <Model key={s.id} asset={ASSETS.pizzaBase} position={[s.x - 0.25, TOP, COUNTER_Z]} fallback={<Disc radius={0.3} color={COLORS.dough} height={0.06} />} />;
            if (s.id === "sauce") return <Model key={s.id} asset={ASSETS.sauceBowl} position={at} fallback={<Disc radius={0.22} color={COLORS.sauce} height={0.12} />} />;
            if (s.id === "cheese") return <Model key={s.id} asset={ASSETS.cheeseBowl} position={at} fallback={<Disc radius={0.22} color={COLORS.cheese} height={0.12} />} />;
            if (s.id === "mushroom") return <Model key={s.id} asset={ASSETS.mushroom} position={at} fallback={<Disc radius={0.22} color={COLORS.mushroom} height={0.12} />} />;
            if (s.id === "olive") return <Model key={s.id} asset={ASSETS.olive} position={at} fallback={<Disc radius={0.22} color={COLORS.olive} height={0.12} />} />;
            if (s.id === "pepperoni" || s.id === "tomato" || s.id === "onion") {
               const pile = s.id === "pepperoni" ? ASSETS.pepperoniPile : s.id === "tomato" ? ASSETS.tomatoPile : ASSETS.onionPile;
               return <Model key={s.id} asset={pile} position={[s.x, TOP + 0.06, COUNTER_Z + 0.1]} fallback={<Disc radius={0.16} color={COLORS[s.id]} height={0.08} />} />;
            }
            if (s.id === "box")
               return (
                  <group key={s.id} position={at}>
                     {[0, 1, 2].map((k) => (
                        <Model key={k} asset={ASSETS.box} position={[0, k * BOX_H, 0]} rotation-y={k * 0.2} fallback={<Disc radius={0.3} color={COLORS.tile} height={0.16} />} />
                     ))}
                  </group>
               );
            if (s.id === "serve")
               return (
                  <mesh key={s.id} position={[s.x, TOP + 0.02, COUNTER_Z + 0.1]}>
                     <boxGeometry args={[1.2, 0.04, 0.7]} />
                     <meshStandardMaterial color={COLORS.hatch} emissive={COLORS.hatch} emissiveIntensity={0.25} />
                  </mesh>
               );
            return null;
         })}
         {/* the row's two ends: the spoil bin left of the dough, a flour crate with spare boxes right of the hatch */}
         <Model asset={ASSETS.bin} position={[-half + 0.02, 0, COUNTER_Z + 0.15]} fallback={<Disc radius={0.2} color={COLORS.steelDark} y={0.4} height={0.8} />} />
         <group position={[half - 0.02, 0, COUNTER_Z]}>
            <Model asset={ASSETS.crate} fallback={<Disc radius={0.35} color={COLORS.wood} y={crateTop / 2} height={crateTop} />} />
            {[0, 1].map((k) => (
               <Model key={k} asset={ASSETS.box} position={[0, crateTop + k * BOX_H, 0]} rotation-y={k * 0.3} fallback={<Disc radius={0.3} color={COLORS.tile} y={0.08} height={0.16} />} />
            ))}
         </group>
         <Decor level={level} />
         <Live run={run} />
         <Chef run={run} />
      </>
   );
}

export default function Scene() {
   return <LevelScene />;
}
