"use client";

import { useEffect, useMemo } from "react";
import {
   BoxGeometry,
   BufferAttribute,
   BufferGeometry,
   Color,
   CylinderGeometry,
   IcosahedronGeometry,
   Matrix4,
   Quaternion,
   Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { DynamicInstanced, Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { CLOUD_DRIFT, COLORS, decorOf, type DecorSpot } from "./looks";

function withColor(raw: BufferGeometry, hex: string): BufferGeometry {
   const geo = raw.index ? raw.toNonIndexed() : raw;
   const count = geo.attributes.position.count;
   const colors = new Float32Array(count * 3);
   const color = new Color(hex);
   for (let i = 0; i < count; i++) {
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
   }
   geo.setAttribute("color", new BufferAttribute(colors, 3));
   return geo;
}

function createConeGeometry(): BufferGeometry {
   const base = withColor(new BoxGeometry(0.36, 0.04, 0.36).translate(0, 0.02, 0), COLORS.coneBase);
   const lower = withColor(new CylinderGeometry(0.09, 0.15, 0.22, 10).translate(0, 0.15, 0), COLORS.safetyOrange);
   const stripe = withColor(new CylinderGeometry(0.06, 0.09, 0.14, 10).translate(0, 0.33, 0), COLORS.safetyWhite);
   const upper = withColor(new CylinderGeometry(0.025, 0.06, 0.15, 10).translate(0, 0.475, 0), COLORS.safetyOrange);
   const merged = mergeGeometries([base, lower, stripe, upper]);
   base.dispose();
   lower.dispose();
   stripe.dispose();
   upper.dispose();
   if (!merged) throw new Error("decor: cone merge failed");
   return merged;
}

function createBarrierGeometry(): BufferGeometry {
   const base = withColor(new BoxGeometry(1.6, 0.28, 0.48).translate(0, 0.14, 0), COLORS.barrierConcrete);
   const stem = withColor(new BoxGeometry(1.6, 0.44, 0.24).translate(0, 0.5, 0), COLORS.barrierConcrete);
   const stripe = withColor(new BoxGeometry(1.61, 0.1, 0.26).translate(0, 0.36, 0), COLORS.barrierStripe);
   const merged = mergeGeometries([base, stem, stripe]);
   base.dispose();
   stem.dispose();
   stripe.dispose();
   if (!merged) throw new Error("decor: barrier merge failed");
   return merged;
}

function createPipesGeometry(): BufferGeometry {
   const geos: BufferGeometry[] = [];
   geos.push(withColor(new BoxGeometry(1.1, 0.08, 0.14).translate(0, 0.04, -0.7), COLORS.woodPallet));
   geos.push(withColor(new BoxGeometry(1.1, 0.08, 0.14).translate(0, 0.04, 0.7), COLORS.woodPallet));
   const r = 0.16;
   const xs = [-0.34, 0, 0.34];
   for (const x of xs) {
      const p = withColor(new CylinderGeometry(r, r, 2.2, 10).rotateX(Math.PI / 2).translate(x, 0.08 + r, 0), COLORS.pipeSteel);
      geos.push(p);
      const capA = withColor(new CylinderGeometry(r * 0.75, r * 0.75, 0.02, 8).rotateX(Math.PI / 2).translate(x, 0.08 + r, 1.101), COLORS.pipeInterior);
      const capB = withColor(new CylinderGeometry(r * 0.75, r * 0.75, 0.02, 8).rotateX(Math.PI / 2).translate(x, 0.08 + r, -1.101), COLORS.pipeInterior);
      geos.push(capA, capB);
   }
   const topXs = [-0.17, 0.17];
   for (const x of topXs) {
      const y = 0.08 + r * 2 + 0.12;
      const p = withColor(new CylinderGeometry(r, r, 2.2, 10).rotateX(Math.PI / 2).translate(x, y, 0), COLORS.pipeSteel);
      geos.push(p);
      const capA = withColor(new CylinderGeometry(r * 0.75, r * 0.75, 0.02, 8).rotateX(Math.PI / 2).translate(x, y, 1.101), COLORS.pipeInterior);
      const capB = withColor(new CylinderGeometry(r * 0.75, r * 0.75, 0.02, 8).rotateX(Math.PI / 2).translate(x, y, -1.101), COLORS.pipeInterior);
      geos.push(capA, capB);
   }
   const merged = mergeGeometries(geos);
   for (const g of geos) g.dispose();
   if (!merged) throw new Error("decor: pipes merge failed");
   return merged;
}

function createSkylineGeometry(): BufferGeometry {
   const tower = withColor(new BoxGeometry(1, 1, 1).translate(0, 0.5, 0), COLORS.skyline);
   const roof = withColor(new BoxGeometry(0.65, 0.15, 0.65).translate(0, 1.075, 0), COLORS.skylineDark);
   const spire = withColor(new CylinderGeometry(0.015, 0.04, 0.35, 4).translate(0, 1.325, 0), COLORS.steelLight);
   const merged = mergeGeometries([tower, roof, spire]);
   tower.dispose();
   roof.dispose();
   spire.dispose();
   if (!merged) throw new Error("decor: skyline merge failed");
   return merged;
}

function createCloudGeometry(): BufferGeometry {
   const c1 = new IcosahedronGeometry(1.0, 1).translate(0, 0, 0);
   const c2 = new IcosahedronGeometry(0.72, 1).translate(-0.85, -0.15, 0);
   const c3 = new IcosahedronGeometry(0.68, 1).translate(0.85, -0.2, 0);
   const c4 = new IcosahedronGeometry(0.55, 1).translate(0, 0.45, 0.15);
   const merged = mergeGeometries([c1, c2, c3, c4]);
   c1.dispose();
   c2.dispose();
   c3.dispose();
   c4.dispose();
   if (!merged) throw new Error("decor: cloud merge failed");
   return merged;
}

function asSpots(list: readonly DecorSpot[]): InstanceSpot[] {
   return list.map((spot) => ({
      x: spot.x,
      y: spot.y,
      z: spot.z,
      rotY: spot.rotY ?? 0,
      sx: spot.sx ?? 1,
      sy: spot.sy ?? 1,
      sz: spot.sz ?? 1,
   }));
}

/**
 * Procedural instanced decor outside the play area:
 * Cones, jersey barriers, stacked pipes, distant city skyline silhouettes and drifting clouds.
 */
export function Decor({ reduced = false, skyline: showSkyline = true, clouds: showClouds = true }: { reduced?: boolean; skyline?: boolean; clouds?: boolean }) {
   const quality = useQuality();
   const time = useGameTime();

   const geo = useMemo(
      () => ({
         cone: createConeGeometry(),
         barrier: createBarrierGeometry(),
         pipes: createPipesGeometry(),
         skyline: createSkylineGeometry(),
         cloud: createCloudGeometry(),
      }),
      [],
   );

   // Never put dispose={null} on a <primitive ... attach="geometry">
   useEffect(() => () => {
      for (const g of Object.values(geo)) g.dispose();
   }, [geo]);

   const cones = useMemo(
      () => asSpots(decorOf("cone").slice(0, scaledCount(decorOf("cone").length, quality.decor))),
      [quality.decor],
   );
   const barriers = useMemo(
      () => asSpots(decorOf("barrier").slice(0, scaledCount(decorOf("barrier").length, quality.decor))),
      [quality.decor],
   );
   const pipes = useMemo(
      () => asSpots(decorOf("pipes").slice(0, scaledCount(decorOf("pipes").length, quality.decor))),
      [quality.decor],
   );
   const skyline = useMemo(() => asSpots(decorOf("skyline")), []);
   const clouds = useMemo(() => decorOf("cloud"), []);

   const scratch = useMemo(() => ({ p: new Vector3(), q: new Quaternion(), s: new Vector3() }), []);

   const placeCloud = (i: number, m: Matrix4) => {
      const cloud = clouds[i];
      if (!cloud) return;
      const drift = reduced ? 0 : Math.sin(time.now * 0.12 + i * 1.5) * CLOUD_DRIFT;
      scratch.p.set(cloud.x + drift, cloud.y, cloud.z);
      scratch.q.identity();
      scratch.s.set(cloud.sx ?? 1, cloud.sy ?? 1, cloud.sz ?? 1);
      m.compose(scratch.p, scratch.q, scratch.s);
   };

   return (
      <group name="construction-decor">
         {cones.length > 0 && (
            <Instanced spots={cones} name="construction-cones">
               <primitive object={geo.cone} attach="geometry" />
               <meshStandardMaterial vertexColors roughness={0.65} />
            </Instanced>
         )}
         {barriers.length > 0 && (
            <Instanced spots={barriers} name="construction-barriers">
               <primitive object={geo.barrier} attach="geometry" />
               <meshStandardMaterial vertexColors roughness={0.8} />
            </Instanced>
         )}
         {pipes.length > 0 && (
            <Instanced spots={pipes} name="construction-pipes">
               <primitive object={geo.pipes} attach="geometry" />
               <meshStandardMaterial vertexColors roughness={0.5} metalness={0.2} />
            </Instanced>
         )}
         {showSkyline && (
            <Instanced spots={skyline} name="construction-skyline">
               <primitive object={geo.skyline} attach="geometry" />
               <meshStandardMaterial vertexColors flatShading roughness={0.9} />
            </Instanced>
         )}
         {showClouds && (
            <DynamicInstanced count={clouds.length} update={placeCloud} name="construction-clouds">
               <primitive object={geo.cloud} attach="geometry" />
               <meshStandardMaterial color={COLORS.cloud} flatShading roughness={1} />
            </DynamicInstanced>
         )}
      </group>
   );
}
