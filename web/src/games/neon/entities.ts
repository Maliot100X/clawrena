// Neon Swarm — robots (enemies) and the player rig. Each is real three.js
// geometry (box bodies, emissive eyes, floating parts) so there is no asset
// dependency; tiers change shape/colour/size and stats.
import * as THREE from 'three';

export interface RobotSpec { name: string; color: number; hp: number; speed: number; dmg: number; shards: number; scale: number }

export const ROBOTS: RobotSpec[] = [
  { name: 'Drone',   color: 0xff3b6b, hp: 3,  speed: 3.4, dmg: 6,  shards: 1, scale: 1.0 },
  { name: 'Runner',  color: 0xffb020, hp: 2,  speed: 6.2, dmg: 5,  shards: 1, scale: 0.8 },
  { name: 'Brute',   color: 0x8a2be2, hp: 10, speed: 2.0, dmg: 14, shards: 3, scale: 1.6 },
  { name: 'Boss',    color: 0xffe066, hp: 40, speed: 1.6, dmg: 22, shards: 10, scale: 2.6 },
];

/** Build one robot mesh for a tier. */
export function makeRobot(tier: number): THREE.Group {
  const spec = ROBOTS[Math.min(tier, ROBOTS.length - 1)];
  const g = new THREE.Group();
  const s = spec.scale;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.1 * s, 0.9 * s, 1.1 * s),
    new THREE.MeshStandardMaterial({ color: 0x1a1020, metalness: 0.9, roughness: 0.25 }),
  );
  body.position.y = 0.8 * s;
  g.add(body);

  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(1.16 * s, 0.14 * s, 1.16 * s),
    new THREE.MeshStandardMaterial({ color: spec.color, emissive: spec.color, emissiveIntensity: 2.6 }),
  );
  trim.position.y = 1.15 * s;
  g.add(trim);

  // eyes
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: spec.color, emissiveIntensity: 3.4 });
  for (const ex of [-0.22, 0.22]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09 * s, 8, 8), eyeMat);
    eye.position.set(ex * s, 0.92 * s, 0.56 * s);
    g.add(eye);
  }
  // legs
  for (const lx of [-0.3, 0.3]) {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.16 * s, 0.5 * s, 0.16 * s),
      new THREE.MeshStandardMaterial({ color: 0x2a2033, metalness: 0.9, roughness: 0.3 }),
    );
    leg.position.set(lx * s, 0.25 * s, 0);
    g.add(leg);
  }
  // floating halo for bosses
  if (tier >= 3) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.4 * s, 0.09 * s, 8, 32),
      new THREE.MeshStandardMaterial({ color: spec.color, emissive: spec.color, emissiveIntensity: 2.2 }),
    );
    ring.rotation.x = Math.PI / 2; ring.position.y = 1.9 * s;
    g.add(ring);
  }
  return g;
}

/** The hero rig — a sleek neon runner. */
export function makeHero(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.42, 0.8, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0x0e1420, metalness: 0.85, roughness: 0.25 }),
  );
  body.position.y = 0.9;
  g.add(body);

  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.14, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x39ff88, emissive: 0x39ff88, emissiveIntensity: 3.2 }),
  );
  visor.position.set(0, 1.18, 0.36);
  g.add(visor);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 3.6 }),
  );
  core.position.set(0, 1.0, 0.42);
  g.add(core);

  const glow = new THREE.PointLight(0x39ff88, 2.2, 18);
  glow.position.set(0, 1.2, 0);
  g.add(glow);
  return g;
}
