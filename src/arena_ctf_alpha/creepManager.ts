/* eslint-disable prettier/prettier */
import { ATTACK, HEAL, MOVE, RANGED_ATTACK, RESOURCE_ENERGY, TOUGH, TOWER_RANGE, BodyPartConstant } from "game/constants";
import { Creep, GameObject, RoomPosition, StructureTower } from "game/prototypes";
import { getCpuTime, getDirection, getObjectsByPrototype, getRange, getTicks } from "game/utils";
import { BodyPart, Flag } from "arena";
import { Visual } from "game/visual";
import { FindPathResult, searchPath } from "game/path-finder";
import { isFirstTick } from "common/index";
import { HealLine, AttackLine, MassAttackSquare, displayHits } from "common/visualUtls";
import { colors } from "common/constants";
import { executeTowers } from "./towerManager";
import { GameState } from "./models";
import { GetRange } from "common/util";
import { createPrivateKey } from "crypto";
import { parentPort } from "worker_threads";

export enum CreepRoles {
  HEALER,
  ROAMER,
  DEFENDER,
  RANGED_ATTACKER
}

Creep.prototype.HasActivePart = function(type: BodyPartConstant) {
  for (const part of this.body) {
      if (part.hits > 0 && part.type === type) return true
  }

  return false
}

Creep.prototype.GetActiveParts = function(type: BodyPartConstant): BodyPartConstant[] {
  return this.body.filter(x => x.hits > 0 && x.type === type).map(x => x.type);
}

Creep.prototype.GetPath = function(goal: RoomPosition, range: number | undefined, runAway: boolean | undefined) {
  const result = searchPath(this, goal, {
    costMatrix: global.GameManager.PathingCostMatrix,
    range,
    flee: runAway
  });

  new Visual().poly(result.path, { opacity: 0.2, stroke: colors.purple });
  if(runAway) new Visual().text("F", this, { font: 0.5 });

  return result;
}

export function executeCreeps() {
  global.myCreeps
    .filter(x => {
      return x.exists;
    })
    .forEach(creep => {
      switch (creep.role) {
        case CreepRoles.ROAMER:
          roamerTick(creep);
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
    if (creep.body.some(i => i.type === ATTACK)) {
      if (!myAttacker) {
        myAttacker = creep;
        creep.role = CreepRoles.ROAMER;
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



function roamerTick(creep: Creep) {
  // this should do all the movement of the creep

  if (CanMove(creep)) {
    switch (global.currentState) {
      case GameState.Attack:
        // attack the enemy flag
        creep.moveTo(creep.GetPath(global.enemyFlag).path[0]);
        break;
      case GameState.Defend:
        // go and defend the flag, engadge with the enemy if they are between us and our flag
        creep.moveTo(creep.GetPath(creep.defensivePos.Position).path[0]);
        // if close to flag and enemy is close and this is at full health then move toward closest enemy
        break;
      case GameState.PrepAttack:
      case GameState.Gather:
        roamerGather(creep);
        break;
      // case GameState.PrepAttack:
      // bring all creeps close together before going in for all out attack
      //  creep.moveTo(creep.GetPath(global.myCreeps.filter(x => x.role === CreepRoles.DEFENDER)[0]).path[0]);
      //  break;
      default:
        console.log("This gamestate not supported: ", global.currentState);
    }
  }

  attackWeakestEnemy(creep);
}

function CanMove(creep: Creep) : boolean {
  return creep.fatigue === 0 && creep.HasActivePart(MOVE);
}

function roamerGather(creep: Creep) {
  let pathResult: FindPathResult;
  let foundPart = false;
  const rangeToFlag = GetRange(creep, global.myFlag);
  const enemiesCloserToFlag = global.enemyCreeps.filter(x => rangeToFlag + 10 > GetRange(x, global.myFlag));

  const enemiesClose = global.enemyCreeps
        .filter(i => getRange(i, creep) < 4)
        .sort((a, b) => a.hits - b.hits);

  if (enemiesCloserToFlag[0]) {
    creep.moveTo(creep.GetPath(global.myFlag).path[0]);
  } else {
    global.attackerParts.sort((a, b) => {
      return creep.getRangeTo(a) - creep.getRangeTo(b);
    });

    // if upgrade is available then check if it can get there before the upgrade fully decays
    for (const part of global.attackerParts) {
      pathResult = creep.GetPath(part);
      const moveValue = global.GameManager.GetPathMovementValue(pathResult.path);
      if (moveValue < part.ticksToDecay) {
        console.log("Roamer going after bodypart: ", global.attackerParts[0]);
        creep.moveTo(pathResult.path[0]);
        foundPart = true;
        break;
      }
    }

    // if no upgrades are available then position itself near the middle of the map
    if (!foundPart) {
      const locationRangeBuffer = 5;
      creep.moveTo(creep.GetPath(global.partStagingLocation, locationRangeBuffer).path[0]);
    }
  }

  // safely try to pick up upgrades
  // will run from combat
  if (enemiesClose[0]) {
    // may need to get smarter and look at ranged attack enemies, vs attack enemies, vs heal
    // need a better flee, it should try to move toward a 'safe place' while being away from the bad guy, and try to avoid swamps
    // for now just run to flag
    // creep.moveTo(creep.GetPath(enemiesClose[0], undefined, true).path[0]);
    creep.moveTo(creep.GetPath(global.myFlag).path[0]);
  }
}

function attackWeakestEnemy(creep: Creep) {
  const closeEnemies = global.enemyCreeps.filter(x => getRange(creep, x) < 4);

  if (!closeEnemies) return;

  if (creep.HasActivePart(ATTACK)) {
    const meleeRangeEnemies = closeEnemies
      .filter(x => getRange(creep, x) < 2)
      .sort((x, y) => x.hits - y.hits);

    if (meleeRangeEnemies[0]) {
      creep.attack(meleeRangeEnemies[0]);
      AttackLine(creep, meleeRangeEnemies[0]);
      return;
    }
  }

  if (creep.HasActivePart(RANGED_ATTACK)) {
    if (closeEnemies.length === 1) {
      creep.rangedAttack(closeEnemies[0])
      AttackLine(creep, closeEnemies[0]);
      return;
    }

    creep.rangedMassAttack();
    MassAttackSquare(creep);
  }
}

function meleeDefender(creep: Creep) {

  if (CanMove(creep)) {
    creep.moveTo(creep.GetPath(creep.defensivePos.Position).path[0]);

  /*
  // this should do all the movement of the creep
  switch(global.currentState) {
    case GameState.Attack:
      // attack the enemy flag
      creep.moveTo(creep.GetPath(global.enemyFlag).path[0]);
      break;
     case GameState.PrepAttack:
      creep.moveTo(creep.GetPath(global.myCreeps.filter(x => x.role === CreepRoles.ROAMER)[0]).path[0]);
      break;
    case GameState.PrepAttack:
    case GameState.Defend:
    case GameState.Gather:
      // go and defend the flag, engadge with the enemy if they are between us and our flag
      creep.moveTo(creep.GetPath(creep.defensivePos.Position).path[0]);
      // if close to flag and enemy is close and this is at full health then move toward closest enemy
      break;
    default:
      console.log("This gamestate not supported: ", global.currentState)
  }*/
  }

  attackWeakestEnemy(creep);
}

function rangedAttacker(creep: Creep) {
  if (CanMove(creep)) {
    if (creep.follow && !creep.follow.exists) {
      creep.follow = undefined;
    }

    if (!creep.follow) {
      creep.moveTo(creep.GetPath(creep.defensivePos.Position).path[0]);
    } else {
      creep.moveTo(creep.GetPath(creep.follow).path[0]);
      creep.follow.pull(creep);
    }

    if (GetRange(creep, global.enemyFlag) < 25) {
      creep.moveTo(creep.GetPath(global.enemyFlag).path[0]);
    }

    switch(global.currentState) {
      case GameState.Attack:
        // attack the enemy flag
        // creep.moveTo(creep.GetPath(global.enemyFlag).path[0]);
        break;
      case GameState.Defend:
        creep.moveTo(creep.GetPath(creep.defensivePos.Position).path[0]);
        break;
      case GameState.Gather:
      case GameState.PrepAttack:
        break;
      default:
        console.log("This gamestate not supported: ", global.currentState)
    }
  }

  attackWeakestEnemy(creep);
}

function healer(creep: Creep) {
  if (creep.follow && !creep.follow.exists) {
    creep.follow = undefined;
  }

  if (CanMove(creep)) {
    if (!creep.follow) {
      creep.moveTo(creep.GetPath(creep.defensivePos.Position).path[0]);
    } else {
      creep.moveTo(creep.GetPath(creep.follow).path[0]);
      creep.follow.pull(creep);
    }

    if (GetRange(creep, global.enemyFlag) < 25) {
      creep.moveTo(creep.GetPath(global.enemyFlag).path[0]);
    }

    switch(global.currentState) {
      case GameState.Attack:
        // attack the enemy flag
        // creep.moveTo(creep.GetPath(global.enemyFlag).path[0]);
        break;
      case GameState.Defend:
        creep.moveTo(creep.GetPath(creep.defensivePos.Position).path[0]);
        break;
      case GameState.Gather:
      case GameState.PrepAttack:
        break;
      default:
        console.log("This gamestate not supported: ", global.currentState)
    }
  }

  let targetsInHealRange: Creep[];
  for(let i = 1; i < 4; i++) {
    targetsInHealRange = global.myCreeps
      .filter(x => x.hits < x.hitsMax && GetRange(creep, x) <= i)
      .sort((a, b) => a.hits - b.hits);

    if (targetsInHealRange.length > 0) {
      if (i === 1) {
        creep.heal(targetsInHealRange[0]);
      } else {
        creep.rangedHeal(targetsInHealRange[0]);
      }

      HealLine(creep, targetsInHealRange[0]);
    }
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
