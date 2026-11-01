/* Wild Kart Studio — noyau sans interface (navigateur et Node).
   Format de carte versionné, pièces modulaires aimantées (chaque pièce part exactement de la fin de la précédente : position,
   orientation et hauteur continues par construction), fermeture automatique (chemin de Dubins vérifié par simulation),
   contrôle des chevauchements, validation stricte des fichiers importés (aucun code exécuté, valeurs bornées, champs inconnus
   ignorés), migration des anciennes versions, codes de partage, et conversion en définition de circuit du jeu (def). */
(function (root) {
'use strict';
const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), mod = (a, m) => ((a % m) + m) % m;
const FORMAT = 'wildkart-map', VERSION = 1, MAX_BYTES = 200000;

/* Catalogue modulaire : types de pièces, propriétés de surface, éléments de gameplay, biomes (gabarit d'un circuit officiel). */
const PIECES = {
  droite: { nom: 'Ligne droite', l: [20, 240] },
  virage: { nom: 'Virage', a: [5, 359], r: [18, 160] },
};
const SURFACES = {
  normal: { nom: 'Asphalte', couleur: '#5a5c6e' },
  neige: { nom: 'Neige (glissante)', couleur: '#dfefff' },
  glace: { nom: 'Glace', couleur: '#8fe3ff' },
  boue: { nom: 'Boue', couleur: '#7a5230' },
  turbo: { nom: 'Turbo permanent', couleur: '#ff5fd2' },
};
const FEATS = {
  tremplin: { nom: 'Tremplin', min: 30 },
  planeur: { nom: 'Rampe de planeur', min: 90 },
  tunnel: { nom: 'Tunnel', min: 30 },
  objets: { nom: "Boîtes d'objets", min: 20 },
  boost: { nom: 'Plaque turbo', min: 20 },
};
const BIOMES = {
  prairie: { nom: 'Prairie', src: 'piquenique' }, provence: { nom: 'Lavande', src: 'sieste' }, automne: { nom: 'Automne', src: 'deuxroutes' },
  neige: { nom: 'Montagne enneigée', src: 'glissade' }, savane: { nom: 'Savane', src: 'safaribouchon' }, jungle: { nom: 'Jungle', src: 'cascade' },
  volcan: { nom: 'Volcan', src: 'barbecue' }, manoir: { nom: 'Manoir hanté', src: 'bellemere' }, plage: { nom: 'Plage', src: 'coupsoleil' }, ville: { nom: 'Ville néon', src: 'neonafter' },
};
const LIMITS = { pieces: 160, minL: 500, maxL: 9000, width: [16, 34], laps: [1, 5], dangers: [0, 6], dy: 18, grade: .12, strokes: 300, name: 40, gap: 12, gapH: 1.2, gapA: 20, levelDy: 8 };

function blank(name) {
  return { format: FORMAT, version: VERSION, name: name || 'Mon circuit', author: '', biome: 'prairie', width: 24, laps: 3, dangers: 1,
    pieces: [{ t: 'droite', l: 120 }, { t: 'virage', a: 180, r: 50 }, { t: 'droite', l: 120 }, { t: 'virage', a: 180, r: 50 }], sculpt: [] };
}

/* ---------- Validation stricte (fichiers partagés) ---------- */
const cleanStr = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
// Migration : v0 (brouillons sans numéro : { segments: [{ type: 'straight'|'curve', length, angle, radius }] }) → v1.
function migrate(raw, notes) {
  if (raw && raw.format === FORMAT && raw.version === VERSION) return raw;
  if (raw && raw.format === FORMAT && typeof raw.version === 'number' && raw.version > VERSION) throw new Error('Carte créée avec une version plus récente du Studio (v' + raw.version + ') : mets le jeu à jour.');
  if (raw && raw.format == null && Array.isArray(raw.segments)) {
    notes.push('Ancien format (v0) converti en v1.');
    return Object.assign({}, raw, { format: FORMAT, version: VERSION, pieces: raw.segments.map((s) => s && s.type === 'curve' ? { t: 'virage', a: s.angle, r: s.radius } : { t: 'droite', l: s && s.length }) });
  }
  throw new Error("Ce fichier n'est pas une carte Wild Kart Studio.");
}
/* Renvoie { ok, map, errors, warnings } ; map est une copie propre (seuls les champs connus, valeurs bornées). */
function validate(input) {
  const errors = [], warnings = [];
  let raw = input;
  if (typeof input === 'string') {
    if (input.length > MAX_BYTES) return { ok: false, errors: ['Fichier trop volumineux (' + Math.round(input.length / 1000) + ' ko, maximum ' + MAX_BYTES / 1000 + ' ko).'], warnings };
    try { raw = JSON.parse(input); } catch (e) { return { ok: false, errors: ['Fichier illisible (JSON invalide).'], warnings }; }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['Contenu vide ou invalide.'], warnings };
  try { raw = migrate(raw, warnings); } catch (e) { return { ok: false, errors: [e.message], warnings }; }
  const m = { format: FORMAT, version: VERSION, name: cleanStr(raw.name, LIMITS.name) || 'Sans nom', author: cleanStr(raw.author, 24) };
  m.biome = Object.prototype.hasOwnProperty.call(BIOMES, raw.biome) ? raw.biome : 'prairie';
  if (raw.biome !== m.biome) warnings.push('Biome inconnu « ' + cleanStr(raw.biome, 20) + ' » : remplacé par Prairie.');
  const w = num(raw.width); m.width = Number.isNaN(w) ? 24 : clamp(Math.round(w), LIMITS.width[0], LIMITS.width[1]);
  const lp = num(raw.laps); m.laps = Number.isNaN(lp) ? 3 : clamp(Math.round(lp), LIMITS.laps[0], LIMITS.laps[1]);
  const dg = num(raw.dangers); m.dangers = Number.isNaN(dg) ? 1 : clamp(Math.round(dg), LIMITS.dangers[0], LIMITS.dangers[1]);
  if (!Array.isArray(raw.pieces) || !raw.pieces.length) errors.push('Aucune pièce de route.');
  else if (raw.pieces.length > LIMITS.pieces) errors.push('Trop de pièces (' + raw.pieces.length + ', maximum ' + LIMITS.pieces + ').');
  m.pieces = []; const badIdx = new Set(); let nErr = errors.length;
  (Array.isArray(raw.pieces) ? raw.pieces.slice(0, LIMITS.pieces) : []).forEach((p, i) => {
    if (errors.length > nErr) badIdx.add(i - 1); nErr = errors.length; // pièce précédente en erreur (numérotation d'origine)
    const n = i + 1; if (!p || typeof p !== 'object') { errors.push('Pièce ' + n + ' : invalide.'); return; }
    const q = {};
    if (p.t === 'droite') { const l = num(p.l); if (Number.isNaN(l) || l < PIECES.droite.l[0] || l > PIECES.droite.l[1]) { errors.push('Pièce ' + n + ' : longueur hors limites (' + PIECES.droite.l.join(' à ') + ' m).'); return; } q.t = 'droite'; q.l = +l.toFixed(2); }
    else if (p.t === 'virage') { const a = num(p.a), r = num(p.r); if (Number.isNaN(a) || Math.abs(a) < PIECES.virage.a[0] || Math.abs(a) > PIECES.virage.a[1]) { errors.push('Pièce ' + n + ' : angle hors limites.'); return; }
      if (Number.isNaN(r) || r < PIECES.virage.r[0] || r > PIECES.virage.r[1]) { errors.push('Pièce ' + n + ' : rayon hors limites (' + PIECES.virage.r.join(' à ') + ' m).'); return; } q.t = 'virage'; q.a = +a.toFixed(3); q.r = +r.toFixed(2); }
    else { errors.push('Pièce ' + n + ' : type inconnu « ' + cleanStr(p.t, 20) + ' ».'); return; }
    if (p.dy != null) { const dy = num(p.dy); if (Number.isNaN(dy)) { errors.push('Pièce ' + n + ' : dénivelé invalide.'); return; } q.dy = +clamp(dy, -LIMITS.dy, LIMITS.dy).toFixed(2); }
    if (p.surf != null && p.surf !== 'normal') { if (!SURFACES[p.surf]) warnings.push('Pièce ' + n + ' : surface inconnue ignorée.'); else q.surf = p.surf; }
    if (p.feat != null) { if (!FEATS[p.feat]) warnings.push('Pièce ' + n + ' : élément inconnu ignoré.'); else if (q.t !== 'droite') warnings.push('Pièce ' + n + ' : ' + FEATS[p.feat].nom + ' seulement sur une ligne droite (ignoré).'); else if (q.l < FEATS[p.feat].min) warnings.push('Pièce ' + n + ' : ' + FEATS[p.feat].nom + ' demande ' + FEATS[p.feat].min + ' m (ignoré).'); else q.feat = p.feat; }
    m.pieces.push(q);
  });
  m.sculpt = [];
  if (raw.sculpt != null && !Array.isArray(raw.sculpt)) warnings.push('Sculpture du terrain invalide : ignorée.');
  for (const s of Array.isArray(raw.sculpt) ? raw.sculpt.slice(0, LIMITS.strokes) : []) {
    if (!s || typeof s !== 'object') continue; const x = num(s.x), z = num(s.z), r = num(s.r), h = num(s.h);
    if ([x, z, r, h].some(Number.isNaN) || Math.abs(x) > 6000 || Math.abs(z) > 6000) continue;
    m.sculpt.push({ x: +x.toFixed(1), z: +z.toFixed(1), r: +clamp(r, 8, 160).toFixed(1), h: +clamp(h, -30, 30).toFixed(2), m: s.m === 'lisser' ? 'lisser' : 'relief' });
  }
  if (Array.isArray(raw.sculpt) && raw.sculpt.length > LIMITS.strokes) warnings.push('Sculpture tronquée à ' + LIMITS.strokes + ' coups de pinceau.');
  if (errors.length > nErr && Array.isArray(raw.pieces)) badIdx.add(Math.min(raw.pieces.length, LIMITS.pieces) - 1);
  // Les contrôles géométriques ne tournent que si toutes les pièces sont valides : leurs numéros sont alors ceux d'origine.
  // (Avant, l'éditeur recalculait la géométrie sur la liste nettoyée, où une pièce invalide avait disparu : le rouge tombait
  // sur la pièce suivante.)
  if (!errors.length) { const g = geometry(m); errors.push(...g.errors); warnings.push(...g.warnings); for (const k of g.bad) badIdx.add(k); }
  return { ok: !errors.length, map: m, errors, warnings, bad: [...badIdx].filter((k) => k >= 0).sort((a, b) => a - b) };
}

/* ---------- Géométrie : tortue 3D ---------- */
// Repère du jeu : x += sin(h), z += cos(h) ; un virage d'angle positif tourne « à gauche » (h augmente), comme le bac à sable.
function walk(pieces, opts = {}) {
  let x = 0, z = 0, h = 0, y = 0; const pts = [[0, 0, 0]], spans = []; let L = 0;
  const step = opts.step || 3;
  pieces.forEach((p, k) => {
    const len = p.t === 'droite' ? p.l : Math.abs(p.a) * Math.PI / 180 * p.r, n = Math.max(p.t === 'droite' ? 1 : 2, Math.ceil(len / (p.t === 'droite' ? 20 : step)));
    const y0 = y, dy = p.dy || 0, i0 = pts.length - 1, L0 = L;
    for (let q = 1; q <= n; q++) {
      if (p.t === 'droite') { x += Math.sin(h) * len / n; z += Math.cos(h) * len / n; }
      else { const da = (p.a * Math.PI / 180) / n, hm = h + da / 2, ch = 2 * p.r * Math.sin(Math.abs(da) / 2); x += Math.sin(hm) * ch; z += Math.cos(hm) * ch; h += da; }
      const u = q / n; y = y0 + dy * (u * u * (3 - 2 * u)); // raccord en S : pente nulle aux deux bouts (aucune cassure)
      pts.push([x, z, y]);
    }
    L += len; spans.push({ k, i0, i1: pts.length - 1, L0, L1: L, len });
  });
  return { pts, spans, L, end: { x, z, h, y } };
}
// Erreur de fermeture : écart de position, de cap et de hauteur entre la fin du tracé et la ligne de départ.
function closure(w) { return { gap: Math.hypot(w.end.x, w.end.z), dh: Math.abs(Math.atan2(Math.sin(w.end.h), Math.cos(w.end.h))) * 180 / Math.PI, dy: Math.abs(w.end.y) }; }

/* Fermeture automatique : virage – droite – virage (Dubins) de la fin du tracé vers le départ, le plus court qui se vérifie
   en simulation ; le dénivelé restant est réparti sur les pièces ajoutées. Renvoie la liste des pièces à ajouter, ou null. */
function autoClose(pieces, R, opts = {}) {
  const w = walk(pieces), e = w.end; if (closure(w).gap < .5 && closure(w).dh < 1) return [];
  const best = []; R = R || 40;
  for (const r of [R, R * .8, R * 1.3, R * .6, R * 1.7]) {
    const ctr = (x, z, h, d) => [x + d * r * Math.cos(h), z - d * r * Math.sin(h)];
    for (const d1 of [1, -1]) for (const d2 of [1, -1]) {
      const c1 = ctr(e.x, e.z, e.h, d1), c2 = ctr(0, 0, 0, d2), vx = c2[0] - c1[0], vz = c2[1] - c1[1], D = Math.hypot(vx, vz);
      const cands = [];
      if (d1 === d2) cands.push({ hs: Math.atan2(vx, vz), S: D });
      else if (D >= 2 * r) { const S = Math.sqrt(D * D - 4 * r * r), base = Math.atan2(vx, vz), off = Math.asin(2 * r / D); cands.push({ hs: base + off, S }, { hs: base - off, S }); }
      for (const c of cands) {
        const a1 = mod(d1 * (c.hs - e.h), TAU), a2 = mod(d2 * (0 - c.hs), TAU), add = [];
        if (a1 * 180 / Math.PI > .5) add.push({ t: 'virage', a: d1 * a1 * 180 / Math.PI, r });
        if (c.S > .5) add.push({ t: 'droite', l: c.S });
        if (a2 * 180 / Math.PI > .5) add.push({ t: 'virage', a: d2 * a2 * 180 / Math.PI, r });
        if (add.some((p) => p.t === 'droite' && (p.l < PIECES.droite.l[0] || p.l > PIECES.droite.l[1]))) { // droite trop courte : l'absorber ; trop longue : la couper
          const ix = add.findIndex((p) => p.t === 'droite'); const l = add[ix].l; if (l < PIECES.droite.l[0]) add.splice(ix, 1); else { const n = Math.ceil(l / PIECES.droite.l[1]); add.splice(ix, 1, ...Array.from({ length: n }, () => ({ t: 'droite', l: l / n }))); } }
        const tot = add.reduce((s, p) => s + (p.t === 'droite' ? p.l : Math.abs(p.a) * Math.PI / 180 * p.r), 0); if (!add.length) continue;
        if (add.some((p) => p.t === 'virage' && Math.abs(p.a) > 300)) continue; // pas de boucle complète pour rejoindre le départ
        const test = walk(pieces.concat(add)), cl = closure(test); if (cl.gap > 1 || cl.dh > 1.5) continue;
        // aucune solution qui fait chevaucher la route (avant : des virages de 330° qui recoupaient tout le circuit)
        if (geometry({ width: opts.width || 24, pieces: pieces.concat(add) }).errors.some((e) => /chevauchent|recoupe/.test(e))) continue;
        best.push({ add, tot });
      }
    }
    if (best.length) break;
  }
  if (!best.length) return null;
  best.sort((a, b) => a.tot - b.tot); const add = best[0].add.map((p) => Object.assign({}, p, { a: p.a != null ? +p.a.toFixed(3) : undefined, l: p.l != null ? +p.l.toFixed(2) : undefined }));
  for (const p of add) { if (p.a === undefined) delete p.a; if (p.l === undefined) delete p.l; }
  // Dénivelé restant réparti au prorata des longueurs, borné par la pente maximale.
  const ey = e.y, tot = best[0].tot; if (Math.abs(ey) > .01) for (const p of add) { const len = p.t === 'droite' ? p.l : Math.abs(p.a) * Math.PI / 180 * p.r; p.dy = +(-ey * len / tot).toFixed(2); }
  return add;
}

/* Refermeture locale après une modification (signalement C2-13) : au lieu d'ajouter des pièces en fin de tracé, on ajuste un peu
   les pièces qui SUIVENT la pièce modifiée (longueurs des droites, angles et rayons des virages), la pièce modifiée restant
   telle que l'utilisateur l'a voulue. Moindres carrés amortis (Gauss-Newton, forme de norme minimale : système 3×3) sur les 3
   écarts de fermeture (x, z, cap). On essaie d'abord 2 pièces suivantes, puis 3, 4… ; une solution n'est retenue que si toutes
   les pièces restent dans leurs limites et que le circuit complet est valide (aucun chevauchement). Le dénivelé est rattrapé
   de même sur les pièces suivantes. Renvoie { pieces, changed: [indices] } ou null. */
function reclose(pieces, edited, opts = {}) {
  const N = pieces.length; if (N < 3) return null; const ed = edited == null ? -1 : edited;
  const base = JSON.parse(JSON.stringify(pieces)), width = opts.width || 24;
  const ok = (ps) => { const v = validate({ format: FORMAT, version: VERSION, name: 'x', biome: 'prairie', width, pieces: ps }); return v.ok; };
  const flat = (cl) => cl.gap < .3 && cl.dh < .3;
  const order = []; for (let d = 1; d < N; d++) { const j = mod((ed < 0 ? N - 1 : ed) + d, N); if (j !== ed) order.push(j); } if (ed < 0) order.unshift(N - 1), order.pop();
  for (let K = 2; K <= Math.min(6, order.length); K++) {
    const js = order.slice(0, K), vars = [];
    for (const j of js) { const p = base[j]; if (p.t === 'droite') vars.push({ j, k: 'l', sc: 60, lo: PIECES.droite.l[0], hi: PIECES.droite.l[1] });
      else { vars.push({ j, k: 'a', sc: 60, lo: p.a > 0 ? PIECES.virage.a[0] : -300, hi: p.a > 0 ? 300 : -PIECES.virage.a[0] }); vars.push({ j, k: 'r', sc: 30, lo: PIECES.virage.r[0], hi: PIECES.virage.r[1] }); } }
    if (!vars.some((v) => v.k === 'a') || vars.length < 3) continue; // le cap ne se rattrape que par un angle
    const ps = JSON.parse(JSON.stringify(base)), res = () => { const e = walk(ps, { step: 6 }).end; return [e.x, e.z, Math.atan2(Math.sin(e.h), Math.cos(e.h)) * 60]; };
    let r = res();
    for (let it = 0; it < 40 && Math.hypot(r[0], r[1], r[2]) > .05; it++) {
      const J = vars.map((v) => { const o = ps[v.j][v.k], h = v.k === 'a' ? .2 : .1; ps[v.j][v.k] = o + h; const r2 = res(); ps[v.j][v.k] = o; return r2.map((x, q) => (x - r[q]) / h * v.sc); });
      // du = -Jᵀ (J Jᵀ + λI)⁻¹ r, J de taille 3 × n (colonnes = variables, mises à l'échelle)
      const A = [0, 1, 2].map((a) => [0, 1, 2].map((b) => J.reduce((s, c) => s + c[a] * c[b], 0) + (a === b ? 1e-3 : 0)));
      const y = solve3(A, r); if (!y) break;
      vars.forEach((v, n) => { const du = -(J[n][0] * y[0] + J[n][1] * y[1] + J[n][2] * y[2]) * v.sc; const step = clamp(du, -v.sc, v.sc); ps[v.j][v.k] = clamp(ps[v.j][v.k] + step, v.lo, v.hi); });
      r = res();
    }
    const cl = closure(walk(ps)); if (!flat(cl)) continue;
    for (const v of vars) ps[v.j][v.k] = v.k === 'a' ? +ps[v.j][v.k].toFixed(3) : +ps[v.j][v.k].toFixed(2);
    if (!flat(closure(walk(ps)))) continue;
    // hauteur : rattrapée sur les pièces suivantes (pas sur la pièce modifiée)
    let rest = -walk(ps).end.y;
    for (const j of order) { if (Math.abs(rest) <= .01) break; const p = ps[j], len = p.t === 'droite' ? p.l : Math.abs(p.a) * Math.PI / 180 * p.r, cap = LIMITS.grade * len / 1.5 * .95, cur = p.dy || 0;
      const nv = clamp(cur + rest, Math.max(-cap, -LIMITS.dy), Math.min(cap, LIMITS.dy)); rest -= nv - cur; if (Math.abs(nv) > .005) p.dy = +nv.toFixed(2); else delete p.dy; }
    if (Math.abs(rest) > .05 || !ok(ps)) continue;
    const changed = []; ps.forEach((p, j) => { if (JSON.stringify(p) !== JSON.stringify(base[j])) changed.push(j); });
    return { pieces: ps, changed };
  }
  return null;
}
function solve3(A, b) { const M = A.map((row, i) => row.concat([b[i]]));
  for (let c = 0; c < 3; c++) { let p = c; for (let i = c + 1; i < 3; i++) if (Math.abs(M[i][c]) > Math.abs(M[p][c])) p = i; if (Math.abs(M[p][c]) < 1e-12) return null; [M[c], M[p]] = [M[p], M[c]];
    for (let i = 0; i < 3; i++) if (i !== c) { const f = M[i][c] / M[c][c]; for (let k = c; k < 4; k++) M[i][k] -= f * M[c][k]; } }
  return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]]; }

/* Tracé fermé en plan mais pas en hauteur : l'écart est réparti sur les dernières pièces, en respectant la pente maximale.
   Renvoie une copie des pièces, ou null si l'écart ne peut pas être absorbé. */
function levelFix(pieces) {
  const out = JSON.parse(JSON.stringify(pieces)); let rest = -walk(out).end.y;
  for (let i = out.length - 1; i >= 0 && Math.abs(rest) > .01; i--) { const p = out[i], len = p.t === 'droite' ? p.l : Math.abs(p.a) * Math.PI / 180 * p.r, cap = LIMITS.grade * len / 1.5 * .95, cur = p.dy || 0;
    const nv = clamp(cur + rest, Math.max(-cap, -LIMITS.dy), Math.min(cap, LIMITS.dy)); rest -= nv - cur; if (Math.abs(nv) > .005) p.dy = +nv.toFixed(2); else delete p.dy; }
  return Math.abs(rest) > .05 ? null : out;
}
/* Contrôles géométriques : fermeture, longueur, pentes, chevauchements de chaussée au même niveau. */
function geometry(m) {
  const errors = [], warnings = [], bad = new Set(), w = walk(m.pieces), cl = closure(w);
  if (w.L < LIMITS.minL) errors.push('Circuit trop court (' + Math.round(w.L) + ' m, minimum ' + LIMITS.minL + ' m).');
  if (w.L > LIMITS.maxL) errors.push('Circuit trop long (' + Math.round(w.L) + ' m, maximum ' + LIMITS.maxL + ' m).');
  if (cl.gap > LIMITS.gap || cl.dh > LIMITS.gapA) errors.push('Circuit non fermé : la fin est à ' + Math.round(cl.gap) + ' m et ' + Math.round(cl.dh) + '° du départ. Utilise « Fermer le circuit ».');
  else if (cl.dy > LIMITS.gapH) errors.push('Circuit non fermé en hauteur : la fin est ' + cl.dy.toFixed(1) + ' m ' + (w.end.y > 0 ? 'au-dessus' : 'en dessous') + ' du départ.');
  m.pieces.forEach((p, i) => { const len = p.t === 'droite' ? p.l : Math.abs(p.a) * Math.PI / 180 * p.r; if (p.dy && Math.abs(p.dy) * 1.5 / len > LIMITS.grade) bad.add(i), errors.push('Pièce ' + (i + 1) + ' : pente trop forte (' + Math.round(Math.abs(p.dy) * 150 / len) + ' %, maximum ' + LIMITS.grade * 100 + ' %). Allonge la pièce ou réduis le dénivelé.'); });
  // Chevauchements : échantillons tous les ~6 m ; deux portions éloignées le long du tracé mais proches en plan doivent être
  // séparées d'au moins LIMITS.levelDy en hauteur (pont), sinon les chaussées se mêlent.
  const P = [], step = 6; for (const s of w.spans) { const n = Math.max(1, Math.round(s.len / step)); for (let q = 0; q < n; q++) { const t = s.i0 + (s.i1 - s.i0) * q / n, a = Math.floor(t), b = Math.min(w.pts.length - 1, a + 1), u = t - a; P.push({ x: w.pts[a][0] * (1 - u) + w.pts[b][0] * u, z: w.pts[a][1] * (1 - u) + w.pts[b][1] * u, y: w.pts[a][2] * (1 - u) + w.pts[b][2] * u, s: s.L0 + s.len * q / n, k: s.k }); } }
  const near = m.width + 8, cell = near, grid = new Map(), key = (x, z) => Math.floor(x / cell) + ',' + Math.floor(z / cell); P.forEach((p, i) => { const kk = key(p.x, p.z); if (!grid.has(kk)) grid.set(kk, []); grid.get(kk).push(i); });
  const seen = new Set(); let bridges = 0;
  for (let i = 0; i < P.length; i++) { const p = P[i], cx = Math.floor(p.x / cell), cz = Math.floor(p.z / cell);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const j of grid.get((cx + dx) + ',' + (cz + dz)) || []) {
      if (j <= i) continue; const q = P[j], ds = Math.min(Math.abs(p.s - q.s), w.L - Math.abs(p.s - q.s)); if (ds < near * 3) continue;
      if ((p.x - q.x) ** 2 + (p.z - q.z) ** 2 > near * near) continue;
      const tag = Math.min(p.k, q.k) + '-' + Math.max(p.k, q.k);
      if (Math.abs(p.y - q.y) < LIMITS.levelDy) { bad.add(p.k); bad.add(q.k); if (!seen.has(tag)) { seen.add(tag); errors.push(p.k === q.k ? 'La pièce ' + (p.k + 1) + ' se recoupe elle-même : réduis son angle ou agrandis son rayon.' : 'Les pièces ' + (p.k + 1) + ' et ' + (q.k + 1) + ' se chevauchent au même niveau : écarte-les ou fais passer l\'une au-dessus (≥ ' + LIMITS.levelDy + ' m).'); } }
      else bridges++;
    } }
  if (bridges) warnings.push('Passage(s) en pont détecté(s) : vérifie-les en test.');
  if (!m.pieces.some((p) => p.feat === 'objets')) warnings.push("Aucune boîte d'objets : trois rangées seront ajoutées automatiquement.");
  return { errors, warnings, walk: w, closure: cl, bad: [...bad] };
}

/* ---------- Conversion en circuit du jeu ---------- */
// theme : gabarit (thème du circuit officiel du biome), passé par l'appelant. start : indice de la pièce de départ (test « ici »).
function toDef(m, theme, opts = {}) {
  const st = clamp(opts.start | 0, 0, m.pieces.length - 1), pieces = m.pieces.slice(st).concat(m.pieces.slice(0, st));
  const w = walk(pieces), pts = w.pts.slice(); const last = pts[pts.length - 1]; if (Math.hypot(last[0], last[1]) < 2) pts.pop();
  const y0 = 0, L = w.L, fr = (s) => +(mod(s, L) / L).toFixed(5), boosts = [], items = [], tricks = [], glide = [], tunnels = [], surf = [];
  w.spans.forEach((s) => { const p = pieces[s.k], mid = (s.L0 + s.L1) / 2;
    if (p.surf && p.surf !== 'normal') { surf.push([fr(s.L0), fr(s.L1 - .01), p.surf]); if (p.surf === 'turbo') for (let d = 10; d < s.len - 5; d += 35) boosts.push([fr(s.L0 + d), 0]); }
    if (p.feat === 'objets') items.push(fr(mid));
    if (p.feat === 'boost') boosts.push([fr(mid), 0]);
    if (p.feat === 'tremplin') tricks.push(fr(s.L0 + Math.min(s.len * .6, s.len - 8)));
    if (p.feat === 'planeur') glide.push([fr(s.L0 + s.len * .2), fr(s.L0 + s.len * .8)]);
    if (p.feat === 'tunnel') tunnels.push([fr(s.L0 + 4), fr(s.L1 - 4)]);
  });
  if (!items.length) items.push(.12, .45, .78);
  const th = JSON.parse(JSON.stringify(theme || {})); if (th.terrain && m.sculpt.length) th.terrain.sculpt = m.sculpt.map((s) => Object.assign({}, s));
  const id = opts.id || 'studio-' + hash(JSON.stringify(m)).toString(36);
  return { id, name: m.name, desc: 'Circuit Wild Kart Studio' + (m.author ? ' de ' + m.author : '') + ' — ' + Math.round(L) + ' m', cup: 0, level: 1, laps: m.laps, width: m.width, glideH: 12,
    theme: th, pts: pts.map((p) => [+p[0].toFixed(2), +p[1].toFixed(2), +(p[2] - y0).toFixed(2)]), boosts, items, tricks, glide, tunnels, branches: [], studioSurf: surf, obstZones: m.dangers, studio: true, obst: opts.obst };
}

/* ---------- Partage ---------- */
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const b64e = (s) => { const u = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Buffer.from(s, 'utf8'); let bin = ''; for (const c of u) bin += String.fromCharCode(c); return (typeof btoa !== 'undefined' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const b64d = (s) => { const t = s.replace(/-/g, '+').replace(/_/g, '/'); const bin = typeof atob !== 'undefined' ? atob(t) : Buffer.from(t, 'base64').toString('binary'); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return typeof TextDecoder !== 'undefined' ? new TextDecoder().decode(u) : Buffer.from(u).toString('utf8'); };
// Code compact : en-tête + JSON des champs utiles ; somme de contrôle pour refuser un code tronqué ou modifié par erreur.
function toCode(m) { const body = b64e(JSON.stringify({ format: FORMAT, version: VERSION, name: m.name, author: m.author, biome: m.biome, width: m.width, laps: m.laps, dangers: m.dangers, pieces: m.pieces, sculpt: m.sculpt })); return 'WK1-' + hash(body).toString(36) + '-' + body; }
function fromCode(code) {
  const c = String(code || '').trim().replace(/\s+/g, ''); const mt = /^WK(\d+)-([0-9a-z]+)-([A-Za-z0-9_-]+)$/.exec(c);
  if (!mt) return { ok: false, errors: ['Code de partage invalide.'], warnings: [] };
  if (+mt[1] > VERSION) return { ok: false, errors: ['Code créé avec une version plus récente du Studio : mets le jeu à jour.'], warnings: [] };
  if (hash(mt[3]).toString(36) !== mt[2]) return { ok: false, errors: ['Code incomplet ou modifié (somme de contrôle incorrecte).'], warnings: [] };
  let txt; try { txt = b64d(mt[3]); } catch (e) { return { ok: false, errors: ['Code de partage illisible.'], warnings: [] }; }
  return validate(txt);
}

/* ---------- Sauvegarde locale (navigateur), protégée contre la corruption ---------- */
const STORE = 'wkstudio.maps.v1';
function loadAll(ls) {
  const read = (k) => { try { const t = ls.getItem(k); if (!t) return null; const o = JSON.parse(t); return o && Array.isArray(o.maps) ? o : null; } catch (e) { return null; } };
  const o = read(STORE) || read(STORE + '.bak') || { version: 1, maps: [] }, out = [], bad = [];
  for (const e of o.maps) { const v = validate(e && e.map); if (v.map && v.map.pieces.length) out.push({ id: cleanStr(e.id, 24) || String(hash(JSON.stringify(v.map))), map: v.map, ok: v.ok, saved: +e.saved || 0 }); else bad.push(e && e.id); }
  return { maps: out, bad };
}
function saveAll(ls, maps) {
  const txt = JSON.stringify({ version: 1, maps: maps.slice(0, 40).map((e) => ({ id: e.id, saved: e.saved, map: e.map })) });
  const prev = ls.getItem(STORE);
  try { ls.setItem(STORE, txt); if (ls.getItem(STORE) !== txt) throw new Error('relecture'); if (prev) ls.setItem(STORE + '.bak', prev); return true; }
  catch (e) { try { if (prev) ls.setItem(STORE, prev); } catch (e2) { /* stockage plein */ } return false; }
}

const API = { FORMAT, VERSION, PIECES, SURFACES, FEATS, BIOMES, LIMITS, blank, validate, migrate, walk, closure, autoClose, reclose, levelFix, geometry, toDef, toCode, fromCode, loadAll, saveAll, hash, STORE };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.WKStudioCore = API;
})(typeof window !== 'undefined' ? window : globalThis);
