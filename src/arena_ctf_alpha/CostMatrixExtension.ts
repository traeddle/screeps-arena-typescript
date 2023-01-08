import { Creep, GameObject, OwnedStructure, RoomPosition, Structure, StructureTower } from "game/prototypes";
import { getCpuTime, getDirection, getObjectsByPrototype, getRange, getTerrainAt, getTicks } from "game/utils";
import { BodyPart, Flag } from "arena";
import { Visual } from "game/visual";
import { GetAllRoomPositions } from "common/util";
import { CostMatrix, searchPath } from "game/path-finder";

CostMatrix.prototype.AddCost = function (pos, additionalCost) {
  const currentValue = this.get(pos.x, pos.y);
  let newCost = currentValue + additionalCost;
  if (newCost > 255) newCost = 255;

  this.set(pos.x, pos.y, newCost);
};

export function AddCost(costMatrix: CostMatrix, pos: RoomPosition, additionalCost: number) {
  const currentValue = costMatrix.get(pos.x, pos.y);
  let newCost = currentValue + additionalCost;
  if (newCost > 255) newCost = 255;

  costMatrix.set(pos.x, pos.y, newCost);
}

/*
CostMatrix.prototype.Print_old = function () {
  const roomPositions = GetAllRoomPositions();

  for (let i = 0; i < roomPositions.length; ++i) {
    if (i % 3 === 0) {
      new Visual().text(this.get(roomPositions[i].x, roomPositions[i].y).toString(), roomPositions[i], { font: 0.5 });
    }
  }
};
*/

CostMatrix.prototype.Print = function () {
  for (let x = 0; x <= 100; x++) {
    for (let y = 0; y <= 100; y++) {
      const value = this.get(x, y);
      if (value !== 1) new Visual().text(value.toString(), { x, y }, { font: 0.5 });
    }
  }
};
