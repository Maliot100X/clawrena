'use client';
// Real Phaser 4 game #2: brick-breaker arcade. Different genre, same engine
// discipline (phaser-core + phaser-arcade-physics): physics world with bounce,
// collider callbacks, score/lives, win + lose states.
import { useEffect, useRef } from 'react';
import Phaser from 'phaser';

class Breaker extends Phaser.Scene {
  private paddle!: Phaser.Physics.Arcade.Sprite;
  private ball!: Phaser.Physics.Arcade.Sprite;
  private bricks!: Phaser.Physics.Arcade.StaticGroup;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private score = 0;
  private lives = 3;
  private hud!: Phaser.GameObjects.Text;
  private done = false;

  constructor() { super('breaker'); }

  create() {
    const { width, height } = this.scale;
    const g = this.add.graphics();
    g.fillStyle(0x39ff88, 1).fillRoundedRect(0, 0, 90, 14, 7);   g.generateTexture('paddle', 90, 14);
    g.fillStyle(0xffe066, 1).fillCircle(8, 8, 8);                g.generateTexture('ball', 16, 16);
    g.fillStyle(0xff4d6d, 1).fillRoundedRect(0, 0, 64, 20, 5);   g.generateTexture('brick', 64, 20);
    g.destroy();

    this.paddle = this.physics.add.sprite(width/2, height-26, 'paddle').setImmovable(true).setPushable(false);
    this.ball = this.physics.add.sprite(width/2, height-52, 'ball');
    this.ball.setBounce(1, 1).setCollideWorldBounds(true).setVelocity(180, -220);

    this.bricks = this.physics.add.staticGroup();
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 10; c++)
        this.bricks.create(60 + c*68, 70 + r*30, 'brick');

    this.physics.add.collider(this.ball, this.paddle);
    this.physics.add.collider(this.ball, this.bricks, (b, br) => {
      (br as Phaser.GameObjects.GameObject).destroy();
      this.score += 10; this.updateHud();
    });
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.hud = this.add.text(10, 8, '', { fontFamily:'monospace', fontSize:'14px', color:'#ebebf5' });
    this.updateHud();
  }

  private updateHud() {
    this.hud.setText(`SCORE ${this.score}   LIVES ${this.lives}   BRICKS ${this.bricks.countActive(true)}`);
  }

  update() {
    if (this.done) return;
    const vx = this.ball.body!.velocity.x;
    if (this.cursors.left.isDown) this.paddle.setVelocityX(-320);
    else if (this.cursors.right.isDown) this.paddle.setVelocityX(320);
    else this.paddle.setVelocityX(0);

    if (this.ball.y > this.scale.height - 12) {
      this.lives -= 1; this.updateHud();
      if (this.lives <= 0) { this.end('GAME OVER'); return; }
      this.ball.setPosition(this.scale.width/2, this.scale.height-52).setVelocity(180, -220);
    }
    if (this.bricks.countActive(true) === 0) this.end('CLEARED');
    void vx;
  }

  private end(msg: string) {
    this.done = true;
    this.physics.pause();
    this.add.text(this.scale.width/2-70, this.scale.height/2, msg,
      { fontFamily:'monospace', fontSize:'24px', color:'#39ff88' });
  }
}

export default function ArcadeGame() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current; if (!host) return;
    const t = setTimeout(() => {
      const game = new Phaser.Game({
        type: Phaser.CANVAS, parent: host, width: 800, height: 460,
        backgroundColor: '#0a0a0f',
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        physics: { default:'arcade', arcade: { gravity:{x:0,y:0}, debug:false } },
        scene: [Breaker],
      });
      (host as any).__g = game;
    }, 0);
    return () => { clearTimeout(t); const g=(host as any).__g; if (g) g.destroy(true); };
  }, []);
  return <div ref={ref} style={{ width:'100%', borderRadius:'var(--radius-panel)', overflow:'hidden' }} />;
}
