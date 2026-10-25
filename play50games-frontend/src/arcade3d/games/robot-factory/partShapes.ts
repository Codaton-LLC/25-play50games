// The parts' procedural silhouettes: one merged, vertex-coloured geometry per shape (one draw call per
// pool). The light tone is multiplied by the part colour (instance tint), the dark joints stay dark,
// so every part reads in two or three tones. Origin = the part's feet. Also the torso and cell
// stand-ins drawn while their GLBs are missing.
import {
   BufferAttribute,
   Color,
   ConeGeometry,
   CylinderGeometry,
   SphereGeometry,
   TorusGeometry,
   type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { COLORS } from "./looks";

const BODY = new Color("#ffffff");
const DARK = new Color(COLORS.joint);
const LIGHT = new Color("#e2e8f0");

/** A piece in one tone, moved into place, without an index (so pieces of any kind merge). */
function piece(geometry: BufferGeometry, tone: Color, x = 0, y = 0, z = 0, rx = 0, rz = 0): BufferGeometry {
   if (rx) geometry.rotateX(rx);
   if (rz) geometry.rotateZ(rz);
   geometry.translate(x, y, z);
   const flat = geometry.index ? geometry.toNonIndexed() : geometry;
   if (flat !== geometry) geometry.dispose();
   const n = flat.getAttribute("position").count;
   const colors = new Float32Array(n * 3);
   for (let i = 0; i < n; i++) tone.toArray(colors, i * 3);
   flat.setAttribute("color", new BufferAttribute(colors, 3));
   return flat;
}

function merge(pieces: BufferGeometry[]): BufferGeometry {
   const merged = mergeGeometries(pieces, false)!;
   for (const p of pieces) p.dispose();
   merged.computeBoundingSphere();
   return merged;
}

const round = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 2, r);

/** Builders by SHAPES index (rules.ts): barrel, crate, battery, dome, boxHead, antenna, claw, wrench, drill. */
const BUILDERS: Array<() => BufferGeometry> = [
   // 0: barrel torso (cylindrical barrel with bevelled rims and industrial reinforcement bands)
   () =>
      merge([
         piece(new CylinderGeometry(0.21, 0.21, 0.46, 22), BODY, 0, 0.25, 0),
         piece(new CylinderGeometry(0.228, 0.228, 0.035, 22), DARK, 0, 0.12, 0),
         piece(new CylinderGeometry(0.228, 0.228, 0.035, 22), DARK, 0, 0.38, 0),
         piece(new CylinderGeometry(0.18, 0.2, 0.04, 20), DARK, 0, 0.02, 0),
         piece(new CylinderGeometry(0.06, 0.06, 0.02, 14), LIGHT, 0.08, 0.485, 0.06),
      ]),

   // 1: crate torso (reinforced cargo crate with bevelled edges and recessed panel insets)
   () =>
      merge([
         piece(round(0.5, 0.34, 0.48, 0.04), BODY, 0, 0.17, 0),
         piece(round(0.07, 0.35, 0.49, 0.015), DARK, -0.14, 0.175, 0),
         piece(round(0.07, 0.35, 0.49, 0.015), DARK, 0.14, 0.175, 0),
         piece(round(0.48, 0.05, 0.46, 0.015), LIGHT, 0, 0.33, 0),
      ]),

   // 2: battery cell (power cell with cathode/anode terminal and status indicator band)
   () =>
      merge([
         piece(new CylinderGeometry(0.11, 0.11, 0.36, 18), BODY, 0, 0.2, 0),
         piece(new CylinderGeometry(0.118, 0.118, 0.06, 18), DARK, 0, 0.04, 0),
         piece(new CylinderGeometry(0.05, 0.05, 0.07, 14), LIGHT, 0, 0.415, 0),
         piece(new CylinderGeometry(0.116, 0.116, 0.03, 18), LIGHT, 0, 0.28, 0),
      ]),

   // 3: dome head (sleek rounded droid dome with visor strip and ear sensors)
   () =>
      merge([
         piece(new CylinderGeometry(0.2, 0.21, 0.1, 22), DARK, 0, 0.05, 0),
         piece(new SphereGeometry(0.2, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2), BODY, 0, 0.1, 0),
         piece(round(0.28, 0.08, 0.08, 0.025), DARK, 0, 0.19, 0.15),
         piece(round(0.2, 0.025, 0.02, 0.008), LIGHT, 0, 0.19, 0.195),
         piece(new CylinderGeometry(0.035, 0.035, 0.04, 12), LIGHT, -0.21, 0.12, 0, 0, Math.PI / 2),
         piece(new CylinderGeometry(0.035, 0.035, 0.04, 12), LIGHT, 0.21, 0.12, 0, 0, Math.PI / 2),
      ]),

   // 4: boxHead (futuristic square robot head with bevelled visor and dual camera eyes)
   () =>
      merge([
         piece(new CylinderGeometry(0.08, 0.1, 0.07, 16), DARK, 0, 0.035, 0),
         piece(round(0.36, 0.28, 0.32, 0.045), BODY, 0, 0.21, 0),
         piece(new CylinderGeometry(0.04, 0.04, 0.035, 14), LIGHT, -0.08, 0.23, 0.165, Math.PI / 2),
         piece(new CylinderGeometry(0.04, 0.04, 0.035, 14), LIGHT, 0.08, 0.23, 0.165, Math.PI / 2),
         piece(round(0.05, 0.08, 0.05, 0.012), DARK, 0, 0.38, 0),
         piece(new SphereGeometry(0.02, 8, 8), LIGHT, 0, 0.42, 0),
      ]),

   // 5: antenna head (cylindrical communications robot head with dual ear dishes and antenna)
   () =>
      merge([
         piece(new CylinderGeometry(0.16, 0.18, 0.06, 20), DARK, 0, 0.03, 0),
         piece(new CylinderGeometry(0.16, 0.16, 0.22, 20), BODY, 0, 0.17, 0),
         piece(round(0.22, 0.05, 0.03, 0.01), DARK, 0, 0.19, 0.155),
         piece(new CylinderGeometry(0.012, 0.012, 0.14, 8), DARK, 0, 0.35, 0),
         piece(new SphereGeometry(0.035, 12, 10), LIGHT, 0, 0.43, 0),
      ]),

   // 6: claw arm (articulated industrial robotic pincer with hydraulic knuckle)
   () =>
      merge([
         piece(new CylinderGeometry(0.07, 0.08, 0.24, 16), BODY, 0, 0.12, 0),
         piece(new SphereGeometry(0.078, 14, 12), DARK, 0, 0.27, 0),
         piece(round(0.045, 0.16, 0.06, 0.015), LIGHT, -0.06, 0.37, 0, 0, -0.3),
         piece(round(0.045, 0.16, 0.06, 0.015), LIGHT, 0.06, 0.37, 0, 0, 0.3),
      ]),

   // 7: wrench arm (mechanical tool arm with knurled shaft and bevelled wrench jaw)
   () =>
      merge([
         piece(round(0.085, 0.3, 0.065, 0.02), BODY, 0, 0.15, 0),
         piece(new TorusGeometry(0.075, 0.032, 10, 20, Math.PI * 1.4), DARK, 0, 0.37, 0, 0, -Math.PI * 0.2),
         piece(round(0.05, 0.05, 0.045, 0.01), LIGHT, 0, 0.03, 0),
      ]),

   // 8: drill arm (heavy-duty drill end-effector with chuck collar and fluted cone bit)
   () =>
      merge([
         piece(new CylinderGeometry(0.07, 0.08, 0.16, 16), DARK, 0, 0.08, 0),
         piece(new CylinderGeometry(0.092, 0.092, 0.06, 18), LIGHT, 0, 0.16, 0),
         piece(new ConeGeometry(0.08, 0.25, 16), BODY, 0, 0.31, 0),
         piece(new CylinderGeometry(0.02, 0.02, 0.05, 10), DARK, 0, 0.45, 0),
      ]),
];

export function buildShape(index: number): BufferGeometry {
   return BUILDERS[index]();
}
