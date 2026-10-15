// Neon Swarm — the 3D world: a neon cyberpunk arena.
// Built from threejs-scene-setup + threejs-materials-lighting: Scene + fog +
// grid floor + emissive neon pillars + rim lights. Pure geometry, no assets.
import * as THREE from 'three';

export function buildCity(scene: THREE.Scene): THREE.Object3D {
  // deep night, neon fog
  scene.background = new THREE.Color(0x05060c);
  scene.fog = new THREE.Fog(0x05060c, 60, 200);

  const city = new THREE.Group();

  // --- emissive grid floor -------------------------------------------------
  const floorGeo = new THREE.PlaneGeometry(400, 400, 80, 80);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0a0e18, emissive: 0x0a1a2a, emissiveIntensity: 0.6,
    metalness: 0.6, roughness: 0.4, wireframe: false,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  city.add(floor);

  const grid = new THREE.GridHelper(400, 80, 0x00e5ff, 0x0a2740);
  (grid.material as THREE.Material).opacity = 0.35;
  (grid.material as THREE.Material).transparent = true;
  grid.position.y = 0.02;
  city.add(grid);

  // --- neon pillars (the city) --------------------------------------------
  const neonColors = [0x00e5ff, 0xff2bd6, 0x8a2be2, 0x39ff88];
  for (let i = 0; i < 90; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 30 + Math.random() * 120;
    const h = 6 + Math.random() * 34;
    const w = 2 + Math.random() * 3;
    const col = neonColors[(Math.random() * neonColors.length) | 0];

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, w),
      new THREE.MeshStandardMaterial({ color: 0x0b0f18, metalness: 0.8, roughness: 0.3 }),
    );
    body.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    city.add(body);

    // neon edge ring near the top
    const ring = new THREE.Mesh(
      new THREE.BoxGeometry(w * 1.08, 0.35, w * 1.08),
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 2.4 }),
    );
    ring.position.set(body.position.x, h - 0.6, body.position.z);
    city.add(ring);
  }

  // --- lights --------------------------------------------------------------
  scene.add(new THREE.AmbientLight(0x223355, 1.1));
  const key = new THREE.DirectionalLight(0x9bd7ff, 1.4);
  key.position.set(30, 60, 20);
  scene.add(key);
  const magenta = new THREE.PointLight(0xff2bd6, 3.2, 120);
  magenta.position.set(-20, 12, -20);
  scene.add(magenta);
  const cyan = new THREE.PointLight(0x00e5ff, 3.2, 120);
  cyan.position.set(20, 12, 20);
  scene.add(cyan);

  scene.add(city);
  return city;
}
