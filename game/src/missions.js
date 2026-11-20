// NEON DUSK — Sable City. Story and mission engine. Missions run as a list
// of steps; each step names a kind (steal / goto / deliver / wanted / combat
// / chase) and the engine watches the game state until the step completes,
// then advances, pays out, and saves. Free roam follows the finale.

import { MISSIONS } from './config.js';

export class MissionEngine {
  constructor(game) {
    this.game = game;
    this.index = game.save.mission; // 0-based; MISSIONS.length = free roam
    this.step = 0;
    this.stepTimer = 0;
    this.guardsLeft = 0;
    this.chaseTimer = 0;
    this.marker = null; // { x, z, color }
    this.active = this.index < MISSIONS.length;
    this.setStep(0);
  }

  get mission() {
    return MISSIONS[this.index];
  }

  get stepDef() {
    return this.active ? this.mission.steps[this.step] : null;
  }

  get title() {
    return this.active ? `MISSION ${this.mission.id} — ${this.mission.title}` : 'FREE ROAM';
  }

  get text() {
    if (!this.active) return 'Sable City is yours. Steal cars, dodge the law, chase the sunset.';
    return this.stepDef.text;
  }

  setStep(i) {
    this.step = i;
    this.stepTimer = 0;
    this.chaseTimer = 0;
    const g = this.game;
    if (!this.active) { this.marker = null; return; }
    const m = this.mission;
    const s = this.stepDef;
    if (!s) return;
    if (s.kind === 'steal' || s.kind === 'goto' || s.kind === 'combat') {
      this.marker = { x: m.target.x, z: m.target.z, color: 0xff2e88 };
    } else if (s.kind === 'deliver') {
      this.marker = { x: m.garage.x, z: m.garage.z, color: 0xffd23e };
    } else if (s.kind === 'wanted') {
      this.marker = null;
    } else if (s.kind === 'chase') {
      this.marker = null;
    }
    // Mission 4 spawns its guards when the combat step starts.
    if (s.kind === 'combat') {
      g.spawnGuards(m.target.x, m.target.z, 4);
      this.guardsLeft = 4;
    }
    // Mission 3 starts hot: the setup puts Kai at 3 stars.
    if (m.id === 3 && s.kind === 'wanted') {
      g.setWanted(3);
    }
    // Mission 5's chase step spikes the heat to 4 stars.
    if (m.id === 5 && s.kind === 'chase') {
      g.setWanted(4);
    }
    g.hud.setObjective(this.title, this.text);
  }

  // Called every frame; returns nothing, but fires game events.
  update(dt) {
    if (!this.active) return;
    this.stepTimer += dt;
    const g = this.game;
    const s = this.stepDef;
    if (!s) return;
    const px = g.player.x;
    const pz = g.player.z;

    if (s.kind === 'steal') {
      // Done when the player is driving the mission car (flagged by main).
      if (g.player.car && g.player.car.missionCar) this.advance();
    } else if (s.kind === 'goto' || s.kind === 'deliver') {
      const t = s.kind === 'goto' ? this.mission.target : this.mission.garage;
      if (Math.hypot(px - t.x, pz - t.z) < 9) this.advance();
    } else if (s.kind === 'wanted') {
      if (g.wanted === 0) this.advance();
    } else if (s.kind === 'combat') {
      if (this.guardsLeft <= 0) this.advance();
    } else if (s.kind === 'chase') {
      if (g.wanted >= 4) {
        this.chaseTimer += dt;
        if (this.chaseTimer >= 45) this.advance();
      } else {
        this.chaseTimer = Math.max(0, this.chaseTimer - dt * 2);
      }
    }
  }

  onGuardDown() {
    this.guardsLeft = Math.max(0, this.guardsLeft - 1);
  }

  advance() {
    const g = this.game;
    this.step += 1;
    if (this.step >= this.mission.steps.length) {
      // Mission complete: payout, fanfare, save, next mission.
      g.addCash(this.mission.payout);
      g.audio.cash();
      g.hud.missionPassed(`$${this.mission.payout} — ${this.mission.title}`);
      g.save.mission = this.index + 1;
      g.saveGame();
      this.index += 1;
      this.active = this.index < MISSIONS.length;
      if (this.active) {
        g.hud.toast(`NEW MISSION — ${MISSIONS[this.index].title}`);
        this.setStep(0);
        g.spawnMissionCar();
      } else {
        g.hud.setObjective('FREE ROAM', 'You did it, Kai. Sable City is yours.');
        g.hud.toast('STORY COMPLETE — FREE ROAM');
        this.marker = null;
      }
    } else {
      this.setStep(this.step);
    }
  }
}
