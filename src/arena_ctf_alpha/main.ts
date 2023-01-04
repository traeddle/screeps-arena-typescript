/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/prefer-namespace-keyword */
/* eslint-disable prettier/prettier */
// This stuff is arena-specific
import { ATTACK, HEAL, MOVE, RANGED_ATTACK, RESOURCE_ENERGY, TOUGH, TOWER_RANGE } from "game/constants";
import { Creep, GameObject, StructureTower } from "game/prototypes";
import { getCpuTime, getDirection, getObjectsByPrototype, getRange, getTicks } from "game/utils";
import { BodyPart, Flag } from "arena";
import { Visual } from "game/visual";
import { searchPath } from "game/path-finder";
import { isFirstTick } from "common/index";
import { HealLine, displayHits } from "common/visualUtls";
import { executeTowers } from  "./towerManager";
import { initCreeps, executeCreeps, CreepRoles } from "./creepManager";
import { GameState, execute } from "./gameManager";



declare module "game/prototypes" {
  interface Creep {
    initialPos: RoomPosition;
    role: CreepRoles;
    follow: Creep | undefined;
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
        currentState: GameState
        myCreeps: Creep[]
        enemyCreeps: Creep[]
        myTowers: StructureTower[]
        myFlag: Flag
        enemyFlag: Flag
        bodyParts: BodyPart[]
        attackerParts: BodyPart[]
      }
  }
}

// This is the only exported function from the main module. It is called every tick.
export function loop(): void {
  if (isFirstTick()) {
    global.myCreeps = getObjectsByPrototype(Creep).filter(i => i.my);
    global.enemyCreeps = getObjectsByPrototype(Creep).filter(i => !i.my);

    global.myFlag = getObjectsByPrototype(Flag).find(i => i.my) as Flag;
    global.enemyFlag = getObjectsByPrototype(Flag).find(i => !i.my) as Flag;

    global.myTowers = getObjectsByPrototype(StructureTower).filter(i => i.my);

    initCreeps();
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


  if (getTicks() % 10 === 0) {
    console.log(`Game State: ${global.currentState}`);
    console.log(`I have ${global.myCreeps.length} creeps`);
    console.log(`They have ${global.enemyCreeps.length} creeps`);
    if (global.enemyCreeps[0]) {
      console.log("Closest enemy:", global.enemyCreeps[0].id);
    }
  }

  execute();

  executeTowers();

  // Run all my creeps according to their bodies
  executeCreeps();

  console.log('CPU: ' + ((getCpuTime() / 1000000).toFixed(2)).toString() + ' / 50' )
}


