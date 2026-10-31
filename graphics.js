/* Wild Kart — rendu amélioré. Aucune donnée de collision ou de course n'est modifiée. */
(function () {
'use strict';
const T = window.THREE, TAU = Math.PI * 2;
const textures = new Map(), geometries = new Map();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function random(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
function noise(period, seed) {
  const rng = random(seed), values = new Float32Array(period * period); for (let i = 0; i < values.length; i++) values[i] = rng();
  return (u, v) => { const x = u * period, y = v * period, ix = Math.floor(x), iy = Math.floor(y), a = ((ix % period) + period) % period, b = ((iy % period) + period) % period;
    let tx = x - ix, ty = y - iy; tx *= tx * (3 - 2 * tx); ty *= ty * (3 - 2 * ty);
    const p = values[b * period + a], q = values[b * period + (a + 1) % period], r = values[((b + 1) % period) * period + a], s = values[((b + 1) % period) * period + (a + 1) % period];
    return (p + (q - p) * tx) * (1 - ty) + (r + (s - r) * tx) * ty; };
}
const n2 = noise(4, 63), n8 = noise(16, 91), n64 = noise(128, 187);
function tile(kind, normal = false) {
  const key = kind + (normal ? ':normal' : ':color'); if (textures.has(key)) return textures.get(key);
  const size = normal ? 128 : kind === 'asphalt' ? 512 : 256, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d'), img = ctx.createImageData(size, size);
  const height = (u, v) => {
    const macro = n2(u, v), medium = n8(u, v), fine = n64(u, v);
    if (kind === 'wood' || kind === 'bark') return .52 + .035 * Math.sin((u * 32 + Math.sin(v * TAU * 2) * .06 + medium * .2) * TAU) + fine * .07 - ((u * 6) % 1 < .025 ? .2 : 0);
    if (kind === 'stone' || kind === 'concrete') { const row = Math.floor(v * 6), x = (u * 4 + (row % 2) * .5) % 1, y = (v * 6) % 1; return (Math.min(x, 1 - x, y, 1 - y) < .025 ? .24 : .57) + medium * .15 + fine * .08; }
    if (kind === 'sand') return .5 + .12 * Math.sin((v * 24 + medium * .6) * TAU) + macro * .16 + fine * .1;
    if (kind === 'rock') return macro * .4 + medium * .35 + fine * .14 + Math.abs(Math.sin((v * 9 + macro * 2) * TAU)) * .11;
    if (kind === 'sandstone') return .5 + .06 * Math.sin((v * 6 + medium * .2) * TAU) + fine * .08 + medium * .05;
    if (kind === 'leaf') return .5 + medium * .23 + fine * .27;
    return .46 + macro * .1 + medium * .13 + fine * .25;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, at = (y * size + x) * 4, h = height(u, v);
    if (normal) {
      const e = 1 / size, dx = (height(u + e, v) - height(u - e, v)) * 1.8, dy = (height(u, v + e) - height(u, v - e)) * 1.8, len = Math.hypot(dx, dy, 1);
      img.data[at] = (0.5 - dx / len * .5) * 255; img.data[at + 1] = (.5 - dy / len * .5) * 255; img.data[at + 2] = (.5 + .5 / len) * 255;
    } else {
      let value = clamp(.64 + h * .48, .3, 1) * 255;
      if (kind === 'sandstone') value = 205 + h * 45;
      if (kind === 'asphalt') {
        value = 51 + h * 25 - (Math.exp(-((u - .32) ** 2) / .0016) + Math.exp(-((u - .68) ** 2) / .0016)) * 5;
        const lines = (u > .03 && u < .047) || (u > .953 && u < .97) || (u > .495 && u < .505 && v < .36);
        if (lines) value = 237;
      }
      img.data[at] = value; img.data[at + 1] = value; img.data[at + 2] = value;
    }
    img.data[at + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); const tex = new T.CanvasTexture(canvas); if (!normal) tex.colorSpace = T.SRGBColorSpace;
  tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.anisotropy = 4; tex.userData.wkShared = true; textures.set(key, tex); return tex;
}
function material(kind, color = '#ffffff', detail = true) {
  const m = new T.MeshStandardMaterial({ color, map: tile(kind), roughness: kind === 'metal' ? .38 : kind === 'leaf' ? .88 : .9, metalness: kind === 'metal' ? .45 : 0, envMapIntensity: .22 });
  if (detail && kind !== 'leaf' && kind !== 'landscape') { m.normalMap = tile(kind, true); m.normalScale.set(kind === 'asphalt' ? .22 : .28, kind === 'asphalt' ? .22 : .28); }
  m.userData.wkSurface = kind; return m;
}
function groundTile(kind, repeat) {
  const family = kind === 'redsand' ? 'redsand' : ['sand', 'savanna', 'tropic'].includes(kind) ? 'sand' : ['snow'].includes(kind) ? 'snow' : ['moon', 'rock', 'ash', 'concrete', 'graveyard', 'antique'].includes(kind) ? 'rock' : ['jungle', 'moss'].includes(kind) ? 'forest' : 'grass';
  const key = 'ground:' + family + ':' + repeat.x + ':' + repeat.y; if (textures.has(key)) return textures.get(key);
  const palettes = { redsand: ['#bb764e', '#d7a06c', '#8e533a'], sand: ['#c6a36f', '#e6ca93', '#a68a5c'], snow: ['#b7cbdf', '#edf1ed', '#a0bad2'], rock: ['#6c746e', '#aaa99a', '#555e5a'], forest: ['#355c39', '#658047', '#695e40'], grass: ['#45743b', '#76964e', '#827348'] };
  const colors = palettes[family].map(c => new T.Color(c)), canvas = document.createElement('canvas'), size = family === 'grass' || family === 'forest' ? 512 : 256; canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d'), data = ctx.createImageData(size, size), c = new T.Color();
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, a = n2(u, v), b = n8(u, v), grain = n64(u, v), i = (y * size + x) * 4;
    c.copy(colors[0]).lerp(colors[1], clamp((a - .15) * 1.4, 0, 1));
    c.lerp(colors[2], Math.max(0, b - .56) * (family === 'grass' || family === 'forest' ? .8 : .35));
    const wave = family === 'sand' ? Math.sin((v * 24 + b * .6) * TAU) * .04 : (family === 'grass' || family === 'forest') ? Math.max(0, Math.sin((u * 94 + v * 151) * TAU) - .87) * .4 : 0;
    c.multiplyScalar(.88 + grain * .22 + wave); c.convertLinearToSRGB();
    data.data[i] = c.r * 255; data.data[i + 1] = c.g * 255; data.data[i + 2] = c.b * 255; data.data[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0); const tex = new T.CanvasTexture(canvas); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4; tex.repeat.copy(repeat); tex.userData.wkShared = true; textures.set(key, tex); return tex;
}
function merge(parts) {
  const P = [], N = [], U = []; for (const [geo, matrix] of parts) {
    geo.applyMatrix4(matrix || new T.Matrix4()); const g = geo.index ? geo.toNonIndexed() : geo;
    P.push(...g.attributes.position.array); N.push(...g.attributes.normal.array); if (g.attributes.uv) U.push(...g.attributes.uv.array); else for (let i = 0; i < g.attributes.position.count; i++) U.push(0, 0);
    if (g !== geo) g.dispose(); geo.dispose();
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); return g;
}
function transform(x, y, z, sx = 1, sy = sx, sz = sx) { return new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion(), new T.Vector3(sx, sy, sz)); }
function soften(g) {
  const p = g.attributes.position, n = g.attributes.normal, sums = new Map(), keys = [];
  for (let i = 0; i < p.count; i++) { const key = Math.round(p.getX(i) * 10000) + ',' + Math.round(p.getY(i) * 10000) + ',' + Math.round(p.getZ(i) * 10000); keys.push(key); let s = sums.get(key); if (!s) sums.set(key, s = new T.Vector3()); s.x += n.getX(i); s.y += n.getY(i); s.z += n.getZ(i); }
  for (const s of sums.values()) s.normalize(); for (let i = 0; i < p.count; i++) { const s = sums.get(keys[i]); n.setXYZ(i, s.x, s.y, s.z); }
}
function decorGeometry(name, classic) {
  if (geometries.has(name)) return geometries.get(name);
  let g, surface;
  if (['crown', 'crown2', 'bush'].includes(name)) {
    const r = name === 'crown' ? 3.2 : name === 'crown2' ? 2.2 : 1.6;
    g = merge([[new T.IcosahedronGeometry(1, 1), transform(-r * .3, 0, 0, r * .78, r * .7, r * .76)], [new T.IcosahedronGeometry(1, 1), transform(r * .3, r * .18, r * .12, r * .78, r * .76, r * .73)]]); surface = 'leaf';
  } else if (name === 'rock') { g = new T.IcosahedronGeometry(1.6, 1); surface = 'rock'; }
  else if (name === 'trunk' || name === 'ptrunk') { g = new T.CylinderGeometry(name === 'trunk' ? .32 : .25, name === 'trunk' ? .64 : .4, name === 'trunk' ? 4.4 : 2, 8, 3); surface = 'bark'; }
  else if (name === 'hill') { g = new T.SphereGeometry(1, 22, 10, 0, TAU, 0, Math.PI / 2); surface = 'landscape'; }
  else if (name === 'mesa') { g = new T.CylinderGeometry(.68, 1, 1, 14, 4); g.translate(0, .5, 0); surface = 'rock'; }
  else return classic;
  const pos = g.attributes.position;
  if (surface === 'rock' || surface === 'leaf' || surface === 'landscape') for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), wave = Math.sin(x * 3.7 + z * 2.8) * Math.sin(y * 4.9 - z * 1.3);
    const k = 1 + wave * (name === 'hill' ? .13 : .09), ys = name === 'hill' ? .72 + .28 * (.5 + .5 * Math.sin(x * 4 + z * 3)) : name === 'rock' ? .7 : name === 'bush' ? .72 : 1; pos.setXYZ(i, x * k, y * ys, z * k);
  }
  g.computeVertexNormals();
  if (surface === 'leaf' || surface === 'landscape') soften(g);
  // Occultation ambiante cuite dans les sommets ; aucune passe d'écran supplémentaire.
  g.computeBoundingBox(); const colors = new Float32Array(pos.count * 3), lo = g.boundingBox.min.y, range = g.boundingBox.max.y - lo || 1;
  for (let i = 0; i < pos.count; i++) { const h = (pos.getY(i) - lo) / range, shade = .77 + h * .23; colors[i * 3] = shade; colors[i * 3 + 1] = shade; colors[i * 3 + 2] = shade; }
  g.setAttribute('color', new T.BufferAttribute(colors, 3)); g.userData = { keep: true, wkSurface: surface, wkClassic: classic }; geometries.set(name, g); return g;
}
function jungleGeometry(name, classic) {
  const key = 'jungle:' + name; if (geometries.has(key)) return geometries.get(key);
  const leaves = ['kapok', 'kapok2', 'slim', 'canopy', 'palm', 'fern', 'leaf', 'brom'].includes(name), g = classic.clone(), p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    uv[i * 2] = (ax > ay && ax > az ? p.getZ(i) : p.getX(i)) * .18; uv[i * 2 + 1] = (ay > ax && ay > az ? p.getZ(i) : p.getY(i)) * .18;
  }
  if (leaves) soften(g); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.userData = { keep: true, wkSurface: leaves ? 'leaf' : 'rock', wkClassic: classic }; geometries.set(key, g); return g;
}
function tunnelStyle(W, style) {
  if (style !== 'fun') return style;
  const kind = W.th.decor;
  if (['city', 'mall', 'space', 'moon', 'pinball'].includes(kind)) return 'metal';
  if (['prairie', 'provence', 'house', 'autumn'].includes(kind)) return 'wood';
  if (kind === 'candy') return 'candy';
  return 'rock';
}
function tunnel(W, P, ranges, style) {
  if (W.def.pilot && style !== 'aqua') return pilotTunnel(W, P, ranges);
  style = tunnelStyle(W, style);
  const r = (P.wallD || W.wallD) + .8, segments = 14, kind = style === 'wood' || style === 'ship' ? 'wood' : style === 'metal' || style === 'aqua' ? 'metal' : 'stone';
  const colors = { wood: '#98724f', ship: '#796046', rock: '#858574', stone: '#858579', metal: '#8198a5', aqua: '#95d4df', candy: '#edc7b2' };
  const m = material(kind, colors[style] || colors.rock); m.side = T.DoubleSide;
  if (style === 'aqua') { m.transparent = true; m.opacity = .25; m.depthWrite = false; m.roughness = .2; }
  m.userData.wkTunnel = style;
  const group = new T.Group(); group.userData.wkStructure = true; W.scene.add(group);
  const posts = [], rocks = [], covered = kind === 'wood' || kind === 'metal' && style !== 'aqua', ribMat = material(kind, kind === 'metal' ? '#516873' : '#645e50', false);
  for (const [rawA, rawB] of ranges) {
    const a = Math.max(0, Math.ceil(rawA)), b = Math.min(P.N - 1, Math.floor(rawB)); if (b - a < 2) continue;
    const vertices = [], uv = [], indices = []; let row = 0;
    for (let k = a; k <= b; k += 2) {
      const i = k % P.N;
      for (let j = 0; j <= segments; j++) {
        const theta = j / segments * Math.PI, rr = r + (kind === 'stone' ? .4 + 1.3 * Math.sin(j * 7.3 + k * .11) ** 2 : .12), lat = Math.cos(theta) * rr;
        const height = covered ? r * (.45 + .24 * (1 - Math.abs(lat) / (r + .12))) : Math.sin(theta) * rr * .62;
        vertices.push(P.px[i] + P.rx[i] * lat, P.py[i] + .06 + height, P.pz[i] + P.rz[i] * lat); uv.push(j / segments * (covered ? 10 : 3), (k - a) * P.seg / 9);
        if (row && j < segments) { const q = (row - 1) * (segments + 1) + j, s = row * (segments + 1) + j; indices.push(q, s, q + 1, q + 1, s, s + 1); }
      }
      if (k === a || k + 2 > b || (k - a) % 18 === 0) {
        posts.push({ i, radius: r + .55 });
        if (kind === 'stone') for (const side of [-1, 1]) {
          const x = P.px[i] + P.rx[i] * side * (r + 6), z = P.pz[i] + P.rz[i] * side * (r + 6);
          if (safeSpot(W, x, z, 3)) rocks.push({ x, z, y: W.hAt ? W.hAt(x, z) : P.py[i] - 1, sx: 6, sy: r * .68, sz: 8 });
        }
      }
      row++;
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals(); group.add(new T.Mesh(g, m));
  }
  if (posts.length) {
    let ring;
    if (covered) {
      const rise = r * .24, base = r * .45, length = Math.hypot(r + .4, rise), left = new T.CylinderGeometry(.25, .25, length, 6), right = left.clone(); left.rotateZ(-Math.atan2(r + .4, rise)); right.rotateZ(Math.atan2(r + .4, rise));
      ring = merge([[new T.CylinderGeometry(.28, .36, base, 6), transform(-r - .4, base / 2, 0)], [new T.CylinderGeometry(.28, .36, base, 6), transform(r + .4, base / 2, 0)], [left, transform(-r / 2, base + rise / 2, 0)], [right, transform(r / 2, base + rise / 2, 0)]]);
    } else ring = new T.TorusGeometry(r + .65, .35, 5, 18, Math.PI);
    const ribs = new T.InstancedMesh(ring, ribMat, posts.length), matrix = new T.Matrix4(), q = new T.Quaternion();
    posts.forEach(({ i }, n) => { q.setFromAxisAngle(new T.Vector3(0, 1, 0), P.hd[i]); matrix.compose(new T.Vector3(P.px[i], P.py[i] + .06, P.pz[i]), q, new T.Vector3(1, covered ? 1 : .62, 1)); ribs.setMatrixAt(n, matrix); }); ribs.computeBoundingSphere(); group.add(ribs);
  }
  if (rocks.length) { const geo = new T.IcosahedronGeometry(1, 1); geo.translate(0, .8, 0); const im = new T.InstancedMesh(geo, material('rock', '#828574'), rocks.length); rocks.forEach((p, i) => im.setMatrixAt(i, transform(p.x, p.y, p.z, p.sx, p.sy, p.sz))); im.computeBoundingSphere(); group.add(im); }
  return group;
}
function safeSpot(W, x, z, radius) {
  const paths = [W.S].concat(W.branches); for (const P of paths) for (let i = 0; i < P.N; i += 4) if ((P.px[i] - x) ** 2 + (P.pz[i] - z) ** 2 < ((P.hw || W.hw) + W.curbW + radius + 5) ** 2) return false;
  return true;
}
function gapScenery(W, indices) {
  const S = W.S, points = [], plants = [], rng = random(711); const tropical = ['jungle', 'tropic', 'sakura'].includes(W.th.decor);
  for (const i of indices) for (const side of [-1, 1]) for (let j = 0; j < 5; j++) {
    const along = (j - 2) * 19, d = side * (W.wallD + 36 + rng() * 20), x = S.px[i] + S.rx[i] * d + S.fx[i] * along, z = S.pz[i] + S.rz[i] * d + S.fz[i] * along;
    if (!safeSpot(W, x, z, 10)) continue;
    const y = W.hAt ? W.hAt(x, z) : (W.th.groundY || 0), sx = 12 + rng() * 8, sy = 9 + rng() * 11;
    points.push({ x, y, z, sx, sy, sz: 10 + rng() * 5 }); if (tropical) plants.push({ x: x + 1, y: y + sy - .5, z, sx: sx * .48, sy: sy * .12, sz: sx * .45 });
  }
  const g = new T.BoxGeometry(1, 1, 1, 2, 3, 2); g.translate(0, .5, 0); const positions = g.attributes.position;
  for (let i = 0; i < positions.count; i++) { const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i), k = 1 + Math.sin(x * 9 + y * 4 + z * 7) * .13; positions.setXYZ(i, x * k, y, z * k); } g.computeVertexNormals();
  const add = (geo, mat, list) => { if (!list.length) { geo.dispose(); mat.dispose(); return; } const im = new T.InstancedMesh(geo, mat, list.length); list.forEach((p, n) => im.setMatrixAt(n, transform(p.x, p.y, p.z, p.sx, p.sy, p.sz))); im.computeBoundingSphere(); W.scene.add(im); im.userData.wkStructure = true; };
  add(g, material('rock', tropical ? '#788575' : '#999080'), points);
  if (plants.length) add(new T.IcosahedronGeometry(1, 1), material('leaf', '#527343', false), plants);
}
function classify(geo) {
  return geo && geo.userData.wkSurface;
}
function pilotState(W) {
  if (!W.pilot) W.pilot = { stats: { tunnels: 0, supports: 0, beams: 0, cliffs: 0, mountains: 0 }, tunnels: [], supports: [], enhancedOnly: new T.Group(), oldScenery: [] };
  return W.pilot;
}
function pilotTunnel(W, P, ranges) {
  const state = pilotState(W), snow = W.def.pilot === 'alpine', group = new T.Group(), radius = (P.wallD || W.wallD) + 3, height = snow ? 16 : 12;
  W.scene.add(group); group.name = 'Tunnel traversant — coque et montagne';
  const innerMat = W.def.production ? window.WKScenery.material('#d7a677', true) : material(snow ? 'rock' : 'sandstone', snow ? '#9babb7' : '#c19a72', false), outerMat = W.def.production ? window.WKScenery.material('#ca915c', true) : material(snow ? 'rock' : 'sandstone', snow ? '#bac6cf' : '#ba8158', false);
  innerMat.side = outerMat.side = T.DoubleSide; innerMat.userData.wkSurface = 'rock'; outerMat.userData.wkSurface = 'rock';
  for (const [rawA, rawB] of ranges) {
    const a = Math.ceil(rawA), b = Math.floor(rawB); if (b - a < 4) continue;
    const rows = []; for (let k = a; k < b; k += 3) rows.push(k); rows.push(b);
    const make = outer => {
      const p = [], uv = [], idx = [], colors = [], sides = 24;
      for (let row = 0; row < rows.length; row++) {
        const k = rows[row], i = k % P.N;
        for (let j = 0; j <= sides; j++) {
          const t = j / sides * Math.PI, erode = outer ? 1 + .07 * Math.sin(k * .17 + j * 1.1) : 1;
          const lat = Math.cos(t) * (outer ? radius + 23 : radius), rise = Math.sin(t) * (outer ? height + 38 : height) * erode;
          p.push(P.px[i] + P.rx[i] * lat, P.py[i] + .06 + rise - (outer ? 1.5 : 0), P.pz[i] + P.rz[i] * lat);
          uv.push(j / sides * radius / 3, (k - a) * P.seg / 8);
          const shade = outer ? .72 + .28 * Math.sin(t) : .65 + .35 * Math.sin(t); colors.push(shade, shade, shade);
          if (row && j < sides) { const q = (row - 1) * (sides + 1) + j, n = row * (sides + 1) + j; idx.push(q, n, q + 1, q + 1, n, n + 1); }
        }
      }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); g.setIndex(idx); g.computeVertexNormals();
      const m = outer ? outerMat : innerMat; m.vertexColors = true; const mesh = new T.Mesh(g, m); group.add(mesh); return mesh;
    };
    const inside = make(false); make(true);
    // Anneaux de roche entre coque et montagne : le centre de l'entrée reste entièrement ouvert.
    for (const k of [a, b]) {
      const i = k % P.N, p = [], uv = [], idx = [];
      for (let j = 0; j <= 24; j++) {
        const theta = j / 24 * Math.PI;
        for (const outer of [false, true]) { const lat = Math.cos(theta) * (radius + (outer ? 23 : 0)), y = Math.sin(theta) * (height + (outer ? 38 : 0)) * (outer ? 1 + .07 * Math.sin(k * .17 + j * 1.1) : 1) - (outer ? 1.5 : 0); p.push(P.px[i] + P.rx[i] * lat, P.py[i] + .06 + y, P.pz[i] + P.rz[i] * lat); uv.push(lat / 8, y / 8); }
        if (j < 24) { const q = j * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
      }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(p, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setAttribute('color', new T.Float32BufferAttribute(new Float32Array(p.length).fill(1), 3)); geo.setIndex(idx); geo.computeVertexNormals(); group.add(new T.Mesh(geo, innerMat));
    }
    const volume = { P, a, b, radius, height, group, inside }; (W.tunnelVolumes || (W.tunnelVolumes = [])).push(volume); state.tunnels.push(volume); state.stats.tunnels++;
  }
  return group;
}
function alpineMassif(s, coarse) {
  const n = coarse ? 12 : 28, p = [], uv = [], idx = [], colors = [], color = new T.Color(), rock = new T.Color('#6f8496'), ice = new T.Color('#ecf5f6');
  for (let z = 0; z <= n; z++) for (let x = 0; x <= n; x++) {
    const u = x / n * 2 - 1, v = z / n * 2 - 1, edge = Math.max(0, 1 - Math.max(Math.abs(u), Math.abs(v)) ** 3);
    const peak = Math.exp(-((u + .25) ** 2 + (v - .12) ** 2) * 5) + .7 * Math.exp(-((u - .35) ** 2 + (v + .24) ** 2) * 8);
    const ridge = 1 + .12 * Math.sin(u * 13 + s.seed) * Math.sin(v * 9 - s.seed) + .045 * Math.sin(u * 29 + v * 17), h = peak * edge * ridge * s.h;
    p.push(u * s.r, h - 3, v * s.r); uv.push(u * s.r / 22, v * s.r / 22);
    color.copy(rock).lerp(ice, clamp((h / s.h - .28) * 2.1 + .1 * Math.sin(u * 9 + v * 5), 0, 1)); colors.push(color.r, color.g, color.b);
    if (x < n && z < n) { const q = z * (n + 1) + x; idx.push(q, q + n + 1, q + 1, q + 1, q + n + 1, q + n + 2); }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function pilotWorld(W) {
  const state = pilotState(W), alpine = W.def.pilot === 'alpine', S = W.S;
  W.scene.add(state.enhancedOnly); state.enhancedOnly.name = 'Paysages du pilote';
  // Des falaises continues qui bordent les portions roulables, avec talus et strates, hors du gabarit.
  const cliffMat = material(alpine ? 'rock' : 'sandstone', '#ffffff', false); cliffMat.side = T.DoubleSide; cliffMat.vertexColors = true;
  const ranges = alpine ? [[.19, .4, -1], [.62, .72, 1]] : [[.28, .46, -1], [.77, .9, 1]];
  for (const [from, to, side] of ranges) {
    const p = [], uv = [], idx = [], colors = [], cols = 7, color = new T.Color(), dark = new T.Color(alpine ? '#718596' : '#9e6245'), light = new T.Color(alpine ? '#edf4f7' : '#dbab71'); let rows = 0;
    for (let i = Math.floor(S.N * from); i <= Math.floor(S.N * to); i += 3) {
      const footD = W.wallD + 24, fx = S.px[i] + S.rx[i] * side * footD, fz = S.pz[i] + S.rz[i] * side * footD;
      if (!safeSpot(W, fx, fz, 4)) { rows = 0; continue; }
      if (Array.from({ length: cols }, (_, c) => { const d = side * (footD + (c / (cols - 1)) ** 2 * 75); return !safeSpot(W, S.px[i] + S.rx[i] * d, S.pz[i] + S.rz[i] * d, 4); }).some(Boolean)) { rows = 0; continue; }
      const offset = p.length / 3;
      for (let c = 0; c < cols; c++) {
        const t = c / (cols - 1), d = side * (footD + t * t * 75), x = S.px[i] + S.rx[i] * d, z = S.pz[i] + S.rz[i] * d;
        const base = W.hAt ? W.hAt(fx, fz) : 0, rise = (alpine ? 65 : 46) * Math.min(1, Math.sqrt(t) * 1.3) * (.75 + .25 * Math.sin(i * .035) ** 2) + 5 * Math.sin(i * .065 + t * 8) * t;
        p.push(x, base - 3 + rise, z); uv.push(t * 7, i * S.seg / 10);
        const stratum = alpine ? clamp(t * 1.4 + .12 * Math.sin(i * .07), 0, 1) : .35 + .3 * Math.sin((base + rise) * .45 + Math.sin(i * .06));
        color.copy(dark).lerp(light, stratum); colors.push(color.r, color.g, color.b);
        if (rows && c < cols - 1) { const q = offset - cols + c, n = offset + c; idx.push(q, n, q + 1, q + 1, n, n + 1); }
      }
      rows++;
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); g.setIndex(idx); g.computeVertexNormals(); state.enhancedOnly.add(new T.Mesh(g, cliffMat)); state.stats.cliffs++;
  }
  if (alpine) {
    const rng = random(8371), mat = material('rock', '#ffffff', false); mat.vertexColors = true;
    for (let j = 0; j < 16; j++) {
      const a = j / 16 * TAU, r = 95 + rng() * 40, d = W.bb.ext + 210 + rng() * 70, x = W.bb.cx + Math.cos(a) * d, z = W.bb.cz + Math.sin(a) * d;
      if (!safeSpot(W, x, z, r * 1.45)) continue;
      const spec = { r, h: 145 + rng() * 100, seed: rng() * TAU }, lod = new T.LOD(); lod.position.set(x, W.hAt ? W.hAt(x, z) - 5 : -5, z);
      lod.addLevel(new T.Mesh(alpineMassif(spec, false), mat), 0); lod.addLevel(new T.Mesh(alpineMassif(spec, true), mat), 450); state.enhancedOnly.add(lod); state.stats.mountains++;
    }
    W.scene.traverse(o => { if (o.isInstancedMesh && (o.geometry === geometries.get('hill') || o.geometry.userData.wkScenicPeak || o.geometry.type === 'ConeGeometry' && o.geometry.parameters.radius > 1)) state.oldScenery.push([o, o.visible]); });
  }
  // Piles à l'extérieur de toutes les voies basses, tabliers et contreventements réutilisés.
  const supports = [], beams = [], paths = [S, ...W.branches];
  const clearColumn = (x, z, bottom, top) => {
    for (const P of paths) for (let j = 0; j < P.N; j += 2) if (P.py[j] + 4 > bottom && P.py[j] - 3 < top && (P.px[j] - x) ** 2 + (P.pz[j] - z) ** 2 < ((P.wallD || W.wallD) + 4) ** 2) return false;
    return true;
  };
  for (const P of paths) {
    const deckPoints = [];
    for (let i = 4; i < P.N - 4; i += 18) {
      const bridge = P === S ? S.bridge && S.bridge[i] : !P.offroad && P.def.open;
      if (!bridge || P.glide && P.glide[i] || P.wz && P.wz[i]) continue;
      for (const side of [-1, 1]) {
        const d = side * ((P.wallD || W.wallD) + 8), x = P.px[i] + P.rx[i] * d, z = P.pz[i] + P.rz[i] * d, bottom = W.hAt ? W.hAt(x, z) - .5 : -1, top = P.py[i] - 2;
        if (top - bottom < 4 || !clearColumn(x, z, bottom, top)) continue;
        const a = new T.Vector3(x, bottom, z), b = new T.Vector3(x, top, z); supports.push([a, b]); state.supports.push({ x, z, bottom, top });
        const deck = new T.Vector3(P.px[i] + P.rx[i] * side * ((P.wallD || W.wallD) - 1), top, P.pz[i] + P.rz[i] * side * ((P.wallD || W.wallD) - 1)); beams.push([b, deck]); deckPoints.push({ i, side, b });
      }
    }
    for (let j = 2; j < deckPoints.length; j++) { const a = deckPoints[j - 2], b = deckPoints[j]; if (a.side === b.side && b.i - a.i <= 20) { const low = a.b.clone(); low.y -= Math.min(6, a.b.y - (W.hAt ? W.hAt(low.x, low.z) : 0)); beams.push([low, b.b]); } }
  }
  const addBeams = (list, width, mat) => {
    if (!list.length) { mat.dispose(); return; }
    const g = new T.BoxGeometry(1, 1, 1), im = new T.InstancedMesh(g, mat, list.length), q = new T.Quaternion(), matrix = new T.Matrix4(), up = new T.Vector3(0, 1, 0);
    list.forEach(([a, b], i) => { const delta = b.clone().sub(a); q.setFromUnitVectors(up, delta.clone().normalize()); matrix.compose(a.clone().add(b).multiplyScalar(.5), q, new T.Vector3(width, delta.length(), width)); im.setMatrixAt(i, matrix); }); im.computeBoundingSphere(); W.scene.add(im);
  };
  addBeams(supports, 3.2, material('stone', alpine ? '#8797a7' : '#ba9870', false)); addBeams(beams, 1.5, material('wood', '#75634e', false));
  state.stats.supports = supports.length; state.stats.beams = beams.length;
}
function canyonCliff(original) {
  const p = original.attributes.position, normal = new T.Vector3().fromBufferAttribute(original.attributes.normal, 0);
  const bottom = new T.Vector3().fromBufferAttribute(p, 0), across = new T.Vector3().fromBufferAttribute(p, 1).sub(bottom), up = new T.Vector3().fromBufferAttribute(p, 2).sub(bottom);
  const vertices = [], uv = [], indices = [], q = new T.Vector3(), cols = 20, rows = 12;
  for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) {
    const u = x / cols, v = y / rows, recess = Math.sin(Math.PI * u) * Math.sin(Math.PI * v) * (1.2 + .8 * Math.sin(u * 32 + v * 9));
    q.copy(bottom).addScaledVector(across, u).addScaledVector(up, v).addScaledVector(normal, -recess);
    vertices.push(q.x, q.y, q.z); uv.push(u * across.length() / 8, v * up.length() / 8);
    if (y < rows && x < cols) { const a = y * (cols + 1) + x, b = a + cols + 1; indices.push(a, a + 1, b, a + 1, b + 1, b); }
  }
  // Même orientation que la face initiale, sans empiéter sur la zone de vol.
  if (new T.Vector3().crossVectors(across, up).dot(normal) < 0) for (let i = 0; i < indices.length; i += 3) [indices[i], indices[i + 1]] = [indices[i + 1], indices[i]];
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals(); return g;
}
// Relief de référence : silhouettes érodées, strates et talus dans une même surface.
// Les deux LOD utilisent la même enveloppe : aucun changement du terrain physique.
function canyonFormation(spec, coarse = false) {
  const segments = coarse ? 24 : 56, rings = coarse ? 8 : 16;
  const p = [], uv = [], colors = [], indices = [], c = new T.Color();
  const palette = ['#773e32', '#aa5437', '#d67d48', '#e8b373', '#b76240'].map(v => new T.Color(v));
  for (let row = 0; row <= rings; row++) {
    const t = Math.min(1, row / (rings - 2));
    // Large talus, paroi verticale, puis plateau irrégulier fermé au sommet.
    const profile = row === rings ? 0 : row === rings - 1 ? .28 : t < .25 ? 1 - t * 1.28 : .68 - (t - .25) * .14;
    for (let j = 0; j <= segments; j++) {
      const a = j / segments * TAU, phase = spec.seed;
      const erosion = 1 + .115 * Math.sin(a * 3 + phase) + .07 * Math.sin(a * 7 - phase * 2) + .025 * Math.sin(a * 13 + t * 14);
      const r = profile * erosion, crest = .94 + .055 * Math.sin(a * 3 + phase) + .025 * Math.sin(a * 5 - phase);
      const y = spec.h * (row === rings ? .97 : row === rings - 1 ? .97 + (crest - .97) * .5 : t * crest), x = Math.cos(a) * r * spec.rx, z = Math.sin(a) * r * spec.rz;
      p.push(x, y, z); uv.push(j / segments * (spec.rx + spec.rz) * .3, y / 7);
      const stratum = ((y / 7 + .14 * Math.sin(a * 3 + phase)) % 5 + 5) % 5, k = Math.floor(stratum);
      c.copy(palette[k]).lerp(palette[(k + 1) % 5], (stratum - k) * .45);
      c.multiplyScalar(.84 + .16 * t); colors.push(c.r, c.g, c.b);
      if (row < rings && j < segments) { const q = row * (segments + 1) + j, n = q + segments + 1; indices.push(q, n, q + 1, q + 1, n, n + 1); }
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); g.setIndex(indices); g.computeVertexNormals(); g.computeBoundingSphere(); return g;
}
function canyonPlantGeometry(kind) {
  const key = 'canyon-detail:' + kind; if (geometries.has(key)) return geometries.get(key);
  let g;
  if (kind === 'shrub') {
    const pieces = [];
    for (let i = 0; i < 5; i++) { const a = i * 2.4, r = i ? .65 : 0; pieces.push([new T.IcosahedronGeometry(1, 0), transform(Math.cos(a) * r, .55 + (i % 3) * .2, Math.sin(a) * r, .65, .5, .6)]); }
    g = merge(pieces); soften(g);
  } else if (kind === 'cactus') {
    const stem = (radius, height) => {
      const geo = new T.CylinderGeometry(radius * .85, radius, height, 8, 1), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), rib = 1 + .09 * Math.cos(a * 6); p.setXYZ(i, p.getX(i) * rib, p.getY(i), p.getZ(i) * rib); }
      geo.computeVertexNormals(); return geo;
    };
    const left = stem(.17, .9); left.rotateZ(Math.PI / 2); const right = stem(.15, .8); right.rotateZ(Math.PI / 2);
    g = merge([[stem(.35, 3.6), transform(0, 1.8, 0)], [left, transform(-.52, 1.5, 0)], [stem(.18, 1.35), transform(-.9, 2.05, 0)], [right, transform(.48, 2.15, 0)], [stem(.16, .85), transform(.8, 2.5, 0)]]);
  } else if (kind === 'stone') {
    g = new T.IcosahedronGeometry(1, 0); g.scale(1, .68, .86); g.translate(0, .35, 0);
  } else {
    // Feuilles et brins opaques : pas de texture alpha, d'animation ou de transparence.
    const p = [], uv = [], idx = [], leaves = kind === 'yucca' ? 13 : 8;
    for (let i = 0; i < leaves; i++) {
      const a = i * 2.4, height = kind === 'yucca' ? .7 + (i % 4) * .19 : .55 + (i % 3) * .13;
      const reach = kind === 'yucca' ? .65 + (i % 3) * .2 : .18 + (i % 4) * .1, width = kind === 'yucca' ? .095 : .035;
      const x = Math.cos(a), z = Math.sin(a), at = p.length / 3;
      p.push(-z * width, 0, x * width, z * width, 0, -x * width, x * reach * .5 + z * width, height, z * reach * .5 - x * width, x * reach * .5 - z * width, height, z * reach * .5 + x * width, x * reach, height * .65, z * reach);
      uv.push(0, 0, 1, 0, 1, .6, 0, .6, .5, 1); idx.push(at, at + 1, at + 2, at, at + 2, at + 3, at + 3, at + 2, at + 4);
    }
    g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  }
  g.userData.keep = true; geometries.set(key, g); return g;
}
function canyonDressing(W, specs) {
  const group = new T.Group(); group.name = 'Canyon — végétation et éboulis'; W.scene.add(group);
  const rng = random(92817), types = ['stone', 'shrub', 'yucca', 'cactus', 'grass'], lists = Object.fromEntries(types.map(t => [t, []])), anchors = [];
  const ground = (x, z) => W.hAt ? W.hAt(x, z) : 0;
  const safe = (x, y, z, radius, height) => {
    for (const P of [W.S, ...W.branches]) for (let i = 0; i < P.N; i++) {
      const j = i + 1 < P.N ? i + 1 : P.closed ? 0 : i, dx = P.px[j] - P.px[i], dz = P.pz[j] - P.pz[i], len = dx * dx + dz * dz;
      const t = len ? clamp(((x - P.px[i]) * dx + (z - P.pz[i]) * dz) / len, 0, 1) : 0;
      if ((x - P.px[i] - dx * t) ** 2 + (z - P.pz[i] - dz * t) ** 2 < ((P.wallD || W.wallD) + radius + 5) ** 2 && y + height > Math.min(P.py[i], P.py[j]) - 12) return false;
    }
    // Ne pas planter dans le volume des formations nouvelles.
    for (const s of specs) if (((x - s.x) / (s.rx * 1.15)) ** 2 + ((z - s.z) / (s.rz * 1.15)) ** 2 < 1) return false;
    return true;
  };
  for (let k = 0; k < 110; k++) {
    const i = Math.floor((k + .3) / 110 * W.S.N);
    for (const side of [-1, 1]) { const d = side * (W.wallD + 18 + rng() * 65); anchors.push({ x: W.S.px[i] + W.S.rx[i] * d, z: W.S.pz[i] + W.S.rz[i] * d }); }
    // Le fond du ravin peut être habillé sous la trajectoire aérienne, avec une marge verticale.
    if (W.S.glide[i]) anchors.push({ x: W.S.px[i] + (rng() - .5) * 25, z: W.S.pz[i] + (rng() - .5) * 25 });
  }
  for (const s of specs.filter(s => s.layer === 'near')) for (let k = 0; k < 4; k++) { const a = rng() * TAU; anchors.push({ x: s.x + Math.cos(a) * s.rx * 1.35, z: s.z + Math.sin(a) * s.rz * 1.35 }); }
  let accepted = 0, beneath = 0;
  for (const a of anchors) {
    const y = ground(a.x, a.z), slope = Math.hypot(ground(a.x + 2, a.z) - ground(a.x - 2, a.z), ground(a.x, a.z + 2) - ground(a.x, a.z - 2)) / 4;
    if (slope > .85 || !safe(a.x, y, a.z, 2, 4)) continue;
    accepted++;
    if (W.nearAll && W.nearAll(a.x, a.z, 80).h > y + 15) beneath++;
    for (let n = 0; n < 19; n++) {
      const kind = n < 7 ? 'stone' : n < 11 ? 'grass' : n < 15 ? 'shrub' : n < 18 ? 'yucca' : 'cactus';
      const theta = rng() * TAU, r = rng() * (kind === 'stone' ? 12 : 8), x = a.x + Math.cos(theta) * r, z = a.z + Math.sin(theta) * r, gy = ground(x, z);
      const scale = kind === 'stone' ? .35 + rng() ** 2 * 2.5 : kind === 'shrub' ? .6 + rng() * 1.2 : kind === 'cactus' ? .65 + rng() * .65 : .75 + rng() * .9;
      const height = (kind === 'cactus' ? 3.6 : kind === 'shrub' ? 1.6 : 1.3) * scale;
      if (Math.abs(gy - y) > 3.5 || !safe(x, gy, z, scale * 1.6, height)) continue;
      lists[kind].push({ x, y: gy - .12, z, scale, angle: rng() * TAU, tint: .78 + rng() * .3 });
    }
  }
  const colors = { stone: '#bb865a', shrub: '#657446', yucca: '#6b8753', cactus: '#478259', grass: '#af9c60' }, meshes = [];
  for (const kind of types) {
    const geo = canyonPlantGeometry(kind), mat = material(kind === 'stone' ? 'sandstone' : 'leaf', colors[kind], false);
    if (kind === 'yucca' || kind === 'grass') mat.side = T.DoubleSide;
    // Mélange déterministe avant découpage : les sous-ensembles allégés restent répartis.
    const points = lists[kind]; for (let i = points.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [points[i], points[j]] = [points[j], points[i]]; }
    for (let sector = 0; sector < 4; sector++) {
      const batch = points.filter(p => (p.x > W.bb.cx ? 1 : 0) + (p.z > W.bb.cz ? 2 : 0) === sector); if (!batch.length) continue;
      const mesh = new T.InstancedMesh(geo, mat, batch.length), matrix = new T.Matrix4(), q = new T.Quaternion(), color = new T.Color(), axis = new T.Vector3(0, 1, 0);
      batch.forEach((p, i) => { q.setFromAxisAngle(axis, p.angle); matrix.compose(new T.Vector3(p.x, p.y, p.z), q, new T.Vector3(p.scale, p.scale, p.scale)); mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, color.set('#ffffff').multiplyScalar(p.tint)); });
      mesh.userData.wkDetailKind = kind; mesh.userData.wkFullCount = batch.length; mesh.computeBoundingSphere(); group.add(mesh); meshes.push(mesh);
    }
    if (!points.length) mat.dispose();
  }
  return { group, meshes, counts: Object.fromEntries(types.map(t => [t, lists[t].length])), clusters: accepted, beneath };
}
function referenceLandscape(W, quality) {
  if (W.def.production) return;
  if (W.def.id !== 'grandsaut') return;
  const group = new T.Group(); group.name = 'Canyon — paysages de référence'; W.scene.add(group);
  const mat = material('sandstone', '#ffffff', quality !== 'low'); mat.vertexColors = true;
  const specs = [], rng = random(74123), bb = W.bb;
  // Enveloppe conservatrice : tous les segments sont testés, y compris ceux des raccourcis.
  const clear = (x, z, radius) => {
    for (const P of [W.S, ...W.branches]) for (let i = 0; i < P.N; i++) {
      const next = i + 1 < P.N ? i + 1 : P.closed ? 0 : i;
      const dx = P.px[next] - P.px[i], dz = P.pz[next] - P.pz[i], len = dx * dx + dz * dz;
      const t = len ? clamp(((x - P.px[i]) * dx + (z - P.pz[i]) * dz) / len, 0, 1) : 0;
      if (Math.hypot(x - P.px[i] - t * dx, z - P.pz[i] - t * dz) < radius + (P.wallD || W.wallD) + 12) return false;
    }
    return true;
  };
  const add = (x, z, rx, rz, h, layer) => {
    // La perturbation radiale est bornée à 1.21 ; marge supplémentaire pour les talus.
    const radius = Math.max(rx, rz) * 1.25; if (!clear(x, z, radius)) return;
    let y = W.hAt ? W.hAt(x, z) : 0;
    for (let j = 0; j < 16; j++) { const a = j / 16 * TAU; y = Math.min(y, W.hAt ? W.hAt(x + Math.cos(a) * radius, z + Math.sin(a) * radius) : 0); }
    specs.push({ x, z, y: y - 5, rx, rz, h, seed: rng() * TAU, layer, radius });
  };
  // Premier plan : falaises basses vues depuis les virages, jamais sur une zone roulable.
  for (let k = 0; k < 20; k++) {
    const i = Math.floor((k + .35) / 20 * W.S.N);
    for (const side of [-1, 1]) {
      const d = side * (W.wallD + 80 + rng() * 35);
      add(W.S.px[i] + W.S.rx[i] * d, W.S.pz[i] + W.S.rz[i] * d, 30 + rng() * 15, 27 + rng() * 13, 40 + rng() * 48, 'near');
    }
  }
  // Deux couronnes aux silhouettes différentes : plans intermédiaire et lointain.
  for (let layer = 0; layer < 2; layer++) for (let k = 0; k < 12; k++) {
    const a = (k + layer * .42) / 12 * TAU, d = bb.ext + 180 + layer * 190;
    add(bb.cx + Math.cos(a) * d, bb.cz + Math.sin(a) * d, 65 + rng() * 40, 55 + rng() * 35, 100 + layer * 30 + rng() * 85, layer ? 'far' : 'middle');
  }
  // Petits groupes spatiaux : culling par secteur plutôt qu'une scène entière fusionnée.
  for (let sector = 0; sector < 8; sector++) {
    const batch = specs.filter(s => Math.floor((Math.atan2(s.z - bb.cz, s.x - bb.cx) + Math.PI) / TAU * 8) % 8 === sector);
    if (!batch.length) continue;
    const cx = batch.reduce((s, p) => s + p.x, 0) / batch.length, cz = batch.reduce((s, p) => s + p.z, 0) / batch.length;
    const lod = new T.LOD(); lod.position.set(cx, 0, cz);
    for (const coarse of [false, true]) {
      const pieces = batch.map(s => [canyonFormation(s, coarse), transform(s.x - cx, s.y, s.z - cz)]);
      const geo = merge(pieces);
      // merge conserve les UV/normales ; couleurs stratifiées réévaluées en hauteur monde.
      const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), color = new T.Color(), a = new T.Color('#a7583a'), b = new T.Color('#edb676');
      for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), band = .5 + .5 * Math.sin(y * .64 + .12 * Math.sin(pos.getX(i) * .05)); color.copy(a).lerp(b, band * .65); col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b; }
      geo.setAttribute('color', new T.BufferAttribute(col, 3)); geo.computeBoundingSphere();
      const mesh = new T.Mesh(geo, mat); mesh.receiveShadow = false; mesh.castShadow = false; lod.addLevel(mesh, coarse ? 370 : 0);
    }
    group.add(lod);
  }
  const hidden = W.gfx.meshes.filter(p => p.geometry === geometries.get('hill') || p.geometry === geometries.get('mesa')).map(p => [p.mesh, p.mesh.visible]);
  W.scene.traverse(o => { if (o.geometry && o.geometry.userData.wkScenicPeak) hidden.push([o, o.visible]); });
  W.gfx.landscape = { group, hidden, specs, mat, details: canyonDressing(W, specs) };
  if (mat.normalMap) W.gfx.normalMaps.set(mat, mat.normalMap);
}
function prepare(W, enabled, quality, renderer) {
  const mats = new Map(), classics = new Map(), meshes = [], extras = new T.Group(); extras.userData.wkEnhancedOnly = true; W.scene.add(extras);
  const qualityDetail = quality !== 'low';
  W.scene.traverse(o => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    if (o.material.userData.wkProduction || o.userData.wkReplaced) return;
    const role = W.roles && W.roles.get(o.material), kind = classify(o.geometry), ownedSurface = o.material.userData.wkSurface;
    if (!role && !kind && !ownedSurface) return;
    if (o.material.transparent || (role === 'road' && o.material !== W.roadMaterial)) return;
    let enhanced = mats.get(o.material);
    if (!enhanced) {
      const original = o.material;
      if (ownedSurface && !kind && !role) {
        enhanced = original;
        classics.set(original, new T.MeshLambertMaterial({ color: original.color, side: original.side, vertexColors: original.vertexColors }));
      }
      else if (W.def.id === 'grandsaut' && role === 'skirt') enhanced = material('sandstone', '#b87550', qualityDetail);
      else if (role === 'road' && W.def.production && window.WKSurfaces) enhanced = window.WKSurfaces.make('asphalt');
      else if (role === 'road' && !W.th.roadStyle && !['seabed', 'pinball', 'parquet', 'mall', 'cloud'].includes(W.th.ground)) enhanced = material('asphalt', '#ffffff', qualityDetail);
      else if (kind) { enhanced = material(kind, kind === 'sandstone' ? '#bb7953' : original.color || '#ffffff', qualityDetail); enhanced.side = original.side; enhanced.vertexColors = !!o.geometry.attributes.color; }
      else {
        const natural = ['terrain', 'shoulder'].includes(role) && !['mall', 'pinball', 'parquet', 'candy', 'fair', 'space', 'seabed', 'cloud'].includes(W.th.ground);
        const map = natural && original.map ? groundTile(W.th.ground, original.map.repeat) : original.map;
        enhanced = new T.MeshStandardMaterial({ color: original.color, map, side: original.side, vertexColors: original.vertexColors, roughness: role === 'curb' ? .69 : .92, metalness: 0, envMapIntensity: .2 });
        if (qualityDetail) { enhanced.normalMap = tile(natural ? 'leaf' : role === 'curb' ? 'concrete' : 'rock', true); enhanced.normalScale.set(.14, .14); }
      }
      mats.set(original, enhanced);
      if (role && W.roles) W.roles.set(enhanced, role);
    }
    meshes.push({ mesh: o, classic: classics.get(o.material) || o.material, enhanced, geometry: o.geometry.userData.wkCliff ? canyonCliff(o.geometry) : o.geometry, classicGeometry: o.geometry.userData.wkClassic || o.geometry });
  });
  // Toutes les informations nécessaires au changement de mode restent locales à la scène.
  W.gfx = { enabled, budget: quality === 'low' ? 0 : quality === 'high' ? 2 : 1, shadowAllowed: quality === 'high', mats, meshes, extras, cosmetics: [], normalMaps: new Map(), originalSun: W.sun && W.sun.intensity, originalHemi: [] };
  if (W.pilot && W.scene.fog) W.gfx.originalFog = { near: W.scene.fog.near, far: W.scene.fog.far };
  for (const m of mats.values()) if (m.normalMap) W.gfx.normalMaps.set(m, m.normalMap);
  W.scene.traverse(o => { if (o.isHemisphereLight) W.gfx.originalHemi.push([o, o.intensity]); if (o.userData.wkCosmetic) W.gfx.cosmetics.push(o); });
  const buildings = []; W.scene.traverse(o => { if (o.isInstancedMesh && o.geometry.userData.wkBuilding) buildings.push(o); });
  for (const building of buildings) {
    const geo = new T.BoxGeometry(1, 1, 1); geo.translate(0, .5, 0); const roof = new T.InstancedMesh(geo, material('metal', '#667681', false), building.count), m = new T.Matrix4(), scale = new T.Vector3(), q = new T.Quaternion(), p = new T.Vector3();
    for (let i = 0; i < building.count; i++) { building.getMatrixAt(i, m); m.decompose(p, q, scale); m.multiply(transform(0, 1 - .35 / scale.y, 0, 1.025, .35 / scale.y, 1.025)); roof.setMatrixAt(i, m); }
    roof.computeBoundingSphere(); extras.add(roof);
  }
  const roots = [], matrix = new T.Matrix4(), base = new T.Vector3(), scale = new T.Vector3(), rotation = new T.Quaternion();
  for (const p of meshes) if (p.geometry.userData.wkSurface === 'bark' && p.mesh.isInstancedMesh) {
    p.geometry.computeBoundingBox();
    for (let i = 0; i < p.mesh.count; i++) { p.mesh.getMatrixAt(i, matrix); base.set(0, p.geometry.boundingBox.min.y, 0).applyMatrix4(matrix); matrix.decompose(new T.Vector3(), rotation, scale); roots.push({ x: base.x, y: W.hAt ? W.hAt(base.x, base.z) : base.y, z: base.z, r: Math.max(scale.x, scale.z) * 2.1 }); }
  }
  if (roots.length) {
    if (!textures.has('contact')) { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gradient = x.createRadialGradient(32, 32, 3, 32, 32, 32); gradient.addColorStop(0, '#00000070'); gradient.addColorStop(.6, '#00000025'); gradient.addColorStop(1, '#00000000'); x.fillStyle = gradient; x.fillRect(0, 0, 64, 64); const t = new T.CanvasTexture(c); t.userData.wkShared = true; textures.set('contact', t); }
    const plane = new T.PlaneGeometry(1, 1); plane.rotateX(-Math.PI / 2); const shadows = new T.InstancedMesh(plane, new T.MeshBasicMaterial({ map: textures.get('contact'), transparent: true, depthWrite: false, opacity: .42, polygonOffset: true, polygonOffsetFactor: -1 }), roots.length), up = new T.Vector3(0, 1, 0), normal = new T.Vector3();
    roots.forEach((p, i) => { if (W.hAt) normal.set(p.y - W.hAt(p.x + 1, p.z), 1, p.y - W.hAt(p.x, p.z + 1)).normalize(); else normal.copy(up); rotation.setFromUnitVectors(up, normal); matrix.compose(new T.Vector3(p.x, p.y + .06, p.z), rotation, new T.Vector3(p.r * 2, 1, p.r * 1.6)); shadows.setMatrixAt(i, matrix); }); shadows.computeBoundingSphere(); extras.add(shadows);
  }
  referenceLandscape(W, quality);
  if (enabled) applyMode(W, true, renderer);
  else applyMode(W, false, renderer);
}
function applyMode(W, enabled, renderer) {
  if (!W || !W.gfx) return; const g = W.gfx; g.enabled = enabled;
  for (const p of g.meshes) { p.mesh.material = enabled ? p.enhanced : p.classic; p.mesh.geometry = enabled ? p.geometry : p.classicGeometry; }
  g.extras.visible = enabled;
  if (g.landscape) { g.landscape.group.visible = enabled; g.landscape.details.group.visible = enabled; for (const [mesh, visible] of g.landscape.hidden) mesh.visible = enabled ? false : visible; }
  if (W.pilot) {
    W.pilot.enhancedOnly.visible = enabled;
    for (const [mesh, visible] of W.pilot.oldScenery) mesh.visible = enabled ? false : visible;
    if (g.originalFog) { W.scene.fog.near = enabled ? 230 : g.originalFog.near; W.scene.fog.far = enabled ? 1300 : g.originalFog.far; }
  }
  renderer.toneMappingExposure = enabled ? 1.16 : 1.25;
  if (W.sun) W.sun.intensity = g.originalSun * (enabled ? .95 : 1);
  for (const [light, value] of g.originalHemi) light.intensity = value * (enabled ? .9 : 1);
  setBudget(W, g.budget, renderer);
}
function setBudget(W, budget, renderer) {
  if (W && W.def.production && window.WKScenery) window.WKScenery.setBudget(W, budget);
  if (!W || !W.gfx) return; const g = W.gfx; g.budget = clamp(budget, 0, 2);
  for (const [m, normal] of g.normalMaps) { const next = g.budget > 0 || m.userData.wkPBR ? normal : null; if (m.normalMap !== next) { m.normalMap = next; m.needsUpdate = true; } }
  if (W.sun) W.sun.castShadow = g.shadowAllowed && (!g.enabled || g.budget >= 2);
  if (g.enabled && g.budget === 0) g.extras.visible = false;
  if (g.landscape) for (const lod of g.landscape.group.children) {
    lod.autoUpdate = g.budget > 0;
    if (!lod.autoUpdate) lod.levels.forEach((level, i) => { level.object.visible = i === lod.levels.length - 1; });
  }
  if (g.landscape) for (const mesh of g.landscape.details.meshes) mesh.count = Math.max(1, Math.round(mesh.userData.wkFullCount * (g.budget === 0 ? .3 : g.budget === 1 ? .7 : 1)));
  if (W.pilot) W.pilot.enhancedOnly.traverse(o => { if (o.isLOD) { o.autoUpdate = g.budget > 0; if (!o.autoUpdate) o.levels.forEach((l, i) => { l.object.visible = i === o.levels.length - 1; }); } });
  for (const o of g.cosmetics) o.visible = !g.enabled || g.budget > 0;
  renderer.shadowMap.needsUpdate = true;
}
function dispose(W, shared, cached, materials, texs) {
  if (!W || !W.gfx) return;
  const detached = new Set();
  for (const p of W.gfx.meshes) for (const geo of [p.geometry, p.classicGeometry]) if (geo && geo !== p.mesh?.geometry && !geo.userData.keep && !detached.has(geo)) { detached.add(geo); geo.dispose(); }
  const owned = new Set(); for (const p of W.gfx.meshes) { owned.add(p.classic); owned.add(p.enhanced); }
  for (const m of owned) {
    if (m.userData.keep || cached.has(m) || materials.has(m)) continue;
    materials.add(m);
    for (const key of ['map', 'normalMap', 'emissiveMap', 'roughnessMap']) { const tex = m[key]; if (tex && !shared.has(tex) && !tex.userData.wkShared && !texs.has(tex)) { texs.add(tex); tex.dispose(); } }
    m.dispose();
  }
  W.gfx = null;
}
window.WKGraphics = { tile, decorGeometry, jungleGeometry, tunnelStyle, tunnel, gapScenery, canyonFormation, pilotWorld, prepare, applyMode, setBudget, dispose, stats: () => ({ textures: textures.size, geometries: geometries.size }) };
})();
