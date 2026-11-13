/* Wild Kart — modules de décor du Banc décors 1 et de la Grande Cascade (#36.C, #37.F ; accord du propriétaire #35 §5 ter).
   FORMAT CONVENU (#35, 7 nov.) : WKDecors.<recette>(T, opts) → { groupe: THREE.Group, emprise: [{ x, z, r }], cout: { appels, triangles } }
   (+ maj(dt, t) quand la recette s'anime, + infos). Fonctions pures et déterministes (opts.graine), SANS collision et SANS accès au monde :
   l'appelant fournit le lieu (cadre(s, b), sol(x, z), contours, chemins). opts.qualite = 'high' | 'low'. Matériaux marqués
   userData.wkProduction (graphics.js ne les remplace pas) et userData.wkDecors ; objets marqués userData.wkDecorsRole (masques des bancs).
   Recettes issues de l'étude docs/art/decors (recettes-proposees.json, RETOUR-BANC-1.md) ; réalisations originales Wild Kart.
   Textures PBR : WKNature.texture (même cache PC/mobile) si présent ; sinon couleurs seules. */
(function (root) {
'use strict';
const T = root.THREE, TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function rng(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
function hash2(x, z, s) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(s | 0, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, z, s) { const ix = Math.floor(x), iz = Math.floor(z); let fx = x - ix, fz = z - iz; fx *= fx * (3 - 2 * fx); fz *= fz * (3 - 2 * fz);
  return lerp(lerp(hash2(ix, iz, s), hash2(ix + 1, iz, s), fx), lerp(hash2(ix, iz + 1, s), hash2(ix + 1, iz + 1, s), fx), fz); }
const C = (h) => new T.Color(h);

/* ---------- Petit assembleur de maillages (positions, normales, couleurs, uv) ---------- */
function Mesher() { this.p = []; this.n = []; this.c = []; this.u = []; this.i = []; }
Mesher.prototype.v = function (x, y, z, nx, ny, nz, col, uu = 0, vv = 0) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.c.push(col.r, col.g, col.b); this.u.push(uu, vv); return this.p.length / 3 - 1; };
Mesher.prototype.t = function (a, b, c) { this.i.push(a, b, c); };
// Oriente chaque triangle vers le haut (surfaces horizontales : eau, fond, terrasse), quel que soit le côté de la falaise.
Mesher.prototype.versHaut = function () { const P = this.p, I = this.i; for (let k = 0; k < I.length; k += 3) { const a = I[k] * 3, b = I[k + 1] * 3, c = I[k + 2] * 3, ux = P[b] - P[a], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vz = P[c + 2] - P[a + 2];
  if (uz * vx - ux * vz < 0) { const t = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = t; } } return this; };
Mesher.prototype.geo = function (normales) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(this.u, 2)); g.setIndex(this.i); if (normales) g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere(); return g; };

/* ---------- Textures peintes (déterministes) ---------- */
const TEX = new Map();
function canvasTex(key, w, h, paint, srgb = true) { if (TEX.has(key)) return TEX.get(key); const cv = document.createElement('canvas'); cv.width = w; cv.height = h; paint(cv.getContext('2d'), w, h);
  const t = new T.CanvasTexture(cv); t.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; t.userData.wkShared = true; t.name = 'decors:' + key; TEX.set(key, t); return t; }
// Rideau d'eau : traînées LARGES (bandes de 6 à 18 px) claires et sombres alternées, ruptures verticales ; bords fondus.
function texRideau(variante) { return canvasTex('rideau' + variante, 128, 256, (x, w, h) => { const r = rng(4021 + variante * 97), L = new Float32Array(w * h), A = new Float32Array(w * h);
  // fond de voile clair, puis traînées larges (6 à 18 px) aux bords doux, alternant très claires et plus sombres, tronçons fondus
  for (let k = 0; k < w * h; k++) { L[k] = .7; A[k] = .55; }
  for (let bnd = 0; bnd < 20; bnd++) { const cx = 4 + r() * (w - 8), bw = 3 + r() * 7, clair = r() > .45, l = clair ? .97 + r() * .03 : .36 + r() * .1, a = clair ? .97 : .8; let y0 = -r() * 80;
    while (y0 < h + 80) { const len = 50 + r() * 140; for (let y = Math.max(0, Math.floor(y0)); y < Math.min(h * 2, y0 + len); y++) { const fy = Math.min(1, (y - y0) / 14, (y0 + len - y) / 14), yy = y % h;
        for (let xx = Math.max(0, Math.floor(cx - bw * 2)); xx < Math.min(w, cx + bw * 2); xx++) { const fx = Math.exp(-(((xx - cx) / bw) ** 2)) * fy, k = yy * w + xx; L[k] = lerp(L[k], l, fx); A[k] = Math.max(A[k], a * fx); } }
      y0 += len + 6 + r() * 30; } }
  const id = x.createImageData(w, h); for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) { const k = yy * w + xx, e = clamp(Math.min(xx, w - 1 - xx) / (w * .14), 0, 1), v = L[k] * 255;
    id.data[k * 4] = v * .96; id.data[k * 4 + 1] = v; id.data[k * 4 + 2] = Math.min(255, v * 1.02 + 6); id.data[k * 4 + 3] = A[k] * e * 255; }
  x.putImageData(id, 0, 0); }); }
function texEcume() { return canvasTex('ecume', 128, 128, (x, w, h) => { const r = rng(733); x.clearRect(0, 0, w, h);
  for (let q = 0; q < 70; q++) { const cx = r() * w, cy = r() * h, rr = 6 + r() * 16, g = x.createRadialGradient(cx, cy, 0, cx, cy, rr); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.6, 'rgba(240,250,252,.6)'); g.addColorStop(1, 'rgba(240,250,252,0)'); x.fillStyle = g;
    for (const [dx, dy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) { x.beginPath(); x.arc(cx + dx, cy + dy, rr, 0, TAU); x.fill(); } } }); }
function texBrume() { return canvasTex('brume', 64, 64, (x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); }); }
// Normales de vaguelettes (deux longueurs d'onde croisées), carte linéaire.
function texVagues() { return canvasTex('vagues', 128, 128, (x, w, h) => { const id = x.createImageData(w, h), H = (u, v) => .5 * Math.sin((u * 3 + v * 1) * TAU) + .35 * Math.sin((u * -2 + v * 5) * TAU + 1.3) + .25 * Math.sin((u * 7 - v * 3) * TAU + .4) + .15 * (vnoise(u * 16, v * 16, 5) - .5) * 4;
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) { const u = xx / w, v = y / h, e = 1 / w, dx = (H(u + e, v) - H(u - e, v)) * 1.2, dy = (H(u, v + e) - H(u, v - e)) * 1.2, L = Math.hypot(dx, dy, 1), k = (y * w + xx) * 4;
    id.data[k] = (.5 - dx / L * .5) * 255; id.data[k + 1] = (.5 - dy / L * .5) * 255; id.data[k + 2] = (.5 + .5 / L) * 255; id.data[k + 3] = 255; } x.putImageData(id, 0, 0); }, false); }

/* ---------- Matériau de roche : couleurs par masse (sommets) × grain triplanaire PBR, herbe sur les dessus ---------- */
function matRoche(o = {}) {
  const N = root.WKNature, m = new T.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: .9, metalness: 0, envMapIntensity: .3 });
  m.userData.wkProduction = true; m.userData.wkDecors = true; if (!N || !N.texture) return m;
  const u = { tR: { value: N.texture(o.roche || 'rock_06', 'albedo') }, nR: { value: N.texture(o.roche || 'rock_06', 'normal') }, tG: { value: N.texture('leafy_grass', 'albedo') },
    cG: { value: C(o.herbe || '#86c25a') }, ech: { value: o.echelle || .15 }, mousse: { value: o.mousse != null ? o.mousse : 1 }, grain: { value: o.grain != null ? o.grain : .5 }, relief: { value: o.relief != null ? o.relief : 1 } };
  m.onBeforeCompile = (s) => { Object.assign(s.uniforms, u);
    s.vertexShader = 'varying vec3 vDcP; varying vec3 vDcN;\n' + s.vertexShader.replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\n vDcN = inverseTransformDirection(transformedNormal, viewMatrix);')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 dcP = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
        dcP = instanceMatrix * dcP;
        #endif
        vDcP = (modelMatrix * dcP).xyz;`);
    s.fragmentShader = `uniform sampler2D tR, nR, tG; uniform vec3 cG; uniform float ech, mousse, grain, relief; varying vec3 vDcP; varying vec3 vDcN;
      float dcH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float dcB(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(dcH(i), dcH(i + vec2(1., 0.)), f.x), mix(dcH(i + vec2(0., 1.)), dcH(i + vec2(1., 1.)), f.x), f.y); }\n` + s.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 N0 = normalize(vDcN); vec3 tw = pow(abs(N0), vec3(4.0)); tw /= tw.x + tw.y + tw.z; vec3 rp = vDcP * ech;
        vec3 rk = (texture2D(tR, rp.zy) * tw.x + texture2D(tR, rp.xz) * tw.y + texture2D(tR, rp.xy) * tw.z).rgb;
        float lk = dot(rk, vec3(.299, .587, .114));
        diffuseColor.rgb *= mix(1.0, clamp(lk * 2.0, .5, 1.45), grain);
        float top = smoothstep(.6, .84, N0.y + (dcB(vDcP.xz * .3) - .5) * .32) * mousse;
        vec3 gr = texture2D(tG, vDcP.xz * .2).rgb * cG * 1.7 * (.85 + .3 * dcB(vDcP.xz * .9));
        diffuseColor.rgb = mix(diffuseColor.rgb, gr, top);`)
      .replace('#include <normal_fragment_maps>', `{
        vec3 nx = texture2D(nR, rp.zy).xyz * 2.0 - 1.0, ny = texture2D(nR, rp.xz).xyz * 2.0 - 1.0, nz = texture2D(nR, rp.xy).xyz * 2.0 - 1.0;
        vec3 Nr = normalize(vec3(nx.z * sign(N0.x), nx.y, nx.x) * tw.x + vec3(ny.x, ny.z * sign(N0.y), ny.y) * tw.y + vec3(nz.x, nz.y, nz.z * sign(N0.z)) * tw.z);
        Nr = normalize(N0 + (Nr - vec3(sign(N0.x) * tw.x, sign(N0.y) * tw.y, sign(N0.z) * tw.z)) * relief); normal = normalize(mat3(viewMatrix) * Nr); }`);
  };
  m.customProgramCacheKey = () => 'wk-decors-roche-v1'; return m;
}
function matSimple(o) { const m = new T.MeshStandardMaterial(Object.assign({ color: '#ffffff', vertexColors: true, roughness: .85, metalness: 0, envMapIntensity: .3 }, o)); m.userData.wkProduction = true; m.userData.wkDecors = true; return m; }

// Fusion de géométries indexées (mêmes attributs : position, normal, color, uv) : un seul appel de rendu.
function fusion(gs) { const M = new Mesher(); for (const g of gs) { const o = M.p.length / 3, a = g.attributes; M.p.push(...a.position.array); M.n.push(...a.normal.array); M.c.push(...a.color.array); M.u.push(...a.uv.array); for (const i of g.index.array) M.i.push(i + o); } return M.geo(); }
/* ---------- Instances ---------- */
const _m = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _p = new T.Vector3(), _s = new T.Vector3();
function instances(parent, geo, mat, list, ombre = true) { if (!list.length) return null; const im = new T.InstancedMesh(geo, mat, list.length);
  list.forEach((it, k) => { _e.set(it.rx || 0, it.ry || 0, it.rz || 0); _q.setFromEuler(_e); _p.set(it.x, it.y, it.z); _s.set(it.sx || it.s || 1, it.sy || it.s || 1, it.sz || it.s || 1); im.setMatrixAt(k, _m.compose(_p, _q, _s)); if (it.col) im.setColorAt(k, it.col); });
  im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = ombre; im.receiveShadow = true; parent.add(im); return im; }

/* ---------- Feuillu à plaques ---------- */
// Écaille bombée : disque à 7 côtés gonflé vers l'extérieur + jupe repliée (pas de trou entre écailles voisines).
function ecaille(M, c, n, rad, ep, colC, colB) { const a = Math.abs(n.y) < .9 ? new T.Vector3(0, 1, 0) : new T.Vector3(1, 0, 0), u = new T.Vector3().crossVectors(a, n).normalize(), v = new T.Vector3().crossVectors(n, u), K = 7;
  const centre = M.v(c.x + n.x * ep, c.y + n.y * ep, c.z + n.z * ep, n.x, n.y, n.z, colC), bord = [], fond = [];
  for (let k = 0; k < K; k++) { const t = k / K * TAU, d = u.clone().multiplyScalar(Math.cos(t)).addScaledVector(v, Math.sin(t)), p = c.clone().addScaledVector(d, rad).addScaledVector(n, -ep * .25), nn = n.clone().multiplyScalar(.55).addScaledVector(d, .85).normalize();
    bord.push(M.v(p.x, p.y, p.z, nn.x, nn.y, nn.z, colB)); const q = c.clone().addScaledVector(d, rad * .62).addScaledVector(n, -ep * 1.1), nq = d.clone().addScaledVector(n, -.4).normalize(); fond.push(M.v(q.x, q.y, q.z, nq.x, nq.y, nq.z, colB.clone().multiplyScalar(.6))); }
  for (let k = 0; k < K; k++) { const k1 = (k + 1) % K; M.t(centre, bord[k], bord[k1]); M.t(bord[k], fond[k], bord[k1]); M.t(bord[k1], fond[k], fond[k1]); } }
function tube(M, pts, rads, cotes, col, colHaut) { const anneaux = []; for (let i = 0; i < pts.length; i++) { const p = pts[i], d = (pts[Math.min(i + 1, pts.length - 1)].clone().sub(pts[Math.max(i - 1, 0)])).normalize(), a = Math.abs(d.y) < .9 ? new T.Vector3(0, 1, 0) : new T.Vector3(1, 0, 0), u = new T.Vector3().crossVectors(a, d).normalize(), v = new T.Vector3().crossVectors(d, u), ring = [], cc = col.clone().lerp(colHaut || col, i / Math.max(1, pts.length - 1));
    for (let k = 0; k < cotes; k++) { const t = k / cotes * TAU, nn = u.clone().multiplyScalar(Math.cos(t)).addScaledVector(v, Math.sin(t)), q = p.clone().addScaledVector(nn, rads[i]); ring.push(M.v(q.x, q.y, q.z, nn.x, nn.y, nn.z, cc, k / cotes, i)); } anneaux.push(ring); }
  for (let i = 0; i < anneaux.length - 1; i++) for (let k = 0; k < cotes; k++) { const k1 = (k + 1) % cotes, a = anneaux[i][k], b = anneaux[i][k1], c = anneaux[i + 1][k], d = anneaux[i + 1][k1]; M.t(a, c, b); M.t(b, c, d); } }
const PAL_FEUILLE = { clair: C('#6fae45'), moyen: C('#3f7f2a'), sombre: C('#1d4d1c'), coeur: C('#123d14') }, ECORCE = C('#6e4128'), ECORCE_H = C('#8a5636');
// Masses : 3 à 5 (4 par défaut) ; écailles par masse 8 à 13 ; évasement 1,8. Renvoie { bois, feuilles, hauteur, rayon }.
function feuillu(graine, o = {}) { const r = rng(graine), H = o.hauteur || 9, masses = o.masses || 4, nE = o.ecailles || 11, ev = o.evasement || 1.8, cotes = o.bas ? 4 : 6, bois = new Mesher(), f = new Mesher();
  const r0 = H * .045, haut = new T.Vector3((r() - .5) * .8, H * .5, (r() - .5) * .8), pts = [], rads = [];
  for (let s = 0; s <= 5; s++) { const t = s / 5; pts.push(new T.Vector3(haut.x * t * t, -.5 + (haut.y + .5) * t, haut.z * t * t)); rads.push(r0 * (1 + (ev - 1) * Math.exp(-t * 7)) * (1 - .35 * t)); }
  tube(bois, pts, rads, cotes, ECORCE, ECORCE_H);
  // racines enterrées : 4 contreforts qui plongent sous le sol
  for (let k = 0; k < (o.bas ? 3 : 4); k++) { const a = k / 4 * TAU + r() * .7, d = new T.Vector3(Math.cos(a), 0, Math.sin(a)); tube(bois, [new T.Vector3(0, .9, 0).addScaledVector(d, r0 * .4), new T.Vector3(0, .25, 0).addScaledVector(d, r0 * 1.9), new T.Vector3(0, -.45, 0).addScaledVector(d, r0 * 3.4)], [r0 * .55, r0 * .38, r0 * .16], 4, ECORCE); }
  const centre = haut.clone().add(new T.Vector3(0, H * .2, 0)), Rm = H * (masses <= 3 ? .24 : .2), centres = [];
  for (let k = 0; k < masses; k++) { const a = k / masses * TAU + r() * .5, el = k === 0 ? 0 : 1, c = k === 0 ? centre.clone().add(new T.Vector3(0, Rm * .55, 0)) : centre.clone().add(new T.Vector3(Math.cos(a) * Rm * (.85 + r() * .3), -Rm * .15 + r() * Rm * .3, Math.sin(a) * Rm * (.85 + r() * .3))); centres.push([c, Rm * (k === 0 ? 1.05 : .82 + r() * .22)]); void el;
    if (k) tube(bois, [haut.clone(), haut.clone().lerp(c, .55).add(new T.Vector3(0, .3, 0)), c.clone().lerp(haut, .25)], [r0 * .55, r0 * .38, r0 * .22], cotes > 4 ? 5 : 3, ECORCE); }
  for (const [c, R] of centres) {
    // cœur sombre (bouche les jours entre écailles)
    const coeur = new T.IcosahedronGeometry(R * .82, 0), cp = coeur.attributes.position; for (let q = 0; q < cp.count; q += 3) { const ids = []; for (let w = 0; w < 3; w++) { const x = cp.getX(q + w), y = cp.getY(q + w), z = cp.getZ(q + w), nn = new T.Vector3(x, y, z).normalize(); ids.push(f.v(c.x + x, c.y + y * .85, c.z + z, nn.x, nn.y, nn.z, PAL_FEUILLE.coeur)); } f.t(ids[0], ids[1], ids[2]); } coeur.dispose();
    // écailles réparties (Fibonacci), surtout dessus et vers l'extérieur ; la face du dessous reste sombre
    const exterieur = c.clone().sub(centre).setY(0); if (exterieur.lengthSq() > 1e-4) exterieur.normalize();
    for (let e = 0; e < nE; e++) { const yy = 1 - (e + .5) / nE * 1.55, rr = Math.sqrt(Math.max(0, 1 - yy * yy)), th = e * 2.39996 + r() * .3, n = new T.Vector3(Math.cos(th) * rr, yy, Math.sin(th) * rr).add(exterieur.clone().multiplyScalar(.25)).normalize();
      const lum = clamp(.5 + n.y * .45 + n.dot(exterieur) * .15 + (r() - .5) * .25, 0, 1), cc = PAL_FEUILLE.moyen.clone().lerp(PAL_FEUILLE.clair, lum), cb = PAL_FEUILLE.sombre.clone().lerp(PAL_FEUILLE.moyen, lum * .7);
      ecaille(f, c.clone().addScaledVector(n, R * .74), n, R * (.5 + r() * .14), R * .26, cc, cb); } }
  const g1 = bois.geo(), g2 = f.geo(); return { bois: g1, feuilles: g2, tout: fusion([g1, g2]), hauteur: g2.boundingBox.max.y, rayon: Math.max(g2.boundingBox.max.x, -g2.boundingBox.min.x, g2.boundingBox.max.z, -g2.boundingBox.min.z) };
}
// Buisson de sous-étage : une seule masse à écailles.
function buisson(graine, R, n) { const r = rng(graine), f = new Mesher(), c = new T.Vector3(0, R * .55, 0);
  for (let e = 0; e < n; e++) { const yy = 1 - (e + .5) / n * 1.3, rr = Math.sqrt(Math.max(0, 1 - yy * yy)), th = e * 2.39996 + r() * .4, nn = new T.Vector3(Math.cos(th) * rr, yy, Math.sin(th) * rr).normalize(), lum = clamp(.45 + nn.y * .45 + (r() - .5) * .3, 0, 1);
    ecaille(f, c.clone().addScaledVector(nn, R * .6), nn, R * .55, R * .3, PAL_FEUILLE.moyen.clone().lerp(PAL_FEUILLE.clair, lum), PAL_FEUILLE.sombre.clone()); }
  return f.geo(); }


/* ---------- Coût et emprise ---------- */
// Coût d'un groupe : appels de rendu et triangles du niveau de détail PROCHE (le plus cher) ; sprites comptés comme appels.
function cout(groupe) { let appels = 0, triangles = 0; const voir = (o) => {
    if (o.isLOD) { if (o.levels.length) voir(o.levels[0].object); return; }
    if (o.isMesh || o.isInstancedMesh || o.isSprite) { appels++; if (!o.isSprite) { const g = o.geometry; triangles += (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); } }
    for (const k of o.children) voir(k); };
  voir(groupe); return { appels, triangles: Math.round(triangles) }; }
// Toute recette marque ses matériaux (graphics.js ne les remplace pas) et ses objets (masques des bancs).
function marquer(groupe, role) { groupe.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) { m.userData.wkProduction = true; m.userData.wkDecors = true; } if (role && (o.isMesh || o.isInstancedMesh) && !o.userData.wkDecorsRole) o.userData.wkDecorsRole = role; }); return groupe; }
// Oriente toutes les faces d'un maillage d'après un triangle témoin (normale attendue) : indépendant du côté de la route.
function orienter(M, k, attendu) { const P = M.p, I = M.i, a = I[k] * 3, b = I[k + 1] * 3, c = I[k + 2] * 3, u = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], v = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; if (n[0] * attendu[0] + n[1] * attendu[1] + n[2] * attendu[2] >= 0) return false;
  for (let q = 0; q < I.length; q += 3) { const t = I[q + 1]; I[q + 1] = I[q + 2]; I[q + 2] = t; } return true; }
const qualiteBasse = (o) => o.qualite === 'low';

/* ---------- Recette : paroi en masses (decor-paroi-masses-v1 + decor-corniche-herbe-v1) ----------
   o.cadre(s, b) → { x, y, z, ox, oz } : repère fourni par l'appelant (s le long du pied, b latéral vers la paroi, ox/oz unitaire).
   o.sol(x, z) → hauteur du sol. o.pied(s) → b du pied de paroi. o.longueur (demi-longueur, m), o.hauteur (m), o.fente { s0, demi, prof }
   (cascade logée, ouverte vers les s négatifs = l'approche), o.ressauts (hauteurs des tablettes herbeuses), o.lod { centre, distance }. */
function paroiMasses(T, o) {
  const low = qualiteBasse(o), Lp = o.longueur || 88, H0 = o.hauteur || 40, pied = o.pied || (() => 30), cadre = o.cadre, sol = o.sol || (() => 0), seed = (o.graine || 1) | 0;
  const F = o.fente || null, fente = F ? (s) => { const d = s - F.s0; return d < 0 ? smooth(-F.demi - 12, -1, d) : smooth(F.demi + 1.5, F.demi - 1, d); } : () => 0, prof = F ? F.prof : 0;
  const env = (s) => smooth(0, .3, (s + Lp) / (2 * Lp)) * smooth(0, .3, (Lp - s) / (2 * Lp));
  const Hs = (s) => Math.max(1.2, H0 * env(s) * (.9 + .08 * Math.sin(s * .07 + 1 + seed) + .05 * Math.sin(s * .21)));
  const wC = 6.4, hR = 5.6, LEDGES = o.ressauts || [9.5, 20.5, 31], decal = (ci) => hash2(ci, 3, 77 + seed) * hR, coussin = (t, ar) => Math.pow(Math.max(0, 1 - (2 * t - 1) ** 2), ar);
  const masse = (s, h) => { const sw = s + 1.8 * (vnoise(h * .13, s * .02, 4 + seed) - .5) * 2, ci = Math.floor(sw / wC), us = sw / wC - ci, rv = (h + decal(ci)) / hR, ri = Math.floor(rv), vs = rv - ri;
    const k = coussin(us, .34) * coussin(vs, .34), A = 1.6 + 2.3 * hash2(ci, ri, 11 + seed); return { b: A * k, k, ci, ri, vs }; };
  const pal = (o.palette || ['#f7c08a', '#ec9f62', '#d9854e']).map(C), humide = C('#6a5a4c'), cc = new T.Color();
  const batir = (ds, dh) => { const cols = Math.round(2 * Lp / ds), M = new Mesher(), plateau = []; let rangs = 0, rocheMin = Infinity; const nU = Math.ceil((H0 + 2) / dh);
    for (let ic = 0; ic <= cols; ic++) { const s = -Lp + ic * ds, H = Hs(s), fz = fente(s), Ht = H - 3.2 * fz, base = cadre(s, pied(s)), g = sol(base.x, base.z) - 1.2, prof0 = [];
      const hs = []; for (let ir = 0; ir <= nU; ir++) hs.push(-2 + (Ht + 2) * ir / nU); for (const hl of LEDGES) { const ok = hl < Ht - 5 && fz < .5; hs.push(ok ? hl : Ht, ok ? hl + .25 : Ht); } hs.sort((a, b) => a - b);
      const L = LEDGES.filter((hl) => hl < Ht - 5 && fz < .5);
      for (const h of hs) { let set = 0, hp = -2; for (const hl of L) if (h > hl + .1) { set += 2.8; hp = hl + .25; }
        const m = masse(s, h), b = pied(s) + prof * fz + set - .1 * (h - hp) - m.b * (1 - fz * .65) + (h < 1.5 ? .6 * (1.5 - h) / 3.5 : 0); prof0.push([b, h, m]); }
      const bt = prof0[prof0.length - 1][0]; prof0.push([bt + 1.1, Ht + 1.2, null], [bt + 4, Ht + 1.7, null], [bt + 10, Ht + 1.4, null], [bt + 17, Ht * .8, null], [bt + 17 + Ht * 1.5, -4, null]); rangs = prof0.length;
      for (const [b, h, m] of prof0) { const P = cadre(s, b);
        if (m) { cc.copy(pal[Math.floor(hash2(m.ci, m.ri, 5 + seed) * 3)]).multiplyScalar(.82 + .3 * m.vs).multiplyScalar(.42 + .58 * smooth(0, .4, m.k)); if (h < 2) cc.multiplyScalar(.8);
          if (fz > .3) cc.lerp(humide, fz * .75 * smooth(-2, 10, h) * (1 - smooth(Ht - 4, Ht, h) * .5)); rocheMin = Math.min(rocheMin, b); }
        else cc.copy(pal[1]).multiplyScalar(.9);
        M.v(P.x, g + h, P.z, 0, 1, 0, cc, (s + Lp) / 6, h / 6); }
      const Pt = cadre(s, bt + 6); plateau.push({ s, x: Pt.x, z: Pt.z, y: g + Ht + 1.6, H: Ht, g, b0: pied(s), bt }); }
    for (let ic = 0; ic < cols; ic++) for (let q = 0; q < rangs - 1; q++) { const a = ic * rangs + q, b = a + rangs; M.t(a, a + 1, b); M.t(b, a + 1, b + 1); }
    // faces tournées vers la route : la normale d'un triangle du bas de la face doit pointer vers -ox/-oz
    const k0 = (Math.round(cols / 2) * (rangs - 1) + 2) * 6, P0 = cadre(0, pied(0)); orienter(M, k0, [-P0.ox, 0, -P0.oz]);
    return { geo: M.geo(true), plateau, rocheMin, cols, ds }; };
  const PR = batir(low ? 2.8 : 2, low ? 2.6 : 1.7), PL = batir(low ? 5 : 4, low ? 4.5 : 3.6), mat = matRoche({ roche: 'rock_06', mousse: 1, grain: low ? .26 : .38 });
  const proche = new T.Mesh(PR.geo, mat), loin = new T.Mesh(PL.geo, mat); for (const m of [proche, loin]) { m.castShadow = m.receiveShadow = true; m.userData.wkDecorsRole = 'paroi'; }
  const groupe = lodDe(T, proche, loin, o.lod);
  const emprise = []; for (const p of PR.plateau) if (p.H > 6 && Math.abs(p.s) % 6 < PR.ds) { const E = cadre(p.s, p.b0 + 12); emprise.push({ x: E.x, z: E.z, r: 10 + p.H * .55 }); }
  const fentePt = F ? PR.plateau.reduce((a, p) => (Math.abs(p.s - F.s0) < Math.abs(a.s - F.s0) ? p : a), PR.plateau[0]) : null;
  return { groupe: marquer(groupe, 'paroi'), emprise, cout: cout(groupe), infos: { rocheMin: +PR.rocheMin.toFixed(2), plateau: PR.plateau, sommetFente: fentePt && { s: fentePt.s, y: fentePt.g + fentePt.H + .4, b: pied(fentePt.s) + prof * .8 - 1.2 } } };
}
// LOD simple : un groupe par niveau, mêmes coordonnées monde (le groupe LOD est centré, ses enfants décalés d'autant).
function lodDe(T, proche, loin, L) { if (!L || !loin) { const g = new T.Group(); g.add(proche); return g; }
  const lod = new T.LOD(), c = L.centre; lod.position.set(c.x, c.y || 0, c.z); const a = new T.Group(), b = new T.Group(); a.position.set(-c.x, -(c.y || 0), -c.z); b.position.copy(a.position);
  a.add(proche); b.add(loin); lod.addLevel(a, 0); lod.addLevel(b, L.distance || 95); const g = new T.Group(); g.add(lod); return g; }

/* ---------- Recette : cascade logée (decor-cascade-logee-v1) ----------
   Rideau en deux couches de traînées larges, lèvre et écume au pied, brume. o.cadre, o.s0 / o.b (centre du rideau), o.angle (rad : rideau
   tourné vers les s négatifs = l'approche), o.yHaut, o.yBas, o.largeur. Renvoie maj(dt, t) pour l'animation (à appeler à chaque image). */
function cascadeLogee(T, o) {
  const low = qualiteBasse(o), cadre = o.cadre, ANG = o.angle != null ? o.angle : .5, S0 = o.s0 || 0, bF = o.b, yTop = o.yHaut, yBas = o.yBas, hChute = yTop - yBas, L = o.largeur || 17, groupe = new T.Group(), couches = [];
  const ca = Math.cos(ANG), sa = Math.sin(ANG), ici = (u, avant) => cadre(S0 + u * ca - avant * sa, bF - u * sa - avant * ca), nseg = low ? 8 : 16;
  for (const [larg, vit, op, avance, v] of low ? [[L, .55, 1, 0, 0]] : [[L, .55, 1, 0, 0], [L * .6, 1, .9, .7, 1]]) { const tex = texRideau(v).clone(); tex.needsUpdate = true; const rep = Math.max(2, Math.round(hChute / 12));
    const G = new Mesher(), blanc = C('#ffffff'); for (let r = 0; r <= nseg; r++) { const t = r / nseg, y = yTop - hChute * t, avant = avance + 1.7 * Math.sin(Math.min(1, t * 4) * Math.PI / 2) - .6 * t * t;
      for (const sx of [-1, 1]) { const P = ici(sx * larg / 2 * (1 + .12 * t), avant); G.v(P.x, y, P.z, -P.ox, 0, -P.oz, blanc, sx < 0 ? 0 : 1, t * rep); } }
    for (let r = 0; r < nseg; r++) { const a = r * 2; G.t(a, a + 2, a + 1); G.t(a + 1, a + 2, a + 3); }
    const m = new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: op, depthWrite: false, side: T.DoubleSide, color: '#eefcff' }), me = new T.Mesh(G.geo(), m); me.renderOrder = 3; me.userData.wkDecorsRole = 'cascade'; groupe.add(me); couches.push({ tex, vit }); }
  const ec = texEcume(), blanc = C('#ffffff'), lip = new Mesher(); { const pts = []; for (let k = 0; k <= 8; k++) { const P = ici(-L * .41 + k * L * .1025, 1.2); pts.push(new T.Vector3(P.x, yTop + .1, P.z)); } tube(lip, pts, pts.map((_, k) => .35 + .25 * Math.sin(k / 8 * Math.PI)), 6, blanc); }
  const pied = ici(-1.2 / Math.max(ca, .3) * 0, 2), cartes = new Mesher(), P1 = cadre(S0 - 1.2, bF - 2);
  for (let k = 0; k < (low ? 2 : 4); k++) { const a = k / 4 * Math.PI, dx = Math.cos(a), dz = Math.sin(a), w = 7.5, hh = 3.4, i0 = cartes.p.length / 3;
    for (const [u, v] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) cartes.v(P1.x + dx * w * u, yBas - .2 + v * hh, P1.z + dz * w * u, 0, 0, 1, blanc, (u + 1), v); cartes.t(i0, i0 + 1, i0 + 2); cartes.t(i0 + 1, i0 + 3, i0 + 2); }
  { const cA = cadre(S0 - 1.2, bF - 3.5), na = low ? 16 : 28, i0 = cartes.p.length / 3; cartes.v(cA.x, yBas + .04, cA.z, 0, 1, 0, blanc, .5, .5);
    for (let k = 0; k < na; k++) { const a = k / na * TAU; cartes.v(cA.x + Math.cos(a) * 6.5, yBas + .04, cA.z + Math.sin(a) * 6.5, 0, 1, 0, blanc, .5 + Math.cos(a) * 1.5, .5 + Math.sin(a) * 1.5); }
    for (let k = 0; k < na; k++) cartes.t(i0, i0 + 1 + k, i0 + 1 + (k + 1) % na); }
  const ecM = new T.MeshBasicMaterial({ map: ec, transparent: true, opacity: .95, depthWrite: false, side: T.DoubleSide }), ecume = new T.Mesh(fusion([cartes.geo(), lip.geo()]), ecM);
  ecume.renderOrder = 4; ecume.userData.wkDecorsRole = 'ecume'; groupe.add(ecume);   // cartes d'écume, anneau et lèvre : un seul appel
  const brumes = [], bt = texBrume(); for (let q = 0; q < 2; q++) { const sp = new T.Sprite(new T.SpriteMaterial({ map: bt, transparent: true, opacity: .45, depthWrite: false })), sc = 9 + q * 2.6; sp.scale.set(sc, sc * .7, 1);
    sp.position.set(P1.x - P1.ox * (2 + q * .6) + (hash2(q, 1, 3) - .5) * 8, yBas + 1.5 + q * 1.5, P1.z - P1.oz * (2 + q * .6) + (hash2(q, 7, 3) - .5) * 8); groupe.add(sp); brumes.push({ sp, y0: sp.position.y, ph: q }); }
  const maj = (dt, t) => { for (const l of couches) l.tex.offset.y += dt * l.vit * .32; ec.offset.y -= dt * .25; for (const b of brumes) { b.sp.position.y = b.y0 + Math.sin(t * .6 + b.ph) * .8; b.sp.material.opacity = .32 + Math.sin(t * .8 + b.ph * 1.7) * .12; } };
  void pied; return { groupe: marquer(groupe, 'cascade'), emprise: [{ x: P1.x, z: P1.z, r: L * .6 }], cout: cout(groupe), maj, infos: { pied: { x: P1.x - P1.ox * 1.5, y: yBas + .6, z: P1.z - P1.oz * 1.5 }, largeur: L, angle: ANG } };
}

/* ---------- Recette : eau à profondeur lisible (decor-eau-profondeur-v1) ----------
   o.contour : points [x, z] du bord (polygone fermé, vu depuis o.centre [x, z]) ; o.niveau ; o.sol(x, z). Surface colorée selon la
   profondeur (turquoise au bord, bleu profond au centre) et fond toujours au-dessus du sol réel (sinon on voit le terrain à travers l'eau). */
const TEX_VAGUES = { t: null };
function eauProfondeur(T, o) {
  const low = qualiteBasse(o), sol = o.sol || (() => o.niveau - 3), N = o.contour.length, [cx, cz] = o.centre, nv = o.niveau, pmax = o.profondeur || 2.85, groupe = new T.Group();
  const anneaux = low ? [1, .6, .25] : [1, .82, .58, .3], prof = (k) => .25 + (pmax - .25) * (1 - k * k), Fd = new Mesher(), Eau = new Mesher();
  const cBord = C('#7fe0cf'), cMil = C('#27b0e8'), cFond = C('#0e5d88'), sable = C('#d9c08e'), fondP = C('#3d6b6a'), rf = [], re = [];
  const fc = Fd.v(cx, Math.max(nv - prof(0), sol(cx, cz) + .15), cz, 0, 1, 0, fondP), ec = Eau.v(cx, nv, cz, 0, 1, 0, cFond, cx * .08, cz * .08);
  for (const k of anneaux) { const a = [], b = []; for (let q = 0; q < N; q++) { const x = cx + (o.contour[q][0] - cx) * k, z = cz + (o.contour[q][1] - cz) * k, d = 1 - k;
      a.push(Fd.v(x, Math.max(nv - prof(k), sol(x, z) + .15), z, 0, 1, 0, sable.clone().lerp(fondP, smooth(0, .6, d))));
      b.push(Eau.v(x, nv, z, 0, 1, 0, d < .25 ? cBord.clone().lerp(cMil, d / .25) : cMil.clone().lerp(cFond, smooth(.25, .7, d)), x * .08, z * .08)); } rf.push(a); re.push(b); }
  const tisser = (M, R, c) => { for (let a = 0; a < R.length - 1; a++) for (let q = 0; q < N; q++) { const q1 = (q + 1) % N; M.t(R[a][q], R[a + 1][q], R[a][q1]); M.t(R[a][q1], R[a + 1][q], R[a + 1][q1]); }
    const L = R[R.length - 1]; for (let q = 0; q < N; q++) M.t(L[q], c, L[(q + 1) % N]); M.versHaut(); };
  tisser(Fd, rf, fc); tisser(Eau, re, ec);
  if (!TEX_VAGUES.t) TEX_VAGUES.t = texVagues(); const vg = TEX_VAGUES.t;
  const fond = new T.Mesh(Fd.geo(true), matSimple({ roughness: 1 })); fond.receiveShadow = true; fond.userData.wkDecorsRole = 'fond'; groupe.add(fond);
  const eau = new T.Mesh(Eau.geo(true), matEau(T, vg)); eau.renderOrder = 2; eau.userData.wkDecorsRole = 'eau'; groupe.add(eau);
  let r = 0; for (const [x, z] of o.contour) r = Math.max(r, Math.hypot(x - cx, z - cz));
  return { groupe: marquer(groupe, 'eau'), emprise: [{ x: cx, z: cz, r: r + 1 }], cout: cout(groupe), maj: majVagues };
}
function matEau(T, vg, opacite) { return new T.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: opacite || .84, roughness: .1, metalness: .05, normalMap: vg, normalScale: new T.Vector2(.35, .35), envMapIntensity: .8, depthWrite: false }); }
function majVagues(dt) { const vg = TEX_VAGUES.t; if (vg) { vg.offset.x += dt * .018; vg.offset.y -= dt * .012; } }

/* ---------- Recette : rivière (eau courante) ----------
   o.chemin : [{ x, z, h (niveau d'eau), l (largeur) }] dans le sens de l'écoulement. Le lit et les berges sont dans le relief (creusés par
   l'appelant) ; la recette pose l'eau (couleur par position dans le lit, écume blanche sur les rapides), et des galets sur les berges. */
function riviere(T, o) {
  const low = qualiteBasse(o), ch = o.chemin, groupe = new T.Group(), E = new Mesher(), cBord = C('#5fd2de'), cMil = C('#1b97d0'), cRap = C('#effcff'), galets = [];
  for (let i = 0; i < ch.length; i++) { const p = ch[i], a = ch[Math.max(0, i - 1)], c = ch[Math.min(ch.length - 1, i + 1)], tx = c.x - a.x, tz = c.z - a.z, tl = Math.hypot(tx, tz) || 1, nx = -tz / tl, nz = tx / tl, w = p.l / 2;
    const pente = i ? (ch[i - 1].h - p.h) / Math.max(.5, Math.hypot(p.x - ch[i - 1].x, p.z - ch[i - 1].z)) : 0, rap = smooth(.05, .22, pente);
    for (const k of [-1, 0, 1]) E.v(p.x + nx * w * k, p.h, p.z + nz * w * k, 0, 1, 0, (k ? cBord : cMil).clone().lerp(cRap, rap), (p.x + nx * w * k) * .08, (p.z + nz * w * k) * .08);
    if (!low && i % 4 === 2) for (const k of [-1, 1]) { const sz = .35 + hash2(i, k + 3, 41) * .6, x = p.x + nx * (w + .4) * k, z = p.z + nz * (w + .4) * k; galets.push({ x, y: (o.sol ? o.sol(x, z) : p.h) - sz * .2, z, ry: i, s: sz, sy: sz * .6 }); } }
  for (let i = 0; i < ch.length - 1; i++) { const a = i * 3, b = a + 3; E.t(a, b, a + 1); E.t(a + 1, b, b + 1); E.t(a + 1, b + 1, a + 2); E.t(a + 2, b + 1, b + 2); }
  E.versHaut(); if (!TEX_VAGUES.t) TEX_VAGUES.t = texVagues();
  const eau = new T.Mesh(E.geo(true), matEau(T, TEX_VAGUES.t, .86)); eau.renderOrder = 2; eau.userData.wkDecorsRole = 'eau'; groupe.add(eau);
  if (galets.length && root.WKNature && root.WKNature.rockGeometry) { const rg = root.WKNature.rockGeometry(37, 0, [1, .6, 1]).clone(), n = rg.attributes.position.count, col = new Float32Array(n * 3).fill(.78); rg.setAttribute('color', new T.BufferAttribute(col, 3));
    const im = instances(groupe, rg, matRoche({ roche: 'rock_06', mousse: .4, grain: .5, echelle: .4 }), galets, false); if (im) im.userData.wkDecorsRole = 'galets'; }
  const emprise = []; for (let i = 0; i < ch.length; i += 3) emprise.push({ x: ch[i].x, z: ch[i].z, r: ch[i].l / 2 + 4 });
  return { groupe: marquer(groupe, 'eau'), emprise, cout: cout(groupe), maj: majVagues };
}

/* ---------- Recette : lagon (plan d'eau à niveau fixe dans un creux du relief) ----------
   Le terrain plus haut cache l'eau : berge naturelle. Grille colorée selon la profondeur réelle (o.sol) : écume au rivage, turquoise
   sur les hauts-fonds, bleu au centre ; cellules entièrement sous le terrain omises. */
function lagon(T, o) {
  const low = qualiteBasse(o), [cx, cz] = o.centre, R = o.rayon, nv = o.niveau, n = low ? 34 : 60, M = new Mesher(), sol = o.sol, groupe = new T.Group();
  // o.palette 'lac' (lac de prairie, concepteur paysage 9 nov.) : bord vert-gris et fond bleu profond, contraste avec l'herbe et le ciel ;
  // par défaut, lagon tropical turquoise (Grande Cascade).
  const PAL = o.palette === 'lac' ? ['#8fb8a0', '#3f8fa6', '#22658f', '#123c63'] : ['#eefcf8', '#6fe3cf', '#20b6e0', '#0c5f96'];
  const cE = C(PAL[0]), cH = C(PAL[1]), cM = C(PAL[2]), cF = C(PAL[3]); let surface = 0;
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { const x = cx - R + 2 * R * i / n, z = cz - R + 2 * R * j / n, d = nv - sol(x, z), c = d < .45 ? cE.clone().lerp(cH, smooth(.1, .45, d)) : d < 2.5 ? cH.clone().lerp(cM, smooth(.45, 2.5, d)) : cM.clone().lerp(cF, smooth(2.5, 7, d));
    M.v(x, nv, z, 0, 1, 0, c, x * .05, z * .05); }
  const dans = (k) => { const x = M.p[k * 3], z = M.p[k * 3 + 2]; return (x - cx) ** 2 + (z - cz) ** 2 < R * R && nv - sol(x, z) > -1.2; }, cel = (2 * R / n) ** 2;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1; if (!(dans(a) || dans(b) || dans(c) || dans(d))) continue; M.t(a, c, b); M.t(b, c, d);
    const xm = M.p[a * 3] + R / n, zm = M.p[a * 3 + 2] + R / n; if (nv > sol(xm, zm)) surface += cel; }
  M.versHaut(); if (!TEX_VAGUES.t) TEX_VAGUES.t = texVagues();
  const mE = matEau(T, TEX_VAGUES.t, o.palette === 'lac' ? .94 : .88); if (o.palette === 'lac') { mE.roughness = .34; mE.envMapIntensity = .32; mE.normalScale.set(.22, .22); }   // reflet du ciel atténué : l'eau garde sa couleur en incidence rasante
  const eau = new T.Mesh(M.geo(true), mE); eau.renderOrder = 2; eau.userData.wkDecorsRole = 'eau'; groupe.add(eau);
  return { groupe: marquer(groupe, 'eau'), emprise: [{ x: cx, z: cz, r: R }], cout: cout(groupe), maj: majVagues, infos: { surface: Math.round(surface), niveau: nv } };
}

/* ---------- Recette : ponceau (têtes maçonnées en arc, ouverture sombre) ----------
   o.tetes : [{ x, y (base), z, nx, nz (normale tournée vers l'extérieur de la route), hauteur, largeur }]. Aucune collision. */
function ponceau(T, o) {
  const G = new Mesher(), pierre = C('#d4bd9c'), noir = C('#0d0f10'), r0 = o.rayon || 1.7, groupe = new T.Group(), emprise = [];
  for (const t of o.tetes) { const Lh = (t.largeur || 10) / 2, H = Math.max(2.6, t.hauteur), ha = Math.max(.3, Math.min(.6, H - r0 - .35));
    const sh = new T.Shape(); sh.moveTo(-Lh, 0); sh.lineTo(Lh, 0); sh.lineTo(Lh, H); sh.lineTo(-Lh, H); sh.lineTo(-Lh, 0);
    const trou = new T.Path(); trou.moveTo(-r0, .2); trou.lineTo(r0, .2); trou.lineTo(r0, ha); trou.absarc(0, ha, r0, 0, Math.PI, false); trou.lineTo(-r0, .2); sh.holes.push(trou);
    const eg = new T.ExtrudeGeometry(sh, { depth: 1.3, bevelEnabled: false, curveSegments: 6 }), up = new T.Vector3(0, 1, 0), n = new T.Vector3(t.nx, 0, t.nz).normalize(), x = new T.Vector3().crossVectors(up, n), m = new T.Matrix4().makeBasis(x, up, n).setPosition(t.x, t.y, t.z);
    eg.applyMatrix4(m); const pa = eg.attributes.position, na = eg.attributes.normal, b0 = G.p.length / 3;
    for (let q = 0; q < pa.count; q++) { G.v(pa.getX(q), pa.getY(q), pa.getZ(q), na.getX(q), na.getY(q), na.getZ(q), pierre.clone().multiplyScalar(.85 + .15 * hash2(q, 1, 3))); if (q % 3 === 2) G.t(b0 + q - 2, b0 + q - 1, b0 + q); } eg.dispose();
    const k0 = G.p.length / 3; for (const [u, v] of [[-r0 - .2, 0], [r0 + .2, 0], [-r0 - .2, ha + r0 + .2], [r0 + .2, ha + r0 + .2]]) { const Q = new T.Vector3(u, v, -.6).applyMatrix4(m); G.v(Q.x, Q.y, Q.z, n.x, 0, n.z, noir); } G.t(k0, k0 + 1, k0 + 2); G.t(k0 + 1, k0 + 3, k0 + 2);
    emprise.push({ x: t.x, z: t.z, r: Lh + 1 }); }
  const me = new T.Mesh(G.geo(), matRoche({ roche: 'rock_06', mousse: .5, grain: .55, echelle: .3 })); me.castShadow = me.receiveShadow = true; me.userData.wkDecorsRole = 'ponceau'; groupe.add(me);
  return { groupe: marquer(groupe, 'ponceau'), emprise, cout: cout(groupe), infos: { ouverture: { largeur: 2 * r0, hauteur: r0 + .6 } } };
}

/* ---------- Recette : feuillus à plaques en groupes + sous-étage (decor-feuillu-plaques-v1, decor-groupes-lisieres-v1) ----------
   o.arbres : [{ x, y, z, ry, s, v }] (v : 0 ou 1 au premier plan, 2 en lisière lointaine) ; o.buissons : [{ x, y, z, ry, s }] ;
   o.lod { centre, distance } : au-delà, 3 écailles par masse et buissons simplifiés. */
const FEUILLUS = new Map();
function feuillusPlaques(T, o) {
  const low = qualiteBasse(o), cle = low ? 'b' : 'h';
  if (!FEUILLUS.has(cle)) FEUILLUS.set(cle, { pres: [feuillu(7101, { hauteur: 9, masses: 4, ecailles: low ? 6 : 10, bas: low }), feuillu(7557, { hauteur: 8, masses: 3, ecailles: low ? 6 : 11, bas: low }), feuillu(7333, { hauteur: 10, masses: 4, ecailles: 5, bas: true })],
    loin: [feuillu(7101, { hauteur: 9, masses: 4, ecailles: 3, bas: true }), feuillu(7557, { hauteur: 8, masses: 3, ecailles: 3, bas: true }), feuillu(7333, { hauteur: 10, masses: 4, ecailles: 3, bas: true })], bp: buisson(4411, 1.3, low ? 5 : 7), bl: buisson(4411, 1.3, 3) });
  const V = FEUILLUS.get(cle), A = new T.Group(), B = new T.Group(), feu = matSimple({ roughness: .82, side: T.DoubleSide }), mb = matSimple({ roughness: .85, side: T.DoubleSide });
  for (let v = 0; v < 3; v++) { const L = (o.arbres || []).filter((a) => (a.v | 0) === v).map((a) => ({ x: a.x, y: a.y, z: a.z, ry: a.ry, s: a.s, col: new T.Color().setScalar(.9 + hash2(a.x * 10, a.z * 10, 2) * .2) }));
    const p = instances(A, V.pres[v].tout, feu, L, v < 2), l = instances(B, V.loin[v].tout, feu, L, false); for (const m of [p, l]) if (m) m.userData.wkDecorsRole = 'feuillage'; }
  if ((o.buissons || []).length) { instances(A, V.bp, mb, o.buissons, false); instances(B, V.bl, mb, o.buissons, false); }
  const groupe = o.lod ? (() => { const lod = new T.LOD(), c = o.lod.centre, g = new T.Group(); lod.position.set(c.x, c.y || 0, c.z); A.position.set(-c.x, -(c.y || 0), -c.z); B.position.copy(A.position); lod.addLevel(A, 0); lod.addLevel(B, o.lod.distance || 95); g.add(lod); return g; })() : A;
  const emprise = (o.arbres || []).map((a) => ({ x: a.x, z: a.z, r: 6 * (a.s || 1) }));
  let enGroupe = 0; for (const a of o.arbres || []) if ((o.arbres || []).some((b) => b !== a && Math.hypot(a.x - b.x, a.z - b.z) < 9)) enGroupe++;
  return { groupe: marquer(groupe, 'feuillage'), emprise, cout: cout(groupe), infos: { arbres: (o.arbres || []).length, enGroupe: (o.arbres || []).length ? +(enGroupe / o.arbres.length).toFixed(2) : 0, dims: V.pres.map((f) => [+f.hauteur.toFixed(1), +f.rayon.toFixed(1)]) } };
}


/* ---------- Recette : parapet de pierre à claire-voie (bord de route au droit d'un bassin, variante P1-b) ----------
   Décor SEUL : la barrière physique reste celle du muret d'origine (posée invisible par l'appelant, même géométrie). o.points :
   [{ x, y (dessus de chaussée), z, dx, dz (tangente) }] le long de la ligne du muret ; hauteur 1,06 m comme le muret. */
function parapet(T, o) {
  const G = new Mesher(), pierre = C('#cdb894'), clair = C('#e2d2b0'), pts = o.points, H = o.hauteur || 1.06, groupe = new T.Group();
  const boite = (cx, cy, cz, dx, dz, lx, ly, lz, col) => { const nx = -dz, nz = dx, b0 = G.p.length / 3, hx = lx / 2, hy = ly / 2, hz = lz / 2;
    const P = (u, v, w) => [cx + dx * u + nx * w, cy + v, cz + dz * u + nz * w];
    const faces = [[[1, 0, 0], [[hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz], [hx, -hy, hz]]], [[-1, 0, 0], [[-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz], [-hx, -hy, -hz]]], [[0, 1, 0], [[-hx, hy, -hz], [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz]]],
      [[0, 0, 1], [[hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz], [-hx, -hy, hz]]], [[0, 0, -1], [[-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz], [hx, -hy, -hz]]]];
    for (const [n, q] of faces) { const k0 = G.p.length / 3, wn = [dx * n[0] + nx * n[2], n[1], dz * n[0] + nz * n[2]]; for (const [u, v, w] of q) { const p = P(u, v, w); G.v(p[0], p[1], p[2], wn[0], wn[1], wn[2], col); } G.t(k0, k0 + 1, k0 + 2); G.t(k0, k0 + 2, k0 + 3); } void b0; };
  for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z), dx = (b.x - a.x) / L, dz = (b.z - a.z) / L, cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2, cy = (a.y + b.y) / 2;
    boite(cx, cy + .12, cz, dx, dz, L + .02, .24, .5, pierre);            // soubassement bas (claire-voie de 0,24 à 0,95 m)
    boite(cx, cy + H - .07, cz, dx, dz, L + .02, .14, .56, clair);        // couronnement
    boite(a.x, a.y + H / 2, a.z, dx, dz, .42, H - .1, .42, pierre); }     // piles (claire-voie entre elles)
  const l = pts[pts.length - 1], p = pts[pts.length - 2]; boite(l.x, l.y + H / 2, l.z, (l.x - p.x) / Math.hypot(l.x - p.x, l.z - p.z), (l.z - p.z) / Math.hypot(l.x - p.x, l.z - p.z), .42, H - .1, .42, pierre);
  const me = new T.Mesh(G.geo(), matRoche({ roche: 'rock_06', mousse: .3, grain: .5, echelle: .45 })); me.castShadow = me.receiveShadow = true; me.userData.wkDecorsRole = 'parapet'; groupe.add(me);
  return { groupe: marquer(groupe, 'parapet'), emprise: [], cout: cout(groupe) };
}

root.WKDecors = { version: 2, parapet, paroiMasses, cascadeLogee, eauProfondeur, riviere, lagon, ponceau, feuillusPlaques, majVagues, cout, outils: { matRoche, feuillu, buisson } };
})(window);
