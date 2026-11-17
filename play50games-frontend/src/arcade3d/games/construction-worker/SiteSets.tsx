"use client";

// The level's surroundings (sets.ts): one InstancedModel per reused GLB kind (draw calls = meshes per
// kind, not per copy) and the site's code-built landmark (a garden shed, a garage with its roll-up
// door, a neon shop sign, a second tower crane). Bevelled two-tone boxes, built once per mount.
import { useEffect, useMemo } from "react";
import { BoxGeometry, BufferAttribute, BufferGeometry, Color, CylinderGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { InstancedModel } from "@/arcade3d/core/assets";
import { useCanvasTexture } from "@/arcade3d/core/render/useCanvasTexture";
import { useQuality } from "@/arcade3d/core/quality";
import type { CraneSite } from "./levels";
import { SETS, SET_ASSETS, setDrop, type Landmark, type SetKind, type SetSpot } from "./sets";

function tinted(raw: BufferGeometry, hex: string): BufferGeometry {
   const geo = raw.index ? raw.toNonIndexed() : raw;
   const n = geo.attributes.position.count;
   const colors = new Float32Array(n * 3);
   const c = new Color(hex);
   for (let i = 0; i < n; i++) {
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
   }
   geo.setAttribute("color", new BufferAttribute(colors, 3));
   // merged parts must share one attribute set: position, normal, color (the gable has no uv)
   for (const name of Object.keys(geo.attributes)) if (name !== "position" && name !== "normal" && name !== "color") geo.deleteAttribute(name);
   if (geo !== raw) raw.dispose();
   return geo;
}

function merged(parts: BufferGeometry[]): BufferGeometry {
   const out = mergeGeometries(parts);
   if (!out) throw new Error("landmark parts do not merge");
   for (const p of parts) p.dispose();
   return out;
}

/** A gable roof (a triangular prism) over a w x d footprint, its ridge `rise` above `y`, along z. */
function gable(w: number, d: number, rise: number, y: number, hex: string): BufferGeometry {
   const hw = w / 2 + 0.15;
   const hd = d / 2 + 0.15;
   const p = [
      // two slopes
      -hw, y, -hd, 0, y + rise, -hd, 0, y + rise, hd,
      -hw, y, -hd, 0, y + rise, hd, -hw, y, hd,
      hw, y, -hd, hw, y, hd, 0, y + rise, hd,
      hw, y, -hd, 0, y + rise, hd, 0, y + rise, -hd,
      // the two gable ends
      -hw, y, hd, 0, y + rise, hd, hw, y, hd,
      -hw, y, -hd, hw, y, -hd, 0, y + rise, -hd,
   ];
   const geo = new BufferGeometry();
   geo.setAttribute("position", new BufferAttribute(new Float32Array(p), 3));
   geo.computeVertexNormals();
   return tinted(geo, hex);
}

function gardenShed(): BufferGeometry {
   return merged([
      tinted(new RoundedBoxGeometry(2.6, 2.1, 2.2, 2, 0.05).translate(0, 1.05, 0), "#a16207"),
      tinted(new BoxGeometry(2.64, 0.12, 2.24).translate(0, 0.06, 0), "#57534e"),
      tinted(new BoxGeometry(0.9, 1.7, 0.06).translate(0.5, 0.85, 1.11), "#78350f"),
      tinted(new BoxGeometry(0.6, 0.5, 0.06).translate(-0.6, 1.25, 1.11), "#bae6fd"),
      tinted(new BoxGeometry(0.7, 0.06, 0.08).translate(-0.6, 0.98, 1.13), "#f8fafc"),
      gable(2.6, 2.2, 0.9, 2.1, "#b91c1c"),
      // a flower box under the window
      tinted(new BoxGeometry(0.8, 0.18, 0.2).translate(-0.6, 0.86, 1.2), "#4d7c0f"),
      tinted(new BoxGeometry(0.7, 0.08, 0.16).translate(-0.6, 0.98, 1.2), "#f472b6"),
   ]);
}

function garage(): BufferGeometry {
   const parts: BufferGeometry[] = [
      tinted(new RoundedBoxGeometry(7, 3.4, 5, 2, 0.08).translate(0, 1.7, 0), "#d6d3d1"),
      tinted(new BoxGeometry(7.4, 0.35, 5.4).translate(0, 3.55, 0), "#44403c"),
      // the roll-up door frame, then its slats (alternating tones read as corrugation)
      tinted(new BoxGeometry(5.4, 2.9, 0.12).translate(0, 1.45, 2.52), "#1f2937"),
   ];
   for (let i = 0; i < 9; i++) parts.push(tinted(new BoxGeometry(5.0, 0.27, 0.06).translate(0, 0.2 + i * 0.3, 2.6), i % 2 ? "#94a3b8" : "#cbd5e1"));
   // hazard stripes on the door's sill and a lamp over it
   for (let i = 0; i < 8; i++) parts.push(tinted(new BoxGeometry(0.62, 0.12, 0.2).translate(-2.2 + i * 0.63, 0.06, 2.75), i % 2 ? "#0f172a" : "#facc15"));
   parts.push(tinted(new BoxGeometry(0.5, 0.18, 0.3).translate(0, 3.12, 2.7), "#fde68a"));
   return merged(parts);
}

function towerCrane(): BufferGeometry {
   const parts: BufferGeometry[] = [];
   const yellow = "#f59e0b";
   const dark = "#1f2937";
   // the mast: four legs and cross bars, 16 m
   for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) parts.push(tinted(new BoxGeometry(0.16, 16, 0.16).translate(x, 8, z), yellow));
   for (let y = 1; y < 16; y += 1.6) {
      parts.push(tinted(new BoxGeometry(1.36, 0.1, 0.1).translate(0, y, -0.6), yellow));
      parts.push(tinted(new BoxGeometry(1.36, 0.1, 0.1).translate(0, y, 0.6), yellow));
      parts.push(tinted(new BoxGeometry(0.1, 0.1, 1.36).translate(-0.6, y, 0), yellow));
      parts.push(tinted(new BoxGeometry(0.1, 0.1, 1.36).translate(0.6, y, 0), yellow));
   }
   parts.push(tinted(new BoxGeometry(2.2, 0.5, 2.2).translate(0, 0.25, 0), dark));
   // the jib, the counter-jib, the counterweight, the cab and the apex
   parts.push(tinted(new BoxGeometry(0.7, 0.8, 14).translate(0, 16.4, 5), yellow));
   parts.push(tinted(new BoxGeometry(0.7, 0.6, 5).translate(0, 16.3, -4.2), yellow));
   parts.push(tinted(new BoxGeometry(1.4, 1.4, 1.4).translate(0, 15.6, -6), "#475569"));
   parts.push(tinted(new BoxGeometry(1.2, 1.2, 1.3).translate(0.9, 15.4, 0.6), "#e2e8f0"));
   parts.push(tinted(new CylinderGeometry(0.12, 0.4, 3, 4).translate(0, 18.3, 0), yellow));
   // the hook hanging off the jib
   parts.push(tinted(new BoxGeometry(0.04, 7, 0.04).translate(0, 12.5, 9), dark));
   parts.push(tinted(new BoxGeometry(0.5, 0.7, 0.4).translate(0, 8.7, 9), yellow));
   return merged(parts);
}

/** A lit shop sign on poles: the canvas reads SHOP in warm neon. */
function NeonSign() {
   const tex = useCanvasTexture(512, 128, (ctx) => {
      ctx.fillStyle = "#1e1b4b";
      ctx.fillRect(0, 0, 512, 128);
      ctx.strokeStyle = "#f472b6";
      ctx.lineWidth = 10;
      ctx.strokeRect(10, 10, 492, 108);
      ctx.fillStyle = "#fde047";
      ctx.font = "bold 84px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("SHOP", 256, 68);
   });
   return (
      <group name="neon-sign">
         {[-2.1, 2.1].map((x) => (
            <mesh key={x} position={[x, 3, 0]}>
               <cylinderGeometry args={[0.07, 0.09, 6, 8]} />
               <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.4} />
            </mesh>
         ))}
         <mesh position={[0, 5.6, 0.05]}>
            <boxGeometry args={[4.6, 1.25, 0.12]} />
            <meshStandardMaterial color="#1e1b4b" />
         </mesh>
         <mesh position={[0, 5.6, 0.12]}>
            <planeGeometry args={[4.4, 1.1]} />
            <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={1.4} toneMapped={false} />
         </mesh>
      </group>
   );
}

/** A code-built landmark's merged, vertex-coloured geometry (sites.test.ts builds each one). */
export function landmarkGeometry(kind: Exclude<Landmark, null | "neonSign">): BufferGeometry {
   return kind === "gardenShed" ? gardenShed() : kind === "garage" ? garage() : towerCrane();
}

function LandmarkMesh({ kind }: { kind: Exclude<Landmark, null | "neonSign"> }) {
   const geo = useMemo(() => landmarkGeometry(kind), [kind]);
   useEffect(() => () => geo.dispose(), [geo]);
   return (
      <mesh geometry={geo} name={`landmark-${kind}`}>
         <meshStandardMaterial vertexColors roughness={0.7} metalness={kind === "towerCrane" ? 0.2 : 0} side={2} />
      </mesh>
   );
}

/** The red aircraft lamps on the night tower crane and the beacons: small unlit-bright spheres. */
function NightLamps({ at }: { at: { x: number; z: number; rotY: number } }) {
   return (
      <group position={[at.x, 0, at.z]} rotation-y={at.rotY}>
         {[[0, 19.9, 0], [0, 16.9, 11.8], [0, 16.7, -6.5]].map(([x, y, z], i) => (
            <mesh key={i} position={[x, y, z]}>
               <sphereGeometry args={[0.22, 10, 8]} />
               <meshBasicMaterial color="#ef4444" toneMapped={false} />
            </mesh>
         ))}
      </group>
   );
}

/** The level's set: reused GLBs by kind, the landmark and (at night) the crane's lamps. */
export function Sets({ site }: { site: CraneSite }) {
   const set = SETS[site];
   const decor = useQuality().tier !== "low";
   const byKind = useMemo(() => {
      const map = new Map<SetKind, Array<{ x: number; y: number; z: number; rotY: number; scale: number }>>();
      for (const spot of set.spots as readonly SetSpot[]) {
         const list = map.get(spot.kind) ?? [];
         list.push({ x: spot.x, y: -setDrop(spot), z: spot.z, rotY: spot.rotY ?? 0, scale: spot.h });
         map.set(spot.kind, list);
      }
      return [...map.entries()];
   }, [set]);
   const at = set.landmarkAt;
   return (
      <group name={`set-${site}`}>
         {byKind.map(([kind, spots]) => (
            <InstancedModel
               key={kind}
               asset={SET_ASSETS[kind]}
               spots={spots}
               fallback={
                  <>
                     {spots.map((s, i) => (
                        <mesh key={i} position={[s.x, s.scale / 2, s.z]}>
                           <boxGeometry args={[s.scale * 0.6, s.scale, s.scale * 0.6]} />
                           <meshStandardMaterial color="#a8a29e" />
                        </mesh>
                     ))}
                  </>
               }
            />
         ))}
         {set.landmark && (
            <group position={[at.x, 0, at.z]} rotation-y={at.rotY}>
               {set.landmark === "neonSign" ? <NeonSign /> : <LandmarkMesh kind={set.landmark} />}
            </group>
         )}
         {decor && set.landmark === "towerCrane" && <NightLamps at={at} />}
      </group>
   );
}
