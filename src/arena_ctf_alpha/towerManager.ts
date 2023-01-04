/* eslint-disable prettier/prettier */
import { RESOURCE_ENERGY, TOWER_RANGE, TOWER_FALLOFF_RANGE, TOWER_CAPACITY } from "game/constants";

export function executeTowers() {
    global.myTowers.forEach(tower => {
        // find enemy creep closest to flag, attack that creep if its in range of the tower
        const targetCreep = global.enemyCreeps[0];
        const towerEnergy = tower.store.getUsedCapacity(RESOURCE_ENERGY) as number;

        if ( targetCreep
            && tower.cooldown === 0
            && towerEnergy >= 10
            && (tower.getRangeTo(targetCreep) < TOWER_FALLOFF_RANGE
              || (tower.getRangeTo(targetCreep) < TOWER_RANGE && towerEnergy === TOWER_CAPACITY)
              ))
        {
          const attackResult = tower.attack(targetCreep);
          console.log("Tower attack result: ", attackResult);
        }
      });

}
