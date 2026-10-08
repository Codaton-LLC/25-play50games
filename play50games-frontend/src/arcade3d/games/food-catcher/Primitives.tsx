"use client";

// Kitchen, chef and food stand-ins. Drawn until the GLBs are in core/modelManifest.ts.
// The chef stand-in stands on its group's origin and is about 1.8 tall (Scene.tsx puts that origin on
// the worktop, WORKTOP_TOP_Y). Food is centred on the group origin, ~0.9 across.
import { memo, useEffect, useMemo } from "react";
import {
   BoxGeometry,
   Color,
   CylinderGeometry,
   Euler,
   Float32BufferAttribute,
   Matrix4,
   Quaternion,
   Vector3,
   type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useCanvasTexture, type CanvasDraw } from "@/arcade3d/core/render";

export const COLORS = {
   hat: "#f8fafc",
   apron: "#f1f5f9",
   skin: "#f6c7a1",
   scarf: "#ef4444",
   apple: "#ef4444",
   leaf: "#4ade80",
   bun: "#f6d7a8",
   patty: "#7c4a2d",
   lettuce: "#86efac",
   sock: "#d1d5db",
   patch: "#92400e",
   banana: "#facc15",
   tin: "#cbd5e1",
   tinBand: "#94a3b8",
   ring: "#9f1239",
   ringRim: "#f43f5e",
   counter: "#c4a574",
   counterEdge: "#a16207",
   cabinet: "#6b4a2b",
   wall: "#3b2418",
   floor: "#1c1410",
} as const;

/**
 * The wall decor's colours. Muted and darker than anything that falls (the wall is lit dimly, so
 * these render at about half their value): no red, no bright yellow or white, no round fruit-like
 * blobs, so the food and the red junk tell always read first.
 */
const DECOR = {
   slate: "#27302b",
   chalk: "rgba(222, 216, 206, 0.92)",
   chalkFaint: "rgba(222, 216, 206, 0.42)",
   frame: "#7a5636",
   plank: "#86613f",
   stick: "#b9b2a6",
   iron: "#57524d",
   copper: "#a8693f",
   copperDark: "#7c4a2c",
   steel: "#8d9297",
   steelDark: "#5c6166",
   knob: "#36312d",
} as const;

/** The counter box (centre y, height): its top face is the rules' floor, y 0. */
export const COUNTER = { y: -0.28, h: 0.56 } as const;
/** The wooden worktop on the counter (centre y, height), 1 cm sunk into the counter's top. */
export const WORKTOP = { y: 0.02, h: 0.06 } as const;
/**
 * The worktop's top face (y 0.05), where the chef stands: Scene.tsx puts the chef's root group here,
 * so its soles are on the board and not 5 cm inside it (the rules' catch box, y 0 to 1.6, is unchanged).
 */
export const WORKTOP_TOP_Y = WORKTOP.y + WORKTOP.h / 2;

/** The wall's front face (the wall box is centred on z = -0.85, 0.18 deep). */
const WALL_FRONT = -0.76;
/** The chalkboard's slate (the frame is 0.07 wider on every side), where the old grey box hung. */
const BOARD = { x: -2.2, y: 4.65, w: 1.12, h: 0.72, border: 0.07 } as const;
/** The pot shelf: the plank's top centre, its width and depth, where the old dark box hung. */
const SHELF = { x: 1.6, top: 4.78, w: 1.64, depth: 0.36, thick: 0.07 } as const;
const MENU_TEX = { w: 448, h: 288 } as const;

/** The chalkboard: "MENU" and three faint dish lines with a price dash, on dark slate. */
const drawMenuBoard: CanvasDraw = (ctx, w, h) => {
   ctx.fillStyle = DECOR.slate;
   ctx.fillRect(0, 0, w, h);
   // old chalk wiped off: a few faint smears, fixed so every run draws the same board
   ctx.fillStyle = "rgba(222, 216, 206, 0.05)";
   for (const [x, y, rx, ry] of [[0.3, 0.62, 0.22, 0.1], [0.72, 0.4, 0.18, 0.08], [0.55, 0.85, 0.3, 0.07]]) {
      ctx.beginPath();
      ctx.ellipse(x * w, y * h, rx * w, ry * h, -0.12, 0, Math.PI * 2);
      ctx.fill();
   }
   ctx.fillStyle = DECOR.chalk;
   ctx.textAlign = "center";
   ctx.textBaseline = "middle";
   ctx.font = `700 ${Math.round(h * 0.32)}px "Trebuchet MS", "Segoe UI", Arial, sans-serif`;
   ctx.fillText("MENU", w / 2, h * 0.26);
   ctx.strokeStyle = DECOR.chalkFaint;
   ctx.lineCap = "round";
   ctx.lineWidth = h * 0.035;
   for (const [y, end] of [[0.56, 0.6], [0.71, 0.52], [0.86, 0.64]]) {
      ctx.beginPath();
      ctx.moveTo(w * 0.13, h * y);
      ctx.lineTo(w * end, h * y);
      ctx.moveTo(w * 0.76, h * y);
      ctx.lineTo(w * 0.87, h * y);
      ctx.stroke();
   }
};

type AddPiece = (geometry: BufferGeometry, color: string, x: number, y: number, z: number, rotX?: number, rotZ?: number) => void;

/** Vertex-coloured pieces merged into one geometry, so they cost one draw call together. */
function mergedPieces(build: (add: AddPiece) => void): BufferGeometry {
   const pieces: BufferGeometry[] = [];
   const matrix = new Matrix4();
   const turn = new Quaternion();
   const euler = new Euler();
   const at = new Vector3();
   const one = new Vector3(1, 1, 1);
   const tint = new Color();
   build((geometry, color, x, y, z, rotX = 0, rotZ = 0) => {
      geometry.applyMatrix4(matrix.compose(at.set(x, y, z), turn.setFromEuler(euler.set(rotX, 0, rotZ)), one));
      tint.set(color);
      const colors = new Float32Array(geometry.getAttribute("position").count * 3);
      for (let i = 0; i < colors.length; i += 3) {
         colors[i] = tint.r;
         colors[i + 1] = tint.g;
         colors[i + 2] = tint.b;
      }
      geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
      pieces.push(geometry);
   });
   const merged = mergeGeometries(pieces);
   for (const piece of pieces) piece.dispose();
   if (!merged) throw new Error("food-catcher kitchen decor: pieces did not merge");
   return merged;
}

/** A pot on the shelf: a body, a rolled rim, and its handles or lid, standing on the plank. */
function addPot(
   add: AddPiece,
   x: number,
   radius: number,
   height: number,
   color: string,
   trim: string,
   kind: "saucepan" | "stockpot" | "pan"
): void {
   const z = WALL_FRONT + SHELF.depth / 2;
   const base = SHELF.top;
   add(new CylinderGeometry(radius, radius * 0.94, height, 22), color, x, base + height / 2, z);
   add(new CylinderGeometry(radius * 1.07, radius * 1.07, 0.028, 22), color, x, base + height - 0.014, z);
   if (kind === "stockpot") {
      // a low lid with a dark knob, and an ear handle on each side
      add(new CylinderGeometry(radius * 0.4, radius * 1.02, 0.06, 22), color, x, base + height + 0.03, z);
      add(new CylinderGeometry(0.03, 0.04, 0.045, 10), DECOR.knob, x, base + height + 0.08, z);
      add(new BoxGeometry(0.08, 0.035, 0.05), trim, x - radius - 0.035, base + height * 0.8, z);
      add(new BoxGeometry(0.08, 0.035, 0.05), trim, x + radius + 0.035, base + height * 0.8, z);
      return;
   }
   // one long handle under the rim, its far end tilted up, pointing away from the shelf's middle
   const side = kind === "saucepan" ? -1 : 1;
   const length = radius * 1.7;
   add(
      new BoxGeometry(length, 0.035, 0.045),
      trim,
      x + side * (radius + length / 2 - 0.02),
      base + height - 0.025,
      z,
      0,
      side * 0.18
   );
}

/** The wooden parts: the chalkboard frame, its chalk ledge with a stick of chalk, the shelf plank. */
function buildWood(): BufferGeometry {
   return mergedPieces((add) => {
      const frameW = BOARD.w + BOARD.border * 2;
      const frameH = BOARD.h + BOARD.border * 2;
      add(new BoxGeometry(frameW, frameH, 0.05), DECOR.frame, BOARD.x, BOARD.y, WALL_FRONT + 0.025);
      const ledgeY = BOARD.y - frameH / 2 - 0.02;
      add(new BoxGeometry(frameW * 0.82, 0.04, 0.1), DECOR.frame, BOARD.x, ledgeY, WALL_FRONT + 0.05);
      add(new CylinderGeometry(0.018, 0.018, 0.14, 8), DECOR.stick, BOARD.x + 0.3, ledgeY + 0.038, WALL_FRONT + 0.06, 0, Math.PI / 2);
      add(
         new BoxGeometry(SHELF.w, SHELF.thick, SHELF.depth),
         DECOR.plank,
         SHELF.x,
         SHELF.top - SHELF.thick / 2,
         WALL_FRONT + SHELF.depth / 2
      );
   });
}

/** The metal parts: the shelf's two iron brackets, a copper saucepan, a steel stock pot, a pan. */
function buildMetal(): BufferGeometry {
   return mergedPieces((add) => {
      const under = SHELF.top - SHELF.thick;
      // each bracket: an upright on the wall and a brace out to the plank's front edge
      const drop = 0.24;
      const reach = SHELF.depth - 0.06;
      const brace = Math.hypot(drop, reach);
      for (const dx of [-0.6, 0.6]) {
         add(new BoxGeometry(0.045, drop, 0.04), DECOR.iron, SHELF.x + dx, under - drop / 2, WALL_FRONT + 0.02);
         add(
            new BoxGeometry(0.045, brace, 0.035),
            DECOR.iron,
            SHELF.x + dx,
            under - drop / 2,
            WALL_FRONT + reach / 2,
            Math.atan2(reach, drop)
         );
      }
      addPot(add, SHELF.x - 0.6, 0.2, 0.25, DECOR.copper, DECOR.copperDark, "saucepan");
      addPot(add, SHELF.x, 0.26, 0.34, DECOR.steel, DECOR.steelDark, "stockpot");
      addPot(add, SHELF.x + 0.6, 0.21, 0.1, DECOR.steel, DECOR.knob, "pan");
   });
}

/**
 * The menu board and the pot shelf on the wall behind the falling food: three draw calls
 * (the slate, the wood, the metal), built once per mount and freed with it.
 */
const WallDecor = memo(function WallDecor() {
   const menu = useCanvasTexture(MENU_TEX.w, MENU_TEX.h, drawMenuBoard);
   const parts = useMemo(() => ({ wood: buildWood(), metal: buildMetal() }), []);
   useEffect(
      () => () => {
         parts.wood.dispose();
         parts.metal.dispose();
      },
      [parts]
   );
   return (
      <group name="wall-decor">
         <mesh position={[BOARD.x, BOARD.y, WALL_FRONT + 0.056]} name="menu-board">
            <planeGeometry args={[BOARD.w, BOARD.h]} />
            <meshStandardMaterial map={menu} roughness={0.95} />
         </mesh>
         <mesh geometry={parts.wood} name="decor-wood">
            <meshStandardMaterial vertexColors roughness={0.8} />
         </mesh>
         <mesh geometry={parts.metal} name="decor-metal">
            <meshStandardMaterial vertexColors roughness={0.42} metalness={0.3} />
         </mesh>
      </group>
   );
});

/**
 * The back wall reaches far above and below the play rectangle (y [-9, 16], 24 wide) and a
 * cabinet hangs under the counter, so the extra height a portrait phone shows (y -6.2 to 12.7 at 375×812)
 * and the extra width of an ultra-wide screen are kitchen, not empty background. A chalk menu board
 * and a shelf of pots hang on the wall behind the play area (WallDecor).
 */
export const Kitchen = memo(function Kitchen() {
   return (
      <group name="kitchen">
         <mesh position={[0, 3.5, -0.85]} receiveShadow={false}>
            <boxGeometry args={[24, 25, 0.18]} />
            <meshStandardMaterial color={COLORS.wall} />
         </mesh>
         <mesh position={[0, -4.8, 0.1]}>
            <boxGeometry args={[9.2, 8.5, 1.5]} />
            <meshStandardMaterial color={COLORS.cabinet} />
         </mesh>
         <WallDecor />
         <mesh position={[0, COUNTER.y, 0.15]}>
            <boxGeometry args={[9.4, COUNTER.h, 1.7]} />
            <meshStandardMaterial color={COLORS.counter} />
         </mesh>
         <mesh position={[0, WORKTOP.y, 0.15]} name="worktop">
            <boxGeometry args={[9.2, WORKTOP.h, 1.55]} />
            <meshStandardMaterial color="#e7c99a" />
         </mesh>
         <mesh position={[0, -0.02, 0.95]}>
            <boxGeometry args={[9.4, 0.1, 0.08]} />
            <meshStandardMaterial color={COLORS.counterEdge} />
         </mesh>
      </group>
   );
});

export function ChefPrimitive() {
   return (
      <group name="chef-primitive">
         <mesh position={[0, 0.62, 0]}>
            <capsuleGeometry args={[0.38, 0.55, 6, 12]} />
            <meshStandardMaterial color={COLORS.apron} />
         </mesh>
         <mesh position={[0, 0.72, 0.28]}>
            <boxGeometry args={[0.55, 0.42, 0.08]} />
            <meshStandardMaterial color={COLORS.apron} />
         </mesh>
         <mesh position={[0, 1.05, 0.22]}>
            <boxGeometry args={[0.28, 0.16, 0.08]} />
            <meshStandardMaterial color={COLORS.scarf} />
         </mesh>
         <mesh position={[0, 1.22, 0]}>
            <sphereGeometry args={[0.28, 18, 14]} />
            <meshStandardMaterial color={COLORS.skin} />
         </mesh>
         <mesh position={[-0.1, 1.28, 0.22]}>
            <sphereGeometry args={[0.045, 10, 8]} />
            <meshStandardMaterial color="#1c1917" />
         </mesh>
         <mesh position={[0.1, 1.28, 0.22]}>
            <sphereGeometry args={[0.045, 10, 8]} />
            <meshStandardMaterial color="#1c1917" />
         </mesh>
         <mesh position={[0, 1.62, 0]}>
            <cylinderGeometry args={[0.34, 0.3, 0.42, 16]} />
            <meshStandardMaterial color={COLORS.hat} />
         </mesh>
         <mesh position={[0, 1.4, 0]}>
            <cylinderGeometry args={[0.48, 0.48, 0.08, 18]} />
            <meshStandardMaterial color={COLORS.hat} />
         </mesh>
      </group>
   );
}

export function ApplePrimitive() {
   return (
      <group>
         <mesh>
            <sphereGeometry args={[0.42, 18, 14]} />
            <meshStandardMaterial color={COLORS.apple} />
         </mesh>
         <mesh position={[0.08, 0.36, 0]} rotation={[0.4, 0, 0.6]}>
            <sphereGeometry args={[0.12, 8, 6]} />
            <meshStandardMaterial color={COLORS.leaf} />
         </mesh>
      </group>
   );
}

export function BurgerPrimitive() {
   return (
      <group>
         <mesh position={[0, -0.22, 0]}>
            <sphereGeometry args={[0.38, 16, 10]} />
            <meshStandardMaterial color={COLORS.bun} />
         </mesh>
         <mesh position={[0, 0, 0]} scale={[1, 0.35, 1]}>
            <sphereGeometry args={[0.36, 16, 10]} />
            <meshStandardMaterial color={COLORS.patty} />
         </mesh>
         <mesh position={[0, 0.16, 0]} scale={[1.05, 0.22, 1.05]}>
            <sphereGeometry args={[0.34, 14, 8]} />
            <meshStandardMaterial color={COLORS.lettuce} />
         </mesh>
         <mesh position={[0, 0.28, 0]} scale={[1, 0.55, 1]}>
            <sphereGeometry args={[0.38, 16, 10]} />
            <meshStandardMaterial color={COLORS.bun} />
         </mesh>
      </group>
   );
}

export function SockPrimitive() {
   return (
      <group rotation={[0, 0, 0.4]}>
         <mesh>
            <capsuleGeometry args={[0.22, 0.42, 4, 10]} />
            <meshStandardMaterial color={COLORS.sock} />
         </mesh>
         <mesh position={[0.12, -0.16, 0.12]}>
            <sphereGeometry args={[0.12, 10, 8]} />
            <meshStandardMaterial color={COLORS.patch} />
         </mesh>
      </group>
   );
}

export function BananaPrimitive() {
   return (
      <mesh rotation={[0, 0, 0.7]}>
         <capsuleGeometry args={[0.16, 0.55, 4, 10]} />
         <meshStandardMaterial color={COLORS.banana} />
      </mesh>
   );
}

export function TinPrimitive() {
   return (
      <group>
         <mesh>
            <cylinderGeometry args={[0.28, 0.28, 0.62, 16]} />
            <meshStandardMaterial color={COLORS.tin} metalness={0.35} roughness={0.4} />
         </mesh>
         <mesh position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.29, 0.29, 0.12, 16]} />
            <meshStandardMaterial color={COLORS.tinBand} />
         </mesh>
      </group>
   );
}

/**
 * The junk tell. The camera looks straight down -z (pitch 0), so both parts are flat in the XY
 * plane facing it: a dark red disc behind the item and a bright red rim around it. Unlit and not
 * tone mapped, so the red reads the same under any light. Two opaque draw calls per junk item.
 */
export function BadRing() {
   return (
      <group name="bad-ring">
         <mesh position={[0, 0, -0.5]}>
            <circleGeometry args={[0.62, 28]} />
            <meshBasicMaterial color={COLORS.ring} toneMapped={false} />
         </mesh>
         <mesh>
            <ringGeometry args={[0.52, 0.62, 28]} />
            <meshBasicMaterial color={COLORS.ringRim} toneMapped={false} />
         </mesh>
      </group>
   );
}
