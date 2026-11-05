/* Wild Kart Studio — vues 3D légères pendant la construction (Claude 2, ticket #27 : P1 mini-vue, P2 quatre vues).
   Scène LÉGÈRE, jamais le circuit complet du jeu : ruban de route construit à partir des mêmes points que WKStudioCore.walk (ceux
   que toDef donne au moteur), bordures, piliers sous les portions en hauteur, volumes simples pour les éléments (tremplin, tunnel,
   planeur, objets, turbo), sol uni du biome. Matériaux sans texture, aucune ombre, rendu SEULEMENT quand quelque chose change
   (modification, geste, défilement de la vue « au ras du kart ») : rien ne tourne à vide.
   Vues : « maquette » (orbite autour du circuit ou de la pièce choisie), « kart » (caméra au ras de la route, curseur et lecture),
   « piece » (gros plan sur la pièce choisie). La vue « plan » reste le canevas 2D de studio.js.
   Un seul moteur de rendu pour toutes les vues ; il est libéré (dispose) à la fermeture du Studio et avant chaque test de course. */
(function (root) {
'use strict';
const T = root.THREE;
const SOL = { prairie: '#5f9e48', provence: '#8fa760', automne: '#9b7a3c', neige: '#e6edf4', savane: '#c8a35a', jungle: '#3f7f3a', volcan: '#4b3b37', manoir: '#4d5c4d', plage: '#e2ce96', ville: '#3b3e4b' };
const CIEL = { neige: '#cfe3f5', volcan: '#e8b38a', manoir: '#7d86a8', ville: '#2a2550' };
const COUL = { sel: new T.Color('#ffd23a'), bad: new T.Color('#ff3a4a'), warn: new T.Color('#ff9a3a'), bord1: new T.Color('#f4f1e8'), bord2: new T.Color('#e8463c') };

function create(host) {
  const canvas = document.createElement('canvas'); canvas.className = 'wks3d'; host.appendChild(canvas);
  let renderer = null;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' }); }
  catch (e) { console.warn('Studio 3D indisponible : ' + e.message); canvas.remove(); return null; } // WebGL indisponible : le Studio reste utilisable en plan 2D
  renderer.outputColorSpace = T.SRGBColorSpace;
  const scene = new T.Scene(), cam = new T.PerspectiveCamera(55, 1, .5, 6000);
  scene.add(new T.HemisphereLight('#ffffff', '#56604a', 1.15)); const sun = new T.DirectionalLight('#fff4e0', 1.5); sun.position.set(.4, 1, .3); scene.add(sun);
  const M = { route: new T.MeshLambertMaterial({ vertexColors: true }), bord: new T.MeshLambertMaterial({ vertexColors: true }), pilier: new T.MeshLambertMaterial({ color: '#9a96a8' }),
    sol: new T.MeshLambertMaterial({ color: SOL.prairie }), damier: new T.MeshBasicMaterial({ map: damier() }), tremplin: new T.MeshLambertMaterial({ color: '#ff8a2a' }),
    tunnel: new T.MeshLambertMaterial({ color: '#8a7f74', side: T.DoubleSide }), planeur: new T.MeshLambertMaterial({ color: '#4ad3ff' }), objets: new T.MeshLambertMaterial({ color: '#ffd23a', emissive: '#6a4a00' }),
    turbo: new T.MeshBasicMaterial({ color: '#ff5fd2' }), kart: new T.MeshLambertMaterial({ color: '#ff4f3a' }) };
  const sol = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), M.sol); scene.add(sol);
  let G = null; // groupe des objets du circuit (reconstruit à chaque modification)
  const V = { canvas, mode: 'maquette', mini: false, orbit: { yaw: Math.PI + .35, pitch: .62, dist: 600, tx: 0, ty: 0, tz: 0, auto: true }, kart: { s: 0, playing: false }, data: null, stats: { builds: 0, renders: 0, lastBuildMs: 0 } };
  let need = false, raf = 0, lastT = 0;
  const kartMesh = new T.Group(); { const b = new T.Mesh(new T.BoxGeometry(1.6, .6, 2.6), M.kart); b.position.y = .55; kartMesh.add(b); const h = new T.Mesh(new T.SphereGeometry(.45, 10, 8), new T.MeshLambertMaterial({ color: '#ffd23a' })); h.position.set(0, 1.15, -.2); kartMesh.add(h); } kartMesh.visible = false; scene.add(kartMesh);

  /* ---------- construction de la scène ---------- */
  function update(d) {
    // d : { map, geo (walk), sel, bad:Set, warn:Map(k → motif) }
    const t0 = performance.now(); V.data = d; const w = d.geo, map = d.map, P = w.pts, N = P.length, hw = map.width / 2;
    if (G) { G.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); scene.remove(G); } G = new T.Group(); scene.add(G);
    // pièce de chaque point, repère local (tangente et côté) ; points confondus aux raccords écartés
    const piece = new Int16Array(N), tx = new Float32Array(N), tz = new Float32Array(N);
    for (const s of w.spans) for (let i = s.i0 + (s.k ? 1 : 0); i <= s.i1; i++) piece[i] = s.k;
    for (let i = 0; i < N; i++) { const a = P[Math.max(0, i - 1)], b = P[Math.min(N - 1, i + 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; tx[i] = dx / l; tz[i] = dz / l; }
    const couleur = (k) => { const p = map.pieces[k] || {}, c = new T.Color((root.WKStudioCore.SURFACES[p.surf || 'normal'] || root.WKStudioCore.SURFACES.normal).couleur);
      if (d.bad && d.bad.has(k)) c.lerp(COUL.bad, .75); else if (d.warn && d.warn.has(k)) c.lerp(COUL.warn, .55); if (k === d.sel) c.lerp(COUL.sel, .72); return c; };
    // ruban de route (2 sommets par point) et bordures (2 bandes basses de chaque côté)
    { const pos = new Float32Array(N * 6), col = new Float32Array(N * 6), idx = [];
      for (let i = 0; i < N; i++) { const rx = tz[i], rz = -tx[i], c = couleur(piece[i]); for (let sd = 0; sd < 2; sd++) { const o = (sd ? -1 : 1) * hw, j = (i * 2 + sd) * 3; pos[j] = P[i][0] + rx * o; pos[j + 1] = P[i][2] + .05; pos[j + 2] = P[i][1] + rz * o; col[j] = c.r; col[j + 1] = c.g; col[j + 2] = c.b; } if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } /* faces tournées vers le haut */ }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
      const route = new T.Mesh(g, M.route); route.userData.piece = piece; G.add(route); V.route = route; }
    { const pos = [], col = [], idx = []; for (const sd of [1, -1]) { const base = pos.length / 3; for (let i = 0; i < N; i++) { const rx = tz[i] * sd, rz = -tx[i] * sd, c = (Math.floor(i / 2) % 2) ? COUL.bord1 : COUL.bord2;
        for (const [o, h] of [[hw, .05], [hw + 1.2, .05], [hw + 1.2, .7]]) { pos.push(P[i][0] + rx * o, P[i][2] + h, P[i][1] + rz * o); col.push(c.r, c.g, c.b); }
        if (i) { const a = base + (i - 1) * 3, b = a + 3; idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2); } } }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
      const b = new T.Mesh(g, M.bord); b.material.side = T.DoubleSide; G.add(b); }
    // emprise, sol, piliers sous les portions en hauteur
    let a = 1e9, b = -1e9, c = 1e9, e = -1e9, y0 = 1e9, y1 = -1e9; for (const p of P) { a = Math.min(a, p[0]); b = Math.max(b, p[0]); c = Math.min(c, p[1]); e = Math.max(e, p[1]); y0 = Math.min(y0, p[2]); y1 = Math.max(y1, p[2]); }
    const gy = Math.min(0, y0) - 1.2, ext = Math.max(b - a, e - c, 120); V.box = { cx: (a + b) / 2, cz: (c + e) / 2, ext, y0, y1, gy };
    sol.position.set(V.box.cx, gy, V.box.cz); sol.scale.set(ext * 4, 1, ext * 4); M.sol.color.set(SOL[map.biome] || SOL.prairie); scene.background = new T.Color(CIEL[map.biome] || '#bfe2ff'); scene.fog = new T.Fog(scene.background, ext * 1.5, ext * 4.5);
    { const geo = new T.BoxGeometry(1.4, 1, 1.4); geo.translate(0, .5, 0); const pts = []; for (let i = 0; i < N; i += 3) if (P[i][2] - gy > 3) pts.push(i);
      if (pts.length) { const im = new T.InstancedMesh(geo, M.pilier, pts.length * 2), m4 = new T.Matrix4(); let n = 0; for (const i of pts) for (const sd of [1, -1]) { const rx = tz[i] * sd, rz = -tx[i] * sd, h = P[i][2] - gy; m4.makeScale(1, h, 1); m4.setPosition(P[i][0] + rx * (hw - 1.5), gy, P[i][1] + rz * (hw - 1.5)); im.setMatrixAt(n++, m4); } G.add(im); } else geo.dispose(); }
    // ligne de départ
    { const q = new T.Mesh(new T.PlaneGeometry(map.width, 3).rotateX(-Math.PI / 2), M.damier); q.position.set(P[0][0], P[0][2] + .08, P[0][1]); q.rotation.y = Math.atan2(tx[0], tz[0]); G.add(q); }
    // éléments de jeu (volumes simples)
    const at = (s, u) => { const t = s.i0 + (s.i1 - s.i0) * u, i = Math.min(N - 2, Math.floor(t)), f = t - i, A = P[i], B = P[i + 1]; return { x: A[0] + (B[0] - A[0]) * f, y: A[2] + (B[2] - A[2]) * f, z: A[1] + (B[1] - A[1]) * f, h: Math.atan2(tx[i], tz[i]), i }; };
    for (const s of w.spans) { const p = map.pieces[s.k]; if (!p || !p.feat) continue;
      if (p.feat === 'tremplin') { const u = Math.min(.6, (s.len - 8) / s.len), q = at(s, Math.max(.05, u)), g = new T.BoxGeometry(map.width * .8, .6, 9); const m = new T.Mesh(g, M.tremplin); m.position.set(q.x, q.y + .9, q.z); m.rotation.set(0, q.h, 0); m.rotateX(-.22); G.add(m); }
      else if (p.feat === 'tunnel') { const prof = []; for (let k = 0; k <= 10; k++) { const th = Math.PI * k / 10; prof.push([Math.cos(th) * (hw + 2), Math.sin(th) * (hw * .9 + 3)]); } G.add(balayer(P, tx, tz, s.i0, s.i1, prof, M.tunnel, .1, .9)); }
      else if (p.feat === 'planeur') { const g = new T.ConeGeometry(2.2, 5, 8).rotateX(Math.PI / 2); for (const u of [.2, .4, .6, .8]) { const q = at(s, u), m = new T.Mesh(u === .2 ? g : g.clone(), M.planeur); m.position.set(q.x, q.y + 5, q.z); m.rotation.y = q.h; G.add(m); } } // flèches dans le sens de la course
      else if (p.feat === 'objets') { const q = at(s, .5), g = new T.BoxGeometry(1.8, 1.8, 1.8); for (const o of [-.5, 0, .5]) { const m = new T.Mesh(g, M.objets), rx = tz[q.i], rz = -tx[q.i]; m.position.set(q.x + rx * o * hw, q.y + 1.6, q.z + rz * o * hw); m.rotation.set(.5, .7, .3); G.add(m); } }
      else if (p.feat === 'boost') { const q = at(s, .5), m = new T.Mesh(new T.PlaneGeometry(4, 6).rotateX(-Math.PI / 2), M.turbo); m.position.set(q.x, q.y + .1, q.z); m.rotation.y = q.h; G.add(m); } }
    V.tx = tx; V.tz = tz; V.L = w.L; V.stats.builds++; V.stats.lastBuildMs = +(performance.now() - t0).toFixed(2); placeCamera(); invalidate(); return V.stats.lastBuildMs;
  }
  // Balaye un profil 2D [décalage latéral, hauteur] le long des points i0..i1 (tunnel).
  function balayer(P, tx, tz, i0, i1, prof, mat, u0, u1) { const a = Math.floor(i0 + (i1 - i0) * u0), b = Math.ceil(i0 + (i1 - i0) * u1), pos = [], idx = [], n = prof.length;
    for (let i = a; i <= b; i++) { const rx = tz[i], rz = -tx[i]; for (const [o, h] of prof) pos.push(P[i][0] + rx * o, P[i][2] + h, P[i][1] + rz * o); if (i > a) { const s = (i - a - 1) * n; for (let k = 0; k < n - 1; k++) idx.push(s + k, s + k + n, s + k + 1, s + k + 1, s + k + n, s + k + n + 1); } }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return new T.Mesh(g, mat); }

  /* ---------- caméras ---------- */
  function cible() { const d = V.data; if (d && d.sel >= 0 && d.geo.spans[d.sel]) { const s = d.geo.spans[d.sel], P = d.geo.pts, m = P[Math.round((s.i0 + s.i1) / 2)]; let r = 0; for (let i = s.i0; i <= s.i1; i++) r = Math.max(r, Math.hypot(P[i][0] - m[0], P[i][1] - m[1])); return { x: m[0], y: m[2], z: m[1], r: Math.max(30, r) }; }
    return V.box ? { x: V.box.cx, y: (V.box.y0 + V.box.y1) / 2, z: V.box.cz, r: V.box.ext * .6 } : { x: 0, y: 0, z: 0, r: 200 }; }
  function poseKart() { const d = V.data; if (!d) return null; const w = d.geo, P = w.pts, N = P.length; let s = ((V.kart.s % w.L) + w.L) % w.L;
    // abscisse curviligne → point (les spans portent L0..L1 et i0..i1)
    const sp = w.spans.find((x) => s <= x.L1) || w.spans[w.spans.length - 1], u = sp.len ? (s - sp.L0) / sp.len : 0, t = sp.i0 + (sp.i1 - sp.i0) * u, i = Math.min(N - 2, Math.floor(t)), f = t - i;
    const A = P[i], B = P[i + 1]; return { x: A[0] + (B[0] - A[0]) * f, y: A[2] + (B[2] - A[2]) * f, z: A[1] + (B[1] - A[1]) * f, i, k: sp.k }; }
  function placeCamera() {
    if (!V.data) return; kartMesh.visible = V.mode === 'kart';
    if (V.mode === 'kart') { const d = V.data, w = d.geo, q = poseKart(); if (!q) return; V.kart.k = q.k; const ah = (() => { const s0 = V.kart.s; V.kart.s = s0 + 22; const r = poseKart(); V.kart.s = s0; return r; })();
      kartMesh.position.set(q.x, q.y, q.z); kartMesh.rotation.y = Math.atan2(ah.x - q.x, ah.z - q.z);
      const back = (() => { const s0 = V.kart.s; V.kart.s = s0 - 9; const r = poseKart(); V.kart.s = s0; return r; })();
      cam.position.set(back.x, Math.max(back.y, q.y) + 3.4, back.z); cam.lookAt(ah.x, ah.y + 1.2, ah.z); cam.near = .3; cam.far = Math.max(1500, (V.box ? V.box.ext : 500) * 3); cam.updateProjectionMatrix(); void w; return; }
    const o = V.orbit, t = cible(); if (V.mode === 'piece' || o.auto) { o.tx = t.x; o.ty = t.y; o.tz = t.z; if (o.auto) o.dist = t.r * (V.mode === 'piece' ? 2.4 : V.mini ? 1.55 : 2.1); }
    const cp = Math.cos(o.pitch); cam.position.set(o.tx + Math.sin(o.yaw) * cp * o.dist, o.ty + Math.sin(o.pitch) * o.dist, o.tz + Math.cos(o.yaw) * cp * o.dist); cam.lookAt(o.tx, o.ty, o.tz);
    cam.near = Math.max(.5, o.dist / 400); cam.far = o.dist * 8 + 2000; cam.updateProjectionMatrix(); }

  /* ---------- rendu à la demande ---------- */
  function invalidate() { need = true; if (!raf) raf = requestAnimationFrame(tick); }
  function tick(t) { raf = 0; const dt = lastT ? Math.min(.1, (t - lastT) / 1000) : 0; lastT = t;
    if (V.mode === 'kart' && V.kart.playing && V.data) { V.kart.s += 24 * dt; placeCamera(); need = true; if (V.onKart) V.onKart(V.kart.s / V.L); }
    if (need) { need = false; resize(); renderer.render(scene, cam); V.stats.renders++; }
    if (V.mode === 'kart' && V.kart.playing) raf = requestAnimationFrame(tick); else lastT = 0; }
  function resize() { const w = canvas.clientWidth | 0, h = canvas.clientHeight | 0; if (!w || !h) return; const pr = Math.min(root.devicePixelRatio || 1, V.mini ? 1.25 : 1.5);
    if (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(h * pr)) { renderer.setPixelRatio(pr); renderer.setSize(w, h, false); } cam.aspect = w / h; cam.updateProjectionMatrix(); }

  /* ---------- gestes (orbite, zoom, toucher d'une pièce) ---------- */
  const pts = new Map(); let g0 = null;
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.offsetX, e.offsetY]); const o = V.orbit;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; g0 = { pinch: Math.hypot(a[0] - b[0], a[1] - b[1]), dist: o.dist }; return; }
    g0 = { x: e.offsetX, y: e.offsetY, yaw: o.yaw, pitch: o.pitch, moved: false }; });
  canvas.addEventListener('pointermove', (e) => { if (!pts.has(e.pointerId) || !g0) return; pts.set(e.pointerId, [e.offsetX, e.offsetY]); const o = V.orbit;
    if (V.mini || V.mode === 'kart') { if (Math.hypot(e.offsetX - (g0.x || 0), e.offsetY - (g0.y || 0)) > 8) g0.moved = true; return; }
    if (g0.pinch && pts.size === 2) { const [a, b] = [...pts.values()]; o.dist = Math.max(20, Math.min(5000, g0.dist * g0.pinch / Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])))); o.auto = false; placeCamera(); invalidate(); return; }
    if (Math.hypot(e.offsetX - g0.x, e.offsetY - g0.y) > 6) g0.moved = true; if (!g0.moved) return;
    o.yaw = g0.yaw - (e.offsetX - g0.x) * .008; o.pitch = Math.max(.12, Math.min(1.45, g0.pitch + (e.offsetY - g0.y) * .006)); o.auto = false; placeCamera(); invalidate(); });
  const up = (e) => { if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId); if (g0 && !g0.moved && !g0.pinch && pts.size === 0) { if (V.mini) { if (V.onTapMini) V.onTapMini(); } else if (V.mode !== 'kart') { const k = pickAt(e.offsetX, e.offsetY); if (V.onPick) V.onPick(k); } } if (pts.size === 0) g0 = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => { if (V.mini || V.mode === 'kart') return; e.preventDefault(); const o = V.orbit; o.dist = Math.max(20, Math.min(5000, o.dist * (e.deltaY > 0 ? 1.15 : 1 / 1.15))); o.auto = false; placeCamera(); invalidate(); }, { passive: false });
  const ray = new T.Raycaster(), v2 = new T.Vector2();
  function pickAt(px, py) { if (!V.route) return -1; v2.set(px / canvas.clientWidth * 2 - 1, -(py / canvas.clientHeight) * 2 + 1); ray.setFromCamera(v2, cam); const h = ray.intersectObject(V.route, false)[0]; if (!h) return -1; return V.route.userData.piece[Math.floor(h.face.a / 2)]; }

  /* ---------- interface publique ---------- */
  V.update = update; V.invalidate = invalidate;
  V.setMode = (m) => { V.mode = m; if (m !== 'kart') V.kart.playing = false; if (m === 'piece' || m === 'maquette') V.orbit.auto = true; placeCamera(); invalidate(); };
  V.setMini = (b) => { V.mini = !!b; if (b) { V.mode = 'maquette'; V.orbit.auto = true; V.kart.playing = false; } placeCamera(); invalidate(); };
  V.setKart = (u) => { if (!V.data) return; V.kart.s = u * V.L; placeCamera(); invalidate(); };
  V.play = (on) => { V.kart.playing = !!on; invalidate(); };
  V.recadrer = () => { V.orbit.auto = true; placeCamera(); invalidate(); };
  V.pickAt = pickAt; V.camera = cam; V.scene = scene;
  V.dispose = () => { cancelAnimationFrame(raf); raf = 0; if (G) G.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); sol.geometry.dispose(); kartMesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const m of Object.values(M)) { if (m.map) m.map.dispose(); m.dispose(); } renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) { /* rien */ } canvas.remove(); V.disposed = true; };
  return V;
}
function damier() { const c = document.createElement('canvas'); c.width = 64; c.height = 16; const x = c.getContext('2d'); for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#fff'; x.fillRect(i * 4, j * 4, 4, 4); } const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.magFilter = T.NearestFilter; return t; }

// Passages difficiles (P2), à partir des mêmes données que la validation : virage serré, pente forte (proche de la limite).
function difficultes(map) { const out = new Map(), C = root.WKStudioCore;
  map.pieces.forEach((p, k) => { const len = p.t === 'droite' ? p.l : Math.abs(p.a) * Math.PI / 180 * p.r;
    if (p.t === 'virage' && p.r < 32 && Math.abs(p.a) >= 60) out.set(k, 'virage serré (rayon ' + p.r + ' m)');
    if (p.dy && Math.abs(p.dy) * 1.5 / len > C.LIMITS.grade * .7) out.set(k, (out.has(k) ? out.get(k) + ', ' : '') + 'pente forte (' + Math.round(Math.abs(p.dy) * 150 / len) + ' %)'); });
  return out; }

root.WKStudio3D = { create, difficultes };
})(window);
