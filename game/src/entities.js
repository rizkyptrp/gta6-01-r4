// NEON DUSK — Sable City. Everything that moves: cars (player, traffic,
// police, mission cars), pedestrians, police AI and Vulture guards. Cars are
// built from boxes so they read clearly from the chase camera; traffic
// follows the road grid and stops at nothing, police ram and arrest.

import * as THREE from 'three';
import { CITY, CAR_MODELS, TUNE } from './config.js';
import { onRoad } from './world.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = rng(777001);

// A car mesh: body + cabin + wheels + headlights. Returns { group, wheels }.
export function makeCarMesh(model, { police = false, taxi = false } = {}) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: police ? 0x11131c : model.color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.85, model.len), bodyMat);
  body.position.y = 0.75; body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.7, model.len * 0.48),
    new THREE.MeshLambertMaterial({ color: 0x18202e }),
  );
  cabin.position.set(0, 1.45, -model.len * 0.06); cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0c0c10 });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.42, z * (model.len / 4.6));
    g.add(w); wheels.push(w);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const x of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.1), lightMat);
    h.position.set(x, 0.8, model.len / 2 + 0.02);
    g.add(h);
  }
  if (police) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }),
    );
    bar.position.set(0, 1.9, 0);
    bar.name = 'lightbar';
    g.add(bar);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.5, 1.8),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    door.position.set(-1.02, 0.85, 0);
    g.add(door);
  }
  if (taxi) {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.28, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xffc93e }),
    );
    sign.position.set(0, 1.95, 0);
    g.add(sign);
  }
  return { group: g, wheels };
}

// A traffic / parked car with simple state.
export function spawnCar(scene, model, x, z, heading, opts = {}) {
  const { group } = makeCarMesh(model, opts);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  scene.add(group);
  return {
    model, mesh: group, x, z, heading,
    speed: 0, kind: opts.kind || 'traffic',
    parked: !!opts.parked, police: !!opts.police,
    // traffic AI: which road axis it follows and its direction
    axis: opts.axis || 'x', dir: opts.dir || 1,
    cruise: 8 + rnd() * 6,
  };
}

// Keep a car on its road lane, looping around the city edge.
export function driveTraffic(car, dt) {
  if (car.parked) return;
  const H = CITY.HALF;
  car.speed += (car.cruise - car.speed) * dt * 0.8;
  const d = car.speed * dt * car.dir;
  if (car.axis === 'x') {
    car.x += d;
    if (car.x > H) { car.x = -H; car.z = snapLane(car.z); }
    if (car.x < -H) { car.x = H; car.z = snapLane(car.z); }
  } else {
    car.z += d;
    if (car.z > H) { car.z = -H; car.x = snapLane(car.x); }
    if (car.z < -H) { car.z = H; car.x = snapLane(car.x); }
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.axis === 'x'
    ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
    : (car.dir > 0 ? 0 : Math.PI);
}

function snapLane(v) {
  const b = CITY.BLOCK;
  const lane = Math.round(v / b) * b + (rnd() < 0.5 ? 2.2 : -2.2);
  return Math.max(-CITY.HALF + 6, Math.min(CITY.HALF - 6, lane));
}

// A pedestrian: capsule body, coloured shirt, walks the sidewalks.
export function makePed(scene, x, z) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({
    color: [0xe84a5f, 0x4a90e8, 0x7ed491, 0xf2c14e, 0xb678e8, 0xe8e8e8][Math.floor(rnd() * 6)],
  });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.1, 8), shirt);
  body.position.y = 0.95; body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xd9a986 }),
  );
  head.position.y = 1.75;
  g.add(head);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x2a2f3a }),
  );
  legs.position.y = 0.25;
  g.add(legs);
  g.position.set(x, 0, z);
  scene.add(g);
  return {
    mesh: g, x, z,
    heading: rnd() * Math.PI * 2,
    speed: 1 + rnd() * 1.2,
    panic: 0,
    // walk along a sidewalk: pick an axis and drift
    axis: rnd() < 0.5 ? 'x' : 'z',
    dir: rnd() < 0.5 ? 1 : -1,
  };
}

export function walkPed(ped, dt, playerPos) {
  const H = CITY.HALF;
  // Flee from the player when they are close and fast (or shooting).
  const dx = ped.x - playerPos.x;
  const dz = ped.z - playerPos.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 9) ped.panic = 1;
  if (ped.panic > 0) {
    ped.panic = Math.max(0, ped.panic - dt * 0.25);
    const s = 4.4 * dt;
    ped.x += (dx / (dist || 1)) * s;
    ped.z += (dz / (dist || 1)) * s;
  } else {
    const s = ped.speed * dt * ped.dir;
    if (ped.axis === 'x') {
      ped.x += s;
      if (ped.x > H - 8 || ped.x < -H + 8) ped.dir *= -1;
    } else {
      ped.z += s;
      if (ped.z > H - 8 || ped.z < -H + 8) ped.dir *= -1;
    }
    // Stay near a sidewalk edge rather than the middle of a road.
    if (onRoad(ped.x, ped.z) && rnd() < 0.02) {
      ped.axis = ped.axis === 'x' ? 'z' : 'x';
    }
  }
  ped.x = Math.max(-H + 4, Math.min(H - 4, ped.x));
  ped.z = Math.max(-H + 4, Math.min(H - 4, ped.z));
  ped.mesh.position.set(ped.x, 0, ped.z);
  const targetHeading = ped.panic > 0
    ? Math.atan2(dx, dz)
    : (ped.axis === 'x' ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ped.dir > 0 ? 0 : Math.PI));
  ped.heading += (targetHeading - ped.heading) * Math.min(1, dt * 6);
  ped.mesh.rotation.y = ped.heading;
  // Little bob while walking.
  ped.mesh.position.y = Math.abs(Math.sin(Date.now() * 0.008 + ped.x)) * 0.06;
}

// A Vulture guard: red jacket, stands at a post, shoots at the player.
export function makeGuard(scene, x, z) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 1.15, 0.45),
    new THREE.MeshLambertMaterial({ color: 0x8a1626 }),
  );
  body.position.y = 1.0; body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xd9a986 }),
  );
  head.position.y = 1.85;
  g.add(head);
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 0.7),
    new THREE.MeshLambertMaterial({ color: 0x111111 }),
  );
  gun.position.set(0.3, 1.2, 0.5);
  g.add(gun);
  g.position.set(x, 0, z);
  scene.add(g);
  return { mesh: g, x, z, hp: TUNE.guardHealth, cooldown: 0, homeX: x, homeZ: z };
}

// Police cruiser AI: chase the player, ram them, arrest on contact.
export function drivePolice(car, dt, playerPos, playerSpeed) {
  const dx = playerPos.x - car.x;
  const dz = playerPos.z - car.z;
  const dist = Math.hypot(dx, dz) || 1;
  const want = Math.atan2(dx, dz);
  let diff = want - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  const target = Math.min(30, 14 + dist * 0.35 + playerSpeed * 0.4);
  car.speed += (target - car.speed) * dt * 1.1;
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  // Flash the light bar.
  const bar = car.mesh.getObjectByName('lightbar');
  if (bar) bar.material.color.setHex(Math.floor(Date.now() / 350) % 2 ? 0xff2222 : 0x2266ff);
  return dist;
}
