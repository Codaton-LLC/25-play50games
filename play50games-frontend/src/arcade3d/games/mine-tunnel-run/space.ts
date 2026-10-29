// Cell <-> world metres. The cross-section lies in the x/y plane facing +z (the camera's default side);
// cells are CELL deep along z, the tunnels run through the slab's middle (z = 0). Pure.
import { CELL } from "./rules";

export { CELL };
/** World x of a column's centre (the mine is centred on x = 0). */
export const cellX = (w: number, c: number) => (c - (w - 1) / 2) * CELL;
/** World y of a row's centre (row 0 = the surface row, rows go down). */
export const cellY = (r: number) => -r * CELL;
/** The floor of a cell (where a hero standing in it puts its feet). */
export const floorY = (r: number) => -r * CELL - CELL / 2;
/** The rows the camera can see around a row (the slab is only drawn there). */
export const VIEW_ROWS = 13;
