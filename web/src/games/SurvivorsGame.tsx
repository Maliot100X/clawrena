'use client';
// A real, playable Phaser 4 game: top-down survivor action.
// Built from the gamedev skills (phaser-core + phaser-arcade-physics):
// Scene lifecycle via init/preload/create/update, Arcade Physics world,
// sprite groups, colliders, and a real game loop with input.
import { useEffect, useRef } from 'react';
import Phaser from 'phaser';

class Play extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private enemies!: Phaser.Physics.Arcade.Group;
  private bullets!: Phaser.Physics.Arcade.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private hp = 100;
  private kills = 0;
  private lastShot = 0;
  private hud!: Phaser.GameObjects.Text;

  constructor() { super('play'); }

  create() {
    const { width, height } = this.scale;

    // --- player: a generated texture (no external asset needed) -------------
    const g = this.add.graphics();
    g.fillStyle(0x7c5cff, 1).fillCircle(16, 16, 14);
    g.fillStyle(0x39ff88, 1).fillCircle(16, 16, 6);
    g.generateTexture('hero', 32, 32);
    g.fillStyle(0xff4d6d, 1).fillCircle(12, 12, 10);
    g.generateTexture('foe', 24, 24);
    g.fillStyle(0xffe066, 1).fillRect(0, 6, 12, 4);
    g.generateTexture('shot', 12, 16);
    g.destroy();

    this.player = this.physics.add.sprite(width / 2, height / 2, 'hero');
    this.player.setCollideWorldBounds(true);

    this.enemies = this.physics.add.group();
    this.bullets = this.physics.add.group();

    // --- collisions ----------------------------------------------------------
    this.physics.add.overlap(this.bullets, this.enemies, (b, e) => {
      (b as Phaser.GameObjects.GameObject).destroy();
      (e as Phaser.GameObjects.GameObject).destroy();
      this.kills += 3;
      this.updateHud();
    });
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => {
      (e as Phaser.GameObjects.GameObject).destroy();
      this.hp -= 8;
      this.updateHud();
    });

    // --- input ---------------------------------------------------------------
    this.cursors = this.input.keyboard!.createCursorKeys();

    // --- spawner -------------------------------------------------------------
    this.time.addEvent({
      delay: 900, loop: true, callback: () => {
        const s = 24 + Math.random() * (width - 48);
        const t = 24 + Math.random() * (height - 48);
        const en = this.enemies.create(s, t, 'foe') as Phaser.Physics.Arcade.Sprite;
        en.setVelocity(0, 0);
      },
    });

    this.hud = this.add.text(10, 8, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ebebf5',
    });
    this.updateHud();
  }

  private updateHud() {
    this.hud.setText(
      `HP ${Math.max(0, this.hp)}   KILLS ${this.kills}   ENEMIES ${this.enemies.countActive(true)}`);
  }

  update(time: number, delta: number) {
    if (this.hp <= 0) return;

    const speed = 230;
    const v = new Phaser.Math.Vector2(0, 0);
    if (this.cursors.left.isDown) v.x = -1;
    if (this.cursors.right.isDown) v.x = 1;
    if (this.cursors.up.isDown) v.y = -1;
    if (this.cursors.down.isDown) v.y = 1;
    v.normalize().scale(speed);
    this.player.setVelocity(v.x, v.y);

    // enemies home in on the player
    for (const child of this.enemies.getChildren()) {
      const e = child as Phaser.Physics.Arcade.Sprite;
      if (!e || !e.body) continue;
      const dx = this.player.x - e.x, dy = this.player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.setVelocity((dx / d) * 55, (dy / d) * 55);
    }

    // auto-fire toward the nearest enemy
    if (time - this.lastShot > 350) {
      const nearest = this.nearestEnemy();
      if (nearest) {
        this.lastShot = time;
        const b = this.bullets.create(this.player.x, this.player.y, 'shot') as Phaser.Physics.Arcade.Sprite;
        const dx = nearest.x - this.player.x, dy = nearest.y - this.player.y;
        const d = Math.hypot(dx, dy) || 1;
        b.setVelocity((dx / d) * 420, (dy / d) * 420);
        b.setAngle(Phaser.Math.RadToDeg(Math.atan2(dy, dx)) + 90);
        this.time.delayedCall(1200, () => b.destroy());
      }
    }

    if (this.hp <= 0) {
      this.add.text(this.scale.width / 2 - 60, this.scale.height / 2, 'YOU FELL', {
        fontFamily: 'monospace', fontSize: '22px', color: '#ff4d6d',
      });
      this.physics.pause();
    }
  }

  private nearestEnemy(): Phaser.Physics.Arcade.Sprite | null {
    let best: Phaser.Physics.Arcade.Sprite | null = null;
    let bd = Infinity;
    for (const child of this.enemies.getChildren()) {
      const e = child as Phaser.Physics.Arcade.Sprite;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
}

export default function SurvivorsGame() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const host = ref.current;
    // defer one tick so the container has layout before Phaser measures it
    const t = setTimeout(() => {
    if (!host) return;
    const game = new Phaser.Game({
      type: Phaser.CANVAS,
      parent: host,
      width: 800,
      height: 460,
      backgroundColor: '#0a0a0f',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
      scene: [Play],
    });
    (host as any).__game = game;
    }, 0);
    return () => { clearTimeout(t); const g=(host as any).__game; if (g) g.destroy(true); };
  }, []);
  return <div ref={ref} style={{ width: '100%', borderRadius: 'var(--radius-panel)', overflow: 'hidden' }} />;
}
