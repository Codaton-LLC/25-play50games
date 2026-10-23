// Heights are relative to the logical roof surface used by collisions.
export const ROOF_CAP = { centerY: 0.015, thickness: 0.04 } as const;
export const ROOFTOP_OVERLAY_Y = ROOF_CAP.centerY + ROOF_CAP.thickness / 2 + 0.025;
