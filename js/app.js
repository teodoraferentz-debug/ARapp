/* AR Cosmos — Sistemul Solar interactiv în realitate augmentată (A-Frame + AR.js)
 *
 * Structură:
 *   1. Utilitare + stare globală (App)
 *   2. Generare texturi procedurale
 *   3. Componenta A-Frame "universe" (soare, planete, orbite, etichete, asteroizi, efecte)
 *   4. Moduri: Explorare, Quiz, Joc
 *   5. Gesturi (drag = rotire, pinch = scalare, tap = selectare)
 *   6. Interfață (UI) și pornirea scenei AR / demo
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
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignorat */ } }
  };

  /* ======================================================================
   * 1. Stare globală
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

  /* înălțimea centrului sistemului și scala implicită, în funcție de tipul de AR
   * (marker: 1 unitate = lățimea markerului; xr/gyro: 1 unitate = 1 metru) */
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

  function vibrate(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignorat */ } }

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
      this.center.position.y = KIND[App.kind].y;          // plutește deasupra markerului / podelei
      if (App.kind === 'xr') root.visible = false;         // apare după ce utilizatorul îl plasează
      root.add(this.center);
      this.spin = new THREE.Group();                      // se rotește cu degetul
      this.center.add(this.spin);
      this.gameGroup = new THREE.Group();                 // asteroizi + efecte (nu se rotește)
      this.center.add(this.gameGroup);

      this.pickables = [];                                // obiecte atingibile (raycast)
      this.byId = {};
      this.fx = [];                                       // efecte temporare (explozii, inele, texte)
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

    /* ---------- construcție ---------- */
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
      hit.userData = { kind: 'planet', id: 'soare' };
      this.sun.add(hit);
      this.pickables.push(hit);
      this.byId.soare = { mesh: this.sun, size: 0.14, data: SUN };
    },

    buildPlanets() {
      this.orbitLines = [];
      this.labels = [];
      this.planets = PLANETS.map((p) => {
        const pivot = new THREE.Group();
        pivot.rotation.y = Math.random() * Math.PI * 2;
        this.spin.add(pivot);

        const holder = new THREE.Group();            // poziția pe orbită (nu se rotește în jurul axei)
        holder.position.x = p.orbit;
        pivot.add(holder);
        const mat = new THREE.MeshStandardMaterial({ map: planetTexture(p), roughness: 0.95, metalness: 0 });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(p.size, 28, 18), mat);   // doar globul se rotește
        holder.add(mesh);

        if (p.rings) {
          const thin = p.rings === 'thin';
          const inner = p.size * (thin ? 1.5 : 1.35), outer = p.size * (thin ? 1.75 : 2.3);
          const rg = new THREE.RingGeometry(inner, outer, 64, 1);
          // UV radial, ca textura să fie benzi concentrice
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

        const hit = new THREE.Mesh(
          new THREE.SphereGeometry(Math.max(p.size * 1.6, 0.075), 8, 6),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        hit.userData = { kind: 'planet', id: p.id };
        holder.add(hit);
        this.pickables.push(hit);

        const label = labelSprite(p.name);
        label.position.y = p.size + 0.07;
        holder.add(label);
        this.labels.push(label);

        // linia orbitei
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

    /* ---------- vizibilitate orbite/etichete ---------- */
    applyToggles() {
      const labelsOn = App.showLabels && App.mode !== 'quiz';   // în quiz ascundem numele (ar da răspunsul)
      this.orbitLines.forEach((l) => { l.visible = App.showOrbits; });
      this.labels.forEach((l) => { l.visible = labelsOn; });
    },

    /* ---------- efecte ---------- */
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

    /* ---------- bucla principală ---------- */
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
   * 4a. Mod EXPLORARE (educațional)
   * ==================================================================== */
  const Explore = {
    select(id) {
      const U = App.universe;
      U.clearRings();
      App.selected = id;
      U.ring(id, 0xffffff, 60);
      this.showInfo(id);
    },
    showInfo(id) {
      const d = id === 'soare' ? SUN : PLANETS.find((p) => p.id === id);
      $('#i-name').textContent = (id === 'soare' ? '☀️ ' : '🪐 ') + d.name;
      const rows = [['Diametru', d.diameter], ['Distanță față de Soare', d.distance], ['Un an', d.year],
        ['O zi', d.day], ['Temperatură', d.temp], ['Sateliți', d.moons]]
        .filter((r) => r[1] && r[1] !== '—');
      $('#i-grid').innerHTML = rows.map((r) => '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>').join('');
      $('#i-fact').textContent = d.fact;
      $('#info').classList.remove('hidden');
    },
    hideInfo() {
      $('#info').classList.add('hidden');
      App.selected = null;
      if (App.universe) App.universe.clearRings();
    },
    onTap(hit) {
      if (hit && hit.kind === 'planet') { Sfx.tap(); vibrate(15); this.select(hit.id); }
      else if (App.selected) this.hideInfo();
    }
  };

  /* ======================================================================
   * 4b. Mod QUIZ
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
      $('#quiz-progress').textContent = 'Întrebarea ' + (this.i + 1) + '/' + this.total;
      $('#quiz-score').textContent = this.score + ' pct';
      $('#quiz-q').textContent = this.list[this.i].q + '  👆 Atinge planeta';
    },
    onTap(hit) {
      if (this.locked) return;
      if (!hit || hit.kind !== 'planet') return;
      if (hit.id === 'soare') { toast('Soarele e o stea, nu o planetă 😉', 'bad'); return; }
      const q = this.list[this.i], U = App.universe;
      this.locked = true;
      const ok = hit.id === q.a;
      if (ok) {
        this.score += 10;
        U.ring(hit.id, 0x3ddc84, 1.2);
        toast('✔ Corect! +10', 'good'); Sfx.good(); vibrate(40);
      } else {
        const right = PLANETS.find((p) => p.id === q.a).name;
        U.ring(hit.id, 0xff5d6c, 1.2);
        U.ring(q.a, 0x3ddc84, 1.6);
        toast('✘ Era ' + right, 'bad', 1800); Sfx.bad(); vibrate([60, 40, 60]);
      }
      $('#quiz-score').textContent = this.score + ' pct';
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
      const msg = this.score >= max * 0.9 ? 'Excelent! Ești un adevărat astronom 🚀'
        : this.score >= max * 0.6 ? 'Bravo! Mai explorează puțin și vei ajunge expert 🌍'
        : 'Poți mai bine — încearcă modul Explorează și revino 🔭';
      UI.modal('Rezultat quiz',
        '<div class="big">' + this.score + '/' + max + '</div><p class="center">' + msg + '</p><p class="center">Cel mai bun scor: <b>' + best + '</b></p>',
        [{ label: 'Joacă din nou', primary: true, fn: () => this.start() },
         { label: 'Explorează', fn: () => UI.setMode('explore') }]);
    }
  };

  /* ======================================================================
   * 4c. Mod JOC — „Apără Soarele”
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
      toast('Apără Soarele! Atinge asteroizii ☄️', '', 1800);
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

      const hit = new THREE.Mesh(new THREE.SphereGeometry(Math.max(size * 2.2, 0.11), 6, 5), new THREE.MeshBasicMaterial({ visible: false }));
      const item = { obj, body, kind, size, speed: speed * (1 + 0.12 * (this.level - 1)), dead: false,
        spinAxis: new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(), spinSpd: rand(1, 3) };
      hit.userData = { kind: 'asteroid', item };
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

      // mișcare + coliziune cu Soarele
      for (let i = this.items.length - 1; i >= 0; i--) {
        const a = this.items[i];
        const p = a.obj.position, len = p.length();
        p.multiplyScalar(Math.max(len - a.speed * d, 0) / len);
        a.body.rotateOnAxis(a.spinAxis, a.spinSpd * d);
        if (len < 0.18) this.damage(a, i);
      }

      // clipire roșie a Soarelui
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
      if (!this.running || !hit || hit.kind !== 'asteroid') return;
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
        this.slowT = 5; Sfx.power(); toast('⏱ Timp încetinit 5 s!', 'good');
      } else Sfx.boom();
      vibrate(25);
      if (this.kills % 10 === 0) {
        this.level++; Sfx.level(); toast('Nivel ' + this.level + ' 🔥', 'good');
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
      UI.modal('Soarele a fost lovit! 💥',
        '<div class="big">' + this.score + '</div>' +
        '<p class="center">' + (isRecord ? '🏆 Record nou!' : 'Record: <b>' + best + '</b>') + ' · Nivel ' + this.level + '</p>' +
        '<div class="fact">💡 Știai că… ' + fact + '</div>',
        [{ label: 'Din nou', primary: true, fn: () => this.start() },
         { label: 'Explorează', fn: () => UI.setMode('explore') }]);
    }
  };

  App.Quiz = Quiz; App.Game = Game;   // expuse pentru depanare/teste

  /* ======================================================================
   * 5. Gesturi: drag = rotire, pinch = scalare, tap = selectare
   * ==================================================================== */
  const Input = (function () {
    const pointers = new Map();
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let pinch = null;

    const ignore = (e) => !App.started || !!e.target.closest('button, .card, .overlay, .hud, #nav');
    const gesturesOn = () => App.mode !== 'game';

    function pick(x, y) {
      const sceneEl = $('a-scene');
      const cam = sceneEl && sceneEl.camera;   // în WebXR three.js îi actualizează poziția la fiecare cadru
      const U = App.universe;
      if (!cam || !U || !App.markerVisible) return null;
      ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
      raycaster.setFromCamera(ndc, cam);
      const list = App.mode === 'game' ? Game.pickables : U.pickables;
      const hits = raycaster.intersectObjects(list, false);
      return hits.length ? hits[0].object.userData : null;
    }

    function tap(x, y) {
      if (App.kind === 'xr' && !App.xrPlaced) { XR.place(); return; }
      const hit = pick(x, y);
      if (App.mode === 'explore') Explore.onTap(hit);
      else if (App.mode === 'quiz') Quiz.onTap(hit);
      else Game.onTap(hit);
    }

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
      if (e.type === 'pointerup' && wasSingle && p.moved < 14 && performance.now() - p.t < 450) tap(e.clientX, e.clientY);
    }
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);

    // dezktop: rotița mouse-ului = zoom
    window.addEventListener('wheel', (e) => {
      if (!App.started || !gesturesOn() || e.target.closest('.overlay, .card')) return;
      App.scale = clamp(App.scale * (e.deltaY < 0 ? 1.08 : 0.92), App.scaleMin, App.scaleMax);
    }, { passive: true });

    window.addEventListener('contextmenu', (e) => e.preventDefault());
    return { pick };
  })();

  /* ======================================================================
   * 6. Interfața (UI) + pornirea scenei
   * ==================================================================== */
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
      if (m === 'explore') toast('Atinge o planetă 🪐', '', 1500);
      this.updateHint();
    },

    HINTS: {
      marker:    ['⌗', 'Îndreaptă camera spre <b>markerul Hiro</b>', 'Ține-l bine luminat și complet în cadru'],
      xrSearch:  ['📱', 'Mișcă telefonul <b>încet</b> și privește podeaua sau o masă', 'Caut o suprafață plană…'],
      xrReady:   ['📍', 'Atinge ecranul ca să <b>plasezi</b> universul aici', 'Cercul albastru arată unde va apărea']
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
        b.addEventListener('click', () => { Sfx.tap(); this.closeModal(); if (a.fn) a.fn(); });
        box.appendChild(b);
      });
      $('#modal').classList.remove('hidden');
    },
    closeModal() { $('#modal').classList.add('hidden'); },

    help() {
      this.modal('Cum se folosește',
        '<ul>' +
        '<li><b>🔭 Explorează:</b> atinge o planetă pentru detalii. Trage cu un deget ca să rotești sistemul, ciupește cu două degete ca să-l mărești/micșorezi.</li>' +
        '<li><b>Butoane:</b> ⏸ pauză · viteză orbite · ◎ orbite · Aa etichete · ⟲ resetare.</li>' +
        '<li><b>🎯 Quiz:</b> citești întrebarea și atingi planeta corectă (numele sunt ascunse!).</li>' +
        '<li><b>☄️ Joc:</b> atinge asteroizii înainte să lovească Soarele. ' +
        'Cometele albastre sunt rapide (+25), cele aurii încetinesc timpul. Ai 3 vieți.</li>' +
        '<li>Dacă pierzi markerul din vedere, aplicația se oprește până îl găsești din nou.</li>' +
        '</ul>');
    }
  };

  /* ---------- AR fără marker, varianta 1: WebXR (Android/Chrome) — hit-test pe suprafețe reale ---------- */
  const XR = {
    hitSource: null, reticle: null, state: 'search',
    setState(st) { if (st !== this.state) { this.state = st; UI.updateHint(); } },
    place() {
      if (!this.reticle || !this.reticle.visible) { toast('Mai caută o suprafață plană…', 'bad'); return; }
      const w = $('#world').object3D;
      w.position.setFromMatrixPosition(this.reticle.matrix);
      w.visible = true;
      App.xrPlaced = true;
      this.reticle.visible = false;
      setMarker(true);
      Sfx.good(); vibrate(30);
      toast('Plasat! Mergi în jurul lui 🚶', 'good', 1800);
    },
    replace() {
      App.xrPlaced = false;
      $('#world').object3D.visible = false;
      Game.stop(); Explore.hideInfo();
      setMarker(false);
      Sfx.tap();
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

      sceneEl.addEventListener('enter-vr', () => {
        if (!sceneEl.is('ar-mode')) return;
        const session = sceneEl.renderer.xr.getSession();
        if (!session || !session.requestHitTestSource) { toast('Dispozitivul nu suportă detectarea suprafețelor', 'bad', 3000); return; }
        session.requestReferenceSpace('viewer')
          .then((vs) => session.requestHitTestSource({ space: vs }))
          .then((src) => { XR.hitSource = src; })
          .catch(() => toast('Nu am putut porni detectarea suprafețelor', 'bad', 3000));
      });
      sceneEl.addEventListener('exit-vr', () => { XR.hitSource = null; location.reload(); });
    },
    tick() {
      const frame = this.el.frame;
      if (!frame || !XR.hitSource || App.xrPlaced) return;
      const res = frame.getHitTestResults(XR.hitSource);
      const pose = res.length ? res[0].getPose(this.el.renderer.xr.getReferenceSpace()) : null;
      if (pose) {
        XR.reticle.visible = true;
        XR.reticle.matrix.fromArray(pose.transform.matrix);
        XR.reticle.matrixWorldNeedsUpdate = true;
        XR.setState('ready');
      } else {
        XR.reticle.visible = false;
        XR.setState('search');
      }
    }
  });

  /* ---------- AR fără marker, varianta 2: „3DoF” (merge și pe iPhone) — cameră + giroscop ---------- */
  const Gyro = {
    async startCamera() {
      const v = document.createElement('video');
      v.id = 'cam'; v.autoplay = true; v.muted = true; v.setAttribute('playsinline', '');
      document.body.insertBefore(v, document.body.firstChild);
      try {
        v.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        await v.play();
      } catch (e) {
        toast('Camera nu e disponibilă — aplicația merge și fără ea', 'bad', 3500);
      }
    },
    // așază universul ~1,2 m în fața direcției în care privești acum
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

  App.XR = XR; App.Gyro = Gyro;   // expuse pentru depanare/teste

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
    if (visible && App.kind === 'marker' && App.mode === 'game' && Game.running) toast('Marker găsit — jocul continuă', 'good');
  }

  /* AR.js (markere) se încarcă doar când e nevoie: nu interferă cu WebXR / modul 3DoF */
  let arjsLoading = null;
  function loadArjs() {
    if (!arjsLoading) {
      arjsLoading = new Promise((resolve, reject) => {
        const sc = document.createElement('script');
        sc.src = 'vendor/aframe-ar.js';
        sc.onload = resolve;
        sc.onerror = () => reject(new Error('AR.js nu s-a încărcat'));
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
    if (kind !== 'demo') document.documentElement.classList.add('ar');   // lasă camera (video/passthrough) vizibilă
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
      // dacă browserul cere un gest nou al utilizatorului, afișăm un buton explicit
      const askEnter = () => UI.modal('Pornește sesiunea AR',
        '<p class="center">Apasă butonul și permite accesul la cameră.</p>',
        [{ label: '📱 Intră în AR', primary: true, fn: () => {
          try { Promise.resolve(sceneEl.enterAR()).catch((err) => toast('Nu pot porni AR: ' + (err && err.message || err), 'bad', 4000)); }
          catch (err) { toast('Nu pot porni AR: ' + err.message, 'bad', 4000); }
        } }]);
      if (sceneEl.hasLoaded) enter(); else sceneEl.addEventListener('loaded', enter, { once: true });
      $('#t-place').classList.remove('hidden');
    } else {
      setMarker(true);
      if (kind === 'gyro') {
        $('#t-place').classList.remove('hidden');
        const center = () => setTimeout(() => { Gyro.recenter(); toast('Universul e în fața ta. 📍 îl recentrează', '', 2600); }, 1500);
        if (sceneEl.hasLoaded) center(); else sceneEl.addEventListener('loaded', center, { once: true });
      }
    }
    UI.setMode('explore');
    UI.updateHint();
  }

  /* detectăm dacă telefonul poate plasa conținut pe suprafețe reale (WebXR immersive-ar) */
  async function detectXR() {
    let ok = false;
    try { ok = !!(navigator.xr && await navigator.xr.isSessionSupported('immersive-ar')); } catch (e) { ok = false; }
    App.xrSupported = ok;
    $('#free-note').textContent = ok
      ? '✔ Telefonul tău poate plasa universul pe podea sau masă: mișcă telefonul, apoi atinge ecranul. Fără marker.'
      : 'Fără marker. Telefonul nu oferă detectare de suprafețe (de ex. iPhone): universul plutește în fața ta și urmărește mișcarea telefonului.';
  }

  function bindUI() {
    $('#btn-start-free').addEventListener('click', () => boot(App.xrSupported ? 'xr' : 'gyro'));
    $('#btn-start-ar').addEventListener('click', () => boot('marker'));
    $('#btn-start-demo').addEventListener('click', () => boot('demo'));
    $('#t-place').addEventListener('click', () => { if (App.kind === 'xr') XR.replace(); else { Gyro.recenter(); Sfx.tap(); } });
    // în WebXR, atingerile pe interfață nu trebuie să devină „select” în scenă
    $('#app-ui').addEventListener('beforexrselect', (e) => e.preventDefault());
    detectXR();
    $('#btn-help').addEventListener('click', () => { Sfx.tap(); UI.help(); });
    $('#btn-sound').addEventListener('click', (e) => { e.currentTarget.textContent = Sfx.toggle() ? '🔊' : '🔇'; Sfx.tap(); });
    $('#info-close').addEventListener('click', () => Explore.hideInfo());

    document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
      Sfx.tap();
      UI.setMode(t.dataset.mode);
    }));

    $('#t-pause').addEventListener('click', (e) => {
      App.paused = !App.paused; e.currentTarget.textContent = App.paused ? '▶' : '⏸'; Sfx.tap();
    });
    $('#t-speed').addEventListener('click', (e) => {
      App.speedIdx = (App.speedIdx + 1) % App.speeds.length;
      const s = App.speeds[App.speedIdx];
      e.currentTarget.textContent = (s < 1 ? '¼' : s) + '×'; Sfx.tap();
    });
    $('#t-orbits').addEventListener('click', (e) => {
      App.showOrbits = !App.showOrbits; e.currentTarget.classList.toggle('active', App.showOrbits);
      App.universe && App.universe.applyToggles(); Sfx.tap();
    });
    $('#t-labels').addEventListener('click', (e) => {
      App.showLabels = !App.showLabels; e.currentTarget.classList.toggle('active', App.showLabels);
      App.universe && App.universe.applyToggles(); Sfx.tap();
    });
    $('#t-reset').addEventListener('click', () => {
      App.yaw = 0; App.tilt = 0.35; App.scale = App.defScale; Sfx.tap();
    });

    $('#g-best').textContent = store.get('ar_best_game', 0);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindUI);
  else bindUI();
})();
