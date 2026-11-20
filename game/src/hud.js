// NEON DUSK — Sable City. The HUD: wanted stars, cash, health, clock,
// objective text, toasts, speedometer and the circular minimap drawn on a
// 2D canvas — roads, districts, the player arrow, police, the mission marker.

import { CITY, DISTRICTS, MISSIONS } from './config.js';

export class Hud {
  constructor(game) {
    this.game = game;
    this.el = {
      hud: document.getElementById('hud'),
      wanted: document.getElementById('wanted'),
      cash: document.getElementById('cash'),
      healthfill: document.getElementById('healthfill'),
      clock: document.getElementById('clock'),
      objTitle: document.getElementById('obj-title'),
      objText: document.getElementById('obj-text'),
      toast: document.getElementById('mission-toast'),
      speed: document.getElementById('speed'),
      speedo: document.getElementById('speedo'),
      minimap: document.getElementById('minimap'),
      crosshair: document.getElementById('crosshair'),
      busted: document.getElementById('busted'),
      wasted: document.getElementById('wasted'),
      missionPass: document.getElementById('mission-pass'),
      passText: document.getElementById('pass-text'),
      hint: document.getElementById('hint'),
    };
    this.mm = this.el.minimap.getContext('2d');
    this.toastTimer = null;
  }

  show() { this.el.hud.classList.remove('hidden'); }
  hide() { this.el.hud.classList.add('hidden'); }

  setObjective(title, text) {
    this.el.objTitle.textContent = title;
    this.el.objText.textContent = text;
  }

  toast(text) {
    this.el.toast.textContent = text;
    this.el.toast.style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.el.toast.style.opacity = '0'; }, 2600);
  }

  missionPassed(text) {
    this.el.passText.textContent = text;
    this.el.missionPass.classList.remove('hidden');
    setTimeout(() => this.el.missionPass.classList.add('hidden'), 3000);
  }

  showBusted() { this.el.busted.classList.remove('hidden'); }
  showWasted() { this.el.wasted.classList.remove('hidden'); }
  hideEndScreens() {
    this.el.busted.classList.add('hidden');
    this.el.wasted.classList.add('hidden');
  }

  update(dt) {
    const g = this.game;
    // Wanted stars.
    let stars = '';
    for (let i = 0; i < 5; i++) {
      stars += `<span class="${i < g.wanted ? '' : 'off'}">★</span>`;
    }
    this.el.wanted.innerHTML = stars;
    this.el.cash.textContent = `$${g.save.cash.toLocaleString('en-US')}`;
    this.el.healthfill.style.width = `${Math.max(0, g.player.hp)}%`;
    const mins = Math.floor(g.clockMin) % 60;
    const hrs = Math.floor(g.clockMin / 60) % 24;
    this.el.clock.textContent = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    const kmh = g.player.car ? Math.abs(g.player.car.speed) * 3.6 : 0;
    this.el.speed.textContent = String(Math.round(kmh));
    this.el.speedo.style.display = g.player.car ? 'block' : 'none';
    this.el.crosshair.style.display = (!g.player.car && g.state === 'playing') ? 'block' : 'none';
    this.drawMinimap();
  }

  drawMinimap() {
    const g = this.game;
    const c = this.mm;
    const S = 220;
    const H = CITY.HALF;
    const toMap = (x, z) => [((x + H) / (2 * H)) * S, ((z + H) / (2 * H)) * S];
    c.clearRect(0, 0, S, S);
    c.fillStyle = 'rgba(8, 12, 30, 0.9)';
    c.fillRect(0, 0, S, S);
    // District tint blocks.
    for (const d of DISTRICTS) {
      const [x, z] = toMap(d.x * H / 2, d.z * H / 2);
      c.fillStyle = '#1b2340';
      c.fillRect(d.x > 0 ? S / 2 : 0, d.z > 0 ? S / 2 : 0, S / 2, S / 2);
    }
    // Roads.
    c.strokeStyle = 'rgba(220, 225, 240, 0.55)';
    c.lineWidth = 2;
    for (let i = -5; i <= 5; i++) {
      const p = ((i * CITY.BLOCK + H) / (2 * H)) * S;
      c.beginPath(); c.moveTo(p, 0); c.lineTo(p, S); c.stroke();
      c.beginPath(); c.moveTo(0, p); c.lineTo(S, p); c.stroke();
    }
    // Harbour water.
    c.fillStyle = '#0e3a5e';
    c.fillRect(0, 0, S, 8);
    // Mission marker: pulsing diamond.
    const m = g.missions.marker;
    if (m) {
      const [mx, mz] = toMap(m.x, m.z);
      const pulse = 7 + Math.sin(Date.now() * 0.006) * 3;
      c.fillStyle = `#${m.color.toString(16).padStart(6, '0')}`;
      c.beginPath();
      c.moveTo(mx, mz - pulse); c.lineTo(mx + pulse, mz);
      c.lineTo(mx, mz + pulse); c.lineTo(mx - pulse, mz);
      c.closePath(); c.fill();
      c.strokeStyle = '#ffffff'; c.lineWidth = 1.5; c.stroke();
    }
    // Police blips.
    for (const p of g.police) {
      const [px, pz] = toMap(p.x, p.z);
      c.fillStyle = Math.floor(Date.now() / 350) % 2 ? '#ff4444' : '#4488ff';
      c.beginPath(); c.arc(px, pz, 4, 0, Math.PI * 2); c.fill();
    }
    // Player arrow.
    const [px, pz] = toMap(g.player.x, g.player.z);
    c.save();
    c.translate(px, pz);
    c.rotate(Math.atan2(Math.sin(g.player.heading), Math.cos(g.player.heading)) + Math.PI);
    c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(0, -8); c.lineTo(5.5, 6); c.lineTo(-5.5, 6); c.closePath(); c.fill();
    c.strokeStyle = '#111'; c.lineWidth = 1; c.stroke();
    c.restore();
    // North marker.
    c.fillStyle = '#9fd8ff';
    c.font = 'bold 11px sans-serif';
    c.textAlign = 'center';
    c.fillText('N', S / 2, 14);
  }

  fillMissionList() {
    const list = document.getElementById('mission-list');
    list.innerHTML = '';
    MISSIONS.forEach((m, i) => {
      const li = document.createElement('li');
      const done = i < this.game.save.mission;
      const now = i === this.game.save.mission;
      li.className = done ? 'done' : (now ? 'now' : 'locked');
      li.textContent = `${done ? '✓ ' : now ? '▶ ' : '· '}${m.id}. ${m.title} — $${m.payout}${done ? ' (done)' : ''}`;
      list.appendChild(li);
    });
  }
}
