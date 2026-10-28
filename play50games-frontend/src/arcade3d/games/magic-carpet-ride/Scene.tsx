"use client";

// One useRunFrame steps rules.ts (step + syncStore); visuals read the run and animate on useGameTime.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, Color, Euler, Matrix4, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, OctahedronGeometry, Quaternion, TorusGeometry, Vector3, type Group } from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { playSfx, startLoop, type LoopHandle } from "@/arcade3d/core/audio";
import { SkyDome, Starfield } from "@/arcade3d/core/env";
import { EyeRig } from "@/arcade3d/core/EyeRig";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed } from "@/arcade3d/core/math";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { DynamicInstanced, Instanced, patchClothWave, type FlapClock, type InstancePart, type WingFlap } from "@/arcade3d/core/render";
import { BONE, HumanoidModel, POSE_MASK, blendPoses, cheerPose, createPose, flailPose, sitPose, turnBone, useHumanoidPose } from "@/arcade3d/core/rig";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS, OBSTACLE_ASSET, SEAT_Y, SEAT_Z } from "./assets";
import type { CarpetLevel, ObstacleKind } from "./levels";
import { BIOME_LOOK, BOOST_FOV, CAM_FOLLOW, CAM_LEAN, COLORS, camFor, decorSpots, type DecorKind } from "./looks";
import { CarpetPrimitive, RiderFigure } from "./Primitives";
import { BANK_MAX, MERCY, createRun, poseAt, ringValue, step, syncStore, type Run } from "./rules";

const AT = { x: 0, y: 0, z: 0 };
const V = new Vector3();
const Q = new Quaternion();
const E = new Euler();
const S = new Vector3();
const X = new Vector3();
const Y = new Vector3();
const Z = new Vector3();
const GOLD = new Color("#ffffff");
const NEXT = new Color(COLORS.ringNext);
const DIM = new Color(COLORS.ringDim);
const GEM_TINTS = [COLORS.gemRuby, COLORS.gemEmerald, COLORS.gemSapphire, COLORS.gemAmethyst].map((c) => new Color(c));

/** Wing beats of the birds and bats (rad / Hz): a gull glides with slow beats, a bat flutters. */
const FLAPS: Partial<Record<ObstacleKind, WingFlap>> = {
   gull: { rate: 2.2, amplitude: 0.55, body: 0.2 },
   bat: { rate: 5.5, amplitude: 0.7, body: 0.16 },
   hawk: { rate: 1.8, amplitude: 0.5, body: 0.18 },
};

/** Stand-ins (until a GLB loads or if one breaks): a ring, a coin, a gem, a rocket. */
const RING_PARTS: InstancePart[] = [{ geometry: new TorusGeometry(1.6, 0.13, 8, 28), material: new MeshStandardMaterial({ color: COLORS.ring, emissive: COLORS.ring, emissiveIntensity: 0.35, metalness: 0.3, roughness: 0.3 }) }];
const COIN_PARTS: InstancePart[] = [{ geometry: new TorusGeometry(0.28, 0.1, 6, 16), material: new MeshStandardMaterial({ color: COLORS.ring, metalness: 0.6, roughness: 0.3 }) }];
const GEM_PARTS: InstancePart[] = [{ geometry: new OctahedronGeometry(0.45, 0), material: new MeshStandardMaterial({ color: "#ffffff", emissive: "#a78bfa", emissiveIntensity: 0.3, roughness: 0.2 }) }];

/** The sky lanterns' halo (additive, so it glows in the night fog). */
const HALO_PARTS: InstancePart[] = [{ geometry: new SphereGeometry(1, 12, 8), material: new MeshBasicMaterial({ color: COLORS.lanternGlow, transparent: true, opacity: 0.45, depthWrite: false, blending: AdditiveBlending, fog: false }) }];

const DECOR_KINDS: readonly DecorKind[] = ["roof", "tower", "palm", "pyramid", "mesa", "cloud", "islandCastle", "islandFalls", "islandMill", "lantern", "palace"];
const DECOR_ASSET: Record<DecorKind, (typeof ASSETS)[keyof typeof ASSETS]> = {
   roof: ASSETS.roof,
   tower: ASSETS.tower,
   palm: ASSETS.palm,
   pyramid: ASSETS.pyramid,
   mesa: ASSETS.mesa,
   cloud: ASSETS.cloud,
   islandCastle: ASSETS.islandCastle,
   islandFalls: ASSETS.islandFalls,
   islandMill: ASSETS.islandMill,
   lantern: ASSETS.lantern,
   palace: ASSETS.palace,
};
/** Draw only what is this close ahead of the carpet (m) or just behind it. */
const AHEAD = 150;
const BEHIND = 12;

/** The finish: a glowing gate across the end of the lane (a marker, so it stays in code). */
function FinishGate() {
   return (
      <group>
         <mesh>
            <torusGeometry args={[7.5, 0.35, 12, 48]} />
            <meshStandardMaterial color={COLORS.finish} emissive={COLORS.finish} emissiveIntensity={1.1} roughness={0.3} />
         </mesh>
         <mesh>
            <torusGeometry args={[6.6, 0.12, 8, 48]} />
            <meshStandardMaterial color={COLORS.accent} emissive={COLORS.accent} emissiveIntensity={1.2} roughness={0.3} />
         </mesh>
      </group>
   );
}

export default function Scene() {
   const { id, config } = useLevel<CarpetLevel>();
   const input = useInput();
   const fx = useFx();
   const time = useGameTime();
   const quality = useQuality();
   const [run] = useState<Run>(() => createRun(randomSeed(), config, id));
   const look = BIOME_LOOK[config.biome];
   const decor = useMemo(() => decorSpots(run, config.biome), [run, config.biome]);
   const decorShown = useMemo(() => {
      const out = {} as Record<DecorKind, typeof decor.roof>;
      for (const k of DECOR_KINDS) out[k] = k === "palace" ? decor[k] : decor[k].slice(0, scaledCount(decor[k].length, quality.decor));
      return out;
   }, [decor, quality.decor]);
   // a warm halo round every lantern on the night lane (particles stay in code)
   const glows = useMemo(() => decorShown.lantern.map((sp) => ({ x: sp.x, y: sp.y + (sp.sy ?? 1) * 0.45, z: sp.z, scale: 1.1 })), [decorShown]);
   const kinds = useMemo(() => Array.from(new Set(run.obstacles.map((o) => o.kind))), [run]);
   const byKind = useMemo(() => {
      const out = {} as Record<ObstacleKind, number[]>;
      run.obstacles.forEach((o, i) => (out[o.kind] ??= []).push(i));
      return out;
   }, [run]);
   const finish = useMemo(() => {
      const at = { x: 0, y: 0, z: 0 };
      poseAt(run.path, run.path.total, 0, 0, run.scratch, at);
      return { ...at, yaw: Math.atan2(run.scratch.t.x, run.scratch.t.z) };
   }, [run]);

   // camera: a chase eye behind and above the carpet, eased, leaning into the turns
   const cam = useRef({ x: 0, y: 0, z: 0 }).current;
   const camYaw = useRef(run.yaw);
   const portrait = useThree((state) => state.size.width < state.size.height);
   const view = camFor(portrait);
   const camPitch = useRef(view.pitch);
   const camRoll = useRef(0);
   const camFov = useRef(view.fov);
   const follow = useRef({ lat: 0, vert: 0, roll: 0 }).current;
   const camAt = useRef({ x: 0, y: 0, z: 0 }).current;
   const placeCamera = (dt: number, snap: boolean) => {
      const e = snap ? 1 : 1 - Math.exp(-5 * dt);
      follow.lat += (run.lat * CAM_FOLLOW - follow.lat) * e;
      follow.vert += (run.vert * CAM_FOLLOW - follow.vert) * e;
      follow.roll += (run.roll * CAM_LEAN - follow.roll) * (snap ? 1 : 1 - Math.exp(-4 * dt));
      poseAt(run.path, Math.max(0, run.s - view.back), follow.lat, follow.vert + view.up, run.scratch, camAt);
      cam.x = camAt.x;
      cam.y = camAt.y;
      cam.z = camAt.z;
      // face the carpet's lane a little ahead, turned slightly into the drift
      poseAt(run.path, Math.min(run.path.total, run.s + 10), follow.lat, follow.vert, run.scratch, camAt);
      camYaw.current = Math.atan2(camAt.x - cam.x, camAt.z - cam.z) - run.vLat * 0.006;
      camPitch.current = view.pitch - run.climb * 0.5;
      // the eye banks with the carpet (its right side dips into a right turn): the camera's own roll is the opposite sign
      camRoll.current = -follow.roll;
      const wantFov = view.fov + (run.boostT > 0 ? BOOST_FOV : 0);
      camFov.current += (wantFov - camFov.current) * (snap ? 1 : 1 - Math.exp(-6 * dt));
   };
   useLayoutEffect(() => placeCamera(0, true));

   const body = useRef<Group>(null);
   const carpetCloth = useRef<Group>(null);
   const groundRef = useRef<Group>(null);
   const gate = useRef<Group>(null);
   const wind = useRef<LoopHandle | null>(null);
   const fxState = useRef({ trail: 0, sparkle: 0, hitAt: -99, winAt: -99, patched: false }).current;
   const cloth = useMemo<FlapClock>(() => ({ value: 0 }), []);
   const scratch = useMemo(() => createPose(), []);

   useEffect(() => {
      fx.warm("sparkle", "score", "puff", "confetti", "sparks");
      const loop = startLoop("hum", { volume: 0.05, pitch: 0.85 });
      wind.current = loop;
      return () => loop.stop();
   }, [fx]);

   // the rider: cross-legged (core sitPose), swaying with the flight, leaning into the turns and
   // forward on a boost; arms up on the win, a flail when hit
   const pose = useHumanoidPose((p) => {
      const t = time.now;
      sitPose(1, p, 1);
      const turn = run.roll / BANK_MAX;
      turnBone(p, BONE.spine, run.boostT > 0 ? 0.22 : 0.04 * Math.sin(t * 1.3), 0.06 * Math.sin(t * 0.7), turn * 0.18 + 0.03 * Math.sin(t * 1.1));
      turnBone(p, BONE.head, -0.05, -turn * 0.25 + 0.1 * Math.sin(t * 0.5), -turn * 0.08);
      if (run.over === "win") blendPoses(p, cheerPose(t, scratch), 1, p, POSE_MASK.arms);
      else if (time.now - fxState.hitAt < 0.7) blendPoses(p, flailPose(t, scratch), 1, p, POSE_MASK.arms);
   });

   useRunFrame((_state, dt) => {
      const { moveX, moveY } = input.current;
      const store = useArcadeStore.getState();
      const ev = step(run, { moveX, moveY }, dt, store.timeLeftMs ?? 0);
      syncStore(run, ev, useArcadeStore);
      wind.current?.set({ volume: run.over ? 0 : run.boostT > 0 ? 0.2 : 0.06, pitch: run.boostT > 0 ? 1.2 : 0.85 + Math.abs(run.vLat) * 0.02 });
      if (ev.ring >= 0) {
         const ring = run.rings[ev.ring];
         AT.x = ring.x;
         AT.y = ring.y;
         AT.z = ring.z;
         fx.burst("sparkle", AT, 18);
         fx.score(AT, run.chain >= 2 ? `+${ringValue(run.chain)}  x${run.chain}` : `+${ringValue(run.chain)}`, { color: run.chain >= 2 ? COLORS.comboText : undefined, size: run.chain >= 2 ? 0.08 : 0.06 });
         playSfx(run.chain >= 2 ? "combo" : "chime", { pitch: Math.min(1.6, 1 + (run.chain - 1) * 0.08) });
      }
      if (ev.coin >= 0) {
         const c = run.coins[ev.coin];
         AT.x = c.x;
         AT.y = c.y;
         AT.z = c.z;
         fx.burst("sparkle", AT, 4);
         playSfx("pickup", { volume: 0.35, pitch: 1.3 + (ev.coin % 5) * 0.06 });
      }
      if (ev.gem >= 0) {
         const g = run.gems[ev.gem];
         AT.x = g.x;
         AT.y = g.y;
         AT.z = g.z;
         fx.burst("confetti", AT, 12);
         fx.score(AT, "+50 gem", { color: COLORS.gemText });
         playSfx("pop");
      }
      if (ev.boost >= 0) {
         AT.x = run.carpet.x;
         AT.y = run.carpet.y;
         AT.z = run.carpet.z;
         fx.burst("sparks", AT, 16);
         fx.score(AT, "BOOST!", { color: "#fdba74", size: 0.08 });
         playSfx("whoosh", { volume: 0.7, pitch: 1.25 });
      }
      if (ev.hit >= 0) {
         fxState.hitAt = time.now;
         AT.x = run.carpet.x;
         AT.y = run.carpet.y;
         AT.z = run.carpet.z;
         fx.burst("puff", AT, 12);
         fx.shake(0.35);
         playSfx("hit");
      }
      if (ev.missedRing) playSfx("buzz", { volume: 0.25 });
      if (ev.won) {
         fxState.winAt = time.now;
         fx.burst("confetti", AT, 30);
         playSfx("win");
      }
      if (ev.lost) playSfx("lose");
      // a sparkle trail off the carpet's tassels, thicker on a boost
      if (!run.over && time.now - fxState.trail > (run.boostT > 0 ? 0.05 : 0.16)) {
         fxState.trail = time.now;
         const back = 1.6;
         AT.x = run.carpet.x - Math.sin(run.yaw) * back;
         AT.y = run.carpet.y + 0.1;
         AT.z = run.carpet.z - Math.cos(run.yaw) * back;
         fx.burst("sparkle", AT, run.boostT > 0 ? 5 : 2);
      }
   });

   useFrame(() => {
      const dt = Math.min(0.1, time.delta);
      placeCamera(dt, false);
      cloth.value = time.now;
      const g = body.current;
      if (g) {
         const bob = Math.sin(time.now * 2.1) * 0.06;
         g.position.set(run.carpet.x, run.carpet.y + bob, run.carpet.z);
         // heading along the lane, nose up with the climb and the drift, banked into the turn
         g.rotation.set(-(run.climb + run.pitch) + Math.sin(time.now * 1.7) * 0.02, run.yaw, run.roll + Math.sin(time.now * 1.3) * 0.02, "YXZ");
         // blink through the mercy after a hit
         g.visible = run.mercy <= 0 || Math.floor(run.mercy * 12) % 2 === 0 || run.mercy > MERCY - 0.05;
      }
      // the carpet's cloth ripples once its GLB is in
      if (!fxState.patched && carpetCloth.current) fxState.patched = patchClothWave(carpetCloth.current, { amplitude: 0.045, wavelength: 0.9, speed: 1.6 }, cloth) > 0;
      groundRef.current?.position.set(run.carpet.x, look.groundY, run.carpet.z);
      if (gate.current) gate.current.rotation.z = time.now * 0.6;
   }, FRAME_PRIORITY.visuals);

   const inView = (s: number) => s > run.s - BEHIND && s < run.s + AHEAD;

   const placeRing = (i: number, m: Matrix4, color: Color) => {
      const r = run.rings[i];
      if (!r || r.taken || !inView(r.s)) return false;
      // (left, up, forward) is a right-handed basis: the ring faces along the lane
      X.set(-r.rx, -r.ry, -r.rz);
      Y.set(r.ux, r.uy, r.uz);
      Z.set(r.tx, r.ty, r.tz);
      m.makeBasis(X, Y, Z);
      // the next ring pulses
      const k = i === run.nextRing ? 1 + Math.sin(time.now * 6) * 0.06 : 1;
      m.scale(S.set(k, k, k));
      m.setPosition(r.x, r.y, r.z);
      color.copy(i === run.nextRing ? NEXT : r.missed ? DIM : GOLD);
   };
   const placeCoin = (i: number, m: Matrix4) => {
      const c = run.coins[i];
      if (!c || c.taken || !inView(c.s)) return false;
      E.set(0, time.now * 3 + i * 0.4, 0);
      Q.setFromEuler(E);
      V.set(c.x, c.y + Math.sin(time.now * 2 + i) * 0.08, c.z);
      m.compose(V, Q, S.set(1, 1, 1));
   };
   const placeGem = (i: number, m: Matrix4, color: Color) => {
      const g = run.gems[i];
      if (!g || g.taken || !inView(g.s)) return false;
      E.set(0.3 * Math.sin(time.now + i), time.now * 1.6 + i, 0);
      Q.setFromEuler(E);
      const k = 1 + Math.sin(time.now * 4 + i) * 0.08;
      V.set(g.x, g.y + Math.sin(time.now * 1.5 + i) * 0.15, g.z);
      m.compose(V, Q, S.set(k, k, k));
      color.copy(GEM_TINTS[i % GEM_TINTS.length]);
   };
   const placeBoost = (i: number, m: Matrix4) => {
      const b = run.boosts[i];
      if (!b || b.taken || !inView(b.s)) return false;
      // the rocket points along the lane (its nose up the GLB's y), spinning about it
      tangentYaw(b.s);
      E.set(Math.PI / 2, LANE_YAW.v, time.now * 4, "YXZ");
      Q.setFromEuler(E);
      V.set(b.x, b.y + Math.sin(time.now * 3 + i) * 0.12, b.z);
      m.compose(V, Q, S.set(1, 1, 1));
   };
   const LANE_YAW = { v: 0 };
   const tangentYaw = (s: number) => {
      poseAt(run.path, s, 0, 0, run.scratch, AT);
      LANE_YAW.v = Math.atan2(run.scratch.t.x, run.scratch.t.z);
   };

   // each obstacle kind as a pool; flyers face the oncoming carpet, bank with their swing and bob
   const placeObstacle = (kind: ObstacleKind) => (i: number, m: Matrix4) => {
      const o = run.obstacles[byKind[kind]?.[i] ?? -1];
      if (!o || !inView(o.s)) return false;
      const t = time.now;
      let yaw = o.yaw + Math.PI;
      let pitch = 0;
      let roll = 0;
      if (kind === "gull" || kind === "hawk" || kind === "bat") {
         // facing the carpet, banking with the sideways swing
         roll = Math.cos(t * 1.9 + o.phase) * 0.35;
         pitch = 0.25;
      } else if (kind === "rock") {
         yaw = o.phase + t * 0.3;
         pitch = Math.PI + Math.sin(t * 0.5 + o.phase) * 0.2;
         roll = t * 0.2;
      } else if (kind === "balloon" || kind === "hotAir" || kind === "lantern") {
         yaw = o.phase + t * 0.15;
         roll = Math.sin(t * 0.8 + o.phase) * 0.08;
      } else if (kind === "blimp") {
         // side on, drifting across
         yaw = o.yaw + Math.PI / 2 + Math.sin(t * 0.3) * 0.15;
         roll = Math.sin(t * 0.6) * 0.05;
      }
      E.set(pitch, yaw, roll, "YXZ");
      Q.setFromEuler(E);
      V.set(o.x, o.y, o.z);
      m.compose(V, Q, S.set(1, 1, 1));
   };
   const placeHalo = (i: number, m: Matrix4) => {
      const o = run.obstacles[byKind.lantern?.[i] ?? -1];
      if (!o || !inView(o.s)) return false;
      const k = 1.0 + Math.sin(time.now * 5 + i) * 0.1;
      Q.identity();
      m.compose(V.set(o.x, o.y, o.z), Q, S.set(k, k * 1.3, k));
   };
   const updaters = useMemo(() => {
      const out = {} as Record<ObstacleKind, (i: number, m: Matrix4) => false | void>;
      for (const k of kinds) out[k] = placeObstacle(k);
      return out;
      // the run never changes within a mount
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [kinds]);

   return (
      <>
         <EyeRig position={{ current: cam }} yaw={camYaw} pitch={camPitch} roll={camRoll} fov={camFov} />
         <SkyDome top={look.skyTop} bottom={config.background} radius={300} />
         {config.biome === "night" && <Starfield count={500} radius={260} size={1.6} />}
         {glows.length > 0 && (
            <Instanced spots={glows} name="lantern-glow">
               <sphereGeometry args={[1, 12, 8]} />
               <meshBasicMaterial color={COLORS.lanternGlow} transparent opacity={0.4} depthWrite={false} blending={AdditiveBlending} fog={false} />
            </Instanced>
         )}
         <group ref={groundRef}>
            <mesh rotation-x={-Math.PI / 2}>
               <planeGeometry args={[700, 700]} />
               <meshStandardMaterial color={look.ground} roughness={0.95} />
            </mesh>
         </group>

         {DECOR_KINDS.map((k) =>
            decorShown[k].length === 0 ? null : (
               <InstancedModel
                  key={k}
                  asset={DECOR_ASSET[k]}
                  spots={decorShown[k]}
                  fallback={
                     <Instanced spots={decorShown[k]} name={`${k}-stand-in`}>
                        <boxGeometry args={[1, 1, 1]} />
                        <meshStandardMaterial color={DECOR_ASSET[k].fallbackColor} roughness={0.8} />
                     </Instanced>
                  }
               />
            )
         )}

         <DynamicInstancedModel asset={ASSETS.ring} count={run.rings.length} update={placeRing} fallbackParts={RING_PARTS} tinted name="rings" />
         <DynamicInstancedModel asset={ASSETS.coin} count={run.coins.length} update={placeCoin} fallbackParts={COIN_PARTS} name="coins" />
         {run.gems.length > 0 && <DynamicInstancedModel asset={ASSETS.gem} count={run.gems.length} update={placeGem} fallbackParts={GEM_PARTS} tinted name="gems" />}
         {run.boosts.length > 0 && <DynamicInstancedModel asset={ASSETS.boost} count={run.boosts.length} update={placeBoost} name="boosts" />}
         {kinds.map((k) => (
            <DynamicInstancedModel key={k} asset={OBSTACLE_ASSET[k]} count={byKind[k].length} update={updaters[k]} flap={FLAPS[k]} name={`obstacles-${k}`} />
         ))}

         {byKind.lantern && <DynamicInstanced count={byKind.lantern.length} update={placeHalo} parts={HALO_PARTS} name="lantern-halos" />}
         <group ref={gate} position={[finish.x, finish.y, finish.z]} rotation={[0, finish.yaw, 0]}>
            <FinishGate />
         </group>

         <group ref={body}>
            <group ref={carpetCloth}>
               <Model asset={ASSETS.carpet} fallback={<CarpetPrimitive />} />
            </group>
            <group position={[0, SEAT_Y, SEAT_Z]}>
               <HumanoidModel asset={ASSETS.rider} pose={pose} applyLift={false} fallback={<RiderFigure />} />
            </group>
         </group>
      </>
   );
}
