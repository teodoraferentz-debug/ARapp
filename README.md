# 🪐 AR Cosmos — the Solar System in augmented reality

A **WebAR** app that runs in your phone's browser (nothing to install), built with **A-Frame, AR.js and WebXR**.
The Solar System appears in your camera view — on a real surface, floating in front of you, or on a printed marker — with three interactive modes and music.

## AR modes

| Mode | How it works | Devices |
|---|---|---|
| 🌍 **Markerless — surfaces (WebXR)** | The phone detects the floor/table (ARCore). Move the phone slowly; when a surface is found the universe is **placed automatically** (if none is found within ~7 s it appears in front of you). It stays anchored — walk around it. Tap objects directly; use the ＋ － ↺ ↻ buttons to zoom/turn. The 📍 *Move* button re-places it | Android + Chrome (with “Google Play Services for AR”) |
| 🌍 **Markerless — 3DoF** | Camera + gyroscope: the universe floats ~1.2 m in front of you and stays put when you rotate the phone. It is not anchored if you walk around. 📍 *Move* re-centers it | Any phone, including iPhone/Safari |
| ⌗ **Hiro marker** | The universe appears on top of a printed marker | Any phone |
| 🖥️ **Demo** | No camera, for PC / presentations | Any browser |

**“Start AR (no marker)”** automatically picks the right option for the phone. Safari on iPhone has no WebXR, so it uses 3DoF there.

## Features

| Mode | What you can do |
|---|---|
| 🔭 **Explore** | **Tap** a planet — or pick it in the **planet bar** at the bottom — for a fact card (diameter, distance, year, day, temperature, moons, a fun fact) · **◀ ▶** to browse planets · **Drag** to rotate/tilt · **Pinch** to zoom · labelled tools: Pause, Speed (¼×–12×), Orbits, Names, Reset |
| 🎯 **Quiz** | 8 random questions out of 15; answer by **tapping the planet** in AR (names are hidden). Green/red feedback, sound, vibration, saved best score |
| ☄️ **Game** “Defend the Sun” | Asteroids fly toward the Sun — **tap** them to destroy them. 3 lives, rising levels. Golden asteroid = slow motion for 5 s, blue comet = fast (+25). Explosions, saved best score, a “Did you know…” fact at the end |

**Easy navigation:** a first-run tutorial, the **?** button any time, a short tip every time you switch mode, a **🏠** button back to the menu, labelled tool buttons, and the always-visible mode tabs.

**Sound:** synthesized with WebAudio — no audio files, works offline.
- 🎵 **Music** — generative ambient music with a different feel per mode (calm pad in Explore, light plucks in Quiz, driving beat in Game that speeds up with the level).
- 🔊 **Effects** — a unique musical note per planet, UI clicks, correct/wrong, explosions, hits, level-up, game over, victory jingle.
- Music and effects can be switched off separately (🎵 / 🔊); your choice is remembered. Sound pauses when the app is in the background.

## Run it

Needs only Node.js (no npm dependencies; the libraries are included in `vendor/`).

```bash
npm start          # http://localhost:8080  (works with a laptop webcam)
npm run https      # https://localhost:8443 (self-signed certificate, for phones)
```

### On a phone
The browser camera requires **HTTPS**. Options:
1. `npm run https`, then open `https://<your-PC-IP>:8443` on the phone (printed in the console; same Wi-Fi) and accept the certificate warning.
2. Publish the folder on **GitHub Pages** / Netlify / Vercel (HTTPS automatically) — the easiest for a demo.
3. An HTTPS tunnel, e.g. `npx localtunnel --port 8080`.

### Marker (only for marker mode)
Open `assets/hiro.png` on another screen or print it (black on white, no glare, as large as you can).

## Project structure

```
index.html        UI markup — the AR scene is created from JS when you press Start
css/style.css     mobile-first styles
js/data.js        educational data (planets, quiz questions, fun facts)
js/audio.js       sound effects + generative music (WebAudio)
js/app.js         logic: “universe” component, Explore/Quiz/Game modes, gestures, UI, WebXR hit-test, 3DoF
vendor/           A-Frame 1.5.0 + AR.js 3.4.7 (local, works offline)
data/             camera_para.dat + patt.hiro (needed by AR.js)
assets/hiro.png   the printable marker
server.js         static server (HTTP/HTTPS)
```

How it works, briefly:
- `<a-marker>` (AR.js) tracks the marker; in markerless modes the `#world` entity is placed by WebXR hit-test or in front of the camera. It has the **`universe`** component, which builds the sun, planets (procedural canvas textures), orbits and labels with Three.js and animates them in `tick()`.
- Taps use *Pointer Events*; a **Raycaster** shoots a ray from the camera through the touch point and finds the planet/asteroid (larger invisible spheres make small targets easy to hit).
- The modes are three objects (`Explore`, `Quiz`, `Game`) that receive the same *tap* event.
- `Sfx` schedules music notes a fraction of a second ahead with the WebAudio clock; the mood follows the active mode.

## Customize
- **Another subject** (anatomy, molecules, monuments…): edit `js/data.js` and `buildPlanets()`.
- **Real 3D models**: add a `.glb` and load it with `GLTFLoader` / `<a-gltf-model>`.
- **Another marker**: generate one with the AR.js marker generator and replace `data/patt.hiro` + `assets/hiro.png`.
- **Music**: edit the chord progression `PROG` and the `BPM` table in `js/audio.js`.
- Physical values are rounded from the NASA Planetary Fact Sheet; moon counts change often — double-check them if you cite them.

## Testing and limits
- Checked automatically in headless Chromium: start-up, planet selection, planet bar and ◀ ▶ navigation, drag/zoom, a full quiz, the game (score, lives, game over), the music engine (non-silent output in every mood, silent when switched off), no console errors.
- **3DoF mode** tested with a virtual camera. **WebXR placement** has its logic verified with a simulated hit-test (reticle, tap, re-place), but a real WebXR session needs an Android phone — **not testable in the development container**.
- **Marker detection** tested with a virtual camera showing the Hiro marker.
- **Not tested on a physical phone** — try it on your device before presenting (good light, large marker). Anchoring on real surfaces needs WebXR (Android/Chrome only); on iPhone there is no markerless option with real anchoring in the browser (it would need a native ARKit app or a commercial SDK such as 8th Wall).
