/* Wild Kart — Kit Nature v3 : terrain PBR multicouche, végétation modélisée, rochers sculptés et montagnes d'horizon.
   S'applique aux circuits historiques à terrain naturel. Aucune donnée de collision, de course ou de physique n'est modifiée :
   les anciens décors remplacés n'avaient pas de collision, et les nouveaux restent hors de l'enveloppe roulable. */
(function (root) {
'use strict';
const T = root.THREE, TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function rng(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
function hash2(x, z, s) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(s | 0, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, z, s) { const ix = Math.floor(x), iz = Math.floor(z); let fx = x - ix, fz = z - iz; fx *= fx * (3 - 2 * fx); fz *= fz * (3 - 2 * fz);
  const a = hash2(ix, iz, s), b = hash2(ix + 1, iz, s), c = hash2(ix, iz + 1, s), d = hash2(ix + 1, iz + 1, s); return lerp(lerp(a, b, fx), lerp(c, d, fx), fz); }
function fbm(x, z, s, oct = 4) { let v = 0, a = .5, f = 1; for (let o = 0; o < oct; o++) { v += a * vnoise(x * f, z * f, s + o * 17); f *= 2.03; a *= .5; } return v / (1 - Math.pow(.5, oct)); }
function hash3(x, y, z) { return hash2(x * 7 + z * 13, y * 3 - z, 911); }
function vnoise3(x, y, z) { const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z); let fx = x - ix, fy = y - iy, fz = z - iz; fx *= fx * (3 - 2 * fx); fy *= fy * (3 - 2 * fy); fz *= fz * (3 - 2 * fz);
  const n = (a, b, c) => hash3(ix + a, iy + b, iz + c);
  return lerp(lerp(lerp(n(0, 0, 0), n(1, 0, 0), fx), lerp(n(0, 1, 0), n(1, 1, 0), fx), fy), lerp(lerp(n(0, 0, 1), n(1, 0, 1), fx), lerp(n(0, 1, 1), n(1, 1, 1), fx), fy), fz); }

/* ---------- Textures CC0 locales (Poly Haven, voir assets/materials/nature/manifest.json) ---------- */
const cache = new Map(), pending = [], errors = [];
let mobile = false, anisotropy = 4;
function texture(id, role) {
  const profile = mobile ? 'mobile' : 'pc', key = id + ':' + role + ':' + profile; if (cache.has(key)) return cache.get(key);
  const url = 'assets/materials/nature/' + profile + '/' + id + '-' + role + '.webp';
  let done; pending.push(new Promise(r => done = r));
  const tex = new T.TextureLoader().load(url, () => done(), undefined, () => { errors.push(url); done(); });
  tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.minFilter = T.LinearMipmapLinearFilter; tex.magFilter = T.LinearFilter; tex.anisotropy = anisotropy;
  tex.colorSpace = role === 'albedo' ? T.SRGBColorSpace : T.NoColorSpace; tex.userData.wkShared = true; tex.name = key; cache.set(key, tex); return tex;
}
function canvasTexture(key, w, h, paint, srgb = true) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c); t.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace; t.anisotropy = anisotropy; t.userData.wkShared = true; t.name = key; cache.set(key, t); return t;
}

/* Atlas de feuillage peint (4 tuiles 256 px) : feuilles larges, petites feuilles, rameau d'aiguilles, palme.
   Couleurs claires et peu saturées : la teinte finale vient de la couleur d'instance de chaque espèce. */
function foliageAtlas() {
  return canvasTexture('nature:foliage', 512, 512, (x) => {
    const r = rng(9157); x.clearRect(0, 0, 512, 512);
    const leaf = (cx, cy, len, wid, ang, l0) => {
      x.save(); x.translate(cx, cy); x.rotate(ang);
      const g = x.createLinearGradient(0, -wid, 0, wid), l = l0 * 100;
      g.addColorStop(0, `hsl(${84 + r() * 16},${42 + r() * 18}%,${l * .78}%)`); g.addColorStop(.5, `hsl(${80 + r() * 14},${48 + r() * 14}%,${l}%)`); g.addColorStop(1, `hsl(${88 + r() * 14},${40 + r() * 16}%,${l * .7}%)`);
      x.fillStyle = g; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(len * .45, -wid, len, 0); x.quadraticCurveTo(len * .45, wid, 0, 0); x.fill();
      x.strokeStyle = `hsla(70,40%,${l * 1.1}%,.55)`; x.lineWidth = Math.max(.6, wid * .1); x.beginPath(); x.moveTo(1, 0); x.lineTo(len * .92, 0); x.stroke(); x.restore();
    };
    // Tuile 0 : grappe de feuilles larges, dense au centre et découpée au bord.
    for (let k = 0; k < 120; k++) { const a = r() * TAU, d = Math.sqrt(r()) * 96, cx = 128 + Math.cos(a) * d, cy = 128 + Math.sin(a) * d; leaf(cx, cy, 20 + r() * 20, 8 + r() * 7, a + (r() - .5) * 1.4, .56 + r() * .38); }
    // Tuile 1 : petites feuilles (olivier, acacia, cyprès, buissons).
    for (let k = 0; k < 330; k++) { const a = r() * TAU, d = Math.sqrt(r()) * 104, cx = 384 + Math.cos(a) * d, cy = 128 + Math.sin(a) * d; leaf(cx, cy, 9 + r() * 9, 3.5 + r() * 3, r() * TAU, .55 + r() * .4); }
    // Tuile 2 : rameau de conifère, tige verticale et aiguilles serrées.
    x.save(); x.translate(0, 256);
    for (let side = 0; side < 3; side++) { const ox = 128 + (side - 1) * 52, top = side === 1 ? 10 : 50;
      x.strokeStyle = 'hsl(30,30%,32%)'; x.lineWidth = 3; x.beginPath(); x.moveTo(128, 250); x.quadraticCurveTo(ox, 160, ox + (side - 1) * 10, top); x.stroke();
      for (let k = 0; k < 140; k++) { const t = r(), py = lerp(248, top, t), px = lerp(128, ox + (side - 1) * 10, Math.pow(t, .8)), len = (1 - t * .55) * (18 + r() * 12), s = r() < .5 ? -1 : 1, a = -Math.PI / 2 + s * (.7 + r() * .5);
        x.strokeStyle = `hsl(${100 + r() * 30},${30 + r() * 20}%,${38 + r() * 34}%)`; x.lineWidth = 1.6 + r() * 1.2; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len); x.stroke(); } }
    x.restore();
    // Tuile 3 : palme, nervure centrale et folioles effilées.
    x.save(); x.translate(256, 256);
    x.strokeStyle = 'hsl(60,35%,45%)'; x.lineWidth = 4; x.beginPath(); x.moveTo(128, 254); x.lineTo(128, 4); x.stroke();
    for (let k = 0; k < 64; k++) { const t = k / 64, py = 250 - t * 244, len = Math.sin(Math.min(1, t * 1.15) * Math.PI) * 112 + 10;
      for (const s of [-1, 1]) { const ex = 128 + s * len, ey = py - len * .55; const g = x.createLinearGradient(128, py, ex, ey); g.addColorStop(0, `hsl(90,45%,${48 + r() * 12}%)`); g.addColorStop(1, `hsl(${84 + r() * 18},50%,${62 + r() * 18}%)`);
        x.strokeStyle = g; x.lineWidth = 5 - t * 2.5; x.lineCap = 'round'; x.beginPath(); x.moveTo(128, py); x.quadraticCurveTo(128 + s * len * .5, py - len * .15, ex, ey); x.stroke(); } }
    x.restore();
  });
}
/* Atlas d'herbe : tuile gauche brins, tuile droite brins + fleurs colorées. */
function grassAtlas() {
  return canvasTexture('nature:grass', 512, 256, (x) => {
    const r = rng(4471); x.clearRect(0, 0, 512, 256);
    const blades = (ox, n) => { for (let k = 0; k < n; k++) { const bx = ox + 24 + r() * 208, h = 120 + r() * 126, lean = (r() - .5) * 90, w = 4 + r() * 6, l = 62 + r() * 30;
      const g = x.createLinearGradient(0, 256, 0, 256 - h); g.addColorStop(0, `hsl(${90 + r() * 10},35%,${l * .7}%)`); g.addColorStop(1, `hsl(${70 + r() * 25},${45 + r() * 20}%,${l}%)`);
      x.fillStyle = g; x.beginPath(); x.moveTo(bx - w, 256); x.quadraticCurveTo(bx + lean * .2, 256 - h * .6, bx + lean, 256 - h); x.quadraticCurveTo(bx + lean * .3, 256 - h * .5, bx + w, 256); x.fill(); } };
    blades(0, 70); blades(256, 36);
    const petals = ['#ffffff', '#ffd23a', '#ff7fb8', '#b88cff', '#ff5a4a', '#fff2a8'];
    for (let k = 0; k < 15; k++) { const fx = 290 + r() * 190, fy = 30 + r() * 120, rad = 8 + r() * 7, col = petals[k % petals.length];
      x.strokeStyle = 'hsl(100,35%,35%)'; x.lineWidth = 3; x.beginPath(); x.moveTo(fx, fy); x.lineTo(fx + (r() - .5) * 20, 256); x.stroke();
      x.fillStyle = col; for (let p = 0; p < 6; p++) { const a = p / 6 * TAU; x.beginPath(); x.ellipse(fx + Math.cos(a) * rad * .7, fy + Math.sin(a) * rad * .7, rad * .6, rad * .38, a, 0, TAU); x.fill(); }
      x.fillStyle = '#f2b01e'; x.beginPath(); x.arc(fx, fy, rad * .35, 0, TAU); x.fill(); }
  });
}

/* ---------- Biomes : couches de sol, étalonnage, espèces et densités ---------- */
const GREEN_ROCK = 'aerial_rocks_02', WARM_ROCK = 'rock_06';
const BIOMES = {
  prairie: { a: ['leafy_grass', '#79c24a', 1.75], b: ['forrest_ground_01', '#c9b27a', 1.3], r: [GREEN_ROCK, '#d6d8d0', 1.0], moss: 1,
    trees: [['oak', .55, ['#4f9a36', '#5fae3e', '#3f8a33', '#6cb845']], ['round', .3, ['#5aa23c', '#78bf4c', '#4b9438']], ['pine', .15, ['#2f6e44', '#3a7d4c']]],
    bush: ['#4f9a3a', '#63ad44', '#3f8a35'], grass: ['#6fbd45', '#86cc52', '#5aa83c', '#9ad45f'], flowers: .22, trees_n: 1100, rocks_n: 70, mtn: ['#8a9a7c', '#c8d2c0'], snowcap: 0 },
  autumn: { a: ['leafy_grass', '#b9b85a', 1.3], b: ['forest_leaves_02', '#ffb070', 1.35], r: [GREEN_ROCK, '#d8cfc0', .9], moss: .6,
    trees: [['oak', .5, ['#d9482b', '#e8762a', '#f0a531', '#c43a2a', '#e0582b']], ['round', .25, ['#f2b638', '#e88a2c', '#d95f2a']], ['pine', .25, ['#2c6340', '#356f48']]],
    bush: ['#c9622d', '#d98a34', '#a9452a'], grass: ['#a8b54e', '#c2b552', '#93a445'], flowers: .05, trees_n: 1100, rocks_n: 70, mtn: ['#8b7a68', '#c9b8a0'], snowcap: 0 },
  provence: { a: ['leafy_grass', '#a9c25e', 1.25], b: ['dry_ground_01', '#f0d6a8', 1.1], r: [WARM_ROCK, '#efe0c8', .75], moss: .3,
    trees: [['cypress', .45, ['#2f5a33', '#36653a']], ['olive', .55, ['#8aa070', '#9cb07c', '#7e9466']]],
    bush: ['#7f9a5a', '#90a86a'], grass: ['#a6bf5a', '#b8c868', '#94ae50'], flowers: .3, flowerLavender: true, keep: ['bush'], trees_n: 900, rocks_n: 60, mtn: ['#9a9a88', '#cfc8b0'], snowcap: 0 },
  alpine: { a: ['leafy_grass', '#82c25a', 1.4], b: ['forrest_ground_01', '#c8c098', 1.1], r: [GREEN_ROCK, '#d0d4d8', .95], moss: .8, high: ['snow_02', '#ffffff', 1.0],
    trees: [['pine', .8, ['#2c6a45', '#336f4a', '#28603f']], ['round', .2, ['#4f9a3a', '#5aa640']]],
    bush: ['#3f8a45', '#4f9a4a'], grass: ['#73bf4c', '#88cc58', '#64ad42'], flowers: .18, trees_n: 1200, rocks_n: 110, mtn: ['#7f8c8c', '#e8eef2'], snowcap: .55 },
  snow: { a: ['snow_02', '#f4f8ff', 1.0], b: ['snow_02', '#cfdcf2', 1.0], r: [GREEN_ROCK, '#b8c4d4', .55], moss: 0, snow: true,
    trees: [['pine', 1, ['#2a5f4a', '#2f6b52', '#25563f']]],
    bush: ['#3a6b58'], grass: null, flowers: 0, trees_n: 1000, rocks_n: 90, mtn: ['#7a879a', '#f2f6ff'], snowcap: .9 },
  safari: { a: ['sparse_grass', '#e8c060', 1.5], b: ['red_dirt_mud_01', '#f0a070', 1.2], r: [WARM_ROCK, '#f0c8a0', .9], moss: .2, patch: .18,
    trees: [['acacia', .75, ['#6f9a3a', '#7ea842', '#8aa848']], ['round', .25, ['#7a9a40', '#8fa84a']]],
    bush: ['#8a9a48', '#9aa850', '#a8a04a'], grass: ['#d8b35a', '#e6c46a', '#c9a24e', '#b8a050'], tallGrass: true, flowers: 0, trees_n: 420, rocks_n: 90, mtn: ['#b0805a', '#e0b080'], snowcap: 0 },
  jungle: { a: ['leafy_grass', '#62b444', 1.5], b: ['forest_leaves_02', '#a8b070', 1.2], r: [GREEN_ROCK, '#c8d0c0', 1.0], moss: 1,
    trees: [['jungle', .5, ['#2f8a3a', '#3a9a3e', '#257a34', '#4aa844']], ['palm', .3, ['#4f9a3a', '#5aa840']], ['oak', .2, ['#3a8a36', '#2f7a30']]],
    bush: ['#3a9a40', '#2f8a38', '#4aa848'], fern: true, grass: ['#4fa83c', '#62b848', '#3f9832'], flowers: .08, grove: .38, trees_n: 2600, rocks_n: 80, mtn: ['#4f7a5a', '#8ab08a'], snowcap: 0 },
  // Plage (Coup de Soleil) : sable dominant, herbe sèche en touffes, palmiers ; dérivée du biome tropical.
  plage: { a: ['coast_sand_01', '#fff0c8', 1.35], b: ['sparse_grass', '#c8d070', 1.3], r: [WARM_ROCK, '#f0dcc0', .85], moss: 0, sandLow: 7,
    trees: [['palm', .85, ['#4fa83a', '#5ab842', '#46a038']], ['round', .15, ['#4fa83f', '#62b848']]],
    bush: ['#7aa04a', '#8cb058'], fern: false, grass: ['#b8c060', '#c8cc70', '#a8b454'], flowers: .05, trees_n: 380, rocks_n: 70, mtn: ['#6f9a7a', '#b0c8a8'], snowcap: 0 },
  tropic: { a: ['leafy_grass', '#7cc858', 1.45], b: ['coast_sand_01', '#fff0c8', 1.35], r: [WARM_ROCK, '#f0dcc0', .85], moss: .6, sandLow: 7,
    trees: [['palm', .7, ['#4fa83a', '#5ab842', '#46a038']], ['round', .3, ['#4fa83f', '#62b848']]],
    bush: ['#4fa83f', '#5fb84a', '#3d9535'], fern: true, grass: ['#6fc04a', '#84ce56', '#5ab03e'], flowers: .2, trees_n: 650, rocks_n: 60, mtn: ['#5f8a6a', '#a0c0a0'], snowcap: 0 },
  haunted: { a: ['forest_leaves_02', '#8a7aa0', .7], b: ['burned_ground_01', '#9088a8', .8], r: [GREEN_ROCK, '#9a98b0', .5], moss: .3,
    trees: [['dead', .7, ['#4a4058', '#3e3a4a', '#5a4a3a']], ['pine', .3, ['#24363a', '#2a3a40']]],
    bush: ['#3a4a44', '#40483e'], grass: ['#58684e', '#4e5e48', '#66705a'], flowers: 0, trees_n: 900, rocks_n: 110, mtn: ['#4a4658', '#6a6478'], snowcap: 0 },
  volcano: { a: ['burned_ground_01', '#b0a098', 1.0], b: ['rock_face', '#c08060', 1.1], r: [WARM_ROCK, '#8a6a62', .6], moss: 0,
    trees: [['dead', 1, ['#2a2422', '#3a2a24']]],
    bush: ['#4a3a30'], grass: null, flowers: 0, keep: ['mountain'], trees_n: 380, rocks_n: 200, mtn: ['#3a3236', '#5a4444'], snowcap: 0 },
};
const DECOR_TO_BIOME = { beach: 'plage', festival: 'prairie', haunted: 'haunted', volcano: 'volcano', prairie: 'prairie', autumn: 'autumn', provence: 'provence', alpine: 'alpine', snow: 'snow', safari: 'safari', jungle: 'jungle', tropic: 'tropic' };
/* Géométries historiques remplacées (étiquetées par decorGeo / buildGrass9). Les objets thématiques restent. */
const REPLACED = new Set(['beachPalm', 'crown', 'crown2', 'trunk', 'bush', 'pine1', 'pine2', 'pine3', 'ptrunk', 'rock', 'hill', 'mountain', 'flower', 'drybush', 'grass9', 'scenicPeak', 'jungleTree', 'jungleCrown', 'safariCrown', 'safariTrunk', 'safariTuft', 'cypressCrown', 'oliveTrunk', 'jg-fern', 'jg-leaf', 'jg-kapok', 'jg-kapok2', 'jg-slim', 'jg-palm', 'jg-canopy', 'jg-mrock', 'palmFrond', 'palmSeg']);
/* Parcelles de biomes sur une même carte : biome secondaire sur des portions du tour (fractions de la route principale),
   transitions fluides sur `tw` (fraction du tour). Le champ est lissé dans l'espace pour que les frontières restent continues
   loin de la piste. */
const ZONES = {
  piquenique: { biome: 'autumn', spans: [[.38, .62]], name: 'Bois d’automne' },
  deuxroutes: { biome: 'prairie', spans: [[.04, .3]], name: 'Vallée verte' },
  sieste: { biome: 'prairie', spans: [[.55, .8]], name: 'Prairie de la sieste' },
  trainfou: { biome: 'snow', spans: [[.36, .62]], name: 'Col enneigé' },
  glissade: { biome: 'alpine', spans: [[.82, .08]], name: 'Vallée alpine' },
  safaribouchon: { biome: 'jungle', spans: [[.4, .58]], name: 'Oasis' },
  pinacolada: { biome: 'jungle', spans: [[.25, .5]], name: 'Jungle du lagon' },
  plongeon: { biome: 'jungle', spans: [[.15, .4]], name: 'Forêt de la baie' },
  bellemere: { biome: 'autumn', spans: [[.55, .78]], name: 'Verger lugubre' },
  barbecue: { biome: 'haunted', spans: [[.15, .35]], name: 'Forêt morte' },
  cascade: { biome: 'tropic', spans: [[.62, .85]], name: 'Lagon des chutes' },
  croisiere: { biome: 'jungle', spans: [[.3, .55]], name: 'Île sauvage' },
};
function spanWeight(f, spans, tw = .045) {
  let w = 0;
  for (const [a, b0] of spans) {
    // Portion qui passe par la ligne d'arrivée (a > b) : déroulée sur [a, b + 1], testée sur f, f ± 1.
    const b = a <= b0 ? b0 : b0 + 1;
    for (const u of [f - 1, f, f + 1]) w = Math.max(w, smooth(a - tw / 2, a + tw / 2, u) * (1 - smooth(b - tw / 2, b + tw / 2, u)));
  }
  return w;
}
function zoneField(W, zone, half) {
  const S = W.S, cx = W.bb.cx, cz = W.bb.cz, n = 96, step = 2 * half / n, field = new Float32Array((n + 1) * (n + 1)), cell = 60, grid = new Map(), R = 220;
  for (let i = 0; i < S.N; i += 3) { const k = Math.floor(S.px[i] / cell) + ',' + Math.floor(S.pz[i] / cell); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(i); }
  const wAt = new Float32Array(S.N); for (let i = 0; i < S.N; i++) wAt[i] = spanWeight(i / S.N, zone.spans);
  for (let iz = 0; iz <= n; iz++) for (let ix = 0; ix <= n; ix++) {
    const x = cx - half + ix * step, z = cz - half + iz * step, rc = Math.ceil(R / cell); let sw = 0, sk = 0, best = 1e18, bw = 0;
    for (let a = -rc; a <= rc; a++) for (let b = -rc; b <= rc; b++) { const l = grid.get((Math.floor(x / cell) + a) + ',' + (Math.floor(z / cell) + b)); if (!l) continue;
      for (const i of l) { const d2 = (S.px[i] - x) ** 2 + (S.pz[i] - z) ** 2; if (d2 < best) { best = d2; bw = wAt[i]; } if (d2 < R * R) { const k = 1 / (d2 + 900); sw += wAt[i] * k; sk += k; } } }
    field[iz * (n + 1) + ix] = sk ? sw / sk : bw;
  }
  // Deux passes de flou : lisières douces, jamais de couture nette.
  for (let pass = 0; pass < 2; pass++) { const f = field.slice(); for (let iz = 1; iz < n; iz++) for (let ix = 1; ix < n; ix++) { const q = iz * (n + 1) + ix; field[q] = (f[q] * 4 + f[q - 1] + f[q + 1] + f[q - n - 1] + f[q + n + 1]) / 8; } }
  return (x, z) => { const fx = clamp((x - cx + half) / step, 0, n - 1e-3), fz = clamp((z - cz + half) / step, 0, n - 1e-3), ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz, q = iz * (n + 1) + ix;
    return lerp(lerp(field[q], field[q + 1], tx), lerp(field[q + n + 1], field[q + n + 2], tx), tz); };
}
function zoneAttribute(geometry, field) {
  const p = geometry.attributes.position, z = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) z[i] = field(p.getX(i), p.getZ(i));
  geometry.setAttribute('wkZone', new T.BufferAttribute(z, 1));
}
function handles(W) { return !!(W && !W.def.production && W.th.terrain && DECOR_TO_BIOME[W.th.decor] && W.hAt); }

/* ---------- Construction de maillages ---------- */
class Mesher {
  constructor() { this.p = []; this.n = []; this.u = []; this.c = []; this.i = []; }
  v(p, n, u, v, c = 1) { this.p.push(p.x, p.y, p.z); this.n.push(n.x, n.y, n.z); this.u.push(u, v); this.c.push(c, c, c); return this.p.length / 3 - 1; }
  tri(a, b, c) { this.i.push(a, b, c); }
  geometry() {
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(this.u, 2)); g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3)); g.setIndex(this.i);
    g.computeBoundingBox(); g.computeBoundingSphere(); g.userData.keep = true; return g;
  }
}
const V = (x, y, z) => new T.Vector3(x, y, z);
/* Tube effilé le long d'une polyligne, repère par transport parallèle (pas de torsion). */
function tube(m, pts, radii, sides, barkScale = .55) {
  let prevN = null, len = 0; const rings = [];
  for (let k = 0; k < pts.length; k++) {
    const t = (k < pts.length - 1 ? pts[k + 1].clone().sub(pts[k]) : pts[k].clone().sub(pts[k - 1])).normalize();
    let n; if (!prevN) { n = Math.abs(t.y) < .9 ? V(0, 1, 0).cross(t).normalize() : V(1, 0, 0).cross(t).normalize(); } else { n = prevN.clone().sub(t.clone().multiplyScalar(prevN.dot(t))).normalize(); }
    prevN = n; const b = t.clone().cross(n); if (k) len += pts[k].distanceTo(pts[k - 1]);
    const ring = [], wraps = Math.max(1, Math.round(TAU * radii[0] * barkScale));
    for (let s = 0; s <= sides; s++) { const a = s / sides * TAU, dir = n.clone().multiplyScalar(Math.cos(a)).addScaledVector(b, Math.sin(a));
      ring.push(m.v(pts[k].clone().addScaledVector(dir, radii[k]), dir, s / sides * wraps, len * barkScale, .55 + .45 * Math.min(1, pts[k].y / 3))); }
    rings.push(ring);
  }
  // Sens direct vu de l'extérieur : (a, b, c) a pour normale (b − a) × (c − a) = tangente × axe = direction radiale sortante. L'ancien
  // ordre (a, c, b) tournait les faces vers l'intérieur : en simple face, on voyait l'intérieur de la moitié arrière du tronc.
  // Correction validée sur la carte de référence (Prairie, T8), généralisée à toutes les cartes du kit (T12).
  for (let k = 0; k < rings.length - 1; k++) for (let s = 0; s < sides; s++) { const a = rings[k][s], b = rings[k][s + 1], c = rings[k + 1][s], d = rings[k + 1][s + 1]; if (outward) { m.tri(a, b, c); m.tri(b, d, c); } else { m.tri(a, c, b); m.tri(b, c, d); } }
}
const TILE = [[0, .5], [.5, .5], [0, 0], [.5, 0]]; // coins UV (u0, v0) des tuiles, flipY du canvas
/* Carte de feuillage : quad orienté, normales « gonflées » depuis le centre du houppier pour un volume doux. */
function card(m, c, n, size, tile, r, center, aspect = 1, ao = 1) {
  const a = Math.abs(n.y) < .95 ? V(0, 1, 0) : V(1, 0, 0), t = a.cross(n).normalize(), b = n.clone().cross(t), rot = r() * TAU;
  const tt = t.clone().multiplyScalar(Math.cos(rot)).addScaledVector(b, Math.sin(rot)), bb = n.clone().cross(tt);
  const [u0, v0] = TILE[tile], hw = size * .5, hh = size * .5 * aspect, ids = [];
  for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const p = c.clone().addScaledVector(tt, su * hw).addScaledVector(bb, sv * hh), nn = p.clone().sub(center).normalize().lerp(n, .25).normalize();
    const shade = ao * (.62 + .38 * clamp(.5 + nn.y * .5, 0, 1));
    ids.push(m.v(p, nn, u0 + (su + 1) * .25, v0 + (sv + 1) * .25, shade));
  }
  m.tri(ids[0], ids[1], ids[2]); m.tri(ids[0], ids[2], ids[3]);
}
/* Houppier : cartes réparties sur une sphère (Fibonacci) avec profondeur aléatoire. */
function cluster(m, c, radius, count, size, tile, r, center, squash = 1) {
  for (let k = 0; k < count; k++) {
    const y = 1 - (k + .5) / count * 2, rr = Math.sqrt(1 - y * y), a = k * 2.399963 + r() * .4, dir = V(Math.cos(a) * rr, y, Math.sin(a) * rr).normalize();
    const depth = .45 + .55 * Math.sqrt(r()), p = c.clone().add(V(dir.x * radius * depth, dir.y * radius * depth * squash, dir.z * radius * depth));
    const n = dir.clone().add(V((r() - .5) * .8, (r() - .5) * .8, (r() - .5) * .8)).normalize();
    card(m, p, n, size * (.75 + r() * .5), tile, r, center, 1, .7 + .3 * depth);
  }
}
function branchPath(a, b, bend, steps = 4) { const pts = []; for (let k = 0; k <= steps; k++) { const t = k / steps; pts.push(a.clone().lerp(b, t).add(bend.clone().multiplyScalar(Math.sin(t * Math.PI)))); } return pts; }

/* Espèces : chaque générateur produit deux LOD (bois + feuillage), hauteur ~1 unité = 1 m. */
function species(kind, seed, lod) {
  const r = rng(seed), hi = lod === 0, wood = new Mesher(), leaf = new Mesher(), sides = hi ? 7 : 4, k = hi ? 1 : .26;
  if (kind === 'oak' || kind === 'round' || kind === 'jungle' || kind === 'olive') {
    const H = kind === 'jungle' ? 15 + r() * 4 : kind === 'olive' ? 5.5 + r() : kind === 'round' ? 7 + r() * 2 : 9 + r() * 2.5, r0 = H * (kind === 'olive' ? .07 : .05);
    const top = V((r() - .5) * .8, H * (kind === 'jungle' ? .72 : .5), (r() - .5) * .8);
    tube(wood, branchPath(V(0, -.6, 0), top, V((r() - .5) * .7, 0, (r() - .5) * .7), hi ? 5 : 2), [r0 * 1.35, r0 * 1.05, r0 * .9, r0 * .8, r0 * .72, r0 * .65].slice(0, hi ? 6 : 3), sides);
    const limbs = kind === 'round' ? 3 : 4 + Math.floor(r() * 2), spread = kind === 'jungle' ? H * .32 : kind === 'olive' ? H * .45 : H * .33, center = top.clone().add(V(0, H * .2, 0));
    const tips = [];
    for (let l = 0; l < limbs; l++) {
      const a = l / limbs * TAU + r() * .6, start = top.clone().lerp(V(0, 0, 0), r() * .25), end = top.clone().add(V(Math.cos(a) * spread * (.6 + r() * .4), H * (.12 + r() * .18), Math.sin(a) * spread * (.6 + r() * .4)));
      tube(wood, branchPath(start, end, V(0, H * .05, 0), hi ? 3 : 1), [r0 * .6, r0 * .45, r0 * .32, r0 * .22].slice(0, hi ? 4 : 2), hi ? 5 : 3); tips.push(end);
    }
    const tile = kind === 'olive' ? 1 : 0, cr = kind === 'jungle' ? H * .2 : kind === 'olive' ? H * .26 : H * .24, squash = kind === 'jungle' ? .55 : kind === 'olive' ? .7 : .85;
    for (const tip of tips) cluster(leaf, tip, cr * (.85 + r() * .3), Math.round(46 * k + 4), cr * (hi ? .95 : 1.55), tile, r, center, squash);
    cluster(leaf, center.clone().add(V(0, cr * .3, 0)), cr * 1.15, Math.round(60 * k + 6), cr * (hi ? 1.0 : 1.7), tile, r, center, squash);
  } else if (kind === 'pine') {
    const H = 11 + r() * 5, R = H * .26;
    tube(wood, [V(0, -.6, 0), V(0, H * .5, 0), V(0, H, 0)], [H * .035, H * .022, H * .006], sides);
    const tiers = hi ? 11 : 5;
    for (let t = 0; t < tiers; t++) {
      const f = t / (tiers - 1), y = H * (.16 + .8 * f), rad = R * Math.pow(1 - f * .92, .95) + .35, n = hi ? 10 : 7;
      for (let s = 0; s < n; s++) {
        const a = s / n * TAU + t * .7 + r() * .3, dir = V(Math.cos(a), 0, Math.sin(a)), droop = .3 + r() * .25;
        const c = V(0, y, 0).addScaledVector(dir, rad * .5).add(V(0, -rad * droop * .5, 0)), out = dir.clone().multiplyScalar(Math.cos(droop)).add(V(0, -Math.sin(droop), 0));
        // Carte du rameau : axe long dans la direction de la branche, face orientée vers le haut et inclinée.
        const up = V(0, 1, 0).addScaledVector(dir, .35).normalize().applyAxisAngle(out, (r() - .5) * .9), side = out.clone().cross(up).normalize(), ids = [], w = rad * .7 + .6, L = rad * 1.15 + .5;
        for (const [su, sv] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) {
          const p = V(0, y, 0).addScaledVector(out, sv * L).addScaledVector(side, su * w * (sv ? 1 : .35)), nn = up.clone().lerp(dir, .35).normalize();
          ids.push(leaf.v(p, nn, (su + 1) * .25, .5 - (1 - sv) * .5 + .5 * sv * 0 + (sv ? 0 : 0), .55 + .45 * f + (sv ? .1 : 0)));
        }
        // uv : tuile 2 (u 0..0.5, v 0..0.5) — base du rameau en bas de la tuile.
        const uvs = leaf.u, base = ids[0] * 2; uvs[base] = 0; uvs[base + 1] = 0; uvs[base + 2] = .5; uvs[base + 3] = 0; uvs[base + 4] = .5; uvs[base + 5] = .5; uvs[base + 6] = 0; uvs[base + 7] = .5;
        leaf.tri(ids[0], ids[1], ids[2]); leaf.tri(ids[0], ids[2], ids[3]); void c;
      }
    }
    cluster(leaf, V(0, H * .98, 0), .8, hi ? 6 : 2, 1.6, 2, r, V(0, H * .6, 0));
  } else if (kind === 'cypress') {
    const H = 10 + r() * 4;
    tube(wood, [V(0, -.5, 0), V(0, H * .5, 0), V(0, H * .8, 0)], [.32, .22, .1], sides);
    const center = V(0, H * .55, 0);
    for (let s = 0; s < (hi ? 7 : 3); s++) { const f = s / (hi ? 6 : 2), y = H * (.18 + .74 * f), rad = 1.5 * Math.sin((.15 + .85 * (1 - f * .9)) * Math.PI * .5) + .3;
      cluster(leaf, V(0, y, 0), rad, Math.round(30 * k + 5), hi ? 1.5 : 2.4, 1, r, center, 1.3); }
  } else if (kind === 'acacia') {
    const H = 7 + r() * 2.5, r0 = .32;
    const fork = V((r() - .5) * .6, H * .45, (r() - .5) * .6); tube(wood, branchPath(V(0, -.5, 0), fork, V(.3, 0, .2), hi ? 3 : 1), [r0 * 1.3, r0, r0 * .9, r0 * .8].slice(0, hi ? 4 : 2), sides);
    const center = V(0, H, 0);
    for (let l = 0; l < 4; l++) { const a = l / 4 * TAU + r() * .8, end = V(Math.cos(a) * H * .45, H * (.85 + r() * .1), Math.sin(a) * H * .45);
      tube(wood, branchPath(fork, end, V(0, .5, 0), hi ? 3 : 1), [r0 * .65, r0 * .45, r0 * .3, r0 * .2].slice(0, hi ? 4 : 2), hi ? 5 : 3);
      cluster(leaf, end.clone().add(V(0, .4, 0)), H * .3, Math.round(40 * k + 5), hi ? 2.0 : 3.2, 1, r, center, .32); }
    cluster(leaf, center.clone().add(V(0, .5, 0)), H * .32, Math.round(40 * k + 5), hi ? 2.0 : 3.2, 1, r, center, .3);
  } else if (kind === 'palm') {
    const H = 9 + r() * 4, lean = V((r() - .5) * 3, 0, (r() - .5) * 3), pts = [], rad = [], steps = hi ? 14 : 4;
    for (let s = 0; s <= steps; s++) { const t = s / steps; pts.push(V(lean.x * t * t, -.5 + H * t, lean.z * t * t)); rad.push((.32 - .1 * t) * (hi && s % 2 ? 1.12 : 1)); }
    tube(wood, pts, rad, sides, .8);
    const top = pts[pts.length - 1], fronds = hi ? 11 : 7;
    for (let f = 0; f < fronds; f++) {
      const a = f / fronds * TAU + r() * .3, dir = V(Math.cos(a), 0, Math.sin(a)), L = 4.2 + r() * 1.6, segs = hi ? 6 : 3, lift = .5 + r() * .5, prev = [];
      for (let s = 0; s <= segs; s++) {
        const t = s / segs, along = top.clone().addScaledVector(dir, L * t).add(V(0, lift * Math.sin(t * Math.PI * .8) * 1.6 - t * t * 2.4, 0)), side = V(-dir.z, 0, dir.x), w = 1.15 * Math.sin(Math.min(1, t * 1.25 + .08) * Math.PI) + .1;
        const nrm = V(0, 1, 0).addScaledVector(dir, -.2).normalize(), droopSide = V(0, -.25 * w, 0);
        prev.push([leaf.v(along.clone().addScaledVector(side, -w).add(droopSide), nrm, .5, .5 * t, .75 + .25 * t), leaf.v(along.clone().addScaledVector(side, w).add(droopSide), nrm, 1, .5 * t, .75 + .25 * t)]);
        // centre de la palme : nervure surélevée
      }
      for (let s = 0; s < segs; s++) { const [a0, b0] = prev[s], [a1, b1] = prev[s + 1]; leaf.tri(a0, b0, a1); leaf.tri(b0, b1, a1); }
    }
    // Les palmes utilisent la tuile 3 : u de 0.5 à 1, v de 0 à 0.5.
  } else if (kind === 'dead') {
    // Arbre mort tordu : tronc penché et ramification récursive sur deux niveaux, quelques feuilles résiduelles.
    const H = 7 + r() * 4, r0 = H * .055, top = V((r() - .5) * 1.5, H * .55, (r() - .5) * 1.5), center = V(0, H * .7, 0);
    tube(wood, branchPath(V(0, -.6, 0), top, V((r() - .5) * 1.2, 0, (r() - .5) * 1.2), hi ? 5 : 2), [r0 * 1.4, r0 * 1.1, r0 * .9, r0 * .8, r0 * .7, r0 * .6].slice(0, hi ? 6 : 3), sides);
    const grow = (from, dir, len, rad, depth) => {
      const end = from.clone().addScaledVector(dir, len); tube(wood, branchPath(from, end, V((r() - .5) * len * .3, len * .08, (r() - .5) * len * .3), hi ? 3 : 1), [rad, rad * .7, rad * .45, rad * .25].slice(0, hi ? 4 : 2), hi ? 5 : 3);
      if (depth > 0) for (let c = 0; c < (hi ? 3 : 2); c++) { const d = dir.clone().add(V((r() - .5) * 1.4, .25 + r() * .4, (r() - .5) * 1.4)).normalize(); grow(end, d, len * .62, rad * .55, depth - 1); }
      else if (r() < .35) cluster(leaf, end, .7, hi ? 5 : 2, hi ? .9 : 1.4, 1, r, center, .8);
    };
    for (let l = 0; l < 4; l++) { const a = l / 4 * TAU + r() * .7; grow(top, V(Math.cos(a), .55 + r() * .4, Math.sin(a)).normalize(), H * .32, r0 * .55, 2); }
    if (!leaf.i.length) cluster(leaf, top, .5, 2, .6, 1, r, center);
  } else if (kind === 'bush') {
    const center = V(0, .9, 0);
    for (let s = 0; s < (hi ? 3 : 2); s++) cluster(leaf, V((r() - .5) * 1.4, .7 + r() * .4, (r() - .5) * 1.4), 1.1 + r() * .4, Math.round(26 * k + 6), hi ? 1.1 : 1.8, s % 2, r, center, .8);
  } else if (kind === 'fern') {
    for (let f = 0; f < (hi ? 9 : 5); f++) {
      const a = f / 9 * TAU + r() * .4, dir = V(Math.cos(a), 0, Math.sin(a)), L = 1.4 + r() * .6, segs = hi ? 4 : 2, prev = [];
      for (let s = 0; s <= segs; s++) { const t = s / segs, along = dir.clone().multiplyScalar(L * t).add(V(0, .1 + Math.sin(t * Math.PI * .7) * .9 - t * t * .5, 0)), side = V(-dir.z, 0, dir.x), w = .45 * Math.sin(Math.min(1, t * 1.2 + .1) * Math.PI) + .04;
        prev.push([leaf.v(along.clone().addScaledVector(side, -w), V(0, 1, 0), .5, .5 * t, .6 + .4 * t), leaf.v(along.clone().addScaledVector(side, w), V(0, 1, 0), 1, .5 * t, .6 + .4 * t)]); }
      for (let s = 0; s < segs; s++) { const [a0, b0] = prev[s], [a1, b1] = prev[s + 1]; leaf.tri(a0, b0, a1); leaf.tri(b0, b1, a1); }
    }
  }
  const out = { wood: wood.i.length ? wood.geometry() : null, leaf: leaf.geometry() };
  out.height = out.leaf.boundingBox.max.y; out.radius = Math.max(out.leaf.boundingBox.max.x, -out.leaf.boundingBox.min.x, out.leaf.boundingBox.max.z, -out.leaf.boundingBox.min.z);
  return out;
}
const SPECIES = new Map();
let outward = true; // troncs à faces sortantes (voir tube) ; l'ancien ordre reste disponible pour comparaison (outward = false)
function speciesLods(kind, variant) { const key = kind + variant + (outward ? ':sortant' : ''); if (!SPECIES.has(key)) SPECIES.set(key, [species(kind, 1000 + variant * 7919 + kind.length * 31, 0), species(kind, 1000 + variant * 7919 + kind.length * 31, 1)]); return SPECIES.get(key); }

/* Rocher sculpté : icosaèdre subdivisé, bruit 3D continu par position (pas de fissure), base aplatie, normales soudées. */
function rockGeometry(seed, detail, shape) {
  const g = new T.IcosahedronGeometry(1, detail), p = g.attributes.position, v = new T.Vector3(), o = seed * 3.7;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const d = v.clone().normalize();
    let n = 0, a = .5, f = 1.3; for (let k = 0; k < 4; k++) { n += a * (vnoise3(d.x * f + o, d.y * f, d.z * f - o) - .5); a *= .5; f *= 2.1; }
    const facet = Math.abs(vnoise3(d.x * 2.2 + o, d.y * 2.2, d.z * 2.2) - .5) * .35;
    let r = 1 + n * .55 - facet; v.copy(d).multiplyScalar(r); v.x *= shape[0]; v.y *= shape[1]; v.z *= shape[2];
    if (v.y < -.25 * shape[1]) v.y = -.25 * shape[1] + (v.y + .25 * shape[1]) * .2;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  // Soudure des sommets coïncidents pour des normales continues.
  const map = new Map(), idx = [], pos = [];
  for (let i = 0; i < p.count; i++) { const key = Math.round(p.getX(i) * 1e4) + ',' + Math.round(p.getY(i) * 1e4) + ',' + Math.round(p.getZ(i) * 1e4); let j = map.get(key); if (j == null) { j = pos.length / 3; map.set(key, j); pos.push(p.getX(i), p.getY(i), p.getZ(i)); } idx.push(j); }
  const out = new T.BufferGeometry(); out.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); out.setIndex(idx); out.computeVertexNormals(); out.computeBoundingBox(); out.computeBoundingSphere(); out.userData.keep = true; g.dispose(); return out;
}
const ROCKS = [];
function rockSet() { if (!ROCKS.length) [[1.3, .8, 1.1], [1, .55, 1.4], [.9, 1.25, .95], [1.5, .7, 1.2]].forEach((s, k) => ROCKS.push([rockGeometry(k + 1, 4, s), rockGeometry(k + 1, 2, s)])); return ROCKS; }

/* Touffe d'herbe : trois cartes croisées, normales verticales (éclairage homogène avec le sol). */
let GRASS_GEO = null;
function grassGeometry() {
  if (GRASS_GEO) return GRASS_GEO; const m = new Mesher(), up = V(0, 1, 0);
  for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI, d = V(Math.cos(a), 0, Math.sin(a)), w = .75, h = .95, ids = [];
    for (const [su, sv] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) ids.push(m.v(d.clone().multiplyScalar(su * w).add(V(0, sv * h - .04, 0)), up, (su + 1) * .25, sv, .72 + .28 * sv));
    m.tri(ids[0], ids[1], ids[2]); m.tri(ids[0], ids[2], ids[3]); }
  GRASS_GEO = m.geometry(); return GRASS_GEO;
}

/* ---------- Matériaux ---------- */
const COMMON = `
  float wkHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float wkNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(wkHash(i),wkHash(i+vec2(1,0)),f.x),mix(wkHash(i+vec2(0,1)),wkHash(i+vec2(1,1)),f.x),f.y);}
  float wkFbm(vec2 p){return wkNoise(p)*.5+wkNoise(p*2.07+3.1)*.3+wkNoise(p*4.3-1.7)*.2;}
  vec3 wkGrade(vec3 c,vec3 tint,float sat){float l=dot(c,vec3(.299,.587,.114));return mix(mix(vec3(l),c,sat)*tint,tint*clamp(l*3.4,0.0,1.7),clamp(sat-1.0,0.0,1.0));}
  /* Anti-répétition : deux échantillons d'échelles et rotations différentes, mélangés par un bruit basse fréquence. */
  vec4 wkTex(sampler2D t,vec2 p,float m){vec2 q=mat2(.8,-.6,.6,.8)*p*.43+vec2(.37,.71);return mix(texture2D(t,p),texture2D(t,q),m);}
`;
/* Sol multicouche : couche A (base), B (taches, accotements), R (roche triplanaire sur les pentes), H (neige d'altitude). */
function terrainMaterial(B, opts = {}) {
  const A = B.a, Bb = B.b, R = B.r, Hh = B.high || B.a, B2 = opts.B2 || B;
  const mat = new T.MeshStandardMaterial({ color: '#ffffff', roughness: .92, metalness: 0, envMapIntensity: .25 });
  mat.userData.wkProduction = true; mat.userData.wkNature = true;
  const u = {
    tA: { value: texture(A[0], 'albedo') }, nA: { value: texture(A[0], 'normal') }, cA: { value: new T.Color(A[1]) }, sA: { value: A[2] },
    tB: { value: texture(Bb[0], 'albedo') }, nB: { value: texture(Bb[0], 'normal') }, cB: { value: new T.Color(Bb[1]) }, sB: { value: Bb[2] },
    tR: { value: texture(R[0], 'albedo') }, nR: { value: texture(R[0], 'normal') }, cR: { value: new T.Color(R[1]) }, sR: { value: R[2] },
    tH: { value: texture(Hh[0], 'albedo') }, cH: { value: new T.Color(Hh[1]) },
    tA2: { value: texture(B2.a[0], 'albedo') }, nA2: { value: texture(B2.a[0], 'normal') }, cA2: { value: new T.Color(B2.a[1]) }, sA2: { value: B2.a[2] },
    tB2: { value: texture(B2.b[0], 'albedo') }, cB2: { value: new T.Color(B2.b[1]) }, sB2: { value: B2.b[2] },
    tR2: { value: texture(B2.r[0], 'albedo') }, cR2: { value: new T.Color(B2.r[1]) }, sR2: { value: B2.r[2] },
    hiLevel: { value: opts.hiLevel != null ? opts.hiLevel : 1e5 }, lowLevel: { value: opts.lowLevel != null ? opts.lowLevel : -1e5 }, wkPatch: { value: opts.wkPatch != null ? opts.wkPatch : .32 },
    edge: { value: opts.edge != null ? opts.edge : 1 }, ao: { value: opts.ao != null ? opts.ao : 1 }, fogScale: { value: opts.fogScale || 1 }, rockSlope: { value: opts.rockSlope || .3 },
  };
  mat.userData.uniforms = u;
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u);
    s.vertexShader = 'attribute float wkRoad; attribute float wkZone; varying float vWkRoad; varying float vWkZone; varying vec3 vWkPos; varying vec3 vWkN;\n' + s.vertexShader.replace('#include <fog_vertex>', `#include <fog_vertex>
      vWkPos=(modelMatrix*vec4(transformed,1.0)).xyz; vWkN=normalize(mat3(modelMatrix)*objectNormal); vWkRoad=wkRoad; vWkZone=wkZone;`);
    s.fragmentShader = `uniform sampler2D tA,nA,tB,nB,tR,nR,tH,tA2,nA2,tB2,tR2; uniform vec3 cA,cB,cR,cH,cA2,cB2,cR2; uniform float sA,sB,sR,sA2,sB2,sR2,hiLevel,lowLevel,wkPatch,edge,ao,fogScale,rockSlope;
      varying float vWkRoad; varying float vWkZone; varying vec3 vWkPos; varying vec3 vWkN;\n${COMMON}\n` + s.fragmentShader
      .replace('#include <map_fragment>', `
        vec3 N0=normalize(vWkN); vec2 xz=vWkPos.xz;
        float macro=wkFbm(xz*.012), mid=wkFbm(xz*.05+7.3), m=wkNoise(xz*.021);
        vec2 uvA=xz*.16, uvB=xz*.13;
        vec4 a=wkTex(tA,uvA,m), b=wkTex(tB,uvB,m);
        /* Roche triplanaire, échelle 0,08 texel/m pour des strates lisibles sur les falaises. */
        vec3 tw=pow(abs(N0),vec3(4.0)); tw/=tw.x+tw.y+tw.z; vec3 rp=vWkPos*.075;
        vec4 rk=texture2D(tR,rp.zy)*tw.x+texture2D(tR,rp.xz)*tw.y+texture2D(tR,rp.xy)*tw.z;
        vec3 colA=wkGrade(a.rgb,cA,sA)*(.86+.28*macro)*mix(vec3(.84,.96,.86),vec3(1.1,1.04,.86),smoothstep(.3,.7,wkFbm(xz*.0045+2.0))), colB=wkGrade(b.rgb,cB,sB)*(.9+.2*mid), colR=wkGrade(rk.rgb,cR,sR)*(.9+.18*macro);
        /* Parcelle de biome secondaire : lisière irrégulière (bruit) autour de la transition calculée sur le tour. */
        float wZ=smoothstep(.3,.7,vWkZone+(mid-.5)*.35);
        if(wZ>.001){
          vec4 a2=wkTex(tA2,uvA,m), b2=wkTex(tB2,uvB,m);
          vec4 rk2=texture2D(tR2,rp.zy)*tw.x+texture2D(tR2,rp.xz)*tw.y+texture2D(tR2,rp.xy)*tw.z;
          colA=mix(colA,wkGrade(a2.rgb,cA2,sA2)*(.86+.28*macro),wZ); colB=mix(colB,wkGrade(b2.rgb,cB2,sB2)*(.9+.2*mid),wZ); colR=mix(colR,wkGrade(rk2.rgb,cR2,sR2)*(.9+.18*macro),wZ);
        }
        /* Masques : taches de sol nu, bande usée le long des barrières, sable en bas, roche sur les pentes, neige en altitude. */
        float hB=dot(colB,vec3(.33)), hA=dot(colA,vec3(.33));
        float wB=smoothstep(1.0-wkPatch,1.12-wkPatch,mid*.6+macro*.4)*.85;
        wB=max(wB,(1.0-smoothstep(1.5,7.0+mid*5.0,vWkRoad))*.8*edge);
        wB=max(wB,1.0-smoothstep(lowLevel,lowLevel+4.0,vWkPos.y+mid*3.0));
        wB=clamp(wB+(hB-hA)*.6*wB*(1.0-wB)*4.0,0.0,1.0);
        vec3 col=mix(colA,colB,wB);
        float slope=1.0-N0.y, wR=smoothstep(rockSlope,rockSlope+.16,slope+(mid-.5)*.18);
        col=mix(col,colR,wR);
        float wH=smoothstep(hiLevel,hiLevel+18.0,vWkPos.y+(mid-.5)*22.0)*(1.0-smoothstep(.45,.7,slope));
        vec3 colH=wkGrade(texture2D(tH,uvA*.7).rgb,cH,1.0)*1.08; col=mix(col,colH,wH);
        /* Occlusion douce au pied des barrières pour ancrer la route dans le paysage. */
        col*=mix(1.0,mix(.78,1.0,smoothstep(.0,3.5,vWkRoad)),ao);
        diffuseColor.rgb*=col; float wkRough=mix(mix(.95,.9,wB),.82,wR); wkRough=mix(wkRough,.55,wH);`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor=wkRough;')
      .replace('#include <normal_fragment_maps>', `{
        vec3 na=wkTex(nA,uvA,m).xyz*2.0-1.0, nb=wkTex(nB,uvB,m).xyz*2.0-1.0, nt=mix(na,nb,wB);
        if(wZ>.001) nt=mix(nt,wkTex(nA2,uvA,m).xyz*2.0-1.0,wZ);
        vec3 Nw=normalize(N0+vec3(nt.x,0.0,nt.y)*.85*(1.0-wR));
        vec3 nx=texture2D(nR,rp.zy).xyz*2.0-1.0, ny=texture2D(nR,rp.xz).xyz*2.0-1.0, nz=texture2D(nR,rp.xy).xyz*2.0-1.0;
        vec3 Nr=normalize(vec3(nx.z*sign(N0.x),nx.y,nx.x)*tw.x+vec3(ny.x,ny.z*sign(N0.y),ny.y)*tw.y+vec3(nz.x,nz.y,nz.z*sign(N0.z))*tw.z);
        Nr=normalize(N0+(Nr-vec3(sign(N0.x)*tw.x,sign(N0.y)*tw.y,sign(N0.z)*tw.z))*1.1);
        Nw=normalize(mix(Nw,Nr,wR)); normal=normalize(mat3(viewMatrix)*Nw); }`)
      .replace('#include <fog_fragment>', `#ifdef USE_FOG
        float fogFactor=smoothstep(fogNear*fogScale,fogFar*fogScale,vFogDepth); if(fogScale>1.0)fogFactor=max(fogFactor*.8,.12); gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,fogFactor);
      #endif`);
  };
  mat.customProgramCacheKey = () => 'wk-nature-terrain-v2-zones';
  return mat;
}
/* Rochers : roche triplanaire + mousse/neige sur le dessus, selon le biome. */
function rockMaterial(B) {
  const R = B.r, top = B.snow ? ['snow_02', '#f4f8ff', 1] : B.a;
  const mat = new T.MeshStandardMaterial({ color: '#ffffff', roughness: .85, metalness: 0, envMapIntensity: .3 }); mat.userData.wkProduction = true; mat.userData.wkNature = true;
  const u = { tR: { value: texture(R[0], 'albedo') }, nR: { value: texture(R[0], 'normal') }, cR: { value: new T.Color(R[1]) }, sR: { value: R[2] }, tA: { value: texture(top[0], 'albedo') }, cA: { value: new T.Color(top[1]) }, sA: { value: top[2] }, moss: { value: B.snow ? 1 : B.moss } };
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u);
    s.vertexShader = 'varying vec3 vWkPos; varying vec3 vWkN;\n' + s.vertexShader.replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\n vWkN=inverseTransformDirection(transformedNormal,viewMatrix);')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wkP=vec4(transformed,1.0);
        #ifdef USE_INSTANCING
        wkP=instanceMatrix*wkP;
        #endif
        vWkPos=(modelMatrix*wkP).xyz;`);
    s.fragmentShader = `uniform sampler2D tR,nR,tA; uniform vec3 cR,cA; uniform float sR,sA,moss; varying vec3 vWkPos; varying vec3 vWkN;\n${COMMON}\n` + s.fragmentShader
      .replace('#include <map_fragment>', `
        vec3 N0=normalize(vWkN); vec3 tw=pow(abs(N0),vec3(4.0)); tw/=tw.x+tw.y+tw.z; vec3 rp=vWkPos*.22;
        vec3 rk=(texture2D(tR,rp.zy)*tw.x+texture2D(tR,rp.xz)*tw.y+texture2D(tR,rp.xy)*tw.z).rgb;
        vec3 col=wkGrade(rk,cR,sR)*(.85+.3*wkNoise(vWkPos.xz*.4+vWkPos.y*.3));
        float top=smoothstep(.55,.85,N0.y+(wkNoise(vWkPos.xz*1.3)-.5)*.35)*moss;
        col=mix(col,wkGrade(texture2D(tA,vWkPos.xz*.25).rgb,cA,sA),top);
        diffuseColor.rgb*=col;`)
      .replace('#include <normal_fragment_maps>', `{
        vec3 nx=texture2D(nR,rp.zy).xyz*2.0-1.0, ny=texture2D(nR,rp.xz).xyz*2.0-1.0, nz=texture2D(nR,rp.xy).xyz*2.0-1.0;
        vec3 Nr=normalize(vec3(nx.z*sign(N0.x),nx.y,nx.x)*tw.x+vec3(ny.x,ny.z*sign(N0.y),ny.y)*tw.y+vec3(nz.x,nz.y,nz.z*sign(N0.z))*tw.z);
        Nr=normalize(N0+(Nr-vec3(sign(N0.x)*tw.x,sign(N0.y)*tw.y,sign(N0.z)*tw.z))*1.2); normal=normalize(mat3(viewMatrix)*Nr); }`);
  };
  mat.customProgramCacheKey = () => 'wk-nature-rock-v1'; return mat;
}
/* Feuillage : carte détourée, normales gonflées non inversées au verso, vent doux, compensation de la perte d'alpha des mipmaps. */
function foliageMaterial(time, opts = {}) {
  const mat = new T.MeshStandardMaterial({ map: foliageAtlas(), alphaTest: .5, side: T.DoubleSide, vertexColors: true, roughness: .78, metalness: 0, envMapIntensity: .35 });
  mat.userData.wkProduction = true; mat.userData.wkNature = true; const u = { wkTime: time, wkSnow: { value: opts.snow ? 1 : 0 }, wkSway: { value: opts.sway != null ? opts.sway : 1 } };
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u);
    s.vertexShader = 'uniform float wkTime, wkSway; varying float vWkUp;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      vec3 wkO=instanceMatrix[3].xyz;
      #else
      vec3 wkO=vec3(0.0);
      #endif
      float wkH=max(position.y-1.5,0.0)*.035*wkSway;
      transformed.x+=sin(wkTime*1.3+wkO.x*.11+position.y*.4)*wkH; transformed.z+=cos(wkTime*1.1+wkO.z*.13+position.x*.5)*wkH*.8;
      vWkUp=normal.y;`);
    s.fragmentShader = 'uniform float wkSnow; varying float vWkUp;\n' + s.fragmentShader
      .replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
        { vec2 sz=vec2(512.0); float lod=log2(max(length(dFdx(vMapUv*sz)),length(dFdy(vMapUv*sz)))); diffuseColor.a*=1.0+max(lod,0.0)*.28; }`)
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal=normalize(vNormal);')
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.92,.95,1.0),wkSnow*smoothstep(.35,.75,vWkUp));`)
      /* Translucidité simulée : la lumière traverse les feuilles, rendu plus lumineux et saturé. */
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance+=diffuseColor.rgb*.22;');
  };
  mat.customProgramCacheKey = () => 'wk-nature-foliage-v1'; return mat;
}
function barkMaterial(id, tint) {
  const mat = new T.MeshStandardMaterial({ map: texture(id, 'albedo'), normalMap: texture(id, 'normal'), color: tint, vertexColors: true, roughness: .9, metalness: 0, envMapIntensity: .2 });
  mat.normalScale.set(1.2, 1.2); mat.userData.wkProduction = true; mat.userData.wkNature = true; return mat;
}
function grassMaterial(time, far) {
  const mat = new T.MeshLambertMaterial({ map: grassAtlas(), alphaTest: .5, side: T.DoubleSide, vertexColors: true });
  mat.userData.wkProduction = true; mat.userData.wkNature = true; const u = { wkTime: time, wkFar: { value: far } };
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u);
    s.vertexShader = 'uniform float wkTime, wkFar; attribute float wkTile;\n' + s.vertexShader
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv.x+=wkTile*.5;\n#endif')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 wkO=(modelMatrix*instanceMatrix[3]).xyz; float wkD=distance(wkO,cameraPosition);
        transformed*=1.0-smoothstep(wkFar*.62,wkFar,wkD);
        float wkB=position.y*position.y; transformed.x+=sin(wkTime*2.1+wkO.x*.35+wkO.z*.2)*.16*wkB; transformed.z+=cos(wkTime*1.7+wkO.z*.31)*.12*wkB;`);
    s.fragmentShader = s.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal=normalize(vNormal);').replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
      { vec2 sz=vec2(512.0,256.0); float lod=log2(max(length(dFdx(vMapUv*sz)),length(dFdy(vMapUv*sz)))); diffuseColor.a*=1.0+max(lod,0.0)*.3; }`);
  };
  mat.customProgramCacheKey = () => 'wk-nature-grass-v1'; return mat;
}

/* ---------- Placement ---------- */
function samplerFor(W, sansEnvol = false) {
  const paths = [W.S, ...W.branches];
  // Distance horizontale conservative aux segments de toutes les routes (principale + branches).
  // sansEnvol : ignore les portions survolées d'un envol (pas de chaussée, donc pas de bande usée sur le fond du ravin).
  const cell = 24, grid = new Map();
  for (const P of paths) for (let i = 0; i < P.N; i++) { if (sansEnvol && P !== W.S && P.glide && P.glide[i]) continue; const k = Math.floor(P.px[i] / cell) + ',' + Math.floor(P.pz[i] / cell); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(P, i); }
  return (x, z, reach = 80) => {
    const cx = Math.floor(x / cell), cz = Math.floor(z / cell), rc = Math.ceil(reach / cell); let best = Infinity, wall = W.wallD;
    for (let a = -rc; a <= rc; a++) for (let b = -rc; b <= rc; b++) { const l = grid.get((cx + a) + ',' + (cz + b)); if (!l) continue;
      for (let k = 0; k < l.length; k += 2) { const P = l[k], i = l[k + 1], j = i + 1 < P.N ? i + 1 : P === W.S ? 0 : i, dx = P.px[j] - P.px[i], dz = P.pz[j] - P.pz[i], L = dx * dx + dz * dz;
        const t = L ? clamp(((x - P.px[i]) * dx + (z - P.pz[i]) * dz) / L, 0, 1) : 0, d = Math.hypot(x - P.px[i] - t * dx, z - P.pz[i] - t * dz) - ((P.wallD || W.wallD) - W.wallD);
        if (d < best) { best = d; wall = P.wallD || W.wallD; } } }
    return best === Infinity ? 1e9 : best;
  };
}
function groundHeight(W, x, z, r) { // minimum sur l'empreinte : la base n'est jamais suspendue au-dessus d'une pente
  let y = W.hAt(x, z); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; y = Math.min(y, W.hAt(x + Math.cos(a) * r, z + Math.sin(a) * r)); } return y;
}
function slopeAt(W, x, z) { const e = 1.5, dx = W.hAt(x + e, z) - W.hAt(x - e, z), dz = W.hAt(x, z + e) - W.hAt(x, z - e); return Math.hypot(dx, dz) / (2 * e); }

/* Grille d'occupation : sphères englobantes des objets conservés (bâtiments, tribunes, panneaux, objets thématiques).
   Les maillages très étendus (route, terrain, barrières) sont ignorés : leur emprise est traitée par la distance à la route. */
function occupancy(W, hidden) {
  const cell = 16, grid = new Map(), skip = new Set(hidden), sphere = new T.Sphere(), m = new T.Matrix4();
  const add = (c, r) => { for (let a = Math.floor((c.x - r) / cell); a <= Math.floor((c.x + r) / cell); a++) for (let b = Math.floor((c.z - r) / cell); b <= Math.floor((c.z + r) / cell); b++) { const k = a + ',' + b; let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(c.x, c.z, r); } };
  W.scene.updateMatrixWorld(true);
  W.scene.traverse((o) => {
    if (!o.isMesh || skip.has(o) || o === W.terrain || o.userData.wkNature || !o.visible) return;
    const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); const r0 = g.boundingSphere.radius;
    if (o.isInstancedMesh) { for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); m.premultiply(o.matrixWorld); sphere.copy(g.boundingSphere).applyMatrix4(m); if (sphere.radius < 45) add(sphere.center, sphere.radius); } }
    else { sphere.copy(g.boundingSphere).applyMatrix4(o.matrixWorld); if (sphere.radius < 45 && r0 > 0) add(sphere.center, sphere.radius); }
  });
  return (x, z, r) => { const l = grid.get(Math.floor(x / cell) + ',' + Math.floor(z / cell)); if (!l) return false; for (let k = 0; k < l.length; k += 3) if ((l[k] - x) ** 2 + (l[k + 1] - z) ** 2 < (l[k + 2] + r) ** 2) return true; return false; };
}

/* ---------- Gestion LOD + culling par instances (compaction dynamique) ---------- */
const _m = new T.Matrix4(), _q = new T.Quaternion(), _s = new T.Vector3(), _p = new T.Vector3(), _e = new T.Euler(), _vp = new T.Matrix4(), _fr = new T.Frustum(), _sph = new T.Sphere();
class Population {
  constructor(name, lods, items, lodDist, maxDist, castShadow) {
    // lods : [{ meshes: [InstancedMesh…] }] ; items : { x,y,z,s,r,color }
    this.name = name; this.lods = lods; this.items = items; this.lodDist = lodDist; this.maxDist = maxDist; this.castShadow = castShadow;
    this.mats = new Float32Array(items.length * 16); this.cols = new Float32Array(items.length * 3); this.rad = new Float32Array(items.length);
    items.forEach((it, i) => { _e.set(it.tx || 0, it.r, it.tz || 0); _q.setFromEuler(_e); _s.set(it.sx || it.s, it.sy || it.s, it.sz || it.s); _p.set(it.x, it.y, it.z); _m.compose(_p, _q, _s); _m.toArray(this.mats, i * 16);
      const c = it.color || [1, 1, 1]; this.cols.set(c, i * 3); this.rad[i] = it.bound * Math.max(_s.x, _s.y, _s.z); });
    this.last = null;
  }
  update(cam, force) {
    const p = cam.position; if (!force && this.last && this.last.distanceToSquared(p) < 1 && this.lastQ.angleTo(cam.quaternion) < .02) return;
    this.last = (this.last || new T.Vector3()).copy(p); this.lastQ = (this.lastQ || new T.Quaternion()).copy(cam.quaternion);
    const counts = this.lods.map(() => 0), it = this.items, ld2 = this.lodDist * this.lodDist, md2 = this.maxDist * this.maxDist;
    for (let i = 0; i < it.length; i++) {
      const dx = it[i].x - p.x, dz = it[i].z - p.z, dy = it[i].y - p.y, d2 = dx * dx + dz * dz + dy * dy; if (d2 > md2) continue;
      _sph.center.set(it[i].x, it[i].y + this.rad[i] * .5, it[i].z); _sph.radius = this.rad[i]; if (!_fr.intersectsSphere(_sph)) continue;
      const l = this.lods.length > 1 && d2 > ld2 ? 1 : 0, n = counts[l]++;
      for (const mesh of this.lods[l].meshes) { mesh.instanceMatrix.array.set(this.mats.subarray(i * 16, i * 16 + 16), n * 16); if (mesh.instanceColor) mesh.instanceColor.array.set(this.cols.subarray(i * 3, i * 3 + 3), n * 3); }
    }
    this.lods.forEach((L, l) => { for (const mesh of L.meshes) { mesh.count = counts[l]; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; } });
    this.visible = counts;
  }
}
function instancedMesh(geo, mat, n, color, shadow) {
  const m = new T.InstancedMesh(geo, mat, Math.max(1, n)); m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(T.DynamicDrawUsage);
  if (color) { m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(Math.max(1, n) * 3).fill(1), 3); m.instanceColor.setUsage(T.DynamicDrawUsage); }
  m.castShadow = !!shadow; m.receiveShadow = true; m.userData.wkNature = true; return m;
}

/* ---------- Construction d'un circuit ---------- */
// Construction par étapes (yield entre les étapes) : au démarrage du jeu, exécutée par tranches pour garder l'animation fluide.
function build(W, quality, renderer) { const g = buildSteps(W, quality, renderer); for (;;) { const r = g.next(); if (r.done) return r.value; } }
function* buildSteps(W, quality, renderer) {
  if (!handles(W)) return null;
  mobile = quality === 'low' || !!(root.matchMedia && root.matchMedia('(pointer:coarse)').matches); // 512 px sur écran tactile (Claude 2, ticket #27 : démarrage Samsung) anisotropy = Math.min(8, renderer && renderer.capabilities ? renderer.capabilities.getMaxAnisotropy() : 4);
  const biomeId = DECOR_TO_BIOME[W.th.decor], B = BIOMES[biomeId], q = quality === 'low' ? .4 : quality === 'medium' ? .75 : 1, R = rng(((W.th.terrain.seed || 17) * 7919 + W.def.id.length * 131) >>> 0);
  const group = new T.Group(); group.name = 'Kit Nature — ' + biomeId; group.userData.wkNature = true; W.scene.add(group);
  const low = quality === 'low', time = { value: 0 }, state = { low, group, biome: biomeId, time, pops: [], grassCells: [], hidden: [], stats: {} };
  W.nature = state;
  // 1. Masquer les anciens décors remplacés (aucune collision associée).
  W.scene.traverse((o) => { const tag = o.isInstancedMesh && (o.geometry.userData.wkDecorName || (o.geometry.userData.wkScenicPeak ? 'scenicPeak' : ''));
    // Reliefs conservés (volcans…) : même roche PBR que le reste du biome.
    if (tag === 'mountain' && (B.keep || []).includes(tag) && !o.userData.wkNature) { const old = o.material; o.material = rockMaterial(B); o.userData.wkNatureSkin = true; if (old !== o.material && !old.userData.keep) old.dispose(); }
    if (tag && !o.userData.wkNature && REPLACED.has(tag) && !(B.keep || []).includes(tag)) { o.visible = false; o.userData.wkReplaced = true; state.hidden.push(o); } });
  const dist = samplerFor(W), wallD = W.wallD, bb = W.bb, half = bb.ext + 520, cx = bb.cx, cz = bb.cz;
  const inTerrain = (x, z, m = 8) => Math.abs(x - cx) < half - m && Math.abs(z - cz) < half - m;
  // Parcelles de biomes : champ de zone lissé (0 = biome principal, 1 = biome secondaire) et tirage pondéré par objet.
  const Z = ZONES[W.def.id], B2 = Z && BIOMES[Z.biome], zf0 = B2 ? zoneField(W, Z, half) : () => 0;
  // Cartes à massif (specials.massifs) : la parcelle de vallée ne monte pas sur les sommets (fondu entre +50 et +100 m au-dessus de
  // la route la plus basse) ; sans massif, comportement inchangé.
  let yLow = Infinity; if (W.def.massifs && W.def.massifs.length) for (let i = 0; i < W.S.N; i += 4) yLow = Math.min(yLow, W.S.py[i]);
  const zf = isFinite(yLow) && W.hAt ? (x, z) => { const v = zf0(x, z); if (!v) return v; const y = W.hAt(x, z); return v * (1 - clamp((y - yLow - 50) / 50, 0, 1)); } : zf0;
  const biomeAt = (x, z) => (B2 && R() < zf(x, z) ? [B2, Z.biome] : [B, biomeId]);
  let wAvg = 0; if (B2) { for (let i = 0; i < W.S.N; i++) wAvg += spanWeight(i / W.S.N, Z.spans); wAvg /= W.S.N; }
  state.zone = Z ? { biome: Z.biome, name: Z.name, spans: Z.spans, share: +wAvg.toFixed(2), field: zf } : null;
  const occupied = occupancy(W, state.hidden);
  const blocked = (x, z, r = 2) => (W.waterX != null && x > W.waterX - 10) || (W.inPond && W.inPond(x, z)) || (W.noDecor && W.noDecor.some(n => (n.x - x) ** 2 + (n.z - z) ** 2 < n.r * n.r)) || occupied(x, z, r);
  yield;
  // 2. Terrain : nouveau matériau + distance à la route par sommet (bande usée, occlusion au pied des murs).
  if (W.terrain) {
    const g = W.terrain.geometry, p = g.attributes.position, road = new Float32Array(p.count);
    const distSol = samplerFor(W, true); for (let i = 0; i < p.count; i++) road[i] = clamp(distSol(p.getX(i), p.getZ(i), 40) - wallD, 0, 60);
    g.setAttribute('wkRoad', new T.BufferAttribute(road, 1)); zoneAttribute(g, zf);
    const hi = B.high ? (W.terrainMin || 0) + (W.th.terrain.h || 60) * .75 : 1e5, low = B.sandLow != null ? (W.terrainMin || 0) + B.sandLow : -1e5;
    const old = W.terrain.material; W.terrain.material = terrainMaterial(B, { B2, patch: B.patch, hiLevel: hi, lowLevel: low, rockSlope: biomeId === 'snow' ? .38 : .3 });
    if (W.roles) { W.roles.delete(old); W.roles.set(W.terrain.material, 'terrain'); } if (old.map && !old.map.userData.wkShared) old.map.dispose(); old.dispose();
    state.terrainMat = W.terrain.material;
  }
  // 2b. Bas-côtés (entre vibreur et barrière, talus extérieurs) : même sol PBR, sans bande usée ni occlusion.
  if (W.roles) {
    const olds = new Set([...W.roles].filter(([, role]) => role === 'shoulder').map(([m]) => m)), sm = terrainMaterial(B, { B2, edge: 0, ao: 0, hiLevel: 1e5, lowLevel: -1e5 });
    let used = false; W.scene.traverse((o) => { if (o.isMesh && olds.has(o.material)) { o.material = sm; used = true; if (B2) zoneAttribute(o.geometry, zf); } });
    if (used) { for (const m of olds) { W.roles.delete(m); if (m.map && !m.map.userData.wkShared) m.map.dispose(); m.dispose(); } W.roles.set(sm, 'shoulder'); } else sm.dispose();
  }
  yield;
  // 3. Montagnes d'horizon : anneau continu, même shader que le sol, brouillard atténué (perspective aérienne).
  {
    // Rayon intérieur au-delà du point de route le plus éloigné du centre (la boîte englobante ne suffit pas aux circuits étirés).
    let reach = 0; for (const P of [W.S, ...W.branches]) for (let i = 0; i < P.N; i++) reach = Math.max(reach, Math.hypot(P.px[i] - cx, P.pz[i] - cz));
    let topY = -1e9; for (const P of [W.S, ...W.branches]) for (let i = 0; i < P.N; i++) topY = Math.max(topY, P.py[i]);
    const R0 = Math.max(bb.ext + 330, reach + 260), R1 = Math.max(R0 + 500, Math.min(R0 + 820, 1750)), radial = quality === 'low' ? 26 : 44, ang = quality === 'low' ? 180 : 320, pos = [], idx = [], road = [];
    const baseH = (x, z) => W.hAt(clamp(x, cx - half + 2, cx + half - 2), clamp(z, cz - half + 2, cz + half - 2));
    const seed = (W.th.terrain.seed || 17) + 500, sharp = biomeId === 'alpine' || biomeId === 'snow' || biomeId === 'volcano', H = biomeId === 'alpine' || biomeId === 'snow' ? 300 : biomeId === 'safari' || biomeId === 'tropic' ? 110 : 125;
    for (let j = 0; j <= radial; j++) for (let i = 0; i < ang; i++) {
      const t = j / radial, r = lerp(R0, R1, t), a = i / ang * TAU, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      let env = smooth(0, .32, t) * (1 - smooth(.85, 1, t) * .6);
      if (W.waterX != null) env *= 1 - smooth(W.waterX - 250, W.waterX + 50, x);
      const u = Math.cos(a) * 3.2, v = Math.sin(a) * 3.2, big = fbm(u * .45 + 9, v * .45 - 4, seed + 3, 3);
      // Crêtes acérées pour les massifs froids ; collines arrondies et étagées pour les biomes tempérés.
      const shape = sharp ? Math.pow(1 - Math.abs(fbm(u + t * 2.2, v + t * 2.2, seed, 5) * 2 - 1), 1.6) : Math.pow(fbm(u * 1.3 + t * 1.6, v * 1.3 + t * 1.6, seed, 4), 1.3) * 1.25;
      const h = baseH(x, z) - 6 + env * H * (.25 + .9 * shape * (.45 + .8 * big));
      // Plafond doux : sommet ≤ route la plus haute + 0,28 × distance au-delà du tracé (pas de mur qui bouche le ciel).
      const cap = topY + 30 + (r - reach) * .28, kk = 18, hc = -kk * Math.log(Math.exp(-h / kk) + Math.exp(-cap / kk));
      pos.push(x, Number.isFinite(hc) ? hc : Math.min(h, cap), z); road.push(60);
      if (j < radial) { const a0 = j * ang + i, b0 = j * ang + (i + 1) % ang, c0 = a0 + ang, d0 = b0 + ang; idx.push(a0, b0, c0, b0, d0, c0); /* faces orientées vers le haut (normales +Y) */ }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('wkRoad', new T.Float32BufferAttribute(road, 1)); g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere(); zoneAttribute(g, zf);
    const mtnTop = (W.terrainMin || 0) + H * .55;
    const mat = terrainMaterial(B, { B2, hiLevel: B.snowcap ? lerp(mtnTop + 120, mtnTop - 40, B.snowcap) : 1e5, lowLevel: -1e5, fogScale: 1.75, edge: 0, rockSlope: sharp ? .34 : .7 });
    const mesh = new T.Mesh(g, mat); mesh.name = 'Montagnes d\'horizon'; mesh.receiveShadow = false; group.add(mesh); state.mountains = mesh;
    W.farNeed = reach + R1 + 150; // depuis le point de route le plus éloigné, le bord opposé de la couronne doit rester dans le champ
  }
  yield;
  // 4. Arbres : bosquets denses et clairières (bruit de répartition), espèces pondérées par biome.
  const trees = new Map(); // espèce → items
  const pick = (list) => { let x = R() * list.reduce((s, e) => s + e[1], 0); for (const e of list) { x -= e[1]; if (x <= 0) return e; } return list[0]; };
  const maxN = Math.max(B.trees_n, B2 ? B2.trees_n : 0), nTrees = Math.round(lerp(B.trees_n, B2 ? B2.trees_n : B.trees_n, wAvg) * q), seedN = (W.th.terrain.seed || 17) + 77; let guard = 0, placed = 0;
  while (placed < nTrees && guard++ < nTrees * 40) {
    const x = cx + (R() * 2 - 1) * (bb.ext + 330), z = cz + (R() * 2 - 1) * (bb.ext + 330); if (!inTerrain(x, z, 30) || blocked(x, z)) continue;
    const d = dist(x, z, 60) - wallD; if (d < 5) continue;
    const [Bz, bzId] = biomeAt(x, z); if (R() > Bz.trees_n / maxN) continue;
    const grove = fbm(x * .006, z * .006, seedN, 3), near = d < 40 ? .2 : 0; if (grove + near < (Bz.grove != null ? Bz.grove : .5) + R() * .12) continue;
    if (slopeAt(W, x, z) > .55) continue;
    const sp = pick(Bz.trees), kind = sp[0], variant = Math.floor(R() * 3), lods = speciesLods(kind, variant), s = .8 + R() * .5;
    // Garde-fou : couronne hors de l'enveloppe roulable (route, accotements, barrières).
    if (d < lods[0].radius * s + 3 || blocked(x, z, lods[0].radius * s * .7)) continue;
    const y = groundHeight(W, x, z, .6) - .15, col = new T.Color(sp[2][Math.floor(R() * sp[2].length)]).offsetHSL((R() - .5) * .03, (R() - .5) * .08, (R() - .5) * .08);
    const key = bzId + ':' + kind + variant; if (!trees.has(key)) trees.set(key, { kind, lods, items: [], snow: !!Bz.snow });
    trees.get(key).items.push({ x, y, z, s, r: R() * TAU, color: [col.r, col.g, col.b], bound: Math.max(lods[0].height, lods[0].radius) }); placed++;
  }
  // Buissons et fougères près des routes : premier plan visible depuis la caméra du kart.
  const shrubs = [];
  for (let k = 0, n = Math.round(700 * q); k < n; k++) {
    const i = Math.floor(R() * W.S.N), side = R() < .5 ? -1 : 1, off = wallD + 2.2 + Math.pow(R(), 1.6) * 45, x = W.S.px[i] + W.S.rx[i] * side * off + (R() - .5) * 4, z = W.S.pz[i] + W.S.rz[i] * side * off + (R() - .5) * 4;
    if (!inTerrain(x, z) || blocked(x, z) || W.S.glide[i] || dist(x, z, 30) - wallD < 2.2) continue;
    const [Bz, bzId] = biomeAt(x, z), kind = Bz.fern && R() < .45 ? 'fern' : 'bush', lods = speciesLods(kind, Math.floor(R() * 2)), s = kind === 'fern' ? .9 + R() * .6 : .55 + R() * .6;
    if (dist(x, z, 30) - wallD < lods[0].radius * s + .8) continue;
    const pal = kind === 'fern' ? ['#3f9a3a', '#4aa844', '#2f8a34'] : Bz.bush, col = new T.Color(pal[Math.floor(R() * pal.length)]).offsetHSL(0, 0, (R() - .5) * .08);
    const key = kind + lods.length + (shrubs.length % 2); void key;
    const tk = 'shrub-' + kind + (Bz.snow ? '-neige' : ''); if (!trees.has(tk)) trees.set(tk, { kind, lods, items: [], snow: !!Bz.snow }); void bzId;
    trees.get(tk).items.push({ x, y: groundHeight(W, x, z, .4) - .1, z, s, r: R() * TAU, color: [col.r, col.g, col.b], bound: 2.4 }); shrubs.push(1);
  }
  const leafMats = {}, leafFor = (snow) => leafMats[snow] || (leafMats[snow] = foliageMaterial(time, { snow })), barkByKind = { dead: barkMaterial('bark_brown_02', biomeId === 'volcano' ? '#4a3a34' : '#8a8090'), palm: barkMaterial('pine_bark', '#d8c0a0'), pine: barkMaterial('pine_bark', '#c09080'), other: barkMaterial('bark_brown_02', '#e0d0c0') };
  const shadow = quality === 'high'; let treeCount = 0;
  for (const [key, T0] of trees) {
    const n = T0.items.length; treeCount += n; const lods = T0.lods.map((L) => { const meshes = [];
      if (L.wood) meshes.push(instancedMesh(L.wood, barkByKind[T0.kind] || barkByKind.other, n, false, shadow));
      meshes.push(instancedMesh(L.leaf, leafFor(!!T0.snow), n, true, shadow)); meshes.forEach(m => { m.name = 'Nature ' + key; group.add(m); }); return { meshes }; });
    state.pops.push(new Population(key, lods, T0.items, (key.startsWith('shrub') ? 70 : 140) * (low ? .6 : 1), (key.startsWith('shrub') ? 260 : 1500) * (low ? .45 : 1), shadow));
  }
  yield;
  // 5. Rochers : quatre silhouettes, ancrés (enfoncés de 25 %) et orientés au hasard, hors des zones roulables.
  const rocks = rockSet(), rockItems = new Map(), rmats = {}, rockCount = () => [...rockItems.values()].reduce((s, l) => s + l.length, 0);
  for (let k = 0, n = Math.round(lerp(B.rocks_n, B2 ? B2.rocks_n : B.rocks_n, wAvg) * q); k < n * 30 && rockCount() < n; k++) {
    const x = cx + (R() * 2 - 1) * (bb.ext + 300), z = cz + (R() * 2 - 1) * (bb.ext + 300); if (!inTerrain(x, z, 20) || blocked(x, z)) continue;
    const s = R() < .2 ? 3 + R() * 4 : .8 + R() * 1.8, d = dist(x, z, 60) - wallD, v = Math.floor(R() * rocks.length), sx = s * (.8 + R() * .5), sz = s * (.8 + R() * .5), rb = rocks[v][0].boundingBox, rr = Math.max(rb.max.x, -rb.min.x, rb.max.z, -rb.min.z) * Math.max(sx, sz);
    if (d < rr + 2) continue;
    if (blocked(x, z, rr)) continue;
    if (slopeAt(W, x, z) > .55) continue;
    const [Bz, bzId] = biomeAt(x, z); if (!rmats[bzId]) rmats[bzId] = rockMaterial(Bz); const rk = bzId + ':' + v; if (!rockItems.has(rk)) rockItems.set(rk, []);
    rockItems.get(rk).push({ x, y: groundHeight(W, x, z, rr * .3), z, s, sx, sy: s * (.7 + R() * .5), sz, r: R() * TAU, tx: (R() - .5) * .3, tz: (R() - .5) * .3, bound: 1.6 });
  }
  for (const [rk, list] of rockItems) { const [bz, v] = rk.split(':'), pair = rocks[+v], lods = pair.map(g => ({ meshes: [instancedMesh(g, rmats[bz], list.length, false, shadow)] })); lods.forEach(L => L.meshes.forEach(m => { m.name = 'Nature rocher ' + rk; group.add(m); }));
    state.pops.push(new Population('rock' + rk, lods, list, low ? 50 : 90, low ? 600 : 1500, shadow)); }
  yield;
  // 6. Herbe et fleurs : cellules spatiales statiques (culling par cellule), disparition progressive avant 95 m.
  let grassN = 0;
  if (B.grass || (B2 && B2.grass)) {
    const gmat = grassMaterial(time, low ? 60 : 95), ggeo = grassGeometry(), cell = 48, cells = new Map(), target = Math.round(42000 * (low ? .22 : q) * (B.tallGrass ? .8 : 1));
    for (let k = 0, tries = 0; k < target && tries < target * 3; tries++) {
      const i = Math.floor(R() * W.S.N), side = R() < .5 ? -1 : 1, off = wallD + .6 + Math.pow(R(), 1.9) * 62, j = (i + Math.floor((R() - .5) * 4) + W.S.N) % W.S.N;
      const x = W.S.px[j] + W.S.rx[j] * side * off + (R() - .5) * 3, z = W.S.pz[j] + W.S.rz[j] * side * off + (R() - .5) * 3;
      if (W.S.glide[j] || !inTerrain(x, z) || blocked(x, z)) continue; const d = dist(x, z, 20) - wallD; if (d < .5) continue;
      if (slopeAt(W, x, z) > .9) continue;
      const [Bg] = biomeAt(x, z); if (!Bg.grass) continue;
      const flower = R() < Bg.flowers * (fbm(x * .02, z * .02, 91, 2) > .5 ? 1.6 : .4), col = flower ? (Bg.flowerLavender && R() < .7 ? new T.Color('#b9a0ff') : new T.Color('#ffffff')) : new T.Color(Bg.grass[Math.floor(R() * Bg.grass.length)]).offsetHSL((R() - .5) * .02, 0, (R() - .5) * .1);
      const s = (Bg.tallGrass ? 1.3 + R() * .9 : .75 + R() * .6) * (d < 6 ? .8 : 1), key = Math.floor(x / cell) + ',' + Math.floor(z / cell);
      let c = cells.get(key); if (!c) cells.set(key, c = []); c.push({ x, y: W.hAt(x, z) - .05, z, s, sy: s * (Bg.tallGrass ? 1.35 : 1), r: R() * TAU, col, tile: flower ? 1 : 0 }); k++;
    }
    for (const [key, list] of cells) {
      const m = new T.InstancedMesh(ggeo, gmat, list.length), tiles = new Float32Array(list.length);
      list.forEach((it, i) => { _e.set(0, it.r, 0); _q.setFromEuler(_e); _s.set(it.s, it.sy, it.s); _p.set(it.x, it.y, it.z); _m.compose(_p, _q, _s); m.setMatrixAt(i, _m); m.setColorAt(i, it.col); tiles[i] = it.tile; });
      // Copie privée de la géométrie partagée : l'attribut d'instance wkTile appartient à cette cellule.
      const g = ggeo.clone(); g.setAttribute('wkTile', new T.InstancedBufferAttribute(tiles, 1)); g.userData.keep = false; m.geometry = g;
      m.computeBoundingSphere(); m.receiveShadow = true; m.userData.wkNature = true; m.name = 'Nature herbe ' + key; group.add(m); state.grassCells.push(m); grassN += list.length;
    }
  }
  state.stats = { biome: biomeId, trees: treeCount, rocks: rockCount(), grass: grassN, zone: state.zone ? state.zone.name + ' (' + state.zone.biome + ', ' + Math.round(state.zone.share * 100) + ' % du tour)' : null, grassCells: state.grassCells.length, hiddenLegacy: state.hidden.length, populations: state.pops.length };
  yield;
  // 7. Mise à jour par image : temps du vent, culling et LOD des populations.
  const prev = W.scene.onBeforeRender;
  W.scene.onBeforeRender = function (renderer2, scene, camera, ...rest) {
    if (prev) prev.call(this, renderer2, scene, camera, ...rest);
    if (!camera || !camera.isPerspectiveCamera) { update(W, camera, true); return; }
    update(W, camera, false);
  };
  return state;
}
let clockStart = 0;
function update(W, camera, force) {
  const st = W.nature; if (!st || !camera) return;
  if (!clockStart) clockStart = performance.now(); st.time.value = (performance.now() - clockStart) / 1000;
  camera.updateMatrixWorld(); _vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _fr.setFromProjectionMatrix(_vp);
  // Vues aériennes / orthographiques du banc : tout afficher au LOD bas.
  if (!camera.isPerspectiveCamera || force) for (const p of st.pops) { const saved = [p.lodDist, p.maxDist]; if (!camera.isPerspectiveCamera) { p.lodDist = 0; p.maxDist = 1e6; } p.update(camera, true); [p.lodDist, p.maxDist] = saved; p.last = null; }
  else for (const p of st.pops) p.update(camera, false);
  for (const c of st.grassCells) c.visible = !camera.isPerspectiveCamera || camera.position.distanceTo(c.boundingSphere.center) < (st.low ? 60 : 95) + c.boundingSphere.radius;
}
/* Audit de placement : distance exacte (segment par segment, toutes routes) entre chaque objet et l'enveloppe roulable,
   ancrage au sol (flottant / enfoui). Indépendant de la fonction de placement, pour pouvoir la contredire. */
function audit(W, extra = []) {
  const st = W.nature; if (!st) return null;
  const paths = [W.S, ...W.branches], cell = 32, grid = new Map();
  for (const P of paths) for (let i = 0; i < P.N; i++) { const j = i + 1 < P.N ? i + 1 : P === W.S ? 0 : i; const x0 = Math.min(P.px[i], P.px[j]), x1 = Math.max(P.px[i], P.px[j]), z0 = Math.min(P.pz[i], P.pz[j]), z1 = Math.max(P.pz[i], P.pz[j]);
    for (let a = Math.floor(x0 / cell); a <= Math.floor(x1 / cell); a++) for (let b = Math.floor(z0 / cell); b <= Math.floor(z1 / cell); b++) { const k = a + ',' + b; let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(P, i, j); } }
  const clearance = (x, z, reach) => { let best = Infinity; const rc = Math.ceil(reach / cell);
    for (let a = -rc; a <= rc; a++) for (let b = -rc; b <= rc; b++) { const l = grid.get((Math.floor(x / cell) + a) + ',' + (Math.floor(z / cell) + b)); if (!l) continue;
      for (let k = 0; k < l.length; k += 3) { const P = l[k], i = l[k + 1], j = l[k + 2], dx = P.px[j] - P.px[i], dz = P.pz[j] - P.pz[i], L = dx * dx + dz * dz, t = L ? clamp(((x - P.px[i]) * dx + (z - P.pz[i]) * dz) / L, 0, 1) : 0;
        best = Math.min(best, Math.hypot(x - P.px[i] - t * dx, z - P.pz[i] - t * dz) - (P.wallD || W.wallD)); } }
    return best; };
  const out = { checked: 0, intrusions: [], floating: [], buried: [], submerged: [], minMargin: Infinity };
  const check = (kind, x, y, z, radius, height) => {
    out.checked++; const m = clearance(x, z, radius + 40) - radius; out.minMargin = Math.min(out.minMargin, m);
    if (m < 0) out.intrusions.push({ kind, position: [x, y, z], margin: +m.toFixed(2) });
    const g = W.hAt(x, z); if (y - g > .35) out.floating.push({ kind, position: [x, y, z], gap: +(y - g).toFixed(2) });
    if (g - y > Math.max(.6, height * .45)) out.buried.push({ kind, position: [x, y, z], depth: +(g - y).toFixed(2) });
    // Pied sous la surface d'un étang (option de carte « pond ») : arbre ou rocher planté dans l'eau.
    if (W.inPond && W.inPond(x, z)) out.submerged.push({ kind, position: [x, y, z], depth: +(W.pond.level - g).toFixed(2) });
  };
  for (const p of st.pops) { const L = p.lods[0].meshes[p.lods[0].meshes.length - 1].geometry; L.computeBoundingBox(); const bb = L.boundingBox, r0 = Math.max(bb.max.x, -bb.min.x, bb.max.z, -bb.min.z), h0 = bb.max.y;
    for (const it of p.items) { const s = Math.max(it.sx || it.s, it.sz || it.s); check(p.name, it.x, it.y, it.z, r0 * s, h0 * (it.sy || it.s)); } }
  const m4 = new T.Matrix4(), v = new T.Vector3();
  for (const c of st.grassCells) for (let i = 0; i < c.count; i++) { c.getMatrixAt(i, m4); v.setFromMatrixPosition(m4); check('herbe', v.x, v.y, v.z, .2, 1); }
  for (const e of extra) check(e.kind, e.x, e.y, e.z, e.r, e.h);
  out.minMargin = +out.minMargin.toFixed(2); for (const k of ['intrusions', 'floating', 'buried', 'submerged']) { out[k + 'Count'] = out[k].length; out[k] = out[k].slice(0, 20); }
  return out;
}
function stats(W) { const st = W && W.nature; if (!st) return null; return Object.assign({}, st.stats, { visible: st.pops.map(p => [p.name, p.visible]) }); }
root.WKNature = { handles, build, buildSteps, update, stats, audit, ready: () => Promise.all(pending), errors, BIOMES, species, rockGeometry };
})(window);
