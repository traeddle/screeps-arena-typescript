/* eslint-disable sort-imports */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/prefer-namespace-keyword */
/* eslint-disable prettier/prettier */
// This stuff is arena-specific
import { ATTACK, HEAL, MOVE, RANGED_ATTACK, RESOURCE_ENERGY, TOUGH, TOWER_RANGE, BodyPartConstant } from "game/constants";
import { Creep, GameObject, StructureTower, RoomPosition } from "game/prototypes";
import { getCpuTime, getDirection, getObjectsByPrototype, getRange, getTicks } from "game/utils";
import { BodyPart, Flag } from "arena";
import { Visual } from "game/visual";
import { CostMatrix, FindPathResult, searchPath } from "game/path-finder";
import { isFirstTick } from "common/index";
import { HealLine, displayHits } from "common/visualUtls";
import { executeTowers } from "./towerManager";
import { initCreeps, executeCreeps, CreepRoles } from "./creepManager";
import { GameManager } from "./gameManager";
import { GameState } from "./models";
import {} from "./CostMatrixExtension";

declare module "game/prototypes" {
  interface Creep {
    initialPos: RoomPosition;
    role: CreepRoles;
    follow: Creep | undefined;

    GetPath(goal: RoomPosition, range?: number | undefined, runAway?: boolean | undefined): FindPathResult;
    HasActivePart(type: BodyPartConstant): boolean;
  }
}

declare module "game/path-finder" {
  interface CostMatrix {

    /** Adds a cost to the specified position */
    AddCost(pos: RoomPosition, addionalCost: number): void;
    Print(): void;
  }
}

// You can also import your files like this:
// import {roleAttacker} from './roles/attacker.mjs';

// We can define global objects that will be valid for the entire match.
// The game guarantees there will be no global reset during the match.
// Note that you cannot assign any game objects here, since they are populated on the first tick, not when the script is initialized.
declare global {
  module NodeJS {
    interface Global {
      GameManager: GameManager;
      currentState: GameState;
      myCreeps: Creep[];
      enemyCreeps: Creep[];
      myTowers: StructureTower[];
      myFlag: Flag;
      enemyFlag: Flag;
      bodyParts: BodyPart[];
      attackerParts: BodyPart[];
      partStagingLocation: RoomPosition;
    }
  }
}

// This is the only exported function from the main module. It is called every tick.
export function loop(): void {
  if (isFirstTick()) {
    global.GameManager = new GameManager();
    global.GameManager.init();
    console.log("Init complete");
    console.log("CPU: " + (getCpuTime() / 1000000).toFixed(2).toString() + " / 50");
  }

  // remove the dead
  global.myCreeps = global.myCreeps.filter(x => x.exists);
  global.enemyCreeps = global.enemyCreeps.filter(x => x.exists);

  global.bodyParts = getObjectsByPrototype(BodyPart);
  global.attackerParts = global.bodyParts.filter(x => x.type === ATTACK || x.type === MOVE || x.type === TOUGH);

  global.enemyCreeps.sort((creep1, creep2) => {
    const range1 = creep1.getRangeTo(global.myFlag);
    const range2 = creep2.getRangeTo(global.myFlag);

    return range1 - range2;
  });

  global.GameManager.executeTick();

  executeTowers();

  // Run all my creeps according to their bodies
  executeCreeps();


  if (getTicks() % 10 === 0) {
    // console.log("CPU: " + (getCpuTime() / 1000000).toFixed(2).toString() + " / 50");
    console.log(`Game State: ${global.currentState}`);
    console.log(`I have ${global.myCreeps.length} creeps`);
    console.log(`They have ${global.enemyCreeps.length} creeps`);
    if (global.enemyCreeps[0]) {
      console.log("Closest enemy:", global.enemyCreeps[0].id);
    }

    // global.GameManager.PathingCostMatrix.Print();
  }

  console.log("CPU: " + (getCpuTime() / 1000000).toFixed(2).toString() + " / 50");
}
