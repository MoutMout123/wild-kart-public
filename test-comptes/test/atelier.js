/* #34.G2 — Prototype de l'« Atelier de kart » (concept approuvé le 6 nov. 2026, docs/atelier/g1/CONCEPT.md).
   Deux portes : le CHOIX RAPIDE (garage actuel, inchangé) et « Créer mon kart » (cet atelier). Parcours : familles de pièces
   (« Conduite » si la pièce change le vrai calcul statsFor, « Apparence » sinon ; familles futures « bientôt ») → comparer avec les
   vrais deltas → garder → essayer un tour (le brouillon, sans l'équiper) → retour au même brouillon → enregistrer dans un des
   3 montages (schéma extensible) → équiper après confirmation. Annuler / rétablir / pièce d'avant. Rien n'est équipé sans
   « Équiper » ; le brouillon survit à l'essai et au rechargement (SAVE.atelier).
   Script classique chargé après game.js ; game.js est enveloppé : tout passe par window.__TK (SAVE n'est jamais réaffecté). */
(function () {
  'use strict';
  const K = window.__TK; if (!K || !K.SAVE || typeof K.statsFor !== 'function') return;
  // Client d'essai des comptes (test-comptes-…) : l'exception de publication ne couvre que l'essai des comptes ; le prototype G2,
  // présenté avant toute diffusion, n'y est pas activé.
  if (/^test-comptes-/.test(String(window.WK_TEST || ''))) return;
  const { SAVE, store, statsFor, BODIES, WHEELS, GLIDERS, PILOTS, ACCS, FINISHES, DECOS, TRAILS, COLORS, SKINS, lockInfo, GS, refreshGarageKart, show, launchPrepared, UI, TRACKS, toast, AudioSys, ownedColors } = K;
  const VERSION = 1, NB_MONTAGES = 3;
  const CLES = ['body', 'wheels', 'glider', 'pilot', 'color', 'helmet', 'skin', 'acc', 'finish', 'deco', 'trail'];
  const NOMS_STATS = [['speed', 'Vitesse'], ['accel', 'Accélération'], ['handling', 'Maniabilité'], ['weight', 'Poids'], ['off', 'Tout-terrain'], ['air', 'Planeur']];
  // Familles : l'étiquette « conduite » est CALCULÉE (une pièce de la famille change réellement statsFor) ; sinon « apparence ».
  // Constat du 6 nov. : les 12 planeurs ont le même effet (choix de conception du jeu) → Planeur = Apparence.
  const FAMILLES = [
    { id: 'body', nom: 'Carrosserie', type: 'auto', table: () => BODIES, nb: () => Object.keys(BODIES).length },
    { id: 'wheels', nom: 'Roues', type: 'auto', table: () => WHEELS, nb: () => Object.keys(WHEELS).length },
    { id: 'glider', nom: 'Planeur', type: 'auto', table: () => GLIDERS, nb: () => Object.keys(GLIDERS).length },
    { id: 'pilot', nom: 'Pilote', type: 'apparence', table: () => PILOTS, nb: () => Object.keys(PILOTS).length },
    { id: 'color', nom: 'Peinture', type: 'apparence', couleurs: () => COLORS.concat(typeof ownedColors === 'function' ? ownedColors() : []) },
    { id: 'helmet', nom: '2e couleur', type: 'apparence', couleurs: () => COLORS },
    { id: 'finish', nom: 'Finition', type: 'apparence', table: () => FINISHES },
    { id: 'deco', nom: 'Déco', type: 'apparence', table: () => DECOS },
    { id: 'acc', nom: 'Accessoire', type: 'apparence', table: () => ACCS },
    { id: 'trail', nom: 'Turbo', type: 'apparence', table: () => TRAILS },
    { id: 'moteur', nom: 'Moteur & suspension', type: 'bientot', aide: 'à développer : « Conduite » seulement si l\'effet est démontré' },
    { id: 'pieces', nom: 'Ailes, aileron, échappements', type: 'bientot', aide: 'pièces indépendantes à séparer (raccords G0 prêts)' }
  ];
  for (const f of FAMILLES) if (f.type === 'auto') { const base = { body: 'equilibre', wheels: 'standard', glider: 'classique' }, ref = JSON.stringify(statsFor(base.body, base.wheels, base.glider));
    f.type = Object.keys(f.table()).some((v) => { const c = Object.assign({}, base, { [f.id]: v }); return JSON.stringify(statsFor(c.body, c.wheels, c.glider)) !== ref; }) ? 'conduite' : 'apparence'; }
  const $a = (s) => document.querySelector(s), esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const equipe = () => { const o = {}; for (const k of CLES) o[k] = SAVE[k]; return o; };
  // Validation d'une configuration (montage relu, brouillon restauré) : uniquement des clés et des valeurs connues.
  function valide(cfg) {
    if (!cfg || typeof cfg !== 'object') return null; const o = {}, base = equipe();
    for (const k of CLES) { const v = cfg[k], F = FAMILLES.find((f) => f.id === k);
      let ok = false; if (typeof v === 'string') { if (F && F.table) ok = Object.prototype.hasOwnProperty.call(F.table(), v); else if (F && F.couleurs) ok = /^#[0-9a-f]{6}$/i.test(v); else if (k === 'skin') ok = SKINS.includes(v); }
      o[k] = ok ? v : base[k]; }
    return o;
  }
  // État persistant : { v, montages: [ {nom, cfg} | null ] (≥ 3, extensible), brouillon: {cfg, slot, histo, redo, depart}, famille }
  function etat() {
    let A = SAVE.atelier; if (!A || A.v !== VERSION || !Array.isArray(A.montages)) A = { v: VERSION, montages: [], brouillon: null, famille: 'body' };
    A.montages = A.montages.slice(0, 20).map((m) => (m && typeof m === 'object' && valide(m.cfg) ? { nom: String(m.nom || 'Montage').slice(0, 16), cfg: valide(m.cfg) } : null));
    while (A.montages.length < NB_MONTAGES) A.montages.push(null);
    if (!A.brouillon || !valide(A.brouillon.cfg)) A.brouillon = null; else { A.brouillon.cfg = valide(A.brouillon.cfg); A.brouillon.histo = (A.brouillon.histo || []).map(valide).filter(Boolean).slice(-30); A.brouillon.redo = (A.brouillon.redo || []).map(valide).filter(Boolean).slice(-30); A.brouillon.depart = valide(A.brouillon.depart) || A.brouillon.cfg; }
    if (!FAMILLES.some((f) => f.id === A.famille && f.type !== 'bientot')) A.famille = 'body';
    SAVE.atelier = A; return A;
  }
  const sauver = () => { try { store(); } catch (e) { /* stockage indisponible : l'atelier reste utilisable */ } };
  const ATL = { ouvert: false, vue: '3/4', choix: null, comparer: null, quitter: false, messageEssai: '' };
  function brouillon() { const A = etat(); if (!A.brouillon) { const c = equipe(); A.brouillon = { cfg: c, slot: -1, histo: [], redo: [], depart: Object.assign({}, c) }; } return A.brouillon; }
  const modifie = () => { const B = etat().brouillon; return !!B && CLES.some((k) => B.cfg[k] !== B.depart[k]); };
  function apercu() { window.WK_APERCU = ATL.ouvert ? Object.assign({}, brouillon().cfg) : null; try { refreshGarageKart(); } catch (e) { /* scène pas prête */ } }
  function appliquer(cle, val) { const B = brouillon(); if (B.cfg[cle] === val) return; B.histo.push(Object.assign({}, B.cfg)); B.histo = B.histo.slice(-30); B.redo = []; B.cfg[cle] = val; sauver(); apercu(); rendre(); }
  function annuler() { const B = brouillon(); if (!B.histo.length) return; B.redo.push(Object.assign({}, B.cfg)); B.cfg = B.histo.pop(); sauver(); apercu(); rendre(); }
  function retablir() { const B = brouillon(); if (!B.redo.length) return; B.histo.push(Object.assign({}, B.cfg)); B.cfg = B.redo.pop(); sauver(); apercu(); rendre(); }
  function pieceAvant() { const B = brouillon(), f = etat().famille; appliquer(f, B.depart[f]); }
  const st = (c) => statsFor(c.body, c.wheels, c.glider);
  function barres(a, n) { return NOMS_STATS.map(([k, nom]) => { const va = a[k], vn = n[k], d = Math.round((vn - va) * 100), lo = Math.min(va, vn), hi = Math.max(va, vn);
    return '<div class="atl-barre"><span>' + nom + '</span><div class="atl-jauge"><i class="a" style="width:' + (lo * 100).toFixed(1) + '%"></i><i class="n' + (d < 0 ? ' m' : '') + '" style="left:' + (lo * 100).toFixed(1) + '%;width:' + ((hi - lo) * 100).toFixed(1) + '%"></i></div><b class="' + (d > 0 ? 'p' : d < 0 ? 'm' : 'z') + '">' + (d > 0 ? '+' : '') + d + '</b></div>'; }).join(''); }
  function seul(v) { return NOMS_STATS.map(([k, nom]) => '<div class="atl-barre"><span>' + nom + '</span><div class="atl-jauge"><i class="n" style="left:0;width:' + (v[k] * 100).toFixed(1) + '%"></i></div><b class="z">' + Math.round(v[k] * 100) + '</b></div>').join(''); }
  const nomPiece = (f, id) => { if (f.table) { const o = f.table()[id]; return o ? o.name || id : id; } return id; };
  const etiquette = (t) => t === 'conduite' ? '<em class="atl-t c">Conduite</em>' : t === 'apparence' ? '<em class="atl-t a">Apparence</em>' : '<em class="atl-t b">Bientôt</em>';
  function conseil(a, n) { const bon = [], moins = []; for (const [k, nom] of NOMS_STATS) { const d = n[k] - a[k]; if (d > .005) bon.push(nom.toLowerCase()); else if (d < -.005) moins.push(nom.toLowerCase()); }
    return (bon.length ? 'Mieux : <b>' + bon.join(', ') + '</b>. ' : '') + (moins.length ? 'Moins bien : <b>' + moins.join(', ') + '</b>. ' : '') + (bon.length || moins.length ? 'Aucune pièce n\'est meilleure partout.' : 'Aucun changement de conduite.'); }
  // Circuit conseillé pour l'essai : tout-terrain marqué → terre ; sinon bitume rapide (vraies cartes du jeu).
  function circuitEssai(cfg) { const s = st(cfg), id = s.off > .34 ? 'safaribouchon' : 'neonafter', i = TRACKS.findIndex((t) => t.id === id); return { i: i >= 0 ? i : 0, nom: (TRACKS[i >= 0 ? i : 0] || {}).name || '' }; }
  function essayer() {
    const B = brouillon(), c = circuitEssai(B.cfg); window.WK_ESSAI = { cfg: Object.assign({}, B.cfg), laps: 1, ti: c.i, debut: Date.now() }; window.WK_ESSAI_FIN = null;
    ATL.ouvert = false; window.WK_APERCU = null; UI.mode = 'quick';
    UI.afterMenu = () => { show('garage'); ouvrir(); const E = window.WK_ESSAI_FIN; ATL.messageEssai = E ? (E.tour ? 'Essai sur ' + c.nom + ' : meilleur tour ' + E.tour.toFixed(2) + ' s.' : 'Essai sur ' + c.nom + ' interrompu.') + ' Ton brouillon est intact, rien n\'est équipé.' : ''; rendre(); };
    try { AudioSys.sfx('click'); } catch (e) { /* rien */ }
    return launchPrepared(c.i, SAVE.cc);
  }
  function enregistrer(slot, nom) { const A = etat(), B = brouillon(); A.montages[slot] = { nom: String(nom || ('Montage ' + (slot + 1))).slice(0, 16), cfg: Object.assign({}, B.cfg) }; B.slot = slot; B.depart = Object.assign({}, B.cfg); sauver(); rendre(); try { toast('Montage « ' + A.montages[slot].nom + ' » enregistré.', 2200); } catch (e) { /* rien */ } }
  function equiper() { const B = brouillon(); for (const k of CLES) SAVE[k] = B.cfg[k]; B.depart = Object.assign({}, B.cfg); sauver(); ATL.confirmer = false; apercu(); rendre(); try { toast('Kart équipé pour les courses.', 2200); } catch (e) { /* rien */ } }
  function chargerMontage(slot) { const m = etat().montages[slot]; if (!m) return; const B = brouillon(); B.histo.push(Object.assign({}, B.cfg)); B.cfg = Object.assign({}, m.cfg); B.slot = slot; B.depart = Object.assign({}, m.cfg); B.redo = []; sauver(); apercu(); rendre(); }
  function vue(v) { ATL.vue = v; const ang = { '3/4': -.6, 'Avant': 0, 'Profil': Math.PI / 2, 'Arrière': Math.PI }[v]; if (typeof GS !== 'undefined') { GS.rot = ang; GS.vit = 0; GS.touche = performance.now() + 864e5; } rendre(); }   // vue fixée jusqu'au prochain geste
  function rendre() {
    const P = $a('#atl'); if (!P) return; if (!ATL.ouvert) { P.hidden = true; return; } P.hidden = false;
    const A = etat(), B = brouillon(), F = FAMILLES.find((f) => f.id === A.famille), cfg = B.cfg;
    let h = '<div class="atl-haut"><button class="atl-b ghost" id="atl-fermer"><span>← Choix rapide</span></button><b>Créer mon kart</b><span class="atl-mont">' + (B.slot >= 0 && A.montages[B.slot] ? 'Montage « ' + esc(A.montages[B.slot].nom) + ' »' : 'Brouillon') + (modifie() ? ' · modifié' : '') + '</span></div>';
    h += '<div class="atl-outils"><button class="atl-b" id="atl-undo"' + (B.histo.length ? '' : ' disabled') + '><span>↶ Annuler</span></button><button class="atl-b" id="atl-redo"' + (B.redo.length ? '' : ' disabled') + '><span>↷ Rétablir</span></button><button class="atl-b" id="atl-avant"><span>⟲ Pièce d\'avant</span></button>' +
      ['3/4', 'Avant', 'Profil', 'Arrière'].map((v) => '<button class="atl-b' + (ATL.vue === v ? ' on' : '') + '" data-vue="' + v + '"><span>' + v + '</span></button>').join('') + '</div>';
    if (ATL.messageEssai) h += '<p class="atl-essai">' + esc(ATL.messageEssai) + '</p>';
    if (ATL.quitter) h += '<div class="atl-alerte"><p>Tu as des changements non enregistrés.</p><button class="atl-b" id="atl-q-garder"><span>Garder le brouillon</span></button><button class="atl-b ghost" id="atl-q-jeter"><span>Jeter</span></button><button class="atl-b red" id="atl-q-annuler"><span>Rester</span></button></div>';
    h += '<div class="atl-fams">' + FAMILLES.map((f) => '<button class="atl-fam' + (f.id === A.famille ? ' on' : '') + (f.type === 'bientot' ? ' off' : '') + '" data-fam="' + f.id + '"' + (f.type === 'bientot' ? ' aria-disabled="true"' : '') + '><b>' + esc(f.nom) + '</b>' + etiquette(f.type) + '</button>').join('') + '</div>';
    h += '<p class="atl-legende"><b>Conduite</b> : change le vrai calcul de conduite. <b>Apparence</b> : ne change que le look.</p>';
    // Pièces de la famille
    h += '<div class="atl-pieces">';
    if (F.couleurs) h += F.couleurs().map((c) => '<button class="atl-coul' + (cfg[F.id] === c ? ' on' : '') + '" data-val="' + c + '" style="background:' + c + '" aria-label="Couleur ' + c + '"></button>').join('');
    else for (const id of Object.keys(F.table())) { const lk = typeof lockInfo === 'function' ? lockInfo(F.id, id) : null; h += '<button class="atl-piece' + (cfg[F.id] === id ? ' on' : '') + (ATL.choix === id ? ' vise' : '') + (lk ? ' lock' : '') + '" data-val="' + esc(id) + '"' + (lk ? ' data-lock="' + esc(lk) + '"' : '') + '>' + esc(nomPiece(F, id)) + (lk ? ' 🔒' : '') + '</button>'; }
    h += '</div>';
    // Comparateur : pièce visée → vrais deltas statsFor ; famille « Apparence » : dit clairement qu'il n'y a pas d'effet.
    if (F.type === 'conduite') { const cand = ATL.choix && ATL.choix !== cfg[F.id] ? Object.assign({}, cfg, { [F.id]: ATL.choix }) : null, a = st(cfg);
      h += '<h4>' + (cand ? esc(nomPiece(F, cfg[F.id])) + ' → ' + esc(nomPiece(F, ATL.choix)) : 'Touche une pièce pour comparer') + '</h4><div class="atl-cmp" id="atl-cmp">' + (cand ? barres(a, st(cand)) : seul(a)) + '</div>';
      if (cand) h += '<p class="atl-note">' + conseil(a, st(cand)) + '</p><div class="atl-actions"><button class="atl-b red" id="atl-garder"><span>Garder cette pièce</span></button></div>'; }
    else h += '<p class="atl-note">Apparence seulement : aucun effet sur la conduite.</p>';
    // Essai, montages, équipement
    const ce = circuitEssai(cfg);
    h += '<div class="atl-actions"><button class="atl-b" id="atl-essai"><span>Essayer 1 tour (' + esc(ce.nom) + ')</span></button>' + (ATL.confirmer ? '<button class="atl-b red" id="atl-equiper-ok"><span>Confirmer : équiper</span></button><button class="atl-b ghost" id="atl-equiper-non"><span>Non</span></button>' : '<button class="atl-b red" id="atl-equiper"><span>Équiper pour les courses</span></button>') + '</div>';
    h += '<h4>Montages (' + A.montages.length + ')</h4><div class="atl-slots">' + A.montages.map((m, i) => '<div class="atl-slot' + (B.slot === i ? ' on' : '') + '"><b>' + (m ? esc(m.nom) : 'Vide') + '</b><small>' + (m ? esc(nomPiece(FAMILLES[0], m.cfg.body)) + ' · ' + esc(nomPiece(FAMILLES[1], m.cfg.wheels)) : '—') + '</small><button class="atl-b" data-save="' + i + '"><span>Enregistrer ici</span></button>' + (m ? '<button class="atl-b ghost" data-load="' + i + '"><span>Ouvrir</span></button><button class="atl-b ghost" data-cmp="' + i + '"><span>Comparer</span></button>' : '') + '</div>').join('') + '</div>';
    if (ATL.comparer != null && A.montages[ATL.comparer]) { const m = A.montages[ATL.comparer]; h += '<h4>Brouillon → « ' + esc(m.nom) + ' »</h4><div class="atl-cmp" id="atl-cmp2">' + barres(st(cfg), st(m.cfg)) + '</div>'; }
    P.innerHTML = h;
    // Événements
    const on = (sel, fn) => { const e = P.querySelector(sel); if (e) e.onclick = fn; };
    on('#atl-fermer', () => { if (modifie()) { ATL.quitter = true; rendre(); } else fermer(); });
    on('#atl-q-garder', () => { ATL.quitter = false; fermer(); }); on('#atl-q-jeter', () => { const Aa = etat(); Aa.brouillon = null; sauver(); ATL.quitter = false; fermer(); }); on('#atl-q-annuler', () => { ATL.quitter = false; rendre(); });
    on('#atl-undo', annuler); on('#atl-redo', retablir); on('#atl-avant', pieceAvant); on('#atl-essai', essayer);
    on('#atl-garder', () => { appliquer(F.id, ATL.choix); ATL.choix = null; rendre(); });
    on('#atl-equiper', () => { ATL.confirmer = true; rendre(); }); on('#atl-equiper-ok', equiper); on('#atl-equiper-non', () => { ATL.confirmer = false; rendre(); });
    P.querySelectorAll('[data-vue]').forEach((e) => (e.onclick = () => vue(e.dataset.vue)));
    P.querySelectorAll('[data-fam]').forEach((e) => (e.onclick = () => { const f = FAMILLES.find((x) => x.id === e.dataset.fam); if (f.type === 'bientot') { try { toast(f.nom + ' : ' + f.aide + '.', 3200); } catch (x) { /* rien */ } return; } etat().famille = f.id; ATL.choix = null; sauver(); rendre(); }));
    P.querySelectorAll('[data-val]').forEach((e) => (e.onclick = () => { if (e.dataset.lock) { try { toast('À débloquer (' + e.dataset.lock + ').', 2500); } catch (x) { /* rien */ } return; }
      if (F.type === 'conduite') { ATL.choix = e.dataset.val; rendre(); } else appliquer(F.id, e.dataset.val); }));
    P.querySelectorAll('[data-save]').forEach((e) => (e.onclick = () => { const i = +e.dataset.save, m = etat().montages[i]; enregistrer(i, m ? m.nom : 'Montage ' + (i + 1)); }));
    P.querySelectorAll('[data-load]').forEach((e) => (e.onclick = () => chargerMontage(+e.dataset.load)));
    P.querySelectorAll('[data-cmp]').forEach((e) => (e.onclick = () => { ATL.comparer = ATL.comparer === +e.dataset.cmp ? null : +e.dataset.cmp; rendre(); }));
  }
  // Le panneau du choix rapide est rendu INVISIBLE (pas retiré) : le retirer faisait remonter la mise en page et glisser la scène
  // du kart sous l'atelier en portrait (mesuré par tests/garage-cadrage.cjs). En portrait, l'atelier se place juste sous la scène.
  // Opacité 0,995 (imperceptible) : opaque ET défilant, le panneau faisait masquer à tort la scène 3D du kart par le compositeur de Chrome
  // (constaté le 6 nov. en rendu logiciel : canevas correct relu, image affichée vide ; à 0,99 le kart réapparaît). À vérifier sur téléphone.
  // Pas de « position: fixed » : un calque fixe au-dessus du canevas 3D faisait disparaître la scène du kart (rectangle vide, observé
  // en portrait le 6 nov.) ; positionnement absolu calculé par rapport au parent positionné.
  function placer() { const P = $a('#atl'), st = $a('#s-garage .g-stage'); if (!P) return;
    if (innerHeight > innerWidth && st) { const par = (P.offsetParent || document.body).getBoundingClientRect(), b = st.getBoundingClientRect().bottom;
      P.style.cssText = 'position:absolute;top:' + Math.round(b - par.top + 6) + 'px;left:10px;right:10px;width:auto;bottom:auto;height:' + Math.max(200, Math.round(innerHeight - b - 16)) + 'px'; } else P.style.cssText = ''; }
  function rapide(vis) { const p = $a('#s-garage .g-panel'); if (p) p.style.visibility = vis ? '' : 'hidden'; }
  function ouvrir() { brouillon(); ATL.ouvert = true; ATL.quitter = false; rapide(false); apercu(); rendre(); placer(); }
  function fermer() { ATL.ouvert = false; ATL.messageEssai = ''; rapide(true); apercu(); rendre(); }
  addEventListener('resize', () => { if (ATL.ouvert) placer(); });
  function installer() {
    const g = $a('#s-garage .garage'); if (!g || $a('#atl')) return;
    const st = document.createElement('style'); st.textContent = '#atl{position:absolute;right:10px;top:10px;bottom:10px;width:min(470px,calc(100% - 20px));overflow:auto;touch-action:pan-y;z-index:3;padding:12px 14px;opacity:.995}' +
      '.atl-haut{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.atl-haut b{font-size:16px}.atl-mont{font-size:12px;opacity:.75}.atl-outils,.atl-actions{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.atl-outils .on{outline:3px solid #f5c518}' +
      '.atl-fams{display:grid;grid-template-columns:1fr 1fr;gap:6px}.atl-fam{text-align:left;border:2px solid currentColor;border-radius:12px;padding:6px 8px;background:transparent;color:inherit;font:inherit;cursor:pointer}.atl-fam.on{outline:3px solid #f5c518}.atl-fam.off{border-style:dashed;opacity:.6}' +
      '.atl-t{display:inline-block;font-style:normal;font-size:10px;font-weight:800;border-radius:6px;padding:1px 5px;margin-left:6px}.atl-t.c{background:#dff3e8;color:#1d6b43}.atl-t.a{background:#ecebf7;color:#4a4870}.atl-t.b{background:#fff1c2;color:#7a5b00}' +
      '.atl-legende,.atl-note,.atl-essai{font-size:12px;opacity:.85;margin:6px 0}.atl-essai{background:#fff1c2;color:#4a3a00;border-radius:8px;padding:6px;opacity:1}.atl-alerte{background:#ffe1df;color:#5a1010;border-radius:10px;padding:8px;margin:6px 0}' +
      '.atl-pieces{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.atl-piece{border:2px solid currentColor;border-radius:10px;padding:5px 9px;background:transparent;color:inherit;font:inherit;font-weight:700;cursor:pointer}.atl-piece.on{background:#1b1740;color:#f5c518}.atl-piece.vise{outline:3px solid #2fa66a}.atl-piece.lock{opacity:.45}' +
      '.atl-coul{width:30px;height:30px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 2px #1b1740;cursor:pointer}.atl-coul.on{box-shadow:0 0 0 3px #f5c518}' +
      '.atl-barre{display:grid;grid-template-columns:96px 1fr 40px;gap:6px;align-items:center;font-size:12px;margin:2px 0}.atl-jauge{height:9px;background:#e6e4f2;border-radius:6px;position:relative;overflow:hidden}.atl-jauge i{position:absolute;top:0;bottom:0}.atl-jauge .a{left:0;background:#9a97c0}.atl-jauge .n{background:#2fa66a}.atl-jauge .n.m{background:#d9534f}' +
      '.atl-barre b{text-align:right}.atl-barre b.p{color:#2fa66a}.atl-barre b.m{color:#d9534f}.atl-barre b.z{opacity:.6}#atl h4{margin:10px 0 4px;font-size:13px}' +
      '.atl-slots{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.atl-slot{border:2px solid currentColor;border-radius:10px;padding:6px;font-size:12px;display:flex;flex-direction:column;gap:4px}.atl-slot.on{outline:3px solid #f5c518}.atl-slot small{opacity:.75}';
    st.textContent += '.atl-b{border:2px solid #1b1740;border-radius:9px;padding:4px 8px;background:#fff;color:#1b1740;font:inherit;font-size:12px;font-weight:800;cursor:pointer;line-height:1.2}.atl-b[disabled]{opacity:.4;cursor:default}.atl-b.red{background:#f5c518}.atl-b.ghost{background:transparent}.atl-b.on{background:#1b1740;color:#f5c518}' +
      '.atl-slot .atl-b{width:100%}#g-atelier{font-size:13px}@media (orientation:landscape){#g-atelier{position:absolute;left:14px;bottom:14px;z-index:2;margin:0}}' +
      '';
    document.head.appendChild(st);
    const P = document.createElement('div'); P.id = 'atl'; P.className = 'panel'; P.hidden = true; g.appendChild(P);
    const stage = $a('#s-garage .g-stage'); if (stage) { const b = document.createElement('button'); b.className = 'btn sm'; b.id = 'g-atelier'; b.innerHTML = '<span>🔧 Créer mon kart</span>'; b.style.cssText = 'margin-top:6px'; b.onclick = ouvrir; const gl = $a('#g-glide'); if (gl && gl.parentNode === stage) { const w = document.createElement('div'); w.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;gap:6px'; stage.insertBefore(w, gl); w.appendChild(gl); w.appendChild(b); } else stage.appendChild(b); }   /* sous « Voir le planeur », dans la colonne de la scène */
  }
  // En quittant le garage, l'aperçu du brouillon est retiré (le garage rapide et la course montrent le kart équipé).
  document.addEventListener('click', (e) => { const t = e.target.closest && e.target.closest('#s-garage [data-go]'); if (t && ATL.ouvert) { ATL.ouvert = false; window.WK_APERCU = null; rapide(true); rendre(); } }, true);
  installer();
  window.WKAtelier = { ouvrir, fermer, etat, brouillon, appliquer, annuler, retablir, pieceAvant, essayer, enregistrer, equiper, chargerMontage, vue, valide, FAMILLES, CLES, ATL, circuitEssai };
})();
