'use client';
// ONE real game on PixiJS v8 (per the pixijs-rendering skill):
// async Application.init, Assets.load, Container scene graph, ticker loop.
// Real Kenney CC0 sprites. Driven live by OUR LLM: the component polls the
// arena for the agent's steer and applies it to the hero.
import { useEffect, useRef, useState } from 'react';
import { Application, Container, Sprite, Texture, Graphics, Text, TextStyle } from 'pixi.js';

type Entity = { s: Sprite; hp: number; tier: number; vx: number; vy: number };
type Steer = { dx: number; dy: number; say?: string };

export default function PixiSurvivors({ runId }: { runId?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [say, setSay] = useState('');
  const [driving, setDriving] = useState(false);
  const steerRef = useRef<Steer>({ dx: 0, dy: 0 });

  useEffect(() => {
    const el = host.current; if (!el) return;
    let destroyed = false;
    const app = new Application();
    let cleanups: (() => void)[] = [];

    (async () => {
      await app.init({ background: '#0b0f14', resizeTo: el, antialias: true, width: 800, height: 460 });
      if (destroyed) { app.destroy(true); return; }
      el.appendChild(app.canvas);   // v8: app.canvas, not app.view

      const [heroTex, zTex, z2Tex] = await Promise.all([
        Texture.from('/game/sprites/hero.png'),
        Texture.from('/game/sprites/zombie_a.png'),
        Texture.from('/game/sprites/zombie_c.png'),
      ]);

      const world = new Container();
      app.stage.addChild(world);

      const hero = new Sprite(heroTex);
      hero.anchor.set(0.5); hero.width = 48; hero.height = 48;
      hero.x = app.screen.width/2; hero.y = app.screen.height/2;
      world.addChild(hero);

      // HUD text
      const hud = new Text({ text: '', style: new TextStyle({ fontFamily:'monospace', fontSize:15, fill:0xebebf5 }) });
      hud.x = 12; hud.y = 10;
      app.stage.addChild(hud);

      const foes: Entity[] = [];
      const gems: Sprite[] = [];
      const gemTex = (() => { const g = new Graphics().poly([0,-8, 8,8, -8,8]).fill(0x39ff88); return app.renderer.generateTexture(g); })();

      let hp = 100, xp = 0, need = 5, level = 1, kills = 0, elapsed = 0, autopilot = true;

      const spawn = () => {
        const a = Math.random()*Math.PI*2, r = 380;
        const z: Entity = {
          s: new Sprite(Math.random()<0.3 ? z2Tex : zTex),
          hp: Math.random()<0.3 ? 6 : 3, tier: Math.random()<0.3 ? 2 : 1,
          vx:0, vy:0,
        };
        z.s.anchor.set(0.5); z.s.width = z.tier===2?54:44; z.s.height = z.tier===2?54:44;
        z.s.x = Math.max(20, Math.min(780, hero.x + Math.cos(a)*r));
        z.s.y = Math.max(20, Math.min(440, hero.y + Math.sin(a)*r));
        world.addChild(z.s); foes.push(z);
      };
      for (let i=0;i<4;i++) spawn();
      let spawnAcc = 0;

      const tick = () => {
        const dt = app.ticker.deltaMS; elapsed += dt;
        const dx = autopilot
          ? Math.round(Math.sin(elapsed/900))
          : steerRef.current.dx;
        const dy = autopilot
          ? Math.round(Math.cos(elapsed/1100))
          : steerRef.current.dy;
        hero.x = Math.max(24, Math.min(776, hero.x + dx*2.2));
        hero.y = Math.max(24, Math.min(436, hero.y + dy*2.2));
        hero.scale.x = dx < 0 ? -Math.abs(hero.scale.x) : Math.abs(hero.scale.x);

        // zombies chase
        for (const z of foes) {
          const ax = hero.x - z.s.x, ay = hero.y - z.s.y, d = Math.hypot(ax,ay)||1;
          z.s.x += (ax/d)*0.9; z.s.y += (ay/d)*0.9;
          if (Math.abs(z.s.x-hero.x)<26 && Math.abs(z.s.y-hero.y)<26) hp -= 0.06;
          // attack
          z.hp -= 0.02;
        }
        // kills -> gems
        for (let i=foes.length-1;i>=0;i--) {
          if (foes[i].hp<=0) {
            const g = new Sprite(gemTex); g.x=foes[i].s.x; g.y=foes[i].s.y;
            world.addChild(g); gems.push(g);
            foes[i].s.destroy(); foes.splice(i,1); kills++;
          }
        }
        // gems magnet
        for (let i=gems.length-1;i>=0;i--) {
          const g=gems[i];
          const d=Math.hypot(hero.x-g.x,hero.y-g.y);
          if (d<120){ g.x += (hero.x-g.x)/d*1.6; g.y += (hero.y-g.y)/d*1.6; }
          if (d<20){ g.destroy(); gems.splice(i,1); xp++;
            if (xp>=need){ xp=0; need=Math.floor(need*1.6); level++; hp=Math.min(100,hp+20); } }
        }
        // spawn waves
        spawnAcc += dt;
        if (spawnAcc > 900) { spawnAcc=0; spawn(); if (elapsed>20000) spawn(); }

        hud.text = `LV ${level}  XP ${xp}/${need}  HP ${Math.max(0,Math.round(hp))}  KILLS ${kills}  ` +
                   (autopilot ? '[autopilot]' : '[AI driving]');
        if (hp<=0){ hud.text = `YOU FELL · LV ${level} · ${kills} kills`; app.ticker.stop(); }
      };
      app.ticker.add(tick);
      cleanups.push(() => app.ticker.remove(tick));
    })();

    return () => { destroyed = true; cleanups.forEach(f=>f()); try { app.destroy(true); } catch {} };
  }, []);

  // poll the arena for the agent's steer
  useEffect(() => {
    if (!runId) return;
    let stop = false;
    const poll = async () => {
      try {
        const r = await fetch(`/api/arena/live/${runId}`);
        const j = await r.json();
        if (j.steer) {
          steerRef.current = j.steer;
          setDriving(true);
          if (j.say) setSay(j.say);
          (window as any).__steerOn = true;
        }
      } catch {}
      if (!stop) setTimeout(poll, 700);
    };
    poll();
    return () => { stop = true; };
  }, [runId]);

  return (
    <div>
      <div ref={host} style={{ width:'100%', borderRadius:'var(--radius-panel)', overflow:'hidden' }} />
      {say && <div style={{ marginTop:8, fontFamily:'var(--font-term)', fontSize:13, color:'var(--color-sol-green)' }}>
        agent: {say}</div>}
    </div>
  );
}
