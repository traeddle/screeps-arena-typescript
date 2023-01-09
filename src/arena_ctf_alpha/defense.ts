// setup defencive positions to buckle down against attack
//

import { ATTACK, BodyPartConstant, HEAL, RANGED_ATTACK } from "game/constants";
import { Creep, RoomPosition } from "game/prototypes";

export interface Defense {
  Points: DefensePosition[];
}

export interface DefensePosition {
  RequestedType: BodyPartConstant;
  Position: RoomPosition;
  Defender?: Creep;
}

/*

 M H H R
 M H H T
 H H R R
 R T R R

*/

export const defense1: Defense = {
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
