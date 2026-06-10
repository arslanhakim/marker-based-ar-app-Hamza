# Marker-Based AR App

A web-based, marker-tracked Augmented Reality app. The camera detects a printed
image marker, pins an animated 3D character to it, and renders it over the live
camera feed — with three interaction triggers. Built to run in **Chrome on
Android** (and any modern browser with a camera).

## Stack

- **[Vite](https://vitejs.dev/)** — dev server + build
- **[MindAR](https://github.com/hiukim/mind-ar-js)** (`mindar-image-three`) — image-target tracking
- **[Three.js](https://threejs.org/) `0.149.0`** — rendering + `AnimationMixer`
- **RobotExpressive.glb** — character with baked animation clips (from the Three.js examples)

> Three.js is pinned to **0.149.0** because MindAR 1.2.5's prebuilt bundle imports
> `sRGBEncoding`, which Three.js removed in r150+. Do not upgrade Three.js without
> also updating MindAR.

## Features

- Full-screen rear-camera AR with MindAR image tracking
- `RobotExpressive` character standing upright on the marker, looping **Idle**
- Three animation triggers, all driving **one shared Running ↔ Jump state machine**:
  1. **Tap** the character (raycast) — laptop: mouse click
  2. **On-screen UI button** ("Switch Animation")
  3. **Pinch-to-zoom** past a threshold — laptop: mouse wheel or `+` / `-` keys

## Run locally

```bash
npm install
npm run dev
```

Open the printed URL. Camera access works on `localhost`; on a phone it requires
**HTTPS** (e.g. deploy to Vercel and open the URL in Chrome on Android).

```bash
npm run build    # production build into dist/
npm run preview  # preview the production build
```

## The marker

- Printable marker: [`public/marker.png`](public/marker.png) — print it or display
  it on a screen, keep it flat and well-lit.
- Compiled tracking target: [`public/targets.mind`](public/targets.mind) (already
  included). To regenerate from a new image, use the
  [MindAR online compiler](https://hiukim.github.io/mind-ar-js-doc/tools/compile/)
  and save the result as `public/targets.mind`.
- Regenerate the marker image: `node scripts/generate-marker.mjs`.

## Installable PWA (Android APK via PWABuilder)

This app is a self-contained, installable PWA — no runtime CDN dependencies (the
model and `targets.mind` load from same-origin `/public`).

- **Manifest:** [`public/manifest.webmanifest`](public/manifest.webmanifest)
  (name **Marker AR Robot**, short_name **AR Robot**, `display: standalone`).
- **Icons:** `public/icons/` — 192 & 512 (`any`) plus 192 & 512 `maskable`.
  Regenerate with `node scripts/generate-icons.mjs`.
- **Service worker:** [`public/sw.js`](public/sw.js) — precaches the app shell +
  model + target and serves them offline after first load. Registered from
  `main.js` in production builds only. It only intercepts same-origin GET
  requests, so it never touches the camera (`getUserMedia`).

To package an APK: `npm run build`, deploy `dist/` over **HTTPS** (e.g. Vercel),
then point [PWABuilder](https://www.pwabuilder.com/) at the deployed URL.
Camera access (`getUserMedia`) requires HTTPS, which Vercel provides.

## How to use

1. Run the app and allow camera access.
2. Point the camera at the marker — the robot appears standing on it (Idle).
3. Trigger an animation switch by tapping the robot, pressing the button, or
   pinching/zooming past the threshold. All three stay in sync.
