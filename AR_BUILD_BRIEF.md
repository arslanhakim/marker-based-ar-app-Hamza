# Build Brief — Marker-Based AR Android App

**Hand this file to Claude Code as the project spec. Work through phases in order. Do not skip acceptance criteria.**

---

## 1. What we're building

A marker-based Augmented Reality app that runs on an Android phone. The camera detects a printed image ("marker"), pins a 3D animated character to the marker's origin, and renders it over the live camera feed. We implement **3 of the 4** required animation triggers.

**Confirmed by client:** It only needs to *work on Android*. No Unity/Vuforia requirement. Web-based AR opened in Chrome on Android counts as "works on Android." An installable APK is a nice-to-have, not mandatory.

## 2. Locked decisions

- **Approach:** Web AR (JS), not native Unity. Plays to a MERN dev's strengths and is almost entirely code files.
- **Triggers to implement:** #1 (tap character), #2 (on-screen UI button), #4 (zoom). **Skip #3** (cover part of marker / "virtual button") — that one is a native Vuforia strength and is unreliable in web AR.
- **Character:** Use Three.js's `RobotExpressive.glb` — it ships with multiple named animation clips baked in (Idle, Walking, Running, Jump, Dance, Wave, etc.). This skips the entire Mixamo → Blender → glTF conversion headache. Massive time saver. Do not hand-rig anything.

> ⚠️ **OPEN ITEM — verify before Phase 5:** Requirement #4's full text was cut off in the source screenshot. This brief assumes it means a zoom interaction. Confirm exact wording and adjust trigger #4 if needed.

## 3. Stack

- **Vite** — dev server + build
- **MindAR** (`mind-ar-js`, the `mindar-image-three` build) — image-target tracking
- **Three.js** — rendering + `AnimationMixer` for clip switching
- **RobotExpressive.glb** — character (from the Three.js examples assets)
- **Vercel** — deploy for HTTPS phone testing (camera access requires HTTPS off-localhost)
- **Capacitor** — OPTIONAL, only if an installable `.apk` is required at the end

## 4. The three triggers — implementation notes

1. **Tap character (#1):** Three.js `Raycaster` from the touch coordinates. If the ray hits the model, toggle between two clips (e.g. Running ↔ Jump) using `AnimationAction.crossFadeTo`. Tap again reverts. Track state with a boolean.
2. **UI button (#2):** An HTML `<button>` overlaid on the canvas (fixed position, part of the UI). `onclick` runs the same toggle as #1 — a second entry point to switch the animation. Tap again reverts.
3. **Zoom (#4):** Primary = pinch gesture via touch events → scale the model and/or switch the animation when scale crosses a threshold. Reliable to demo. *Alternative if the requirement literally means moving the phone closer:* read the marker anchor's distance/scale from MindAR's anchor matrix and trigger when it crosses a proximity threshold. Default to pinch for demo reliability unless the confirmed #4 text says otherwise.

## 5. Phased task list

**Phase 1 — Scaffold**
- Vite project, MindAR + Three.js installed, page opens the rear camera.
- ✅ Done when: camera feed shows full-screen on an Android phone over HTTPS.

**Phase 2 — Marker**
- Pick a feature-rich, high-contrast, asymmetric target image. Compile it to MindAR's `.mind` format (MindAR online compiler or npm compiler).
- Produce a printable marker PNG.
- ✅ Done when: pointing the camera at the printed/displayed marker is detected reliably.

**Phase 3 — Character on marker**
- Load `RobotExpressive.glb`, pin it to the marker anchor at the origin so it sits on the image. Play a default idle/run clip via `AnimationMixer`.
- ✅ Done when: the animated character appears anchored on the marker and tracks as the phone moves.

**Phase 4 — Trigger #1 (tap)**
- Raycast tap → crossfade between two clips. Tap again reverts.
- ✅ Done when: tapping the character visibly switches and reverts the animation.

**Phase 5 — Trigger #2 (UI button)**
- HTML button overlay → same toggle.
- ✅ Done when: the button switches and reverts the animation independently of tapping.

**Phase 6 — Trigger #4 (zoom)**
- Pinch (or confirmed proximity) → scale / animation switch.
- ✅ Done when: the zoom gesture produces a clear, repeatable animation/scale change.

**Phase 7 — Polish + package**
- Loading indicator, clean minimal UI, test on a real Android device end to end.
- OPTIONAL: wrap with Capacitor (`npx cap add android`) → build `.apk`. Add camera permission to `AndroidManifest.xml`.
- ✅ Done when: all three triggers work on a physical phone.

**Phase 8 — Deliverables**
- `README.md`: how to run, how to print/display the marker, which 3 triggers are implemented.
- The printable marker PNG.
- A 30–60s screen recording demoing all three triggers (students usually need this for grading).

## 6. Testing approach

Camera access needs HTTPS on non-localhost. Don't fight with local certs — deploy each milestone to **Vercel** (free HTTPS) and open the URL in Chrome on the Android phone to test. Print the marker on paper, or display it on a second screen.

## 7. Scope guardrails (presentable, not over-engineered)

- One character, two clips, three working triggers. That's the bar.
- No multiple markers, no model variety, no menus, no settings screens.
- Tidy README + demo video = the difference between "works" and "presentable." Spend the polish budget there, not on features.
