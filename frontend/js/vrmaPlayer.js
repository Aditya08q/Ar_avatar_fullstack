/**
 * vrmaPlayer.js
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';


let vrm           = null;
let mixer         = null;
let currentAction = null;
let currentName   = null;
const actions     = {};
const clips       = {};
const BLEND_TIME  = 0.4;

export function setVRM(v) {
  vrm   = v;
  mixer = new THREE.AnimationMixer(v.scene);
  console.log('[VRMA] Mixer ready');
}

export async function loadVRMA(name, url) {
  if (!vrm) { console.warn('[VRMA] setVRM() first'); return false; }

  const loader = new GLTFLoader();
  loader.register(parser => new VRMAnimationLoaderPlugin(parser));

  return new Promise((resolve) => {
    loader.load(url,
      (gltf) => {
        const vrmAnimations = gltf.userData.vrmAnimations;

        if (!vrmAnimations || vrmAnimations.length === 0) {
          console.warn(`[VRMA] No VRM animations in "${name}" — trying raw clips`);
          // Fallback: try raw gltf.animations
          if (gltf.animations?.length > 0) {
            const clip    = gltf.animations[0];
            clips[name]   = clip;
            actions[name] = mixer.clipAction(clip);
            actions[name].setLoop(THREE.LoopRepeat, Infinity);
            console.log(`[VRMA] Loaded "${name}" (raw) — ${clip.duration.toFixed(2)}s`);
            resolve(true);
          } else {
            resolve(false);
          }
          return;
        }

        const clip    = createVRMAnimationClip(vrmAnimations[0], vrm);
        clips[name]   = clip;
        actions[name] = mixer.clipAction(clip);
        actions[name].setLoop(THREE.LoopRepeat, Infinity);

        console.log(`[VRMA] Loaded "${name}" — ${clip.duration.toFixed(2)}s`);
        resolve(true);
      },
      (p) => {
        if (p.total > 0) console.log(`[VRMA] "${name}" ${Math.round(p.loaded/p.total*100)}%`);
      },
      (err) => {
        console.warn(`[VRMA] Failed "${name}":`, err.message || err);
        resolve(false);
      }
    );
  });
}

export async function loadAllAnimations(animList) {
  for (const { name, url } of animList) {
    await loadVRMA(name, url);
  }
  const loaded = Object.keys(clips);
  console.log('[VRMA] All ready:', loaded.join(', ') || 'none');
  return loaded;
}


export function playAnimation(name, loop = true) {
  const action = actions[name];
  if (!action) { console.warn(`[VRMA] "${name}" not loaded`); return false; }
  if (currentName === name) return true;

  action.reset();
  action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
  action.clampWhenFinished = !loop;

  if (currentAction) {
    currentAction.crossFadeTo(action, BLEND_TIME, true);
  }
  action.play();

  currentAction = action;
  currentName   = name;
  console.log(`[VRMA] ▶ ${name}`);
  return true;
}


export function stopAnimation(fadeDuration = BLEND_TIME) {
  if (currentAction) {
    currentAction.fadeOut(fadeDuration);
    setTimeout(() => { currentAction?.stop(); currentAction = null; currentName = null; }, fadeDuration * 1000);
  }
}


export function toggleAnimation(name, loop = true) {
  if (currentName === name) { stopAnimation(); return false; }
  return playAnimation(name, loop);
}


let cyclicTimeout = null;
export function startCyclicAnimation(name, pauseMs = 60000) {
  if (!actions[name]) { console.warn(`[VRMA] "${name}" not loaded`); return false; }
  
  
  stopCyclicAnimation();
  
  function playOnce() {
    const action = actions[name];
    if (!action) return;
    
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    
    if (currentAction) {
      currentAction.crossFadeTo(action, BLEND_TIME, true);
    }
    action.play();
    
    currentAction = action;
    currentName = name;
    console.log(`[VRMA] ▶ ${name} (cyclic)`);
    
    // When finished, wait and play again
    action.addEventListener('finished', () => {
      cyclicTimeout = setTimeout(playOnce, pauseMs);
    });
  }
  
  playOnce();
  return true;
}

export function stopCyclicAnimation() {
  if (cyclicTimeout) {
    clearTimeout(cyclicTimeout);
    cyclicTimeout = null;
  }
  stopAnimation();
}


export function playSequence(animationNames) {
  if (animationNames.length === 0) return;
  
  let index = 0;
  
  function playNext() {
    if (index >= animationNames.length) {
      stopAnimation();
      return;
    }
    
    const name = animationNames[index];
    const action = actions[name];
    const clip = clips[name];
    if (!action || !clip) {
      console.warn(`[VRMA] "${name}" not loaded, skipping`);
      index++;
      playNext();
      return;
    }
    
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    
    if (currentAction) {
      currentAction.crossFadeTo(action, BLEND_TIME, true);
    }
    action.play();
    
    currentAction = action;
    currentName = name;
    console.log(`[VRMA] ▶ ${name} (sequence)`);
    

    setTimeout(() => {
      index++;
      playNext();
    }, clip.duration * 1000);
  }
  
  playNext();
}


export function getCurrentAnimation() { return currentName; }
export function isPlaying(name)       { return currentName === name; }
export function getLoadedAnimations() { return Object.keys(clips); }


export function updateVRMA(delta) {
  if (mixer) mixer.update(delta);
}
