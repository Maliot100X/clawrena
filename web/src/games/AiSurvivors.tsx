'use client';
// Real survivors game with REAL Kenney CC0 sprites, driven by OUR AI brain.
// - Hero + zombies are real 1024px Kenney character sheets (sprites/hero.png,
//   zombie_a.png, zombie_c.png) from the Animated Characters Survivors pack.
// - The run is driven by the arena brain: we poll /api/arena/live/[id] for the
//   agent's steer and apply it to the player. When unbound, an autopilot plays.
import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';

type Steer = { dx: number; dy: number; say?: string };

class Game extends Phaser.Scene {
  private hero!: Phaser.Physics.Arcade.Sprite;
  private foes!: Phaser.Physics.Arcade.Group;
  private gems!: Phaser.Physics.Arcade.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private hp = 100; private xp = 0; private need = 5; private level = 1;
  private kills = 0; private elapsed = 0; private done = false;
  private hud!: Phaser.GameObjects.Text;
  private steer: Steer = { dx: 0, dy: 0 };
  private autopilot = true;

  constructor() { super('ai-surv'); }

  preload() {
    this.load.image('hero', '/game/sprites/hero.png');
    this.load.image('zombie', '/game/sprites/zombie_a.png');
    this.load.image('zombie2', '/game/sprites/zombie_c.png');
  }

  create() {
    const { width, height } = this.scale;
    this.physics.world.setBounds(0, 0, 3000, 2000);

    // hero uses the real character sheet, scaled down to game size
    this.hero = this.physics.add.sprite(width/2, height/2, 'hero')
      .setDisplaySize(48, 48).setCollideWorldBounds(true);

    this.foes = this.physics.add.group();
    const g = this.add.graphics();
    g.fillStyle(0x39ff88, 1).fillTriangle(8, 0, 16, 12, 0, 12);
    g.generateTexture('gem', 16, 16); g.destroy();
    this.gems = this.physics.add.group();

    this.physics.add.overlap(this.hero, this.gems, (_h, gem) => {
      (gem as any).destroy(); this.gainXp(1);
    });
    this.physics.add.overlap(this.hero, this.foes, (_h, f) => {
      const foe = f as Phaser.Physics.Arcade.Sprite;
      if (performance.now() > (this.hero.getData('inv') ?? 0)) {
        this.hp -= 5; this.hero.setData('inv', performance.now() + 700);
        this.hero.setTint(0xff4d6d);
        this.time.delayedCall(150, () => this.hero.clearTint());
        this.hud.setText(this.hudLine());
      }
      void foe;
    });

    this.cameras.main.setBounds(0, 0, 3000, 2000);
    this.cameras.main.startFollow(this.hero, true, 0.1, 0.1);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D') as any;

    this.time.addEvent({ delay: 800, loop: true, callback: () => {
      const n = 1 + Math.floor(this.elapsed / 25000);
      for (let i = 0; i < n; i++) this.spawn();
    }});

    this.hud = this.add.text(12, 10, '', {
      fontFamily:'monospace', fontSize:'15px', color:'#ebebf5' }).setScrollFactor(0);
    this.hud.setText(this.hudLine());

    // expose control to React (the AI steer)
    (this as any).setSteer = (s: Steer) => { this.steer = s; this.autopilot = false; };
  }

  private hudLine() {
    return `LV ${this.level}  XP ${this.xp}/${this.need}  HP ${Math.max(0,this.hp)}  KILLS ${this.kills}` +
           (this.autopilot ? '   [autopilot]' : '   [AI driving]');
  }

  private spawn() {
    const a = Math.random()*Math.PI*2, r = 460;
    const x = Phaser.Math.Clamp(this.hero.x + Math.cos(a)*r, 20, 2980);
    const y = Phaser.Math.Clamp(this.hero.y + Math.sin(a)*r, 20, 1980);
    const tough = this.elapsed > 25000 && Math.random() < 0.35;
    const f = this.foes.create(x, y, tough ? 'zombie2' : 'zombie')
      .setDisplaySize(tough ? 54 : 44, tough ? 54 : 44) as Phaser.Physics.Arcade.Sprite;
    f.setData('hp', tough ? 6 : 3);
  }

  private gainXp(n: number) {
    this.xp += n;
    if (this.xp >= this.need) { this.xp = 0; this.need = Math.floor(this.need*1.6); this.level++; }
    this.hud.setText(this.hudLine());
  }

  update(_t: number, dt: number) {
    if (this.done) return;
    this.elapsed += dt;

    // --- steer: AI if bound, else keyboard, else autopilot ---------------
    let dx = 0, dy = 0;
    if (this.cursors.left.isDown || this.keys.A.isDown) dx = -1;
    else if (this.cursors.right.isDown || this.keys.D.isDown) dx = 1;
    else if (this.cursors.up.isDown || this.keys.W.isDown) dy = -1;
    else if (this.cursors.down.isDown || this.keys.S.isDown) dy = 1;

    if (dx === 0 && dy === 0) {
      if (this.autopilot) {
        // simple autopilot: flee the nearest zombie, drift to gems otherwise
        const near = this.nearest();
        if (near) { dx = Math.sign(this.hero.x - near.x); dy = Math.sign(this.hero.y - near.y); }
        else { dx = Math.round(Math.sin(this.elapsed/900)); dy = Math.round(Math.cos(this.elapsed/1100)); }
      } else {
        dx = this.steer.dx; dy = this.steer.dy;
      }
    }
    this.hero.setVelocity(dx*210, dy*210);
    if (dx) this.hero.setFlipX(dx < 0);

    // zombies home in
    for (const c of this.foes.getChildren()) {
      const z = c as Phaser.Physics.Arcade.Sprite;
      if (!z.body) continue;
      const ddx = this.hero.x - z.x, ddy = this.hero.y - z.y, d = Math.hypot(ddx,ddy)||1;
      z.setVelocity((ddx/d)*58, (ddy/d)*58);
    }
    // gems magnet
    for (const c of this.gems.getChildren()) {
      const gem = c as Phaser.Physics.Arcade.Sprite;
      if (Phaser.Math.Distance.Between(this.hero.x, this.hero.y, gem.x, gem.y) < 130) {
        const a = Math.atan2(this.hero.y-gem.y, this.hero.x-gem.x);
        gem.setVelocity(Math.cos(a)*200, Math.sin(a)*200);
      }
    }
    // auto-attack nearby zombies
    for (const c of this.foes.getChildren()) {
      const z = c as Phaser.Physics.Arcade.Sprite;
      if (Phaser.Math.Distance.Between(this.hero.x, this.hero.y, z.x, z.y) < 70) {
        z.setData('hp', (z.getData('hp') ?? 2) - dt/140);
        if (z.getData('hp') <= 0) {
          this.gems.create(z.x, z.y, 'gem'); z.destroy(); this.kills++;
          this.hud.setText(this.hudLine());
        }
      }
    }
    if (this.hp <= 0) {
      this.done = true; this.physics.pause();
      this.add.text(this.scale.width/2, this.scale.height/2,
        `YOU FELL · LV ${this.level} · ${this.kills} kills`,
        { fontFamily:'monospace', fontSize:'20px', color:'#ff4d6d' })
        .setScrollFactor(0).setOrigin(0.5);
    }
  }

  private nearest(): Phaser.Physics.Arcade.Sprite | null {
    let best: any = null, bd = Infinity;
    for (const c of this.foes.getChildren()) {
      const z = c as Phaser.Physics.Arcade.Sprite;
      const d = Phaser.Math.Distance.Between(this.hero.x, this.hero.y, z.x, z.y);
      if (d < bd) { bd = d; best = z; }
    }
    return best;
  }
}

export default function AiSurvivors({ runId }: { runId?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any>(null);
  const [say, setSay] = useState('');

  useEffect(() => {
    const host = ref.current; if (!host) return;
    const t = setTimeout(() => {
      const game = new Phaser.Game({
        type: Phaser.CANVAS, parent: host, width: 800, height: 460,
        backgroundColor: '#0b0f14',
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        physics: { default:'arcade', arcade: { gravity:{x:0,y:0}, debug:false } },
        scene: [Game],
      });
      game.events.once('ready', () => { sceneRef.current = game.scene.getScene('ai-surv'); });
      (host as any).__g = game;
    }, 0);
    return () => { clearTimeout(t); const g=(host as any).__g; if (g) g.destroy(true); };
  }, []);

  // poll the arena for the agent's live steer and feed it to the game
  useEffect(() => {
    if (!runId) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/arena/live/${runId}`);
        const j = await r.json();
        if (j.steer && sceneRef.current?.setSteer) {
          sceneRef.current.setSteer(j.steer);
          if (j.say) setSay(j.say);
        }
      } catch {}
      if (!stop) setTimeout(tick, 700);
    };
    tick();
    return () => { stop = true; };
  }, [runId]);

  return (
    <div>
      <div ref={ref} style={{ width:'100%', borderRadius:'var(--radius-panel)', overflow:'hidden' }} />
      {say && (
        <div style={{ marginTop:8, fontFamily:'var(--font-term)', fontSize:13, color:'var(--color-sol-green)' }}>
          agent: {say}
        </div>
      )}
    </div>
  );
}
