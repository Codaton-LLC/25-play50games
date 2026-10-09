export const FOCUS = { x: 0, y: 0, z: -1.5 };
export const VIEW = {
   area: { min: { x: -5.6, y: 0, z: -7.3 }, max: { x: 5.6, y: 2.3, z: 3.5 } },
   pitch: Math.PI / 3, yaws: [0], focus: [FOCUS], margin: { top: 0.02, bottom: 0.02, left: 0.02, right: 0.02 }, padding: 8, shift: true, fov: 35,
};
export const CAMERA = { position: [0, 32, 20] as [number, number, number], lookAt: [0, 0, -1.5] as [number, number, number], fov: 35 };
