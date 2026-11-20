// NEON DUSK — Sable City. Builds the 3D city with three.js: ground, a road
// grid with avenues, district-coloured towers, palms, street lights, neon
// signs, the harbour water and the sky. All geometry is procedural boxes,
// cylinders and planes — no external assets.

import * as THREE from 'three';
import { CITY, DISTRICTS } from './config.js';

// Deterministic little RNG so the city looks the same every load.
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry(20261120);

export function districtAt(x, z) {
  const qx = x >= 0 ? 1 : -1;
  const qz = z >= 0 ? 1 : -1;
  return DISTRICTS.find((d) => d.x === qx && d.z === qz) || DISTRICTS[0];
}

// Is this point on a road (so buildings must not spawn there)?
export function onRoad(x, z) {
  const b = CITY.BLOCK;
  const mx = ((x % b) + b) % b;
  const mz = ((z % b) + b) % b;
  const rw = CITY.ROAD_W / 2;
  return mx < rw || mx > b - rw || mz < rw || mz > b - rw;
}

export function buildCity(scene) {
  const H = CITY.HALF;
  const group = new THREE.Group();
  group.name = 'city';

  // --- Sky: big gradient dome + sun + moon glow -------------------------
  const skyGeo = new THREE.SphereGeometry(900, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      top: { value: new THREE.Color(0x1b2a6b) },
      mid: { value: new THREE.Color(0x8a3a7a) },
      bot: { value: new THREE.Color(0xff8a4d) },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot;
      void main(){ float h = normalize(vP).y; vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.7, h)) : mix(bot, mid, smoothstep(-0.08, 0.12, h)); gl_FragColor = vec4(c, 1.0); }`,
  });
  group.add(new THREE.Mesh(skyGeo, skyMat));

  // --- Ground ------------------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(H * 2 + 80, H * 2 + 80),
    new THREE.MeshLambertMaterial({ color: 0x2a2f3a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Harbour water strip along the north-west edge.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(H * 2 + 80, 70),
    new THREE.MeshLambertMaterial({ color: 0x0e3a5e }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.06, -H - 28);
  group.add(water);

  // --- Roads -------------------------------------------------------------
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x181a20 });
  const avenueMat = new THREE.MeshLambertMaterial({ color: 0x1e2028 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8c25a });
  for (let i = -5; i <= 5; i++) {
    const c = i * CITY.BLOCK;
    const wide = i % 2 === 0;
    const w = wide ? CITY.AVENUE_W : CITY.ROAD_W;
    const mat = wide ? avenueMat : roadMat;
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(w, H * 2), mat);
    ns.rotation.x = -Math.PI / 2; ns.position.set(c, 0.08, 0); ns.receiveShadow = true;
    group.add(ns);
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(H * 2, w), mat);
    ew.rotation.x = -Math.PI / 2; ew.position.set(0, 0.08, c); ew.receiveShadow = true;
    group.add(ew);
    // Centre dashes on the avenues.
    if (wide) {
      for (let s = -H; s < H; s += 8) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 3.4), lineMat);
        dash.rotation.x = -Math.PI / 2; dash.position.set(c, 0.1, s);
        group.add(dash);
      }
    }
  }

  // --- Buildings ---------------------------------------------------------
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  const winMatCool = new THREE.MeshBasicMaterial({ color: 0x9fd8ff });
  const buildingMats = DISTRICTS.map((d) => new THREE.MeshLambertMaterial({ color: d.tint }));
  const neonColors = [0xff2e88, 0x39d5ff, 0xffd23e, 0x7dff9b, 0xc93eff];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const winGeo = new THREE.PlaneGeometry(1.6, 1.1);
  let neonIdx = 0;

  for (let gx = -5; gx <= 4; gx++) {
    for (let gz = -5; gz <= 4; gz++) {
      const cx = gx * CITY.BLOCK + CITY.BLOCK / 2;
      const cz = gz * CITY.BLOCK + CITY.BLOCK / 2;
      if (Math.abs(cx) > H - 14 || Math.abs(cz) > H - 14) continue;
      // A plaza in the middle of each quadrant keeps the city breathable.
      if ((gx === -1 && gz === -1) || (gx === 2 && gz === 2)) continue;
      const d = districtAt(cx, cz);
      const downtown = d.name === 'DOWNTOWN';
      const h = downtown ? 22 + rand() * 42 : 6 + rand() * (rand() < 0.25 ? 22 : 9);
      const w = 12 + rand() * 8;
      const dep = 12 + rand() * 8;
      const mat = buildingMats[DISTRICTS.indexOf(d)];
      const b = new THREE.Mesh(boxGeo, mat);
      b.scale.set(w, h, dep);
      b.position.set(cx, h / 2, cz);
      b.castShadow = true; b.receiveShadow = true;
      group.add(b);
      // Roof rim.
      const rim = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x11131c }));
      rim.scale.set(w + 0.6, 0.5, dep + 0.6);
      rim.position.set(cx, h + 0.25, cz);
      group.add(rim);
      // Lit windows on the street-facing sides.
      const rows = Math.max(1, Math.floor(h / 4));
      for (let r = 0; r < rows; r++) {
        for (let k = 0; k < 3; k++) {
          if (rand() < 0.45) continue;
          const win = new THREE.Mesh(winGeo, rand() < 0.5 ? winMat : winMatCool);
          const side = rand() < 0.5 ? 1 : -1;
          win.position.set(cx - w / 2 + 2.4 + k * (w - 4.8) / 2, 3 + r * 4, cz + side * (dep / 2 + 0.06));
          if (side < 0) win.rotation.y = Math.PI;
          group.add(win);
        }
      }
      // A neon sign on some downtown towers.
      if (downtown && rand() < 0.5) {
        const neon = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 1.4, 6 + rand() * 4),
          new THREE.MeshBasicMaterial({ color: neonColors[neonIdx++ % neonColors.length] }),
        );
        neon.position.set(cx + w / 2 + 0.4, h * 0.72, cz);
        group.add(neon);
      }
    }
  }

  // --- Palm trees along the avenues --------------------------------------
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2e });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e8a4d });
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 5.4, 6);
  const leafGeo = new THREE.ConeGeometry(2.2, 1.6, 6);
  for (let i = -5; i <= 5; i++) {
    for (const z of [-CITY.BLOCK * 2.5, CITY.BLOCK * 2.5]) {
      const x = i * CITY.BLOCK + CITY.BLOCK / 2;
      if (Math.abs(x) > H - 10) continue;
      const t = new THREE.Mesh(trunkGeo, trunkMat);
      t.position.set(x, 2.7, z + (rand() - 0.5) * 4);
      t.castShadow = true;
      group.add(t);
      const l = new THREE.Mesh(leafGeo, leafMat);
      l.position.set(t.position.x, 5.9, t.position.z);
      group.add(l);
    }
  }

  // --- Street lamps ------------------------------------------------------
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f4a });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 6, 6);
  const lampGeo = new THREE.SphereGeometry(0.42, 8, 6);
  for (let i = -5; i <= 5; i++) {
    for (let j = -5; j <= 5; j++) {
      if ((i + j) % 2 !== 0) continue;
      const x = i * CITY.BLOCK + 7;
      const z = j * CITY.BLOCK + 7;
      if (Math.abs(x) > H - 8 || Math.abs(z) > H - 8) continue;
      const p = new THREE.Mesh(poleGeo, poleMat);
      p.position.set(x, 3, z);
      group.add(p);
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(x, 6.1, z);
      group.add(lamp);
    }
  }

  // --- Harbour crates + a lighthouse beacon ------------------------------
  const crateMat = new THREE.MeshLambertMaterial({ color: 0x7a5a2e });
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Mesh(boxGeo, crateMat);
    const s = 2.4 + rand() * 2.4;
    c.scale.set(s, s, s);
    c.position.set(-H + 14 + rand() * 60, s / 2, -H + 10 + rand() * 24);
    c.rotation.y = rand() * Math.PI;
    c.castShadow = true;
    group.add(c);
  }
  const light = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 2, 14, 8),
    new THREE.MeshLambertMaterial({ color: 0xd8d8e8 }),
  );
  light.position.set(-H + 8, 7, -H + 8);
  group.add(light);
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xff5a5a }),
  );
  beacon.position.set(-H + 8, 14.6, -H + 8);
  beacon.name = 'beacon';
  group.add(beacon);

  // --- Central plaza fountain --------------------------------------------
  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 9, 0.5, 24),
    new THREE.MeshLambertMaterial({ color: 0x3a4a6b }),
  );
  plaza.position.set(0, 0.25, 0);
  group.add(plaza);

  // --- Lighting ----------------------------------------------------------
  const sun = new THREE.DirectionalLight(0xffb36b, 1.15);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -240; sun.shadow.camera.right = 240;
  sun.shadow.camera.top = 240; sun.shadow.camera.bottom = -240;
  group.add(sun);
  group.add(new THREE.AmbientLight(0x8a7ab8, 0.85));
  const dusk = new THREE.PointLight(0xff2e88, 900, 160);
  dusk.position.set(88, 18, -88);
  group.add(dusk);

  scene.add(group);
  return { group, beacon };
}
