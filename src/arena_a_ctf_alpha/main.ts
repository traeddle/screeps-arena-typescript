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
import { isFirstTick } from "common";
import { executeTowers } from  "./towerManager";
// import { CreepRoles } from "a_common";

export enum CreepRoles {
  HEALER,
  ATTACKER,
  DEFENDER,
  RANGED_ATTACKER
}

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

  // Notice how getTime is a global function, but not Game.time anymore
  if (getTicks() % 10 === 0) {
    console.log(`I have ${global.myCreeps.length} creeps`);
    console.log(`They have ${global.enemyCreeps.length} creeps`);
    console.log("Closest enemy:", global.enemyCreeps[0].id);
  }

  executeTowers();

  // Run all my creeps according to their bodies
  executeCreeps();

  console.log('CPU: ' + ((getCpuTime() / 1000000).toFixed(2)).toString() + ' / 50' )
}

function executeCreeps() {
  global.myCreeps
    .filter(x => {
      return x.exists;
    })
    .forEach(creep => {
      switch (creep.role) {
        case CreepRoles.ATTACKER:
          meleeAttacker(creep);
          break;
        case CreepRoles.DEFENDER:
          meleeDefender(creep);
          break;
        case CreepRoles.HEALER:
          healer(creep);
          break;
        case CreepRoles.RANGED_ATTACKER:
          rangedAttacker(creep);
          break;
        default:
          console.error("this creep has an unsported or unidentified role: ", creep);
      }
    });
}

function initCreeps() {
  let myAttacker: Creep | undefined;
  let myDefender: Creep;

  global.myCreeps.forEach(creep => {
    creep.initialPos = { x: creep.x, y: creep.y };
    if (creep.body.some(i => i.type === ATTACK)) {
      if (!myAttacker) {
        myAttacker = creep;
        creep.role = CreepRoles.ATTACKER;
        creep.initialPos = { x: 50, y: 50 };
      } else {
        creep.role = CreepRoles.DEFENDER;
        myDefender = creep;
      }
    }
    if (creep.body.some(i => i.type === RANGED_ATTACK)) {
      creep.role = CreepRoles.RANGED_ATTACKER;
    }
    if (creep.body.some(i => i.type === HEAL)) {
      creep.role = CreepRoles.HEALER;
    }
  });

  const rangedAttackers = global.myCreeps.filter(x => x.role === CreepRoles.RANGED_ATTACKER);
  rangedAttackers.forEach(creep => (creep.follow = myDefender));

  const healers = global.myCreeps.filter(x => x.role === CreepRoles.HEALER);
  healers.forEach(creep => (creep.follow = myDefender));

  for (let i = 0; i < 3; ++i) {
    rangedAttackers[i].follow = myAttacker;
    healers[i].follow = myAttacker;
  }
}

function meleeAttacker(creep: Creep) {
  displayHits(creep);

  if (getTicks() > 1500) {
    creep.moveTo(global.enemyFlag);
    return;
  }

  let targets = global.enemyCreeps.filter(i => getRange(i, creep) < 5).sort((a, b) => getRange(a, creep) - getRange(b, creep));

  if (targets.length > 0) {
    creep.moveTo(targets[0]);
    creep.attack(targets[0]);
  } else if (global.enemyCreeps[0].getRangeTo(global.myFlag) < 75) {
    creep.moveTo(global.myFlag);
  } else if (global.attackerParts.length > 0) {
    // go after the body parts
    global.attackerParts.sort((a, b) => {
      return creep.getRangeTo(a) - creep.getRangeTo(b);
    });

    creep.moveTo(global.attackerParts[0]);
    console.log("Attacker going after bodypart: ", global.attackerParts[0]);
  } else {
    targets = global.enemyCreeps
      .filter(i => getRange(i, creep.initialPos) < 10)
      .sort((a, b) => getRange(a, creep) - getRange(b, creep));

    if (targets.length > 0) {
      creep.moveTo(targets[0]);
      creep.attack(targets[0]);
    } else {
      creep.moveTo(creep.initialPos);
    }
  }
}

function meleeDefender(creep: Creep) {
  displayHits(creep);

  if (getTicks() > 1500) {
    creep.moveTo(global.enemyFlag);
    return;
  }

  if (creep.getRangeTo(global.myFlag) > 0) {
    creep.moveTo(global.myFlag);
    return;
  }

  const targets = global.enemyCreeps
    .filter(i => getRange(i, creep) < 5)
    .sort((a, b) => getRange(a, creep) - getRange(b, creep));

  if (targets.length > 0) {
    // creep.moveTo(targets[0]);
    creep.attack(targets[0]);
  }
}

function displayHits(creep: Creep) {
  new Visual().text(
    creep.hits.toString(),
    { x: creep.x, y: creep.y - 0.5 },
    {
      font: "0.5",
      opacity: 0.7,
      backgroundColor: "#808080",
      backgroundPadding: 0.03
    }
  );
}

function rangedAttacker(creep: Creep) {
  if (creep.follow && !creep.follow.exists) {
    creep.follow = undefined;
  }

  const range = 3;
  const enemiesInRange = global.enemyCreeps.filter(i => getRange(i, creep) < range).sort((a, b) => a.hits - b.hits);
  if (enemiesInRange.length > 0) {
    creep.rangedAttack(enemiesInRange[0]);
  } else if (creep.follow) {
    creep.moveTo(creep.follow);
    creep.follow.pull(creep);
  } else {
    CreepDefaultAction(creep);
  }
}

function healer(creep: Creep) {
  if (creep.follow && !creep.follow.exists) {
    creep.follow = undefined;
  }

  const healTargets = global.myCreeps
    .filter(i => i !== creep && i.hits < i.hitsMax && creep.getRangeTo(i) <= 3)
    .sort((a, b) => a.hits - b.hits);

  if (healTargets.length > 0) {
    if (getRange(healTargets[0], creep) === 1) {
      creep.heal(healTargets[0]);
    } else {
      creep.rangedHeal(healTargets[0]);
    }
  } else if (creep.follow) {
    creep.moveTo(creep.follow);
    creep.follow.pull(creep);
  } else {
    CreepDefaultAction(creep);
  }
}

function CreepDefaultAction(creep: Creep) {
  const range = 7;
  const enemiesInRange = global.enemyCreeps.filter(i => getRange(i, creep) < range);
  if (enemiesInRange.length > 0) {
    flee(creep, enemiesInRange, range);
  }

  if (global.enemyFlag) {
    creep.moveTo(global.enemyFlag);
  }
}

function flee(creep: Creep, targets: GameObject[], range: number) {
  const result = searchPath(
    creep,
    targets.map(i => ({ pos: i, range })),
    { flee: true }
  );
  if (result.path.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const direction = getDirection(result.path[0].x - creep.x, result.path[0].y - creep.y);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    creep.move(direction);
  }
}
