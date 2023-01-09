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
import { CostMatrix, searchPath, PathStep } from "game/path-finder";
import { isFirstTick } from "common/index";
import { GetRange, findPositionsInsideRect, GetAllRoomPositions } from "common/util";
import { HealLine, displayHits } from "common/visualUtls";
import { colors } from "common/constants";
import { executeTowers } from "./towerManager";
import { CreepRoles, executeCreeps, initCreeps } from "./creepManager";
import { GameState } from "./models";
import { AddCost } from "./CostMatrixExtension";
import { defense1 } from "./defense";

declare module "game/path-finder" {
  interface CostMatrix {
    /** Adds a cost to the specified position */
    AddCost(pos: RoomPosition, addionalCost: number): void;
    Print(): void;
  }
}

export class GameManager {
  //* this is used as a starting matrix. It adds the weights of the terrain and is is only calculated in the first tick */
  private costMatrix: CostMatrix = new CostMatrix();
  //* this is used to calculate how long it will take a creep to move from one place to another, only needs to be calculated one time */
  private movementCostMatrix: CostMatrix = this.GetMovementCostMatrix();

  //* this is used to calculate a safe path, with added costs for entering near enemies and such */
  private pathingCostMatrix: CostMatrix = new CostMatrix();

  public get PathingCostMatrix(): CostMatrix {
    return this.pathingCostMatrix;
  }

  private set PathingCostMatrix(value: CostMatrix) {
    this.pathingCostMatrix = value;
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
    global.currentDefense = defense1;
    initCreeps();
    this.SetPartStagingLocation();
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
      if (
        GetRange(
          global.myCreeps.filter(x => x.role === CreepRoles.DEFENDER)[0],
          global.myCreeps.filter(x => x.role === CreepRoles.ROAMER)[0]
        ) < 3
      ) {
        this.setGameState(GameState.Attack);
      }
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
    const allRoomPositions = GetAllRoomPositions();
    allRoomPositions.forEach(pos => {
      if (GetRange(global.myFlag, pos) > GetRange(global.enemyFlag, pos)) {
        AddCost(this.costMatrix, pos, costToAdd);
      }
    });
    // this.costMatrix.Print();
  }

  private UpdatePathingCostMatrix() {
    this.PathingCostMatrix = this.costMatrix.clone();

    this.AddCostForEnemies(this.PathingCostMatrix, ATTACK, 1, 10);
    this.AddCostForEnemies(this.PathingCostMatrix, RANGED_ATTACK, 3, 10);
    // todo: add enemy towers? (include energy?)
  }

  private AddCostForEnemies(
    costMatrix: CostMatrix,
    activePart: BodyPartConstant,
    attackRange: number,
    additionalCost: number
  ) {
    const attackEnemyCreeps = global.enemyCreeps.filter(creep => creep.HasActivePart(activePart));

    let range = attackRange;

    for (const enemyCreep of attackEnemyCreeps) {
      range = enemyCreep.HasActivePart(MOVE) ? attackRange + 1 : attackRange;

      const positions = findPositionsInsideRect(
        enemyCreep.x - range,
        enemyCreep.y - range,
        enemyCreep.x + range,
        enemyCreep.y + range
      );

      for (const pos of positions) {
        AddCost(costMatrix, pos, additionalCost);
      }

      new Visual().rect(
        { x: enemyCreep.x - 0.5 - range, y: enemyCreep.y - 0.5 - range },
        range * 2 + 1,
        range * 2 + 1,
        { fill: colors.yellow, opacity: 0.2 }
      );
    }
  }

  private GetMovementCostMatrix(): CostMatrix {
    if (this.movementCostMatrix) return this.movementCostMatrix;
    const costMatrix = new CostMatrix();

    // go through the map and set the initial cost matrix
    const positions = GetAllRoomPositions();

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

      new Visual().text(value.toString(), { x: pos.x, y: pos.y }, { font: 0.5 });
      costMatrix.set(pos.x, pos.y, value);
    }

    this.movementCostMatrix = costMatrix;
    return costMatrix;
  }

  /** This uses the movementCostMatrix to figure out how many turns it will take a creep to traverse this path */
  public GetPathMovementValue(path: PathStep[]) {
    let moveValue = 0;
    path.forEach(step => {
      moveValue += this.movementCostMatrix.get(step.x, step.y);
    });

    return moveValue;
  }

  private SetPartStagingLocation() {
    let adjustment = 1;
    if (global.myFlag.x < 10) adjustment = -1;

    let currentPosition: RoomPosition = { x: 50, y: 50 };

    while (getTerrainAt(currentPosition) !== 0) {
      currentPosition = { x: currentPosition.x + adjustment, y: currentPosition.y + adjustment };
    }

    global.partStagingLocation = currentPosition;
  }
}
