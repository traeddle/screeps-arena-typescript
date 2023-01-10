import { Creep, GameObject, Structure } from "game/prototypes";
import { Visual } from "game/visual";

/** Display the hits remaining */
export function displayHits(obj: Creep | Structure) {
  new Visual().text(
    obj.hits.toString(),
    { x: obj.x, y: obj.y - 0.5 },
    {
      font: "0.5",
      opacity: 0.7,
      backgroundColor: "#808080",
      backgroundPadding: 0.03
    }
  );
}

/** Draw a line from obj1 to obj2 */
export function HealLine(obj1: GameObject, obj2: GameObject) {
  new Visual().line(obj1, obj2, {
    color: "#29ed47",
    opacity: 0.5,
    width: 0.1,
    lineStyle: undefined
  });
}

/** Draw a line from obj1 to obj2 */
export function AttackLine(obj1: GameObject, obj2: GameObject) {
  new Visual().line(obj1, obj2, {
    color: "#ff0000",
    opacity: 0.5,
    width: 0.1,
    lineStyle: undefined
  });
}

export function MassAttackCircle(obj1: GameObject) {
  new Visual().circle(obj1, {
    radius: 3,
    stroke: "#ff0000",
    fill: "#cc0000",
    opacity: 0.25,
    lineStyle: undefined
  });
}

export function MassAttackSquare(obj1: GameObject) {
  const attackRange = 3;
  new Visual().rect({ x: obj1.x - attackRange, y: obj1.y - attackRange }, attackRange * 2 + 1, attackRange * 2 + 1, {
    fill: "#cc0000",
    stroke: "#ff0000",
    opacity: 0.2
  });
}
