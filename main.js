// AR triggers — all three on ONE shared Running/Jump state machine:
//   #1 tap the robot (raycast), #2 the UI button, #3 marker proximity.
// Every entry point calls the same toggleAnimation(), so they can never desync.
// Proximity (#3) watches the camera-to-marker distance each frame: move the
// phone CLOSE to the marker to switch, pull AWAY to switch back. No touch
// gesture is involved, so the browser can't steal it as a page pinch-zoom.

import { MindARThree } from 'mind-ar/dist/mindar-image-three.prod.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const container = document.querySelector('#ar-container');
const status = document.querySelector('#status');
const switchBtn = document.querySelector('#switch-btn');

// 1) Initialize MindAR's image-three system with the compiled target.
const mindarThree = new MindARThree({
  container,
  imageTargetSrc: '/targets.mind',
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

// 3) One anchor bound to target index 0 (our single marker).
const anchor = mindarThree.addAnchor(0);

let detected = false; // marker currently tracked? (gates the trigger)
anchor.onTargetFound = () => {
  detected = true;
  nearMarker = null; // recalibrate the proximity zone for this acquisition
  status.textContent = 'Marker detected ✅';
  switchBtn.disabled = false; // enable the UI button while the character is on screen
};
anchor.onTargetLost = () => {
  detected = false;
  status.textContent = 'Searching for marker…';
  switchBtn.disabled = true; // dim the button — nothing to animate
};

// 4) Character + animation state (assigned once the GLB loads).
let robot = null; // raycast target
let character = null; // wrapper group standing the model up on the marker
let mixer = null;
let currentAction = null; // the action currently playing
const actions = {}; // name -> AnimationAction
let showingRunning = false; // false: next toggle -> Running, true: next toggle -> Jump
const clock = new THREE.Clock();

// Proximity trigger (#3) — tunable. We read the camera-to-marker distance from
// the anchor's world matrix every frame. Distance is in MindAR "marker-width"
// units (marker edge = 1 unit), so smaller = the phone is closer / marker looks
// bigger. Two thresholds give hysteresis so jitter at the line doesn't spam:
//   cross BELOW NEAR_DISTANCE  -> "zoomed in"  -> toggle
//   cross ABOVE FAR_DISTANCE   -> "zoomed out" -> toggle back
const NEAR_DISTANCE = 1.6; // get this close (or closer) to trigger
const FAR_DISTANCE = 2.4; // pull back past this to reset
const DEBUG_PROXIMITY = false; // true -> show the live distance in the status pill (for tuning)
let nearMarker = null; // true/false zone; null = calibrate on (re)acquisition without toggling
const markerPos = new THREE.Vector3(); // reused each frame

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

    // Scale to ~0.8 marker units and sit the feet on the surface.
    const box = new THREE.Box3().setFromObject(robot);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = 0.8 / size.y;
    robot.scale.setScalar(scale);
    robot.position.y = -box.min.y * scale;

    // Stand the Y-up model up along the marker's +z.
    character = new THREE.Group();
    character.add(robot);
    character.rotation.x = Math.PI / 2;
    anchor.group.add(character);

    // Mixer + the three actions we use this phase.
    mixer = new THREE.AnimationMixer(robot);
    const idleClip = THREE.AnimationClip.findByName(clips, 'Idle');
    const runClip = THREE.AnimationClip.findByName(clips, 'Running');
    const jumpClip = THREE.AnimationClip.findByName(clips, 'Jump');

    actions.Idle = mixer.clipAction(idleClip);
    actions.Running = mixer.clipAction(runClip);
    actions.Jump = mixer.clipAction(jumpClip);

    // Running loops; Jump is a one-shot that holds its final pose.
    actions.Running.setLoop(THREE.LoopRepeat, Infinity);
    actions.Jump.setLoop(THREE.LoopOnce, 1);
    actions.Jump.clampWhenFinished = true;

    // Idle is the rest state until the first tap.
    currentAction = actions.Idle;
    currentAction.play();
  },
  undefined,
  (err) => {
    console.error('Failed to load RobotExpressive.glb:', err);
    status.textContent = 'Failed to load character model.';
  },
);

// Crossfade from the current action to a target action.
function fadeTo(action) {
  if (!action || action === currentAction) return;
  action.reset();
  action.enabled = true;
  action.setEffectiveTimeScale(1);
  action.setEffectiveWeight(1);
  action.play();
  currentAction.crossFadeTo(action, 0.3, false);
  currentAction = action;
}

// Single source of truth for the trigger. Both the raycast tap and the UI
// button call this, so they advance the SAME state and can never desync.
function toggleAnimation() {
  if (!detected || !mixer || !actions.Running) return; // nothing to animate
  if (!showingRunning) {
    fadeTo(actions.Running);
    showingRunning = true;
    status.textContent = '▶ Running';
  } else {
    fadeTo(actions.Jump);
    showingRunning = false;
    status.textContent = '⤒ Jump';
  }
}

// Trigger #3 — marker proximity. Called every frame while the marker is tracked.
// The anchor's world-matrix translation is the marker position relative to the
// camera (MindAR keeps the camera at the origin), so its length is the distance.
function checkProximity() {
  if (!mixer) return; // model not ready yet
  // MindAR writes anchor.group.matrix every frame (marker pose in camera space,
  // camera at the origin). The anchor is a direct child of the scene, so this
  // local matrix IS the world transform — and it's always current.
  markerPos.setFromMatrixPosition(anchor.group.matrix);
  const distance = markerPos.length();

  if (DEBUG_PROXIMITY) status.textContent = 'distance: ' + distance.toFixed(2);

  // First frame after (re)acquisition: set the starting zone, don't toggle.
  if (nearMarker === null) {
    nearMarker = distance < NEAR_DISTANCE;
    return;
  }

  if (!nearMarker && distance < NEAR_DISTANCE) {
    nearMarker = true;
    toggleAnimation(); // moved close -> switch
    if (!DEBUG_PROXIMITY) status.textContent = '🔍 Zoomed in → ' + (showingRunning ? 'Running' : 'Jump');
  } else if (nearMarker && distance > FAR_DISTANCE) {
    nearMarker = false;
    toggleAnimation(); // pulled away -> switch back
    if (!DEBUG_PROXIMITY) status.textContent = '↔ Zoomed out → ' + (showingRunning ? 'Running' : 'Jump');
  }
}

// 5) Raycast a screen point against the robot; toggle on a hit, ignore a miss.
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
//    (e.g. two fingers) never registers as a tap. There is no pinch handler —
//    zoom is now proximity-based and needs no gesture.
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

// 7) Start tracking and render. The proximity trigger (#3) is evaluated each
//    frame here while the marker is detected.
async function start() {
  status.textContent = 'Loading target & camera…';
  try {
    await mindarThree.start();
    status.textContent = 'Searching for marker…';
    renderer.setAnimationLoop(() => {
      const dt = clock.getDelta();
      if (mixer) mixer.update(dt);
      if (detected) checkProximity();
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
