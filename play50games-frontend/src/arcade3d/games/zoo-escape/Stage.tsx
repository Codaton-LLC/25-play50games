"use client";

// The world: terrain, fences and gates (with their drop bars), every prop (GLBs
// instanced, procedural kiosks and tower), bushes, the hide outline, lamp glows at dusk,
// snacks and bamboo bundles, sky dome and outer surroundings.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
   AdditiveBlending,
   BoxGeometry,
   CircleGeometry,
   Color,
   Matrix4,
   MeshBasicMaterial,
   Quaternion,
   Vector3,
   type InstancedMesh,
   type Mesh,
} from "three";
import { InstancedModel } from "@/arcade3d/core/assets";
import { SkyDome } from "@/arcade3d/core/env";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { fenceSpots } from "@/arcade3d/core/kit";
import { createPath } from "@/arcade3d/core/path";
import { DynamicInstanced, Instanced, useCanvasTexture, useInstanceMatrices, type InstanceSpot } from "@/arcade3d/core/render";
import { ASSETS, BAMBOO_CLUMP, BAMBOO_GLB, BAMBOO_THICKET, BAMBOO_UNIT } from "./assets";
import { BUSHES, FENCES, LAMPS, PROPS, STAGES, STAGE_KEEPERS, TOWER } from "./level";
import { COLORS } from "./looks";
import {
   bambooPieces,
   benchPieces,
   binPieces,
   bundlePieces,
   carPieces,
   gatePieces,
   kioskPieces,
   lampPieces,
   palmPieces,
   rockPieces,
   snackPieces,
   towerPieces,
   treePieces,
   bushPieces,
   useMerged,
   type Piece,
} from "./Primitives";
import { TOSS, type RunState } from "./rules";
import { Terrain } from "./Terrain";
import { Decor } from "./Decor";

const BAMBOO_TALL = BAMBOO_GLB.height * BAMBOO_UNIT;
const spotsOf = (kind: string, map: (p: (typeof PROPS)[number]) => InstanceSpot) =>
   PROPS.filter((p) => p.kind === kind).map(map);
const centre = (p: (typeof PROPS)[number]) => ({
   x: (p.box.min.x + p.box.max.x) / 2,
   y: 0,
   z: (p.box.min.z + p.box.max.z) / 2,
});

const SPOTS = {
   rock: spotsOf("rock", (p) => ({ ...centre(p), rotY: p.yaw, sx: p.size, sy: p.size * 1.5, sz: p.size })),
   bamboo: [
      ...spotsOf("bamboo", (p) => ({
         ...centre(p),
         rotY: p.yaw,
         sx: BAMBOO_CLUMP.width,
         sy: BAMBOO_CLUMP.height / BAMBOO_TALL,
         sz: BAMBOO_CLUMP.width,
      })),
      // stage 1's hiding spots are bamboo thickets (Decisions: the bamboo GLB as the hiding clumps)
      ...BUSHES.filter((b) => b.stage === 0).map((b, i) => ({
         x: (b.box.min.x + b.box.max.x) / 2,
         y: 0,
         z: (b.box.min.z + b.box.max.z) / 2,
         rotY: i * 1.3,
         sx: BAMBOO_THICKET.width,
         sy: BAMBOO_THICKET.height / BAMBOO_TALL,
         sz: BAMBOO_THICKET.width,
      })),
   ],
   bench: spotsOf("bench", (p) => ({ ...centre(p), rotY: p.yaw })),
   bin: spotsOf("bin", (p) => ({ ...centre(p) })),
   lamp: spotsOf("lamp", (p) => ({ ...centre(p) })),
   palm: spotsOf("palm", (p) => ({ ...centre(p), rotY: p.yaw })),
   car: spotsOf("car", (p) => ({ ...centre(p), rotY: p.yaw })),
   tree: spotsOf("trunk", (p) => ({ ...centre(p), rotY: p.yaw })),
   kiosk: spotsOf("kiosk", (p) => ({
      ...centre(p),
      sx: p.box.max.x - p.box.min.x,
      sy: 2.6,
      sz: p.box.max.z - p.box.min.z,
   })),
   awning: spotsOf("kiosk", (p) => ({
      ...centre(p),
      y: 2.62,
      sx: p.box.max.x - p.box.min.x + 0.5,
      sy: 0.12,
      sz: p.box.max.z - p.box.min.z + 0.5,
   })),
   bush: BUSHES.filter((b) => b.stage > 0).map((b, i) => ({
      x: (b.box.min.x + b.box.max.x) / 2,
      y: 0,
      z: (b.box.min.z + b.box.max.z) / 2,
      rotY: i * 0.9,
      sx: b.box.max.x - b.box.min.x + 0.5,
      sy: 1.0,
      sz: b.box.max.z - b.box.min.z + 0.5,
   })),
   gate: STAGES.map((s) => ({
      x: (s.gate.x0 + s.gate.x1) / 2,
      y: 0,
      z: s.gate.z,
      sx: s.gate.x1 - s.gate.x0,
      sy: 1,
      sz: 1,
   })),
   fence: (() => {
      const posts: InstanceSpot[] = [],
         rails: InstanceSpot[] = [];
      for (const [x0, z0, x1, z1] of FENCES) {
         const f = fenceSpots(
            createPath([
               { x: x0, y: 0, z: z0 },
               { x: x1, y: 0, z: z1 },
            ]),
            { spacing: 2, height: 1.1, postSize: 0.14, railSize: 0.07 }
         );
         posts.push(...f.posts);
         rails.push(...f.rails);
      }
      return { posts, rails };
   })(),
};

function Merged({
   spots,
   build,
   name,
   emissive,
}: {
   spots: readonly InstanceSpot[];
   build: () => ReturnType<typeof rockPieces>;
   name: string;
   emissive?: boolean;
}) {
   const geometry = useMerged(build);
   return (
      <Instanced spots={spots} name={name}>
         <primitive object={geometry} attach="geometry" />
         {emissive ? (
            <meshBasicMaterial vertexColors toneMapped={false} />
         ) : (
            <meshStandardMaterial vertexColors roughness={0.75} flatShading />
         )}
      </Instanced>
   );
}

function Fences() {
   return (
      <group name="fences">
         <Instanced spots={SPOTS.fence.posts} name="fence-posts">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.post} roughness={0.8} />
         </Instanced>
         <Instanced spots={SPOTS.fence.rails} name="fence-rails">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.rail} roughness={0.7} />
         </Instanced>
         <Merged spots={SPOTS.gate} build={gatePieces} name="gates" />
      </group>
   );
}

function Awnings() {
   const map = useCanvasTexture(128, 32, AWNING);
   return (
      <Instanced spots={SPOTS.awning} name="awnings">
         <boxGeometry args={[1, 1, 1]} />
         <meshStandardMaterial map={map} roughness={0.7} />
      </Instanced>
   );
}
const AWNING = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
   for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? COLORS.white : COLORS.kioskTrim;
      ctx.fillRect((i * w) / 8, 0, w / 8, h);
   }
};

function glow(m: InstancedMesh | null, opacity: number) {
   if (!m) return;
   m.visible = opacity > 0.01;
   (m.material as MeshBasicMaterial).opacity = opacity;
}

/** Lamp glows: off by day, fading in with the dusk of stage 3. */
function LampGlows({ dusk }: { dusk: boolean }) {
   const time = useGameTime();
   const heads = useRef<InstancedMesh>(null);
   const halos = useRef<InstancedMesh>(null);
   const [state] = useState(() => ({ k: 0 }));
   const spots = useMemo(() => LAMPS.map((p) => ({ ...centre(p), y: 2.9 })), []);
   const halo = useMemo(() => LAMPS.map((p) => ({ ...centre(p), y: 0.02 })), []);
   useInstanceMatrices(heads, spots);
   useInstanceMatrices(halos, halo);
   const haloGeometry = useMemo(() => new CircleGeometry(2.4, 24).rotateX(-Math.PI / 2), []);
   useEffect(() => () => haloGeometry.dispose(), [haloGeometry]);
   useFrame(() => {
      state.k += ((dusk ? 1 : 0) - state.k) * (1 - Math.exp(-1.5 * time.delta));
      const flicker = 0.92 + 0.08 * Math.sin(time.now * 3);
      glow(heads.current, state.k * 0.9 * flicker);
      glow(halos.current, state.k * 0.35 * flicker);
   });
   return (
      <group name="lamp-glows">
         <instancedMesh ref={heads} args={[undefined, undefined, spots.length]} visible={false} name="lamp-heads">
            <sphereGeometry args={[0.42, 14, 10]} />
            <meshBasicMaterial
               color={COLORS.lampGlow}
               transparent
               opacity={0}
               blending={AdditiveBlending}
               depthWrite={false}
               toneMapped={false}
            />
         </instancedMesh>
         <instancedMesh ref={halos} args={[undefined, undefined, halo.length]} visible={false} name="lamp-halos">
            <primitive object={haloGeometry} attach="geometry" />
            <meshBasicMaterial
               color={COLORS.lampGlow}
               transparent
               opacity={0}
               blending={AdditiveBlending}
               depthWrite={false}
               toneMapped={false}
            />
         </instancedMesh>
      </group>
   );
}

const Q = new Quaternion();
const V = new Vector3();
const S = new Vector3();
const UP = new Vector3(0, 1, 0);
const MINT = new Color(COLORS.accent);
const CORAL = new Color(COLORS.alert);

/** The drop bars: raised beside the west post until the gate closes, then they swing down across the opening. */
function DropBars({ run }: { run: RunState }) {
   const time = useGameTime();
   const geometry = useMerged(() =>
      Array.from({ length: 6 }, (_, i): Piece => [
         new BoxGeometry(1 / 6, 0.16, 0.16).translate(-0.5 + (i + 0.5) / 6, 0, 0),
         i % 2 ? COLORS.white : COLORS.alert,
      ])
   );
   const [fell] = useState(() => STAGES.map(() => -1));
   const update = (i: number, m: Matrix4) => {
      const g = STAGES[i].gate;
      if (run.bars[i] && fell[i] < 0) fell[i] = time.now;
      const k = fell[i] < 0 ? 0 : Math.min(1, (time.now - fell[i]) / 0.45);
      // eased with a small bounce at the end
      const ease = k < 1 ? 1 - (1 - k) * (1 - k) : 1;
      const a = (Math.PI / 2) * (1 - ease);
      const w = g.x1 - g.x0 - 0.1;
      m.makeRotationZ(a).scale(S.set(w, 1, 1));
      m.setPosition(g.x0 + 0.05 + (Math.cos(a) * w) / 2, 1.0 + (Math.sin(a) * w) / 2, g.z);
   };
   return (
      <DynamicInstanced count={STAGES.length} update={update} name="drop-bars">
         <primitive object={geometry} attach="geometry" />
         <meshStandardMaterial vertexColors roughness={0.6} />
      </DynamicInstanced>
   );
}

/** The mint outline under the bush the panda hides in; it pulses coral while a keeper is within 1.5 m. */
function HideOutline({ run }: { run: RunState }) {
   const time = useGameTime();
   const mesh = useRef<Mesh>(null);
   useFrame(() => {
      const m = mesh.current;
      if (!m) return;
      const h = run.panda.hidden;
      m.visible = h >= 0 && !run.over;
      if (!m.visible) return;
      const b = BUSHES[h].box;
      let near = false;
      for (const i of STAGE_KEEPERS[run.stage]) {
         const a = run.keepers[i].agent;
         const dx = Math.max(b.min.x - a.x, 0, a.x - b.max.x),
            dz = Math.max(b.min.z - a.z, 0, a.z - b.max.z);
         if (Math.hypot(dx, dz) <= 1.5) near = true;
      }
      m.position.set((b.min.x + b.max.x) / 2, 0.03, (b.min.z + b.max.z) / 2);
      m.scale.set((b.max.x - b.min.x) / 2 + 0.15, (b.max.z - b.min.z) / 2 + 0.15, 1);
      const mat = m.material as MeshBasicMaterial;
      const pulse = near ? 0.5 + 0.5 * Math.sin(time.now * 12) : 0;
      mat.color.lerpColors(MINT, CORAL, pulse);
      mat.opacity = 0.75;
   });
   return (
      <mesh ref={mesh} rotation-x={-Math.PI / 2} visible={false} renderOrder={3} name="hide-outline">
         <ringGeometry args={[0.92, 1.0, 40]} />
         <meshBasicMaterial color={COLORS.accent} transparent depthWrite={false} toneMapped={false} />
      </mesh>
   );
}

/** The current exit: a soft mint ring on the gate line. */
function ExitBeacon({ run }: { run: RunState }) {
   const time = useGameTime();
   const mesh = useRef<Mesh>(null);
   useFrame(() => {
      const m = mesh.current;
      if (!m) return;
      const g = STAGES[run.stage].gate;
      m.position.set((g.x0 + g.x1) / 2, 0.025, g.z - 0.6);
      const s = 1 + 0.08 * Math.sin(time.now * 3);
      m.scale.set(((g.x1 - g.x0) / 2) * s, 0.9 * s, 1);
   });
   return (
      <mesh ref={mesh} rotation-x={-Math.PI / 2} renderOrder={2} name="exit-beacon">
         <ringGeometry args={[0.7, 1, 40]} />
         <meshBasicMaterial
            color={COLORS.accent}
            transparent
            opacity={0.6}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
         />
      </mesh>
   );
}

/** Snacks (bobbing, with a glow disc) and the bamboo bundles (flying in their closed-form arc, then lying). */
function Pickups({ run }: { run: RunState }) {
   const time = useGameTime();
   const snack = useMerged(snackPieces);
   const bundle = useMerged(bundlePieces);
   const placeSnack = (i: number, m: Matrix4) => {
      const s = run.snacks[i];
      if (!s || s.eaten || s.stage < run.stage) return false;
      Q.setFromAxisAngle(UP, time.now * 1.6 + i);
      m.compose(V.set(s.x, 0.12 + 0.06 * Math.sin(time.now * 2.5 + i), s.z), Q, S.set(1.6, 1.6, 1.6));
   };
   const placeGlow = (i: number, m: Matrix4) => {
      const s = run.snacks[i];
      if (!s || s.eaten || s.stage < run.stage) return false;
      const k = 0.45 * (1 + 0.1 * Math.sin(time.now * 3 + i));
      m.makeRotationX(-Math.PI / 2).scale(S.set(k, k, 1)).setPosition(s.x, 0.02, s.z);
   };
   const placeBundle = (i: number, m: Matrix4) => {
      if (i < 2) {
         const b = run.bundles[i];
         if (!b.shown) return false;
         Q.setFromAxisAngle(UP, i * 1.7 + 0.4);
         m.compose(V.set(b.x, 0, b.z), Q, S.set(1, 1, 1));
         return;
      }
      const t = run.toss;
      if (!t.active) return false;
      const k = Math.min(TOSS.flight, t.t);
      Q.setFromAxisAngle(V.set(1, 0, 0), k * 12);
      m.compose(
         V.set(
            t.from.x + t.v.x * k,
            Math.max(0, t.from.y + t.v.y * k - 0.5 * TOSS.gravity * k * k),
            t.from.z + t.v.z * k
         ),
         Q,
         S.set(1, 1, 1)
      );
   };
   return (
      <group name="pickups">
         <DynamicInstanced count={run.snacks.length} update={placeSnack} name="snacks">
            <primitive object={snack} attach="geometry" />
            <meshStandardMaterial vertexColors roughness={0.5} emissive={COLORS.bamboo} emissiveIntensity={0.25} />
         </DynamicInstanced>
         <DynamicInstanced count={run.snacks.length} update={placeGlow} name="snack-glows">
            <circleGeometry args={[1, 24]} />
            <meshBasicMaterial
               color={COLORS.cone}
               transparent
               opacity={0.45}
               blending={AdditiveBlending}
               depthWrite={false}
               toneMapped={false}
            />
         </DynamicInstanced>
         <DynamicInstanced count={3} update={placeBundle} name="bundles">
            <primitive object={bundle} attach="geometry" />
            <meshStandardMaterial vertexColors roughness={0.6} />
         </DynamicInstanced>
      </group>
   );
}

export default function Stage({ run, dusk, reduced = false }: { run: RunState; dusk: boolean; reduced?: boolean }) {
   const tower = useMerged(towerPieces);

   return (
      <group name="zoo">
         {/* Gradient sky dome around camera: warm bright afternoon into dusk */}
         <SkyDome
            top={dusk ? COLORS.skyDuskTop : COLORS.skyTop}
            bottom={dusk ? COLORS.skyDuskBottom : COLORS.skyBottom}
            offset={0.05}
            exponent={0.7}
         />

         {/* Rich zoo ground: lawn with canvas texture, paved plaza, asphalt, water moat */}
         <Terrain reduced={reduced} />

         {/* Surroundings outside play area: hedges, parkland trees, signposts, distant hills, clouds */}
         <Decor reduced={reduced} />

         <Fences />
         <DropBars run={run} />

         <InstancedModel
            asset={ASSETS.rock}
            spots={SPOTS.rock}
            fallback={<Merged spots={SPOTS.rock} build={rockPieces} name="rocks" />}
         />
         <InstancedModel
            asset={ASSETS.bamboo}
            spots={SPOTS.bamboo}
            fallback={<Merged spots={SPOTS.bamboo} build={bambooPieces} name="bamboo" />}
         />
         <InstancedModel
            asset={ASSETS.bench}
            spots={SPOTS.bench}
            fallback={<Merged spots={SPOTS.bench} build={benchPieces} name="benches" />}
         />
         <InstancedModel
            asset={ASSETS.bin}
            spots={SPOTS.bin}
            fallback={<Merged spots={SPOTS.bin} build={binPieces} name="bins" />}
         />
         <InstancedModel
            asset={ASSETS.lamp}
            spots={SPOTS.lamp}
            fallback={<Merged spots={SPOTS.lamp} build={lampPieces} name="lamps" />}
         />
         <InstancedModel
            asset={ASSETS.palm}
            spots={SPOTS.palm}
            fallback={<Merged spots={SPOTS.palm} build={palmPieces} name="palms" />}
         />
         <InstancedModel
            asset={ASSETS.car}
            spots={SPOTS.car}
            fallback={<Merged spots={SPOTS.car} build={carPieces} name="cars" />}
         />
         <InstancedModel
            asset={ASSETS.leafyTree}
            spots={SPOTS.tree}
            fallback={<Merged spots={SPOTS.tree} build={treePieces} name="trees" />}
         />

         <Merged spots={SPOTS.kiosk} build={kioskPieces} name="kiosks" />
         <Awnings />
         <Merged spots={SPOTS.bush} build={bushPieces} name="bushes" />

         <mesh geometry={tower} position={[TOWER.x, 0, TOWER.z]} rotation-y={-Math.PI / 2} name="tower">
            <meshStandardMaterial vertexColors roughness={0.6} />
         </mesh>

         <LampGlows dusk={dusk} />
         <HideOutline run={run} />
         <ExitBeacon run={run} />
         <Pickups run={run} />
      </group>
   );
}
