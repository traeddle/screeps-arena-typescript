// setup defencive positions to buckle down against attack
//

import { ATTACK, BodyPartConstant, HEAL, RANGED_ATTACK } from "game/constants";
import { Creep, RoomPosition } from "game/prototypes";
import { CreepRoles } from "./creepManager";

export interface Defense {
  Points: DefensePosition[];
}

export interface DefensePosition {
  RequestedType: BodyPartConstant;
  Position: RoomPosition;
  Defender?: Creep;
}

export const compressed: Defense = {
  /*
  M H H R
  M H H T
  H H R R
  R T R R
  */
  Points: [
    { RequestedType: ATTACK, Position: { x: 1, y: 1 } },
    { RequestedType: ATTACK, Position: { x: 1, y: 2 } },
    { RequestedType: HEAL, Position: { x: 2, y: 1 } },
    { RequestedType: HEAL, Position: { x: 3, y: 1 } },
    { RequestedType: HEAL, Position: { x: 2, y: 2 } },
    { RequestedType: HEAL, Position: { x: 3, y: 2 } },
    { RequestedType: HEAL, Position: { x: 1, y: 3 } },
    { RequestedType: HEAL, Position: { x: 2, y: 3 } },
    { RequestedType: RANGED_ATTACK, Position: { x: 4, y: 1 } },
    { RequestedType: RANGED_ATTACK, Position: { x: 2, y: 3 } },
    { RequestedType: RANGED_ATTACK, Position: { x: 4, y: 3 } },
    { RequestedType: RANGED_ATTACK, Position: { x: 1, y: 4 } },
    { RequestedType: RANGED_ATTACK, Position: { x: 3, y: 4 } },
    { RequestedType: RANGED_ATTACK, Position: { x: 4, y: 4 } }
  ]
};

export const expanded: Defense = {
  /*
  O O M H O
  O O O T R
  M O H H R
  H T H H R
  O R R R O
  */
  Points: [
    { RequestedType: ATTACK, Position: { x: 3, y: 1 } },
    { RequestedType: ATTACK, Position: { x: 1, y: 3 } },
    { RequestedType: HEAL, Position: { x: 4, y: 1 } },
    { RequestedType: HEAL, Position: { x: 3, y: 3 } },
    { RequestedType: HEAL, Position: { x: 4, y: 3 } },
    { RequestedType: HEAL, Position: { x: 1, y: 4 } },
    { RequestedType: HEAL, Position: { x: 3, y: 4 } },
    { RequestedType: HEAL, Position: { x: 4, y: 4 } },
    { RequestedType: RANGED_ATTACK, Position: { x: 5, y: 2 } },
    { RequestedType: RANGED_ATTACK, Position: { x: 5, y: 3 } },
    { RequestedType: RANGED_ATTACK, Position: { x: 5, y: 4 } },
    { RequestedType: RANGED_ATTACK, Position: { x: 2, y: 5 } },
    { RequestedType: RANGED_ATTACK, Position: { x: 3, y: 5 } },
    { RequestedType: RANGED_ATTACK, Position: { x: 4, y: 5 } }
  ]
};

export const halfDefense: Defense = {
  /*
  O O O O
  O M H T
  O H H R
  O T R R
  */
  Points: [
    { RequestedType: ATTACK, Position: { x: 2, y: 2 } },
    { RequestedType: HEAL, Position: { x: 3, y: 2 } },
    { RequestedType: HEAL, Position: { x: 2, y: 3 } },
    { RequestedType: HEAL, Position: { x: 3, y: 3 } },
    { RequestedType: RANGED_ATTACK, Position: { x: 4, y: 3 } },
    { RequestedType: RANGED_ATTACK, Position: { x: 3, y: 4 } },
    { RequestedType: RANGED_ATTACK, Position: { x: 4, y: 4 } }
  ]
};

export function initDefense() {
  setDefense(halfDefense);
}

export function setDefense(newDefense: Defense) {
  global.currentDefense = newDefense;
  const adjustPositions = global.myFlag.x > 50;

  global.currentDefense.Points.forEach(defensePoint => {
    if (adjustPositions) {
      defensePoint.Position.x = 99 - defensePoint.Position.x;
      defensePoint.Position.y = 99 - defensePoint.Position.y;
    }

    const sortedCreeps = global.myCreeps.sort((a, b) => {
      const aVal = isDefenderCreep(a) ? 0 : 1;
      const bVal = isDefenderCreep(b) ? 0 : 1;
      return aVal - bVal;
    });
    defensePoint.Defender = sortedCreeps.filter(x => x.HasActivePart(defensePoint.RequestedType) && !x.defensivePos)[0];
    defensePoint.Defender.defensivePos = defensePoint;

    console.log(
      `Creep: ${defensePoint.Defender.id} assigned to defensive point (${defensePoint.Position.x}, ${defensePoint.Position.y})`
    );
  });
}

function isDefenderCreep(creep: Creep) {
  if (creep.role === CreepRoles.DEFENDER) return true;
  if (creep.role === CreepRoles.ROAMER) return false;
  if (creep.follow?.role === CreepRoles.DEFENDER) return true;
  return false;
}
