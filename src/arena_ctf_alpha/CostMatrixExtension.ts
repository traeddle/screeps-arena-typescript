import { Creep, GameObject, StructureTower, OwnedStructure, Structure, RoomPosition } from "game/prototypes";
import { getCpuTime, getDirection, getObjectsByPrototype, getRange, getTerrainAt, getTicks } from "game/utils";
import { BodyPart, Flag } from "arena";
import { Visual } from "game/visual";
import { CostMatrix, searchPath } from "game/path-finder";

CostMatrix.prototype.AddCost = function (pos, additionalCost) {
  const currentValue = this.get(pos.x, pos.y);
  let newCost = currentValue + additionalCost;
  if (newCost > 255) newCost = 255;

  this.set(pos.x, pos.y, newCost);
};
