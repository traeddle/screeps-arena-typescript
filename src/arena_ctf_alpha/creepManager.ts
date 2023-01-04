/* eslint-disable prettier/prettier */
import { ATTACK, HEAL, MOVE, RANGED_ATTACK, RESOURCE_ENERGY, TOUGH, TOWER_RANGE } from "game/constants";
import { Creep, GameObject, StructureTower } from "game/prototypes";
import { getCpuTime, getDirection, getObjectsByPrototype, getRange, getTicks } from "game/utils";
import { BodyPart, Flag } from "arena";
import { Visual } from "game/visual";
import { searchPath } from "game/path-finder";
import { isFirstTick } from "common/index";
import { HealLine, displayHits } from "common/visualUtls";
import { executeTowers } from "./towerManager";

export enum CreepRoles {
  HEALER,
  ATTACKER,
  DEFENDER,
  RANGED_ATTACKER
}

export function executeCreeps() {
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

export function initCreeps() {
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

  const targetRange = 5;
  let targetsInRange = global.enemyCreeps
    .filter(i => getRange(i, creep) < targetRange)
    .sort((a, b) => getRange(a, creep) - getRange(b, creep));

  if (targetsInRange.length > 0) {
    creep.moveTo(targetsInRange[0]);
    creep.attack(targetsInRange[0]);
  } else if (global.enemyCreeps[0] && global.enemyCreeps[0].getRangeTo(global.myFlag) < 75) {
    creep.moveTo(global.myFlag);
  } else if (global.attackerParts.length > 0) {
    // go after the body parts
    global.attackerParts.sort((a, b) => {
      return creep.getRangeTo(a) - creep.getRangeTo(b);
    });

    creep.moveTo(global.attackerParts[0]);
    console.log("Attacker going after bodypart: ", global.attackerParts[0]);
  } else {
    targetsInRange = global.enemyCreeps
      .filter(i => getRange(i, creep.initialPos) < 10)
      .sort((a, b) => getRange(a, creep) - getRange(b, creep));

    if (targetsInRange.length > 0) {
      creep.moveTo(targetsInRange[0]);
      creep.attack(targetsInRange[0]);
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

function rangedAttacker(creep: Creep) {
  if (creep.follow && !creep.follow.exists) {
    creep.follow = undefined;
  }

  // todo: need to figure out if doing a ranged Attack is better than a mass attack
  const range = 3;
  const closeRange = 10;
  const enemiesInRange = global.enemyCreeps.filter(i => getRange(i, creep) < range).sort((a, b) => a.hits - b.hits);
  const enemiesInCloseRange = global.enemyCreeps
    .filter(i => getRange(i, creep) < closeRange)
    .sort((a, b) => a.hits - b.hits);
  if (enemiesInRange.length === 1) {
    creep.rangedAttack(enemiesInRange[0]);
  } else if (enemiesInRange.length > 1) {
    creep.rangedMassAttack();
  } else if (enemiesInCloseRange.length > 1) {
    creep.moveTo(enemiesInCloseRange[0]);
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

  const healRange = 1;
  const rangedHealRange = 3;
  const goToHealRange = 15;

  const targetsInHealRange = global.myCreeps
    .filter(i => i.hits < i.hitsMax && creep.getRangeTo(i) <= healRange)
    .sort((a, b) => a.hits - b.hits);

  if (targetsInHealRange.length > 0) {
    creep.heal(targetsInHealRange[0]);
    return;
  }

  const targetsInRangedHealRange = global.myCreeps
    .filter(i => i.hits < i.hitsMax && creep.getRangeTo(i) <= rangedHealRange)
    .sort((a, b) => a.hits - b.hits);

  if (targetsInRangedHealRange.length > 0) {
    creep.moveTo(targetsInRangedHealRange[0]);
    creep.rangedHeal(targetsInRangedHealRange[0]);
    HealLine(creep, targetsInRangedHealRange[0]);
    return;
  }

  const targetsInGoToHealRange = global.myCreeps
    .filter(i => i.hits < i.hitsMax && creep.getRangeTo(i) <= goToHealRange)
    .sort((a, b) => a.hits - b.hits);

  if (targetsInGoToHealRange.length > 0) {
    creep.moveTo(targetsInGoToHealRange[0]);
    HealLine(creep, targetsInGoToHealRange[0]);
    return;
  }

  if (creep.follow) {
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
    console.log("Creep move to enemy flag:", creep.id);
    creep.moveTo(global.enemyFlag);
  }
}

function flee(creep: Creep, targets: GameObject[], range: number) {
  console.log("Creep fleeing: ", creep.id);

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
