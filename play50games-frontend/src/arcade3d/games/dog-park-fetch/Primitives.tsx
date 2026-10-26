"use client";

// Bevelled, two- and three-tone stand-ins until the dog-park-fetch GLBs are in the manifest.
// Geometry is built once at module level; each piece is a plain mesh with a flat material.
import { CylinderGeometry, SphereGeometry, TorusGeometry } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { COLORS } from "./looks";

const BODY = new RoundedBoxGeometry(0.34, 0.26, 0.56, 2, 0.09);
const HEAD = new RoundedBoxGeometry(0.28, 0.24, 0.26, 2, 0.08);
const EAR = new RoundedBoxGeometry(0.08, 0.14, 0.05, 2, 0.02);
const LEG = new RoundedBoxGeometry(0.09, 0.2, 0.09, 2, 0.03);
const TAIL = new CylinderGeometry(0.03, 0.045, 0.3, 8);
const NOSE = new SphereGeometry(0.04, 8, 6);

/** A dog about 0.55 m long, feet on the grass at its origin, facing +z. */
export function DogFigure() {
   return (
      <group>
         <mesh position={[0, 0.34, 0]} geometry={BODY}>
            <meshStandardMaterial color={COLORS.dog} roughness={0.7} />
         </mesh>
         <mesh position={[0.1, 0.1, 0.18]} geometry={LEG}>
            <meshStandardMaterial color={COLORS.dogDark} roughness={0.7} />
         </mesh>
         <mesh position={[-0.1, 0.1, 0.18]} geometry={LEG}>
            <meshStandardMaterial color={COLORS.dogDark} roughness={0.7} />
         </mesh>
         <mesh position={[0.1, 0.1, -0.18]} geometry={LEG}>
            <meshStandardMaterial color={COLORS.dogDark} roughness={0.7} />
         </mesh>
         <mesh position={[-0.1, 0.1, -0.18]} geometry={LEG}>
            <meshStandardMaterial color={COLORS.dogDark} roughness={0.7} />
         </mesh>
         <mesh position={[0, 0.5, 0.3]} geometry={HEAD}>
            <meshStandardMaterial color={COLORS.dog} roughness={0.7} />
         </mesh>
         <mesh position={[0.1, 0.62, 0.28]} rotation={[0, 0, 0.3]} geometry={EAR}>
            <meshStandardMaterial color={COLORS.dogDark} roughness={0.7} />
         </mesh>
         <mesh position={[-0.1, 0.62, 0.28]} rotation={[0, 0, -0.3]} geometry={EAR}>
            <meshStandardMaterial color={COLORS.dogDark} roughness={0.7} />
         </mesh>
         <mesh position={[0, 0.44, 0.46]} geometry={NOSE}>
            <meshStandardMaterial color={COLORS.dogNose} roughness={0.5} />
         </mesh>
         <mesh position={[0, 0.42, -0.36]} rotation={[0.9, 0, 0]} geometry={TAIL}>
            <meshStandardMaterial color={COLORS.dogDark} roughness={0.7} />
         </mesh>
      </group>
   );
}

const OWNER_BODY = new RoundedBoxGeometry(0.42, 0.7, 0.26, 2, 0.1);
const OWNER_HEAD = new SphereGeometry(0.13, 12, 10);
const OWNER_LEG = new RoundedBoxGeometry(0.14, 0.8, 0.16, 2, 0.05);

/** The owner, about 1.7 m tall, standing (hands on hips in the spec; here two-tone clothes). */
export function OwnerFigure() {
   return (
      <group>
         <mesh position={[-0.1, 0.4, 0]} geometry={OWNER_LEG}>
            <meshStandardMaterial color={COLORS.fence} roughness={0.7} />
         </mesh>
         <mesh position={[0.1, 0.4, 0]} geometry={OWNER_LEG}>
            <meshStandardMaterial color={COLORS.fence} roughness={0.7} />
         </mesh>
         <mesh position={[0, 1.15, 0]} geometry={OWNER_BODY}>
            <meshStandardMaterial color={COLORS.owner} roughness={0.65} />
         </mesh>
         <mesh position={[0, 1.7, 0]} geometry={OWNER_HEAD}>
            <meshStandardMaterial color="#f1d0b4" roughness={0.6} />
         </mesh>
      </group>
   );
}

const MOWER_DECK = new RoundedBoxGeometry(1.1, 0.3, 0.9, 2, 0.08);
const MOWER_SEAT = new RoundedBoxGeometry(0.4, 0.2, 0.4, 2, 0.06);
const MOWER_WHEEL = new CylinderGeometry(0.16, 0.16, 0.1, 12);

/** A ride-on mower about 1.1 m long, facing +z. */
export function MowerPrimitive() {
   return (
      <group>
         <mesh position={[0, 0.3, 0]} geometry={MOWER_DECK}>
            <meshStandardMaterial color={COLORS.mower} roughness={0.5} />
         </mesh>
         <mesh position={[0, 0.5, -0.1]} geometry={MOWER_SEAT}>
            <meshStandardMaterial color={COLORS.mowerDark} roughness={0.6} />
         </mesh>
         {[[-0.55, 0.16, 0.35], [0.55, 0.16, 0.35], [-0.55, 0.16, -0.35], [0.55, 0.16, -0.35]].map(([x, y, z], i) => (
            <mesh key={i} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]} geometry={MOWER_WHEEL}>
               <meshStandardMaterial color={COLORS.mowerDark} roughness={0.8} />
            </mesh>
         ))}
      </group>
   );
}

const BALL = new SphereGeometry(0.11, 14, 10);
const BALL_LINE = new TorusGeometry(0.1, 0.012, 6, 18);

/** A tennis ball with its seam. */
export function BallPrimitive() {
   return (
      <group>
         <mesh geometry={BALL}>
            <meshStandardMaterial color={COLORS.ball} roughness={0.8} />
         </mesh>
         <mesh geometry={BALL_LINE}>
            <meshStandardMaterial color={COLORS.ballLine} roughness={0.8} />
         </mesh>
      </group>
   );
}

const STICK = new CylinderGeometry(0.035, 0.035, 0.42, 8);
const STICK_END = new SphereGeometry(0.035, 8, 6);

/** A wooden fetch stick lying along x. */
export function StickPrimitive() {
   return (
      <group rotation={[0, 0, Math.PI / 2]}>
         <mesh geometry={STICK}>
            <meshStandardMaterial color={COLORS.stick} roughness={0.7} />
         </mesh>
         <mesh position={[0, 0.21, 0]} geometry={STICK_END}>
            <meshStandardMaterial color={COLORS.stick} roughness={0.7} />
         </mesh>
         <mesh position={[0, -0.21, 0]} geometry={STICK_END}>
            <meshStandardMaterial color={COLORS.stick} roughness={0.7} />
         </mesh>
      </group>
   );
}

const FRISBEE_DISC = new CylinderGeometry(0.13, 0.13, 0.03, 20);
const FRISBEE_RIM = new TorusGeometry(0.115, 0.018, 6, 20);

/** A frisbee, flat, with a rim. Its concave side up on the ground. */
export function FrisbeePrimitive() {
   return (
      <group>
         <mesh geometry={FRISBEE_DISC}>
            <meshStandardMaterial color={COLORS.frisbee} roughness={0.5} />
         </mesh>
         <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} geometry={FRISBEE_RIM}>
            <meshStandardMaterial color={COLORS.frisbeeRim} roughness={0.5} />
         </mesh>
      </group>
   );
}
