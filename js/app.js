/* AR Cosmos — an interactive Solar System in augmented reality (A-Frame + AR.js + WebXR)
 *
 * Structure:
 *   1. Utilities + global state (App)
 *   2. Procedural textures
 *   3. A-Frame component "universe" (sun, planets, orbits, labels, asteroids, effects)
 *   4. Modes: Explore, Quiz, Game
 *   5. Gestures (drag = rotate, pinch = scale, tap = select)
 *   6. UI, markerless AR (WebXR / 3DoF) and scene start-up
 */
(function () {
  'use strict';

  const THREE = AFRAME.THREE;
  const { PLANETS, SUN, QUIZ, FACTS } = window;
  const $ = (s) => document.querySelector(s);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };

  /* ======================================================================
   * 1. Global state
   * ==================================================================== */
  const App = window.App = {
    mode: 'explore',
    kind: 'marker',          // marker | xr | gyro | demo
    demo: false,
    started: false,
    markerVisible: false,
    universe: null,
    paused: false,
    speeds: [0.25, 1, 4, 12],
    speedIdx: 1,
    showOrbits: true,
    showLabels: true,
    yaw: 0,
    tilt: 0.35,
    scale: 0.6,
    defScale: 0.6,
    scaleMin: 0.24,
    scaleMax: 1.6,
    selected: null,
    xrPlaced: false
  };

  /* height of the system's center and default scale for each kind of AR
   * (marker: 1 unit = marker width; xr/gyro: 1 unit = 1 meter) */
  const KIND = {
    marker: { y: 0.3, scale: 0.6 },
    demo:   { y: 0,   scale: 0.85 },
    xr:     { y: 0.35, scale: 0.3 },
    gyro:   { y: 0,   scale: 0.28 }
  };
  function setScaleFor(kind) {
    App.kind = kind;
    App.demo = kind === 'demo';
    App.defScale = App.scale = KIND[kind].scale;
    App.scaleMin = App.defScale * 0.4;
    App.scaleMax = App.defScale * 2.7;
  }

  /* tiny on-device log: shown in the Help dialog so problems on a phone can be diagnosed */
  const Log = window.Log = {
    lines: [],
    add(msg) {
      this.lines.push(((performance.now() / 1000) | 0) + 's  ' + msg);
      if (this.lines.length > 40) this.lines.shift();
    },
    text() { return this.lines.join('\n'); }
  };
  window.addEventListener('error', (e) => { Log.add('ERROR ' + e.message); try { toast('⚠ ' + e.message, 'bad', 4000); } catch (x) { /* ignore */ } });
  window.addEventListener('unhandledrejection', (e) => { Log.add('REJECTED ' + (e.reason && e.reason.message || e.reason)); });

  function vibrate(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } }

  let toastTimer = 0;
  function toast(text, kind, ms) {
    const el = $('#toast');
    el.textContent = text;
    el.className = 'toast show ' + (kind || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast ' + (kind || ''); }, ms || 1400);
  }

  /* ======================================================================
   * 2. Texturi procedurale (nu avem nevoie de imagini externe)
   * ==================================================================== */
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  function blobs(g, r, w, h, colors, n, rmin, rmax, alpha) {
    g.globalAlpha = alpha;
    for (let i = 0; i < n; i++) {
      g.fillStyle = colors[Math.floor(r() * colors.length)];
      const x = r() * w, y = r() * h, rad = rmin + r() * (rmax - rmin);
      g.beginPath(); g.ellipse(x, y, rad, rad * (0.6 + r() * 0.5), r() * 3, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  }

  function planetTexture(p) {
    return canvasTex(256, 128, (g, w, h) => {
      const r = rng(p.seed);
      g.fillStyle = p.color; g.fillRect(0, 0, w, h);
      if (p.type === 'gas') {
        let y = 0;
        while (y < h) {
          const bh = 4 + r() * 16;
          g.fillStyle = p.bands[Math.floor(r() * p.bands.length)];
          g.globalAlpha = 0.75;
          for (let x = 0; x < w; x += 4) g.fillRect(x, y + Math.sin(x * 0.06 + y) * 2, 4, bh);
          y += bh;
        }
        g.globalAlpha = 1;
        if (p.spot) {
          g.fillStyle = p.spot.color; g.globalAlpha = 0.85;
          g.beginPath(); g.ellipse(p.spot.x * w, p.spot.y * h, p.spot.rx, p.spot.ry, 0, 0, Math.PI * 2); g.fill();
          g.globalAlpha = 1;
        }
      } else {
        const b = p.blobs;
        blobs(g, r, w, h, b.colors, b.n, b.rmin, b.rmax, b.alpha);
        if (p.clouds) blobs(g, r, w, h, ['#ffffff'], 30, 6, 22, 0.4);
        if (p.caps) {
          g.fillStyle = '#f2f6ff'; g.globalAlpha = 0.95;
          g.fillRect(0, 0, w, 7); g.fillRect(0, h - 7, w, 7);
          g.globalAlpha = 1;
        }
      }
    });
  }

  function sunTexture() {
    return canvasTex(256, 128, (g, w, h) => {
      const r = rng(99);
      g.fillStyle = '#ff9d00'; g.fillRect(0, 0, w, h);
      blobs(g, r, w, h, ['#ffd24a', '#ff7a00', '#ffe27a'], 160, 3, 12, 0.5);
    });
  }

  function glowTexture(inner, outer) {
    return canvasTex(128, 128, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, inner); gr.addColorStop(0.35, outer); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
  }

  function ringTexture() {
    return canvasTex(128, 128, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = '#fff'; g.lineWidth = 9;
      g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 8, 0, Math.PI * 2); g.stroke();
    });
  }

  function labelSprite(text) {
    const tex = canvasTex(256, 64, (g, w, h) => {
      g.fillStyle = 'rgba(5,8,22,0.62)';
      g.beginPath(); g.roundRect ? g.roundRect(4, 6, w - 8, h - 12, 22) : g.rect(4, 6, w - 8, h - 12); g.fill();
      g.fillStyle = '#fff'; g.font = '600 32px system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 1);
    });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    s.scale.set(0.26, 0.065, 1);
    s.renderOrder = 10;
    return s;
  }

  function textSprite(text, color) {
    const tex = canvasTex(256, 96, (g, w, h) => {
      g.font = '800 64px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.7)'; g.strokeText(text, w / 2, h / 2);
      g.fillStyle = color; g.fillText(text, w / 2, h / 2);
    });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    s.scale.set(0.24, 0.09, 1);
    s.renderOrder = 12;
    return s;
  }

  /* ======================================================================
   * 3. Componenta "universe"
   * ==================================================================== */
  AFRAME.registerComponent('universe', {
    init() {
      const root = this.el.object3D;
      this.root = root;
      this.center = new THREE.Group();
      this.center.position.y = KIND[App.kind].y;          // floats above the marker / floor
      if (App.kind === 'xr') root.visible = false;         // appears once the user places it
      root.add(this.center);
      this.spin = new THREE.Group();                      // rotated by dragging
      this.center.add(this.spin);
      this.gameGroup = new THREE.Group();                 // asteroids + effects (does not rotate)
      this.center.add(this.gameGroup);

      this.pickables = [];                                // tappable objects (raycast)
      this.byId = {};
      this.fx = [];                                       // temporary effects (explosions, rings, floating text)
      this.ringTex = ringTexture();

      this.buildSun();
      this.buildPlanets();
      if (App.demo) this.buildStars();

      this.rockGeos = [0, 1, 2].map((i) => this.makeRockGeo(i + 1));
      this.glowGold = glowTexture('rgba(255,230,120,1)', 'rgba(255,170,0,.45)');
      this.glowIce = glowTexture('rgba(190,245,255,1)', 'rgba(80,190,255,.4)');

      App.universe = this;
      this.applyToggles();
    },

    /* ---------- construction ---------- */
    buildSun() {
      const mat = new THREE.MeshBasicMaterial({ map: sunTexture() });
      this.sun = new THREE.Mesh(new THREE.SphereGeometry(0.14, 32, 20), mat);
      this.spin.add(this.sun);

      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture('rgba(255,230,150,1)', 'rgba(255,150,30,.35)'),
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true
      }));
      glow.scale.set(0.75, 0.75, 1);
      this.center.add(glow);

      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
      hit.userData = { kind: 'planet', id: 'sun', baseR: 0.2 };
      this.sun.add(hit);
      this.pickables.push(hit);
      this.byId.sun = { mesh: this.sun, size: 0.14, data: SUN };
    },

    buildPlanets() {
      this.orbitLines = [];
      this.labels = [];
      this.planets = PLANETS.map((p) => {
        const pivot = new THREE.Group();
        pivot.rotation.y = Math.random() * Math.PI * 2;
        this.spin.add(pivot);

        const holder = new THREE.Group();            // position on the orbit (does not spin on its axis)
        holder.position.x = p.orbit;
        pivot.add(holder);
        const mat = new THREE.MeshStandardMaterial({ map: planetTexture(p), roughness: 0.95, metalness: 0 });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(p.size, 28, 18), mat);   // only the globe spins
        holder.add(mesh);

        if (p.rings) {
          const thin = p.rings === 'thin';
          const inner = p.size * (thin ? 1.5 : 1.35), outer = p.size * (thin ? 1.75 : 2.3);
          const rg = new THREE.RingGeometry(inner, outer, 64, 1);
          // radial UVs so the texture becomes concentric bands
          const pos = rg.attributes.position, uv = rg.attributes.uv, v = new THREE.Vector3();
          for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i);
            uv.setXY(i, (v.length() - inner) / (outer - inner), 0.5);
          }
          const tex = canvasTex(64, 4, (g, w, h) => {
            for (let x = 0; x < w; x++) {
              const a = 0.25 + 0.6 * Math.abs(Math.sin(x * 0.55)) * (x > 20 && x < 24 ? 0.2 : 1);
              g.fillStyle = thin ? 'rgba(200,235,240,' + (a * 0.5) + ')' : 'rgba(225,205,160,' + a + ')';
              g.fillRect(x, 0, 1, h);
            }
          });
          const ring = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, depthWrite: false }));
          ring.rotation.x = Math.PI / 2 - (thin ? 1.2 : 0.45);
          holder.add(ring);
        }

        const hitR = Math.max(p.size * 1.6, 0.075);
        const hit = new THREE.Mesh(new THREE.SphereGeometry(hitR, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
        hit.userData = { kind: 'planet', id: p.id, baseR: hitR };
        holder.add(hit);
        this.pickables.push(hit);

        const label = labelSprite(p.name);
        label.position.y = p.size + 0.07;
        holder.add(label);
        this.labels.push(label);

        // orbit line
        const pts = [];
        for (let i = 0; i <= 96; i++) {
          const a = (i / 96) * Math.PI * 2;
          pts.push(new THREE.Vector3(Math.cos(a) * p.orbit, 0, Math.sin(a) * p.orbit));
        }
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 })
        );
        this.spin.add(line);
        this.orbitLines.push(line);

        const entry = { data: p, pivot, mesh, angVel: 0.26 / Math.sqrt(p.period) };
        this.byId[p.id] = { mesh: holder, size: p.size, data: p };
        return entry;
      });
    },

    buildStars() {
      const n = 500, arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const v = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(5, 9));
        arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      this.root.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.022, sizeAttenuation: true })));
    },

    makeRockGeo(seed) {
      const g = new THREE.IcosahedronGeometry(1, 1);
      const r = rng(seed * 31), pos = g.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        v.multiplyScalar(0.78 + r() * 0.4);
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      g.computeVertexNormals();
      return g;
    },

    /* ---------- orbit / label visibility ---------- */
    applyToggles() {
      const labelsOn = App.showLabels && App.mode !== 'quiz';   // hide names in the quiz (they would give the answer away)
      this.orbitLines.forEach((l) => { l.visible = App.showOrbits; });
      this.labels.forEach((l) => { l.visible = labelsOn; });
    },

    /* ---------- effects ---------- */
    ring(id, color, dur) {
      const e = this.byId[id];
      if (!e) return;
      const mat = new THREE.SpriteMaterial({ map: this.ringTex, color, depthTest: false, transparent: true });
      const s = new THREE.Sprite(mat);
      s.renderOrder = 11;
      e.mesh.add(s);
      this.fx.push({ type: 'ring', obj: s, mesh: e.mesh, base: Math.max(e.size * 3.4, 0.16), t: 0, dur: dur || 1.2 });
    },

    clearRings() {
      this.fx = this.fx.filter((f) => {
        if (f.type !== 'ring') return true;
        f.mesh.remove(f.obj); f.obj.material.dispose(); return false;
      });
    },

    explode(pos, color) {
      const group = new THREE.Group();
      group.position.copy(pos);
      const parts = [];
      for (let i = 0; i < 14; i++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.014, 5, 4), new THREE.MeshBasicMaterial({ color, transparent: true }));
        const dir = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(0.3, 0.9));
        parts.push({ m, dir });
        group.add(m);
      }
      this.gameGroup.add(group);
      this.fx.push({ type: 'boom', obj: group, parts, t: 0, dur: 0.6 });
    },

    floatText(pos, text, color) {
      const s = textSprite(text, color);
      s.position.copy(pos);
      this.gameGroup.add(s);
      this.fx.push({ type: 'text', obj: s, t: 0, dur: 0.9 });
    },

    updateFx(dt) {
      for (let i = this.fx.length - 1; i >= 0; i--) {
        const f = this.fx[i];
        f.t += dt;
        const k = clamp(f.t / f.dur, 0, 1);
        if (f.type === 'ring') {
          const pulse = 1 + 0.12 * Math.sin(f.t * 9);
          f.obj.scale.setScalar(f.base * pulse);
          f.obj.material.opacity = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
          if (k >= 1) { f.mesh.remove(f.obj); f.obj.material.dispose(); this.fx.splice(i, 1); }
        } else if (f.type === 'boom') {
          f.parts.forEach((p) => {
            p.m.position.copy(p.dir).multiplyScalar(k);
            p.m.material.opacity = 1 - k;
          });
          if (k >= 1) {
            this.gameGroup.remove(f.obj);
            f.parts.forEach((p) => { p.m.geometry.dispose(); p.m.material.dispose(); });
            this.fx.splice(i, 1);
          }
        } else if (f.type === 'text') {
          f.obj.position.y += dt * 0.25;
          f.obj.material.opacity = 1 - k * k;
          if (k >= 1) { this.gameGroup.remove(f.obj); f.obj.material.map.dispose(); f.obj.material.dispose(); this.fx.splice(i, 1); }
        }
      }
    },

    /* ---------- main loop ---------- */
    tick(time, dtMs) {
      const dt = Math.min(dtMs, 100) / 1000;
      this.root.scale.setScalar(App.scale);
      this.spin.rotation.set(App.tilt, App.yaw, 0);

      if (!App.markerVisible) return;

      if (!App.paused) {
        const mul = App.speeds[App.speedIdx];
        this.planets.forEach((pl) => {
          pl.pivot.rotation.y += pl.angVel * dt * mul;
          pl.mesh.rotation.y += pl.data.spin * dt * 0.25 * Math.min(mul, 4);
        });
        this.sun.rotation.y += dt * 0.1;
      }
      Game.update(dt);
      this.updateFx(dt);
    }
  });

  /* ======================================================================
   * 4a. EXPLORE mode (educational)
   * ==================================================================== */
  const Explore = {
    order: ['sun'].concat(PLANETS.map((p) => p.id)),

    select(id) {
      const U = App.universe;
      if (U) { U.clearRings(); U.ring(id, 0xffffff, 60); }
      App.selected = id;
      this.showInfo(id);
      Sfx.select(this.order.indexOf(id));
      let active = null;
      document.querySelectorAll('#strip .chipbtn').forEach((b) => {
        const on = b.dataset.id === id;
        b.classList.toggle('active', on);
        if (on) active = b;
      });
      const strip = $('#strip');
      if (active && strip.scrollTo) strip.scrollTo({ left: active.offsetLeft - (strip.clientWidth - active.clientWidth) / 2, behavior: 'smooth' });
    },
    step(dir) {                                   // Previous / Next buttons on the info card
      const n = this.order.length, i = this.order.indexOf(App.selected);
      this.select(this.order[i < 0 ? (dir > 0 ? 0 : n - 1) : (i + dir + n) % n]);
    },
    showInfo(id) {
      const d = id === 'sun' ? SUN : PLANETS.find((p) => p.id === id);
      $('#i-name').textContent = (id === 'sun' ? '☀️ ' : '🪐 ') + d.name;
      const rows = [['Diameter', d.diameter], ['Distance from Sun', d.distance], ['Year', d.year],
        ['Day', d.day], ['Temperature', d.temp], ['Moons', d.moons]]
        .filter((r) => r[1] && r[1] !== '—');
      $('#i-grid').innerHTML = rows.map((r) => '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>').join('');
      $('#i-fact').textContent = d.fact;
      $('#info').classList.remove('hidden');
    },
    hideInfo() {
      $('#info').classList.add('hidden');
      App.selected = null;
      document.querySelectorAll('#strip .chipbtn.active').forEach((b) => b.classList.remove('active'));
      if (App.universe) App.universe.clearRings();
    },
    onTap(hit) {
      if (hit && hit.kind === 'planet') { vibrate(15); this.select(hit.id); }
      else if (App.selected) this.hideInfo();
    }
  };

  /* ======================================================================
   * 4b. QUIZ mode
   * ==================================================================== */
  const Quiz = {
    total: 8, list: [], i: 0, score: 0, locked: false,
    start() {
      this.list = QUIZ.slice().sort(() => Math.random() - 0.5).slice(0, this.total);
      this.i = 0; this.score = 0; this.locked = false;
      Explore.hideInfo();
      this.render();
    },
    render() {
      $('#quiz-progress').textContent = 'Question ' + (this.i + 1) + '/' + this.total;
      $('#quiz-score').textContent = this.score + ' pts';
      $('#quiz-q').textContent = this.list[this.i].q;
    },
    onTap(hit) {
      if (this.locked) return;
      if (!hit || hit.kind !== 'planet') return;
      if (hit.id === 'sun') { toast('The Sun is a star, not a planet 😉', 'bad'); return; }
      const q = this.list[this.i], U = App.universe;
      this.locked = true;
      const ok = hit.id === q.a;
      if (ok) {
        this.score += 10;
        U.ring(hit.id, 0x3ddc84, 1.2);
        toast('✔ Correct! +10', 'good'); Sfx.good(); vibrate(40);
      } else {
        const right = PLANETS.find((p) => p.id === q.a).name;
        U.ring(hit.id, 0xff5d6c, 1.2);
        U.ring(q.a, 0x3ddc84, 1.6);
        toast('✘ It was ' + right, 'bad', 1800); Sfx.bad(); vibrate([60, 40, 60]);
      }
      $('#quiz-score').textContent = this.score + ' pts';
      setTimeout(() => {
        this.i++;
        this.locked = false;
        if (this.i >= this.total) this.finish(); else this.render();
      }, ok ? 1100 : 1900);
    },
    finish() {
      const best = Math.max(store.get('ar_best_quiz', 0), this.score);
      store.set('ar_best_quiz', best);
      const max = this.total * 10;
      const msg = this.score >= max * 0.9 ? 'Excellent! You are a true astronomer 🚀'
        : this.score >= max * 0.6 ? 'Well done! Explore a bit more and you will be an expert 🌍'
        : 'You can do better — try Explore mode and come back 🔭';
      Sfx.setMood('calm');
      if (this.score >= max * 0.6) Sfx.win();
      UI.modal('Quiz results',
        '<div class="big">' + this.score + '/' + max + '</div><p class="center">' + msg + '</p><p class="center">Best score: <b>' + best + '</b></p>',
        [{ label: 'Play again', primary: true, fn: () => { Sfx.setMood('quiz'); this.start(); } },
         { label: 'Explore', fn: () => UI.setMode('explore') }]);
    }
  };

  /* ======================================================================
   * 4c. GAME mode — “Defend the Sun”
   * ==================================================================== */
  const Game = {
    running: false, score: 0, lives: 3, level: 1, kills: 0,
    spawnT: 0, slowT: 0, flashT: 0, items: [],

    start() {
      this.clear();
      Explore.hideInfo();
      this.running = true;
      this.score = 0; this.lives = 3; this.level = 1; this.kills = 0;
      this.spawnT = 0.8; this.slowT = 0; this.flashT = 0;
      this.refreshHud();
      Sfx.setMood('game'); Sfx.setLevel(1);
    },
    stop() { this.running = false; this.clear(); },
    clear() {
      const U = App.universe;
      this.items.forEach((a) => { if (U) U.gameGroup.remove(a.obj); a.obj.traverse((o) => { if (o.material) o.material.dispose(); }); });
      this.items = [];
    },

    refreshHud() {
      $('#g-score').textContent = this.score;
      $('#g-level').textContent = this.level;
      $('#g-best').textContent = store.get('ar_best_game', 0);
      $('#g-lives').textContent = '♥'.repeat(Math.max(this.lives, 0)) + '♡'.repeat(Math.max(3 - this.lives, 0));
      $('#g-slow').classList.toggle('hidden', this.slowT <= 0);
    },

    spawn() {
      const U = App.universe;
      const roll = Math.random();
      const kind = roll < 0.09 ? 'gold' : (roll < 0.3 && this.level >= 2 ? 'comet' : 'rock');
      const az = rand(0, Math.PI * 2), el = rand(-0.15, 1.0), dist = 1.6;
      const pos = new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).multiplyScalar(dist);
      const obj = new THREE.Group();
      obj.position.copy(pos);
      let size, speed, body;

      if (kind === 'rock') {
        size = rand(0.045, 0.075); speed = 0.34;
        body = new THREE.Mesh(U.rockGeos[Math.floor(Math.random() * 3)],
          new THREE.MeshStandardMaterial({ color: 0x8c7b6b, flatShading: true, roughness: 1 }));
        body.scale.setScalar(size);
      } else if (kind === 'comet') {
        size = 0.035; speed = 0.62;
        body = new THREE.Mesh(new THREE.SphereGeometry(size, 12, 8), new THREE.MeshBasicMaterial({ color: 0xaaf0ff }));
        const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: U.glowIce, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
        gl.scale.setScalar(0.22);
        obj.add(gl);
      } else {
        size = 0.05; speed = 0.3;
        body = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 1), new THREE.MeshStandardMaterial({ color: 0xffc400, emissive: 0xaa7700, flatShading: true, roughness: 0.4, metalness: 0.5 }));
        const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: U.glowGold, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
        gl.scale.setScalar(0.26);
        obj.add(gl);
      }
      obj.add(body);

      const hitR = Math.max(size * 2.2, 0.11);
      const hit = new THREE.Mesh(new THREE.SphereGeometry(hitR, 6, 5), new THREE.MeshBasicMaterial({ visible: false }));
      const item = { obj, body, kind, size, speed: speed * (1 + 0.12 * (this.level - 1)), dead: false,
        spinAxis: new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(), spinSpd: rand(1, 3) };
      hit.userData = { kind: 'asteroid', item, baseR: hitR };
      obj.add(hit);
      item.hit = hit;
      U.gameGroup.add(obj);
      this.items.push(item);
    },

    get pickables() { return this.items.map((a) => a.hit); },

    update(dt) {
      const U = App.universe;
      if (App.mode !== 'game' || !this.running) return;

      if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0) this.refreshHud(); }
      const tscale = this.slowT > 0 ? 0.4 : 1;
      const d = dt * tscale;

      // spawn
      this.spawnT -= d;
      if (this.spawnT <= 0 && this.items.length < 9) {
        this.spawn();
        this.spawnT = Math.max(0.45, 1.5 - 0.1 * (this.level - 1)) * rand(0.7, 1.3);
      }

      // movement + collision with the Sun
      for (let i = this.items.length - 1; i >= 0; i--) {
        const a = this.items[i];
        const p = a.obj.position, len = p.length();
        p.multiplyScalar(Math.max(len - a.speed * d, 0) / len);
        a.body.rotateOnAxis(a.spinAxis, a.spinSpd * d);
        if (len < 0.18) this.damage(a, i);
      }

      // red flash of the Sun
      if (this.flashT > 0) {
        this.flashT -= dt;
        U.sun.material.color.setRGB(1, this.flashT > 0 ? 0.25 : 1, this.flashT > 0 ? 0.25 : 1);
      }
    },

    remove(a, idx) {
      const U = App.universe;
      U.gameGroup.remove(a.obj);
      a.obj.traverse((o) => { if (o.material) o.material.dispose(); });
      this.items.splice(idx, 1);
    },

    damage(a, idx) {
      const U = App.universe;
      U.explode(a.obj.position.clone(), 0xff5533);
      this.remove(a, idx);
      this.lives--; this.flashT = 0.35;
      Sfx.hurt(); vibrate(160);
      this.refreshHud();
      if (this.lives <= 0) this.over();
    },

    onTap(hit) {
      if (!this.running) return;
      if (!hit || hit.kind !== 'asteroid') { Sfx.miss(); return; }
      const a = hit.item;
      const idx = this.items.indexOf(a);
      if (idx < 0) return;
      const U = App.universe;
      const pos = a.obj.position.clone();
      const pts = a.kind === 'comet' ? 25 : a.kind === 'gold' ? 15 : 10;
      const col = a.kind === 'gold' ? 0xffd24a : a.kind === 'comet' ? 0x8fe8ff : 0xcfb59a;
      U.explode(pos, col);
      U.floatText(pos.clone().multiplyScalar(1.05), '+' + pts, a.kind === 'gold' ? '#ffd24a' : '#ffffff');
      this.remove(a, idx);
      this.score += pts; this.kills++;
      if (a.kind === 'gold') {
        this.slowT = 5; Sfx.power(); toast('⏱ Slow motion for 5 s!', 'good');
      } else { Sfx.zap(); Sfx.boom(); }
      vibrate(25);
      if (this.kills % 10 === 0) {
        this.level++; Sfx.level(); Sfx.setLevel(this.level); toast('Level ' + this.level + ' 🔥', 'good');
      }
      this.refreshHud();
    },

    over() {
      this.running = false;
      Sfx.over();
      const best = Math.max(store.get('ar_best_game', 0), this.score);
      const isRecord = this.score > store.get('ar_best_game', 0);
      store.set('ar_best_game', best);
      this.refreshHud();
      const fact = FACTS[Math.floor(Math.random() * FACTS.length)];
      Sfx.setMood('calm');
      UI.modal('The Sun was hit! 💥',
        '<div class="big">' + this.score + '</div>' +
        '<p class="center">' + (isRecord ? '🏆 New record!' : 'Best: <b>' + best + '</b>') + ' · Level ' + this.level + '</p>' +
        '<div class="fact">💡 Did you know… ' + fact + '</div>',
        [{ label: 'Play again', primary: true, fn: () => this.start() },
         { label: 'Explore', fn: () => UI.setMode('explore') }]);
    }
  };

  App.Quiz = Quiz; App.Game = Game;   // exposed for debugging/tests

  /* ======================================================================
   * 5. Gesturi: drag = rotire, pinch = scalare, tap = selectare
   * ==================================================================== */
  const Input = (function () {
    const pointers = new Map();
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let pinch = null;

    const ignore = (e) => !App.started || !!e.target.closest('button, .card, .overlay, .hud, #nav, #strip, #tools');
    const gesturesOn = () => App.mode !== 'game';

    // Finger-friendly picking: choose the object whose direction is closest to the touch ray,
    // within an ANGULAR tolerance. This works the same whether the object is 30 cm or 4 m away
    // (a fixed size in metres becomes far too small to hit once the object is a few metres from you).
    const TOL = { xr: 0.11, gyro: 0.11, marker: 0.09, demo: 0.07 };     // radians (0.11 ≈ 6°)
    const tmpV = new THREE.Vector3();
    function best(list) {
      const o = raycaster.ray.origin, dir = raycaster.ray.direction;
      const tol = TOL[App.kind] || 0.09;
      let bestObj = null, bestScore = Infinity;
      list.forEach((h) => {
        h.getWorldPosition(tmpV).sub(o);
        const d = tmpV.length();
        if (d < 0.05) return;
        const cos = tmpV.dot(dir) / d;
        if (cos <= 0) return;                                           // behind the camera
        const ang = Math.acos(Math.min(1, cos));
        const rAng = Math.asin(Math.min(1, (h.userData.baseR * App.scale * 0.5) / d));   // the object's own size
        if (ang <= tol + rAng && ang < bestScore) { bestScore = ang; bestObj = h; }   // nearest centre wins
      });
      return bestObj ? bestObj.userData : null;
    }

    function candidates() {
      const U = App.universe;
      return App.mode === 'game' ? Game.pickables : (U ? U.pickables : []);
    }

    function pick(x, y) {                       // from a screen point (marker / 3DoF / demo)
      const sceneEl = $('a-scene');
      const xr = sceneEl && sceneEl.renderer && sceneEl.renderer.xr;
      const cam = xr && xr.isPresenting ? xr.getCamera() : (sceneEl && sceneEl.camera);
      if (!cam || !App.universe || !App.markerVisible) return null;
      ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
      raycaster.setFromCamera(ndc, cam);
      return best(candidates());
    }

    function pickRay(origin, dir) {             // from a WebXR input ray
      if (!App.universe || !App.markerVisible) return null;
      raycaster.ray.origin.copy(origin);
      raycaster.ray.direction.copy(dir).normalize();
      return best(candidates());
    }

    function dispatch(hit) {
      XR_LOG.taps++;
      if (App.kind === 'xr' && !App.xrPlaced) { XR.place(); return; }
      if (App.mode === 'explore') Explore.onTap(hit);
      else if (App.mode === 'quiz') Quiz.onTap(hit);
      else Game.onTap(hit);
    }

    function ripple(x, y) {                        // visible confirmation that the tap registered
      const r = document.createElement('div');
      r.className = 'ripple'; r.style.left = x + 'px'; r.style.top = y + 'px';
      $('#app-ui').appendChild(r);
      setTimeout(() => r.remove(), 450);
    }

    function tap(x, y) { ripple(x, y); dispatch(pick(x, y)); }

    window.addEventListener('pointerdown', (e) => {
      if (ignore(e)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 });
      if (pointers.size === 2 && gesturesOn()) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: App.scale };
      }
    });

    window.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY; p.moved += Math.abs(dx) + Math.abs(dy);
      if (!gesturesOn()) return;
      if (pointers.size === 1) {
        App.yaw += dx * 0.009;
        App.tilt = clamp(App.tilt + dy * 0.005, -0.4, 1.3);
      } else if (pointers.size === 2 && pinch) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        App.scale = clamp(pinch.s * (d / pinch.d), App.scaleMin, App.scaleMax);
      }
    });

    function end(e) {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const wasSingle = pointers.size === 1;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      // in WebXR taps arrive as `select` events with an exact ray (see xr-placement), not as pointer events
      if (e.type === 'pointerup' && wasSingle && p.moved < 14 && performance.now() - p.t < 450) {
        if (App.kind !== 'xr') tap(e.clientX, e.clientY);
        else {
          // safety net: if the AR session does not deliver a `select` for this touch, fall back to the screen point
          const t0 = performance.now(), x = e.clientX, y = e.clientY;
          ripple(x, y);
          setTimeout(() => { if (XR_LOG.lastSelect < t0 - 80) { Log.add('tap fallback (no select event)'); dispatch(pick(x, y)); } }, 300);
        }
      }
    }
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);

    // desktop: mouse wheel = zoom
    window.addEventListener('wheel', (e) => {
      if (!App.started || !gesturesOn() || e.target.closest('.overlay, .card')) return;
      App.scale = clamp(App.scale * (e.deltaY < 0 ? 1.08 : 0.92), App.scaleMin, App.scaleMax);
    }, { passive: true });

    window.addEventListener('contextmenu', (e) => e.preventDefault());
    return { pick, pickRay, dispatch };
  })();

  const XR_LOG = { taps: 0, lastSelect: 0 };

  /* ======================================================================
   * 6. UI + scene start-up
   * ==================================================================== */
  let coachTimer = 0;
  function coach(text, ms) {
    const el = $('#coach');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(coachTimer);
    coachTimer = setTimeout(() => el.classList.remove('show'), ms || 6000);
  }

  function buildStrip() {
    const strip = $('#strip');
    strip.innerHTML = [SUN].concat(PLANETS).map((d) => {
      const color = d.id === 'sun' ? '#ffb300' : d.color;
      return '<button class="chipbtn" data-id="' + d.id + '"><i style="background:' + color + ';color:' + color + '"></i>' +
        (d.id === 'sun' ? 'Sun' : d.name) + '</button>';
    }).join('');
    strip.addEventListener('click', (e) => {
      const b = e.target.closest('.chipbtn');
      if (b) { vibrate(10); Explore.select(b.dataset.id); }
    });
  }

  const UI = {
    setMode(m) {
      if (m === App.mode && App.universe) { if (m === 'quiz') Quiz.start(); else if (m === 'game') Game.start(); return; }
      this.closeModal();
      Game.stop();
      Explore.hideInfo();
      App.mode = m;
      document.body.dataset.mode = m;
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.mode === m));
      if (App.universe) App.universe.applyToggles();
      if (m === 'quiz') Quiz.start();
      if (m === 'game') Game.start();
      Sfx.setMood(m === 'quiz' ? 'quiz' : m === 'game' ? 'game' : 'calm');
      coach(this.COACH[m]);
      this.updateHint();
    },

    COACH: {
      explore: 'Tap a planet — or pick one in the bar below. Drag to rotate, pinch to zoom.',
      quiz:    'Tap the planet that answers the question. Planet names are hidden!',
      game:    'Tap the asteroids before they hit the Sun. Golden ones slow down time.'
    },

    HINTS: {
      marker:    ['⌗', 'Point the camera at the <b>Hiro marker</b>', 'Keep it well lit and fully in view'],
      xrSearch:  ['📱', 'Move your phone <b>slowly</b> and look at the floor or a table', 'Looking for a flat surface… (it appears in front of you if none is found)'],
      xrReady:   ['📍', 'Surface found — <b>hold steady</b>', 'The universe will appear here automatically']
    },

    updateHint() {
      const el = $('#hint');
      const show = App.started && !App.markerVisible;
      el.classList.toggle('hidden', !show);
      if (!show) return;
      const key = App.kind === 'xr' ? (XR.state === 'ready' ? 'xrReady' : 'xrSearch') : 'marker';
      const h = this.HINTS[key];
      $('#hint-ico').textContent = h[0];
      $('#hint-text').innerHTML = h[1];
      $('#hint-small').textContent = h[2];
    },

    modal(title, html, actions) {
      $('#m-title').textContent = title;
      $('#m-body').innerHTML = html;
      const box = $('#m-actions');
      box.innerHTML = '';
      (actions || [{ label: 'OK', primary: true }]).forEach((a) => {
        const b = document.createElement('button');
        b.textContent = a.label;
        b.className = a.primary ? 'primary' : 'secondary';
        b.addEventListener('click', () => { Sfx.ui(); this.closeModal(); if (a.fn) a.fn(); });
        box.appendChild(b);
      });
      $('#modal').classList.remove('hidden');
    },
    closeModal() { $('#modal').classList.add('hidden'); },

    help() {
      const extra = {
        marker: '<li><b>Marker:</b> if the marker leaves the camera view, everything pauses until you find it again.</li>',
        xr:     '<li><b>📍 Move:</b> picks the universe up so you can place it somewhere else.</li>',
        gyro:   '<li><b>📍 Move:</b> re-centers the universe in front of you.</li>',
        demo:   '<li><b>Demo:</b> mouse wheel zooms, drag rotates.</li>'
      }[App.kind] || '';
      this.modal('How to use',
        '<ul>' +
        '<li><b>🔭 Explore</b> — tap a planet (or pick one in the bar at the bottom) to see its facts, and use ◀ ▶ to browse. Drag to rotate, pinch to zoom. Tools on the right: Pause, Speed, Orbits, Names, Reset.</li>' +
        '<li><b>🎯 Quiz</b> — read the question and tap the right planet. Names are hidden!</li>' +
        '<li><b>☄️ Game</b> — tap asteroids before they hit the Sun. Blue comets are fast (+25), golden asteroids slow time. You have 3 lives.</li>' +
        '<li><b>🎵 🔊</b> — turn music and sound effects on or off. <b>🏠</b> goes back to the menu.</li>' +
        extra +
        '</ul>' +
        '<details class="diag"><summary>Diagnostics</summary><pre>' + (navigator.userAgent.replace(/</g, '&lt;')) + '\nmode: ' + App.kind +
        ' · xrSupported: ' + App.xrSupported + '\n' + Log.text().replace(/</g, '&lt;') + '</pre></details>');
    }
  };

  /* ---------- Markerless AR, option 1: WebXR (Android/Chrome) — hit-test on real surfaces ---------- */
  const XR = {
    hitSource: null, reticle: null, state: 'search', active: false,
    elapsed: 0, stable: 0, last: null,

    setState(st) { if (st !== this.state) { this.state = st; UI.updateHint(); } },

    reset() { this.elapsed = 0; this.stable = 0; this.last = null; this.setState('search'); },

    /* called every frame while waiting for a placement.
     * `pos` = latest surface hit (Vector3) or null.
     * A surface that stays put for 1 s is used automatically; after 7 s without one the
     * universe is placed in front of the user so something always appears. */
    step(dt, pos) {
      if (App.xrPlaced) return;
      this.elapsed += dt;
      if (pos) {
        this.stable = (this.last && this.last.distanceTo(pos) < 0.15) ? this.stable + dt : 0;
        this.last = (this.last || new THREE.Vector3()).copy(pos);
        this.setState('ready');
        if (this.stable >= 1.0) { this.placeAt(this.last, 'surface'); return; }
      } else {
        this.stable = 0; this.last = null;
        this.setState('search');
      }
      if (this.elapsed > 7) this.placeInFront();
    },

    placeAt(pos, how) {
      const w = $('#world').object3D;
      w.position.copy(pos);
      w.visible = true;
      App.xrPlaced = true;
      if (this.reticle) this.reticle.visible = false;
      setMarker(true);
      Log.add('placed (' + how + ') at ' + [pos.x, pos.y, pos.z].map((n) => n.toFixed(2)).join(', '));
      Sfx.place(); vibrate(30);
      toast(how === 'surface' ? 'Placed! Walk around it 🚶' : 'No surface found — placed in front of you. Use 📍 Move to try again', how === 'surface' ? 'good' : '', how === 'surface' ? 1800 : 3500);
    },

    placeInFront() {
      const cam = $('a-scene').camera;
      const dir = new THREE.Vector3(), pos = new THREE.Vector3();
      cam.getWorldDirection(dir); dir.y = 0;
      if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
      dir.normalize();
      cam.getWorldPosition(pos);
      this.placeAt(new THREE.Vector3(pos.x + dir.x * 1.1, pos.y - 0.45, pos.z + dir.z * 1.1), 'in front');
    },

    place() {                                      // user tapped while searching: place right now
      if (this.reticle && this.reticle.visible) this.placeAt(new THREE.Vector3().setFromMatrixPosition(this.reticle.matrix), 'surface');
      else this.placeInFront();
    },

    replace() {                                    // 📍 Move: pick the universe up and search again
      App.xrPlaced = false;
      $('#world').object3D.visible = false;
      Game.stop(); Explore.hideInfo();
      setMarker(false);
      this.reset();
      Sfx.ui();
    }
  };

  AFRAME.registerComponent('xr-placement', {
    init() {
      const sceneEl = this.el;
      const mat = new THREE.MeshBasicMaterial({ color: 0x6aa8ff, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.13, 40).rotateX(-Math.PI / 2), mat);
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.015, 16).rotateX(-Math.PI / 2), mat);
      ring.add(dot);
      ring.matrixAutoUpdate = false;
      ring.visible = false;
      sceneEl.object3D.add(ring);
      XR.reticle = ring;
      const tmpO = new THREE.Vector3(), tmpD = new THREE.Vector3(), tmpQ = new THREE.Quaternion();

      // a tap in the AR session = XR `select` event with an exact ray from the screen point
      const onSelect = (ev) => {
        Log.add('select event');
        if (!App.xrPlaced) { XR_LOG.lastSelect = performance.now(); XR.place(); return; }
        const ref = sceneEl.renderer.xr.getReferenceSpace();
        const pose = ev.frame && ev.inputSource && ev.frame.getPose(ev.inputSource.targetRaySpace, ref);
        if (!pose) { Log.add('select: no pose'); return; }
        const t = pose.transform;
        tmpO.set(t.position.x, t.position.y, t.position.z);
        tmpD.set(0, 0, -1).applyQuaternion(tmpQ.set(t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w));
        XR_LOG.lastSelect = performance.now();
        const hit = Input.pickRay(tmpO, tmpD);
        Log.add('ray tap -> ' + (hit ? (hit.id || hit.kind) : 'nothing'));
        Input.dispatch(hit);
      };

      sceneEl.addEventListener('enter-vr', () => {
        if (!sceneEl.is('ar-mode')) return;
        const session = sceneEl.renderer.xr.getSession();
        Log.add('AR session started');
        XR.active = true; XR.reset();
        if (!session) return;
        session.addEventListener('select', onSelect);
        if (!session.requestHitTestSource) { Log.add('hit-test not available'); return; }
        session.requestReferenceSpace('viewer')
          .then((vs) => session.requestHitTestSource({ space: vs }))
          .then((src) => { XR.hitSource = src; Log.add('hit-test source ready'); })
          .catch((e) => Log.add('hit-test failed: ' + (e && e.message || e)));
      });
      sceneEl.addEventListener('exit-vr', () => { XR.hitSource = null; XR.active = false; location.reload(); });
    },
    tick(time, dtMs) {
      if (!XR.active || App.xrPlaced) return;
      const dt = Math.min(dtMs, 100) / 1000;
      let pos = null;
      const frame = this.el.frame;
      if (frame && XR.hitSource) {
        try {
          const res = frame.getHitTestResults(XR.hitSource);
          const pose = res.length ? res[0].getPose(this.el.renderer.xr.getReferenceSpace()) : null;
          if (pose) {
            XR.reticle.visible = true;
            XR.reticle.matrix.fromArray(pose.transform.matrix);
            XR.reticle.matrixWorldNeedsUpdate = true;
            pos = new THREE.Vector3().setFromMatrixPosition(XR.reticle.matrix);
            if (!XR.sawHit) { XR.sawHit = true; Log.add('first surface hit'); }
          } else XR.reticle.visible = false;
        } catch (e) { Log.add('hit-test error: ' + e.message); }
      }
      XR.step(dt, pos);
    }
  });

  /* ---------- Markerless AR, option 2: “3DoF” (works on iPhone too) — camera + gyroscope ---------- */
  const Gyro = {
    async startCamera() {
      const v = document.createElement('video');
      v.id = 'cam'; v.autoplay = true; v.muted = true; v.setAttribute('playsinline', '');
      document.body.insertBefore(v, document.body.firstChild);
      try {
        v.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        await v.play();
      } catch (e) {
        toast('Camera unavailable — the app still works without it', 'bad', 3500);
      }
    },
    // puts the universe ~1.2 m in front of where you are looking right now
    recenter() {
      const sceneEl = $('a-scene'), cam = sceneEl && sceneEl.camera, w = $('#world');
      if (!cam || !w) return;
      const dir = new THREE.Vector3(), pos = new THREE.Vector3();
      cam.getWorldDirection(dir); dir.y = 0;
      if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
      dir.normalize();
      cam.getWorldPosition(pos);
      w.object3D.position.set(pos.x + dir.x * 1.2, pos.y - 0.15, pos.z + dir.z * 1.2);
      w.object3D.visible = true;
    }
  };

  App.XR = XR; App.Gyro = Gyro; App.Input = Input;   // exposed for debugging/tests

  function sceneHtml(kind) {
    const y = KIND[kind].y;
    const lights =
      '<a-entity light="type: ambient; color: #8896c8; intensity: 0.7"></a-entity>' +
      '<a-entity light="type: point; color: #fff1d6; intensity: 2.6; decay: 0; distance: 0" position="0 ' + y + ' 0"></a-entity>';
    const common = 'id="scene" xr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: ';

    if (kind === 'demo') {
      return '<a-scene ' + common + 'false" renderer="antialias: true" background="color: #03050f">' +
        '<a-entity camera="fov: 55" position="0 2.1 1.9" rotation="-48 0 0" look-controls="enabled: false"></a-entity>' +
        '<a-entity id="world" universe>' + lights + '</a-entity>' +
        '</a-scene>';
    }
    if (kind === 'xr') {
      return '<a-scene ' + common + 'false" renderer="alpha: true; antialias: true" xr-placement ' +
        'webxr="referenceSpaceType: local; requiredFeatures: hit-test; optionalFeatures: dom-overlay; overlayElement: #app-ui">' +
        '<a-entity camera look-controls="enabled: false"></a-entity>' +
        '<a-entity id="world" universe>' + lights + '</a-entity>' +
        '</a-scene>';
    }
    if (kind === 'gyro') {
      return '<a-scene ' + common + 'true" renderer="alpha: true; antialias: true">' +
        '<a-entity camera position="0 0 0" look-controls="touchEnabled: false; mouseEnabled: false"></a-entity>' +
        '<a-entity id="world" universe position="0 -0.15 -1.2">' + lights + '</a-entity>' +
        '</a-scene>';
    }
    return '<a-scene ' + common + 'false" renderer="alpha: true; antialias: true" ' +
      'arjs="trackingMethod: best; sourceType: webcam; debugUIEnabled: false; detectionMode: mono; ' +
      'cameraParametersUrl: data/camera_para.dat; maxDetectionRate: 30;">' +
      '<a-marker id="marker" type="pattern" url="data/patt.hiro" smooth="true" smoothCount="8" smoothTolerance="0.01" smoothThreshold="4">' +
      '<a-entity id="world" universe>' + lights + '</a-entity>' +
      '</a-marker>' +
      '<a-entity camera></a-entity>' +
      '</a-scene>';
  }

  function setMarker(visible) {
    if (App.markerVisible === visible) return;
    App.markerVisible = visible;
    UI.updateHint();
    if (visible && App.kind === 'marker' && App.mode === 'game' && Game.running) toast('Marker found — game resumed', 'good');
  }

  /* AR.js (markers) is loaded only when needed, so it never interferes with WebXR / 3DoF */
  let arjsLoading = null;
  function loadArjs() {
    if (!arjsLoading) {
      arjsLoading = new Promise((resolve, reject) => {
        const sc = document.createElement('script');
        sc.src = 'vendor/aframe-ar.js';
        sc.onload = resolve;
        sc.onerror = () => reject(new Error('AR.js failed to load'));
        document.head.appendChild(sc);
      });
    }
    return arjsLoading;
  }

  async function boot(kind) {
    Sfx.unlock();
    if (kind === 'marker') {
      try { await loadArjs(); } catch (e) { toast(e.message, 'bad', 3500); return; }
    }
    setScaleFor(kind);
    document.body.dataset.kind = kind;
    Log.add('start: ' + kind + ' (xrSupported=' + App.xrSupported + ')');
    if (kind !== 'demo') document.documentElement.classList.add('ar');   // keep the camera (video/passthrough) visible
    if (kind === 'gyro') Gyro.startCamera();

    document.body.insertAdjacentHTML('afterbegin', sceneHtml(kind));
    $('#start').classList.add('hidden');
    App.started = true;
    document.body.dataset.started = 'true';
    const sceneEl = $('a-scene');

    if (kind === 'marker') {
      const marker = $('#marker');
      marker.addEventListener('markerFound', () => setMarker(true));
      marker.addEventListener('markerLost', () => setMarker(false));
    } else if (kind === 'xr') {
      const enter = () => {
        try { Promise.resolve(sceneEl.enterAR()).catch(askEnter); } catch (e) { askEnter(e); }
      };
      // if the browser wants a fresh user gesture, show an explicit button
      const askEnter = () => UI.modal('Start the AR session',
        '<p class="center">Tap the button and allow camera access.</p>',
        [{ label: '📱 Enter AR', primary: true, fn: () => {
          try { Promise.resolve(sceneEl.enterAR()).catch((err) => toast('Cannot start AR: ' + (err && err.message || err), 'bad', 4000)); }
          catch (err) { toast('Cannot start AR: ' + err.message, 'bad', 4000); }
        } }]);
      if (sceneEl.hasLoaded) enter(); else sceneEl.addEventListener('loaded', enter, { once: true });
      $('#t-place').classList.remove('hidden');
    } else {
      setMarker(true);
      if (kind === 'gyro') {
        $('#t-place').classList.remove('hidden');
        const center = () => setTimeout(() => { Gyro.recenter(); toast('The universe is in front of you. 📍 re-centers it', '', 2600); }, 1500);
        if (sceneEl.hasLoaded) center(); else sceneEl.addEventListener('loaded', center, { once: true });
      }
    }
    UI.setMode('explore');
    UI.updateHint();
    if (!store.get('ar_seen_help', false) && kind !== 'xr') {      // short intro the first time only
      store.set('ar_seen_help', true);
      setTimeout(() => UI.help(), 700);
    }
  }

  /* detect whether the phone can place content on real surfaces (WebXR immersive-ar) */
  async function detectXR() {
    let ok = false;
    try {
      // some browsers never answer: wait at most 2 seconds
      const timeout = new Promise((res) => setTimeout(() => res(false), 2000));
      ok = !!(navigator.xr && await Promise.race([navigator.xr.isSessionSupported('immersive-ar'), timeout]));
    } catch (e) { ok = false; }
    App.xrSupported = ok;
    $('#free-note').textContent = ok
      ? '✔ Your phone can place the universe on the floor or a table: move the phone, then tap the screen. No marker needed.'
      : 'No marker needed. Your phone cannot detect surfaces (e.g. iPhone), so the universe floats in front of you and follows your phone’s rotation.';
  }

  function bindUI() {
    $('#btn-start-free').addEventListener('click', () => boot(App.xrSupported ? 'xr' : 'gyro'));
    $('#btn-start-ar').addEventListener('click', () => boot('marker'));
    $('#btn-start-demo').addEventListener('click', () => boot('demo'));
    $('#t-place').addEventListener('click', () => { if (App.kind === 'xr') XR.replace(); else { Gyro.recenter(); Sfx.ui(); } });
    // in WebXR, taps on UI controls must not become “select” events in the scene
    // (the empty background of #app-ui is NOT blocked, so taps there reach the scene as `select`)
    document.querySelectorAll('button, .card, .overlay, #strip, #tools, #nav, #viewctl')
      .forEach((el) => el.addEventListener('beforexrselect', (e) => e.preventDefault()));

    // on-screen zoom / turn buttons (hold to repeat) — reliable where pinch/drag are not
    const holdBtn = (id, fn) => {
      const el = $(id); let timer = 0, lastDown = 0;
      const stop = () => { clearInterval(timer); timer = 0; };
      el.addEventListener('pointerdown', () => { lastDown = performance.now(); fn(); stop(); timer = setInterval(fn, 70); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => el.addEventListener(ev, stop));
      el.addEventListener('click', () => { if (performance.now() - lastDown > 700) fn(); });   // fallback when no pointer events
    };
    holdBtn('#v-in',    () => { App.scale = clamp(App.scale * 1.06, App.scaleMin, App.scaleMax); });
    holdBtn('#v-out',   () => { App.scale = clamp(App.scale / 1.06, App.scaleMin, App.scaleMax); });
    holdBtn('#v-left',  () => { App.yaw -= 0.1; });
    holdBtn('#v-right', () => { App.yaw += 0.1; });
    detectXR();
    buildStrip();
    $('#btn-help').addEventListener('click', () => { Sfx.ui(); UI.help(); });
    $('#btn-home').addEventListener('click', () => location.reload());            // back to the start menu
    const musicBtn = $('#btn-music'), sfxBtn = $('#btn-sound');
    musicBtn.classList.toggle('off', !Sfx.isMusicOn());
    sfxBtn.classList.toggle('off', !Sfx.isSfxOn());
    sfxBtn.textContent = Sfx.isSfxOn() ? '🔊' : '🔇';
    musicBtn.addEventListener('click', () => { musicBtn.classList.toggle('off', !Sfx.toggleMusic()); Sfx.ui(); });
    sfxBtn.addEventListener('click', () => {
      const on = Sfx.toggleSfx();
      sfxBtn.classList.toggle('off', !on); sfxBtn.textContent = on ? '🔊' : '🔇'; Sfx.ui();
    });
    $('#info-prev').addEventListener('click', () => Explore.step(-1));
    $('#info-next').addEventListener('click', () => Explore.step(1));
    $('#info-close').addEventListener('click', () => { Sfx.ui(); Explore.hideInfo(); });

    document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
      Sfx.ui();
      UI.setMode(t.dataset.mode);
    }));

    $('#t-pause').addEventListener('click', (e) => {
      App.paused = !App.paused; e.currentTarget.querySelector('.ico').textContent = App.paused ? '▶' : '⏸';
      e.currentTarget.querySelector('.cap').textContent = App.paused ? 'Play' : 'Pause'; Sfx.ui();
    });
    $('#t-speed').addEventListener('click', (e) => {
      App.speedIdx = (App.speedIdx + 1) % App.speeds.length;
      const s = App.speeds[App.speedIdx];
      e.currentTarget.querySelector('.ico').textContent = (s < 1 ? '¼' : s) + '×'; Sfx.ui();
    });
    $('#t-orbits').addEventListener('click', (e) => {
      App.showOrbits = !App.showOrbits; e.currentTarget.classList.toggle('active', App.showOrbits);
      App.universe && App.universe.applyToggles(); Sfx.ui();
    });
    $('#t-labels').addEventListener('click', (e) => {
      App.showLabels = !App.showLabels; e.currentTarget.classList.toggle('active', App.showLabels);
      App.universe && App.universe.applyToggles(); Sfx.ui();
    });
    $('#t-reset').addEventListener('click', () => {
      App.yaw = 0; App.tilt = 0.35; App.scale = App.defScale; Sfx.ui();
    });

    $('#g-best').textContent = store.get('ar_best_game', 0);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindUI);
  else bindUI();
})();
