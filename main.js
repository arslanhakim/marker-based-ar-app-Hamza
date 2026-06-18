// AR triggers — all switch the SAME character between two clips, BASE_ACTION and
// TRIGGER_ACTION:
//   #1 tap the robot (raycast)         -> flip between the two clips
//   #2 the on-screen "Switch" button   -> flip between the two clips
//   #3 a SECOND image target ("trigger") -> PRESENCE based:
//        trigger image visible  -> TRIGGER_ACTION
//        trigger image removed   -> BASE_ACTION
// #3 is deterministic with the trigger marker's presence (it sets the action on
// found/lost), so showing/hiding the trigger image always re-syncs the state.

import { MindARThree } from 'mind-ar/dist/mindar-image-three.prod.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const container = document.querySelector('#ar-container');
const status = document.querySelector('#status');
const switchBtn = document.querySelector('#switch-btn');
const triggerStatus = document.querySelector('#trigger-status'); // diagnostic label

// The two clips everything switches between. Easy to change — must be real clip
// names from RobotExpressive.glb: Dance, Death, Idle, Jump, No, Punch, Running,
// Sitting, Standing, ThumbsUp, Walking, WalkJump, Wave, Yes.
const BASE_ACTION = 'Running'; // default action on the base marker
const TRIGGER_ACTION = 'Punch'; // action while the trigger image is visible

// 1) Initialize MindAR with the compiled target file. maxTrack: 2 lets BOTH the
//    base marker (index 0) and the trigger image (index 1) be detected at once —
//    the default is 1, which would never see both together.
const mindarThree = new MindARThree({
  container,
  imageTargetSrc: '/targets.mind',
  maxTrack: 2,
  uiLoading: 'no',
  uiScanning: 'no',
  uiError: 'no',
});
const { renderer, scene, camera } = mindarThree;

// 2) Lighting in the scene so the character is clearly lit when it appears.
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
dirLight.position.set(0.5, 1, 1);
scene.add(dirLight);

// 3) Two anchors. Index 0 = base marker (holds the character). Index 1 = trigger
//    image (no visible model — its only job is presence detection).
const baseAnchor = mindarThree.addAnchor(0);
const triggerAnchor = mindarThree.addAnchor(1);

let detected = false; // base marker tracked? (gates tap/button)
baseAnchor.onTargetFound = () => {
  detected = true;
  status.textContent = 'Base marker detected ✅';
  switchBtn.disabled = false;
};
baseAnchor.onTargetLost = () => {
  detected = false;
  status.textContent = 'Searching for base marker…';
  switchBtn.disabled = true;
};

// Trigger image presence drives the action deterministically. The diagnostic
// label updates independently of the base marker, so you can point the camera at
// ONLY the trigger image and confirm whether it's recognized (the robot won't
// show without the base marker — that's expected; just watch the label).
triggerAnchor.onTargetFound = () => {
  triggerStatus.textContent = 'TRIGGER: detected';
  triggerStatus.classList.add('detected');
  playAction(TRIGGER_ACTION);
  status.textContent = '✦ Trigger image → ' + TRIGGER_ACTION;
};
triggerAnchor.onTargetLost = () => {
  triggerStatus.textContent = 'TRIGGER: not detected';
  triggerStatus.classList.remove('detected');
  playAction(BASE_ACTION);
  status.textContent = '↩ Trigger removed → ' + BASE_ACTION;
};

// 4) Character + animation state (assigned once the GLB loads).
let robot = null; // raycast target
let character = null; // wrapper group standing the model up on the marker
let mixer = null;
let currentAction = null; // the AnimationAction currently playing
let currentClipName = null; // name of the clip currentAction plays
const actions = {}; // name -> AnimationAction
const clock = new THREE.Clock();

// Character placement (tunable).
// The model is Y-up (feet at y≈0, head up +Y). The marker lies in the anchor's
// X/Y plane; the marker normal is its Z axis. To make the robot STAND on the
// marker we rotate it 90° about X so its up-axis becomes the marker normal.
// In this mindar-image-three build the head must point toward the viewer, which
// is -90° about X (using +90° tips the head into the marker, so it looks like
// it's lying flat / viewed from above). Flip the sign if it ever stands the
// wrong way on your device.
const STAND_ROTATION_X = -Math.PI / 2;
const CHARACTER_HEIGHT = 0.8; // model height in marker-width units (1 = marker edge)

const loader = new GLTFLoader();
loader.load(
  '/RobotExpressive.glb',
  (gltf) => {
    robot = gltf.scene;
    const clips = gltf.animations;
    console.log(
      'Available animation clips (' + clips.length + '):',
      clips.map((c) => c.name),
    );

    // Scale so the model is CHARACTER_HEIGHT tall, and move its feet (the model's
    // lowest point) to the model origin so it pivots about the feet.
    const box = new THREE.Box3().setFromObject(robot);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = CHARACTER_HEIGHT / size.y;
    robot.scale.setScalar(scale);
    robot.position.y = -box.min.y * scale; // feet -> model-local y = 0
    robot.position.x = -((box.min.x + box.max.x) / 2) * scale; // center horizontally
    robot.position.z = -((box.min.z + box.max.z) / 2) * scale;

    // Stand the model up: rotate 90° about X so its up-axis becomes the marker
    // normal. Because the feet were moved to the pivot, after this rotation the
    // feet sit exactly on the marker plane (anchor z = 0) and the body rises off
    // the marker toward the viewer — i.e. standing like a figurine, centered.
    character = new THREE.Group();
    character.add(robot);
    character.rotation.x = STAND_ROTATION_X;
    baseAnchor.group.add(character);

    // Build the two actions we switch between. Both loop so they read clearly
    // while held. (If you pick a one-shot clip, use LoopOnce + clampWhenFinished.)
    mixer = new THREE.AnimationMixer(robot);
    for (const name of [BASE_ACTION, TRIGGER_ACTION]) {
      const clip = THREE.AnimationClip.findByName(clips, name);
      if (!clip) {
        console.warn('Animation clip not found in GLB:', name);
        continue;
      }
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      actions[name] = action;
    }

    // Default action on the base marker.
    currentAction = actions[BASE_ACTION] || null;
    currentClipName = currentAction ? BASE_ACTION : null;
    if (currentAction) currentAction.play();
  },
  undefined,
  (err) => {
    console.error('Failed to load RobotExpressive.glb:', err);
    status.textContent = 'Failed to load character model.';
  },
);

// Crossfade the character to a named clip. Idempotent: asking for the action
// that's already playing does nothing — that's what keeps the trigger-presence
// logic deterministic and desync-proof.
function playAction(name) {
  if (!mixer || !actions[name] || name === currentClipName) return;
  const next = actions[name];
  next.reset();
  next.enabled = true;
  next.setEffectiveTimeScale(1);
  next.setEffectiveWeight(1);
  next.play();
  if (currentAction) currentAction.crossFadeTo(next, 0.3, false);
  currentAction = next;
  currentClipName = name;
}

// Triggers #1 (tap) and #2 (button): flip between the two clips, using the same
// playAction()/state as the trigger image so nothing can desync.
function toggleAnimation() {
  if (!detected || !mixer || !currentClipName) return; // nothing to animate yet
  const next = currentClipName === BASE_ACTION ? TRIGGER_ACTION : BASE_ACTION;
  playAction(next);
  status.textContent = '🎬 ' + currentClipName;
}

// 5) Raycast a screen point against the robot; flip on a hit, ignore a miss.
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function raycastTapAt(clientX, clientY) {
  if (!detected || !robot) return; // only when the character is actually on screen
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  if (raycaster.intersectObject(robot, true).length > 0) {
    toggleAnimation();
  }
}

// 6) Pointer handling for Trigger #1 (tap). A tap is a single pointer that goes
//    down and up in roughly the same spot. We track pointers so a multi-touch
//    never registers as a tap.
const TAP_MOVE_TOLERANCE = 10; // px — beyond this a press is a drag, not a tap
const activePointers = new Map(); // pointerId -> { x, y }
let tapCandidate = null; // { id, x, y } while a single clean tap is possible

function onPointerDown(event) {
  // The UI button handles its own click; don't let it start tap tracking.
  if (event.target.closest && event.target.closest('#switch-btn')) return;

  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (activePointers.size === 1) {
    tapCandidate = { id: event.pointerId, x: event.clientX, y: event.clientY };
  } else {
    tapCandidate = null; // more than one finger down -> not a tap
  }
}

function onPointerMove(event) {
  const p = activePointers.get(event.pointerId);
  if (!p) return;
  p.x = event.clientX;
  p.y = event.clientY;

  // Moved too far -> it's a drag, not a tap.
  if (tapCandidate && event.pointerId === tapCandidate.id) {
    if (Math.hypot(event.clientX - tapCandidate.x, event.clientY - tapCandidate.y) > TAP_MOVE_TOLERANCE) {
      tapCandidate = null;
    }
  }
}

function onPointerUp(event) {
  const wasTap = tapCandidate && event.pointerId === tapCandidate.id;
  activePointers.delete(event.pointerId);

  if (wasTap) {
    tapCandidate = null;
    raycastTapAt(event.clientX, event.clientY);
  }
}

window.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);

// The UI button (Trigger #2) is a second entry point into the same toggle.
switchBtn.addEventListener('click', toggleAnimation);

// 7) Start tracking and render.
async function start() {
  status.textContent = 'Loading targets & camera…';
  try {
    await mindarThree.start();
    status.textContent = 'Searching for base marker…';
    renderer.setAnimationLoop(() => {
      const dt = clock.getDelta();
      if (mixer) mixer.update(dt);
      renderer.render(scene, camera);
    });
  } catch (err) {
    console.error('Failed to start AR:', err);
    status.textContent = 'Failed to start: ' + err.message;
  }
}

start();

// Register the service worker (production builds only — avoids dev caching).
// The SW provides offline/installable PWA support and never touches the camera.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
