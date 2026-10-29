// Rules metres -> world metres. Each room is an ASCII side view (x right, y up, 1 cell = 1 m) lying in
// the x/y plane facing +z; the rooms of a level stand side by side, ROOM_GAP apart, so every hero's
// room is drawn at once (multiplayer heroes can be in different rooms). Pure.
export const ROOM_GAP = 30;
export const DEPTH = 2.4;
/** World x of a room's left edge. */
export const roomX = (room: number) => room * ROOM_GAP;
