# 🪐 AR Cosmos — Sistemul Solar în realitate augmentată

Aplicație **WebAR** (rulează în browserul telefonului, fără instalare) construită cu **A-Frame + AR.js**.
Sistemul Solar apare în camera telefonului — pe o suprafață reală, plutind în fața ta sau pe un marker — cu trei moduri interactive (explorare, quiz, joc).

## Moduri AR

| Mod | Cum funcționează | Dispozitive |
|---|---|---|
| 🌍 **AR fără marker — suprafețe (WebXR)** | Telefonul detectează podeaua/masa (ARCore). Miști telefonul, apare un cerc albastru, **atingi ecranul** și universul rămâne ancorat în spațiu — poți merge în jurul lui. Butonul 📍 îl replasează | Android + Chrome (cu „Google Play Services for AR”) |
| 🌍 **AR fără marker — 3DoF** | Camera + giroscopul: universul plutește ~1,2 m în fața ta și rămâne fix când rotești telefonul. Dacă te mișți prin cameră, nu rămâne ancorat în loc. Butonul 📍 îl recentrează | Orice telefon, inclusiv iPhone/Safari |
| ⌗ **AR cu marker Hiro** | Universul apare pe un marker printat | Orice telefon |
| 🖥️ **Demo** | Fără cameră, pentru PC/prezentare | Orice browser |

Butonul **„Pornește AR fără marker”** alege automat varianta potrivită telefonului. iPhone-ul nu suportă WebXR în Safari, de aceea acolo se folosește varianta 3DoF.

## Interacțiuni

| Mod | Ce poți face |
|---|---|
| 🔭 **Explorează** (educațional) | **Tap** pe planetă → card cu diametru, distanță, durata anului/zilei, temperatură, sateliți, curiozitate · **Drag** (1 deget) → rotești/înclini sistemul · **Pinch** (2 degete) → mărești/micșorezi · butoane: pauză, viteză orbite (¼×–12×), orbite on/off, etichete on/off, resetare vedere |
| 🎯 **Quiz** | 8 întrebări aleatoare din 15; răspunzi **atingând planeta** în AR (numele sunt ascunse). Feedback verde/roșu, sunet, vibrație, scor, record salvat |
| ☄️ **Joc** „Apără Soarele” | Asteroizii zboară spre Soare; îi distrugi cu **tap**. 3 vieți, niveluri tot mai grele. Asteroid auriu = timp încetinit 5 s, cometă albastră = rapidă (+25). Explozii, scor, record salvat, „Știai că…” la final |

Extra: efecte sonore generate în cod (WebAudio), vibrații, pauză automată când markerul iese din cadru, **mod demo** fără cameră (pentru dezvoltare/prezentare pe PC).

## Rulare

Necesită doar Node.js (nu are dependențe npm; bibliotecile sunt incluse în `vendor/`).

```bash
npm start          # http://localhost:8080  (merge cu camera web pe PC)
npm run https      # https://localhost:8443 (certificat self-signed, pentru telefon)
```

### Pe telefon
Camera browserului cere **HTTPS**. Variante:
1. `npm run https`, apoi deschizi pe telefon adresa `https://<IP-ul-PC-ului>:8443` (afișată în consolă; telefonul și PC-ul în aceeași rețea) și accepți avertismentul de certificat.
2. Publici folderul pe **GitHub Pages** / Netlify / Vercel (HTTPS automat) — varianta cea mai simplă pentru prezentare.
3. Un tunel HTTPS, ex. `npx localtunnel --port 8080`.

### Marker (doar pentru modul cu marker)
Deschide `assets/hiro.png` pe alt ecran sau printează-l (negru pe alb, fără reflexii, cât mai mare). Apoi apasă **AR cu marker Hiro**.

## Structura proiectului

```
index.html        interfața (HTML) — scena AR se creează din JS la apăsarea Start
css/style.css     stiluri mobile-first
js/data.js        datele educaționale (planete, întrebări quiz, curiozități)
js/audio.js       efecte sonore WebAudio
js/app.js         logica: componenta „universe”, moduri Explore/Quiz/Game, gesturi, UI, WebXR hit-test, 3DoF
vendor/           A-Frame 1.5.0 + AR.js 3.4.7 (local, funcționează offline)
data/             camera_para.dat + patt.hiro (necesare AR.js)
assets/hiro.png   markerul de printat
server.js         server static (HTTP/HTTPS)
```

Cum funcționează pe scurt:
- `<a-marker>` (AR.js) urmărește markerul; copilul `#world` are componenta **`universe`** care construiește cu Three.js soarele, planetele (texturi procedurale desenate pe canvas), orbitele, etichetele și rulează animația în `tick()`.
- Atingerile sunt prinse cu *Pointer Events*; un **Raycaster** trimite raza din cameră prin punctul atins și găsește planeta/asteroidul (sfere invizibile mai mari = ușor de nimerit cu degetul).
- Modurile sunt trei obiecte (`Explore`, `Quiz`, `Game`) care primesc același eveniment *tap*.

## Personalizare rapidă
- **Alt subiect** (anatomie, molecule, monumente…): schimbi `js/data.js` și construcția din `buildPlanets()`.
- **Modele 3D reale**: adaugi un `.glb` și îl încarci cu `GLTFLoader` / `<a-gltf-model>`.
- **Alt marker**: generezi unul pe https://jeromeetienne.github.io/AR.js/three.js/examples/marker-training/examples/generator.html și înlocuiești `data/patt.hiro` + `assets/hiro.png`.
- Valorile fizice (diametre, distanțe etc.) sunt rotunjite după NASA Planetary Fact Sheet; numărul de sateliți se actualizează des — verifică-l dacă îl citezi.

## Teste efectuate și limite
- Verificat automat în Chromium headless: pornire, selectare planete, drag/zoom, quiz complet, joc (scor, vieți, game over), fără erori în consolă.
- **Modul 3DoF** testat cu cameră virtuală: video de fundal, plasare în față, tap, drag, joc. **Plasarea WebXR** are logica verificată cu un hit-test simulat (reticul, tap, replasare), dar sesiunea WebXR reală necesită un telefon Android — **nu am putut-o testa aici**.
- **Detecția markerului** testată cu o cameră virtuală care afișează markerul Hiro: AR.js îl recunoaște și afișează scena; fără marker apare indicația.
- **Netestat pe un telefon fizic** — încearcă pe dispozitivul tău înainte de prezentare (lumină bună, marker mare). Plasarea pe suprafețe reale cere WebXR (doar Android/Chrome); pe iPhone, în browser, nu există alternativă fără marker cu ancorare reală (ar cere o aplicație nativă ARKit sau un SDK comercial, ex. 8th Wall).
