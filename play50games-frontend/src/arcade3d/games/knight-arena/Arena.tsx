"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
   BoxGeometry,
   BufferAttribute,
   BufferGeometry,
   DoubleSide,
   type InstancedMesh,
   Matrix4,
   Quaternion,
   RepeatWrapping,
   Shape,
   ShapeGeometry,
   Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { InstancedModel } from "../../core/assets";
import { SkyDome } from "../../core/env";
import { Fence } from "../../core/kit/Fence";
import { useLevel } from "../../core/level";
import { useStageLighting } from "../../core/lighting";
import { createPath } from "../../core/path";
import { useCanvasTexture, type CanvasDraw, type InstanceSpot } from "../../core/render";
import { ASSETS } from "./assets";
import { Decor } from "./Decor";
import type { KnightLevel } from "./levels";
import { COLORS, GROUND, LEVEL_LOOKS } from "./looks";
import { TowerPrimitive, TreePrimitive } from "./Primitives";
import { ARENA, TARGETS } from "./rules";

const RING_VERTICES: ReadonlyArray<readonly [number, number]> = Array.from({ length: ARENA.SIDES }, (_, i) => {
   const angle = (i / ARENA.SIDES) * Math.PI * 2 + Math.PI / 8;
   return [Math.cos(angle) * ARENA.RADIUS_M, Math.sin(angle) * ARENA.RADIUS_M] as const;
});

const RING_PATH = createPath(
   RING_VERTICES.map(([x, z]) => ({ x, y: 0, z })),
   { closed: true },
);

const TOWER_SPOTS: readonly InstanceSpot[] = ARENA.TOWER_POSITIONS.map(([x, z]) => ({
   x,
   y: 0,
   z,
   rotY: Math.atan2(-x, -z),
}));

const TREE_SPOTS: readonly InstanceSpot[] = ARENA.TREE_POSITIONS.map(([x, z], i) => ({
   x,
   y: 0,
   z,
   rotY: (i * 1.37) % (Math.PI * 2),
   scale: i % 2 === 0 ? 1.0 : 0.92,
}));

const scratchMatrix = new Matrix4();
const scratchPos = new Vector3();
const scratchQuat = new Quaternion();
const scratchScale = new Vector3(1, 1, 1);
const UP = new Vector3(0, 1, 0);

const drawMeadow: CanvasDraw = (ctx, width, height) => {
   ctx.fillStyle = COLORS.grass;
   ctx.fillRect(0, 0, width, height);
   const blobs = [COLORS.grassSun, COLORS.grassShade, COLORS.grass];
   for (let i = 0; i < 48; i++) {
      ctx.fillStyle = blobs[i % blobs.length];
      ctx.globalAlpha = 0.22 + (i % 4) * 0.08;
      ctx.beginPath();
      ctx.ellipse((i * 97) % width, (i * 53) % height, 26 + (i * 17) % 64, 14 + (i * 13) % 32, ((i * 19) % 40) * 0.03, 0, Math.PI * 2);
      ctx.fill();
   }
   ctx.globalAlpha = 1;
};

const drawSand: CanvasDraw = (ctx, width, height) => {
   ctx.fillStyle = COLORS.sand;
   ctx.fillRect(0, 0, width, height);
   const tones = [COLORS.sandMid, COLORS.sandDark, COLORS.sand];
   for (let i = 0; i < 36; i++) {
      ctx.fillStyle = tones[i % tones.length];
      ctx.globalAlpha = 0.18 + (i % 5) * 0.06;
      ctx.beginPath();
      ctx.ellipse((i * 73) % width, (i * 41) % height, 18 + (i * 11) % 40, 10 + (i * 7) % 22, ((i * 13) % 30) * 0.04, 0, Math.PI * 2);
      ctx.fill();
   }
   ctx.globalAlpha = 0.35;
   ctx.strokeStyle = COLORS.sandDark;
   ctx.lineWidth = 3;
   const cx = width / 2;
   const cy = height / 2;
   for (let ring = 1; ring <= 4; ring++) {
      ctx.beginPath();
      ctx.arc(cx, cy, (ring / 5) * width * 0.46, 0, Math.PI * 2);
      ctx.stroke();
   }
   ctx.globalAlpha = 1;
};

function octagonShape(radius: number): Shape {
   const shape = new Shape();
   for (let i = 0; i < ARENA.SIDES; i++) {
      const angle = (i / ARENA.SIDES) * Math.PI * 2 + Math.PI / 8;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
   }
   shape.closePath();
   return shape;
}

function paintSolid(geo: BufferGeometry, hex: string): BufferGeometry {
   const count = geo.getAttribute("position").count;
   const color = new Float32Array(count * 3);
   const n = Number.parseInt(hex.slice(1), 16);
   const r = ((n >> 16) & 255) / 255;
   const g = ((n >> 8) & 255) / 255;
   const b = (n & 255) / 255;
   for (let i = 0; i < count; i++) {
      color[i * 3] = r;
      color[i * 3 + 1] = g;
      color[i * 3 + 2] = b;
   }
   geo.setAttribute("color", new BufferAttribute(color, 3));
   return geo;
}

/** Forked pennant plus a gold band. One geometry, so the eight banners are one draw. */
function bannerGeometry(): BufferGeometry {
   const cloth = new Shape();
   cloth.moveTo(-0.16, 0.26);
   cloth.lineTo(0.16, 0.26);
   cloth.lineTo(0.16, -0.02);
   cloth.lineTo(0, -0.28);
   cloth.lineTo(-0.16, -0.02);
   cloth.closePath();
   const clothGeo = paintSolid(new ShapeGeometry(cloth), COLORS.banner);
   const stripe = paintSolid(new BoxGeometry(0.28, 0.055, 0.012).translate(0, 0.12, 0.006), COLORS.gold);
   const geo = mergeGeometries([clothGeo, stripe], false);
   clothGeo.dispose();
   stripe.dispose();
   if (!geo) throw new Error("knight-arena look: banner");
   geo.computeVertexNormals();
   return geo;
}

function ArenaBanners(): React.ReactElement {
   const clothRef = useRef<InstancedMesh>(null);
   const goldRef = useRef<InstancedMesh>(null);
   const clothGeo = useMemo(() => bannerGeometry(), []);
   useEffect(() => () => clothGeo.dispose(), [clothGeo]);

   useLayoutEffect(() => {
      const cloth = clothRef.current;
      const gold = goldRef.current;
      if (!cloth || !gold) return;

      for (let i = 0; i < RING_VERTICES.length; i++) {
         const [vx, vz] = RING_VERTICES[i];
         const yaw = Math.atan2(-vx, -vz);
         scratchQuat.setFromAxisAngle(UP, yaw);

         scratchPos.set(vx * 0.97, 0.56, vz * 0.97);
         scratchScale.set(1, 1, 1);
         scratchMatrix.compose(scratchPos, scratchQuat, scratchScale);
         cloth.setMatrixAt(i, scratchMatrix);

         scratchPos.set(vx, ARENA.FENCE_HEIGHT_M + 0.08, vz);
         scratchScale.set(0.1, 0.16, 0.1);
         scratchMatrix.compose(scratchPos, scratchQuat, scratchScale);
         gold.setMatrixAt(i, scratchMatrix);
      }
      cloth.instanceMatrix.needsUpdate = true;
      gold.instanceMatrix.needsUpdate = true;
   }, []);

   return (
      <group name="knight-banners">
         <instancedMesh ref={clothRef} args={[undefined, undefined, RING_VERTICES.length]}>
            <primitive object={clothGeo} attach="geometry" />
            <meshStandardMaterial vertexColors side={DoubleSide} roughness={0.72} />
         </instancedMesh>
         <instancedMesh ref={goldRef} args={[undefined, undefined, RING_VERTICES.length]}>
            <octahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color={COLORS.gold} flatShading roughness={0.35} metalness={0.55} />
         </instancedMesh>
      </group>
   );
}

export function Arena(): React.ReactElement {
   const { id } = useLevel<KnightLevel>();
   const look = LEVEL_LOOKS[id];
   // Snap. The definition's preset is the same, so the sun stays; only the fog colour moves,
   // and near/far stay whatever the level already declared.
   useStageLighting(look.lighting, 0, look.background, look.fog);

   const meadow = useCanvasTexture(512, 512, drawMeadow);
   const sandMap = useCanvasTexture(512, 512, drawSand);
   const sand = useMemo(() => new ShapeGeometry(octagonShape(ARENA.RADIUS_M)), []);
   useEffect(() => {
      meadow.wrapS = meadow.wrapT = RepeatWrapping;
      meadow.repeat.set(26, 26);
      meadow.needsUpdate = true;
   }, [meadow]);
   useEffect(() => () => sand.dispose(), [sand]);

   return (
      <group>
         <SkyDome top={look.skyTop} bottom={look.sky} radius={180} />

         <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND.y, 0]} name="knight-meadow">
            <planeGeometry args={[GROUND.half * 2, GROUND.half * 2]} />
            <meshStandardMaterial map={meadow} roughness={1} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
         </mesh>

         <mesh position={[0, 0.012, 0]} rotation={[0, Math.PI / 8, 0]} name="knight-curb">
            <cylinderGeometry args={[ARENA.RADIUS_M + 0.22, ARENA.RADIUS_M + 0.36, 0.028, ARENA.SIDES]} />
            <meshStandardMaterial color={COLORS.stone} flatShading roughness={0.9} />
         </mesh>

         <mesh geometry={sand} dispose={null} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.028, 0]} name="knight-sand">
            <meshStandardMaterial map={sandMap} roughness={0.95} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
         </mesh>

         <mesh position={[0, 0.036, 0]} rotation={[-Math.PI / 2, 0, 0]} name="knight-ring-near">
            <ringGeometry args={[TARGETS.NEAR_RADIUS_M - 0.035, TARGETS.NEAR_RADIUS_M + 0.035, 48]} />
            <meshStandardMaterial color={COLORS.rake} roughness={1} />
         </mesh>
         <mesh position={[0, 0.036, 0]} rotation={[-Math.PI / 2, 0, 0]} name="knight-ring-far">
            <ringGeometry args={[TARGETS.FAR_RADIUS_M - 0.035, TARGETS.FAR_RADIUS_M + 0.035, 64]} />
            <meshStandardMaterial color={COLORS.sandDark} roughness={1} />
         </mesh>

         <Fence
            path={RING_PATH}
            spacing={1.2}
            height={ARENA.FENCE_HEIGHT_M}
            postSize={0.16}
            railSize={0.07}
            color={COLORS.woodDark}
            railColor={COLORS.wood}
         />
         <ArenaBanners />

         <InstancedModel
            asset={ASSETS.castleTower}
            spots={TOWER_SPOTS}
            fallback={
               <group>
                  {TOWER_SPOTS.map((s, i) => (
                     <group key={i} position={[s.x, s.y, s.z]} rotation={[0, s.rotY ?? 0, 0]}>
                        <TowerPrimitive />
                     </group>
                  ))}
               </group>
            }
         />

         <InstancedModel
            asset={ASSETS.leafyTree}
            spots={TREE_SPOTS}
            fallback={
               <group>
                  {TREE_SPOTS.map((s, i) => (
                     <group key={i} position={[s.x, s.y, s.z]} rotation={[0, s.rotY ?? 0, 0]} scale={s.scale ?? 1}>
                        <TreePrimitive />
                     </group>
                  ))}
               </group>
            }
         />

         <Decor />
      </group>
   );
}
