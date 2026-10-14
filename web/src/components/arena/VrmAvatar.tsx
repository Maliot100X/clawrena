'use client';
// Live VRM avatar driven by REAL VRM Animation (.vrma) clips.
// The VRoid samples ship 0 built-in animations, so we load .vrma files
// (Relax/Thinking/Surprised/Angry/Clapping/Jump...) and cross-fade between
// them from the live game state. A procedural layer adds breathing + idle sway
// on top so it never looks frozen.
// The VRoid samples ship 54 humanoid bones and ZERO animation clips, so we drive
// the skeleton ourselves from a clock + the live game state: idle breathing,
// walk, talk, think, hit. This is what makes them look alive.
import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip,
         type VRMAnimation } from '@pixiv/three-vrm-animation';
import * as THREE from 'three';

export type AvatarMood = 'idle' | 'talk' | 'think' | 'walk' | 'hit';

// mood -> the .vrma clip that carries it
const CLIP: Record<AvatarMood, string> = {
  idle:  '/animations/Relax.vrma',
  talk:  '/animations/Clapping.vrma',
  think: '/animations/Thinking.vrma',
  walk:  '/animations/Jump.vrma',
  hit:   '/animations/Surprised.vrma',
};

function Model({ url, mood }: { url: string; mood: AvatarMood }) {
  const vrm = useRef<VRM | null>(null);
  const mixer = useRef(new THREE.AnimationMixer(new THREE.Object3D()));
  const actions = useRef<Partial<Record<AvatarMood, THREE.AnimationAction>>>({});
  const curMood = useRef<AvatarMood>('idle');
  const t = useRef(0);
  const { scene } = useThree();
  const bone = (n: string) => vrm.current?.humanoid?.getNormalizedBoneNode(n as any);

  useEffect(() => {
    const loader = new GLTFLoader();
    loader.register((p) => new VRMLoaderPlugin(p));
    let dead = false;
    loader.register((p) => new VRMAnimationLoaderPlugin(p));
    loader.load(url, (gltf) => {
      if (dead) return;
      const v = gltf.userData.vrm as VRM;
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.combineSkeletons(gltf.scene);
      if (v.meta?.metaVersion === '0') VRMUtils.rotateVRM0(v);   // face the camera
      v.scene.traverse((o) => { o.frustumCulled = false; });
      v.scene.position.set(0, 0, 0);
      vrm.current = v;
      scene.add(v.scene);

      // preload every clip so mood changes are instant
      const loader2 = new GLTFLoader();
      loader2.register((p) => new VRMAnimationLoaderPlugin(p));
      for (const [mood, path] of Object.entries(CLIP)) {
        loader2.load(path, (g) => {
          if (dead || !vrm.current) return;
          const anim = g.userData.vrmAnimations?.[0] as VRMAnimation | undefined;
          if (!anim) return;
          const clip = createVRMAnimationClip(anim, vrm.current);
          actions.current[mood as AvatarMood] = mixer.current.clipAction(clip);
        });
      }
    }, undefined, (e) => console.error('VRM load failed', e));
    return () => { dead = true; if (vrm.current) scene.remove(vrm.current.scene); };
  }, [url, scene]);

  // cross-fade when the mood changes
  useEffect(() => {
    const m = mixer.current;
    const next = actions.current[mood];
    if (!next) return;
    const prev = actions.current[curMood.current];
    next.reset().setEffectiveWeight(1).fadeIn(0.45).play();
    if (prev && prev !== next) prev.fadeOut(0.45);
    curMood.current = mood;
  }, [mood, actions.current[mood]]);

  useFrame((_, dt) => {
    const v = vrm.current; if (!v) return;
    mixer.current.update(dt);
    t.current += Math.min(dt, 0.05);
    const T = t.current;
    v.update(dt);

    // ---------- expressions ----------
    const ex = v.expressionManager;
    if (ex) {
      for (const n of ['happy','angry','sad','relaxed','surprised','aa','ih','ou','ee','oh','blink']) {
        try { ex.setValue(n, 0); } catch {}
      }
      if (mood === 'talk')  { try { ex.setValue('aa', 0.35 + Math.sin(T * 11) * 0.35); } catch {} }
      if (mood === 'hit')   { try { ex.setValue('surprised', 0.85); } catch {} }
      if (mood === 'walk')  { try { ex.setValue('happy', 0.5); } catch {} }
      // natural blink every few seconds (all moods)
      const blink = Math.sin(T * 0.9) > 0.985 ? 0.8 : 0;
      try { ex.setValue('blink', blink); } catch {}
    }

    // ---------- procedural skeleton motion ----------
    const breathe = Math.sin(T * 1.6) * 0.02;
    const sway    = Math.sin(T * 0.8);

    const hips = bone('hips');
    const spine = bone('spine');
    const chest = bone('chest');
    const neck = bone('neck');
    const head = bone('head');

    const lUpper = bone('leftUpperArm');
    const rUpper = bone('rightUpperArm');
    const lLower = bone('leftLowerArm');
    const rLower = bone('rightLowerArm');
    const lHand  = bone('leftHand');
    const rHand  = bone('rightHand');

    const lUpLeg = bone('leftUpperLeg');
    const rUpLeg = bone('rightUpperLeg');
    const lLower2 = bone('leftLowerLeg');
    const rLower2 = bone('rightLowerLeg');

    if (hips) {
      hips.position.y = (hips.userData.baseY ??= hips.position.y) + breathe * 0.5;
      hips.rotation.y = sway * 0.05;
      hips.rotation.z = mood === 'walk' ? Math.sin(T * 6) * 0.03 : 0;
    }
    if (spine) spine.rotation.x = -breathe * 0.5;
    if (chest) { chest.rotation.x = -breathe * 0.6; chest.rotation.y = sway * 0.04; }

    // head: tilt when thinking, bob when walking, slight look-around when idle
    if (neck) neck.rotation.x = mood === 'think' ? 0.12 : breathe * 0.3;
    if (head) {
      head.rotation.y = mood === 'think' ? Math.sin(T * 0.7) * 0.18 : Math.sin(T * 0.5) * 0.06;
      head.rotation.x = mood === 'think' ? 0.16 : mood === 'walk' ? Math.sin(T * 6) * 0.04 : 0;
      head.rotation.z = mood === 'think' ? 0.08 : 0;
    }

    // arms
    const armSwing = mood === 'walk' ? Math.sin(T * 6) * 0.55 : 0;
    const gesture  = mood === 'talk' ? Math.sin(T * 4.2) * 0.30 : 0;
    if (lUpper) { lUpper.rotation.z =  1.25 + (mood === 'idle' ? Math.sin(T*1.2)*0.04 : 0) + gesture; lUpper.rotation.x = armSwing; }
    if (rUpper) { rUpper.rotation.z = -1.25 - (mood === 'idle' ? Math.sin(T*1.2)*0.04 : 0) - gesture; rUpper.rotation.x = -armSwing; }
    if (lLower) lLower.rotation.z =  0.45 + gesture * 0.5;
    if (rLower) rLower.rotation.z = -0.45 - gesture * 0.5;
    if (lHand)  lHand.rotation.z  =  0.2 + (mood === 'talk' ? Math.sin(T*5)*0.2 : 0);
    if (rHand)  rHand.rotation.z  = -0.2 - (mood === 'talk' ? Math.sin(T*5)*0.2 : 0);

    // legs — walk cycle, else a relaxed stance
    const legSwing = mood === 'walk' ? Math.sin(T * 6) * 0.5 : 0;
    if (lUpLeg) lUpLeg.rotation.x = legSwing;
    if (rUpLeg) rUpLeg.rotation.x = -legSwing;
    if (lLower2) lLower2.rotation.x = mood === 'walk' ? Math.max(0, -Math.sin(T * 6)) * 0.7 : 0.02;
    if (rLower2) rLower2.rotation.x = mood === 'walk' ? Math.max(0,  Math.sin(T * 6)) * 0.7 : 0.02;

    // hit reaction: recoil
    if (mood === 'hit' && chest) { chest.rotation.x -= 0.25; if (head) head.rotation.x -= 0.2; }

    // whole-body turn toward the "action"
    v.scene.rotation.y = mood === 'walk' ? Math.sin(T * 3) * 0.25 : Math.sin(T * 0.6) * 0.06;
  });

  return null;
}

export default function VrmAvatar({ mood = 'idle', url = '/avatars/AvatarSample_A.vrm' }:
  { mood?: AvatarMood; url?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div style={{ width:'100%', height:'100%', position:'relative',
      background:'radial-gradient(20rem 14rem at 50% 30%, rgba(153,69,255,0.10), transparent 70%), #08080c' }}>
      {failed ? (
        <div style={{ display:'grid', placeItems:'center', height:'100%', color:'var(--color-muted)' }}>
          3D unavailable
        </div>
      ) : (
        <Canvas camera={{ position: [0, 1.3, 1.7], fov: 32 }}
          gl={{ alpha: true, antialias: true }}
          onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
          onError={() => setFailed(true)}>
          <ambientLight intensity={0.85} />
          <directionalLight position={[1, 2, 1.5]} intensity={1.2} />
          <directionalLight position={[-1.5, 1, -1]} intensity={0.45} color="#9945ff" />
          <Suspense fallback={null}>
            <Model url={url} mood={mood} />
          </Suspense>
          <OrbitControls target={[0, 1.15, 0]} enablePan={false}
            minDistance={0.9} maxDistance={3.2} maxPolarAngle={Math.PI / 1.9} />
        </Canvas>
      )}
      <div style={{ position:'absolute', left:10, bottom:10, fontSize:11,
        color:'var(--color-muted)', letterSpacing:'0.14em', textTransform:'uppercase' }}>
        avatar · {mood}
      </div>
    </div>
  );
}
