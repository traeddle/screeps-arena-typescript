/* eslint-disable prettier/prettier */
import { ATTACK, HEAL, MOVE, RANGED_ATTACK, RESOURCE_ENERGY, TOUGH, TOWER_RANGE } from "game/constants";

export function executeTowers() {
    global.myTowers.forEach(tower => {
        // find enemy creep closest to flag, attack that creep if its in range of the tower
        // what is the tower range?
        const targetCreep = global.enemyCreeps[0];
        const towerEnergy = tower.store.getUsedCapacity(RESOURCE_ENERGY) as number;
        console.log("tower energy: ", towerEnergy);

        if ( tower.cooldown === 0
            && towerEnergy >= 10
            && (tower.getRangeTo(targetCreep) < 15
              || (tower.getRangeTo(targetCreep) < 50 && towerEnergy === 50)
              ))
        {
          const attackResult = tower.attack(targetCreep);
          console.log("Tower attack result: ", attackResult);
        }
      });

}
