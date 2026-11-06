/* #32.A2 / #32.B1 — Contrat de SURFACE 3D et premier palier de vraie conduite sur surface (prototype isolé, 6–7 nov. 2026).
   Ce module ne modifie aucune des 26 cartes : il fournit
   1. une surface de route définie par des REPÈRES continus le long de l'abscisse curviligne s : position P, tangente T, latéral L,
      normale N (le « haut » de la chaussée). sample(s, d, h) → point monde ; project(point) → (s, d, h) ; repère en tout s ;
      courbure normale (concave/convexe) ; construction depuis un PROFIL paramétrique (longueur, cap, tangage, roulis par segment)
      ou depuis les échantillons d'un circuit actuel (adaptateur rétrocompatible, normale = verticale) ;
   2. un kart 3D ATTACHÉ à la surface : vitesse le long de son cap dans le plan de la chaussée, gravité réelle projetée (elle freine
      dans une montée, pousse sur le côté d'une paroi), adhérence d'arcade EXPLICITE (accélération de plaquage bornée : sous un seuil de
      vitesse, ou si la courbure convexe demande plus que l'adhérence, le kart se DÉTACHE), vol libre 3D avec gravité, puis raccrochage à
      la première surface touchée (récupération). Braquage libre sur toute la surface, bords de chaussée = butées.
   Pas de dépendance (pas de Three.js) : utilisable sous Node (bancs) et dans le navigateur (window.WKSurface3D).
   Limites assumées du prototype : une seule surface par profil (superpositions = #32.B3), collisions entre karts et objets non
   traités ici (#32.C2), intégration dans les cartes et caméra du jeu = étape suivante, après avis. */
(function (racine) {
  'use strict';
  const V = { add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: (a) => Math.hypot(a[0], a[1], a[2]), norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; } };
  // Rotation d'un vecteur v autour d'un axe unitaire a d'un angle t (Rodrigues).
  function tourner(v, a, t) { const c = Math.cos(t), s = Math.sin(t), d = V.dot(a, v), x = V.cross(a, v); return [v[0] * c + x[0] * s + a[0] * d * (1 - c), v[1] * c + x[1] * s + a[1] * d * (1 - c), v[2] * c + x[2] * s + a[2] * d * (1 - c)]; }
  const lisse = (u) => u * u * (3 - 2 * u), DEG = Math.PI / 180;

  // ---- Surface ----------------------------------------------------------------------------------------------------------------------
  // Profil : [{ long (m), cap (°, + = gauche), tangage (°, + = monte), roulis (°, + = penche à droite), largeur? }], pas d'échantillonnage.
  // Les variations d'angle d'un segment sont réparties par une loi douce (dérivée nulle aux bouts) : raccords sans cassure.
  function depuisProfil(profil, opts) {
    const pas = (opts && opts.pas) || .25, largeurDefaut = (opts && opts.largeur) || 14, P = [], T = [], N = [], W = [], S = [], A = [];
    /* depart : pose initiale { p, t, n } (B3 : plusieurs surfaces placées dans le même monde) ; défaut = origine, cap +X, normale +Y */
    const dep = (opts && opts.depart) || {}; let p = dep.p || [0, 0, 0], t = V.norm(dep.t || [1, 0, 0]), n = V.norm(dep.n || [0, 1, 0]), s = 0;
    const pousser = (w, a) => { P.push(p); T.push(t); N.push(n); W.push(w); S.push(s); A.push(a ? 1 : 0); };
    pousser(profil[0] ? (profil[0].largeur || largeurDefaut) : largeurDefaut, profil[0] && profil[0].aimante);
    for (const seg of profil) {
      const k = Math.max(1, Math.round(seg.long / pas)), ds = seg.long / k, w0 = seg.largeur || largeurDefaut, w1 = seg.largeurFin || w0;   /* largeurFin : rétrécissement/élargissement progressif (entrée de bifurcation) */
      for (let i = 1; i <= k; i++) {
        const u0 = lisse((i - 1) / k), u1 = lisse(i / k), du = u1 - u0;
        // cap autour de N (virage dans le plan de la chaussée), tangage autour de L (montée), roulis autour de T (dévers)
        const l = V.cross(n, t);   // latéral = gauche
        if (seg.cap) { const a = seg.cap * DEG * du; t = tourner(t, n, a); }
        if (seg.tangage) { const a = -seg.tangage * DEG * du; const l2 = V.norm(V.cross(n, t)); t = tourner(t, l2, a); n = tourner(n, l2, a); }
        if (seg.roulis) { const a = seg.roulis * DEG * du; n = tourner(n, t, a); }
        // virage HORIZONTAL (autour de la verticale du monde) : sur une chaussée relevée à ~90°, tourner autour de la normale ferait monter
        // ou descendre ; un virage sur paroi tourne autour de la verticale (le repère entier pivote, le dévers est conservé).
        if (seg.virage) { const a = seg.virage * DEG * du; t = tourner(t, [0, 1, 0], a); n = tourner(n, [0, 1, 0], a); }
        // élévation : la marche s'incline vers le haut autour de l'axe HORIZONTAL perpendiculaire à t (indépendant du dévers) ; un virage
        // autour de la verticale conserve ensuite cette pente → spirale qui monte.
        if (seg.elevation) { const ax = V.norm(V.cross(t, [0, 1, 0])), a = seg.elevation * DEG * du; t = tourner(t, ax, a); n = tourner(n, ax, a); }
        // ré-orthonormalisation (dérive numérique)
        t = V.norm(t); n = V.norm(V.sub(n, V.mul(t, V.dot(n, t))));
        p = V.add(p, V.mul(t, ds)); s += ds; pousser(w0 + (w1 - w0) * u1, seg.aimante); void l;
      }
    }
    return construire(P, T, N, W, S, A);
  }
  // Adaptateur rétrocompatible : échantillons d'un circuit actuel (positions x, y, z et largeur), normale = verticale du monde.
  function depuisEchantillons(points, largeurs) {
    const P = [], T = [], N = [], W = [], S = []; let s = 0;
    for (let i = 0; i < points.length; i++) { const a = points[i], b = points[Math.min(i + 1, points.length - 1)], c = points[Math.max(i - 1, 0)];
      const t = V.norm(V.sub(b, c)), n = V.norm(V.sub([0, 1, 0], V.mul(t, t[1]))); if (i) s += V.len(V.sub(a, points[i - 1]));
      P.push(a); T.push(t); N.push(n); W.push(largeurs ? largeurs[i] : 14); S.push(s); }
    return construire(P, T, N, W, S);
  }
  function construire(P, T, N, W, S, A) {
    const n = P.length, longueur = S[n - 1];
    function indice(s) { s = Math.max(0, Math.min(longueur, s)); let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; } return [lo, hi, hi > lo ? (s - S[lo]) / (S[hi] - S[lo]) : 0]; }
    function repere(s) { const [a, b, u] = indice(s), mix = (X) => V.add(V.mul(X[a], 1 - u), V.mul(X[b], u));
      const t = V.norm(mix(T)), nn = mix(N), nrm = V.norm(V.sub(nn, V.mul(t, V.dot(nn, t)))), l = V.cross(nrm, t); return { p: mix(P), t, n: nrm, l, largeur: W[a] * (1 - u) + W[b] * u, s }; }
    function sample(s, d, h) { const f = repere(s); return V.add(V.add(f.p, V.mul(f.l, d || 0)), V.mul(f.n, h || 0)); }
    // Projection : point monde → (s, d, h) ; recherche locale autour d'une estimation (continuité du suivi), sinon recherche globale.
    function project(q, sEstime) {
      let best = -1, bd = Infinity; const essai = (i) => { const dd = V.len(V.sub(q, P[i])); if (dd < bd) { bd = dd; best = i; } };
      let bordFenetre = false;
      if (sEstime != null) { const [a] = indice(sEstime), i0 = Math.max(0, a - 80), i1 = Math.min(n, a + 80); for (let i = i0; i < i1; i++) essai(i); bordFenetre = (best === i0 && i0 > 0) || (best === i1 - 1 && i1 < n); }
      /* fenêtre locale insuffisante (minimum sur son bord : le point a avancé au-delà) ou trop loin : recherche globale */
      if (best < 0 || bd > 30 || bordFenetre) { const b0 = best; for (let i = 0; i < n; i += 2) essai(i); if (best !== b0) for (let i = Math.max(0, best - 2); i < Math.min(n, best + 3); i++) essai(i); }
      let s = S[best];   // affinage : abscisse où (q - P(s)) est orthogonal à T(s) (Newton sur quelques itérations)
      for (let it = 0; it < 6; it++) { const f = repere(s), e = V.dot(V.sub(q, f.p), f.t); s = Math.max(0, Math.min(longueur, s + e)); if (Math.abs(e) < 1e-6) break; }
      const f = repere(s), r = V.sub(q, f.p); return { s, d: V.dot(r, f.l), h: V.dot(r, f.n), e: V.dot(r, f.t), repere: f };   /* e ≠ 0 : point au-delà d'une extrémité */
    }
    // Courbure normale κ = dT/ds · N : > 0 = concave (la chaussée remonte devant, comme le pied d'un mur), < 0 = convexe (une crête).
    function courbure(s) { const e = .4, a = repere(s - e), b = repere(s + e); return V.dot(V.mul(V.sub(b.t, a.t), 1 / (2 * e)), repere(s).n); }
    const aimante = (s) => !!(A && A[indice(s)[0]]);
    return { longueur, n, repere, sample, project, courbure, aimante, P, T, N, W, S };
  }

  // ---- Kart attaché à la surface -----------------------------------------------------------------------------------------------------
  // Réglages (unités SI) : g, poussée max, freinage aérodynamique, adhérence de plaquage (m/s²), vitesse minimale d'adhérence sur
  // forte pente, vitesse de braquage.
  // adherence : 2,6 g sur route NORMALE (une crête rapide devient un tremplin). Segments « aimante » (anti-gravité) : plaquage sans limite
  // de courbure — à 40 m/s une crête de 12 m de rayon demande 13,5 g (mesuré le 6 nov.) — mais détachement si la vitesse manque sur forte pente. tVolMax : remise en piste au dernier point attaché après ce temps de vol.
  const REGLAGES = { g: 9.81, poussee: 26, trainee: .012, frottement: .9, adherence: 2.6 * 9.81, vMinParoi: 9, pente: 70, braquage: 1.9, vMax: 64, tVolMax: 4 };
  function creerKart(surf, opts) {
    const R = Object.assign({}, REGLAGES, opts || {});
    return { surf, R, s: (opts && opts.s) || 2, d: (opts && opts.d) || 0, h: 0, cap: 0, v: (opts && opts.v) || 0, vLat: 0, attache: true, vol: null, tVol: 0, detachements: 0, raccrochages: 0, evenements: [] };
  }
  function position(k) { return k.attache ? k.surf.sample(k.s, k.d, 0) : k.vol.p; }
  // entrées : { gaz (0..1), frein (0..1), braquage (-1 gauche .. 1 droite) }
  function pas(k, dt, e) {
    const R = k.R, surf = k.surf, gW = [0, -R.g, 0];
    if (k.attache) {
      const f = surf.repere(k.s), dir = V.add(V.mul(f.t, Math.cos(k.cap)), V.mul(f.l, Math.sin(k.cap)));   // direction de marche dans le plan
      // 1. vitesse : poussée, gravité le long de la marche, traînée et frottement
      const aG = V.dot(gW, dir);
      k.v += (R.poussee * (e.gaz || 0) - R.poussee * 1.4 * (e.frein || 0) + aG - R.trainee * k.v * Math.abs(k.v) - R.frottement * Math.sign(k.v) * (e.gaz ? 0 : 1)) * dt;
      k.v = Math.max(-8, Math.min(R.vMax, k.v));
      // 2. braquage libre (cap relatif à la tangente), réduit à très basse vitesse
      k.cap += -(e.braquage || 0) * R.braquage * Math.min(1, Math.abs(k.v) / 6) * dt;
      // 3. gravité latérale (une paroi tire le kart vers le bas de la chaussée)
      const aLat = V.dot(gW, f.l);
      // 4. avance dans le repère de surface
      /* Vitesse latérale de glissement : la gravité l'accélère ; au-dessus de vMinParoi, les pneus la freinent fortement (le kart tient sa ligne). */
      const lent = Math.abs(k.v) < R.vMinParoi;
      k.vLat = ((k.vLat || 0) + aLat * dt * (lent ? 1 : .15)) * Math.exp(-(lent ? .4 : 6) * dt);
      const ds = k.v * Math.cos(k.cap) * dt, dd = k.v * Math.sin(k.cap) * dt + k.vLat * dt;
      k.s += ds; k.d += dd;
      // 5. bords de chaussée : butées (la vitesse latérale est perdue, le cap se redresse)
      const demi = f.largeur / 2 - 1.1; if (Math.abs(k.d) > demi) { k.d = Math.sign(k.d) * demi; k.cap *= .5; k.vLat = 0; k.evenements.push({ t: 'bord', s: k.s }); }
      // 6. adhérence : accélération normale demandée par la courbure convexe et part de la gravité qui décolle
      // Manque à compenser vers la chaussée : accélération centripète d'une crête (κ < 0) + gravité qui éloigne (g·N : −g au sol, 0 sur un
      // mur, +g au plafond). Au-delà de l'adhérence d'arcade, ou sur forte pente sans vitesse, le kart se détache.
      const kap = surf.courbure(k.s), besoin = -kap * k.v * k.v * Math.cos(k.cap) ** 2 + V.dot(gW, f.n);
      const raide = Math.acos(Math.max(-1, Math.min(1, V.dot(f.n, [0, 1, 0])))) / DEG;   // 0 = sol plat, 90 = mur, 180 = plafond
      k.besoin = besoin; k.raide = raide;
      const adh = surf.aimante(k.s) ? Infinity : R.adherence;
      // Manque de vitesse : sur route aimantée, le kart glisse en arrière plaqué (la gravité le ramène au pied du mur) ; il ne tombe qu'au-delà
      // de la verticale (plafond, > 100°). Sur route normale, il décroche dès que la pente dépasse « pente ».
      const tropLent = Math.abs(k.v) < R.vMinParoi && raide > (surf.aimante(k.s) ? 100 : R.pente);
      if (besoin > adh || tropLent) {
        // DÉTACHEMENT : vol libre avec la vitesse monde actuelle
        const vW = V.mul(V.add(V.mul(f.t, Math.cos(k.cap)), V.mul(f.l, Math.sin(k.cap))), k.v);
        k.vol = { p: surf.sample(k.s, k.d, .05), v: V.add(vW, V.mul(f.n, .5)) }; k.attache = false; k.tVol = 0; k.detachements++; k.evenements.push({ t: 'detache', s: k.s, v: k.v, raide: +raide.toFixed(1), besoin: +besoin.toFixed(1) });
      }
      if (k.attache && raide < 30) k.dernier = { s: k.s, d: k.d, surf };   // dernier point SÛR (pente < 30°) pour une remise en piste
      k.depasse = 0; if (k.s >= surf.longueur) { k.depasse = k.s - surf.longueur; k.s = surf.longueur; }   /* dépassement conservé pour un enchaînement de surfaces (B3) */
      return;
    }
    // Vol libre : gravité monde, puis raccrochage quand on touche la chaussée (h ≤ 0 en approchant, dans la largeur)
    k.vol.v = V.add(k.vol.v, V.mul(gW, dt)); k.vol.p = V.add(k.vol.p, V.mul(k.vol.v, dt)); k.tVol += dt;
    if (k.tVol > R.tVolMax) { const d0 = k.dernier || { s: k.s, d: 0 }; if (d0.surf) k.surf = d0.surf; k.s = Math.max(0, d0.s - 15); k.d = 0; k.cap = 0; k.v = 8; k.vLat = 0; k.attache = true; k.vol = null; k.remises = (k.remises || 0) + 1; k.evenements.push({ t: 'remise', s: k.s }); return; }
    /* Raccrochage : sur la surface courante (projection locale, continuité) ou, en réseau (B3), sur la PREMIÈRE surface candidate
       réellement touchée : point dans la largeur et dans la longueur (e ≈ 0), traversée du plan de chaussée par le dessus (h ≤ 0, mais
       moins de 2 m sous la chaussée : on ne s'accroche pas à une route qu'on aurait « traversée » depuis le dessous), vitesse entrante. */
    const cands = k.candidats ? k.candidats() : [surf];
    let pr = null, cible = null;
    for (const c of cands) { const q = c.project(k.vol.p, c === surf ? k.s : null), vn = V.dot(k.vol.v, q.repere.n);
      if (q.h <= 0 && q.h > -2 && Math.abs(q.e) < .5 && Math.abs(q.d) < q.repere.largeur / 2 + .5 && vn <= 0) { pr = q; cible = c; break; } }
    if (pr) { if (cible !== surf) { k.surf = cible; k.changements = (k.changements || 0) + 1; }
      const f = pr.repere, vt = V.dot(k.vol.v, f.t), vl = V.dot(k.vol.v, f.l);
      k.s = pr.s; k.d = Math.max(-f.largeur / 2 + 1.1, Math.min(f.largeur / 2 - 1.1, pr.d)); k.v = Math.hypot(vt, vl) * .8; k.cap = Math.atan2(vl, vt) * .5;
      if (Math.abs(k.cap) > Math.PI / 2) { k.cap = 0; k.v *= .3; }
      k.vLat = 0; k.attache = true; k.vol = null; k.raccrochages++; k.evenements.push({ t: 'raccroche', s: k.s, apres: +k.tVol.toFixed(2) });
    }
  }
  // Mesures de contact : distance roue–chaussée et alignement du « haut » du kart avec la normale (1 = parfait).
  function contact(k) { if (!k.attache) { const pr = k.surf.project(k.vol.p, k.s); return { attache: false, h: pr.h, alignement: null }; } return { attache: true, h: 0, alignement: 1, repere: k.surf.repere(k.s) }; }

  // ---- Palier 32.B1 : sol → mur droit devant (≈ 88°) → plateau → mur qui redescend → sol -----------------------------------------------
  function profilMurFrontal(o) {
    // pied : raccord concave (sol → mur) ; crête : raccord convexe (mur → plateau), plus doux car il faut y plaquer le kart.
    o = Object.assign({ angle: 88, pied: 8, crete: 18, mur: 26, plateau: 25, sol: 40, largeur: 14 }, o || {});
    const arc = (deg, r) => Math.abs(deg) * DEG * r;   // longueur d'un raccord circulaire de rayon r
    const M = { aimante: true };
    return [{ long: o.sol }, Object.assign({ long: arc(o.angle, o.pied), tangage: o.angle }, M), Object.assign({ long: o.mur }, M), Object.assign({ long: arc(o.angle, o.crete), tangage: -o.angle }, M), Object.assign({ long: o.plateau }, M),
      Object.assign({ long: arc(o.angle, o.crete), tangage: -o.angle }, M), Object.assign({ long: o.mur }, M), Object.assign({ long: arc(o.angle, o.pied), tangage: o.angle }, M), { long: o.sol }].map((x) => Object.assign({ largeur: o.largeur }, x));
  }
  // ---- Palier 32.B2 : virages sur paroi (gauche, droite, S, épingle, spirale) -----------------------------------------------------------
  // Une paroi = chaussée relevée (roulis) ; le virage pivote autour de la verticale. Le côté du dévers suit le sens du virage (paroi
  // à l'extérieur, comme un vélodrome) ; « S » inverse le dévers au milieu, en douceur ; « spirale » monte en tournant.
  function profilParoi(type, o) {
    o = Object.assign({ devers: 80, rayon: 30, entree: 30, largeur: 14, montee: 6 }, o || {}); /* montee : pente (°) de la spirale */ const M = { aimante: true }, arc = (deg) => Math.abs(deg) * DEG * o.rayon;
    const relever = (sens, long) => Object.assign({ long: long || 22, roulis: sens * o.devers }, M), virer = (deg, extra) => Object.assign({ long: arc(deg), virage: deg }, M, extra || {});
    const sol = (long) => ({ long: long || o.entree });
    // roulis + = penche à droite : pour un virage à gauche (virage +), la paroi est à droite → on relève vers la gauche (roulis −)
    const cote = (deg) => (deg > 0 ? -1 : 1);
    let p;
    if (type === 'gauche' || type === 'droite') { const d = type === 'gauche' ? 90 : -90; p = [sol(), relever(cote(d)), virer(d), relever(-cote(d)), sol()]; }
    else if (type === 'epingle') p = [sol(), relever(cote(180)), virer(180), relever(-cote(180)), sol()];
    else if (type === 's') p = [sol(), relever(cote(90)), virer(90), relever(-cote(90) * 2, 34), virer(-90), relever(cote(90), 22), sol()];
    else if (type === 'spirale') { const e = o.montee || 0; p = [sol(), relever(cote(360)), Object.assign({ long: 12, elevation: e }, M), virer(360), Object.assign({ long: 12, elevation: -e }, M), relever(-cote(360)), sol()]; }
    else throw new Error('type de paroi inconnu : ' + type);
    return p.map((x) => Object.assign({ largeur: o.largeur }, x));
  }
  // ---- #32.B3 Réseau de surfaces : superpositions, bifurcations, retour sur soi -------------------------------------------------------
  // surfaces : { id: surface } placées dans le même monde (option depart de depuisProfil). liens : { id: [{ vers, decal }] } — à la fin
  // de la surface id, le kart enchaîne sur « vers » ; decal = position latérale (m, + = gauche) du centre de la suivante dans la
  // largeur de la précédente. Plusieurs liens = BIFURCATION : la branche est choisie par le côté où roule le kart (le lien dont le
  // decal est le plus proche de d) — un bot vise ce côté avant la fourche, un humain choisit en braquant. vide : { id: true } = la
  // route s'arrête dans le vide (fin de pont) : le kart part en vol libre et se raccroche à la première surface touchée.
  // Sélection de surface : un kart attaché ne suit QUE sa surface (projection locale) : passer sous un pont ne le « téléporte » jamais
  // dessus ; en vol, il se raccroche à la surface réellement traversée par le dessus. Remise en piste : dernier point sûr de SA surface.
  function reseau(surfaces, liens, vide) {
    liens = liens || {}; vide = vide || {}; const ids = Object.keys(surfaces), idDe = new Map(ids.map((i) => [surfaces[i], i]));
    const fin = (id, decal) => { const f = surfaces[id].repere(surfaces[id].longueur); return { p: V.add(f.p, V.mul(f.l, decal || 0)), t: f.t, n: f.n }; };
    function attacher(k) { k.candidats = () => [k.surf].concat(ids.map((i) => surfaces[i]).filter((x) => x !== k.surf)); k.reseau = true; return k; }
    function creer(id, o) { return attacher(creerKart(surfaces[id], o)); }
    function pasR(k, dt, e) {
      pas(k, dt, e); if (!k.attache || k.s < k.surf.longueur) return;
      const id = idDe.get(k.surf), L = liens[id];
      if (L && L.length) { let b = L[0]; for (const x of L) if (Math.abs(x.decal - k.d) < Math.abs(b.decal - k.d)) b = x;
        const suiv = surfaces[b.vers], w = suiv.repere(0).largeur / 2 - 1.1; k.surf = suiv; k.s = k.depasse || 0; k.d = Math.max(-w, Math.min(w, k.d - (b.decal || 0)));
        k.evenements.push({ t: 'enchaine', de: id, vers: b.vers }); return; }
      if (vide[id]) { const f = k.surf.repere(k.surf.longueur), dir = V.add(V.mul(f.t, Math.cos(k.cap)), V.mul(f.l, Math.sin(k.cap)));
        k.vol = { p: k.surf.sample(k.surf.longueur, k.d, .05), v: V.mul(dir, k.v) }; k.attache = false; k.tVol = 0; k.detachements++; k.evenements.push({ t: 'vide', de: id }); }
    }
    return { surfaces, liens, vide, ids, id: (surf) => idDe.get(surf), fin, attacher, creer, pas: pasR,
      /* bout du réseau : surface sans suite ni vide (la course s'y termine) */ terminus: (surf) => { const i = idDe.get(surf); return !(liens[i] && liens[i].length) && !vide[i]; } };
  }
  // Scènes de démonstration #32.B3 (mêmes géométries pour les bancs et la page prototype). Rampes de pont à raccords verticaux DOUX
  // (10° sur 60 m) : 25° sur 25 m faisaient un tremplin (plus de 2,6 g à la crête), pas un pont.
  function sceneReseau(nom) {
    if (nom === 'croisement') {
      const profilPont = [{ long: 30 }, { long: 60, tangage: 10 }, { long: 60, tangage: -10 }, { long: 40 }, { long: 60, tangage: -10 }, { long: 60, tangage: 10 }, { long: 60 }];
      const A = depuisProfil([{ long: 260 }], { depart: { p: [-40, 0, 0] } }), tmp = depuisProfil(profilPont, { depart: { t: [0, 0, 1] } }), m = tmp.sample(170, 0, 0);
      const B = depuisProfil(profilPont, { depart: { p: [120 - m[0], 0, -m[2]], t: [0, 0, 1] } });
      return { surfaces: { A, B }, liens: {}, vide: {}, depart: 'B', autres: ['A'] };
    }
    if (nom === 'etage') {
      const U = depuisProfil([{ long: 40 }, { long: 60, tangage: 10 }, { long: 60, tangage: -10 }, { long: 40 }]), D = depuisProfil([{ long: 460 }], { depart: { p: [150, 0, 0] } });
      return { surfaces: { U, D }, liens: {}, vide: { U: true }, depart: 'U', autres: ['D'] };
    }
    if (nom === 'bifurcation') {
      /* entrée de branche 9,4 m → 7 m : couvre toute la demi-chaussée (|d| ≤ 5,9 m) sans saut latéral à l'enchaînement */
      const branche = (sg) => [{ long: 30, virage: 22 * sg, largeur: 9.4, largeurFin: 7 }, { long: 30, virage: -22 * sg, largeur: 7 }, { long: 40, largeur: 7 }, { long: 30, virage: -22 * sg, largeur: 7 }, { long: 30, virage: 22 * sg, largeur: 7 }];
      const A4 = depuisProfil([{ long: 80 }]), f = A4.repere(A4.longueur), dep = (dl) => ({ p: V.add(f.p, V.mul(f.l, dl)), t: f.t, n: f.n });
      const Bg = depuisProfil(branche(1), { depart: dep(3.5) }), Bd = depuisProfil(branche(-1), { depart: dep(-3.5) }), fg = Bg.repere(Bg.longueur);
      const D4 = depuisProfil([{ long: 120 }], { depart: { p: V.add(fg.p, V.mul(fg.l, -3.5)), t: fg.t, n: fg.n } });
      return { surfaces: { A4, Bg, Bd, D4 }, liens: { A4: [{ vers: 'Bg', decal: 3.5 }, { vers: 'Bd', decal: -3.5 }], Bg: [{ vers: 'D4', decal: -3.5 }], Bd: [{ vers: 'D4', decal: 3.5 }] }, vide: {}, depart: 'A4', fourche: { surface: 'A4', depuis: 40, decal: 3.5 } };
    }
    throw new Error('scène inconnue : ' + nom);
  }
  const API = { V, depuisProfil, profilParoi, reseau, sceneReseau, depuisEchantillons, creerKart, pas, position, contact, profilMurFrontal, REGLAGES };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else racine.WKSurface3D = API;
})(typeof window !== 'undefined' ? window : globalThis);
