'use client';
// VRM avatar with idle/talk/think/walk expressions — mirrors the reference's
// animation set (idle, talk, think, walk, gestures) using the MIT three-vrm sample.
import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import * as THREE from 'three';

export type AvatarMood = 'idle' | 'talk' | 'think' | 'walk' | 'hit';

function Model({ url, mood }: { url: string; mood: AvatarMood }) {
  const vrm = useRef<VRM | null>(null);
  const t = useRef(0);
  const { scene } = useThree();

  useEffect(() => {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    let dead = false;
    loader.load(url, (gltf) => {
      if (dead) return;
      const v = gltf.userData.vrm as VRM;
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.combineSkeletons(gltf.scene);
      v.scene.traverse((o) => { o.frustumCulled = false; });
      v.scene.position.set(0, 0, 0);
      vrm.current = v;
      scene.add(v.scene);
    }, undefined, (e) => console.error('VRM load failed', e));
    return () => { dead = true; if (vrm.current) scene.remove(vrm.current.scene); };
  }, [url, scene]);

  useFrame((_, dt) => {
    const v = vrm.current;
    if (!v) return;
    t.current += dt;
    v.update(dt);

    const ex = v.expressionManager;
    if (!ex) return;
    // decay all, then drive the active mood
    for (const name of ['happy','angry','sad','relaxed','surprised','aa','ih','ou','ee','oh','blink']) {
      try { ex.setValue(name, 0); } catch {}
    }
    if (mood === 'talk')  { try { ex.setValue('aa', 0.4 + Math.sin(t.current*9)*0.35); } catch {} }
    if (mood === 'think') { try { ex.setValue('blink', 0.25); } catch {} }
    if (mood === 'hit')   { try { ex.setValue('surprised', 0.8); } catch {} }
    if (mood === 'walk')  { try { ex.setValue('happy', 0.6); } catch {} }

    // idle sway
    v.scene.rotation.y = Math.sin(t.current * (mood === 'walk' ? 3 : 0.7)) * (mood === 'walk' ? 0.35 : 0.08);
    const head = v.humanoid?.getNormalizedBoneNode('head');
    if (head) head.rotation.x = mood === 'think' ? 0.18 : Math.sin(t.current*1.2)*0.03;
  });

  return null;
}

export default function VrmAvatar({ mood = 'idle', url = '/avatars/sample.vrm' }: { mood?: AvatarMood; url?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'linear-gradient(160deg,#0b0b11,#121218)' }}>
      {failed ? (
        <div style={{ display:'grid', placeItems:'center', height:'100%', color:'var(--color-muted)' }}>
          3D unavailable
        </div>
      ) : (
        <Canvas camera={{ position: [0, 1.35, 1.6], fov: 32 }}
          onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
          onError={() => setFailed(true)}>
          <ambientLight intensity={0.9} />
          <directionalLight position={[1, 2, 1.5]} intensity={1.1} />
          <directionalLight position={[-1.5, 1, -1]} intensity={0.4} color="#9945ff" />
          <Suspense fallback={null}>
            <Model url={url} mood={mood} />
            <Environment preset="studio" />
          </Suspense>
          <OrbitControls target={[0, 1.25, 0]} enablePan={false}
            minDistance={0.9} maxDistance={3} maxPolarAngle={Math.PI/1.9} />
        </Canvas>
      )}
      <div style={{ position:'absolute', left: 10, bottom: 10, fontSize: 11,
        color:'var(--color-muted)', letterSpacing: 1, textTransform:'uppercase' }}>
        avatar · {mood}
      </div>
    </div>
  );
}
