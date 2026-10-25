"use client";

import { useFrame } from "@react-three/fiber";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
   BufferGeometry,
   Color,
   CylinderGeometry,
   Euler,
   type InstancedMesh,
   Matrix4,
   MeshBasicMaterial,
   MeshStandardMaterial,
   OctahedronGeometry,
   Quaternion,
   RingGeometry,
   Shape,
   ShapeGeometry,
   SphereGeometry,
   Vector3,
} from "three";
import { DynamicInstancedModel } from "../../core/assets";
import { FRAME_PRIORITY } from "../../core/frameLoop";
import type { InstancePart, InstanceUpdate } from "../../core/render";
import { ASSETS, DUMMY_HEIGHT } from "./assets";
import { COLORS as LOOK } from "./looks";
import {
   COLORS,
   POSTS,
   travelXZ,
   type RunState,
   type StrikeDir,
   type TargetCue,
   TARGETS,
} from "./rules";

// Pre-allocated Colors (zero per-frame allocations)
const COLOR_WHITE = new Color("#ffffff");
const COLOR_DUMMY_REGULAR = new Color("#fde68a");
const COLOR_DUMMY_SHIELD = new Color("#bae6fd");
const COLOR_DUMMY_SHIELD_CRACKED = new Color("#38bdf8");
const COLOR_DUMMY_TOMATO = new Color("#fca5a5");

const COLOR_DISC_IDLE = new Color("#78716c");
const COLOR_DISC_REGULAR = new Color(COLORS.regular);
const COLOR_DISC_SHIELD = new Color(COLORS.shield);
const COLOR_DISC_TOMATO = new Color(COLORS.tomato);
const COLOR_DISC_ON_BEAT = new Color(COLORS.activeRing);

const COLOR_RING_APPROACH = new Color(COLORS.approachRing);
const COLOR_RING_ON_BEAT = new Color(COLORS.activeRing);
const COLOR_RING_SHIELD = new Color(COLORS.shield);
const COLOR_RING_TOMATO = new Color(COLORS.tomato);

const scratchPos = new Vector3();
const scratchQuat = new Quaternion();
const scratchRollQuat = new Quaternion();
const scratchScale = new Vector3();
const scratchEuler = new Euler();
const scratchMat = new Matrix4();
const travelOut = { x: 0, z: 0 };
const HIDDEN_MATRIX = new Matrix4().makeScale(0, 0, 0);

function directionArrowRoll(dir: StrikeDir): number {
   switch (dir) {
      case "up":
         return 0;
      case "down":
         return Math.PI;
      case "left":
         return Math.PI / 2;
      case "right":
         return -Math.PI / 2;
   }
}

function buildArrowGeometry(): BufferGeometry {
   const s = new Shape();
   // Upward-pointing bold chevron arrow, 0.56 m tall x 0.48 m wide
   s.moveTo(0, 0.28);
   s.lineTo(0.24, 0.02);
   s.lineTo(0.10, 0.02);
   s.lineTo(0.10, -0.26);
   s.lineTo(-0.10, -0.26);
   s.lineTo(-0.10, 0.02);
   s.lineTo(-0.24, 0.02);
   s.closePath();
   return new ShapeGeometry(s);
}

function buildShieldIconGeometry(): BufferGeometry {
   const s = new Shape();
   // Heater-shield silhouette, 0.60 m tall x 0.50 m wide
   s.moveTo(-0.25, 0.28);
   s.lineTo(0.25, 0.28);
   s.lineTo(0.25, 0.02);
   s.lineTo(0, -0.30);
   s.lineTo(-0.25, 0.02);
   s.closePath();
   return new ShapeGeometry(s);
}

function findCurrentCueForPost(run: RunState, postIndex: number, nowMs: number): TargetCue | null {
   let best: TargetCue | null = null;
   for (const cue of run.map.cues) {
      if (cue.postIndex !== postIndex || cue.status !== "pending") continue;
      if (cue.kind === "shield" && cue.shieldHitIndex === 2) {
         if (!run.shieldCrackedGroups.has(cue.shieldGroupId) || run.shieldExpiredGroups.has(cue.shieldGroupId)) {
            continue;
         }
      }
      if (nowMs >= cue.spawnTimeMs && nowMs <= cue.expireTimeMs) {
         if (!best || cue.beatTimeMs < best.beatTimeMs) {
            best = cue;
         }
      }
   }
   return best;
}

export interface DummiesProps {
   runRef: React.MutableRefObject<RunState>;
}

export function Dummies({ runRef }: DummiesProps): React.ReactElement {
   const discRef = useRef<InstancedMesh>(null);
   const ringRef = useRef<InstancedMesh>(null);
   const arrowIconRef = useRef<InstancedMesh>(null);
   const shieldIconRef = useRef<InstancedMesh>(null);
   const tomatoIconRef = useRef<InstancedMesh>(null);

   const fallbackParts = useMemo<InstancePart[]>(() => {
      const postGeom = new CylinderGeometry(0.10, 0.12, DUMMY_HEIGHT * 0.85, 8);
      postGeom.translate(0, DUMMY_HEIGHT * 0.425, 0);
      const bodyGeom = new CylinderGeometry(0.24, 0.22, 0.58, 10);
      bodyGeom.translate(0, 0.92, 0);
      const headGeom = new SphereGeometry(0.15, 8, 8);
      headGeom.translate(0, DUMMY_HEIGHT - 0.15, 0);
      return [
         {
            geometry: postGeom,
            material: new MeshStandardMaterial({ color: LOOK.woodDark, roughness: 0.85, flatShading: true }),
         },
         {
            geometry: bodyGeom,
            material: new MeshStandardMaterial({ color: LOOK.woodMid, roughness: 0.75, flatShading: true }),
         },
         {
            geometry: headGeom,
            material: new MeshStandardMaterial({ color: LOOK.woodLight, roughness: 0.72, flatShading: true }),
         },
      ];
   }, []);

   useEffect(() => () => {
      for (const part of fallbackParts) {
         part.geometry.dispose();
         const material = part.material;
         if (Array.isArray(material)) for (const item of material) item.dispose();
         else material.dispose();
      }
   }, [fallbackParts]);

   const geometries = useMemo(() => {
      const disc = new CylinderGeometry(TARGETS.DISC_RADIUS_M, TARGETS.DISC_RADIUS_M, 0.02, 24);
      const ring = new RingGeometry(0.44, 0.52, 32);
      ring.rotateX(-Math.PI / 2);
      const arrow = buildArrowGeometry();
      const shield = buildShieldIconGeometry();
      const tomato = new OctahedronGeometry(0.28, 1);
      return { disc, ring, arrow, shield, tomato };
   }, []);

   const materials = useMemo(() => {
      return {
         disc: new MeshStandardMaterial({ color: "#ffffff", roughness: 0.55, metalness: 0.15 }),
         ring: new MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.92 }),
         arrow: new MeshBasicMaterial({ color: "#ffffff" }),
         shield: new MeshBasicMaterial({ color: COLORS.shield }),
         tomato: new MeshStandardMaterial({ color: COLORS.tomato, roughness: 0.35 }),
      };
   }, []);

   useLayoutEffect(() => {
      const meshes = [discRef.current, ringRef.current, arrowIconRef.current, shieldIconRef.current, tomatoIconRef.current];
      for (const m of meshes) {
         if (!m) continue;
         for (let i = 0; i < 8; i++) {
            m.setMatrixAt(i, HIDDEN_MATRIX);
            m.setColorAt(i, COLOR_WHITE);
         }
         m.instanceMatrix.needsUpdate = true;
         if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
   }, []);

   const updateDummy = useCallback<InstanceUpdate>(
      (index, matrix, color) => {
         const run = runRef.current;
         const post = POSTS[index];
         const wobble = run.postWobble[index]?.x ?? 0;

         // Pitch dummy back along its post ray when struck, pivoting at y = 0
         scratchEuler.set(-wobble, post.facingYaw, 0, "YXZ");
         scratchQuat.setFromEuler(scratchEuler);
         const cue = findCurrentCueForPost(run, index, run.timeMs);
         if (cue) travelXZ(cue, run.timeMs, travelOut);
         else {
            travelOut.x = post.x;
            travelOut.z = post.z;
         }
         scratchPos.set(travelOut.x, 0, travelOut.z);
         scratchScale.set(1, 1, 1);
         matrix.compose(scratchPos, scratchQuat, scratchScale);

         if (color) {
            if (!cue) {
               color.copy(COLOR_WHITE);
            } else if (cue.kind === "tomato") {
               color.copy(COLOR_DUMMY_TOMATO);
            } else if (cue.kind === "shield") {
               color.copy(cue.shieldHitIndex === 2 ? COLOR_DUMMY_SHIELD_CRACKED : COLOR_DUMMY_SHIELD);
            } else {
               color.copy(COLOR_DUMMY_REGULAR);
            }
         }
         return true;
      },
      [runRef],
   );

   useFrame((state) => {
      const run = runRef.current;
      const nowMs = run.timeMs;
      const disc = discRef.current;
      const ring = ringRef.current;
      const arrow = arrowIconRef.current;
      const shield = shieldIconRef.current;
      const tomato = tomatoIconRef.current;
      if (!disc || !ring || !arrow || !shield || !tomato) return;

      // Beat-synced pulse (peaks every beat at current stage BPM)
      const periodMs = 60_000 / run.bpm;
      const beatPhase = ((nowMs % periodMs) / periodMs) * Math.PI * 2;
      const beatPulse = 0.5 + 0.5 * Math.cos(beatPhase);

      const camQuat = state.camera.quaternion;

      for (let i = 0; i < 8; i++) {
         const post = POSTS[i];
         const cue = findCurrentCueForPost(run, i, nowMs);
         if (cue) travelXZ(cue, nowMs, travelOut);
         else {
            travelOut.x = post.x;
            travelOut.z = post.z;
         }

         // 1. Ground target disc (beat-synced pulse + status colour)
         const discScale = cue ? 1.0 + 0.08 * beatPulse : 1.0 + 0.02 * beatPulse;
         scratchPos.set(travelOut.x, 0.01, travelOut.z);
         scratchQuat.identity();
         scratchScale.set(discScale, 1, discScale);
         scratchMat.compose(scratchPos, scratchQuat, scratchScale);
         disc.setMatrixAt(i, scratchMat);

         if (!cue) {
            disc.setColorAt(i, COLOR_DISC_IDLE);
            ring.setMatrixAt(i, HIDDEN_MATRIX);
            arrow.setMatrixAt(i, HIDDEN_MATRIX);
            shield.setMatrixAt(i, HIDDEN_MATRIX);
            tomato.setMatrixAt(i, HIDDEN_MATRIX);
            continue;
         }

         const absDelta = Math.abs(nowMs - cue.beatTimeMs);
         const isOnBeatWindow = absDelta <= run.onBeatWindowMs;
         const leadTotal = Math.max(1, cue.beatTimeMs - cue.spawnTimeMs);
         const progress = Math.max(0, Math.min(1.15, (nowMs - cue.spawnTimeMs) / leadTotal));

         if (cue.kind === "tomato") {
            disc.setColorAt(i, COLOR_DISC_TOMATO);
         } else if (isOnBeatWindow) {
            disc.setColorAt(i, COLOR_DISC_ON_BEAT);
         } else if (cue.kind === "shield") {
            disc.setColorAt(i, COLOR_DISC_SHIELD);
         } else {
            disc.setColorAt(i, COLOR_DISC_REGULAR);
         }

         // 2. Shrinking 3D approach ring on the ground (shrinks from 2.2x down to 1.0x at beatTimeMs)
         const ringRadiusFactor = Math.max(0.85, 2.2 - 1.2 * Math.min(1, progress));
         scratchPos.set(travelOut.x, 0.024, travelOut.z);
         scratchQuat.identity();
         scratchScale.set(ringRadiusFactor, 1, ringRadiusFactor);
         scratchMat.compose(scratchPos, scratchQuat, scratchScale);
         ring.setMatrixAt(i, scratchMat);

         if (cue.kind === "tomato") {
            ring.setColorAt(i, COLOR_RING_TOMATO);
         } else if (isOnBeatWindow) {
            ring.setColorAt(i, COLOR_RING_ON_BEAT);
         } else if (cue.kind === "shield") {
            ring.setColorAt(i, COLOR_RING_SHIELD);
         } else {
            ring.setColorAt(i, COLOR_RING_APPROACH);
         }

         // 3. Overhead billboard icon at y = 1.85 m (0.60 m scale, redundant shape + colour)
         const iconScale = (isOnBeatWindow ? 1.15 : 0.95) + 0.06 * beatPulse;
         scratchPos.set(travelOut.x, 1.85, travelOut.z);

         if (cue.kind === "tomato") {
            // Round tomato decoy icon (distinct non-arrow silhouette)
            scratchQuat.copy(camQuat);
            scratchScale.setScalar(iconScale);
            scratchMat.compose(scratchPos, scratchQuat, scratchScale);
            tomato.setMatrixAt(i, scratchMat);
            arrow.setMatrixAt(i, HIDDEN_MATRIX);
            shield.setMatrixAt(i, HIDDEN_MATRIX);
         } else {
            tomato.setMatrixAt(i, HIDDEN_MATRIX);
            // Directional chevron arrow rotated in screen plane to match Up / Down / Left / Right
            const roll = directionArrowRoll(cue.direction);
            scratchEuler.set(0, 0, roll);
            scratchQuat.copy(camQuat).multiply(scratchRollQuat.setFromEuler(scratchEuler));
            scratchScale.setScalar(iconScale);
            scratchMat.compose(scratchPos, scratchQuat, scratchScale);
            arrow.setMatrixAt(i, scratchMat);
            arrow.setColorAt(i, isOnBeatWindow ? COLOR_RING_ON_BEAT : COLOR_RING_APPROACH);

            if (cue.kind === "shield") {
               // Backing shield emblem behind the directional arrow (tilted when cracked on hit 2)
               scratchPos.set(travelOut.x, 1.85, travelOut.z - 0.04);
               scratchQuat.copy(camQuat);
               const shScale = cue.shieldHitIndex === 2 ? iconScale * 0.85 : iconScale * 1.12;
               scratchScale.setScalar(shScale);
               scratchMat.compose(scratchPos, scratchQuat, scratchScale);
               shield.setMatrixAt(i, scratchMat);
            } else {
               shield.setMatrixAt(i, HIDDEN_MATRIX);
            }
         }
      }

      disc.instanceMatrix.needsUpdate = true;
      if (disc.instanceColor) disc.instanceColor.needsUpdate = true;
      ring.instanceMatrix.needsUpdate = true;
      if (ring.instanceColor) ring.instanceColor.needsUpdate = true;
      arrow.instanceMatrix.needsUpdate = true;
      if (arrow.instanceColor) arrow.instanceColor.needsUpdate = true;
      shield.instanceMatrix.needsUpdate = true;
      tomato.instanceMatrix.needsUpdate = true;
   }, FRAME_PRIORITY.visuals);

   return (
      <group>
         <DynamicInstancedModel
            asset={ASSETS.dummy}
            count={8}
            tinted
            update={updateDummy}
            fallbackParts={fallbackParts}
            name="dummies"
         />
         <instancedMesh ref={discRef} args={[geometries.disc, materials.disc, 8]} receiveShadow />
         <instancedMesh ref={ringRef} args={[geometries.ring, materials.ring, 8]} />
         <instancedMesh ref={arrowIconRef} args={[geometries.arrow, materials.arrow, 8]} />
         <instancedMesh ref={shieldIconRef} args={[geometries.shield, materials.shield, 8]} />
         <instancedMesh ref={tomatoIconRef} args={[geometries.tomato, materials.tomato, 8]} />
      </group>
   );
}
