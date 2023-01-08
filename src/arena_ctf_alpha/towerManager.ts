/* eslint-disable prettier/prettier */
import { RESOURCE_ENERGY, TOWER_CAPACITY, TOWER_FALLOFF_RANGE, TOWER_RANGE } from "game/constants";
import { getCpuTime, getDirection, getObjectsByPrototype, getRange, getTicks } from "game/utils";
import { Creep } from "game/prototypes";
import { GetRange } from "common/util";

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
        } else {
          // find creeps to heal
          const myCreepsInRange =  global.myCreeps
            .filter(x => x.hits < x.hitsMax)
            .filter(i => getRange(i, tower) < 50)
            .sort((a, b) => getRange(a, tower) - getRange(b, tower));

            if(myCreepsInRange[0])
              tower.heal(myCreepsInRange[0]);
        }

      });

}

function CalcSimulatedTowerDamageDealt(distanceModifier: number)
{
    let damage = 0;
    // BeginTimer('CalcSimulatedTowerDamageDealt');  // todo: like the idea of having a way to check performance

    // The tower will fire on the closest enemy if it feels like it
    for (const tower of global.myTowers)
    {
        let towerDamage = 0;

        const energy = tower.store[RESOURCE_ENERGY];
        if (tower.cooldown > 1 || energy < 9)
            continue;

        for (const enemy of global.enemyCreeps)
        {
            const distance = GetRange(enemy, tower);

            const extraDamage = CalcTowerDamage(distance);

            if (extraDamage > towerDamage)
                towerDamage = extraDamage;
        }

        damage += towerDamage;
    }
    // EndTimer('CalcSimulatedTowerDamageDealt');

    return damage;
}

export function CalcTowerDamage(distance: number)
{
    if (distance >= 51)
        return 0;

    if (distance <= 5)
        return 150;

    if (distance >= 20)
        return 37;

    return Math.floor(150 - (distance - 5) * 7.5);
}

