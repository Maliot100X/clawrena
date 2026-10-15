// Neon Swarm — the game loop. threejs-scene-setup + survival genre:
// setAnimationLoop render loop, wave spawner, auto-fire at nearest enemy,
// XP shards with magnet, level-up pauses with power choices, game over.
import * as THREE from 'three';
import { buildCity } from './world';
import { makeRobot, makeHero, ROBOTS } from './entities';
import { xpNeed, rollUpgrades, applyPower, defaultStats } from './powers';
import type { Enemy, HudState, PlayerPower, Steer } from './types';

export class NeonSwarm {
  renderer!: THREE.WebGLRenderer;
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  hero!: THREE.Group;
  private clock = new THREE.Clock();

  stats = defaultStats();
  hp = 100; maxHp = 100;
  xp = 0; level = 1;
  kills = 0; wave = 1; elapsed = 0;
  over = false; paused = false;

  powers: PlayerPower[] = [];
  enemies: Enemy[] = [];
  shards: THREE.Mesh[] = [];
  bullets: THREE.Mesh[] = [];

  private keys: Record<string, boolean> = {};
  private steer: Steer | null = null;   // set by the LLM when bound
  private lastFire = 0; private lastSpawn = 0; private nextId = 1;
  private vel = new THREE.Vector2();
  private onHud: (h: HudState) => void = () => {};
  private onLevelUp: (opts: PlayerPower[]) => void = () => {};

  constructor(canvasHost: HTMLElement, opts?: { onHud?: (h: HudState) => void; onLevelUp?: (o: PlayerPower[]) => void }) {
    if (opts?.onHud) this.onHud = opts.onHud;
    if (opts?.onLevelUp) this.onLevelUp = opts.onLevelUp;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(canvasHost.clientWidth || 800, canvasHost.clientHeight || 460);
    this.renderer.shadowMap.enabled = true;
    canvasHost.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, (canvasHost.clientWidth||800)/(canvasHost.clientHeight||460), 0.1, 500);
    buildCity(this.scene);

    this.hero = makeHero();
    this.scene.add(this.hero);

    addEventListener('keydown', this.kd); addEventListener('keyup', this.ku);
    addEventListener('resize', this.onResize);
  }

  private kd = (e: KeyboardEvent) => { this.keys[e.key.toLowerCase()] = true; };
  private ku = (e: KeyboardEvent) => { this.keys[e.key.toLowerCase()] = false; };
  private onResize = () => {
    const p = this.renderer.domElement.parentElement; if (!p) return;
    this.camera.aspect = p.clientWidth / p.clientHeight; this.camera.updateProjectionMatrix();
    this.renderer.setSize(p.clientWidth, p.clientHeight);
  };

  /** The LLM brain calls this with the agent's steer each beat. */
  setSteer(s: Steer) { this.steer = s; }

  start() { this.renderer.setAnimationLoop(this.loop); }

  private spawn(tier?: number) {
    const t = tier ?? (this.elapsed > 45000 && Math.random() < 0.06 ? 3
              : this.elapsed > 20000 && Math.random() < 0.25 ? 2 : Math.random() < 0.35 ? 1 : 0);
    const spec = ROBOTS[Math.min(t, ROBOTS.length - 1)];
    const mesh = makeRobot(t);
    const a = Math.random() * Math.PI * 2, r = 42 + Math.random() * 24;
    mesh.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    this.scene.add(mesh);
    this.enemies.push({ id: this.nextId++, sprite: mesh, hp: spec.hp, speed: spec.speed, tier: t, dmg: spec.dmg, shards: spec.shards });
  }

  private fire(now: number) {
    if (now - this.lastFire < this.stats.fireMs) return;
    // nearest enemy within range
    let best: Enemy | null = null, bd = Infinity;
    for (const e of this.enemies) {
      const d = this.hero.position.distanceTo(e.sprite.position);
      if (d < this.stats.range && d < bd) { bd = d; best = e; }
    }
    if (!best) return;
    this.lastFire = now;

    const dir = new THREE.Vector3().subVectors(best.sprite.position, this.hero.position).normalize();
    for (let i = 0; i < this.stats.shots; i++) {
      const spread = (i - (this.stats.shots - 1) / 2) * 0.12;
      const d2 = dir.clone().applyAxisAngle(new THREE.Vector3(0,1,0), spread);
      const b = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x39ff88, emissive: 0x39ff88, emissiveIntensity: 3 }),
      );
      b.position.copy(this.hero.position).add(new THREE.Vector3(0, 1.1, 0));
      (b as any).userData.dir = d2;
      this.scene.add(b); this.bullets.push(b);
    }
  }

  private loop = () => {
    const dt = Math.min(0.05, this.clock.getDelta());
    const now = performance.now();
    if (this.over || this.paused) { this.renderer.render(this.scene, this.camera); return; }
    this.elapsed += dt * 1000;

    // --- move: keys if pressed, else the LLM steer, else idle ---------------
    let dx = 0, dz = 0;
    if (this.keys['a'] || this.keys['arrowleft'])  dx -= 1;
    if (this.keys['d'] || this.keys['arrowright']) dx += 1;
    if (this.keys['w'] || this.keys['arrowup'])    dz -= 1;
    if (this.keys['s'] || this.keys['arrowdown'])  dz += 1;
    if (dx === 0 && dz === 0 && this.steer) { dx = Math.sign(this.steer.dx); dz = Math.sign(this.steer.dy); }
    const len = Math.hypot(dx, dz) || 1;
    // camera-relative: +x world right, +z world toward viewer
    this.hero.position.x += (dx/len) * this.stats.speed * dt;
    this.hero.position.z += (dz/len) * this.stats.speed * dt;
    const R = 190;
    this.hero.position.x = Math.max(-R, Math.min(R, this.hero.position.x));
    this.hero.position.z = Math.max(-R, Math.min(R, this.hero.position.z));
    if (dx) this.hero.rotation.y = Math.atan2(dx, dz);

    // --- camera follows -----------------------------------------------------
    const camTarget = this.hero.position.clone().add(new THREE.Vector3(0, 16, 18));
    this.camera.position.lerp(camTarget, 0.08);
    this.camera.lookAt(this.hero.position.x, 1.4, this.hero.position.z);

    // --- enemies chase + touch damage ---------------------------------------
    for (const e of this.enemies) {
      const dir = new THREE.Vector3().subVectors(this.hero.position, e.sprite.position);
      const d = dir.length() || 1;
      dir.normalize();
      e.sprite.position.addScaledVector(dir, e.speed * dt);
      e.sprite.lookAt(this.hero.position.x, e.sprite.position.y, this.hero.position.z);
      if (d < 1.6) this.hp -= e.dmg * dt;
    }

    // --- bullets ------------------------------------------------------------
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.position.addScaledVector((b as any).userData.dir, 46 * dt);
      if (b.position.length() > 260) { this.scene.remove(b); this.bullets.splice(i, 1); }
    }
    // bullet vs enemy
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      for (const e of this.enemies) {
        if (b.position.distanceTo(e.sprite.position) < 1.3) {
          e.hp -= this.stats.damage;
          this.scene.remove(b); this.bullets.splice(i, 1);
          break;
        }
      }
    }

    // --- deaths -> shards ---------------------------------------------------
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.hp <= 0) {
        this.kills++;
        for (let s = 0; s < e.shards; s++) {
          const sh = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.22),
            new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 3 }),
          );
          sh.position.copy(e.sprite.position);
          this.scene.add(sh); this.shards.push(sh);
        }
        this.scene.remove(e.sprite); this.enemies.splice(i, 1);
      }
    }

    // --- shards magnet + pickup --------------------------------------------
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const sh = this.shards[i];
      const d = sh.position.distanceTo(this.hero.position);
      if (d < this.stats.magnet) sh.position.lerp(this.hero.position, 0.12);
      if (d < 1.2) {
        this.scene.remove(sh); this.shards.splice(i, 1);
        this.xp++;
        if (this.xp >= xpNeed(this.level)) {
          this.xp = 0; this.level++;
          this.paused = true;
          this.onLevelUp(rollUpgrades(this.powers, 3));
        }
      }
    }

    // --- regen + waves ------------------------------------------------------
    if (this.stats.regen) this.hp = Math.min(this.maxHp, this.hp + this.stats.regen * dt);
    if (now - this.lastSpawn > Math.max(260, 900 - this.elapsed / 120)) {
      this.lastSpawn = now;
      this.spawn();
      if (this.wave > 4) this.spawn();
    }
    this.wave = 1 + Math.floor(this.elapsed / 12000);

    this.onHud(this.hud());

    if (this.hp <= 0) { this.hp = 0; this.over = true; this.onHud(this.hud()); return; }

    this.fire(now);
    this.renderer.render(this.scene, this.camera);
  };

  /** Called by React when the player picks a level-up power. */
  choose(power: PlayerPower) {
    const have = this.powers.find(p => p.kind === power.kind);
    if (have) have.level = power.level; else this.powers.push(power);
    applyPower(this.stats, power);
    this.paused = false;
  }

  hud(): HudState {
    return {
      hp: Math.max(0, Math.round(this.hp)), maxHp: this.maxHp,
      xp: this.xp, needXp: xpNeed(this.level), level: this.level,
      kills: this.kills, wave: this.wave, elapsed: Math.floor(this.elapsed / 1000),
      powers: this.powers, over: this.over,
    };
  }

  destroy() {
    this.renderer.setAnimationLoop(null);
    removeEventListener('keydown', this.kd); removeEventListener('keyup', this.ku);
    removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
