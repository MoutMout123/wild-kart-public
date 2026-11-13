/* Wild Kart — ÉLÉMENTS DE LIEUX (11 nov. 2026, reprise artistique de Val des Hérons, #36 / #37).
   Chaque lieu traversé reçoit un repère construit et quelque chose de vivant, pour qu'il ait une ambiance et un rôle dans le tour :
   moulin à vent sur le col, arche de roche stratifiée à la gorge, ponton, barques et hérons sur le lac, fruitiers en fleurs, clôtures,
   cageots, ruches, guirlandes de fanions et pétales au verger, portique de bois au départ.
   Même contrat que decors.js : WKLieux.<recette>(T, o) → { groupe, emprise: [{x, z, r}], cout: {appels, triangles}, maj?(dt, t) }.
   Fonctions pures et déterministes (o.graine), SANS collision, sans accès au monde : l'appelant (game.js, lieuxAmbiancesBuild) fournit
   les positions et vérifie que l'emprise reste hors de l'enveloppe roulable. Matériaux marqués wkProduction (graphics.js ne les remplace
   pas). o.qualite : 'high' | 'medium' | 'low' (moins de facettes et d'éléments animés en basse qualité, mêmes silhouettes). */
(function (root) {
'use strict';
const TAU = Math.PI * 2;
function rng(seed) { let s = (seed >>> 0) || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const bas = (o) => o && o.qualite === 'low';

/* ---------- Outils : fusion de volumes simples avec couleur par sommet ---------- */
function Lot(T) { this.T = T; this.p = []; this.n = []; this.c = []; }
Lot.prototype.ajoute = function (geo, m, couleur, haut, lisse) {   // couleur : '#rrggbb' ; haut : couleur du dessus (dégradé vertical) ; lisse : garde les normales du volume (masses rondes)
  const T = this.T, g = geo.index ? geo.toNonIndexed() : geo; if (m) g.applyMatrix4(m); if (!lisse || !g.attributes.normal) g.computeVertexNormals();
  const P = g.attributes.position, N = g.attributes.normal, c0 = new T.Color(couleur), c1 = haut ? new T.Color(haut) : null; let y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < P.count; i++) { const y = P.getY(i); if (y < y0) y0 = y; if (y > y1) y1 = y; }
  for (let i = 0; i < P.count; i++) { this.p.push(P.getX(i), P.getY(i), P.getZ(i)); this.n.push(N.getX(i), N.getY(i), N.getZ(i));
    const k = c1 ? (P.getY(i) - y0) / Math.max(1e-6, y1 - y0) : 0; this.c.push(c0.r + (c1 ? (c1.r - c0.r) * k : 0), c0.g + (c1 ? (c1.g - c0.g) * k : 0), c0.b + (c1 ? (c1.b - c0.b) * k : 0)); }
  if (g !== geo) g.dispose(); geo.dispose(); return this; };
Lot.prototype.geo = function () { const T = this.T, g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3)); g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3)); g.computeBoundingSphere(); return g; };
Lot.prototype.maille = function (mat, ombre) { const m = new this.T.Mesh(this.geo(), mat); m.castShadow = ombre !== false; m.receiveShadow = true; return m; };
function M4(T, x, y, z, ry, sx, sy, sz, rx, rz) { const m = new T.Matrix4(), q = new T.Quaternion().setFromEuler(new T.Euler(rx || 0, ry || 0, rz || 0, 'YXZ')); return m.compose(new T.Vector3(x, y, z), q, new T.Vector3(sx == null ? 1 : sx, sy == null ? (sx == null ? 1 : sx) : sy, sz == null ? (sx == null ? 1 : sx) : sz)); }
const MATS = new Map();
function mat(T, cle, o) { if (MATS.has(cle)) return MATS.get(cle); const m = new T.MeshStandardMaterial(Object.assign({ color: '#ffffff', vertexColors: true, roughness: .86, metalness: 0, envMapIntensity: .25 }, o || {})); m.userData.wkProduction = true; m.userData.wkLieux = true; MATS.set(cle, m); return m; }
function cout(groupe) { let appels = 0, triangles = 0; groupe.traverse((o) => { if (!o.isMesh && !o.isPoints) return; appels++; const g = o.geometry, n = g.index ? g.index.count : g.attributes.position.count; triangles += (o.isPoints ? 0 : n / 3) * (o.isInstancedMesh ? o.count : 1); }); return { appels, triangles: Math.round(triangles) }; }
function fin(T, groupe, emprise, maj) { groupe.userData.wkLieux = true; return { groupe, emprise, cout: cout(groupe), maj: maj || null }; }

/* ---------- Moulin à vent (repère du col) : tour de pierre claire évasée, toit de tuiles, galerie, quatre ailes entoilées qui tournent ---------- */
function moulin(T, o = {}) {
  const H = o.hauteur || 17, n = bas(o) ? 8 : 14, L = new Lot(T), groupe = new T.Group();
  L.ajoute(new T.CylinderGeometry(3.1, 4.6, H * .72, n, 3), M4(T, 0, H * .36, 0), '#d9c9a6', '#f2e8cf');       // tour
  L.ajoute(new T.CylinderGeometry(4.9, 5.2, .9, n), M4(T, 0, .45, 0), '#a89878');                                 // soubassement
  L.ajoute(new T.CylinderGeometry(3.9, 3.9, .35, n), M4(T, 0, H * .46, 0), '#7a5a3a');                            // galerie
  for (let k = 0; k < n; k++) { const a = k / n * TAU; L.ajoute(new T.BoxGeometry(.14, 1.1, .14), M4(T, Math.cos(a) * 3.8, H * .46 + .7, Math.sin(a) * 3.8), '#7a5a3a'); }
  L.ajoute(new T.TorusGeometry(3.8, .08, 5, n), M4(T, 0, H * .46 + 1.25, 0, 0, 1, 1, 1, Math.PI / 2), '#7a5a3a');
  L.ajoute(new T.ConeGeometry(3.7, H * .26, n), M4(T, 0, H * .72 + H * .13, 0), '#b5452f', '#d86a44');           // toit
  L.ajoute(new T.BoxGeometry(1.5, 2.6, .3), M4(T, 0, 1.75, 4.45), '#5a3d28');                                     // porte (côté +z = face aux ailes)
  for (const [y, a] of [[H * .3, .9], [H * .56, -.7], [H * .56, 2.3]]) L.ajoute(new T.BoxGeometry(.9, 1.2, .3), M4(T, Math.sin(a) * 3.7, y, Math.cos(a) * 3.7, a), '#3d4a5c');
  groupe.add(L.maille(mat(T, 'pierre')));
  // ailes : moyeu à l'avant (+z), quatre vergues en treillis, toile claire sur un côté de chaque vergue
  const A = new Lot(T), R = H * .62; A.ajoute(new T.CylinderGeometry(.5, .5, 1.6, 8), M4(T, 0, 0, .2, 0, 1, 1, 1, Math.PI / 2), '#5a3d28');
  for (let k = 0; k < 4; k++) { const a = k * TAU / 4, m = new T.Matrix4().makeRotationZ(a);
    const pose = (g, x, y, z, col) => A.ajoute(g, new T.Matrix4().multiplyMatrices(m, new T.Matrix4().makeTranslation(x, y, z)), col);
    pose(new T.BoxGeometry(.22, R, .22), 0, R / 2 + .3, .6, '#6b4a30');
    pose(new T.BoxGeometry(1.9, R * .78, .06), 1.0, R * .58 + .3, .6, '#f4ead2');
    for (let q = 0; q < 6; q++) pose(new T.BoxGeometry(2.0, .1, .12), 1.0, R * (.22 + q * .145) + .3, .62, '#6b4a30'); }
  const ailes = A.maille(mat(T, 'bois-toile', { side: T.DoubleSide })); ailes.position.set(0, H * .78, 3.6); groupe.add(ailes);
  const v = o.vitesse != null ? o.vitesse : .55;
  return fin(T, groupe, [{ x: 0, z: 0, r: 6 }], (dt) => { ailes.rotation.z -= dt * v; });
}

/* ---------- Arche de roche (porte de la gorge) : anneau de roche stratifiée enjambant la route, herbe sur le dessus ----------
   o.demi : demi-portée entre les axes des pieds (m) ; o.hauteur : hauteur de l'axe au sommet ; o.rayon : rayon de la section.
   Repère local : x en travers de la route, y vers le haut, z le long de la route. Dégagement sous l'arche vérifié par l'appelant. */
function arche(T, o = {}) {
  /* v10 (13 nov., demande du propriétaire : le dessous de l'arche) : anneau plus fin (38 × 16 facettes), bancs de roche en saillie tous
     les 1,7 m (les strates se lisent de près et par-dessous), ombrage lissé, dessous plus sombre et plus chaud, lierre et lianes qui
     pendent de la clé (jamais plus bas que 9 m au-dessus de la chaussée), herbe sur le dessus. */
  const r = rng(o.graine || 7), a = o.demi || 21, H = o.hauteur || 17, R0 = o.rayon || 3.6, nS = bas(o) ? 18 : 38, nC = bas(o) ? 9 : 16, P = [], C = [], I = [];
  const strates = ['#c9a06a', '#b98a58', '#d8b582', '#a87848', '#c49a66', '#e0c090'].map((h) => new T.Color(h)), herbe = new T.Color('#6fae3f'), ombre = new T.Color('#7a5236'), ph = r() * 9, bruit = []; for (let k = 0; k < 64; k++) bruit.push(r());
  for (let i = 0; i <= nS; i++) { const u = i / nS, th = Math.PI * (1 - u), cx = Math.cos(th) * a, cy = Math.sin(th) * H - 1.2, tx = -Math.sin(th) * a, ty = Math.cos(th) * H, tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl;
    const gros = 1 + .45 * Math.pow(Math.abs(Math.cos(th)), 2.2) + .14 * Math.sin(u * 17 + ph);   // pieds massifs, clé plus fine
    for (let j = 0; j < nC; j++) { const b = j / nC * TAU, bos = 1 + .13 * Math.sin(b * 3 + u * 11 + ph) + .06 * (bruit[(i * 7 + j * 3) % 64] - .5), y0 = cy + ny * Math.cos(b) * R0 * gros;
      const banc = Math.floor((y0 + 40) / 1.7), saillie = 1 + .085 * (((banc % 2) + 2) % 2 ? 1 : -1) * (.6 + .4 * bruit[(banc * 5) % 64]), rr = R0 * gros * bos * saillie, ox = Math.cos(b) * rr, oz = Math.sin(b) * rr * 1.25;
      const x = cx + nx * ox, y = cy + ny * ox, z = oz; P.push(x, y, z);
      const s = strates[((banc % strates.length) + strates.length) % strates.length], versBas = -ny * Math.cos(b), dessus = versBas < -.55 && y > H * .55, k = .9 + .18 * bruit[(i * 3 + j * 11) % 64], col = dessus ? herbe.clone() : s.clone().lerp(ombre, Math.max(0, versBas) * .45);
      C.push(col.r * k, col.g * k, col.b * k); } }
  for (let i = 0; i < nS; i++) for (let j = 0; j < nC; j++) { const p0 = i * nC + j, p1 = i * nC + (j + 1) % nC, p2 = p0 + nC, p3 = p1 + nC; I.push(p0, p2, p1, p1, p2, p3); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('color', new T.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeVertexNormals();
  const groupe = new T.Group(), m = new T.Mesh(g, mat(T, 'roche-lisse', { roughness: .95 })); m.castShadow = true; m.receiveShadow = true; groupe.add(m);
  // lierre et lianes sous la clé : rubans verts de 1,5 à 4,5 m, feuilles en bout ; dégagement gardé (o.libreMin, 9 m par défaut)
  const V = new Lot(T), yCle = H - 1.2 - R0 * .95, libre = o.libreMin || 9, nV = bas(o) ? 10 : 26;
  for (let k = 0; k < nV; k++) { const x = (r() - .5) * a * .9, z = (r() - .5) * R0 * 2, yHaut = Math.sin(Math.acos(Math.min(1, Math.abs(x) / a))) * H - 1.2 - R0 * .9, lg = Math.min(1.5 + r() * 3, Math.max(.6, yHaut - libre)); if (yHaut - lg < libre) continue;
    V.ajoute(new T.BoxGeometry(.09, lg, .05), M4(T, x, yHaut - lg / 2, z, r() * 3), '#3f8a36', '#6fae3f'); for (let q = 0; q < 3; q++) V.ajoute(new T.OctahedronGeometry(.22, 0), M4(T, x + (r() - .5) * .3, yHaut - lg * (.4 + q * .3), z + (r() - .5) * .3, r() * 3, 1.3, .5, 1), q % 2 ? '#5fa53a' : '#7fc24a'); }
  void yCle; if (V.p.length) groupe.add(V.maille(mat(T, 'feuillage-fin', { roughness: .8, side: T.DoubleSide }), false));
  // éboulis aux pieds
  const E = new Lot(T); for (const sd of [-1, 1]) for (let k = 0; k < (bas(o) ? 3 : 6); k++) { const s = 1.2 + r() * 2.2; E.ajoute(new T.DodecahedronGeometry(s, 0), M4(T, sd * (a + (r() - .3) * 7), s * .45 - 1, (r() - .5) * 13, r() * 6, 1, .75, 1), '#b08a5c', '#d2b07c'); }
  groupe.add(E.maille(mat(T, 'roche-arche', { roughness: .95, flatShading: true })));
  return fin(T, groupe, [{ x: -a - 1, z: 0, r: R0 * 2.2 }, { x: a + 1, z: 0, r: R0 * 2.2 }]);
}

/* ---------- Ponton, barques et lanterne (rive du lac) : repère local, +z vers le large, y = 0 au niveau de l'eau ---------- */
function ponton(T, o = {}) {
  const Lg = o.longueur || 20, L = new Lot(T), groupe = new T.Group(), r = rng(o.graine || 3);
  for (let k = 0; k < Lg / .62; k++) L.ajoute(new T.BoxGeometry(2.6, .12, .5), M4(T, 0, .75, k * .62 + .3, (r() - .5) * .03), k % 3 ? '#b88a58' : '#a67848');   // planches
  for (let z = 1; z < Lg; z += 3.4) for (const sd of [-1, 1]) L.ajoute(new T.CylinderGeometry(.16, .18, 3.2, 6), M4(T, sd * 1.25, -.4, z), '#6b4a30');           // pieux
  for (const sd of [-1, 1]) L.ajoute(new T.BoxGeometry(.12, .12, Lg), M4(T, sd * 1.25, .62, Lg / 2), '#6b4a30');
  L.ajoute(new T.CylinderGeometry(.09, .11, 3.2, 6), M4(T, 1.1, 2.3, Lg - .6), '#4a3526'); L.ajoute(new T.BoxGeometry(.5, .08, .08), M4(T, .85, 3.85, Lg - .6), '#4a3526');
  groupe.add(L.maille(mat(T, 'bois')));
  const lampe = new T.Mesh(new T.SphereGeometry(.24, 8, 6), new T.MeshStandardMaterial({ color: '#fff1b0', emissive: '#ffcc55', emissiveIntensity: 1.6, roughness: .5 })); lampe.material.userData.wkProduction = true; lampe.position.set(.62, 3.55, Lg - .6); groupe.add(lampe);
  // deux barques : coque = demi-ellipsoïde, bordé clair, bancs
  const barques = []; for (const [x, z, ry, col] of [[-2.6, Lg * .55, .25, '#c9463a'], [2.9, Lg * .8, -2.6, '#2f6fae']]) { const B = new Lot(T);
    B.ajoute(new T.SphereGeometry(1, bas(o) ? 8 : 12, 6, 0, TAU, Math.PI / 2, Math.PI / 2), M4(T, 0, .42, 0, 0, .95, .55, 2.3), col, '#f1e6cc');
    B.ajoute(new T.TorusGeometry(1, .07, 4, bas(o) ? 10 : 16), M4(T, 0, .42, 0, 0, .95, 2.3, 1, Math.PI / 2), '#f1e6cc');
    for (const zz of [-.8, .5]) B.ajoute(new T.BoxGeometry(1.6, .07, .32), M4(T, 0, .3, zz), '#b88a58');
    const b = B.maille(mat(T, 'bois')); b.position.set(x, 0, z); b.rotation.y = ry; b.userData.ph = r() * TAU; groupe.add(b); barques.push(b); }
  return fin(T, groupe, [{ x: 0, z: Lg / 2, r: Lg / 2 + 3 }], (dt, t) => { for (const b of barques) { b.position.y = Math.sin(t * 1.1 + b.userData.ph) * .07; b.rotation.z = Math.sin(t * .8 + b.userData.ph) * .05; b.rotation.x = Math.sin(t * .6 + b.userData.ph * 2) * .03; } });
}

/* ---------- Hérons : échassiers posés dans l'eau peu profonde (o.poses : [{x, y, z, cap}]) et vol qui tourne au-dessus du lac ---------- */
function heronPose(T, L, x, y, z, cap, s, r) {
  const m = (lx, ly, lz, rx, rz, sx, sy, sz) => new T.Matrix4().multiplyMatrices(M4(T, x, y, z, cap, s, s, s), M4(T, lx, ly, lz, 0, sx, sy, sz, rx, rz));
  for (const sd of [-1, 1]) L.ajoute(new T.CylinderGeometry(.035, .035, 1.1, 5), m(sd * .12, .55, 0, 0, 0, 1, 1, 1), '#d6a23a');           // pattes
  L.ajoute(new T.SphereGeometry(.38, 8, 6), m(0, 1.3, -.05, .25, 0, .8, .75, 1.35), '#8ea3ba', '#b9c9da');                              // corps
  L.ajoute(new T.ConeGeometry(.2, .6, 6), m(0, 1.22, -.72, -1.9, 0, 1, 1, .5), '#5f7690');                                               // queue
  const pli = r() < .5; L.ajoute(new T.CylinderGeometry(.06, .09, pli ? .7 : 1.0, 6), m(0, pli ? 1.72 : 1.9, .32, pli ? .7 : .25, 0, 1, 1, 1), '#eef2f6');   // cou
  const hy = pli ? 2.02 : 2.42, hz = pli ? .55 : .47; L.ajoute(new T.SphereGeometry(.13, 7, 5), m(0, hy, hz, 0, 0, 1, 1, 1.25), '#eef2f6');
  L.ajoute(new T.ConeGeometry(.045, .5, 5), m(0, hy - .02, hz + .36, Math.PI / 2, 0, 1, 1, 1), '#e8a52c');                               // bec
  L.ajoute(new T.BoxGeometry(.02, .05, .3), m(0, hy + .1, hz - .2, .35, 0, 1, 1, 1), '#2b3340');                                         // aigrette
}
function herons(T, o = {}) {
  const r = rng(o.graine || 11), groupe = new T.Group(), L = new Lot(T), s = o.echelle || 1.9;   // échassiers grossis : lisibles depuis la route
  for (const p of o.poses || []) heronPose(T, L, p.x, p.y, p.z, p.cap != null ? p.cap : r() * TAU, s * (.9 + r() * .25), r);
  if (L.p.length) groupe.add(L.maille(mat(T, 'plumage', { roughness: .7 })));
  // vol : o.vol { x, y, z, r, n } — chaque oiseau = corps + deux ailes battantes, sur un cercle incliné
  const V = o.vol, oiseaux = []; if (V) { const n = bas(o) ? Math.min(3, V.n || 5) : V.n || 5;
    for (let k = 0; k < n; k++) { const g = new T.Group(), C = new Lot(T); C.ajoute(new T.SphereGeometry(.4, 7, 5), M4(T, 0, 0, 0, 0, .7, .6, 1.9), '#8ea3ba', '#dfe7ef'); C.ajoute(new T.ConeGeometry(.07, .9, 5), M4(T, 0, .05, 1.1, 0, 1, 1, 1, Math.PI / 2), '#e8a52c');
      C.ajoute(new T.CylinderGeometry(.03, .03, 1.2, 4), M4(T, 0, -.1, -1.2, 0, 1, 1, 1, Math.PI / 2), '#d6a23a'); g.add(C.maille(mat(T, 'plumage', { roughness: .7 }), false));
      const ailes = []; for (const sd of [-1, 1]) { const W = new Lot(T); W.ajoute(new T.BoxGeometry(2.3, .05, .9), M4(T, sd * 1.15, 0, 0), '#6f86a0'); W.ajoute(new T.BoxGeometry(.9, .04, .6), M4(T, sd * 2.6, 0, -.15), '#3d4d62'); const a = W.maille(mat(T, 'plumage', { roughness: .7 }), false); a.userData.sd = sd; g.add(a); ailes.push(a); }
      g.scale.setScalar(s * .9); g.userData = { ph: k / n * TAU + r() * .5, dr: (r() - .5) * 14, dy: (r() - .5) * 5, ailes, vit: .16 + r() * .04 }; groupe.add(g); oiseaux.push(g); } }
  const maj = oiseaux.length ? (dt, t) => { for (const g of oiseaux) { const u = g.userData, a = u.ph + t * u.vit, R = V.r + u.dr; g.position.set(V.x + Math.cos(a) * R, V.y + u.dy + Math.sin(a * 2 + u.ph) * 2.5, V.z + Math.sin(a) * R); g.rotation.y = -a; g.rotation.z = -.18;
      const bat = Math.sin(t * 5.2 + u.ph * 3) * .55; for (const w of u.ailes) w.rotation.z = bat * w.userData.sd; } } : null;
  if (maj) maj(0, 0);
  return fin(T, groupe, (o.poses || []).map((p) => ({ x: p.x, z: p.z, r: 1.5 })), maj);
}

/* ---------- Fruitiers en fleurs (verger) : tronc trapu, trois à quatre masses rondes, fleurs et pommes ; instanciés ----------
   o.arbres : [{x, y, z, s, cap}] (y = sol). Une seule géométrie par variante (2), instances pour toute la rangée. */
function fruitier(T, graine, o, rose) {   // rose : arbre en pleine floraison (couronne rose pâle) ; sinon feuillage vert et pommes
  const r = rng(graine), L = new Lot(T), f = bas(o) ? [6, 4] : [9, 6];
  L.ajoute(new T.CylinderGeometry(.28, .42, 2.2, 6), M4(T, 0, 1.1, 0, 0, 1, 1, 1, 0, .06), '#6b4a30', '#8a6442');
  for (const [a, e] of [[.6, .9], [2.7, 1.0], [4.6, .8]]) L.ajoute(new T.CylinderGeometry(.11, .17, 1.5, 5), M4(T, Math.cos(a) * .55, 2.6, Math.sin(a) * .55, 0, 1, e, 1, Math.sin(a) * .7, -Math.cos(a) * .7), '#6b4a30');
  const masses = [[0, 4.3, 0, 2.0], [1.25, 3.7, .5, 1.45], [-1.1, 3.8, -.6, 1.5], [.2, 3.6, -1.3, 1.3], [-.3, 3.65, 1.3, 1.25]];
  masses.forEach(([x, y, z, R]) => L.ajoute(new T.SphereGeometry(R, f[0], f[1]), M4(T, x, y, z, r() * 6, 1, .84, 1), rose ? '#f07fb0' : '#4f9a34', rose ? '#ffd3e4' : '#a6d95c', true));
  for (let k = 0; k < (bas(o) ? 8 : 16); k++) { const [x, y, z, R] = masses[Math.floor(r() * masses.length)], a = r() * TAU, e = Math.acos(r() * 1.5 - .5), d = R * .97, fleur = r() < .62;
    const pomme = !rose && !fleur; L.ajoute(new T.SphereGeometry(pomme ? .22 : .34, 6, 3), M4(T, x + Math.sin(e) * Math.cos(a) * d, y + Math.cos(e) * d * .84, z + Math.sin(e) * Math.sin(a) * d, 0, 1, pomme ? 1 : .55, 1), pomme ? (r() < .6 ? '#e2382e' : '#f2b233') : (r() < .5 ? '#ffffff' : '#ffd0e2'), null, true); }   /* pommes et fleurs rondes (les losanges à facettes se lisaient comme des cristaux) */
  return L.geo();
}
function fruitiers(T, o = {}) {
  const groupe = new T.Group(), A = o.arbres || [], m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
  for (let v = 0; v < 2; v++) { const sel = A.filter((a, k) => k % 2 === v); if (!sel.length) continue; const im = new T.InstancedMesh(fruitier(T, (o.graine || 5) + v * 31, o, v === 1), mat(T, 'feuillage', { roughness: .8 }), sel.length);
    sel.forEach((a, k) => { e.set(0, a.cap || 0, 0); q.setFromEuler(e); const s = a.s || 1; m.compose(new T.Vector3(a.x, a.y - .1, a.z), q, new T.Vector3(s, s, s)); im.setMatrixAt(k, m); });
    im.instanceMatrix.needsUpdate = true; im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); groupe.add(im); }
  return fin(T, groupe, A.map((a) => ({ x: a.x, z: a.z, r: .8 * (a.s || 1) })));   /* emprise = tronc : la couronne commence à 2,4 m, au-dessus du kart (2,2 m) */
}

/* ---------- Clôture de bois (piquets et deux lisses) le long d'une ligne : o.points [{x, y, z}] tous les 2 à 4 m ---------- */
function cloture(T, o = {}) {
  const L = new Lot(T), P = o.points || [], r = rng(o.graine || 9);
  for (let i = 0; i < P.length; i++) { const p = P[i]; L.ajoute(new T.CylinderGeometry(.11, .13, 1.6, 5), M4(T, p.x, p.y + .7, p.z, 0, 1, 1, 1, (r() - .5) * .08, (r() - .5) * .08), '#b08a5c', '#e2c79a');
    const n = P[i + 1]; if (!n || n.coupe) continue; const dx = n.x - p.x, dy = n.y - p.y, dz = n.z - p.z, l = Math.hypot(dx, dz), cap = Math.atan2(dx, dz), pen = -Math.atan2(dy, l);
    for (const h of [.55, 1.15]) L.ajoute(new T.BoxGeometry(.08, .14, Math.hypot(l, dy) + .12), M4(T, p.x + dx / 2, p.y + dy / 2 + h, p.z + dz / 2, cap, 1, 1, 1, pen), '#d8bd90'); }
  const groupe = new T.Group(); if (L.p.length) groupe.add(L.maille(mat(T, 'bois'))); return fin(T, groupe, []);
}

/* ---------- Vie du verger : cageots de pommes, échelles, ruches (o.objets [{type, x, y, z, cap}]) et pétales qui tombent (o.petales) ---------- */
function vergerVie(T, o = {}) {
  const L = new Lot(T), r = rng(o.graine || 21), groupe = new T.Group();
  for (const b of o.objets || []) { const at = (lx, ly, lz, ry, sx, sy, sz, rx, rz) => new T.Matrix4().multiplyMatrices(M4(T, b.x, b.y, b.z, b.cap || 0), M4(T, lx, ly, lz, ry, sx, sy, sz, rx, rz));
    if (b.type === 'cageot') { L.ajoute(new T.BoxGeometry(1.1, .55, .8), at(0, .28, 0), '#b88a58', '#d2a878'); for (let k = 0; k < 7; k++) L.ajoute(new T.IcosahedronGeometry(.17, 0), at((r() - .5) * .8, .62, (r() - .5) * .5), r() < .7 ? '#e2382e' : '#f2b233'); }
    if (b.type === 'echelle') { for (const sd of [-1, 1]) L.ajoute(new T.BoxGeometry(.08, 3.6, .08), at(sd * .3, 1.7, .5, 0, 1, 1, 1, -.3), '#a07a50'); for (let k = 0; k < 7; k++) L.ajoute(new T.BoxGeometry(.6, .06, .06), at(0, .45 + k * .46, .93 - k * .14), '#a07a50'); }
    if (b.type === 'ruche') { L.ajoute(new T.BoxGeometry(.9, .12, .9), at(0, .45, 0), '#7a5a3a'); for (const [x, z] of [[-.35, -.35], [.35, -.35], [-.35, .35], [.35, .35]]) L.ajoute(new T.BoxGeometry(.08, .45, .08), at(x, .22, z), '#7a5a3a'); for (let k = 0; k < 3; k++) L.ajoute(new T.BoxGeometry(.78, .34, .78), at(0, .7 + k * .36, 0), ['#f4d35e', '#fff8e1', '#6fb7d6'][k]); L.ajoute(new T.BoxGeometry(.98, .1, .98), at(0, 1.66, 0), '#b5452f'); } }
  if (L.p.length) groupe.add(L.maille(mat(T, 'bois')));
  // pétales : nuage de points qui tombent en dérivant dans une boîte autour du chemin (o.petales { x, y, z, lx, ly, lz, n })
  let maj = null; const Pt = typeof document !== 'undefined' ? o.petales : null; if (Pt) { const n = Math.round((Pt.n || 260) * (bas(o) ? .4 : 1)), pos = new Float32Array(n * 3), ph = new Float32Array(n), sol = new Float32Array(n), Q = Pt.pts;   // Pt.pts : [[x, y, z]] le long du chemin
    for (let k = 0; k < n; k++) { const c = Q[Math.floor(r() * Q.length)]; pos[k * 3] = c[0] + (r() - .5) * 26; sol[k] = c[1]; pos[k * 3 + 1] = c[1] + r() * 9; pos[k * 3 + 2] = c[2] + (r() - .5) * 26; ph[k] = r() * TAU; }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.computeBoundingSphere();
    const cv = document.createElement('canvas'); cv.width = cv.height = 32; const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.beginPath(); x.ellipse(16, 16, 13, 7, .6, 0, TAU); x.fill(); const tx = new T.CanvasTexture(cv);
    const pm = new T.Points(g, new T.PointsMaterial({ color: '#ffe0ea', size: .55, map: tx, transparent: true, alphaTest: .3, depthWrite: false, sizeAttenuation: true })); pm.material.userData.wkProduction = true; pm.userData.wkCosmetic = true; pm.frustumCulled = true; groupe.add(pm);
    maj = (dt, t) => { if (!pm.visible) return; const a = g.attributes.position.array; for (let k = 0; k < n; k++) { a[k * 3 + 1] -= dt * (.7 + .3 * Math.sin(ph[k])); a[k * 3] += Math.sin(t * .9 + ph[k]) * dt * .6; a[k * 3 + 2] += Math.cos(t * .7 + ph[k]) * dt * .4; if (a[k * 3 + 1] < sol[k]) a[k * 3 + 1] += 9; } g.attributes.position.needsUpdate = true; }; }
  return fin(T, groupe, (o.objets || []).map((b) => ({ x: b.x, z: b.z, r: 1.2 })), maj);
}

/* ---------- Guirlande de fanions entre deux mâts : o.a, o.b {x, y (sol), z}, o.hauteur ; chaînette de triangles colorés ---------- */
function fanions(T, o = {}) {
  const L = new Lot(T), A = o.a, B = o.b, H = o.hauteur || 7.5, n = Math.max(6, Math.round(Math.hypot(B.x - A.x, B.z - A.z) / 1.1)), cols = o.couleurs || ['#e2382e', '#f4d35e', '#2f8fd6', '#fff8e1', '#4fae5a'], cap = Math.atan2(B.x - A.x, B.z - A.z);
  for (const p of [A, B]) { L.ajoute(new T.CylinderGeometry(.13, .17, H + .4, 6), M4(T, p.x, p.y + H / 2, p.z), '#8a6442', '#b08a5c'); L.ajoute(new T.SphereGeometry(.22, 6, 5), M4(T, p.x, p.y + H + .3, p.z), '#f4d35e'); }
  for (let k = 0; k < n; k++) { const u = (k + .5) / n, fl = 4 * u * (1 - u) * (o.fleche || 1.6), x = A.x + (B.x - A.x) * u, z = A.z + (B.z - A.z) * u, y = A.y + (B.y - A.y) * u + H - fl;
    L.ajoute(new T.ConeGeometry(.36, .7, 3), M4(T, x, y - .38, z, cap + Math.PI / 2, 1, 1, .12, Math.PI), cols[k % cols.length]); }
  const groupe = new T.Group(); groupe.add(L.maille(mat(T, 'bois-toile', { side: T.DoubleSide }), false)); return fin(T, groupe, [{ x: A.x, z: A.z, r: .6 }, { x: B.x, z: B.z, r: .6 }]);
}

/* ---------- Portique de départ en bois : deux poteaux, traverse, toit de bardeaux, bannière au nom de la carte ---------- */
function portique(T, o = {}) {
  const d = o.demi || 16, H = o.hauteur || 9.5, L = new Lot(T), groupe = new T.Group();
  for (const sd of [-1, 1]) { L.ajoute(new T.CylinderGeometry(.55, .7, H, 8), M4(T, sd * d, H / 2, 0), '#7a5a3a', '#a07a50'); L.ajoute(new T.CylinderGeometry(1.2, 1.4, .9, 8), M4(T, sd * d, .45, 0), '#a89878'); L.ajoute(new T.BoxGeometry(.3, 3.2, .3), M4(T, sd * (d - 1.6), H - 1.6, 0, 0, 1, 1, 1, 0, sd * .8), '#7a5a3a'); }
  L.ajoute(new T.BoxGeometry(d * 2 + 3, .7, .8), M4(T, 0, H, 0), '#7a5a3a'); L.ajoute(new T.BoxGeometry(d * 2 + 4.5, .25, 3.2), M4(T, 0, H + 1.5, 0, 0, 1, 1, 1, .0), '#b5452f');
  for (const s of [-1, 1]) L.ajoute(new T.BoxGeometry(d * 2 + 4.5, .22, 1.9), M4(T, 0, H + 1.05, s * 1.25, 0, 1, 1, 1, s * .5), '#c9573a');
  groupe.add(L.maille(mat(T, 'bois')));
  if (typeof document === 'undefined') return fin(T, groupe, [{ x: -d, z: 0, r: 1.6 }, { x: d, z: 0, r: 1.6 }]);   // sous Node (tests) : sans bannière
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 128; const x = cv.getContext('2d'); x.fillStyle = '#fff8e1'; x.fillRect(0, 0, 1024, 128); x.fillStyle = '#2f6fae'; x.fillRect(0, 0, 1024, 12); x.fillRect(0, 116, 1024, 12);
  x.fillStyle = '#23324a'; x.font = '900 78px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(o.texte || 'WILD KART').toUpperCase().slice(0, 22), 512, 68);
  const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 4; const bm = new T.MeshStandardMaterial({ map: tx, roughness: .8, side: T.DoubleSide }); bm.userData.wkProduction = true;
  const ban = new T.Mesh(new T.PlaneGeometry(d * 1.5, d * 1.5 / 8), bm); ban.position.set(0, H - 1.5, -.05); groupe.add(ban);   // lisible en arrivant (le kart roule vers +z local)
  return fin(T, groupe, [{ x: -d, z: 0, r: 1.6 }, { x: d, z: 0, r: 1.6 }]);
}

/* ---------- Voiliers du lac : petits dériveurs à voile colorée qui tournent lentement au large (o.orbite { x, z, r }, o.niveau, o.n) ---------- */
function voiliers(T, o = {}) {
  const r = rng(o.graine || 17), groupe = new T.Group(), n = bas(o) ? Math.min(2, o.n || 3) : o.n || 3, O = o.orbite, bateaux = [], cols = ['#e2382e', '#f4d35e', '#2f8fd6', '#ffffff'];
  for (let k = 0; k < n; k++) { const L = new Lot(T), col = cols[k % cols.length];
    L.ajoute(new T.SphereGeometry(1, 10, 6, 0, TAU, Math.PI / 2, Math.PI / 2), M4(T, 0, .5, 0, 0, 1.1, .7, 3.1), '#f6efe0', '#ffffff'); L.ajoute(new T.BoxGeometry(1.9, .08, 5.2), M4(T, 0, .5, 0), '#c9a878');
    L.ajoute(new T.CylinderGeometry(.07, .09, 8.4, 5), M4(T, 0, 4.6, .5), '#6b4a30'); L.ajoute(new T.CylinderGeometry(.05, .05, 3.6, 4), M4(T, 0, 1.5, -1.3, 0, 1, 1, 1, Math.PI / 2), '#6b4a30');
    const voile = (pts, c) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pts, 3)); L.ajoute(g, null, c); };
    voile([.05, 1.6, .4, .05, 8.6, .45, .35, 1.6, -3.1], col); voile([.05, 1.3, .7, .05, 7.2, .6, -.2, 1.3, 3.0], '#ffffff');
    const b = L.maille(mat(T, 'bois-toile', { side: T.DoubleSide }), false); b.scale.setScalar(o.echelle || 1.35); b.userData = { ph: k / n * TAU + r() * .6, dr: (r() - .5) * O.r * .22, vit: (.016 + r() * .008) * (k % 2 ? -1 : 1) }; groupe.add(b); bateaux.push(b); }
  const maj = (dt, t) => { for (const b of bateaux) { const u = b.userData, a = u.ph + t * u.vit, R = O.r + u.dr; b.position.set(O.x + Math.cos(a) * R, o.niveau + Math.sin(t * 1.3 + u.ph) * .06, O.z + Math.sin(a) * R); b.rotation.y = -a + (u.vit > 0 ? 0 : Math.PI); b.rotation.z = .09 + Math.sin(t * .7 + u.ph) * .04; } };
  maj(0, 0); return fin(T, groupe, [], maj);
}

/* ---------- Rochers stratifiés (gorge, berges) : dalles empilées aux strates ocre, parfois coiffées d'herbe ; deux variantes instanciées ----------
   o.blocs : [{x, y, z, s, cap}] (y = sol). Même palette que l'arche : la gorge et la berge se lisent comme une seule roche. */
function rocher(T, graine, o) {
  const r = rng(graine), L = new Lot(T), strates = ['#c9a06a', '#b98a58', '#d8b582', '#a87848'], n = 3 + Math.floor(r() * 2); let y = -.5, R = 1.5 + r() * .5;
  for (let k = 0; k < n; k++) { const h = .7 + r() * .6; L.ajoute(new T.DodecahedronGeometry(1, 0), M4(T, (r() - .5) * .5, y + h / 2, (r() - .5) * .5, r() * 6, R, h * .62, R * (.8 + r() * .3)), strates[k % strates.length], strates[(k + 2) % strates.length]); y += h * .78; R *= .78 + r() * .1; }
  if (r() < .6) L.ajoute(new T.SphereGeometry(R * .95, 6, 3, 0, TAU, 0, Math.PI / 2), M4(T, 0, y - .1, 0, 0, 1, .35, 1), '#5fa53a', '#8fcf52', true);
  return L.geo();
}
function rochers(T, o = {}) {
  const groupe = new T.Group(), B = o.blocs || [], m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
  for (let v = 0; v < 2; v++) { const sel = B.filter((b, k) => k % 2 === v); if (!sel.length) continue; const im = new T.InstancedMesh(rocher(T, (o.graine || 13) + v * 17, o), mat(T, 'roche-arche', { roughness: .95, flatShading: true }), sel.length);
    sel.forEach((b, k) => { e.set(0, b.cap || 0, 0); q.setFromEuler(e); const s = b.s || 1; m.compose(new T.Vector3(b.x, b.y, b.z), q, new T.Vector3(s, s, s)); im.setMatrixAt(k, m); }); im.instanceMatrix.needsUpdate = true; im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); groupe.add(im); }
  return fin(T, groupe, B.map((b) => ({ x: b.x, z: b.z, r: 2 * (b.s || 1) })));
}

/* ---------- Massettes (roseaux à quenouille) : touffes au bord de l'eau, instanciées ; o.touffes : [{x, y, z, s, cap}] ---------- */
function massette(T, graine, o) {
  const r = rng(graine), L = new Lot(T), n = bas(o) ? 4 : 7;
  for (let k = 0; k < n; k++) { const a = r() * TAU, d = r() * .55, h = 1.9 + r() * 1.1, px = Math.cos(a) * d, pz = Math.sin(a) * d, ix = (r() - .5) * .22, iz = (r() - .5) * .22;
    L.ajoute(new T.CylinderGeometry(.018, .035, h, 3), M4(T, px, h / 2, pz, 0, 1, 1, 1, iz, -ix), '#5f8f3a', '#8fb04c');
    if (k % 2 === 0) L.ajoute(new T.CylinderGeometry(.07, .07, .42, 5), M4(T, px - ix * h * .5, h - .1, pz - iz * h * .5, 0, 1, 1, 1, iz, -ix), '#6b4226', '#8a5a34');
    else L.ajoute(new T.BoxGeometry(.11, h * .8, .015), M4(T, px, h * .4, pz, a, 1, 1, 1, .32, 0), '#6fa03e', '#a6c85a'); }
  return L.geo();
}
function massettes(T, o = {}) {
  const groupe = new T.Group(), B = o.touffes || [], m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(); if (!B.length) return fin(T, groupe, []);
  const im = new T.InstancedMesh(massette(T, o.graine || 29, o), mat(T, 'feuillage-fin', { roughness: .8, side: T.DoubleSide }), B.length);
  B.forEach((b, k) => { e.set(0, b.cap || 0, 0); q.setFromEuler(e); const s = b.s || 1; m.compose(new T.Vector3(b.x, b.y, b.z), q, new T.Vector3(s, s, s)); im.setMatrixAt(k, m); }); im.instanceMatrix.needsUpdate = true; im.castShadow = false; im.receiveShadow = true; im.computeBoundingSphere(); groupe.add(im);
  return fin(T, groupe, []);
}

/* ---------- Bordures : touffes d'herbe haute, fleurs et cailloux au pied de la chaussée, instanciés (transition chaussée → terrain) ----------
   o.items : [{x, y, z, s, cap, v}] (v : 0 touffe, 1 touffe fleurie, 2 cailloux). Trois géométries, une InstancedMesh chacune. */
function bordureGeo(T, v, o) {
  const r = rng(41 + v * 7), L = new Lot(T);
  if (v === 2) { for (let k = 0; k < 2; k++) L.ajoute(new T.OctahedronGeometry(.18 + r() * .16, 0), M4(T, (r() - .5) * .7, .08, (r() - .5) * .7, r() * 6, 1, .6, 1), '#b8a88c', '#d8ccb4'); return L.geo(); }
  const n = bas(o) ? 3 : 5; for (let k = 0; k < n; k++) { const a = k / n * TAU + r(), h = .45 + r() * .5; L.ajoute(new T.ConeGeometry(.11, h, 3, 1, true), M4(T, Math.cos(a) * .16, h / 2, Math.sin(a) * .16, a, 1, 1, 1, Math.cos(a) * .35, Math.sin(a) * .35), '#4f9a34', '#a6d95c'); }
  if (v === 1) for (let k = 0; k < 2; k++) { const a = r() * TAU; L.ajoute(new T.OctahedronGeometry(.09, 0), M4(T, Math.cos(a) * .2, .55 + r() * .3, Math.sin(a) * .2), ['#fff4a8', '#ffffff', '#ff9fc0'][k]); }
  return L.geo();
}
function bordures(T, o = {}) {
  const groupe = new T.Group(), A = o.items || [], m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
  for (let v = 0; v < 3; v++) { const sel = A.filter((a) => (a.v || 0) === v); if (!sel.length) continue; const im = new T.InstancedMesh(bordureGeo(T, v, o), mat(T, v === 2 ? 'roche-arche' : 'feuillage-fin', v === 2 ? { roughness: .95, flatShading: true } : { roughness: .8, side: T.DoubleSide }), sel.length);
    sel.forEach((a, k) => { e.set(0, a.cap || 0, 0); q.setFromEuler(e); const s = a.s || 1; m.compose(new T.Vector3(a.x, a.y, a.z), q, new T.Vector3(s, s, s)); im.setMatrixAt(k, m); }); im.instanceMatrix.needsUpdate = true; im.castShadow = false; im.receiveShadow = true; im.computeBoundingSphere(); groupe.add(im); }
  return fin(T, groupe, []);
}

/* ---------- Panneau de danger : triangle jaune bordé de rouge sur un poteau de bois, face à l'arrivée ---------- */
function panneau(T, o = {}) {
  const L = new Lot(T), groupe = new T.Group(); L.ajoute(new T.CylinderGeometry(.09, .11, 3, 6), M4(T, 0, 1.5, 0), '#8a6442', '#b08a5c');
  L.ajoute(new T.CylinderGeometry(1.05, 1.05, .08, 3), M4(T, 0, 3.3, .02, 0, 1, 1, 1, Math.PI / 2, 0), '#d8362c'); L.ajoute(new T.CylinderGeometry(.8, .8, .1, 3), M4(T, 0, 3.3, .05, 0, 1, 1, 1, Math.PI / 2, 0), '#ffd23c');
  L.ajoute(new T.BoxGeometry(.14, .55, .12), M4(T, 0, 3.38, .1), '#23324a'); L.ajoute(new T.BoxGeometry(.15, .15, .12), M4(T, 0, 2.98, .1), '#23324a');
  groupe.add(L.maille(mat(T, 'bois-toile', { side: T.DoubleSide }))); return fin(T, groupe, [{ x: 0, z: 0, r: .4 }]);
}

root.WKLieux = { version: 1, voiliers, rochers, massettes, bordures, panneau, moulin, arche, ponton, herons, fruitiers, cloture, vergerVie, fanions, portique, cout };
})(typeof window !== 'undefined' ? window : globalThis);
