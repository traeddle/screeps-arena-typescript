// This stuff is arena-specific
import { ATTACK, HEAL, MOVE, RANGED_ATTACK, TOUGH, TOWER_RANGE } from "game/constants";
import { Creep, GameObject, StructureTower } from "game/prototypes";
import { getDirection, getObjectsByPrototype, getRange, getTicks } from "game/utils";
import { BodyPart, Flag } from "arena";
import { Visual } from "game/visual";
import { searchPath } from "game/path-finder";
import { isFirstTick } from "common";
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
// git config --global user.email "traeddle@outlook.com"
//  git config --global user.name "Travis"

// We can define global objects that will be valid for the entire match.
// The game guarantees there will be no global reset during the match.
// Note that you cannot assign any game objects here, since they are populated on the first tick, not when the script is initialized.
let myCreeps: Creep[];
let enemyCreeps: Creep[];
let myTowers: StructureTower[];
let myFlag: Flag;
let enemyFlag: Flag;
let bodyParts: BodyPart[];
let attackerParts: BodyPart[];

// This is the only exported function from the main module. It is called every tick.
export function loop(): void {
  if (isFirstTick()) {
    myCreeps = getObjectsByPrototype(Creep).filter(i => i.my);
    enemyCreeps = getObjectsByPrototype(Creep).filter(i => !i.my);

    myFlag = getObjectsByPrototype(Flag).find(i => i.my) as Flag;
    enemyFlag = getObjectsByPrototype(Flag).find(i => !i.my) as Flag;

    myTowers = getObjectsByPrototype(StructureTower).filter(i => i.my);

    initCreeps();
  }

  // remove the dead
  myCreeps = myCreeps.filter(x => x.exists);
  enemyCreeps = enemyCreeps.filter(x => x.exists);

  bodyParts = getObjectsByPrototype(BodyPart);
  attackerParts = bodyParts.filter(x => x.type === ATTACK || x.type === MOVE || x.type === TOUGH);

  enemyCreeps.sort((creep1, creep2) => {
    const range1 = creep1.getRangeTo(myFlag);
    const range2 = creep2.getRangeTo(myFlag);

    return range1 - range2;
  });

  // Notice how getTime is a global function, but not Game.time anymore
  if (getTicks() % 10 === 0) {
    console.log(`I have ${myCreeps.length} creeps`);
    console.log(`They have ${enemyCreeps.length} creeps`);
    console.log("Closest enemy:", enemyCreeps[0]);
  }

  // Run all my creeps according to their bodies
  executeCreeps();

  myTowers.forEach(tower => {
    // find enemy creep closest to flag, attack that creep if its in range of the tower
    // what is the tower range?
    // var blah =TOWER_RANGE;
    const targetCreep = enemyCreeps[0];
    if (tower.getRangeTo(targetCreep) < 25) {
      const attackResult = tower.attack(targetCreep);
      console.log("Tower attack result: ", attackResult);
    }
  });
}

function executeCreeps() {
  myCreeps
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

  myCreeps.forEach(creep => {
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

  const rangedAttackers = myCreeps.filter(x => x.role === CreepRoles.RANGED_ATTACKER);
  rangedAttackers.forEach(creep => (creep.follow = myDefender));

  const healers = myCreeps.filter(x => x.role === CreepRoles.HEALER);
  healers.forEach(creep => (creep.follow = myDefender));

  for (let i = 0; i < 3; ++i) {
    rangedAttackers[i].follow = myAttacker;
    healers[i].follow = myAttacker;
  }
}

function meleeAttacker(creep: Creep) {
  displayHits(creep);

  if (getTicks() > 1500) {
    creep.moveTo(enemyFlag);
    return;
  }

  let targets = enemyCreeps.filter(i => getRange(i, creep) < 5).sort((a, b) => getRange(a, creep) - getRange(b, creep));

  if (targets.length > 0) {
    creep.moveTo(targets[0]);
    creep.attack(targets[0]);
  } else if (enemyCreeps[0].getRangeTo(myFlag) < 75) {
    creep.moveTo(myFlag);
  } else if (attackerParts.length > 0) {
    // go after the body parts
    attackerParts.sort((a, b) => {
      return creep.getRangeTo(a) - creep.getRangeTo(b);
    });

    creep.moveTo(attackerParts[0]);
    console.log("Attacker going after bodypart: ", attackerParts[0]);
  } else {
    targets = enemyCreeps
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
    creep.moveTo(enemyFlag);
    return;
  }

  if (creep.getRangeTo(myFlag) > 0) {
    creep.moveTo(myFlag);
    return;
  }

  const targets = enemyCreeps
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
  const enemiesInRange = enemyCreeps.filter(i => getRange(i, creep) < range).sort((a, b) => a.hits - b.hits);
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

  const healTargets = myCreeps
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
  const enemiesInRange = enemyCreeps.filter(i => getRange(i, creep) < range);
  if (enemiesInRange.length > 0) {
    flee(creep, enemiesInRange, range);
  }

  if (enemyFlag) {
    creep.moveTo(enemyFlag);
  }
}

function flee(creep: Creep, targets: GameObject[], range: number) {
  const result = searchPath(
    creep,
    targets.map(i => ({ pos: i, range })),
    { flee: true }
  );
  if (result.path.length > 0) {
    const direction = getDirection(result.path[0].x - creep.x, result.path[0].y - creep.y);
    creep.move(direction);
  }
}
