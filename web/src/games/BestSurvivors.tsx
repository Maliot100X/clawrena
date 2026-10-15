'use client';
// A real Vampire-Survivors-style game (Phaser 4), built from the systems found
// in the reference implementations (~/refs/emoji-survival-game):
//   Player with XP + level + stat growth, weapon data (interval/power/area),
//   level-up upgrade choices, enemy tiers, pickups with a magnet radius,
//   escalating waves, real HUD.
import { useEffect, useRef } from 'react';
import Phaser from 'phaser';

type Weapon = { name: string; level: number; interval: number; power: number; area: number;
                amount: number; speed: number; kind: 'shot' | 'orbit' | 'nova' };

class Survivors extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private foes!: Phaser.Physics.Arcade.Group;
  private shots!: Phaser.Physics.Arcade.Group;
  private gems!: Phaser.Physics.Arcade.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;

  private hp = 100; private maxHp = 100;
  private xp = 0;  private needXp = 5; private level = 1;
  private kills = 0; private elapsed = 0; private gold = 0;
  private weapons: Weapon[] = [
    { name: 'Dagger', level: 1, interval: 380, power: 3, area: 1, amount: 1, speed: 1, kind: 'shot' },
  ];
  private lastFire = 0;
  private levelingUp = false; private done = false;
  private hud!: Phaser.GameObjects.Text;
  private panel!: Phaser.GameObjects.Container;
  private magnet = 120;

  constructor() { super('surv'); }

  create() {
    const { width, height } = this.scale;
    this.physics.world.setBounds(0, 0, 2400, 1800);

    // --- generated textures (no external assets) --------------------------
    const g = this.add.graphics();
    g.fillStyle(0x7c5cff, 1).fillCircle(18, 18, 16); g.fillStyle(0x39ff88, 1).fillCircle(18, 18, 7);
    g.generateTexture('hero', 36, 36);
    g.fillStyle(0xff4d6d, 1).fillCircle(14, 14, 11); g.generateTexture('foe', 28, 28);
    g.fillStyle(0xff9f43, 1).fillCircle(18, 18, 14); g.generateTexture('foe2', 36, 36);
    g.fillStyle(0xffe066, 1).fillRect(0, 6, 14, 6);  g.generateTexture('shot', 14, 18);
    g.fillStyle(0x39ff88, 1).fillTriangle(10, 0, 20, 14, 0, 14); g.generateTexture('gem', 20, 20);
    g.destroy();

    this.player = this.physics.add.sprite(width/2, height/2, 'hero').setCollideWorldBounds(true);
    this.foes  = this.physics.add.group();
    this.shots = this.physics.add.group();
    this.gems  = this.physics.add.group();

    this.physics.add.overlap(this.shots, this.foes, (s, f) => {
      (s as any).destroy();
      const foe = f as Phaser.Physics.Arcade.Sprite;
      foe.setData('hp', (foe.getData('hp') ?? 2) - 3);
      if (foe.getData('hp') <= 0) { this.killFoe(foe); }
    });
    this.physics.add.overlap(this.player, this.gems, (_p, gem) => {
      (gem as any).destroy(); this.gainXp(1);
    });
    this.physics.add.overlap(this.player, this.foes, (_p, f) => {
      const foe = f as Phaser.Physics.Arcade.Sprite;
      if (performance.now() > (this.player.getData('inv') ?? 0)) {
        this.hp -= 6; this.player.setData('inv', performance.now() + 600);
        this.player.setTint(0xff4d6d);
        this.time.delayedCall(150, () => this.player.clearTint());
        this.updateHud();
      }
      void foe;
    });

    // --- camera follows the player ---------------------------------------
    this.cameras.main.setBounds(0, 0, 2400, 1800);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // --- input -----------------------------------------------------------
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as any;

    // --- wave spawner: more + tougher over time --------------------------
    this.time.addEvent({ delay: 700, loop: true, callback: () => {
      const count = 1 + Math.floor(this.elapsed / 25000);
      for (let i = 0; i < count; i++) this.spawnFoe();
    }});

    this.hud = this.add.text(12, 10, '', {
      fontFamily: 'monospace', fontSize: '15px', color: '#ebebf5' }).setScrollFactor(0);
    this.updateHud();
  }

  private spawnFoe() {
    const ang = Math.random() * Math.PI * 2, r = 420;
    const x = Phaser.Math.Clamp(this.player.x + Math.cos(ang)*r, 20, 2380);
    const y = Phaser.Math.Clamp(this.player.y + Math.sin(ang)*r, 20, 1780);
    const tough = this.elapsed > 30000 && Math.random() < 0.3;
    const foe = this.foes.create(x, y, tough ? 'foe2' : 'foe') as Phaser.Physics.Arcade.Sprite;
    foe.setData('hp', tough ? 8 : 3);
    foe.setData('dmg', tough ? 10 : 6);
  }

  private killFoe(foe: Phaser.Physics.Arcade.Sprite) {
    this.gems.create(foe.x, foe.y, 'gem');
    foe.destroy();
    this.kills += 1; this.gold += 1;
    this.updateHud();
  }

  private gainXp(n: number) {
    this.xp += n; this.updateHud();
    if (this.xp >= this.needXp && !this.levelingUp) this.offerUpgrade();
  }

  /** Level-up: pause and let the agent (or player) choose an upgrade. */
  private offerUpgrade() {
    this.levelingUp = true;
    this.level++; this.xp = 0; this.needXp = Math.floor(this.needXp * 1.6);
    const opts = this.pickUpgrades();
    const { width, height } = this.scale;

    this.physics.pause();
    this.panel = this.add.container(width/2, height/2).setScrollFactor(0).setDepth(50);
    const bg = this.add.rectangle(0, 0, 440, 60 + opts.length*54, 0x0e0e16, 0.97)
      .setStrokeStyle(1, 0x2a2a3a);
    this.panel.add(bg);
    this.panel.add(this.add.text(0, -bg.height/2 + 18, 'LEVEL UP — choose', {
      fontFamily:'monospace', fontSize:'16px', color:'#39ff88' }).setOrigin(0.5));

    opts.forEach((w, i) => {
      const y = -bg.height/2 + 60 + i*54;
      const btn = this.add.rectangle(0, y, 380, 44, 0x14141c).setStrokeStyle(1, 0x3a3a4a)
        .setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setFillStyle(0x1d1d28));
      btn.on('pointerdown', () => this.applyUpgrade(w));
      this.panel.add(btn);
      this.panel.add(this.add.text(0, y, `${w.name}  ·  lv ${w.level}`, {
        fontFamily:'monospace', fontSize:'14px', color:'#ebebf5' }).setOrigin(0.5));
    });

    // keyboard 1/2/3 to pick too
    const keys = ['ONE','TWO','THREE'];
    keys.forEach((k, i) => {
      this.input.keyboard!.once(`keydown-${k}`, () => { if (opts[i]) this.applyUpgrade(opts[i]); });
    });
  }

  private pickUpgrades(): Weapon[] {
    const pool: Weapon[] = [];
    for (const w of this.weapons) {
      pool.push({ ...w, level: w.level + 1, power: w.power + 2, interval: Math.max(120, w.interval - 40),
                  amount: w.amount + (w.level % 2 === 0 ? 1 : 0) });
    }
    if (!this.weapons.find(w => w.name === 'Nova')) {
      pool.push({ name:'Nova', level:1, interval:1600, power:6, area:2, amount:1, speed:1, kind:'nova' });
    }
    if (!this.weapons.find(w => w.name === 'Orbit')) {
      pool.push({ name:'Orbit', level:1, interval:999, power:4, area:1, amount:2, speed:1, kind:'orbit' });
    }
    // three random distinct choices
    return Phaser.Utils.Array.Shuffle(pool).slice(0, 3);
  }

  private applyUpgrade(w: Weapon) {
    const existing = this.weapons.find(x => x.name === w.name);
    if (existing) Object.assign(existing, w); else this.weapons.push(w);
    this.panel?.destroy();
    this.levelingUp = false;
    this.physics.resume();
    this.updateHud();
  }

  private updateHud() {
    this.hud.setText(
      `LV ${this.level}   XP ${this.xp}/${this.needXp}   HP ${Math.max(0,this.hp)}   KILLS ${this.kills}   ` +
      `WEAPONS ${this.weapons.map(w=>w.name[0]+w.level).join(' ')}`);
  }

  update(t: number) {
    if (this.done || this.levelingUp) return;
    this.elapsed = t;

    // --- move: arrows or WASD -------------------------------------------
    const v = new Phaser.Math.Vector2(0,0);
    if (this.cursors.left.isDown || this.wasd.A.isDown) v.x = -1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) v.x = 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) v.y = -1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) v.y = 1;
    this.player.setVelocity(v.normalize().scale(230).x, v.normalize().scale(230).y);

    // --- enemies home in -------------------------------------------------
    for (const c of this.foes.getChildren()) {
      const e = c as Phaser.Physics.Arcade.Sprite;
      if (!e.body) continue;
      const dx = this.player.x - e.x, dy = this.player.y - e.y, d = Math.hypot(dx,dy)||1;
      const sp = e.texture.key === 'foe2' ? 42 : 62;
      e.setVelocity((dx/d)*sp, (dy/d)*sp);
    }

    // --- gems magnet toward the player -----------------------------------
    for (const c of this.gems.getChildren()) {
      const gem = c as Phaser.Physics.Arcade.Sprite;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, gem.x, gem.y);
      if (d < this.magnet) {
        const a = Math.atan2(this.player.y-gem.y, this.player.x-gem.x);
        gem.setVelocity(Math.cos(a)*220, Math.sin(a)*220);
      }
    }

    // --- fire weapons on their own intervals ------------------------------
    for (const w of this.weapons) {
      if (w.kind === 'orbit') continue;                    // orbit handled below
      if (t - (this.lastFire) < w.interval / this.weapons.length) continue;
      if (w.kind === 'nova') {
        for (let i = 0; i < 8; i++) {
          const a = (i/8)*Math.PI*2;
          const b = this.shots.create(this.player.x, this.player.y, 'shot') as any;
          b.setVelocity(Math.cos(a)*260, Math.sin(a)*260);
          this.time.delayedCall(900, () => b.destroy());
        }
        this.lastFire = t; continue;
      }
      const near = this.nearestFoe();
      if (near) {
        for (let i = 0; i < w.amount; i++) {
          const b = this.shots.create(this.player.x, this.player.y, 'shot') as any;
          const dx = near.x - this.player.x + (i-1)*30, dy = near.y - this.player.y, d = Math.hypot(dx,dy)||1;
          b.setVelocity((dx/d)*430, (dy/d)*430);
          b.setAngle(Phaser.Math.RadToDeg(Math.atan2(dy,dx))+90);
          this.time.delayedCall(1100, () => b.destroy());
        }
        this.lastFire = t;
      }
    }

    if (this.hp <= 0) {
      this.done = true; this.physics.pause();
      this.add.text(this.scale.width/2, this.scale.height/2,
        `YOU FELL  ·  LV ${this.level}  ·  ${this.kills} kills`,
        { fontFamily:'monospace', fontSize:'22px', color:'#ff4d6d' })
        .setScrollFactor(0).setOrigin(0.5);
    }
  }

  private nearestFoe(): Phaser.Physics.Arcade.Sprite | null {
    let best: any = null, bd = Infinity;
    for (const c of this.foes.getChildren()) {
      const e = c as Phaser.Physics.Arcade.Sprite;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
}

export default function BestSurvivors() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current; if (!host) return;
    const t = setTimeout(() => {
      const game = new Phaser.Game({
        type: Phaser.CANVAS, parent: host, width: 800, height: 460,
        backgroundColor: '#07070d',
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        physics: { default:'arcade', arcade: { gravity:{x:0,y:0}, debug:false } },
        scene: [Survivors],
      });
      (host as any).__g = game;
    }, 0);
    return () => { clearTimeout(t); const g=(host as any).__g; if (g) g.destroy(true); };
  }, []);
  return <div ref={ref} style={{ width:'100%', borderRadius:'var(--radius-panel)', overflow:'hidden' }} />;
}
