// NEON DUSK — Sable City. Main loop and player controller: on-foot movement
// and driving, stealing cars, wanted level and police spawning, shooting and
// punching, the chase camera, saving, menus, and the ?shot= staging hooks
// the screenshots use to pose the game.

import * as THREE from 'three';
import { CITY, CAR_MODELS, TUNE, SAVE_KEY } from './config.js';
import { buildCity, onRoad } from './world.js';
import { spawnCar, driveTraffic, makePed, walkPed, makeGuard, drivePolice, makeCarMesh } from './entities.js';
import { MissionEngine } from './missions.js';
import { SoundBank } from './audio.js';
import { Hud } from './hud.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') || '';

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return { cash: s.cash | 0, mission: s.mission | 0, bestWanted: s.bestWanted | 0 };
    }
  } catch { /* fresh save */ }
  return { cash: 0, mission: 0, bestWanted: 0 };
}

class Game {
  constructor() {
    this.save = loadSave();
    this.state = 'menu'; // menu | playing | paused | busted | wasted
    this.wanted = 0;
    this.heatTimer = 0;
    this.clockMin = 18 * 60 + 42;
    this.audio = new SoundBank();
    this.keys = {};
    this.mouseDown = false;
    this.shootCooldown = 0;
    this.punchCooldown = 0;
    this.bullets = [];
    this.guards = [];
    this.police = [];
    this.traffic = [];
    this.peds = [];
    this.missionCar = null;
    this.time = 0;
    this.sirenTimer = 0;
    this.player = null;

    const canvas = document.getElementById('scene');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x2a1a3a, 180, 620);
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1200);

    const { beacon } = buildCity(this.scene);
    this.beacon = beacon;

    this.buildPlayer();
    this.buildTrafficAndPeds();
    this.hud = new Hud(this);
    this.missions = new MissionEngine(this);
    this.spawnMissionCar();
    this.bindInput();
    this.bindMenus();
    this.applyShotStaging();
    addEventListener('resize', () => this.onResize());

    this.last = performance.now();
    const loop = (now) => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.update(dt);
    };
    requestAnimationFrame(loop);
  }

  // --- Setup -------------------------------------------------------------
  buildPlayer() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.4, 1.15, 10),
      new THREE.MeshLambertMaterial({ color: 0xffd23e }),
    );
    body.position.y = 1.0; body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 12, 10),
      new THREE.MeshLambertMaterial({ color: 0xd9a986 }),
    );
    head.position.y = 1.85;
    g.add(head);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.12, 12),
      new THREE.MeshLambertMaterial({ color: 0x1a1a22 }),
    );
    cap.position.y = 2.05;
    g.add(cap);
    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.5, 0.32),
      new THREE.MeshLambertMaterial({ color: 0x222838 }),
    );
    legs.position.y = 0.25;
    g.add(legs);
    g.position.set(0, 0, 24);
    this.scene.add(g);
    this.player = {
      mesh: g, x: 0, z: 24, heading: Math.PI, hp: TUNE.playerHealth,
      car: null, speed: 0, vy: 0, onGround: true,
    };
  }

  buildTrafficAndPeds() {
    // Parked cars along the avenues.
    const parkedSpots = [
      [22, -18, 0], [-22, 40, 1], [66, -62, 2], [-66, 84, 3], [110, 18, 4],
      [-110, -40, 5], [18, 110, 1], [-18, -110, 2], [154, 62, 0], [-154, -62, 3],
      [62, 154, 4], [-62, -154, 5], [198, -18, 1], [-198, 18, 2],
    ];
    for (const [x, z, mi] of parkedSpots) {
      const c = spawnCar(this.scene, CAR_MODELS[mi], x, z, Math.PI / 2, { parked: true });
      this.traffic.push(c);
    }
    // Moving traffic on the grid.
    for (let i = 0; i < TUNE.trafficCount; i++) {
      const axis = i % 2 === 0 ? 'x' : 'z';
      const lane = (Math.floor(i / 2) % 11 - 5) * CITY.BLOCK;
      const model = CAR_MODELS[i % CAR_MODELS.length];
      const c = spawnCar(this.scene, model,
        axis === 'x' ? (Math.random() - 0.5) * 400 : lane + (Math.random() < 0.5 ? 2.2 : -2.2),
        axis === 'z' ? (Math.random() - 0.5) * 400 : lane + (Math.random() < 0.5 ? 2.2 : -2.2),
        0, { axis, dir: Math.random() < 0.5 ? 1 : -1, taxi: model.name === 'Harbour Taxi' });
      this.traffic.push(c);
    }
    for (let i = 0; i < TUNE.pedCount; i++) {
      this.peds.push(makePed(this.scene, (Math.random() - 0.5) * 380, (Math.random() - 0.5) * 380));
    }
  }

  spawnMissionCar() {
    if (!this.missions.active) return;
    const m = this.missions.mission;
    const step = this.missions.stepDef;
    if (!step || (step.kind !== 'steal')) return;
    if (this.missionCar) return;
    const model = m.id === 5 ? CAR_MODELS[5] : CAR_MODELS[0];
    const c = spawnCar(this.scene, model, m.target.x, m.target.z, Math.PI / 4, { parked: true, kind: 'mission' });
    c.missionCar = true;
    this.missionCar = c;
    this.traffic.push(c);
  }

  spawnGuards(x, z, n) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.guards.push(makeGuard(this.scene, x + Math.cos(a) * 7, z + Math.sin(a) * 7));
    }
  }

  // --- Input ---------------------------------------------------------------
  bindInput() {
    addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyE') this.tryEnterCar();
      if (e.code === 'KeyF') this.tryPunch();
      if (e.code === 'KeyH') this.audio.honk();
      if (e.code === 'KeyM') this.togglePause();
      if (e.code === 'KeyP' || e.code === 'Escape') this.togglePause();
      if (e.code === 'KeyR' && (this.state === 'busted' || this.state === 'wasted')) this.restart();
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.state === 'playing') { this.mouseDown = true; this.tryShoot(); }
    });
    addEventListener('mouseup', () => { this.mouseDown = false; });
    addEventListener('mousemove', (e) => {
      if (this.state !== 'playing') return;
      // Mouse steers the on-foot facing a little; driving uses keys.
      if (!this.player.car) this.player.heading -= e.movementX * 0.0022;
    });
  }

  bindMenus() {
    document.getElementById('play-btn').addEventListener('click', () => this.startGame(false));
    document.getElementById('continue-btn').addEventListener('click', () => this.startGame(true));
    document.getElementById('resume-btn').addEventListener('click', () => this.togglePause());
    document.getElementById('quit-btn').addEventListener('click', () => {
      this.state = 'menu';
      document.getElementById('pause').classList.add('hidden');
      document.getElementById('menu').classList.remove('hidden');
      this.hud.hide();
    });
    const cont = document.getElementById('continue-btn');
    if (this.save.mission > 0 && this.save.mission < 5) {
      cont.classList.remove('hidden');
      document.getElementById('cont-num').textContent = String(this.save.mission + 1);
    }
  }

  startGame(continued) {
    this.audio.ensure();
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('pause').classList.add('hidden');
    this.hud.show();
    this.hud.hideEndScreens();
    this.state = 'playing';
    this.player.hp = TUNE.playerHealth;
    this.wanted = 0;
    this.hud.setObjective(this.missions.title, this.missions.text);
    if (!continued) this.audio.mission();
  }

  restart() {
    this.hud.hideEndScreens();
    this.player.hp = TUNE.playerHealth;
    this.player.x = 0; this.player.z = 24;
    this.player.car = null;
    this.wanted = 0;
    this.clearPolice();
    this.state = 'playing';
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.hud.fillMissionList();
      document.getElementById('pause').classList.remove('hidden');
    } else if (this.state === 'paused') {
      this.state = 'playing';
      document.getElementById('pause').classList.add('hidden');
    }
  }

  // --- Cars ----------------------------------------------------------------
  nearestCar(maxDist) {
    let best = null; let bd = maxDist;
    for (const c of this.traffic) {
      const d = Math.hypot(c.x - this.player.x, c.z - this.player.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  tryEnterCar() {
    if (this.state !== 'playing') return;
    if (this.player.car) {
      // Step out beside the car.
      const c = this.player.car;
      this.player.car = null;
      this.player.x = c.x + Math.sin(c.heading + Math.PI / 2) * 2.4;
      this.player.z = c.z + Math.cos(c.heading + Math.PI / 2) * 2.4;
      this.player.mesh.visible = true;
      return;
    }
    const c = this.nearestCar(4.5);
    if (!c) return;
    this.player.car = c;
    this.player.mesh.visible = false;
    this.player.x = c.x; this.player.z = c.z;
    if (c.parked || c.kind === 'mission') {
      // Stealing a parked car is a crime — unless it is the mission car.
      if (!c.missionCar) this.addWanted(1, 'stole a car');
      c.parked = false;
      c.axis = 'x'; c.dir = 1;
    }
    this.audio.blip(180, 0.12, 'square', 0.1, 320);
  }

  // --- Combat --------------------------------------------------------------
  tryPunch() {
    if (this.state !== 'playing' || this.player.car || this.punchCooldown > 0) return;
    this.punchCooldown = 0.45;
    this.audio.punch();
    const fx = Math.sin(this.player.heading);
    const fz = Math.cos(this.player.heading);
    for (const g of this.guards) {
      const d = Math.hypot(g.x - this.player.x, g.z - this.player.z);
      if (d < 2.6) this.damageGuard(g, TUNE.punchDamage);
    }
    for (const p of this.peds) {
      const d = Math.hypot(p.x - this.player.x, p.z - this.player.z);
      if (d < 2.2) { p.panic = 1; this.addWanted(1, 'assault'); }
    }
  }

  tryShoot() {
    if (this.state !== 'playing' || this.player.car || this.shootCooldown > 0) return;
    this.shootCooldown = 0.22;
    this.audio.shoot();
    this.addWanted(1, 'gunfire');
    const dir = new THREE.Vector3(Math.sin(this.player.heading), 0, Math.cos(this.player.heading));
    const from = new THREE.Vector3(this.player.x, 1.4, this.player.z);
    // Hitscan: nearest guard within a narrow cone and 40 m.
    let best = null; let bd = 40;
    for (const g of this.guards) {
      const to = new THREE.Vector3(g.x - from.x, 0, g.z - from.z);
      const d = to.length();
      if (d < bd && to.normalize().dot(dir) > 0.94) { best = g; bd = d; }
    }
    if (best) {
      this.damageGuard(best, TUNE.bulletDamage);
      this.spawnTracer(from, new THREE.Vector3(best.x, 1.2, best.z));
    } else {
      this.spawnTracer(from, from.clone().add(dir.clone().multiplyScalar(30)));
    }
  }

  spawnTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8 }));
    this.scene.add(line);
    this.bullets.push({ line, life: 0.09 });
  }

  damageGuard(g, dmg) {
    g.hp -= dmg;
    this.audio.hit();
    if (g.hp <= 0) {
      g.mesh.rotation.x = -Math.PI / 2;
      g.mesh.position.y = 0.4;
      this.missions.onGuardDown();
      this.addCash(50);
      this.guards = this.guards.filter((x) => x !== g);
      setTimeout(() => this.scene.remove(g.mesh), 4000);
    }
  }

  // --- Wanted --------------------------------------------------------------
  setWanted(n) {
    this.wanted = n;
    this.save.bestWanted = Math.max(this.save.bestWanted, n);
    this.saveGame();
    this.syncPolice();
  }

  addWanted(n, why) {
    if (this.state !== 'playing') return;
    const before = this.wanted;
    this.wanted = Math.min(5, this.wanted + n);
    if (this.wanted > before) {
      this.hud.toast(`${'★'.repeat(this.wanted)} WANTED — ${why.toUpperCase()}`);
      this.sirenTimer = 0;
      this.syncPolice();
      this.save.bestWanted = Math.max(this.save.bestWanted, this.wanted);
      this.saveGame();
    }
    this.heatTimer = 0;
  }

  syncPolice() {
    const want = this.wanted === 0 ? 0 : Math.min(TUNE.policeMax, 1 + Math.floor(this.wanted / 2));
    while (this.police.length < want) {
      const a = Math.random() * Math.PI * 2;
      const c = spawnCar(this.scene, CAR_MODELS[1],
        this.player.x + Math.sin(a) * 42, this.player.z + Math.cos(a) * 42,
        0, { police: true, kind: 'police' });
      this.police.push(c);
    }
    while (this.police.length > want) {
      const c = this.police.pop();
      this.scene.remove(c.mesh);
    }
  }

  clearPolice() {
    for (const c of this.police) this.scene.remove(c.mesh);
    this.police = [];
  }

  addCash(n) {
    this.save.cash += n;
    this.saveGame();
  }

  saveGame() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch { /* storage full */ }
  }

  // --- Screenshot staging --------------------------------------------------
  // ?shot=cover poses a police chase with wanted stars; =drive poses the
  // player driving downtown; =foot poses on-foot city; =mission poses the
  // stash-house fight. The game starts directly in playing state.
  applyShotStaging() {
    if (!SHOT) return;
    this.state = 'playing';
    document.getElementById('menu').classList.add('hidden');
    this.hud.show();
    this.audio.ensure();
    if (SHOT === 'cover') {
      this.player.x = 40; this.player.z = -40;
      const car = spawnCar(this.scene, CAR_MODELS[0], 40, -40, Math.PI / 4, { parked: true });
      this.traffic.push(car);
      this.player.car = car;
      this.player.mesh.visible = false;
      this.setWanted(3);
      // Pull one cruiser into frame behind the player for the cover.
      const cruiser = this.police[0];
      if (cruiser) {
        cruiser.x = this.player.x - Math.sin(this.player.heading) * 16;
        cruiser.z = this.player.z - Math.cos(this.player.heading) * 16;
        cruiser.heading = this.player.heading;
        cruiser.mesh.position.set(cruiser.x, 0, cruiser.z);
      }
      this.hud.setObjective('MISSION 3 — HEAT WAVE', 'Shake the police — stay out of sight until the heat drops.');
      this.hud.toast('★★★ WANTED — OUTRUN THE LAW');
    } else if (SHOT === 'drive') {
      this.player.x = 88; this.player.z = -88;
      const car = spawnCar(this.scene, CAR_MODELS[5], 88, -88, Math.PI / 2, { parked: true });
      this.traffic.push(car);
      this.player.car = car;
      this.player.mesh.visible = false;
      this.hud.setObjective('FREE ROAM', 'Cruising Downtown — Neon Coupe, full tank, nowhere to be.');
    } else if (SHOT === 'foot') {
      this.player.x = -20; this.player.z = 90;
      this.player.heading = Math.PI * 0.9;
      this.hud.setObjective('FREE ROAM', 'Palm Row at dusk — on foot, looking for trouble.');
    } else if (SHOT === 'mission') {
      this.player.x = 168; this.player.z = 124;
      this.player.heading = Math.PI * 0.75;
      this.spawnGuards(176, 132, 4);
      this.setWanted(2);
      this.hud.setObjective('MISSION 4 — PAYBACK', 'Take down 4 Vulture guards at the Old Town stash house.');
    }
  }

  onResize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  // --- Per-frame update ----------------------------------------------------
  update(dt) {
    this.time += dt;
    this.clockMin += dt * 0.9;
    this.beacon.material.color.setHex(Math.floor(this.time * 1.4) % 2 ? 0xff5a5a : 0xffffff);

    if (this.state === 'playing') {
      this.updatePlayer(dt);
      this.missions.update(dt);
      this.updateWanted(dt);
      this.updateGuards(dt);
    }
    // The city stays alive behind menus too.
    for (const c of this.traffic) {
      if (c.police) continue;
      if (c === this.player.car) continue;
      driveTraffic(c, dt);
    }
    for (const p of this.peds) walkPed(p, dt, this.player);
    for (const b of this.bullets) {
      b.life -= dt;
      if (b.life <= 0) { this.scene.remove(b.line); }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
    this.updateCamera(dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.hud.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  updatePlayer(dt) {
    const p = this.player;
    const k = this.keys;
    const fwd = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    const turn = (k.KeyA || k.ArrowLeft ? 1 : 0) - (k.KeyD || k.ArrowRight ? 1 : 0);

    if (p.car) {
      const c = p.car;
      const model = c.model;
      const handbrake = !!k.Space;
      const accel = fwd * model.accel * (handbrake ? 0.35 : 1);
      c.speed += accel * dt;
      // Drag + rolling resistance; handbrake bites hard.
      c.speed -= c.speed * (handbrake ? 2.2 : 0.35) * dt;
      c.speed = Math.max(-model.top * 0.45, Math.min(model.top, c.speed));
      const steer = turn * (c.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(c.speed) / 8) * 1.9;
      c.heading += steer * dt * (handbrake ? 1.35 : 1);
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
      // Soft city bounds.
      const H = CITY.HALF - 6;
      c.x = Math.max(-H, Math.min(H, c.x));
      c.z = Math.max(-H, Math.min(H, c.z));
      // Nudge traffic cars we ram.
      for (const o of this.traffic) {
        if (o === c || o.police) continue;
        const d = Math.hypot(o.x - c.x, o.z - c.z);
        if (d < 4.2 && Math.abs(c.speed) > 4) {
          o.x += Math.sin(c.heading) * 3;
          o.z += Math.cos(c.heading) * 3;
          o.mesh.position.set(o.x, 0, o.z);
          if (Math.abs(c.speed) > 12) this.addWanted(1, 'hit and run');
        }
      }
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      // Wheel spin + a little body roll.
      for (const w of c.mesh.children) { /* wheels spin via rotation */ }
      c.mesh.rotation.z = -steer * 0.03;
      p.x = c.x; p.z = c.z; p.heading = c.heading;
      this.audio.setEngine(Math.abs(c.speed) / model.top, true);
      if (k.KeyH) this.audio.honk();
    } else {
      const sprint = k.ShiftLeft || k.ShiftRight || k.Space;
      const speed = sprint ? TUNE.sprintSpeed : TUNE.walkSpeed;
      p.heading += turn * 2.6 * dt;
      const mx = Math.sin(p.heading) * fwd * speed * dt;
      const mz = Math.cos(p.heading) * fwd * speed * dt;
      p.x += mx; p.z += mz;
      const H = CITY.HALF - 4;
      p.x = Math.max(-H, Math.min(H, p.x));
      p.z = Math.max(-H, Math.min(H, p.z));
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      // Walk bob.
      p.mesh.position.y = fwd !== 0 ? Math.abs(Math.sin(this.time * 9)) * 0.08 : 0;
      this.audio.setEngine(0, false);
      // Bump into parked cars? No — walking through them is fine, they are scenery.
    }
  }

  updateWanted(dt) {
    if (this.wanted === 0) return;
    this.heatTimer += dt;
    // Heat cools when the player is far from every cruiser.
    let nearest = Infinity;
    for (const c of this.police) {
      nearest = Math.min(nearest, Math.hypot(c.x - this.player.x, c.z - this.player.z));
    }
    if (nearest > 55) {
      if (this.heatTimer > TUNE.wantedDecaySec) {
        this.setWanted(this.wanted - 1);
        this.heatTimer = 0;
        if (this.wanted === 0) this.hud.toast('YOU LOST THEM — HEAT OFF');
      }
    } else {
      this.heatTimer = 0;
    }
    // Sirens while wanted.
    this.sirenTimer -= dt;
    if (this.sirenTimer <= 0) {
      this.audio.siren();
      this.sirenTimer = 1.6;
    }
    // Police chase + arrest.
    for (const c of this.police) {
      const d = drivePolice(c, dt, this.player, this.player.car ? Math.abs(this.player.car.speed) : 0);
      if (d < TUNE.arrestRange && !this.player.car) {
        this.state = 'busted';
        this.audio.busted();
        this.hud.showBusted();
        this.addCash(-Math.min(200, this.save.cash));
      }
    }
  }

  updateGuards(dt) {
    for (const g of this.guards) {
      const dx = this.player.x - g.x;
      const dz = this.player.z - g.z;
      const d = Math.hypot(dx, dz);
      if (d < 34 && this.state === 'playing') {
        g.mesh.rotation.y = Math.atan2(dx, dz);
        g.cooldown -= dt;
        if (g.cooldown <= 0 && d > 2) {
          g.cooldown = 1.4 + Math.random() * 0.8;
          this.audio.shoot();
          // Hit chance falls with distance.
          if (Math.random() < Math.max(0.08, 0.45 - d * 0.012)) {
            this.player.hp -= 9;
            this.audio.hit();
            if (this.player.hp <= 0) {
              this.state = 'wasted';
              this.hud.showWasted();
              this.audio.busted();
            }
          }
          this.spawnTracer(new THREE.Vector3(g.x, 1.3, g.z), new THREE.Vector3(this.player.x, 1.2, this.player.z));
        }
      }
    }
  }

  updateCamera(dt) {
    const p = this.player;
    const back = TUNE.cameraBack;
    const height = TUNE.cameraHeight;
    const bx = p.x - Math.sin(p.heading) * back;
    const bz = p.z - Math.cos(p.heading) * back;
    const tx = p.x + Math.sin(p.heading) * 6;
    const tz = p.z + Math.cos(p.heading) * 6;
    const lerp = 1 - Math.exp(-dt * 5);
    this.camera.position.x += (bx - this.camera.position.x) * lerp;
    this.camera.position.y += (height - this.camera.position.y) * lerp;
    this.camera.position.z += (bz - this.camera.position.z) * lerp;
    this.camera.lookAt(tx, 1.6, tz);
    if (this.state === 'menu') {
      // Slow orbit over the city behind the menu.
      const t = this.time * 0.05;
      this.camera.position.set(Math.sin(t) * 150, 70, Math.cos(t) * 150);
      this.camera.lookAt(0, 0, 0);
    }
  }
}

new Game();
