import {
  ATTACK,
  BodyPartConstant,
  HEAL,
  MOVE,
  RANGED_ATTACK,
  RESOURCE_ENERGY,
  TERRAIN_SWAMP,
  TERRAIN_WALL,
  TOUGH,
  TOWER_RANGE
} from "game/constants";
import { Creep, GameObject, OwnedStructure, RoomPosition, Structure, StructureTower } from "game/prototypes";
import { getCpuTime, getDirection, getObjectsByPrototype, getRange, getTerrainAt, getTicks } from "game/utils";
import { BodyPart, Flag } from "arena";
import { Visual } from "game/visual";
import { CostMatrix, searchPath } from "game/path-finder";
import { isFirstTick } from "common/index";
import { GetRange, findPositionsInsideRect } from "common/util";
import { HealLine, displayHits } from "common/visualUtls";
import { colors } from "common/constants";
import { executeTowers } from "./towerManager";
import { CreepRoles, executeCreeps, initCreeps } from "./creepManager";
import { GameState } from "./models";

export class GameManager {
  //* this is used as a starting matrix. It adds the weights of the terrain and is is only calculated in the first tick */
  private costMatrix: CostMatrix = new CostMatrix();
  //* this is used to calculate how long it will take a creep to move from one place to another, only needs to be calculated one time */
  private movementCostMatrix: CostMatrix = new CostMatrix();

  //* this is used to calculate a safe path, with added costs for entering near enemies and such */
  private _pathingCostMatrix: CostMatrix = new CostMatrix();

  public get PathingCostMatrix(): CostMatrix {
    return this._pathingCostMatrix;
  }

  private set PathingCostMatrix(value: CostMatrix) {
    this._pathingCostMatrix = value;
  }

  /**
   * initialize the game variables, intended to be called on first tick
   */
  public init() {
    global.myCreeps = getObjectsByPrototype(Creep).filter(i => i.my);
    global.enemyCreeps = getObjectsByPrototype(Creep).filter(i => !i.my);

    global.myFlag = getObjectsByPrototype(Flag).find(i => i.my) as Flag;
    global.enemyFlag = getObjectsByPrototype(Flag).find(i => !i.my) as Flag;

    global.myTowers = getObjectsByPrototype(StructureTower).filter(i => i.my);

    initCreeps();
    this.initCostMatrix();
  }

  /**  */
  public executeTick() {
    const currentTick = getTicks();
    this.UpdatePathingCostMatrix();

    if (!global.currentState) {
      this.setGameState(GameState.Gather);
    } else if (currentTick > 1850) {
      this.setGameState(GameState.Attack);
    } else if (currentTick > 1800) {
      this.setGameState(GameState.PrepAttack);
    } else if (global.enemyCreeps[0] && global.enemyCreeps[0].getRangeTo(global.myFlag) < 40) {
      this.setGameState(GameState.Defend);
    } else {
      this.setGameState(GameState.Gather);
    }
  }

  private setGameState(newState: GameState) {
    if (global.currentState !== newState) {
      console.log("Setting Game State: ", newState.toString());
      global.currentState = newState;
    }
  }

  // todo: create a costmatrix, make all squares closer to the enemy flag cost x(1) more
  // this will allow me to create a modified matrix every turn based on where the enemy creeps are
  // attack creeps add more for 2 spaces around them, range creeps give more for 4 spaces around with possibly a falloff
  // also add for the towers
  // doing this should make my creeps avoid the enemies where possible
  private initCostMatrix() {
    this.costMatrix = this.GetMovementCostMatrix();

    // in CTF structures never leave
    for (const structure of getObjectsByPrototype(Structure)) {
      this.costMatrix.set(structure.x, structure.y, 255);
    }

    // add cost if that square is closer to their flag than ours
    const costToAdd = 1;
    const allRoomPositions = this.GetAllRoomPositions();
    allRoomPositions.forEach(pos => {
      if (GetRange(global.myFlag, pos) > GetRange(global.enemyFlag, pos)) {
        this.costMatrix.AddCost(pos, costToAdd);
      }
    });
  }

  private UpdatePathingCostMatrix() {
    this.PathingCostMatrix = this.costMatrix.clone();

    this.AddCostForEnemies(this.PathingCostMatrix, ATTACK, 1, 100);
    this.AddCostForEnemies(this.PathingCostMatrix, RANGED_ATTACK, 3, 100);
    // todo: add enemy towers? (include energy?)
  }

  private AddCostForEnemies(
    costMatrix: CostMatrix,
    activePart: BodyPartConstant,
    attackRange: number,
    additionalCost: number
  ) {
    const attackEnemyCreeps = global.enemyCreeps.filter(creep => creep.getActiveParts(activePart));

    let range = attackRange;

    for (const enemyCreep of attackEnemyCreeps) {
      range = enemyCreep.getActiveParts(MOVE) ? attackRange + 1 : attackRange;

      const positions = findPositionsInsideRect(
        enemyCreep.x - range,
        enemyCreep.y - range,
        enemyCreep.x + range,
        enemyCreep.y + range
      );

      for (const pos of positions) {
        costMatrix.AddCost(pos, additionalCost);
      }

      new Visual().rect(
        { x: enemyCreep.x - 0.5 - range, y: enemyCreep.y - 0.5 - range },
        range * 2 + 1,
        range * 2 + 1,
        { fill: colors.yellow, opacity: 0.2 }
      );
    }
  }

  private GetAllRoomPositions(): RoomPosition[] {
    return findPositionsInsideRect(0, 0, 100, 100);
  }

  private GetMovementCostMatrix(): CostMatrix {
    if (this.movementCostMatrix) return this.movementCostMatrix;
    const costMatrix = new CostMatrix();

    // go through the map and set the initial cost matrix
    const positions = this.GetAllRoomPositions();

    for (const pos of positions) {
      const terrain = getTerrainAt(pos) as number;
      let value = 10;

      switch (terrain) {
        // case TERRAIN_PLAIN:
        case 0:
          value = 1; // todo: get plain cost from variable
          break;
        case TERRAIN_SWAMP:
          value = 5;
          break;
        case TERRAIN_WALL:
          value = 255;
          break;
        default:
          console.log("Terrain not supported: ", terrain);
      }

      costMatrix.set(pos.x, pos.y, value);
    }

    this.movementCostMatrix = costMatrix;
    return costMatrix;
  }
}
