Creep.prototype.advancedHeal = function() {

    const creep = this

    // If the creep is below max hits

    if (creep.hits < creep.hitsMax) {

        // Heal the creep

        creep.heal(creep)
        return
    }

    const nearbyMyCreeps = global.creepsOfRole.rangedAttacker.filter(nearbyCreep => nearbyCreep.my && getRange(creep, nearbyCreep) <= 3)

    for (const nearbyCreep of nearbyMyCreeps) {

        // If the nearbyCreep is not below max hits

        if (nearbyCreep.hits == nearbyCreep.hitsMax) continue

        // If range 1 heal didn't work, try range 3 heal. Stop

        if (creep.heal(nearbyCreep) != OK) creep.rangedHeal(nearbyCreep)
        return
    }

    // Otherwise pre-heal itself

    creep.heal(creep)
}

