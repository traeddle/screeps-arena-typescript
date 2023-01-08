import { RoomPosition } from "game/prototypes";

// todo: use this insted of getRangeTo for a perf improvement
export function GetRange(pos1: RoomPosition, pos2: RoomPosition) {
  const xDis = Math.abs(pos1.x - pos2.x);
  const yDis = Math.abs(pos1.y - pos2.y);

  if (xDis > yDis) return xDis;

  return yDis;
}

/**
 * Takes a rectange and returns the positions inside of it in an array
 */
export function findPositionsInsideRect(x1: number, y1: number, x2: number, y2: number) {
  const positions: RoomPosition[] = [];

  for (let x = x1; x <= x2; x++) {
    for (let y = y1; y <= y2; y++) {
      positions.push({ x, y });
    }
  }

  return positions;
}
