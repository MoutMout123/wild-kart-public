/* Wild Kart — Bac à sable : circuits d'essai isolés (virages à 90°, looping, plante carnivore) et mesures avec la vraie physique.
   Inactif en jeu normal. Ouvrir index.html?bac=virages (ou looping, plante) pour piloter soi-même avec un panneau de diagnostic ;
   les bancs automatiques (scripts/bac-a-sable.cjs) appellent WKBac.mesurer(). Aucune règle de jeu n'est modifiée ici. */
(function (root) {
'use strict';
const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), ang = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

/* Tracé « tortue » : S = ligne droite (m), G/D = virage à gauche/droite (degrés, rayon en m). Les arcs sont échantillonnés
   tous les 3 m, donc la Catmull-Rom du jeu reproduit le rayon voulu (pas un rayon qui dépend de l'espacement des points). */
function trace(steps) {
  let x = 0, z = 0, h = 0; const pts = [[0, 0, 0]], marks = [];
  const push = () => pts.push([+x.toFixed(3), +z.toFixed(3), 0]);
  for (const s of steps) {
    if (s[0] === 'S') { const n = Math.max(1, Math.ceil(s[1] / 20)); for (let q = 0; q < n; q++) { x += Math.sin(h) * s[1] / n; z += Math.cos(h) * s[1] / n; push(); } continue; }
    const dir = s[0] === 'G' ? 1 : -1, a = s[1] * Math.PI / 180, R = s[2], n = Math.max(2, Math.ceil(R * a / 3)), da = a / n;
    marks.push({ at: pts.length, kind: s[0] + s[1], R });
    for (let q = 0; q < n; q++) { const hm = h + dir * da / 2, ch = 2 * R * Math.sin(da / 2); x += Math.sin(hm) * ch; z += Math.cos(hm) * ch; h += dir * da; push(); }
  }
  const last = pts[pts.length - 1]; if (Math.hypot(last[0], last[1]) < 1) pts.pop();
  return { pts, marks, close: Math.hypot(x, z) };
}
/* Rectangle 360 × 240 à coins arrondis de rayons différents, avec une « marche » de quatre virages à 90° enchaînés. */
function scene(name) {
  const W = 360, H = 240, r = [12, 20, 26, 32], b = 20, s = 40, t = 30, side = (len) => ['S', len];
  if (name === 'virages') {
    const bottom = W - r[3] - r[0], right = H - r[0] - r[1], top = W - r[1] - r[2], left = H - r[2] - r[3], rest = top - (4 * b + t);
    return trace([side(bottom), ['G', 90, r[0]], side(right), ['G', 90, r[1]], side(rest / 2), ['G', 90, b], side(s), ['D', 90, b], side(t), ['D', 90, b], side(s), ['G', 90, b], side(rest / 2), ['G', 90, r[2]], side(left), ['G', 90, r[3]]]);
  }
  if (name === 'looping') return trace([side(560 - 30 - 14), ['G', 90, 14], side(260 - 14 - 30), ['G', 90, 30], side(560 - 60), ['G', 90, 30], side(260 - 60), ['G', 90, 30]]);
  if (name === 'plante') return trace([side(500), ['G', 180, 60], side(500), ['G', 180, 60]]);
  return null;
}
const SCENES = { virages: 'Virages à 90° (rayons 12, 20, 26, 32 m) et marche de quatre virages de 20 m', looping: 'Looping de 22 m suivi d’un virage à 90° de 14 m', plante: 'Ligne droite avec Croque-pétales' };
function register(K, name) {
  const id = 'bac-' + name, old = K.TRACKS.findIndex((t) => t.id === id); if (old >= 0) return old;
  const tr = scene(name); if (!tr) throw new Error('scène inconnue ' + name);
  const base = K.TRACKS.find((t) => t.id === 'piquenique') || K.TRACKS[0], theme = Object.assign({}, base.theme, { terrain: null, decor: 'prairie' });
  const def = { id, name: 'Bac à sable — ' + name, desc: SCENES[name], cup: 1, level: 1, laps: 3, width: 24, glideH: 10, theme, pts: tr.pts, boosts: [], items: [], branches: [], bac: name, marks: tr.marks };
  if (name === 'looping') { const L = tr.pts.length; void L; def.warp = [{ type: 'loop', r: 22, from: .19, to: .3 }]; }
  if (name === 'plante') { def.obstZones = 0; def.bacPlants = [.1, .2, .3, .62, .72]; }
  K.TRACKS.push(def); return K.TRACKS.length - 1;
}

/* Pilote automatique : vise un point 14 m devant, sur une ligne latérale fixe (fraction de la demi-largeur). */
function pilot(K, k, line, drift) {
  const W = K.G.W, S = W.S, P = k.P || S, n = Math.round(14 / P.seg), [Q, j] = K.aheadOn(k, n, null), lat = line * (Q.hw || W.hw);
  const tx = Q.px[j] + Q.rx[j] * lat, tz = Q.pz[j] + Q.rz[j] * lat, ws = S.wscale && Q === S ? S.wscale[j] : 1;
  // Dans une zone déformée, la piste dépliée est raccourcie : on vise dans l'espace physique (même repère que kartPhysics).
  const des = Math.atan2(tx - k.x, tz - k.z); void ws;
  const e = ang(k.h, des), steer = clamp(-e * 2.6, -1, 1);
  return { steer, throttle: 1, brake: false, drift: !!drift && Math.abs(e) > .25 };
}
/* Un tour (ou plus) en pilotage automatique ; renvoie toutes les anomalies de suivi de route. */
function rouler(K, opts) {
  const W = K.G.W, S = W.S, R = K.G.race, k = R.player, dt = 1 / 60, max = opts.secondes || 60, lim = W.lim;
  K.G.karts = [k]; R.state = 'race';
  Object.assign(k, { P: S, idx: 10, x: S.px[10] + S.rx[10] * opts.line * W.hw, z: S.pz[10] + S.rz[10] * opts.line * W.hw, y: S.py[10], groundY: S.py[10], h: S.hd[10], vh: S.hd[10], halfway: false, speed: k.maxSpeed * .9, air: null, airH: 0, vy: 0, fallT: 0, spin: 0, boost: 0, item: null, lap: 1, finished: false, drift: 0, wallT: 0 });
  K.trackLocate(k);
  const res = { line: opts.line, drift: !!opts.drift, sauts: [], reculs: [], blocages: [], murs: 0, chutes: 0, tours: 0, minVit: 1e9, distance: 0, tps: 0 };
  let prev = { x: k.x, z: k.z, lat: k.lat, idx: k.idx, P: k.P }, slow = 0, wall0 = false, run = 0;
  for (let f = 0; f < max * 60; f++) {
    const inp = pilot(K, k, opts.line, opts.drift);
    K.kartPhysics(k, inp, dt); R.t += dt; W.clock = R.t; if (K.updateObstacles) K.updateObstacles(dt);
    const step = Math.hypot(k.x - prev.x, k.z - prev.z), lim1 = Math.abs(k.speed) * dt * 1.6 + .35, where = { t: +(f / 60).toFixed(2), f: +(k.idx / (k.P || S).N).toFixed(3), lat: +k.lat.toFixed(1), v: +k.speed.toFixed(1) };
    if (k.fallT > 0) { res.chutes++; break; }
    if (step > lim1) res.sauts.push(Object.assign({ m: +step.toFixed(2) }, where));
    if (k.P === prev.P) { let di = k.idx - prev.idx; if ((k.P || S).closed) { const N = (k.P || S).N; if (di > N / 2) di -= N; if (di < -N / 2) di += N; } if (di < -2) res.reculs.push(Object.assign({ di }, where)); if (k.P === S) run += di; }
    if (Math.abs(k.lat - prev.lat) > lim1 + .4 && k.P === prev.P) res.sauts.push(Object.assign({ lat: 'saut latéral ' + (k.lat - prev.lat).toFixed(1) }, where));
    if (f > 120 && k.speed < k.maxSpeed * .3) { slow += dt; if (slow > .5 && !res.blocages.some((b) => Math.abs(b.t - where.t) < 2)) res.blocages.push(where); } else slow = 0;
    const onWall = k.wallT > .55; if (onWall && !wall0) res.murs++; wall0 = onWall;
    if (f > 60) res.minVit = Math.min(res.minVit, k.speed);
    res.distance += step; prev = { x: k.x, z: k.z, lat: k.lat, idx: k.idx, P: k.P };
    if (run >= S.N * (res.tours + 1)) { res.tours++; if (res.tours >= (opts.tours || 1)) { res.tps = +(f / 60).toFixed(2); break; } }
    void lim;
  }
  res.minVit = +(res.minVit / k.maxSpeed).toFixed(2); res.distance = +res.distance.toFixed(0);
  return res;
}
/* Réponse au volant : écart latéral obtenu en 0,3 s de braquage franc, à vitesse constante, à un point donné (comparé à la ligne droite). */
function reponse(K, frac, line) {
  const W = K.G.W, S = W.S, k = K.G.race.player, i = Math.round(frac * S.N) % S.N, out = {};
  for (const sg of [-1, 1]) {
    Object.assign(k, { P: S, idx: i, x: S.px[i] + S.rx[i] * line * W.hw, z: S.pz[i] + S.rz[i] * line * W.hw, y: S.py[i], groundY: S.py[i], h: S.hd[i], vh: S.hd[i], speed: k.maxSpeed * .8, air: null, airH: 0, vy: 0, fallT: 0, spin: 0, boost: 0, drift: 0, wallT: 0, lap: 1 });
    K.trackLocate(k); const lat0 = k.lat;
    for (let f = 0; f < 18; f++) { K.kartPhysics(k, { steer: sg, throttle: 1, brake: false, drift: false }, 1 / 60); }
    out[sg > 0 ? 'droite' : 'gauche'] = +(k.lat - lat0).toFixed(2);
  }
  return out;
}
/* À l'écran : on braque à droite 0,3 s ; le kart doit partir vers la droite de l'image (caméra réelle du jeu), y compris à l'envers. */
function ecran(K, frac) {
  const W = K.G.W, S = W.S, R = K.G.race, k = R.player, T = root.THREE, i0 = Math.round(frac * S.N) % S.N, back = Math.round(40 / S.seg), out = {};
  for (const sg of [-1, 1]) {
    const i = ((i0 - back) % S.N + S.N) % S.N; // élan de 40 m pour que la caméra soit installée
    Object.assign(k, { P: S, idx: i, x: S.px[i], z: S.pz[i], y: S.py[i], groundY: S.py[i], h: S.hd[i], vh: S.hd[i], speed: k.maxSpeed * .8, air: null, airH: 0, vy: 0, fallT: 0, spin: 0, boost: 0, drift: 0, wallT: 0, lap: 1 });
    K.trackLocate(k); R.state = 'race';
    let guard = 0; while (guard++ < 600) { const di = ((k.idx - i0) % S.N + S.N) % S.N; if (di < S.N / 2 && di >= 0 && k.idx !== i) { if (di < 3 || di > S.N - 3) break; } K.kartPhysics(k, { steer: 0, throttle: 1, brake: false, drift: false }, 1 / 60); K.updateVisuals(1 / 60); if (Math.abs(((k.idx - i0) % S.N + S.N) % S.N) < 2) break; }
    // Déplacement visuel du kart projeté sur l'axe « droite » de la caméra au moment du braquage (m) : + = vers la droite de l'image.
    K.camera.updateMatrixWorld(); const right = new T.Vector3().setFromMatrixColumn(K.camera.matrixWorld, 0), p0 = k.mesh.g.position.clone(), up0 = K.camera.up.y;
    for (let f = 0; f < 18; f++) { K.kartPhysics(k, { steer: sg, throttle: 1, brake: false, drift: false }, 1 / 60); K.updateVisuals(1 / 60); }
    void p0; void up0;
    // L'axe latéral rendu (wr dans les zones déformées) doit pointer vers la droite de l'image : sinon le volant semblerait inversé.
    const j = k.idx, wz = S.wz && S.wz[j], v = wz ? new T.Vector3(S.wr[j * 3], S.wr[j * 3 + 1], S.wr[j * 3 + 2]) : new T.Vector3(S.rx[j], 0, S.rz[j]);
    out[sg > 0 ? 'alignDroite' : 'alignGauche'] = +v.normalize().dot(right).toFixed(2); out.hautCamera = +K.camera.up.y.toFixed(2);
  }
  return out;
}
/* Fluidité de la caméra : traversée en ligne droite de 60 m avant à 60 m après la zone ; plus grande rotation d'une image à
   l'autre (direction + haut, en degrés) et où elle se produit (fraction de la zone, <0 avant, >1 après). */
function secousse(K, z) {
  const W = K.G.W, S = W.S, R = K.G.race, k = R.player, T = root.THREE, cam = K.camera, d = new T.Vector3(), i = ((z.i0 - Math.round(60 / S.seg)) % S.N + S.N) % S.N;
  Object.assign(k, { P: S, idx: i, x: S.px[i], z: S.pz[i], y: S.py[i], groundY: S.py[i], h: S.hd[i], vh: S.hd[i], speed: k.maxSpeed * .85, air: null, airH: 0, vy: 0, fallT: 0, spin: 0, boost: 0, drift: 0, wallT: 0, lap: 1 });
  K.trackLocate(k); R.state = 'race';
  let prev = null, worst = { deg: 0 }, run = 0, last = k.idx; const end = (z.i1 - z.i0) + Math.round(120 / S.seg), hist = [], lags = [];
  for (let f = 0; f < 1200 && run < end; f++) {
    K.kartPhysics(k, { steer: 0, throttle: 1, brake: false, drift: false }, 1 / 60); K.updateVisuals(1 / 60); cam.updateMatrixWorld(); cam.getWorldDirection(d);
    let di = k.idx - last; if (di < -S.N / 2) di += S.N; run += di; last = k.idx;
    const cur = [d.clone(), cam.up.clone()];
    // Retard de la caméra : angle entre le haut de l'image et le haut réel de la piste (S.wu) dans la zone déformée.
    if (S.wz && S.wz[k.idx]) { const q = k.idx * 3, lag = cam.up.angleTo(new T.Vector3(S.wu[q], S.wu[q + 1], S.wu[q + 2]).normalize()) * 180 / Math.PI; lags.push(lag); }
    if (prev) { const a = (cur[0].angleTo(prev[0]) + cur[1].angleTo(prev[1])) * 180 / Math.PI; hist.push(a); if (a > worst.deg) worst = { deg: +a.toFixed(2), u: +(((k.idx - z.i0 + S.N) % S.N) / (z.i1 - z.i0)).toFixed(2) }; }
    prev = cur;
  }
  hist.sort((a, b) => a - b);
  lags.sort((a, b) => a - b);
  return { pire: worst, p95: +(hist[Math.floor(hist.length * .95)] || 0).toFixed(2), images: hist.length,
    retard: { max: +(lags[lags.length - 1] || 0).toFixed(1), moyen: +(lags.reduce((a, b) => a + b, 0) / (lags.length || 1)).toFixed(1), p95: +(lags[Math.floor(lags.length * .95)] || 0).toFixed(1) } };
}
/* Banc complet d'une scène : lignes intérieure → extérieure, avec et sans dérapage. */
function mesurer(name, opts = {}) {
  const K = root.__TK, ti = register(K, name);
  K.SAVE.obst = name === 'plante'; K.RACE_OPTS.obst = name === 'plante'; K.SAVE.quality = opts.quality || 'low';
  K.startRace(ti, opts.cc == null ? 2 : opts.cc); K.G.paused = true; K.show(null);
  const W = K.G.W, S = W.S, rows = [], k = K.G.race.player;
  if (opts.lourd) { k.maxSpeed = K.CC_REF ? k.maxSpeed : 70.4; k.turn = 1.8; }
  const out0 = {};
  const lines = opts.lines || [-.8, -.4, 0, .4, .8];
  for (const line of lines) for (const drift of [false, true]) rows.push(rouler(K, { line, drift, tours: 1, secondes: 90 }));
  if (opts.lourd) Object.assign(out0, { kart: 'lourd (vitesse max, maniabilité min)' });
  const out = { ...out0, scene: name, N: S.N, L: +S.L.toFixed(0), rayonMin: +minRadius(S).toFixed(1), lim: +W.lim.toFixed(1), rows };
  if (name === 'looping') { const z = (W.def.warp || [])[0]; out.reponse = { plat: reponse(K, .05, 0) }; for (const u of [0, .25, .5, .75, 1]) out.reponse['looping ' + u * 100 + ' %'] = reponse(K, z.from + (z.to - z.from) * u, 0); out.reponse.sortie = reponse(K, z.to + .01, 0); out.reponse['sortie+20m'] = reponse(K, z.to + 20 / S.L, 0);
    out.secousse = secousse(K, z);
    out.ecran = {}; for (const u of [-.05, .1, .3, .5, .7, .9, 1.05]) out.ecran['looping ' + Math.round(u * 100) + ' %'] = ecran(K, z.from + (z.to - z.from) * u); }
  return out;
}
/* Test visuel isolé des grands reliefs (montagnes d'horizon, collines, terrain) : pour 192 points de vue par circuit (24 positions
   le long de la route × 8 directions, caméra du jeu), compare ce que three.js garde (frustum culling sur la sphère englobante)
   à la vérité géométrique (un sommet au moins dans le champ). Mesure aussi la part du relief coupée par le plan lointain alors
   que le brouillard ne la cache pas complètement : ce sont les deux façons dont une montagne « disparaît » à l'écran. */
function horizon(id, opts = {}) {
  const K = root.__TK, T = root.THREE, ti = K.TRACKS.findIndex((t) => t.id === id); K.SAVE.quality = opts.quality || 'high';
  K.startRace(ti, 1); K.G.paused = true; K.show(null);
  const W = K.G.W, S = W.S, cam = K.camera, fr = new T.Frustum(), PV = new T.Matrix4(), v = new T.Vector3(), m = new T.Matrix4(), w = new T.Vector3();
  W.scene.updateMatrixWorld(true);
  const big = []; W.scene.traverse((o) => { if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return; let vis = true; for (let q = o; q; q = q.parent) if (!q.visible) vis = false; if (!vis) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); const sc = o.matrixWorld.getMaxScaleOnAxis(), r = o.geometry.boundingSphere.radius * sc;
    let rInst = 0; if (o.isInstancedMesh) for (let i = 0; i < Math.min(o.count, 64); i++) { o.getMatrixAt(i, m); rInst = Math.max(rInst, o.geometry.boundingSphere.radius * m.getMaxScaleOnAxis()); }
    if (Math.max(r * (o.isInstancedMesh ? 0 : 1), rInst) > 60 && !/ciel|sky/i.test(o.name || '')) big.push(o); });
  // Échantillons de sommets en coordonnées monde (≤ 4000 par objet).
  const samples = big.map((o) => { const P = o.geometry.attributes.position, pts = [], n = o.isInstancedMesh ? o.count : 1, per = Math.max(1, Math.floor(P.count * n / 4000));
    for (let k = 0; k < n; k++) { if (o.isInstancedMesh) o.getMatrixAt(k, m); for (let i = (k * 7) % per; i < P.count; i += per) { w.fromBufferAttribute(P, i); if (o.isInstancedMesh) w.applyMatrix4(m); w.applyMatrix4(o.matrixWorld); pts.push(w.x, w.y, w.z); } }
    return new Float32Array(pts); });
  const fog = W.scene.fog, rows = big.map((o) => { const mat = Array.isArray(o.material) ? o.material[0] : o.material, fs = mat && mat.userData && mat.userData.uniforms && mat.userData.uniforms.fogScale && mat.userData.uniforms.fogScale.value;
    return { nom: o.name || o.geometry.type, type: o.isInstancedMesh ? 'instances×' + o.count : 'maillage', fogScale: fs || 1, vues: 0, cachéÀTort: 0, coupéLoin: 0, pireCoupe: 0 }; });
  const fogAt = (d, fs) => { if (!fog) return 0; const t = clamp((d - fog.near * fs) / (fog.far * fs - fog.near * fs), 0, 1); const f = t * t * (3 - 2 * t); return fs > 1 ? Math.max(f * .8, .12) : f; };
  const aspect = opts.aspect || 16 / 9; cam.aspect = aspect; cam.fov = 70; cam.updateProjectionMatrix();
  for (let s = 0; s < 24; s++) { const i = Math.floor(s / 24 * S.N), x = S.px[i], z = S.pz[i], y = S.py[i] + 3.5;
    for (let d = 0; d < 8; d++) { const a = S.hd[i] + d * Math.PI / 4; cam.up.set(0, 1, 0); cam.position.set(x - Math.sin(a) * 8.6, y, z - Math.cos(a) * 8.6); cam.lookAt(x + Math.sin(a) * 6, y - 1.2, z + Math.cos(a) * 6); cam.updateMatrixWorld();
      PV.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); fr.setFromProjectionMatrix(PV);
      big.forEach((o, n) => { const row = rows[n], pts = samples[n], engine = fr.intersectsObject(o); let inView = 0, far = 0;
        for (let q = 0; q < pts.length; q += 3) { v.set(pts[q], pts[q + 1], pts[q + 2]); const dist = v.distanceTo(cam.position); v.applyMatrix4(cam.matrixWorldInverse); if (v.z > -cam.near) continue; const ex = v.clone().applyMatrix4(cam.projectionMatrix);
          if (Math.abs(ex.x) <= 1 && Math.abs(ex.y) <= 1) { if (-v.z <= cam.far) inView++; else if (fogAt(dist, row.fogScale) < .97) far++; } }
        if (inView + far) row.vues++; if (inView && !engine) row.cachéÀTort++; if (far) { row.coupéLoin++; row.pireCoupe = Math.max(row.pireCoupe, +(far / (inView + far)).toFixed(3)); } }); } }
  return { id, far: cam.far, brouillard: fog ? [fog.near, fog.far] : null, objets: rows };
}
function minRadius(P) { let m = Infinity; for (let i = 0; i < P.N; i++) { const c = Math.abs(P.curv[i]); if (c > 1e-6) m = Math.min(m, P.seg / c); } return m; }
/* Recensement des rayons de virage des vrais circuits (route principale et branches). */
function rayons() {
  const K = root.__TK, out = [];
  for (const t of K.TRACKS) { if (t.bac) continue; try { const S = K.buildSamples(t); out.push({ id: t.id, rayonMin: +minRadius(S).toFixed(1), largeur: t.width, lim: +(t.width / 2 + 1.6 + 5.5 - 1.3).toFixed(1) }); } catch (e) { out.push({ id: t.id, err: String(e) }); } }
  return out;
}

/* Rayon de braquage réel du kart (volant à fond, vitesse maintenue), par cylindrée, maniabilité et vitesse, avec et sans dérapage :
   mesuré sur la longue ligne droite de la scène « virages » entre 0,3 et 0,6 s de braquage (rayon = distance / rotation de la trajectoire). */
function braquage(opts = {}) {
  const K = root.__TK, ti = register(K, 'virages'), out = [];
  for (const cc of [0, 1, 2]) {
    K.startRace(ti, cc); K.G.paused = true; K.show(null);
    const W = K.G.W, S = W.S, R = K.G.race, k = R.player, st0 = Object.assign({}, k.st), v = K.CC ? K.CC[cc].v : [44, 54, 64][cc];
    K.G.karts = [k]; R.state = 'race';
    for (const hdl of opts.maniabilites || [0, .5, 1]) for (const frac of opts.vitesses || [.5, .8, 1]) for (const drift of [false, true]) {
      k.st = Object.assign({}, st0, { handling: hdl, speed: .5 }); k.turn = 1.8 + .9 * hdl; k.maxSpeed = v;
      // Départ près d'un bord : le virage dispose de toute la largeur (sinon le mur latéral est atteint avant la fin de la mesure).
      let res = null;
      for (const side of [-1, 1]) {
        const i = 10, lat0 = side * .85 * W.lim; Object.assign(k, { P: S, idx: i, x: S.px[i] + S.rx[i] * lat0, z: S.pz[i] + S.rz[i] * lat0, y: S.py[i], groundY: S.py[i], h: S.hd[i], vh: S.hd[i], speed: v * frac, air: null, airH: 0, vy: 0, fallT: 0, spin: 0, boost: 0, drift: 0, driftArm: 0, wallT: 0, lap: 1 });
        K.trackLocate(k);
        let vh0 = 0, dist = 0, enDerapage = false, mur = false;
        for (let f = 0; f < 36; f++) {
          const px = k.x, pz = k.z; k.speed = v * frac; k.boost = 0;
          K.kartPhysics(k, { steer: 1, throttle: 1, brake: false, drift }, 1 / 60);
          if (k.wallT > .5) mur = true;
          if (f === 17) { vh0 = k.vh; dist = 0; } else if (f > 17) dist += Math.hypot(k.x - px, k.z - pz);
          if (f > 17 && k.drift) enDerapage = true;
        }
        const dvh = Math.abs(Math.atan2(Math.sin(k.vh - vh0), Math.cos(k.vh - vh0)));
        res = { cc: ['50cc', '100cc', '150cc'][cc], maniabilite: hdl, vitesse: frac, derapage: drift, derapageActif: enDerapage, rayon: dvh > 1e-4 ? +(dist / dvh).toFixed(1) : null, mur };
        if (!mur) break;
      }
      out.push(res);
    }
  }
  return out;
}
/* Mode joueur : ?bac=<scène> lance directement la course d'essai et affiche un panneau de diagnostic. */
function interactif(name) {
  const K = root.__TK; if (!K) return setTimeout(() => interactif(name), 200);
  const ti = register(K, name); K.SAVE.obst = name === 'plante';
  setTimeout(() => { K.startRace(ti, 1); panneau(K); }, 600);
}
function panneau(K) {
  const el = document.createElement('div'); el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99999;font:12px/1.35 monospace;background:rgba(10,12,30,.78);color:#e8ecff;padding:8px 10px;border-radius:8px;pointer-events:none;white-space:pre';
  document.body.appendChild(el); let prev = null, sauts = 0, reculs = 0;
  const tick = () => { const R = K.G.race, k = R && R.player, W = K.G.W; if (k && W) {
      if (prev && prev.P === k.P) { const st = Math.hypot(k.x - prev.x, k.z - prev.z); if (st > Math.abs(k.speed) / 60 * 3 + 1.5) sauts++; let di = k.idx - prev.idx; const N = (k.P || W.S).N; if (di < -N / 2) di += N; if (di > N / 2) di -= N; if (di < -3) reculs++; }
      prev = { x: k.x, z: k.z, idx: k.idx, P: k.P };
      const S = W.S, ws = S.wscale && k.P === S ? S.wscale[k.idx] : 1;
      el.textContent = `BAC À SABLE — ${W.def.desc}\nvitesse ${(k.speed / k.maxSpeed * 100).toFixed(0)} %   latéral ${k.lat.toFixed(1)} m / mur ${W.lim.toFixed(1)}\nindex ${k.idx}/${(k.P || S).N}   zone déformée ${ws !== 1 ? 'oui (échelle ' + ws.toFixed(2) + ')' : 'non'}\nmur ${k.wallT > .5 ? 'CONTACT' : '-'}   sauts de position ${sauts}   reculs d'index ${reculs}`; }
    requestAnimationFrame(tick); };
  tick();
}
const m = /[?&]bac=([a-z]+)/.exec(location.search || '');
if (m && SCENES[m[1]]) addEventListener('load', () => interactif(m[1]));
root.WKBac = { SCENES, scene, register, rouler, reponse, ecran, mesurer, rayons, minRadius, horizon, braquage };
})(window);
