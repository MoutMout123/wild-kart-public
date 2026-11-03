/* Wild Kart — Décors vivants : spectateurs animés en tribunes (épingles, réceptions de planeur), drapeaux qui flottent le long
   des lignes droites, montgolfières qui dérivent. Purement visuel : aucune collision, rien dans l'enveloppe roulable ; l'animation
   se fait dans le shader (pas de coût CPU par spectateur). Les dangers interactifs sont des obstacles du jeu (game.js). */
(function (root) {
'use strict';
const T = root.THREE, TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function rng(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
const PALETTES = {
  default: ['#ff4f3a', '#ffc531', '#38b6ff', '#3ee08f', '#ff7ab8', '#9b7bff', '#fffdf7', '#ff8a1e'],
  night: ['#ff3a8a', '#5ff2ff', '#ffe066', '#9b7bff', '#3ee08f', '#ff8a1e'],
};
const SKIN = ['#f2c9a0', '#d9a066', '#a86b3c', '#6b4226', '#ffd9b8'];

/* Géométries partagées (conservées entre circuits) */
let GEO = null;
function geometries() {
  if (GEO) return GEO;
  const body = new T.CapsuleGeometry(.32, .7, 4, 8); body.translate(0, .75, 0);
  const armL = new T.CapsuleGeometry(.1, .55, 3, 6); armL.rotateZ(.5); armL.translate(-.42, 1.35, 0);
  const armR = armL.clone(); armR.scale(-1, 1, 1);
  const head = new T.SphereGeometry(.26, 10, 8); head.translate(0, 1.52, 0);
  const merge = (list) => { const pos = [], nor = [], idx = []; let o = 0; for (const g0 of list) { const g = g0.index ? g0 : g0; const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); } const ix = g.index.array; for (let i = 0; i < ix.length; i++) idx.push(ix[i] + o); o += p.count; }
    const out = new T.BufferGeometry(); out.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); out.setIndex(idx); out.userData.keep = true; return out; };
  const flag = new T.PlaneGeometry(2.4, 1.5, 12, 4); flag.translate(1.2, 0, 0); flag.userData.keep = true;
  const pole = new T.CylinderGeometry(.07, .09, 7, 6); pole.translate(0, 3.5, 0); pole.userData.keep = true;
  const balloon = new T.SphereGeometry(6, 20, 14); balloon.scale(1, 1.15, 1); balloon.translate(0, 9, 0); balloon.userData.keep = true;
  const basket = new T.CylinderGeometry(1.1, .9, 1.2, 10); basket.userData.keep = true;
  GEO = { body: merge([body, armL, armR]), head: merge([head]), flag, pole, balloon, basket };
  return GEO;
}
/* Matériau animé : rebond ou balancement selon une phase tirée de la position de l'instance. */
function animated(color, kind, time, opts = {}) {
  const mat = new T.MeshStandardMaterial(Object.assign({ color, roughness: .7, metalness: 0 }, opts)); mat.userData.wkVivant = true;
  mat.onBeforeCompile = (s) => {
    s.uniforms.wkTime = time;
    s.vertexShader = 'uniform float wkTime;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      vec3 wkO=instanceMatrix[3].xyz;
      #else
      vec3 wkO=vec3(0.0);
      #endif
      float wkPh=fract(sin(dot(wkO.xz,vec2(12.9898,78.233)))*43758.5453)*6.2831;
      ${kind === 'crowd' ? `
      /* Spectateur : sauts irréguliers, bras qui s'agitent. */
      float wkJ=max(0.0,sin(wkTime*(5.0+wkPh*.4)+wkPh)); transformed.y+=wkJ*wkJ*.45;
      if(position.y>1.1&&abs(position.x)>.25) transformed.y+=sin(wkTime*9.0+wkPh)*.18*sign(position.x)*sign(position.x);` : ''}
      ${kind === 'flag' ? `
      /* Drapeau : onde le long de la toile, amplitude croissante vers le bord libre. */
      float wkU=position.x/2.4; transformed.z+=sin(wkTime*5.0+position.x*2.6+wkPh)*.32*wkU; transformed.y+=sin(wkTime*3.1+position.x*1.7+wkPh)*.08*wkU;` : ''}
      ${kind === 'balloon' ? `
      transformed.y+=sin(wkTime*.4+wkPh)*2.5; transformed.x+=sin(wkTime*.13+wkPh)*6.0;` : ''}`);
  };
  mat.customProgramCacheKey = () => 'wk-vivant-' + kind; return mat;
}
function instanced(geo, mat, list, colors) {
  const m = new T.InstancedMesh(geo, mat, list.length), M = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), s = new T.Vector3(), p = new T.Vector3(), c = new T.Color();
  list.forEach((it, i) => { e.set(0, it.r || 0, 0); q.setFromEuler(e); s.setScalar(it.s || 1); p.set(it.x, it.y, it.z); M.compose(p, q, s); m.setMatrixAt(i, M); if (colors) { c.set(colors(it, i)); m.setColorAt(i, c); } });
  m.computeBoundingSphere(); m.userData.wkVivant = true; return m;
}

function build(W, quality) {
  if (!W || !W.S || W.def.arena) return null;
  const S = W.S, N = S.N, th = W.th, R = rng(((W.def.id.length * 977) ^ 0x5eed) >>> 0), q = quality === 'low' ? .45 : quality === 'medium' ? .75 : 1;
  const time = { value: 0 }, group = new T.Group(); group.name = 'Décors vivants'; group.userData.wkVivant = true; W.scene.add(group);
  const G = geometries(), pal = th.night ? PALETTES.night : PALETTES.default, wallD = W.wallD;
  const ground = (x, z, i) => (W.hAt ? W.hAt(x, z) : S.py[i]);
  const busy = (i) => Math.min(i, N - i) < N * .05 || S.glide[i] || (S.wz && S.wz[i]) || (S.nowall && S.nowall[i]) || W.branches.some((B) => { const d = (j) => Math.min(Math.abs(i - j), N - Math.abs(i - j)); return d(B.i0) < 45 || d(B.i1) < 45; });
  // Emplacement sur une autre route (branche qui longe la route principale) : refusé. Avant, seules les bouches étaient évitées et deux
  // tribunes de la Glissade se posaient sur la POUDREUSE et sur l'ENVOL (retour Samsung du 2 novembre).
  const surBranche = (x, z) => W.branches.some((B) => { const r2 = (B.wallD + 3) ** 2; for (let j = 0; j < B.N; j += 2) if ((B.px[j] - x) ** 2 + (B.pz[j] - z) ** 2 < r2) return true; return false; });
  const tribuneLibre = (i, side) => { for (const dc of [-12, -6, 0, 6, 12]) { const j = ((i + dc) % N + N) % N; for (const r of [0, 3]) { const off = side * (wallD + 4 + r * 1.6), x = S.px[j] + S.rx[j] * off, z = S.pz[j] + S.rz[j] * off; if (surBranche(x, z) || Math.abs(ground(x, z, j) - S.py[j]) > 3.5) return false; } } return true; }; // ni sur une autre route, ni flottante au-dessus d'un sol plus bas (ou enterrée)
  // 1. Tribunes : les épingles les plus serrées (côté extérieur) et les réceptions de planeur.
  const spots = [];
  const curvAt = (i) => { let c = 0; for (let o = -12; o <= 12; o++) c += S.curv[((i + o) % N + N) % N]; return c / 25; };
  const cands = []; for (let i = 0; i < N; i += 6) if (!busy(i)) cands.push([Math.abs(curvAt(i)), i]);
  cands.sort((a, b) => b[0] - a[0]);
  for (const [c, i] of cands) { if (spots.length >= 3 || c < .012) break; if (spots.some((s) => Math.min(Math.abs(s.i - i), N - Math.abs(s.i - i)) < N * .12)) continue; const sd0 = -Math.sign(curvAt(i)) || 1; if (!tribuneLibre(i, sd0)) continue; spots.push({ i, side: sd0, kind: 'épingle' }); }
  for (let i = 0; i < N; i++) if (S.glide[i] && !S.glide[(i + 1) % N]) { const j = (i + 25) % N; const sd1 = R() < .5 ? -1 : 1; if (!busy(j) && tribuneLibre(j, sd1)) spots.push({ i: j, side: sd1, kind: 'réception' }); }
  const bodies = [], heads = [], stands = [];
  for (const sp of spots) {
    const rows = 4, cols = Math.round(14 * q) + 4;
    for (let c = 0; c < cols; c++) { const j = ((sp.i + Math.round((c - cols / 2) * 1.2)) % N + N) % N;
      for (let r = 0; r < rows; r++) { const off = sp.side * (wallD + 4 + r * 1.6), x = S.px[j] + S.rx[j] * off + (R() - .5) * .4, z = S.pz[j] + S.rz[j] * off + (R() - .5) * .4, y = Math.max(ground(x, z, j), S.py[j]) + .2 + r * .9;
        if (R() > .88) continue; const it = { x, y, z, r: S.hd[j] + (sp.side > 0 ? -Math.PI / 2 : Math.PI / 2) + (R() - .5) * .5, s: .9 + R() * .25 }; bodies.push(it); heads.push(it); }
      if (c % 2 === 0) for (let r = 0; r < rows; r++) { const off = sp.side * (wallD + 4 + r * 1.6), x = S.px[j] + S.rx[j] * off, z = S.pz[j] + S.rz[j] * off; stands.push({ x, y: Math.max(ground(x, z, j), S.py[j]) - .4 + r * .9, z, r: S.hd[j], s: 1 }); } }
  }
  if (bodies.length) {
    group.add(instanced(G.body, animated('#ffffff', 'crowd', time), bodies, () => pal[Math.floor(R() * pal.length)]));
    group.add(instanced(G.head, animated('#ffffff', 'crowd', time), heads, () => SKIN[Math.floor(R() * SKIN.length)]));
    const step = new T.BoxGeometry(2.6, .9, 1.7); step.translate(0, .45, 0); step.userData.keep = false;
    group.add(instanced(step, new T.MeshStandardMaterial({ color: th.night ? '#3a3a5a' : '#c9c2b6', roughness: .9 }), stands));
  }
  // 2. Drapeaux le long des lignes droites, alternés des deux côtés, derrière les barrières.
  const flags = [];
  for (let i = 0; i < N; i += Math.max(22, Math.round(36 / q))) { if (busy(i) || Math.abs(S.curv[i]) > .025) continue;
    for (const sd of [-1, 1]) { if (R() < .35) continue; const off = sd * (wallD + 2.2), x = S.px[i] + S.rx[i] * off, z = S.pz[i] + S.rz[i] * off; if (surBranche(x, z)) continue; flags.push({ x, y: Math.max(ground(x, z, i), S.py[i]) - .1, z, r: S.hd[i] + (R() - .5) * .6, s: 1 }); } }
  if (flags.length) {
    group.add(instanced(G.pole, new T.MeshStandardMaterial({ color: '#e9ecf4', roughness: .3, metalness: .7 }), flags));
    group.add(instanced(G.flag, animated('#ffffff', 'flag', time, { side: T.DoubleSide, roughness: .8 }), flags.map((f) => Object.assign({}, f, { y: f.y + 5.6 })), () => pal[Math.floor(R() * pal.length)]));
  }
  // 3. Montgolfières (circuits extérieurs de jour).
  const outdoor = !th.night && !['space', 'seabed', 'mall', 'parquet', 'pinball'].includes(th.ground);
  const balloons = [];
  if (outdoor) for (let k = 0; k < Math.round(6 * q) + 2; k++) { const a = R() * TAU, d = W.bb.ext * (.6 + R() * .9); balloons.push({ x: W.bb.cx + Math.cos(a) * d, y: 70 + R() * 70, z: W.bb.cz + Math.sin(a) * d, r: R() * TAU, s: .8 + R() * .5 }); }
  if (balloons.length) {
    group.add(instanced(G.balloon, animated('#ffffff', 'balloon', time, { roughness: .5 }), balloons, () => pal[Math.floor(R() * pal.length)]));
    group.add(instanced(G.basket, animated('#8a5a32', 'balloon', time), balloons));
  }
  const state = { group, time, spots: spots.map((s) => ({ f: +(s.i / N).toFixed(3), kind: s.kind, side: s.side })), stats: { tribunes: spots.length, spectateurs: bodies.length, drapeaux: flags.length, montgolfieres: balloons.length } };
  W.vivant = state;
  (W.anim = W.anim || []).push((dt) => { time.value += dt; });
  return state;
}
root.WKVivant = { build };
})(window);
