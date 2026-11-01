/* Wild Kart Studio — éditeur de circuits (interface). Chargé à la demande depuis l'écran titre (openStudio dans game.js).
   Vue de dessus en 2D (aucun rendu 3D ici) : pièces aimantées ajoutées après la pièce choisie, propriétés de surface,
   éléments de gameplay, dénivelés, sculpture du terrain au pinceau, test immédiat (depuis le départ ou depuis la pièce
   choisie) puis retour à l'éditeur dans le même état, sauvegarde locale, fichiers, codes de partage, coupes personnalisées.
   Toutes les données passent par WKStudioCore.validate ; aucun texte de carte n'est injecté en HTML (textContent seulement). */
(function (root) {
'use strict';
const C = root.WKStudioCore, K = () => root.__TK;
const ST = { keepClosed: true, adjusted: null, adjT: 0, map: null, sel: -1, undo: [], redo: [], mode: 'pieces', brush: { m: 'relief', r: 40, h: 6 }, view: { x: 0, z: 0, s: 1 }, check: null, el: null, saved: null, cup: [], dirty: false };
const DRAFT = 'wkstudio.draft';
const $ = (sel, r) => (r || ST.el).querySelector(sel);
const mk = (tag, cls, txt, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; if (parent) parent.appendChild(e); return e; };
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
const LS = { getItem: lsGet, setItem: (k, v) => { localStorage.setItem(k, v); } };
const clone = (o) => JSON.parse(JSON.stringify(o));

/* ---------- état et historique ---------- */
function change(fn, keepSel) {
  ST.undo.push(clone(ST.map)); if (ST.undo.length > 60) ST.undo.shift(); ST.redo.length = 0;
  fn(ST.map); if (!keepSel) ST.sel = Math.min(ST.sel, ST.map.pieces.length - 1); ST.dirty = true; recheck(); lsSet(DRAFT, JSON.stringify({ map: ST.map, saved: ST.saved })); draw(); panel();
}
/* Modification de la géométrie d'une pièce (longueur, angle, rayon, sens, dénivelé, ajout, suppression). Si le circuit était fermé
   et que « Garder le circuit fermé » est coché, les pièces qui SUIVENT sont légèrement ajustées (WKStudioCore.reclose) ; la pièce
   modifiée reste telle quelle, et une seule annulation (↶) revient à l'état d'avant. Signalement C2-13. */
const isClosed = (ps) => { const c = C.closure(C.walk(ps)); return c.gap < 1 && c.dh < 1; };
function edit(ed, fn) { const was = ST.map.pieces.length > 2 && isClosed(ST.map.pieces); let note = null; ST.adjusted = null;
  change((m) => { fn(m); if (!was || !ST.keepClosed || m.pieces.length < 3) return; const cl = C.closure(C.walk(m.pieces)); if (cl.gap < 1 && cl.dh < 1 && cl.dy < .05) return;
    const r = C.reclose(m.pieces, ed, { width: m.width });
    if (r) { m.pieces = r.pieces; const ch = r.changed.filter((j) => j !== ed); ST.adjusted = new Set(ch); ST.adjT = Date.now(); setTimeout(draw, 3100);
      note = ch.length ? (ch.length > 1 ? 'Pièces ' : 'Pièce ') + ch.map((j) => j + 1).join(', ') + ' ajustée' + (ch.length > 1 ? 's' : '') + ' pour garder le circuit fermé (↶ pour annuler).' : null; }
    else note = 'Cette modification ouvre le circuit et ne peut pas être compensée par les pièces suivantes : ajuste-les, ou utilise « Fermer le circuit ».'; }, true);
  if (note) toast(note); }
function undo() { if (!ST.undo.length) return; ST.redo.push(clone(ST.map)); ST.map = ST.undo.pop(); ST.sel = Math.min(ST.sel, ST.map.pieces.length - 1); recheck(); draw(); panel(); }
function redo() { if (!ST.redo.length) return; ST.undo.push(clone(ST.map)); ST.map = ST.redo.pop(); ST.sel = Math.min(ST.sel, ST.map.pieces.length - 1); recheck(); draw(); panel(); }
function recheck() { ST.check = C.validate(ST.map); ST.geo = C.walk(ST.map.pieces); ST.badSet = new Set(ST.check.ok ? [] : ST.check.bad || []); /* numéros d'origine (avant : liste nettoyée, décalée d'une pièce) */ status(); }
function fit() { const w = ST.geo || C.walk(ST.map.pieces); let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const p of w.pts) { a = Math.min(a, p[0]); b = Math.max(b, p[0]); c = Math.min(c, p[1]); d = Math.max(d, p[1]); }
  const cv = $('canvas'), W = cv.clientWidth || 600, H = cv.clientHeight || 400; ST.view.x = (a + b) / 2; ST.view.z = (c + d) / 2; ST.view.s = Math.min(W / (b - a + 120), H / (d - c + 120)); draw(); }

/* ---------- catalogue ---------- */
const PALETTE = [
  ['Droite 40 m', { t: 'droite', l: 40 }], ['Droite 80 m', { t: 'droite', l: 80 }], ['Droite 120 m', { t: 'droite', l: 120 }],
  ['↰ 45°', { t: 'virage', a: 45, r: 50 }], ['↰ 90°', { t: 'virage', a: 90, r: 50 }], ['↱ 45°', { t: 'virage', a: -45, r: 50 }], ['↱ 90°', { t: 'virage', a: -90, r: 50 }],
  ['Épingle ↰', { t: 'virage', a: 180, r: 26 }], ['Épingle ↱', { t: 'virage', a: -180, r: 26 }],
  ['Montée', { t: 'droite', l: 100, dy: 8 }], ['Descente', { t: 'droite', l: 100, dy: -8 }],
  ['Tremplin', { t: 'droite', l: 60, feat: 'tremplin' }], ['Planeur', { t: 'droite', l: 120, feat: 'planeur' }], ['Tunnel', { t: 'droite', l: 80, feat: 'tunnel' }],
  ['Objets', { t: 'droite', l: 40, feat: 'objets' }], ['Plaque turbo', { t: 'droite', l: 40, feat: 'boost' }],
];
function addPiece(p) { const at = ST.sel >= 0 ? ST.sel + 1 : ST.map.pieces.length; edit(at, (m) => { m.pieces.splice(at, 0, clone(p)); ST.sel = at; }); }

/* ---------- dessin (vue de dessus) ---------- */
function w2s(x, z) { const cv = $('canvas'); return [cv.clientWidth / 2 + (x - ST.view.x) * ST.view.s, cv.clientHeight / 2 - (z - ST.view.z) * ST.view.s]; }
function s2w(px, py) { const cv = $('canvas'); return [ST.view.x + (px - cv.clientWidth / 2) / ST.view.s, ST.view.z - (py - cv.clientHeight / 2) / ST.view.s]; }
function draw() {
  if (!ST.el) return; const cv = $('canvas'), dpr = Math.min(2, root.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.fillStyle = '#2f5a34'; x.fillRect(0, 0, W, H);
  // grille de 50 m
  x.strokeStyle = 'rgba(255,255,255,.06)'; x.lineWidth = 1; const g = 50 * ST.view.s; if (g > 8) { const [ox, oy] = w2s(0, 0); for (let gx = ox % g; gx < W; gx += g) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, H); x.stroke(); } for (let gy = oy % g; gy < H; gy += g) { x.beginPath(); x.moveTo(0, gy); x.lineTo(W, gy); x.stroke(); } }
  // pinceaux de terrain
  for (const s of ST.map.sculpt) { const [px, py] = w2s(s.x, s.z); x.beginPath(); x.arc(px, py, s.r * ST.view.s, 0, Math.PI * 2); x.fillStyle = s.m === 'lisser' ? 'rgba(120,190,255,.16)' : s.h > 0 ? 'rgba(210,255,150,.16)' : 'rgba(90,50,20,.24)'; x.fill(); }
  const w = ST.geo || C.walk(ST.map.pieces), wd = Math.max(2, ST.map.width * ST.view.s);
  x.lineCap = 'round'; x.lineJoin = 'round';
  // bordure puis chaussée, pièce par pièce (couleur de surface, rouge si en défaut, contour jaune si choisie) ; plus haut = plus clair
  const adj = ST.adjusted && Date.now() - ST.adjT < 3000 ? ST.adjusted : null; // pièces ajustées automatiquement (bleu, 3 s)
  for (const pass of [0, 1]) w.spans.forEach((s) => { const p = ST.map.pieces[s.k]; x.beginPath(); for (let i = s.i0; i <= s.i1; i++) { const [px, py] = w2s(w.pts[i][0], w.pts[i][1]); if (i === s.i0) x.moveTo(px, py); else x.lineTo(px, py); }
    if (pass === 0) { x.strokeStyle = s.k === ST.sel ? '#ffd23a' : ST.badSet && ST.badSet.has(s.k) ? '#ff3a4a' : adj && adj.has(s.k) ? '#3fb6ff' : '#f4f1e8'; x.lineWidth = wd + Math.max(3, 3 * ST.view.s); }
    else { const yv = (w.pts[s.i0][2] + w.pts[s.i1][2]) / 2; x.strokeStyle = (C.SURFACES[p.surf || 'normal'] || C.SURFACES.normal).couleur; x.lineWidth = wd; x.globalAlpha = 1; x.stroke(); x.strokeStyle = yv > 0 ? 'rgba(255,255,255,' + Math.min(.35, yv / 40) + ')' : 'rgba(0,0,0,' + Math.min(.4, -yv / 30) + ')'; }
    x.stroke(); });
  // pièces en défaut : trait rouge pointillé au milieu de la chaussée, visible même sur la pièce choisie (contour jaune)
  if (ST.badSet && ST.badSet.size) { x.save(); x.setLineDash([8, 6]); x.strokeStyle = '#ff3a4a'; x.lineWidth = Math.max(2, Math.min(5, wd * .25));
    w.spans.forEach((s) => { if (!ST.badSet.has(s.k)) return; x.beginPath(); for (let i = s.i0; i <= s.i1; i++) { const [px, py] = w2s(w.pts[i][0], w.pts[i][1]); if (i === s.i0) x.moveTo(px, py); else x.lineTo(px, py); } x.stroke(); }); x.restore(); }
  // éléments et hauteurs
  x.font = '600 12px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const ICON = { tremplin: '⤴', planeur: '🪂', tunnel: '◗', objets: '❓', boost: '⏩' };
  w.spans.forEach((s) => { const p = ST.map.pieces[s.k], m = w.pts[Math.round((s.i0 + s.i1) / 2)], [px, py] = w2s(m[0], m[1]);
    if (p.feat) { x.fillStyle = '#17143a'; x.fillText(ICON[p.feat] || '•', px, py); }
    if (ST.view.s > .5 || s.k === ST.sel) { x.fillStyle = '#fffdf7'; x.fillText(String(s.k + 1), px, py - wd / 2 - 9); }
    if (p.dy) { x.fillStyle = p.dy > 0 ? '#c8ff8a' : '#ffb07a'; x.fillText((p.dy > 0 ? '+' : '') + Math.round(p.dy) + ' m', px, py + wd / 2 + 10); } });
  // ligne de départ (damier) et point d'aimantation suivant
  { const [px, py] = w2s(0, 0); x.save(); x.translate(px, py); x.fillStyle = '#fff'; x.fillRect(-wd / 2, -3, wd, 6); x.fillStyle = '#111'; for (let q = 0; q < 6; q++) if (q % 2) x.fillRect(-wd / 2 + q * wd / 6, -3, wd / 6, 3); else x.fillRect(-wd / 2 + q * wd / 6, 0, wd / 6, 3); x.restore(); }
  { const s = ST.sel >= 0 ? w.spans[ST.sel] : null, i = s ? s.i1 : w.pts.length - 1, a = w.pts[i], b = w.pts[Math.max(0, i - 1)], [px, py] = w2s(a[0], a[1]), h = Math.atan2(a[0] - b[0], a[1] - b[1]);
    x.save(); x.translate(px, py); x.rotate(h); x.fillStyle = '#ffd23a'; x.beginPath(); x.moveTo(0, -14); x.lineTo(8, 2); x.lineTo(-8, 2); x.closePath(); x.fill(); x.restore(); }
  if (ST.mode === 'terrain') { x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(8, H - 30, 270, 22); x.fillStyle = '#fff'; x.textAlign = 'left'; x.fillText('Terrain : glisse le doigt pour peindre (' + ({ relief: ST.brush.h > 0 ? 'relever' : 'abaisser', lisser: 'lisser' })[ST.brush.m] + ')', 14, H - 19); }
}

/* ---------- interaction sur la carte ---------- */
function pick(px, py) { const w = ST.geo, [wx, wz] = s2w(px, py); let best = -1, bd = 1e18; w.spans.forEach((s) => { for (let i = s.i0; i <= s.i1; i++) { const d = (w.pts[i][0] - wx) ** 2 + (w.pts[i][1] - wz) ** 2; if (d < bd) { bd = d; best = s.k; } } });
  return Math.sqrt(bd) < ST.map.width + 20 / ST.view.s ? best : -1; }
function paint(px, py) { const [wx, wz] = s2w(px, py), b = ST.brush; const last = ST.map.sculpt[ST.map.sculpt.length - 1];
  if (last && Math.hypot(last.x - wx, last.z - wz) < b.r * .35) return; if (ST.map.sculpt.length >= C.LIMITS.strokes) { toast('Nombre maximal de coups de pinceau atteint.'); return; }
  ST.map.sculpt.push({ x: +wx.toFixed(1), z: +wz.toFixed(1), r: b.r, h: b.m === 'lisser' ? 6 : b.h, m: b.m }); draw(); }
function bindCanvas(cv) {
  const pts = new Map(); let drag = null, pinch = null;
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: ST.view.s }; drag = null; return; }
    drag = { x: e.offsetX, y: e.offsetY, vx: ST.view.x, vz: ST.view.z, moved: false };
    if (ST.mode === 'terrain') { ST.undo.push(clone(ST.map)); ST.redo.length = 0; paint(e.offsetX, e.offsetY); } });
  cv.addEventListener('pointermove', (e) => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; ST.view.s = Math.max(.05, Math.min(6, pinch.s * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d)); draw(); return; }
    if (!drag) return; if (Math.hypot(e.offsetX - drag.x, e.offsetY - drag.y) > 6) drag.moved = true;
    if (ST.mode === 'terrain') { paint(e.offsetX, e.offsetY); return; }
    if (drag.moved) { ST.view.x = drag.vx - (e.offsetX - drag.x) / ST.view.s; ST.view.z = drag.vz + (e.offsetY - drag.y) / ST.view.s; draw(); } });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
    if (drag && !drag.moved && ST.mode === 'pieces') { ST.sel = pick(e.offsetX, e.offsetY); draw(); panel(); }
    if (drag && ST.mode === 'terrain') { ST.dirty = true; recheck(); lsSet(DRAFT, JSON.stringify({ map: ST.map, saved: ST.saved })); }
    drag = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); ST.view.s = Math.max(.05, Math.min(6, ST.view.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); draw(); }, { passive: false });
}

/* ---------- panneaux ---------- */
function toast(msg) { const t = $('.wks-toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => (t.hidden = true), 3200); }
function status() {
  if (!ST.el) return; const c = ST.check, w = ST.geo, cl = C.closure(w), st = $('.wks-status'); st.textContent = '';
  mk('b', null, Math.round(w.L) + ' m · ' + ST.map.pieces.length + ' pièces · ', st);
  mk('span', c.ok ? 'ok' : 'ko', c.ok ? '✔ circuit valide' : '✖ ' + c.errors.length + ' problème(s)', st);
  if (!c.ok && cl.gap > 1) mk('span', null, ' · fin à ' + Math.round(cl.gap) + ' m du départ', st);
  const list = $('.wks-msgs'); list.textContent = ''; for (const e of c.errors.slice(0, 6)) { const li = mk('li', 'ko', e, list), n = /[Pp]i[èe]ces? (\d+)/.exec(e); if (n) { li.style.cursor = 'pointer'; li.title = 'Afficher la pièce'; li.onclick = () => { ST.sel = Math.min(+n[1] - 1, ST.map.pieces.length - 1); draw(); panel(); }; } } for (const e of c.warnings.slice(0, 4)) mk('li', 'warn', e, list);
}
function field(parent, label, input) { const l = mk('label', 'wks-f', null, parent); mk('span', null, label, l); l.appendChild(input); return input; }
function select(opts, val, on) { const s = document.createElement('select'); for (const [v, t] of opts) { const o = mk('option', null, t, s); o.value = v; } s.value = val; s.onchange = () => on(s.value); return s; }
function stepper(val, step, min, max, unit, on) { const b = mk('span', 'wks-step'); const m = mk('button', null, '−', b), v = mk('b', null, val + unit, b), p = mk('button', null, '+', b);
  m.onclick = () => on(Math.max(min, +(val - step).toFixed(2))); p.onclick = () => on(Math.min(max, +(val + step).toFixed(2))); return b; }
function panel() {
  if (!ST.el) return; const P = $('.wks-sel'); P.textContent = ''; const i = ST.sel, p = ST.map.pieces[i];
  if (ST.mode === 'terrain') { mk('h4', null, 'Sculpture du terrain', P);
    field(P, 'Pinceau', select([['relief+', 'Relever'], ['relief-', 'Abaisser'], ['lisser', 'Lisser']], ST.brush.m === 'lisser' ? 'lisser' : ST.brush.h > 0 ? 'relief+' : 'relief-', (v) => { ST.brush.m = v === 'lisser' ? 'lisser' : 'relief'; ST.brush.h = v === 'relief-' ? -Math.abs(ST.brush.h) : Math.abs(ST.brush.h); panel(); draw(); }));
    P.appendChild(stepper(ST.brush.r, 10, 10, 150, ' m', (v) => { ST.brush.r = v; panel(); })); mk('small', null, ' taille', P);
    if (ST.brush.m !== 'lisser') { P.appendChild(stepper(Math.abs(ST.brush.h), 2, 2, 30, ' m', (v) => { ST.brush.h = Math.sign(ST.brush.h || 1) * v; panel(); })); mk('small', null, ' intensité', P); }
    const n = mk('p', 'wks-note', ST.map.sculpt.length + ' coup(s) de pinceau. La plate-forme de la route reste plane ; seuls ses abords changent.', P);
    if (!(themeOf(ST.map.biome) || {}).terrain) n.textContent += ' Ce biome n\'a pas de terrain naturel : la sculpture n\'y a pas d\'effet.';
    const b = mk('button', 'wks-b', 'Effacer la sculpture', P); b.onclick = () => change((m) => { m.sculpt = []; }); return; }
  if (!p) { mk('p', 'wks-note', 'Touche une pièce pour la modifier. Les nouvelles pièces s\'aimantent après la pièce choisie (flèche jaune), ou en fin de tracé.', P); return; }
  mk('h4', null, 'Pièce ' + (i + 1) + ' — ' + (p.t === 'droite' ? 'ligne droite' : p.a > 0 ? 'virage à gauche' : 'virage à droite'), P);
  const row = mk('div', 'wks-row', null, P);
  if (p.t === 'droite') { row.appendChild(stepper(p.l, 10, C.PIECES.droite.l[0], C.PIECES.droite.l[1], ' m', (v) => edit(i, (m) => { m.pieces[i].l = v; }))); }
  else { row.appendChild(stepper(Math.abs(p.a), 15, 15, 270, '°', (v) => edit(i, (m) => { m.pieces[i].a = Math.sign(p.a) * v; })));
    row.appendChild(stepper(p.r, 5, C.PIECES.virage.r[0], C.PIECES.virage.r[1], ' m', (v) => edit(i, (m) => { m.pieces[i].r = v; })));
    const inv = mk('button', 'wks-b', '⇄', row); inv.title = 'Inverser le sens'; inv.onclick = () => edit(i, (m) => { m.pieces[i].a = -m.pieces[i].a; }); }
  mk('small', null, 'Dénivelé ', P); P.appendChild(stepper(p.dy || 0, 2, -C.LIMITS.dy, C.LIMITS.dy, ' m', (v) => edit(i, (m) => { if (v) m.pieces[i].dy = v; else delete m.pieces[i].dy; })));
  field(P, 'Surface', select(Object.entries(C.SURFACES).map(([k, s]) => [k, s.nom]), p.surf || 'normal', (v) => change((m) => { if (v === 'normal') delete m.pieces[i].surf; else m.pieces[i].surf = v; }, true)));
  if (p.t === 'droite') field(P, 'Élément', select([['', 'Aucun']].concat(Object.entries(C.FEATS).map(([k, f]) => [k, f.nom + ' (≥ ' + f.min + ' m)'])), p.feat || '', (v) => change((m) => { if (v) m.pieces[i].feat = v; else delete m.pieces[i].feat; }, true)));
  const r2 = mk('div', 'wks-row', null, P);
  const del = mk('button', 'wks-b red', 'Supprimer', r2); del.onclick = () => edit(i - 1, (m) => { m.pieces.splice(i, 1); ST.sel = i - 1; });
  const here = mk('button', 'wks-b', 'Tester ici', r2); here.onclick = () => playtest(i);
  const kc = mk('label', 'wks-f wks-keep', null, P), cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = ST.keepClosed; cb.onchange = () => { ST.keepClosed = cb.checked; }; kc.appendChild(cb); mk('span', null, 'Garder le circuit fermé (ajuste les pièces suivantes)', kc);
}

/* ---------- biomes, test, sauvegarde, partage ---------- */
function themeOf(biome) { const src = (C.BIOMES[biome] || C.BIOMES.prairie).src, t = (K().TRACKS || []).find((d) => d.id === src) || (K().TRACKS || [])[0]; return t && t.theme; }
function obstOf(biome) { const src = (C.BIOMES[biome] || C.BIOMES.prairie).src, t = (K().TRACKS || []).find((d) => d.id === src); return t && t.obst ? clone(t.obst) : undefined; }
// Insère les circuits dans la liste du jeu le temps de la course, et les retire au retour (ils n'entrent ni dans le Grand Prix
// officiel, ni dans les tirages en ligne, ni dans les succès « tous les circuits »).
function mount(defs) { const T = K().TRACKS; for (const d of defs) { const old = T.findIndex((t) => t.id === d.id); if (old >= 0) T.splice(old, 1); } const first = T.length; T.push(...defs); return defs.map((d, q) => first + q); }
function unmount() { const T = K().TRACKS; for (let i = T.length - 1; i >= 0; i--) if (T[i] && T[i].studio) T.splice(i, 1); }
function playtest(start) {
  const v = C.validate(ST.map); if (!v.ok) { toast('Corrige d\'abord : ' + v.errors[0]); return; }
  const k = K(), def = C.toDef(v.map, themeOf(v.map.biome), { start: start || 0, obst: obstOf(v.map.biome) });
  const [ti] = mount([def]); const prevTrack = k.UI.track, prevMode = k.UI.mode;
  k.UI.mode = 'quick'; k.UI.track = ti; ST.returnView = clone(ST.view);
  k.UI.afterMenu = () => { unmount(); k.UI.track = prevTrack; k.UI.mode = prevMode; open(true); };
  close(true); const fail = (e) => { unmount(); k.UI.afterMenu = null; open(true); toast('Le test n\'a pas pu démarrer : ' + e.message); }; try { return Promise.resolve(k.launch()).catch(fail); } catch (e) { fail(e); }
}
function playCup(entries) {
  const defs = []; for (const e of entries) { const v = C.validate(e.map); if (!v.ok) { toast('« ' + e.map.name + ' » n\'est pas valide : ' + v.errors[0]); return; } defs.push(C.toDef(v.map, themeOf(v.map.biome), { id: 'studio-' + e.id, obst: obstOf(v.map.biome) })); }
  if (!defs.length) { toast('Choisis au moins un circuit pour la coupe.'); return; }
  const k = K(), list = mount(defs), prevMode = k.UI.mode; k.UI.mode = 'gp'; k.UI.gp = { i: 0, cc: k.SAVE.cc, points: {}, list, studio: true };
  k.UI.afterMenu = () => { unmount(); k.UI.mode = prevMode; open(true); }; close(true); return k.launch();
}
function saveMap() {
  const v = C.validate(ST.map); const all = C.loadAll(LS).maps; const id = ST.saved || 'c' + Date.now().toString(36);
  const e = { id, saved: Date.now(), map: v.map }; const i = all.findIndex((x) => x.id === id); if (i >= 0) all[i] = e; else all.unshift(e);
  if (all.length > 40) { toast('40 circuits au maximum : supprime-en un.'); return; }
  if (C.saveAll(LS, all)) { ST.saved = id; ST.dirty = false; lsSet(DRAFT, JSON.stringify({ map: ST.map, saved: id })); toast('Circuit enregistré' + (v.ok ? '.' : ' (encore non valide).')); } else toast('Enregistrement impossible : stockage plein ou bloqué.');
}
function loadInto(map, id, notes) { ST.undo.push(clone(ST.map)); ST.map = clone(map); ST.saved = id || null; ST.sel = -1; recheck(); fit(); panel(); headerSync(); if (notes && notes.length) toast(notes[0]); }
function importText(txt) { const v = /^\s*WK\d+-/.test(txt) ? C.fromCode(txt) : C.validate(txt); if (!v.map || !v.map.pieces || !v.map.pieces.length || (!v.ok && v.errors.some((e) => /format|illisible|invalide|récente|volumineux|Contenu|Code/.test(e)))) { toast('Import refusé : ' + (v.errors[0] || 'contenu invalide')); return false; }
  loadInto(v.map, null, v.ok ? v.warnings : ['Importé avec des problèmes à corriger : ' + v.errors[0]]); return true; }
function exportFile() { const v = C.validate(ST.map), blob = new Blob([JSON.stringify(v.map, null, 1)], { type: 'application/json' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = (v.map.name || 'circuit').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() + '.wkmap.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
function dialog(title, build) { const d = mk('div', 'wks-dlg', null, ST.el), box = mk('div', 'wks-box', null, d); mk('h3', null, title, box); build(box, () => d.remove()); const x = mk('button', 'wks-b', 'Fermer', box); x.onclick = () => d.remove(); d.onclick = (e) => { if (e.target === d) d.remove(); }; return d; }
function shareDlg() { const v = C.validate(ST.map); dialog('Partager', (box) => {
  if (!v.ok) mk('p', 'wks-note ko', 'Attention : ce circuit n\'est pas encore valide.', box);
  mk('p', 'wks-note', 'Code de partage (à envoyer à un ami, qui le colle dans « Importer ») :', box); const ta = mk('textarea', 'wks-code', null, box); ta.readOnly = true; ta.value = C.toCode(v.map);
  const r = mk('div', 'wks-row', null, box); const cp = mk('button', 'wks-b', 'Copier le code', r); cp.onclick = () => { ta.select(); (navigator.clipboard ? navigator.clipboard.writeText(ta.value) : Promise.reject()).then(() => toast('Code copié.'), () => { document.execCommand && document.execCommand('copy'); toast('Code sélectionné : copie-le.'); }); };
  const ex = mk('button', 'wks-b', 'Exporter un fichier', r); ex.onclick = exportFile;
  mk('p', 'wks-note', 'Catalogue en ligne : indisponible (aucun serveur prévu pour l\'instant). Le partage passe par le code ou le fichier.', box); }); }
function importDlg() { dialog('Importer un circuit', (box, done) => {
  mk('p', 'wks-note', 'Colle un code de partage ou le contenu d\'un fichier .wkmap.json, ou choisis un fichier.', box); const ta = mk('textarea', 'wks-code', null, box);
  const r = mk('div', 'wks-row', null, box); const go = mk('button', 'wks-b red', 'Importer', r); go.onclick = () => { if (importText(ta.value)) done(); };
  const f = mk('input', null, null, r); f.type = 'file'; f.accept = '.json,.wkmap,application/json'; f.onchange = () => { const file = f.files[0]; if (!file) return; if (file.size > 200000) { toast('Fichier trop volumineux.'); return; } file.text().then((t) => { if (importText(t)) done(); }); }; }); }
function listDlg() { const r = C.loadAll(LS); dialog('Mes circuits et coupes', (box, done) => {
  if (r.bad.length) mk('p', 'wks-note ko', r.bad.length + ' sauvegarde(s) illisible(s) ignorée(s).', box);
  if (!r.maps.length) mk('p', 'wks-note', 'Aucun circuit enregistré.', box);
  const cup = new Set(); const ul = mk('ul', 'wks-list', null, box);
  for (const e of r.maps) { const li = mk('li', null, null, ul); const cb = mk('input', null, null, li); cb.type = 'checkbox'; cb.title = 'Dans la coupe'; cb.onchange = () => { if (cb.checked) { if (cup.size >= 8) { cb.checked = false; toast('8 circuits au maximum par coupe.'); return; } cup.add(e); } else cup.delete(e); };
    mk('b', null, e.map.name, li); mk('small', e.ok ? 'ok' : 'ko', e.ok ? ' ✔' : ' ✖ à corriger', li);
    const o = mk('button', 'wks-b', 'Ouvrir', li); o.onclick = () => { loadInto(e.map, e.id); done(); };
    const d = mk('button', 'wks-b red', '🗑', li); d.title = 'Supprimer'; d.onclick = () => { if (!root.confirm('Supprimer « ' + e.map.name + ' » ?')) return; C.saveAll(LS, C.loadAll(LS).maps.filter((x) => x.id !== e.id)); done(); listDlg(); }; }
  const row = mk('div', 'wks-row', null, box); const nw = mk('button', 'wks-b', 'Nouveau circuit', row); nw.onclick = () => { loadInto(C.blank(), null); done(); };
  if (r.maps.length) { const go = mk('button', 'wks-b red', 'Lancer la coupe perso', row); go.onclick = () => { const sel = r.maps.filter((e) => cup.has(e)); if (!sel.length) { toast('Coche les circuits de la coupe (dans l\'ordre de la liste).'); return; } done(); playCup(sel); }; } }); }
function closeAuto() {
  // d'abord, ajuster les pièces existantes (après la pièce choisie, sinon en fin de tracé) si l'écart est modéré ; sinon, ajouter des pièces
  { const cl = C.closure(C.walk(ST.map.pieces)); if (ST.map.pieces.length > 2 && (cl.gap > .5 || cl.dh > .5) && cl.gap < 120) { const ed = ST.sel >= 0 ? ST.sel : -1, r = C.reclose(ST.map.pieces, ed, { width: ST.map.width });
    if (r) { const ch = r.changed.filter((j) => j !== ed); change((m) => { m.pieces = r.pieces; }, true); ST.adjusted = new Set(ch); ST.adjT = Date.now(); setTimeout(draw, 3100); draw(); toast('Circuit refermé en ajustant ' + (ch.length > 1 ? 'les pièces ' : 'la pièce ') + ch.map((j) => j + 1).join(', ') + ' (↶ pour annuler).'); return; } } }
  const add = C.autoClose(ST.map.pieces, 40, { width: ST.map.width }); if (add === null) { toast('Fermeture impossible depuis ici : rapproche la fin du départ.'); return; }
  if (!add.length) { if (C.closure(C.walk(ST.map.pieces)).dy <= .05) { toast('Le circuit est déjà fermé.'); return; } const fx = C.levelFix(ST.map.pieces); if (!fx) { toast('Écart de hauteur trop grand : ajoute une descente ou une montée.'); return; }
    change((m) => { m.pieces = fx; }, true); toast('Dénivelé des dernières pièces ajusté pour rejoindre le départ.'); return; }
  change((m) => { m.pieces.push(...add); ST.sel = m.pieces.length - 1; }, true); toast(add.length + ' pièce(s) ajoutée(s) pour rejoindre le départ.'); }

/* ---------- construction de l'écran ---------- */
const CSS = `.wks{position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;background:#17143a;color:#fffdf7;font:14px/1.3 system-ui,sans-serif;touch-action:none}
.wks header{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:6px 10px;background:#221d55}
.wks header h2{margin:0 8px 0 0;font-size:16px;color:#ffd23a}.wks input[type=text]{width:150px}
.wks input,.wks select,.wks textarea{background:#2e2870;color:#fff;border:1px solid #5a52b0;border-radius:6px;padding:4px 6px;font:inherit;min-height:34px;box-sizing:border-box}.wks input[type=checkbox]{min-height:0;width:24px;height:24px}
.wks-main{flex:1;display:flex;min-height:0}.wks-map{flex:1;position:relative;min-width:0}.wks canvas{width:100%;height:100%;display:block;touch-action:none}
.wks-side{width:280px;overflow:auto;padding:8px;background:#1d1948;display:flex;flex-direction:column;gap:6px}
.wks-pal{display:flex;gap:6px;overflow-x:auto;padding:6px 10px;background:#221d55;flex-wrap:nowrap}
.wks-b{background:#3a33a0;color:#fff;border:0;border-radius:8px;padding:7px 10px;min-height:34px;font:600 13px system-ui,sans-serif;white-space:nowrap;cursor:pointer}
.wks-b.red{background:#ff4f3a}.wks-b.on{background:#ffc531;color:#17143a}.wks-b:disabled{opacity:.4}
.wks-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.wks-f{display:flex;gap:6px;align-items:center}.wks-f span{opacity:.8}
.wks-step{display:inline-flex;align-items:center;gap:4px}.wks-step button{width:30px;height:30px;border-radius:8px;border:0;background:#3a33a0;color:#fff;font-size:18px}
.wks-step b{min-width:58px;text-align:center}.wks h4{margin:2px 0;color:#ffd23a}.wks-note{opacity:.85;font-size:12.5px;margin:4px 0}
.wks .ok{color:#7dffa0}.wks .ko{color:#ff8a8a}.wks .warn{color:#ffd88a}.wks-msgs{margin:0;padding-left:16px;font-size:12.5px}.wks-status{font-size:13px}
.wks-toast{position:absolute;left:50%;top:10px;transform:translateX(-50%);background:rgba(0,0,0,.8);padding:8px 14px;border-radius:10px;max-width:90%}
.wks-zoom{position:absolute;right:8px;top:8px;display:flex;flex-direction:column;gap:4px}
.wks-dlg{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:9001}
.wks-box{background:#221d55;border-radius:14px;padding:14px;width:min(520px,92vw);max-height:86vh;overflow:auto;display:flex;flex-direction:column;gap:8px}
.wks-box h3{margin:0;color:#ffd23a}.wks-code{width:100%;min-height:90px;box-sizing:border-box;font:12px monospace}
.wks-list{list-style:none;margin:0;padding:0}.wks-list li{display:flex;gap:6px;align-items:center;padding:4px 0;border-bottom:1px solid #3a3480}.wks-list b{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media (max-width:760px){.wks-main{flex-direction:column}.wks-side{width:auto;max-height:38vh}.wks header input[type=text]{width:110px}}`;
function headerSync() { if (!ST.el) return; $('.wks-name').value = ST.map.name; $('.wks-biome').value = ST.map.biome; $('.wks-w').value = ST.map.width; $('.wks-laps').value = ST.map.laps; $('.wks-dg').value = ST.map.dangers; }
function build() {
  if (!document.getElementById('wks-css')) { const s = mk('style', null, CSS, document.head); s.id = 'wks-css'; }
  const el = mk('div', 'wks', null, document.body); ST.el = el;
  const h = mk('header', null, null, el); const back = mk('button', 'wks-b', '← Menu', h); back.onclick = () => close();
  mk('h2', null, 'Wild Kart Studio', h);
  const nm = mk('input', 'wks-name', null, h); nm.type = 'text'; nm.maxLength = C.LIMITS.name; nm.onchange = () => change((m) => { m.name = nm.value.slice(0, C.LIMITS.name) || 'Sans nom'; }, true);
  h.appendChild(select(Object.entries(C.BIOMES).map(([k, b]) => [k, b.nom]), 'prairie', (v) => change((m) => { m.biome = v; }, true))).className = 'wks-biome';
  field(h, 'Largeur', select([[18, '18 m'], [22, '22 m'], [24, '24 m'], [28, '28 m'], [32, '32 m']], 24, (v) => change((m) => { m.width = +v; }, true))).className = 'wks-w';
  field(h, 'Tours', select([[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']], 3, (v) => change((m) => { m.laps = +v; }, true))).className = 'wks-laps';
  field(h, 'Dangers', select([[0, 'aucun'], [1, 'peu'], [3, 'moyen'], [5, 'beaucoup']], 1, (v) => change((m) => { m.dangers = +v; }, true))).className = 'wks-dg';
  const pal = mk('div', 'wks-pal', null, el);
  const modeP = mk('button', 'wks-b on', 'Pièces', pal), modeT = mk('button', 'wks-b', 'Terrain', pal);
  const setMode = (md) => { ST.mode = md; modeP.classList.toggle('on', md === 'pieces'); modeT.classList.toggle('on', md === 'terrain'); panel(); draw(); }; modeP.onclick = () => setMode('pieces'); modeT.onclick = () => setMode('terrain');
  for (const [label, p] of PALETTE) { const b = mk('button', 'wks-b', label, pal); b.onclick = () => { setMode('pieces'); addPiece(p); }; }
  const main = mk('div', 'wks-main', null, el), mapEl = mk('div', 'wks-map', null, main), cv = mk('canvas', null, null, mapEl); bindCanvas(cv);
  const z = mk('div', 'wks-zoom', null, mapEl); for (const [t, f] of [['+', 1.25], ['−', .8], ['⤢', 0]]) { const b = mk('button', 'wks-b', t, z); b.onclick = () => { if (!f) fit(); else { ST.view.s = Math.max(.05, Math.min(6, ST.view.s * f)); draw(); } }; }
  mk('div', 'wks-toast', null, mapEl).hidden = true;
  const side = mk('div', 'wks-side', null, main); mk('div', 'wks-status', null, side); mk('ul', 'wks-msgs', null, side);
  const acts = mk('div', 'wks-row', null, side);
  for (const [t, f, cls] of [['↶ Annuler', undo], ['↷ Rétablir', redo], ['Fermer le circuit', closeAuto], ['▶ Tester', () => playtest(0), 'red'], ['Enregistrer', saveMap], ['Mes circuits / coupe', listDlg], ['Partager', shareDlg], ['Importer', importDlg]]) { const b = mk('button', 'wks-b' + (cls ? ' ' + cls : ''), t, acts); b.onclick = f; }
  mk('div', 'wks-sel', null, side);
  root.addEventListener('resize', () => draw());
  root.addEventListener('keydown', (e) => { if (!ST.el || ST.el.hidden || /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); } else if (e.key === 'Delete' && ST.sel >= 0) { const i = ST.sel; edit(i - 1, (m) => { m.pieces.splice(i, 1); ST.sel = i - 1; }); } });
}
/* Ouverture : reprend le brouillon (même état qu'avant le test) ; fromTest garde aussi la vue. */
function open(fromTest) {
  if (!ST.el) build();
  if (!ST.map) { let d = null; try { d = JSON.parse(lsGet(DRAFT) || 'null'); } catch (e) { d = null; } const v = d && C.validate(d.map); ST.map = v && v.map && v.map.pieces.length ? v.map : C.blank(); ST.saved = d && d.saved || null; }
  ST.el.hidden = false; const k = K(); if (k && k.show) k.show(null);
  recheck(); headerSync(); panel(); if (fromTest && ST.returnView) { ST.view = ST.returnView; draw(); } else requestAnimationFrame(fit);
}
function close(toGame) { if (ST.el) ST.el.hidden = true; if (!toGame) { const k = K(); if (k && k.show) k.show('title'); } }
root.WKStudio = { open, close, state: ST, playtest, playCup, importText, saveMap, closeAuto, addPiece, undo, redo, unmount };
})(window);
