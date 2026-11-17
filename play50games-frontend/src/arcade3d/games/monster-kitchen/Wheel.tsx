"use client";

// The lazy Susan and the eight ingredient slots. The rules index (run.rotation, an integer mod 8) is
// the truth the Scene picks against; the drawn disc eases toward it (0.18 s per slot, shortest way
// round), and every ingredient pool places its copies on the eased ring: one copy per slot holding its
// kind, plus copy 8, the single toss in flight on the rules' fixed parabola. Eight pools are GLBs (one
// draw call each, the eyeball and the slime cube fall back to procedural parts. No setState, no allocation in
// the frame callbacks. A selector (a ring plus a bobbing arrow, green when an order needs that
// ingredient, red when it would burp) rides under the ingredient Space / Enter tosses: it sits on that
// ingredient's DRAWN spot, so mid-turn it travels in with it and never marks the wrong item.
// Ingredients swell as they reach the front centre, so the one in hand reads at a glance.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Matrix4, Quaternion, Vector3, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { DynamicInstancedModel, Model } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS } from "./assets";
import { COLORS } from "./looks";
import { useEyeballParts, useSlimeParts } from "./Primitives";
import {
   TOSS,
   WHEEL,
   centreSlot,
   drawnSlotPosition,
   easeWheel,
   frontScale,
   isNeeded,
   tossArcPos,
   type IngredientKind,
   type RunState,
} from "./rules";

/** The drawn wheel's shared look: the eased index and the last dull wobble, written here and in the Scene. */
export interface WheelLook {
   /** the drawn wheel index (slots, fractional), eased toward run.rotation */
   rot: number;
   /** animation time of the last empty-slot tap wobble (time.now domain) */
   wobbleAt: number;
}

const UP = new Vector3(0, 1, 0);
const Q = new Quaternion();
const V = new Vector3();
const SCALED = new Vector3(1, 1, 1);
const SPOT = { x: 0, y: 0, z: 0 };
const YES = new Color(COLORS.yes);
const NO = new Color(COLORS.no);
const IDLE = new Color(COLORS.idle);

/** the selector's height over the counter (ring) and its spot, rewritten each frame */
const SELECT_Y = WHEEL.y + 0.035;
const SELECT = { x: WHEEL.x, y: WHEEL.y, z: WHEEL.z + WHEEL.ringR };

const GLB_KINDS = ["apple", "banana", "burger", "sock", "tinCan", "fish", "eyeball", "slime"] as const satisfies readonly IngredientKind[];

/** Where slot k stands on the drawn wheel, and the yaw that faces it outward (writes into SPOT). */
function slotSpot(slot: number, rot: number): number {
   const a = ((slot + rot - WHEEL.front) * Math.PI) / 4;
   SPOT.x = WHEEL.x + WHEEL.ringR * Math.sin(a);
   SPOT.y = WHEEL.y + 0.03;
   SPOT.z = WHEEL.z + WHEEL.ringR * Math.cos(a);
   return a;
}

/** Place copy i of `kind`: the i-th slot holding it, else the flight (copy 8). Returns false to hide. */
function placeCopy(run: RunState, look: WheelLook, kind: IngredientKind, i: number, m: Matrix4): boolean {
   let n = 0;
   for (let slot = 0; slot < WHEEL.slots; slot++) {
      if (run.slots[slot].kind !== kind) continue;
      if (n === i) {
         const a = slotSpot(slot, look.rot);
         SCALED.setScalar(frontScale(slot, look.rot));
         m.compose(V.set(SPOT.x, SPOT.y, SPOT.z), Q.setFromAxisAngle(UP, a), SCALED);
         return true;
      }
      n += 1;
   }
   if (i === WHEEL.slots && run.flight && run.flight.kind === kind) {
      const k = (run.time - run.flight.launchAt) / TOSS.flightS;
      if (k <= 1) {
         tossArcPos(run.flight, k, SPOT);
         SCALED.setScalar(1.3);
         m.compose(V.set(SPOT.x, SPOT.y, SPOT.z), Q.setFromAxisAngle(UP, k * 8), SCALED);
         return true;
      }
   }
   return false;
}

export function Wheel({ run, look }: { run: RunState; look: WheelLook }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const eyeballParts = useEyeballParts();
   const slimeParts = useSlimeParts();
   const ring = useRef<Mesh>(null);
   const arrow = useRef<Mesh>(null);

   useFrame(() => {
      // ease the drawn wheel toward the rules index: 0.18 s per slot, the short way round
      look.rot = easeWheel(look.rot, run.rotation, time.delta / WHEEL.rotateS);
      const g = root.current;
      if (!g) return;
      g.rotation.y = (look.rot * Math.PI) / 4;
      // a tapped empty slot sets the whole disc wobbling dully for a moment
      const wobble = time.now - look.wobbleAt;
      g.scale.y = wobble < 0.4 ? 1 - 0.07 * Math.sin((wobble / 0.4) * Math.PI * 3) * (1 - wobble / 0.4) : 1;
      // the selector: green = an order needs the ingredient in hand, red = it would burp, grey while
      // a toss is up, the burp lock holds or the slot is empty
      const centre = centreSlot(run.rotation);
      const kind = run.slots[centre].kind;
      drawnSlotPosition(centre, look.rot, SELECT);
      const busy = run.flight !== null || run.time < run.burpUntil || kind === null;
      const colour = busy ? IDLE : isNeeded(run, kind) ? YES : NO;
      const r = ring.current;
      const p = arrow.current;
      if (r) {
         r.position.set(SELECT.x, SELECT_Y, SELECT.z);
         (r.material as MeshBasicMaterial).color.copy(colour);
         (r.material as MeshBasicMaterial).opacity = busy ? 0.35 : 0.95;
      }
      if (p) {
         (p.material as MeshBasicMaterial).color.copy(colour);
         p.visible = !busy;
         p.position.set(SELECT.x, SELECT_Y + 0.62 + 0.05 * Math.sin(time.now * 6), SELECT.z);
      }
   });

   return (
      <group name="wheel-and-ingredients">
         <group ref={root} position={[WHEEL.x, WHEEL.y, WHEEL.z]}>
            {/* The Hyper3D lazy Susan turntable; the wood disc, brass rim, ring and medallion are its fallback */}
            <Model
               asset={ASSETS.lazySusan}
               fallback={
                  <group>
                     {/* Rich polished wood turntable disc */}
                     <mesh>
                        <cylinderGeometry args={[WHEEL.discR, WHEEL.discR, 0.05, 32]} />
                        <meshStandardMaterial color={COLORS.wheelWood} roughness={0.45} metalness={0.06} />
                     </mesh>
                     {/* Polished copper/brass bevel rim */}
                     <mesh rotation-x={Math.PI / 2} position-y={0.012}>
                        <torusGeometry args={[WHEEL.discR - 0.008, 0.028, 12, 36]} />
                        <meshStandardMaterial color={COLORS.copperHighlight} metalness={0.82} roughness={0.25} />
                     </mesh>
                     {/* Inlaid radial brass ring */}
                     <mesh rotation-x={-Math.PI / 2} position-y={0.026}>
                        <ringGeometry args={[0.68, 0.72, 32]} />
                        <meshStandardMaterial color={COLORS.wheelBrass} metalness={0.75} roughness={0.3} />
                     </mesh>
                     {/* Central brass pivot medallion */}
                     <mesh position-y={0.03}>
                        <cylinderGeometry args={[0.16, 0.18, 0.035, 24]} />
                        <meshStandardMaterial color={COLORS.brass} metalness={0.85} roughness={0.25} />
                     </mesh>
                  </group>
               }
            />
         </group>

         <mesh
            ref={ring}
            name="selector-ring"
            rotation-x={-Math.PI / 2}
            position={[SELECT.x, SELECT_Y, SELECT.z]}
            renderOrder={1}
         >
            <ringGeometry args={[0.2, 0.27, 32]} />
            <meshBasicMaterial color={COLORS.idle} transparent opacity={0.95} depthWrite={false} />
         </mesh>

         <mesh
            ref={arrow}
            name="selector-arrow"
            rotation-x={Math.PI}
            position={[SELECT.x, SELECT_Y + 0.62, SELECT.z]}
         >
            <coneGeometry args={[0.08, 0.16, 14]} />
            <meshBasicMaterial color={COLORS.idle} />
         </mesh>

         {GLB_KINDS.map((kind) => (
            <DynamicInstancedModel
               key={kind}
               asset={ASSETS[kind]}
               count={WHEEL.slots + 1}
               update={(i, m) => placeCopy(run, look, kind, i, m)}
               fallbackParts={kind === "eyeball" ? eyeballParts : kind === "slime" ? slimeParts : undefined}
               name={`ingredient-${kind}`}
            />
         ))}
      </group>
   );
}
