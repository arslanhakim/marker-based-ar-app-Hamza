// AR triggers — all three on ONE shared Running/Jump state machine:
//   #1 tap the robot (raycast), #2 the UI button, #3 pinch-to-zoom threshold.
// Every entry point calls the same toggleAnimation(), so they can never desync.
// Zoom also scales the character between clamps; the threshold crossing fires
// the toggle. Laptop fallbacks: click = tap, mouse wheel / +- keys = zoom.

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
let character = null; // wrapper group we scale for zoom (keeps feet on the marker)
let mixer = null;
let currentAction = null; // the action currently playing
const actions = {}; // name -> AnimationAction
let showingRunning = false; // false: next tap -> Running, true: next tap -> Jump
const clock = new THREE.Clock();

// Zoom (Trigger #3) state. We scale the character wrapper between these clamps;
// crossing ZOOM_THRESHOLD fires the shared toggle (with hysteresis via zoomedIn).
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;
const ZOOM_THRESHOLD = 1.6;
let zoom = 1.0;
let zoomedIn = false; // are we currently past the threshold?

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
    character.scale.setScalar(zoom);
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

// Apply a new zoom level: clamp, scale the character, and fire the shared
// toggle once on each threshold crossing (hysteresis prevents repeat firing).
function applyZoom(next) {
  zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
  if (character) character.scale.setScalar(zoom);

  if (!zoomedIn && zoom >= ZOOM_THRESHOLD) {
    zoomedIn = true;
    toggleAnimation(); // crossed in -> switch
  } else if (zoomedIn && zoom < ZOOM_THRESHOLD) {
    zoomedIn = false;
    toggleAnimation(); // crossed back -> switch back
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

// 6) Unified pointer handling: a single quiet pointer = tap (Trigger #1);
//    two pointers = pinch-to-zoom (Trigger #3). Tracking both here lets us
//    suppress the tap when a pinch is in progress, so they never collide.
const TAP_MOVE_TOLERANCE = 10; // px — beyond this a press is a drag/pinch, not a tap
const activePointers = new Map(); // pointerId -> { x, y }
let tapCandidate = null; // { id, x, y } while a single clean tap is possible
let pinchStartDist = 0;
let pinchStartZoom = 1;

function pinchDistance() {
  const pts = [...activePointers.values()];
  return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
}

function onPointerDown(event) {
  // The UI button handles its own click; don't let it start tap/pinch tracking.
  if (event.target.closest && event.target.closest('#switch-btn')) return;

  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (activePointers.size === 1) {
    tapCandidate = { id: event.pointerId, x: event.clientX, y: event.clientY };
  } else if (activePointers.size === 2) {
    tapCandidate = null; // a second finger -> this is a pinch, not a tap
    pinchStartDist = pinchDistance();
    pinchStartZoom = zoom;
  }
}

function onPointerMove(event) {
  const p = activePointers.get(event.pointerId);
  if (!p) return;
  p.x = event.clientX;
  p.y = event.clientY;

  if (activePointers.size >= 2) {
    // Pinch: scale relative to the distance when the second finger landed.
    if (pinchStartDist > 0) applyZoom(pinchStartZoom * (pinchDistance() / pinchStartDist));
  } else if (tapCandidate && event.pointerId === tapCandidate.id) {
    // Moved too far -> it's a drag, not a tap.
    if (Math.hypot(event.clientX - tapCandidate.x, event.clientY - tapCandidate.y) > TAP_MOVE_TOLERANCE) {
      tapCandidate = null;
    }
  }
}

function onPointerUp(event) {
  const wasTap = tapCandidate && event.pointerId === tapCandidate.id;
  activePointers.delete(event.pointerId);
  if (activePointers.size < 2) pinchStartDist = 0; // pinch ended

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

// 7) Laptop fallback for zoom (no touch pinch): mouse wheel and +/- keys
//    drive the exact same zoom scale + threshold trigger.
window.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault();
    applyZoom(zoom * (1 - event.deltaY * 0.001)); // scroll up = zoom in
  },
  { passive: false },
);

window.addEventListener('keydown', (event) => {
  if (event.key === '+' || event.key === '=') applyZoom(zoom * 1.1);
  else if (event.key === '-' || event.key === '_') applyZoom(zoom * 0.9);
});

// 6) Start tracking and render.
async function start() {
  status.textContent = 'Loading target & camera…';
  try {
    await mindarThree.start();
    status.textContent = 'Searching for marker…';
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
