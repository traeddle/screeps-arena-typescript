import { ATTACK, HEAL, MOVE, RANGED_ATTACK, RESOURCE_ENERGY, TOUGH, TOWER_RANGE } from "game/constants";
import { Creep, GameObject, StructureTower } from "game/prototypes";
import { getCpuTime, getDirection, getObjectsByPrototype, getRange, getTicks } from "game/utils";
import { BodyPart, Flag } from "arena";
import { Visual } from "game/visual";
import { searchPath } from "game/path-finder";
import { isFirstTick } from "common/index";
import { HealLine, displayHits } from "common/visualUtls";
import { executeTowers } from  "./towerManager";
import { initCreeps, executeCreeps, CreepRoles} from "./creepManager";

export enum GameState {
  Gather = "Gather",
  Defend = "Defend",
  PrepAttack = "PrepAttack",
  Attack = "Attack"
}

export function execute(){
  const currentTick = getTicks();

  if (!global.currentState) {
    setGameState(GameState.Gather);
  } else if (currentTick > 1900) {
    setGameState(GameState.Attack);
  } else if (currentTick > 1700) {
    setGameState(GameState.PrepAttack);
  }
  // todo: need to add defend, and once no threat is detected go back to gather
}

function setGameState(newState: GameState){
  if (global.currentState !== newState) {
    console.log("Setting Game State: ", newState.toString());
    global.currentState = newState;
  }
}
