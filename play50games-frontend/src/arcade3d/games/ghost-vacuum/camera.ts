import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
const portrait: FittedViewOptions = {
   area: { min: { x: -4.5, y: 0, z: -4.5 }, max: { x: 4.5, y: 1.56, z: 4.5 } },
   pitch: 62 * Math.PI / 180, yaws: [0], focus: [{ x: 0, y: 0, z: 0 }], margin: { top: 0.04, bottom: 0.04, left: 0.04, right: 0.04 }, padding: 8, shift: true, fov: 45,
};
const landscape: FittedViewOptions = { ...portrait, area: { min: { x: -5, y: 0, z: -4.5 }, max: { x: 5, y: 1.56, z: 4.5 } } };
export const viewFor = (w: number, h: number) => w < h ? portrait : landscape;
