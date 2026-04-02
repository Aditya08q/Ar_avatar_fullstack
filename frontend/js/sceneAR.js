/**
 * sceneAR.js — 
 */

import * as THREE from 'three';
import { GLTFLoader }              from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { OrbitControls }           from 'three/addons/controls/OrbitControls.js';
import {
  setVRM as setVRMAVRM,
  loadAllAnimations,
  playAnimation,
  stopAnimation,
  toggleAnimation,
  startCyclicAnimation,
  stopCyclicAnimation,
  playSequence,
  updateVRMA,
  getCurrentAnimation,
  isPlaying
} from './vrmaPlayer.js';

/* State */
let scene, camera, renderer, clock, controls;
let currentVRM       = null;
let placeholderGroup = null;
let lipSyncCb        = null;

/*  Blink */
let blinkTimer    = 0;
let blinkCooldown = randomBlinkDelay();
let isBlinking    = false;

/*  Expression */
let currentExpression = 'neutral';
let targetExpression  = 'neutral';
let expressionBlend   = 0;
const EXPRESSION_SPEED = 3.0;

/*  Breathing */
let breathPhase = 0;

/*  Mouse  */
let mouseX = 0;
let mouseY = 0;

/*  AR  */
let arStream  = null;
let arTexture = null;

/* 
   SCENE INIT
*/

export function initScene(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a12);

  camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.4, 4.0);
  camera.lookAt(0, 1.0, 0);

  clock = new THREE.Clock();

  setupLighting();

  // Grid floor
  const grid = new THREE.GridHelper(10, 20, 0x1e1e3a, 0x111128);
  grid.position.y = -0.01;
  scene.add(grid);

  // Orbit controls
  controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1.0, 0);
  controls.enableDamping  = true;
  controls.dampingFactor  = 0.08;
  controls.minDistance    = 1.5;
  controls.maxDistance    = 8.0;
  controls.minPolarAngle  = 0.2;
  controls.maxPolarAngle  = Math.PI / 2 + 0.2;
  controls.enablePan      = false;
  controls.rotateSpeed    = 0.7;
  controls.touches        = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };

  // Mouse tracking
  window.addEventListener('mousemove', e => {
    mouseX = (e.clientX / window.innerWidth  - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  });
  window.addEventListener('touchmove', e => {
    mouseX = (e.touches[0].clientX / window.innerWidth  - 0.5) * 2;
    mouseY = (e.touches[0].clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  renderer.setAnimationLoop(renderLoop);
  return { scene, camera, renderer };
}

function setupLighting() {
  scene.add(new THREE.AmbientLight(0x8080c0, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(1, 3, 2); scene.add(key);
  const fill = new THREE.DirectionalLight(0x8090ff, 0.5); fill.position.set(-2, 1, 1); scene.add(fill);
  const rim  = new THREE.DirectionalLight(0x22d3ee, 0.4); rim.position.set(0, 2, -3); scene.add(rim);
  scene.add(new THREE.PointLight(0x6366f1, 0.3, 4));
}

/* 
   VRM LOADING
 */

export async function loadVRM(url, onProgress) {
  const loader = new GLTFLoader();
  loader.register(parser => new VRMLoaderPlugin(parser));

  return new Promise((resolve, reject) => {
    loader.load(url, (gltf) => {
      const vrm = gltf.userData.vrm;
      if (!vrm) { reject(new Error('Not a VRM file')); return; }

      VRMUtils.combineSkeletons(gltf.scene);
      VRMUtils.rotateVRM0(vrm);

      vrm.scene.position.set(0, -0.1, 0);
      vrm.scene.scale.setScalar(1);

      if (currentVRM) scene.remove(currentVRM.scene);
      scene.add(vrm.scene);
      currentVRM = vrm;

      applyIdlePose(vrm);

      // Connect VRMA player
      window.__vrm = vrm;
      setVRMAVRM(vrm);
      loadAllAnimations([
        { name: 'jump',     url: 'models/Jump.vrma'     },
        { name: 'relax',    url: 'models/Relax.vrma'    },
        { name: 'clapping', url: 'models/Clapping.vrma' },
      ]).then(loaded => {
        console.log('[VRMA] All loaded:', loaded);
        window.__vrmaReady = true;
      });

      console.log('[Avatar] VRM0 loaded ✅');
      resolve(vrm);
    },
    p => { if (onProgress) onProgress(Math.round((p.loaded / (p.total || 1)) * 100)); },
    reject);
  });
}

function applyIdlePose(vrm) {
  if (!vrm.humanoid) return;
  function rot(name, x, y, z) {
    const b = vrm.humanoid.getNormalizedBoneNode(name);
    if (b) b.rotation.set(x, y, z);
  }
  rot('leftUpperArm',  0, 0, -1.4);
  rot('rightUpperArm', 0, 0,  1.4);
  rot('leftLowerArm',  0.2, 0, -0.1);
  rot('rightLowerArm', 0.2, 0,  0.1);
  rot('leftHand',      0, 0, -0.05);
  rot('rightHand',     0, 0,  0.05);
  rot('leftUpperLeg',  0.05, 0,  0.02);
  rot('rightUpperLeg', 0.05, 0, -0.02);
  rot('leftLowerLeg',  -0.05, 0, 0);
  rot('rightLowerLeg', -0.05, 0, 0);
  rot('spine',         -0.02, 0, 0);
  rot('chest',         -0.01, 0, 0);
  rot('head',           0, 0, 0);
  rot('neck',           0, 0, 0);
  console.log('[Avatar] Idle pose applied ✅');
}

/*
   PLACEHOLDER AVATAR
*/

export function loadPlaceholderAvatar() {
  const group   = new THREE.Group();
  const matSkin = new THREE.MeshStandardMaterial({ color: 0x6366f1, roughness: 0.4 });
  const matDark = new THREE.MeshStandardMaterial({ color: 0x1e1e3a, roughness: 0.6 });
  const matGlow = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 0.5 });

  const head  = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 20), matSkin); head.position.set(0, 1.65, 0);
  const eyeL  = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 10), matGlow); eyeL.position.set(-0.08, 1.67, 0.19);
  const eyeR  = eyeL.clone(); eyeR.position.x = 0.08;
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), new THREE.MeshStandardMaterial({ color: 0x1a1a2e }));
  mouth.position.set(0, 1.60, 0.20); mouth.scale.set(1.5, 0.3, 1);
  const neck  = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.15), matSkin); neck.position.set(0, 1.42, 0);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.22), matDark); torso.position.set(0, 1.1, 0);
  const armL  = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.5), matSkin); armL.position.set(-0.28, 1.05, 0); armL.rotation.z = 0.25;
  const armR  = armL.clone(); armR.position.x = 0.28; armR.rotation.z = -0.25;
  const legL  = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.55), matDark); legL.position.set(-0.1, 0.6, 0);
  const legR  = legL.clone(); legR.position.x = 0.1;
  const ring  = new THREE.Mesh(
    new THREE.TorusGeometry(0.35, 0.008, 8, 60),
    new THREE.MeshStandardMaterial({ color: 0x6366f1, emissive: 0x6366f1, emissiveIntensity: 1, transparent: true, opacity: 0.6 })
  );
  ring.position.set(0, 1.65, 0); ring.rotation.x = Math.PI / 2;

  group.add(head, eyeL, eyeR, mouth, neck, torso, armL, armR, legL, legR, ring);
  group.userData    = { head, eyeL, eyeR, mouth, ring, armL, armR, torso };
  group.position.y  = -0.1;
  scene.add(group);
  placeholderGroup  = group;
  currentVRM        = null;
  return group;
}

/* 
   EXPRESSION CONTROL
*/

export function setExpression(name) { targetExpression = name; expressionBlend = 0; }
export function triggerExpression(name, duration = 3000) {
  setExpression(name);
  if (duration > 0) setTimeout(() => setExpression('neutral'), duration);
}
export function setLipSyncCallback(cb) { lipSyncCb = cb; }
export function setPlaceholderRef(g)   { placeholderGroup = g; }

/*
   ANIMATION EXPORTS
  */

export function playAnim(name, loop = true)  { return playAnimation(name, loop); }
export function stopAnim()                   { stopAnimation(); }
export function toggleAnim(name)             { return toggleAnimation(name); }
export function startCyclicAnim(name, pauseMs = 60000) { return startCyclicAnimation(name, pauseMs); }
export function stopCyclicAnim()             { stopCyclicAnimation(); }
export function playAnimSequence(names)      { playSequence(names); }
export function currentAnim()                { return getCurrentAnimation(); }
export function isAnimPlaying(name)          { return isPlaying(name); }

/* 
   RENDER LOOP
 */

function renderLoop() {
  const delta = clock.getDelta();
  const time  = clock.getElapsedTime();

  controls?.update();
  updateVRMA(delta);

  if (currentVRM)            animateVRM(delta, time);
  else if (placeholderGroup) animatePlaceholder(placeholderGroup, time, delta);

  renderer.render(scene, camera);
}

/*
   VRM IDLE ANIMATION
*/

function animateVRM(delta, time) {
  const em = currentVRM.expressionManager;
  const h  = currentVRM.humanoid;

  // Expression transition
  if (em && currentExpression !== targetExpression) {
    expressionBlend += delta * EXPRESSION_SPEED;
    ['happy','sad','angry','surprised','relaxed','neutral'].forEach(e => em.setValue(e, 0));
    if (targetExpression !== 'neutral') em.setValue(targetExpression, Math.min(expressionBlend, 1) * 0.85);
    if (expressionBlend >= 1) { currentExpression = targetExpression; expressionBlend = 0; }
  }

  // Blink
  blinkTimer += delta;
  if (!isBlinking && blinkTimer > blinkCooldown) {
    blinkTimer    = 0;
    blinkCooldown = randomBlinkDelay();
    doBlinkVRM(em);
  }

  // Lip sync
  if (em) {
    const lv = lipSyncCb ? lipSyncCb() : 0;
    em.setValue('aa', lv > 0 ? Math.max(0, Math.min(1, lv * (0.5 + Math.sin(time * 18) * 0.4))) : 0);
  }

  // Head follows mouse
  if (h) {
    const headBone = h.getNormalizedBoneNode('head');
    if (headBone) {
      headBone.rotation.y = THREE.MathUtils.lerp(headBone.rotation.y, mouseX * 0.18, delta * 2.5);
      headBone.rotation.x = THREE.MathUtils.lerp(headBone.rotation.x, -mouseY * 0.08 + Math.sin(time * 0.4) * 0.015, delta * 2.5);
    }

    // Breathing
    breathPhase += delta * 0.9;
    const chest = h.getNormalizedBoneNode('chest');
    if (chest) chest.rotation.x = -0.01 + Math.sin(breathPhase) * 0.008;
  }

  currentVRM.update(delta);
}

async function doBlinkVRM(em) {
  if (!em || isBlinking) return;
  isBlinking = true;
  for (let i = 0; i <= 5; i++) { em.setValue('blinkLeft', i/5); em.setValue('blinkRight', i/5); await delay(14); }
  await delay(55);
  for (let i = 5; i >= 0; i--) { em.setValue('blinkLeft', i/5); em.setValue('blinkRight', i/5); await delay(14); }
  isBlinking = false;
}

/*
   PLACEHOLDER ANIMATION
 */

function animatePlaceholder(g, time, delta) {
  const { head, eyeL, eyeR, mouth, ring, armL, armR, torso } = g.userData;

  g.position.y = -0.1 + Math.sin(time * 0.8) * 0.025;
  if (head)  { head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, mouseX * 0.25, delta * 3); head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, -mouseY * 0.1, delta * 3); }
  if (ring)  ring.rotation.z = time * 0.5;
  if (torso) torso.scale.y   = 1 + Math.sin(time * 1.2) * 0.012;
  if (armL)  armL.rotation.z = THREE.MathUtils.lerp(armL.rotation.z,  0.25 + Math.sin(time * 0.5) * 0.04, delta * 3);
  if (armR)  armR.rotation.z = THREE.MathUtils.lerp(armR.rotation.z, -0.25 - Math.sin(time * 0.5) * 0.04, delta * 3);

  blinkTimer += delta;
  if (!isBlinking && blinkTimer > blinkCooldown) { blinkTimer = 0; blinkCooldown = randomBlinkDelay(); doBlinkPlaceholder(eyeL, eyeR); }

  if (mouth && lipSyncCb) {
    const v = lipSyncCb();
    mouth.scale.y = THREE.MathUtils.lerp(mouth.scale.y, v > 0 ? 0.3 + v * (0.5 + Math.sin(time * 20) * 0.3) : 0.3, delta * 12);
  }
}

async function doBlinkPlaceholder(eyeL, eyeR) {
  if (!eyeL || isBlinking) return;
  isBlinking = true;
  for (let i = 0; i <= 5; i++) { eyeL.scale.y = eyeR.scale.y = 1 - (i/5) * 0.9; await delay(14); }
  await delay(55);
  for (let i = 5; i >= 0; i--) { eyeL.scale.y = eyeR.scale.y = 1 - (i/5) * 0.9; await delay(14); }
  isBlinking = false;
}

/* 
   AR CAMERA
   */

export async function enableARCamera() {
  if (arStream) return true;
  try {
    arStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: 1280, height: 720 } });
    const video = document.createElement('video');
    video.srcObject = arStream; video.autoplay = true; video.muted = true; video.playsInline = true;
    await new Promise(res => video.onloadedmetadata = res);
    video.play();
    arTexture = new THREE.VideoTexture(video);
    arTexture.colorSpace = THREE.SRGBColorSpace;
    scene.background = arTexture;
    return true;
  } catch (e) { console.warn('[AR]', e); return false; }
}

export function disableARCamera() {
  if (arStream) { arStream.getTracks().forEach(t => t.stop()); arStream = null; }
  scene.background = new THREE.Color(0x0a0a12);
}

/*  Helpers */
function randomBlinkDelay() { return 2.5 + Math.random() * 3.5; }
function delay(ms)          { return new Promise(r => setTimeout(r, ms)); }
