"use client";

import { useMemo, useRef } from "react";
import { DynamicInstancedModel, Model } from "@/arcade3d/core/assets";
import { useFrame, useThree } from "@react-three/fiber";
import { BufferGeometry, Float32BufferAttribute, LineDashedMaterial, Line, Color, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import type { Group, Mesh } from "three";
import { DynamicInstanced } from "@/arcade3d/core/render/DynamicInstanced";
import { BlobShadow } from "@/arcade3d/core/render/BlobShadow";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useFx } from "@/arcade3d/core/fx/FxLayer";
import { playSfx } from "@/arcade3d/core/audio";
import { landingMarker, markerColor, RATING_NAME, shadowTop, VISUAL_EXTENSION } from "./dropGuide";
import { PIECE_ASSETS } from "./assets";
import { cableGeo, steel } from "./Primitives";
import { CUE_DROP, CUE_MISS, FLOOR, GRAVITY, PIECE_H, PLAN, SLOT_R, type Run } from "./rules";
import { LEVELS, type CraneLevel } from "./levels";
import {
   flashMat,
   guideMat,
   KIND_COLOR,
   KIND_SCALE,
   pieceGeo,
   pieceMat,
   ringGeo,
   slotMat,
} from "./Primitives";

const pos = new Vector3();
const quat = new Quaternion();
const scl = new Vector3();
const slot = { x: 0, z: 0 };

/** The level whose slots slotXZ reads (Pieces sets it from its run each frame). */
let slotLevel: CraneLevel = LEVELS[1];

function slotXZ(index: number): { x: number; z: number } {
   const a = slotLevel.slotA[index] ?? 0;
   slot.x = SLOT_R * Math.sin(a);
   slot.z = SLOT_R * Math.cos(a);
   return slot;
}

const MODEL_KINDS = [0, 1, 2, 3] as const;
const THUD = [1.3, 1.1, 0.9];
const POINTS = [100, 60, 30, 0];
/** after a placed piece lands, it slides from the landing point onto the slot centre */
const SETTLE_S = 0.15;
/** a missed piece rests where it fell, then sinks away */
const MISS_REST_S = 0.45;

/**
 * The drop, drawn: the rules place (or drop) the piece the moment it is released, so this is a
 * purely visual fall from the hook over the rules' own fall time sqrt(2h / g), h = piece bottom
 * (hookY - PIECE_H) above the slot top, along the predicted landing line. The placed copy stays
 * hidden until the falling one arrives.
 */
interface Fall {
   on: boolean;
   placed: boolean;
   kind: number;
   rating: number;
   slot: number;
   floor: number;
   start: number;
   duration: number;
   landed: boolean;
   x0: number;
   y0: number;
   z0: number;
   lx: number;
   lz: number;
   sx: number;
   sz: number;
   top: number;
}

const fallAt = { x: 0, y: 0, z: 0 };
const popAt = { x: 0, y: 0, z: 0 };

function surfaceUnder(run: Run, x: number, z: number): number {
   slotLevel = run.level;
   let top = 0;
   for (const piece of run.pieces) {
      if (!piece.on) continue;
      const at = slotXZ(piece.slot);
      if (Math.abs(x - at.x) <= 0.68 && Math.abs(z - at.z) <= 0.68) top = Math.max(top, (piece.floor + 1) * FLOOR);
   }
   return top;
}

function hidden(fall: Fall, slotIndex: number, floor: number): boolean {
   return fall.on && fall.placed && fall.slot === slotIndex && fall.floor === floor;
}

/** Placed floors, the piece on the hook, the landing guide and the glowing slot. */
export function Pieces({ run }: { run: Run }) {
   slotLevel = run.level;
   const parts = useMemo(() => [{ geometry: pieceGeo, material: pieceMat }], []);
   // stand-ins for the four GLB piece kinds: the coloured rounded box at the piece's size, feet on the origin
   const standIns = useMemo(
      () =>
         MODEL_KINDS.map((kind) => {
            const size = KIND_SCALE[kind];
            const material = new MeshStandardMaterial({ color: KIND_COLOR[kind], roughness: 0.65 });
            return [{ geometry: pieceGeo, material, locals: [new Matrix4().compose(new Vector3(0, size[1] / 2, 0), new Quaternion(), new Vector3(size[0], size[1], size[2]))] }];
         }),
      []
   );
   const carriedModels = useRef<(Group | null)[]>([]);
   const carried = useRef<Mesh>(null);
   const guide = useRef<Mesh>(null);
   const blob = useRef<Group>(null);
   const extension = useRef<Mesh>(null);
   const marker = useRef({ x: 0, y: 0, z: 0 });
   const shadowAt = useRef({ x: 0, z: 0 });
   const [dash] = useMemo(() => {
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 0, 1, 0], 3));
      const line = new Line(geometry, new LineDashedMaterial({ color: "#ffffff", dashSize: 0.12, gapSize: 0.09, transparent: true, opacity: 0.75, depthWrite: false }));
      geometry.setAttribute("lineDistance", new Float32BufferAttribute([0, 1], 1));
      return [line];
   }, []);
   const ring = useRef<Mesh>(null);
   const flash = useRef<Mesh>(null);
   const time = useGameTime();
   const fx = useFx();
   // the popup's size is a share of half the canvas height: smaller on a tall phone so it fits the width
   const portrait = useThree((st) => st.size.height > st.size.width * 1.2);
   const fall = useRef<Fall>({ on: false, placed: false, kind: 0, rating: 0, slot: 0, floor: 0, start: 0, duration: 0, landed: false, x0: 0, y0: 0, z0: 0, lx: 0, lz: 0, sx: 0, sz: 0, top: 0 });
   const fallModels = useRef<(Group | null)[]>([]);
   const fallRoof = useRef<Mesh>(null);
   const missFlash = useRef(-1);

   /** Landing: dust, the thud, the rating text (Perfect / Good / OK / Miss) where the piece came down. */
   const land = (f: Fall) => {
      f.landed = true;
      popAt.x = f.lx;
      popAt.y = f.top + 0.1;
      popAt.z = f.lz;
      fx.burst("puff", popAt, f.placed ? 14 : 18);
      // the text rises over the landing, pulled toward the site's centre line so an edge slot keeps it on screen
      popAt.x = f.lx * 0.55;
      popAt.y = f.top + 1.2;
      const label = f.rating < 3 ? `${RATING_NAME[f.rating]}! +${POINTS[f.rating]}` : "Miss";
      fx.score(popAt, label, { color: markerColor(f.rating), size: portrait ? 0.05 : 0.07 });
      if (f.placed) {
         playSfx("thud", { pitch: THUD[f.rating] ?? 1 });
         if (f.rating === 0) {
            playSfx("chime", { pitch: 1 + Math.min(3, run.streak) * 0.06 });
            popAt.y = f.top + 0.3;
            fx.burst("sparkle", popAt, 18);
         }
      } else {
         playSfx("hit");
         missFlash.current = time.now;
      }
   };

   useFrame(() => {
      slotLevel = run.level;
      const now = time.now;
      const f = fall.current;
      if (run.cue & (CUE_DROP | CUE_MISS)) {
         if (f.on && !f.landed) land(f);
         const placed = (run.cue & CUE_DROP) !== 0;
         const dropped = PLAN[placed ? run.planIndex - 1 : run.planIndex];
         if (dropped) {
            const h = KIND_SCALE[dropped.kind][1];
            f.on = true;
            f.landed = false;
            f.placed = placed;
            f.kind = dropped.kind;
            f.rating = run.dropRating;
            f.slot = dropped.slot;
            f.floor = dropped.floor;
            // a placed piece lands on its slot's floor; a miss comes down on whatever is under the landing point
            f.top = placed ? dropped.floor * FLOOR : surfaceUnder(run, run.landX, run.landZ);
            f.start = now;
            f.duration = Math.sqrt((2 * Math.max(0, run.hookY - PIECE_H - f.top)) / GRAVITY);
            f.x0 = run.hookX;
            f.y0 = run.hookY - VISUAL_EXTENSION - h;
            f.z0 = run.hookZ;
            f.lx = run.landX;
            f.lz = run.landZ;
            const centre = slotXZ(dropped.slot);
            f.sx = centre.x;
            f.sz = centre.z;
         }
      }
      if (f.on) {
         const t = now - f.start;
         const k = f.duration > 0 ? Math.min(1, t / f.duration) : 1;
         if (k < 1) {
            fallAt.x = f.x0 + (f.lx - f.x0) * k;
            fallAt.z = f.z0 + (f.lz - f.z0) * k;
            fallAt.y = f.y0 - (f.y0 - f.top) * k * k;
         } else {
            if (!f.landed) land(f);
            const after = t - f.duration;
            if (f.placed) {
               const s = Math.min(1, after / SETTLE_S);
               fallAt.x = f.lx + (f.sx - f.lx) * s;
               fallAt.z = f.lz + (f.sz - f.lz) * s;
               fallAt.y = f.top;
               if (s >= 1) f.on = false;
            } else {
               fallAt.x = f.lx;
               fallAt.z = f.lz;
               fallAt.y = f.top - Math.max(0, after - MISS_REST_S) * 2;
               if (after > MISS_REST_S + 0.4) f.on = false;
            }
         }
      }
      for (const kind of MODEL_KINDS) {
         const g = fallModels.current[kind];
         if (!g) continue;
         g.visible = f.on && f.kind === kind;
         if (g.visible) g.position.set(fallAt.x, fallAt.y, fallAt.z);
      }
      const roof = fallRoof.current;
      if (roof) {
         roof.visible = f.on && f.kind === 4;
         if (roof.visible) {
            const size = KIND_SCALE[4];
            roof.scale.set(size[0], size[1], size[2]);
            roof.position.set(fallAt.x, fallAt.y + size[1] / 2, fallAt.z);
         }
      }

      const step = PLAN[run.planIndex];
      for (const kind of MODEL_KINDS) {
         const g = carriedModels.current[kind];
         if (!g) continue;
         g.visible = run.carried === kind;
         if (g.visible) g.position.set(run.hookX, run.hookY - VISUAL_EXTENSION - KIND_SCALE[kind][1], run.hookZ);
      }
      const mesh = carried.current;
      if (mesh) {
         if (run.carried !== 4) mesh.visible = false;
         else {
            mesh.visible = true;
            const size = KIND_SCALE[run.carried];
            mesh.scale.set(size[0], size[1], size[2]);
            mesh.position.set(run.hookX, run.hookY - VISUAL_EXTENSION - size[1] / 2, run.hookZ);
            const mat = mesh.material;
            if (!Array.isArray(mat) && mat && "color" in mat) {
               (mat as { color: Color }).color.copy(KIND_COLOR[run.carried]);
            }
         }
      }
      const show = !!step && run.carried >= 0;
      const top = step ? step.floor * FLOOR : 0;
      const xz = step ? slotXZ(step.slot) : slot;
      const rating = landingMarker(run, marker.current);
      const end = marker.current;
      const e = extension.current;
      if (e) {
         e.visible = show;
         e.position.set(run.hookX, run.hookY - VISUAL_EXTENSION / 2, run.hookZ);
      }
      dash.visible = show;
      if (show) {
         const positions = dash.geometry.attributes.position;
         positions.setXYZ(0, run.hookX, run.hookY - VISUAL_EXTENSION, run.hookZ);
         positions.setXYZ(1, end.x, end.y, end.z);
         positions.needsUpdate = true;
         const distances = dash.geometry.attributes.lineDistance;
         distances.setX(1, Math.hypot(end.x - run.hookX, end.y - run.hookY + VISUAL_EXTENSION, end.z - run.hookZ));
         distances.needsUpdate = true;
         dash.material.color.set(markerColor(rating));
      }
      const g = guide.current;
      if (g) {
         g.visible = show;
         g.position.set(end.x, end.y, end.z);
         g.scale.setScalar(1.25);
         guideMat.color.set(markerColor(rating));
      }
      const b = blob.current;
      if (b) {
         b.visible = run.phase === "play";
         const surface = shadowTop(run, shadowAt.current);
         b.position.set(run.hookX, surface + 0.035, run.hookZ);
         b.scale.setScalar(1 + Math.max(0, run.hookY - surface) * 0.035);
      }
      const r = ring.current;
      if (r && step) {
         r.position.set(xz.x, top + 0.07, xz.z);
         // the target slot pulses while a piece is on the hook
         r.scale.setScalar(run.carried >= 0 ? 1.15 + 0.2 * (0.5 + 0.5 * Math.sin(now * 6)) : 1);
      }
      const fl = flash.current;
      if (fl) {
         // the coral miss flash comes when the dropped piece lands, not when it leaves the hook
         const since = missFlash.current >= 0 ? now - missFlash.current : 9;
         const where = slotXZ(run.flashSlot);
         fl.position.set(where.x, fall.current.top + 0.08, where.z);
         fl.scale.setScalar(1 + since * 1.5);
         flashMat.opacity = since < 0.45 ? 0.85 * (1 - since / 0.45) : 0;
      }
   });

   return (
      <group name="construction-pieces">
         {MODEL_KINDS.map((kind) => (
            <DynamicInstancedModel
               key={kind}
               asset={PIECE_ASSETS[kind]}
               count={16}
               name={`placed-pieces-${kind}`}
               fallbackParts={standIns[kind]}
               update={(index, matrix) => {
                  const piece = run.pieces[index];
                  if (!piece?.on || piece.kind !== kind || hidden(fall.current, piece.slot, piece.floor)) return false;
                  const at = slotXZ(piece.slot);
                  pos.set(at.x, piece.floor * FLOOR, at.z);
                  scl.set(1, 1, 1);
                  matrix.compose(pos, quat, scl);
               }}
            />
         ))}
         <DynamicInstanced
            count={16}
            tinted
            parts={parts}
            name="placed-pieces"
            update={(index, matrix, color) => {
               const piece = run.pieces[index];
               if (!piece?.on || piece.kind !== 4 || hidden(fall.current, piece.slot, piece.floor)) return false;
               const size = KIND_SCALE[piece.kind];
               const at = slotXZ(piece.slot);
               pos.set(at.x, piece.floor * FLOOR + size[1] / 2, at.z);
               scl.set(size[0], size[1], size[2]);
               matrix.compose(pos, quat, scl);
               color.copy(KIND_COLOR[piece.kind]);
            }}
         />
         <mesh ref={carried} geometry={pieceGeo} dispose={null} name="carried-piece">
            <meshStandardMaterial color="#ffffff" roughness={0.65} />
         </mesh>
         {MODEL_KINDS.map((kind) => (
            <group key={kind} ref={(el) => { carriedModels.current[kind] = el; }} visible={false} name={`carried-piece-${kind}`}>
               <Model
                  asset={PIECE_ASSETS[kind]}
                  fallback={
                     <mesh geometry={pieceGeo} dispose={null} position-y={KIND_SCALE[kind][1] / 2} scale={[KIND_SCALE[kind][0], KIND_SCALE[kind][1], KIND_SCALE[kind][2]]}>
                        <meshStandardMaterial color={KIND_COLOR[kind]} roughness={0.65} />
                     </mesh>
                  }
               />
            </group>
         ))}
         <mesh ref={fallRoof} geometry={pieceGeo} visible={false} dispose={null} name="falling-piece">
            <meshStandardMaterial color={KIND_COLOR[4]} roughness={0.65} />
         </mesh>
         {MODEL_KINDS.map((kind) => (
            <group key={kind} ref={(el) => { fallModels.current[kind] = el; }} visible={false} name={`falling-piece-${kind}`}>
               <Model
                  asset={PIECE_ASSETS[kind]}
                  fallback={
                     <mesh geometry={pieceGeo} dispose={null} position-y={KIND_SCALE[kind][1] / 2} scale={[KIND_SCALE[kind][0], KIND_SCALE[kind][1], KIND_SCALE[kind][2]]}>
                        <meshStandardMaterial color={KIND_COLOR[kind]} roughness={0.65} />
                     </mesh>
                  }
               />
            </group>
         ))}
         <mesh ref={ring} geometry={ringGeo} material={slotMat} rotation-x={-Math.PI / 2} dispose={null} name="slot-ring" />
         <mesh ref={guide} geometry={ringGeo} material={guideMat} rotation-x={-Math.PI / 2} dispose={null} name="guide-ring" />
         <group ref={blob} name="hook-shadow">
            <BlobShadow radius={0.5} opacity={0.16} />
            <BlobShadow radius={0.4} opacity={0.16} y={0.014} />
            <BlobShadow radius={0.3} opacity={0.16} y={0.016} />
         </group>
         <mesh ref={extension} geometry={cableGeo} material={steel} scale-y={VISUAL_EXTENSION} dispose={null} name="visual-extension-cable" />
         <primitive object={dash} frustumCulled={false} name="landing-dashed-guide" />
         <mesh ref={flash} geometry={ringGeo} material={flashMat} rotation-x={-Math.PI / 2} dispose={null} name="miss-flash" />
      </group>
   );
}
