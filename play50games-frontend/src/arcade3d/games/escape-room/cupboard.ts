// Open cupboard: five walls, a shelf, door and brass handle. The roof hides once it starts
// opening, so a camera looking down the roofless room hits the loot instead of a solid box.
// The door swings outward (toward the room).
// Geometries and materials here are this shell's; dispose() frees them.
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, type BufferGeometry, type Material } from "three";
import { COLORS } from "./looks";

const HALF_X = 0.55;
const HALF_Z = 0.625;
const HEIGHT = 1.3;
const THICK = 0.07;
/** Loot group inside the station, sitting above the shelf. */
export const LOOT_AT: [number, number, number] = [0, 0.72, 0];
const OPEN_Y = 1.3;

export interface CupboardShell {
   root: Group;
   hinge: Group;
   roof: Mesh;
   dispose: () => void;
}

function panel(w: number, h: number, d: number, x: number, y: number, z: number, name: string): Mesh {
   const geo = new BoxGeometry(w, h, d);
   const color = name === "cupboard-door"
      ? COLORS.cupboardDoor
      : name === "cupboard-shelf" || name === "cupboard-inner"
         ? COLORS.cupboardInner
         : COLORS.cupboardBody;
   const mat = new MeshStandardMaterial({ color, roughness: 0.65 });
   const mesh = new Mesh(geo, mat);
   mesh.position.set(x, y, z);
   mesh.name = name;
   return mesh;
}

/** `toward` +1 opens toward +x (a station on the left). */
export function createCupboardShell(toward: 1 | -1): CupboardShell {
   const root = new Group();
   root.name = "cupboard";
   const owned: Array<BufferGeometry | Material> = [];
   const add = (mesh: Mesh, parent: Group) => {
      owned.push(mesh.geometry, mesh.material as Material);
      parent.add(mesh);
      return mesh;
   };
   const innerX = HALF_X * 2 - THICK;
   const innerZ = HALF_Z * 2 - THICK * 2;
   add(panel(THICK, HEIGHT, HALF_Z * 2, -toward * (HALF_X - THICK / 2), HEIGHT / 2, 0, "cupboard"), root);
   add(panel(innerX, HEIGHT, THICK, -toward * (THICK / 2), HEIGHT / 2, HALF_Z - THICK / 2, "cupboard-inner"), root);
   add(panel(innerX, HEIGHT, THICK, -toward * (THICK / 2), HEIGHT / 2, -(HALF_Z - THICK / 2), "cupboard-inner"), root);
   add(panel(innerX, THICK, innerZ, 0, THICK / 2, 0, "cupboard"), root);
   add(panel(innerX - 0.06, 0.05, innerZ - 0.06, 0, 0.58, 0, "cupboard-shelf"), root);
   const roof = add(panel(innerX, THICK, innerZ, 0, HEIGHT - THICK / 2, 0, "cupboard-roof"), root);

   const hinge = new Group();
   hinge.name = "cupboard-hinge";
   hinge.position.set(toward * (HALF_X + 0.01), 0.68, -(HALF_Z - THICK));
   const doorSpan = HALF_Z * 2 - THICK * 2;
   add(panel(0.06, 1.15, doorSpan, 0, 0, doorSpan / 2, "cupboard-door"), hinge);

   // Deliberate bevelled brass door pull handle on the cupboard door
   const handleGeo = new BoxGeometry(0.04, 0.16, 0.04);
   const handleMat = new MeshStandardMaterial({ color: COLORS.cupboardHandle, metalness: 0.6, roughness: 0.35 });
   const handle = new Mesh(handleGeo, handleMat);
   handle.position.set(0.04, 0, doorSpan * 0.8);
   handle.name = "cupboard-handle";
   add(handle, hinge);

   return {
      root,
      hinge,
      roof,
      dispose: () => {
         for (const item of owned) item.dispose();
      },
   };
}

/**
 * Door angle and roof for an open amount 0..1. The leaf swings outward. The roof is taken out of
 * the graph while open: this three.js raycaster still hits `visible = false` meshes, and the
 * camera looks down through the roof.
 */
export function poseCupboard(hinge: Group, roof: Mesh, toward: 1 | -1, open: number): void {
   hinge.rotation.y = toward * OPEN_Y * open;
   const shell = hinge.parent;
   if (open < 0.001) {
      if (shell && roof.parent !== shell) shell.add(roof);
   } else if (roof.parent) roof.removeFromParent();
}
