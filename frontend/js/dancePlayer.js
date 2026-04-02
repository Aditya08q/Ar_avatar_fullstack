/**
 * dancePlayer.js
 * Plays Unity Humanoid muscle animations on VRM models.
 */

import * as THREE from 'three';

/*  VRM Bone mapping */
// Muscle range is typically -1 to 1, mapped to bone rotation limits

const MUSCLE_TO_BONE = {
  // Spine
  'Spine Front-Back':           { bone: 'spine',      axis: 'x', min: -0.4, max: 0.4 },
  'Spine Left-Right':           { bone: 'spine',      axis: 'z', min: -0.3, max: 0.3 },
  'Spine Twist Left-Right':     { bone: 'spine',      axis: 'y', min: -0.3, max: 0.3 },
  'Chest Front-Back':           { bone: 'chest',      axis: 'x', min: -0.3, max: 0.3 },
  'Chest Left-Right':           { bone: 'chest',      axis: 'z', min: -0.3, max: 0.3 },
  'Chest Twist Left-Right':     { bone: 'chest',      axis: 'y', min: -0.3, max: 0.3 },
  'UpperChest Front-Back':      { bone: 'upperChest', axis: 'x', min: -0.3, max: 0.3 },
  'UpperChest Left-Right':      { bone: 'upperChest', axis: 'z', min: -0.3, max: 0.3 },
  'UpperChest Twist Left-Right':{ bone: 'upperChest', axis: 'y', min: -0.3, max: 0.3 },

  // Neck & Head
  'Neck Nod Down-Up':           { bone: 'neck', axis: 'x', min: -0.4, max: 0.4 },
  'Neck Tilt Left-Right':       { bone: 'neck', axis: 'z', min: -0.3, max: 0.3 },
  'Neck Turn Left-Right':       { bone: 'neck', axis: 'y', min: -0.5, max: 0.5 },
  'Head Nod Down-Up':           { bone: 'head', axis: 'x', min: -0.4, max: 0.4 },
  'Head Tilt Left-Right':       { bone: 'head', axis: 'z', min: -0.3, max: 0.3 },
  'Head Turn Left-Right':       { bone: 'head', axis: 'y', min: -0.5, max: 0.5 },

  // Left Shoulder & Arm
  'Left Shoulder Down-Up':      { bone: 'leftShoulder',   axis: 'z', min: -0.5, max: 0.5 },
  'Left Shoulder Front-Back':   { bone: 'leftShoulder',   axis: 'x', min: -0.5, max: 0.5 },
  'Left Arm Down-Up':           { bone: 'leftUpperArm',   axis: 'z', min: -1.57, max: 1.57 },
  'Left Arm Front-Back':        { bone: 'leftUpperArm',   axis: 'x', min: -1.57, max: 1.57 },
  'Left Arm Twist In-Out':      { bone: 'leftUpperArm',   axis: 'y', min: -0.8,  max: 0.8  },
  'Left Forearm Stretch':       { bone: 'leftLowerArm',   axis: 'x', min: 0,     max: 1.57 },
  'Left Forearm Twist In-Out':  { bone: 'leftLowerArm',   axis: 'y', min: -0.8,  max: 0.8  },
  'Left Hand Down-Up':          { bone: 'leftHand',       axis: 'x', min: -0.4,  max: 0.4  },
  'Left Hand In-Out':           { bone: 'leftHand',       axis: 'z', min: -0.4,  max: 0.4  },

  // Right Shoulder & Arm
  'Right Shoulder Down-Up':     { bone: 'rightShoulder',  axis: 'z', min: -0.5,  max: 0.5  },
  'Right Shoulder Front-Back':  { bone: 'rightShoulder',  axis: 'x', min: -0.5,  max: 0.5  },
  'Right Arm Down-Up':          { bone: 'rightUpperArm',  axis: 'z', min: -1.57, max: 1.57 },
  'Right Arm Front-Back':       { bone: 'rightUpperArm',  axis: 'x', min: -1.57, max: 1.57 },
  'Right Arm Twist In-Out':     { bone: 'rightUpperArm',  axis: 'y', min: -0.8,  max: 0.8  },
  'Right Forearm Stretch':      { bone: 'rightLowerArm',  axis: 'x', min: 0,     max: 1.57 },
  'Right Forearm Twist In-Out': { bone: 'rightLowerArm',  axis: 'y', min: -0.8,  max: 0.8  },
  'Right Hand Down-Up':         { bone: 'rightHand',      axis: 'x', min: -0.4,  max: 0.4  },
  'Right Hand In-Out':          { bone: 'rightHand',      axis: 'z', min: -0.4,  max: 0.4  },

  // Left Leg
  'Left Upper Leg Front-Back':  { bone: 'leftUpperLeg',   axis: 'x', min: -1.57, max: 1.57 },
  'Left Upper Leg In-Out':      { bone: 'leftUpperLeg',   axis: 'z', min: -0.8,  max: 0.8  },
  'Left Upper Leg Twist In-Out':{ bone: 'leftUpperLeg',   axis: 'y', min: -0.6,  max: 0.6  },
  'Left Lower Leg Stretch':     { bone: 'leftLowerLeg',   axis: 'x', min: -1.57, max: 0    },
  'Left Foot Up-Down':          { bone: 'leftFoot',       axis: 'x', min: -0.6,  max: 0.6  },
  'Left Foot Twist In-Out':     { bone: 'leftFoot',       axis: 'y', min: -0.4,  max: 0.4  },
  'Left Toes Up-Down':          { bone: 'leftToes',       axis: 'x', min: -0.5,  max: 0.5  },

  // Right Leg
  'Right Upper Leg Front-Back': { bone: 'rightUpperLeg',  axis: 'x', min: -1.57, max: 1.57 },
  'Right Upper Leg In-Out':     { bone: 'rightUpperLeg',  axis: 'z', min: -0.8,  max: 0.8  },
  'Right Upper Leg Twist In-Out':{ bone: 'rightUpperLeg', axis: 'y', min: -0.6,  max: 0.6  },
  'Right Lower Leg Stretch':    { bone: 'rightLowerLeg',  axis: 'x', min: -1.57, max: 0    },
  'Right Foot Up-Down':         { bone: 'rightFoot',      axis: 'x', min: -0.6,  max: 0.6  },
  'Right Foot Twist In-Out':    { bone: 'rightFoot',      axis: 'y', min: -0.4,  max: 0.4  },
  'Right Toes Up-Down':         { bone: 'rightToes',      axis: 'x', min: -0.5,  max: 0.5  },
};

/* Player state  */
let animData     = null;   // parsed JSON
let currentVRM   = null;
let isPlaying    = false;
let playTime     = 0;
let looping      = true;
let blendIn      = 0;      // 0→1 blend in at start
let blendOut     = 1;      // 1→0 blend out at end
const BLEND_DUR  = 0.4;    // seconds to blend in/out

/* ─── Load animation JSON ─── */
export async function loadDanceAnimation(url) {
  try {
    const res  = await fetch(url);
    animData   = await res.json();
    console.log(`[Dance] Loaded: ${animData.duration.toFixed(2)}s, ${Object.keys(animData.curves).length} curves`);
    return true;
  } catch (e) {
    console.error('[Dance] Failed to load:', e);
    return false;
  }
}

export function setVRM(vrm)       { currentVRM = vrm; }
export function isDancing()       { return isPlaying; }

/* ─── Start / Stop ─── */
export function startDance() {
  if (!animData || !currentVRM) {
    console.warn('[Dance] No animation or VRM loaded');
    return;
  }
  isPlaying = true;
  playTime  = 0;
  blendIn   = 0;
  console.log('[Dance] Started ▶');
}

export function stopDance() {
  isPlaying = false;
  blendOut  = 0;
  console.log('[Dance] Stopped ■');
}

export function toggleDance() {
  if (isPlaying) stopDance();
  else           startDance();
}

/* Update (call every frame) */
export function updateDance(delta) {
  if (!isPlaying || !animData || !currentVRM?.humanoid) return;

  playTime += delta;

  // Loop
  if (playTime > animData.duration) {
    if (looping) playTime = playTime % animData.duration;
    else { stopDance(); return; }
  }

  // Blend weight
  const weight = getBlendWeight(playTime, animData.duration);

  // Apply all muscle curves
  const h = currentVRM.humanoid;

  // Reset bone accumulator each frame
  const boneValues = {};

  for (const [muscleName, mapping] of Object.entries(MUSCLE_TO_BONE)) {
    const curve = animData.curves[muscleName];
    if (!curve || curve.length === 0) continue;

    // Sample curve at current time
    const muscleVal = sampleCurve(curve, playTime);

    // Map muscle value (-1→1) to rotation (min→max)
    const rotation  = muscleToRotation(muscleVal, mapping.min, mapping.max);

    // Accumulate per bone
    if (!boneValues[mapping.bone]) boneValues[mapping.bone] = { x:0, y:0, z:0 };
    boneValues[mapping.bone][mapping.axis] += rotation * weight;
  }

  // Apply root motion (position from RootT)
  const rootTX = sampleCurve(animData.curves['RootT.x'] || [], playTime);
  const rootTY = sampleCurve(animData.curves['RootT.y'] || [], playTime);
  const rootTZ = sampleCurve(animData.curves['RootT.z'] || [], playTime);

  if (currentVRM.scene) {
    currentVRM.scene.position.x = rootTX * weight * 0.5;
    currentVRM.scene.position.y = -0.1 + rootTY * weight * 0.5;
    currentVRM.scene.position.z = rootTZ * weight * 0.3;
  }

  // Apply bone rotations
  for (const [boneName, rot] of Object.entries(boneValues)) {
    const bone = h.getNormalizedBoneNode(boneName);
    if (!bone) continue;
    bone.rotation.x = THREE.MathUtils.lerp(bone.rotation.x, rot.x, 0.85);
    bone.rotation.y = THREE.MathUtils.lerp(bone.rotation.y, rot.y, 0.85);
    bone.rotation.z = THREE.MathUtils.lerp(bone.rotation.z, rot.z, 0.85);
  }

  blendIn = Math.min(blendIn + delta / BLEND_DUR, 1);
}

/* Helpers */

// Linear interpolation between keyframes
function sampleCurve(keyframes, time) {
  if (!keyframes || keyframes.length === 0) return 0;
  if (keyframes.length === 1) return keyframes[0].v;
  if (time <= keyframes[0].t)  return keyframes[0].v;

  const last = keyframes[keyframes.length - 1];
  if (time >= last.t) return last.v;

  // Binary search for surrounding keyframes
  let lo = 0, hi = keyframes.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (keyframes[mid].t <= time) lo = mid;
    else hi = mid;
  }

  const a = keyframes[lo];
  const b = keyframes[hi];
  const t = (time - a.t) / (b.t - a.t);
  return a.v + (b.v - a.v) * t;
}

// Map muscle value to bone rotation
function muscleToRotation(muscleVal, min, max) {
  // muscle range: roughly -1 to 1 in Unity
  // clamp and remap
  const clamped = Math.max(-1, Math.min(1, muscleVal));
  if (clamped >= 0) return clamped * max;
  else              return clamped * (-min);
}

// Smooth blend weight at start/end
function getBlendWeight(t, duration) {
  const fadeIn  = Math.min(t / BLEND_DUR, 1);
  const fadeOut = Math.min((duration - t) / BLEND_DUR, 1);
  return Math.min(fadeIn, fadeOut);
}
