import THREE from "../init.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { surroundingsTerrainHeight, surroundingsWaterLevel } from "./surroundings-rules.js";
import { lifeAt } from "./surroundings-life.js";

// The life of the surroundings (surroundings-life.js, planSurroundingsLife)
// drawn and moved: one instanced mesh for each kind of figure, each placed
// every frame at its distance along its path (update(seconds)). In the
// layout's metres, inside the surroundings' group; nothing of it is picked.

// A box of `w` x `h` x `d` at (x, y, z), its vertices coloured.
function part(w, h, d, x, y, z, colour) {
  const geometry = new THREE.BoxGeometry(w, h, d);
  geometry.translate(x, y, z);
  const value = new THREE.Color(colour);
  const count = geometry.attributes.position.count;
  const colours = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) value.toArray(colours, index * 3);
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  return geometry;
}

// The figures, facing +Z (their way). White parts take the instance's
// colour (a coat, a car's paint), the others keep theirs.
const SHAPES = {
  person: () => mergeGeometries([part(0.46, 0.75, 0.3, 0, 1.12, 0, 0xffffff), part(0.4, 0.75, 0.26, 0, 0.38, 0, 0x5a5a5a), part(0.24, 0.26, 0.24, 0, 1.64, 0, 0xd9b49a)]),
  cart: () => mergeGeometries([
    part(1.4, 0.55, 2.4, 0, 0.95, 0, 0x7b5b3e), part(0.12, 0.9, 0.9, 0.75, 0.45, 0, 0x3a2e24), part(0.12, 0.9, 0.9, -0.75, 0.45, 0, 0x3a2e24),
    part(0.5, 0.9, 1.7, 0, 1.15, 2.2, 0x5a3e2a), part(0.3, 0.45, 0.6, 0, 1.6, 3.1, 0x5a3e2a), part(0.4, 0.8, 0.3, 0, 0.4, 2.2, 0x4a3424),
  ]),
  car: () => mergeGeometries([part(1.7, 0.75, 4, 0, 0.6, 0, 0xffffff), part(1.5, 0.55, 2, 0, 1.25, -0.2, 0x2a3036), part(1.75, 0.5, 0.5, 0, 0.35, 1.2, 0x1e1e1e), part(1.75, 0.5, 0.5, 0, 0.35, -1.3, 0x1e1e1e)]),
  rowing: () => mergeGeometries([part(1.3, 0.45, 4.2, 0, 0.1, 0, 0x6a4a32), part(0.5, 0.9, 0.4, 0, 0.7, -0.4, 0xffffff)]),
  sail: () => mergeGeometries([part(2.2, 0.8, 7.5, 0, 0.2, 0, 0x5a3e2a), part(0.15, 6.5, 0.15, 0, 3.8, 0.5, 0x4a3424), part(0.06, 4.8, 3.2, 0, 4.2, -0.6, 0xeee6d2)]),
  motor: () => mergeGeometries([part(1.9, 0.6, 5.2, 0, 0.2, 0, 0xf2f2f2), part(1.4, 0.8, 1.6, 0, 0.9, -0.6, 0x2f5f8f)]),
};

const PAINT = [0x8a2f2f, 0x2f4f7a, 0xd8d8d0, 0x3f3f3f, 0x6f8f4f, 0xc9a24a, 0x7a7a80];

export function buildSurroundingsLife(layout, plan) {
  const group = new THREE.Group();
  group.name = "surroundings-life";
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const entries = [];
  const add = (shape, list, colourOf, onWater) => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(SHAPES[shape](), material, list.length);
    mesh.name = `surroundings-life-${shape}`;
    mesh.frustumCulled = false;
    mesh.raycast = () => {};
    const colour = new THREE.Color();
    list.forEach((agent, index) => mesh.setColorAt(index, colour.set(colourOf(agent, index))));
    group.add(mesh);
    entries.push({ mesh, list, onWater });
  };
  add("person", plan.people, (agent) => agent.colour, false);
  add("cart", plan.vehicles.filter((agent) => agent.kind === "cart"), () => 0xffffff, false);
  add("car", plan.vehicles.filter((agent) => agent.kind === "car"), (_agent, index) => PAINT[index % PAINT.length], false);
  ["rowing", "sail", "motor"].forEach((kind) => add(kind, plan.boats.filter((agent) => agent.kind === kind), () => 0x8a7b62, true));

  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);
  let time = 0;
  const update = (delta = 0) => {
    time += delta;
    entries.forEach(({ mesh, list, onWater }) => {
      list.forEach((agent, index) => {
        const at = lifeAt(agent.path, agent.start + agent.speed * time, agent.loop === true);
        // To the right of the way by `side` (a pavement, a lane).
        const side = agent.side || 0;
        const x = at.x - Math.sin(at.heading) * side;
        const z = at.z + Math.cos(at.heading) * side;
        const y = onWater ? surroundingsWaterLevel(layout, x, z) : surroundingsTerrainHeight(layout, x, z);
        rotation.setFromAxisAngle(up, Math.PI / 2 - at.heading);
        mesh.setMatrixAt(index, matrix.compose(position.set(x, y, z), rotation, scale));
      });
      mesh.instanceMatrix.needsUpdate = true;
    });
  };
  update(0);
  return {
    group,
    update,
    count: plan.people.length + plan.vehicles.length + plan.boats.length,
    dispose() {
      group.traverse((object) => object.geometry?.dispose());
      material.dispose();
    },
  };
}
