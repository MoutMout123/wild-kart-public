/* Lot de carrosseries original Wild Kart — prototypes du 4 novembre 2026.
   Chaque thème a ses panneaux et ses assemblages ; roues, appuis et statistiques conservés. */
(function (root) {
  'use strict';
  const NOMS = Object.freeze({ equilibre: 'Équilibré', bolide: 'Bolide', libellule: 'Libellule', buggy: 'Buggy', fusee: 'Fusée', sport: 'Sportive', monstre: 'Monster 4x4', baignoire: 'Baignoire', scarabee: 'Scarabée', lutin: 'Lutin', requin: 'Requin', tracteur: 'Tracteur', comete: 'Comète', galet: 'Galet', mini: 'Mini', fourgon: 'Fourgonnette', limousine: 'Limousine', herisson: 'Hérisson', torpille: 'Torpille' });
  // Même implantation que BODY_FZ/BODY_WIDE de la base. Les tests contrôlent cette correspondance.
  const AVANT = Object.freeze({ equilibre: 1.05, bolide: 1.22, libellule: 1.05, buggy: 1.12, fusee: 1.25, sport: 1.28, monstre: 1.15, baignoire: 1.05, scarabee: 1.05, lutin: 1, requin: 1.25, tracteur: 1.12, comete: 1.25, galet: 1.05, mini: .95, fourgon: 1.1, limousine: 1.42, herisson: 1.1, torpille: 1.3 });
  const LARGEUR = Object.freeze({ buggy: .06, monstre: .2, baignoire: .04, tracteur: .14, herisson: .1, fourgon: .06, scarabee: .04, limousine: .02 });
  /* Raccords aile ↔ caisse, toutes carrosseries (retour du 5 nov. : seul Galet était raccordé ; les autres ailes flottaient).
     Pour chaque aile déclarée dans les ancrages, on cherche le flanc de caisse le plus proche à l'intérieur du bord de l'aile
     (rayons horizontaux contre les pièces déjà construites, ailes exclues) :
     - flanc trouvé à ≤ 0,35 m sur la partie haute de l'arc → VOILE : fuseau arrondi du bord de l'aile jusque dans le flanc, dessus
       sous l'aile, effilé aux bouts (aile intégrée, dessin du kart conservé) ;
     - sinon → SUPPORTS : deux bras tubulaires partant des extrémités basses de l'arc, horizontaux vers le longeron du châssis
       (x = ±0,6) ; hors du balayage du pneu braqué (les bouts de l'arc sont au-delà du rayon du pneu).
     Pièces étiquetées « raccord » ou « support » ; chaque aile est consignée dans ancrages.raccords (type, cote, z, ancrages). */
  function raccordsGeneriques(T, add, collecte, WD, anc, largeur, matiereDefaut) {
    if (!anc || !anc.ailes || !anc.ailes.length) return;
    const mat = new T.MeshBasicMaterial({ side: T.DoubleSide }), cibles = collecte.filter((p) => !(p.g.userData && p.g.userData.piece === 'aile')).map((p) => new T.Mesh(p.g, mat)), ray = new T.Raycaster();
    const rw = anc.roues.voie, fz = anc.roues.avant, xi = rw - largeur / 2; anc.raccords = anc.raccords || [];
    // Sommets réels des pièces de caisse/châssis : les supports s'arriment sur un vrai point (longeron, plancher, flanc).
    const pts = []; for (const p of collecte) { if (p.g.userData && (p.g.userData.piece === 'aile' || p.g.userData.piece === 'support')) continue; const a = p.g.attributes.position; for (let i = 0; i < a.count; i++) pts.push([a.getX(i), a.getY(i), a.getZ(i)]); }
    const arrimage = (side, y, z) => { let best = null, bd = 1e9; for (const q of pts) { if (q[0] * side < .25 || q[0] * side > xi - .02 || Math.abs(q[2] - z) > .12 || q[1] > y || q[1] < .15) continue; const d = Math.hypot(q[0] - side * .6, q[1] - .4, q[2] - z); if (d < bd) { bd = d; best = q; } } return best; };
    // Même sonde que le banc tests/raccords-ailes.cjs : rayons verticaux 7 cm à l'intérieur du bord de l'aile.
    const fendue = (zc, rad, arc, side, extra) => { const L = extra ? cibles.concat(extra) : cibles; for (let ph = -Math.min(.5, arc / 2 * .85); ph <= Math.min(.5, arc / 2 * .85) + 1e-6; ph += .1) { const z = zc + Math.sin(ph) * rad, yA = WD.r + Math.cos(ph) * rad;
      ray.set(new T.Vector3(side * (xi - .07), yA + .5, z), new T.Vector3(0, -1, 0)); ray.far = Infinity; const h = ray.intersectObjects(L, false).find((x) => x.point.y < yA + .02); if (!h || yA - h.point.y > .12) return true; } return false; };
    const flanc = (side, y, z) => { ray.set(new T.Vector3(side * (xi + .02), y, z), new T.Vector3(-side, 0, 0)); ray.far = .9; const h = ray.intersectObjects(cibles, false)[0]; return h ? Math.abs(h.point.x) : null; };
    const fuseau = (k, secs, nomPiece) => { const n = 40, m = 16, pos = [], ids = [];   // sections [z, xc, demi-largeur, dessus, dessous], interpolées
      for (let i = 0; i <= n; i++) { const z = secs[0][0] + (secs[secs.length - 1][0] - secs[0][0]) * i / n; let a = 0; while (a < secs.length - 2 && secs[a + 1][0] < z) a++; const A = secs[a], B = secs[a + 1], t = Math.min(1, Math.max(0, (z - A[0]) / (B[0] - A[0])));
        const L = (q) => A[q] + (B[q] - A[q]) * t, xc = L(1), w = L(2), top = L(3), bot = L(4);
        for (let j = 0; j <= m; j++) { const th = j / m * Math.PI * 2, sx = Math.sign(Math.sin(th)) * Math.pow(Math.abs(Math.sin(th)), .8), sy = -Math.sign(Math.cos(th)) * Math.pow(Math.abs(Math.cos(th)), .8); pos.push(xc + w * sx, (top + bot) / 2 + (top - bot) / 2 * sy, z); } }
      for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const a = i * (m + 1) + j, b = a + m + 1; ids.push(a, a + 1, b, a + 1, b + 1, b); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(ids); g.computeVertexNormals(); g.userData.piece = nomPiece; add(k, g); return g; };
    const tubeEntre = (A0, B0, r0) => { const d = new T.Vector3(B0[0] - A0[0], B0[1] - A0[1], B0[2] - A0[2]), L = d.length(); if (L < .02) return;
      const g = new T.CylinderGeometry(r0, r0, L + .02, 10); g.applyMatrix4(new T.Matrix4().compose(new T.Vector3((A0[0] + B0[0]) / 2, (A0[1] + B0[1]) / 2, (A0[2] + B0[2]) / 2), new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()), new T.Vector3(1, 1, 1))); g.userData.piece = 'support'; add('metal', g); finir(A0, B0, r0); };
    /* #36.D7 : finition des supports — colliers aux deux bouts du tube et semelle de fixation côté châssis (plus d'aspect « tube posé ») */
    const finir = (A0, B0, r0) => { if (typeof window !== "undefined" && window.WK_AILE_AVANT) return; const a = new T.Vector3(...A0), b = new T.Vector3(...B0), d = b.clone().sub(a), L = d.length(); if (L < .06) return; d.normalize();
      const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), d), pose = (g, p) => { g.applyMatrix4(new T.Matrix4().compose(p, q, new T.Vector3(1, 1, 1))); g.userData.piece = 'support'; add('metal', g); };
      for (const f of [.035 / L, 1 - .035 / L]) pose(new T.TorusGeometry(r0 * 1.25, r0 * .42, 6, 14), a.clone().lerp(b, f));
      pose(new T.CylinderGeometry(r0 * 2.1, r0 * 2.3, .014, 14).rotateX(Math.PI / 2), b.clone().addScaledVector(d, -.004)); };
    const supports = (side, zc, rad, arc) => { const bras = [];
      if (zc === fz) {
        // Roue avant (braquée ±0,45 rad) : équerre. Bras horizontal du bout de l'aile vers l'intérieur (il s'éloigne de l'axe de pivot),
        // puis montant vertical placé hors du cercle balayé par le pneu, jusqu'à la première pièce de caisse/châssis en dessous.
        // Positions candidates sur l'arc (bouts puis mi-hauteur) : on garde les deux premières dont le montant tombe sur une vraie pièce.
        const cand = [-.82, .82, -.45, .45, -.2, .2].map((f) => f * arc / 2), choix = [];
        for (const ph of cand) { if (choix.length >= 2) break; const dz = Math.sin(ph) * (rad - .015), z = zc + dz, y = WD.r + Math.cos(ph) * (rad - .015), balaye = Math.sqrt(Math.max(0, (WD.w / 2 + .05) ** 2 + WD.r ** 2 - dz * dz)), xv = Math.max(.12, Math.min(xi - .05, rw - balaye - .05));
          ray.set(new T.Vector3(side * xv, y, z), new T.Vector3(0, -1, 0)); ray.far = y; if (ray.intersectObjects(cibles, false)[0] && !choix.some((c) => Math.sign(c) === Math.sign(ph) && Math.sign(ph) !== 0)) choix.push(ph); }
        for (const ph0 of cand) { if (choix.length >= 2) break; if (!choix.includes(ph0)) choix.push(ph0); }   // repli (aucune pièce sous l'aile)
        for (const ph of choix) { const dz = Math.sin(ph) * (rad - .015), z = zc + dz, y = WD.r + Math.cos(ph) * (rad - .015);
          const balaye = Math.sqrt(Math.max(0, (WD.w / 2 + .05) ** 2 + WD.r ** 2 - dz * dz)), xv = Math.max(.12, Math.min(xi - .05, rw - balaye - .05));
          ray.set(new T.Vector3(side * xv, y, z), new T.Vector3(0, -1, 0)); ray.far = y; const h = ray.intersectObjects(cibles, false)[0];
          const A0 = [side * (xi + .03), y, z], C0 = [side * xv, y, z], B0 = h ? [side * xv, h.point.y - .01, z] : [side * xv, .34, z];
          tubeEntre(A0, C0, .022); tubeEntre(C0, B0, .022); const j = new T.SphereGeometry(.03, 10, 8); j.translate(...C0); j.userData.piece = 'support'; add('metal', j);
          bras.push({ aile: A0.map((v) => +v.toFixed(3)), coude: C0.map((v) => +v.toFixed(3)), chassis: B0.map((v) => +v.toFixed(3)), arrime: !!h }); }
        return bras; }
      for (const e of [-1, 1]) { const ph = e * arc / 2 * .82, z = zc + Math.sin(ph) * (rad - .015), y = WD.r + Math.cos(ph) * (rad - .015), A0 = [side * (xi + .03), y, z], q = arrimage(side, y, z), B0 = q ? [q[0], q[1], q[2]] : [side * .6, Math.min(y, .45), z];
        const d = new T.Vector3(B0[0] - A0[0], B0[1] - A0[1], B0[2] - A0[2]), L = d.length(); if (L < .03) continue;
        const g = new T.CylinderGeometry(.022, .022, L + .02, 10); g.applyMatrix4(new T.Matrix4().compose(new T.Vector3((A0[0] + B0[0]) / 2, (A0[1] + B0[1]) / 2, (A0[2] + B0[2]) / 2), new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()), new T.Vector3(1, 1, 1)));
        g.userData.piece = 'support'; add('metal', g); finir(A0, B0, .022); bras.push({ aile: A0.map((v) => +v.toFixed(3)), chassis: B0.map((v) => +v.toFixed(3)), arrime: !!q }); }
      return bras; };
    for (const a of anc.ailes) for (const zc of [a.avant ? fz : null, a.arriere ? -1 : null].filter((v) => v !== null)) {
      const rad = a.rayon, arc = Math.PI * a.arc, k = a.matiere || matiereDefaut || 'paint';
      for (const side of [-1, 1]) {
        // Flanc sous la partie haute de l'arc (±0,5 rad), juste sous l'aile.
        const ech = []; for (let ph = -Math.min(.5, arc / 2 * .85); ph <= Math.min(.5, arc / 2 * .85) + 1e-6; ph += .1) { const z = zc + Math.sin(ph) * rad, y = WD.r + Math.cos(ph) * rad - .08; ech.push({ ph, z, y, x: flanc(side, y, z) }); }
        const proches = ech.filter((e) => e.x != null && xi + .02 - e.x <= .35);
        if (proches.length >= Math.ceil(ech.length * .6)) {
          // VOILE : du flanc (enfoncé de 4 cm) au bord intérieur de l'aile ; effilé aux bouts de l'arc pour ne laisser aucune tranche.
          const xb = proches.reduce((s0, e) => s0 + e.x, 0) / proches.length - .04, secs = [];
          for (let i = 0; i <= 12; i++) { const ph = -arc / 2 * .95 + arc * .95 * i / 12, z = zc + Math.sin(ph) * rad, top = WD.r + Math.cos(ph) * rad - .005, cl = Math.pow(Math.cos(ph / (arc / 2)  * Math.PI / 2 * .98), .5);
            const x0 = xb, x1 = xi + .04, hw = Math.max(.01, (x1 - x0) / 2 * cl), xc = x1 - hw, h = Math.max(.02, .16 * cl);
            secs.push([z, side * xc, hw, top, top - h]); }
          if (secs[0][0] > secs[12][0]) secs.reverse();
          const gv = fuseau(k, secs, 'raccord');
          // Voile déformé par le passage de roue (roues larges) : contrôle par la même sonde, supports ajoutés si la fente subsiste.
          if (fendue(zc, rad, arc, side, [new T.Mesh(gv, mat)])) anc.raccords.push({ type: 'supports', cote: side, z: zc, voileInsuffisant: true, bras: supports(side, zc, rad, arc) });
          else anc.raccords.push({ type: 'voile', cote: side, z: zc, xCaisse: +xb.toFixed(3), xAile: +xi.toFixed(3) });
        } else anc.raccords.push({ type: 'supports', cote: side, z: zc, bras: supports(side, zc, rad, arc) });
      }
    }
  }
  function construire(T, add, WD, cfg) {
    const body = cfg.body || 'equilibre';
    // Étiquette de pièce (#34 G0, contrôle des raccords) : posée dans userData des géométries pendant la construction d'une famille.
    let PIECE = null; const COLLECTE = [];
    if (!Object.hasOwn(NOMS, body)) throw new Error('Carrosserie inconnue : ' + body);
    // #34 G0 — passages de roue : toute pièce de carrosserie qui entrerait dans la bande du pneu (roues avant braquées à ±0,45 rad,
    // tous les gabarits de roues) est rentrée vers l'axe du kart, comme une caisse qui se creuse autour de la roue. Même règle que
    // tests/ancrages-karts.cjs ; les moyeux et bras de suspension (près de l'axe de roue) ne sont pas concernés.
    { const add0 = add, fz0 = AVANT[body], rw0 = .92 + (LARGEUR[body] || 0) + WD.w / 2 - .12, R = WD.r, hw = WD.w / 2 - .015 + .03, roues = [[-1, fz0, 1], [1, fz0, 1], [-1, -1, 0], [1, -1, 0]];
      const dedans = (x, y, z) => { for (const [sd, zc, av] of roues) for (const a of av ? [-.45, -.22, 0, .22, .45] : [0]) { const dx = x - sd * rw0, dz = z - zc, lx = dx * Math.cos(a) - dz * Math.sin(a), lz = dx * Math.sin(a) + dz * Math.cos(a), rd = Math.hypot(y - R, lz);
        if (Math.abs(lx) < hw && rd < R + .01 && rd > R * .55) return true; } return false; };
      add = (k, g) => { if (PIECE) g.userData.piece = PIECE; const p = g.attributes.position; let moved = false;
        for (let i = 0; i < p.count; i++) { let x = p.getX(i); const y = p.getY(i), z = p.getZ(i); if (!dedans(x, y, z)) continue; const sg = Math.sign(x) || 1;
          for (let n = 0; n < 80 && dedans(x, y, z); n++) x -= sg * .01; p.setX(i, x); moved = true; }
        if (moved) { p.needsUpdate = true; g.computeBoundingBox(); g.computeBoundingSphere(); } COLLECTE.push({ k, g }); add0(k, g); }; }
    if (body === 'equilibre') { const re = root.WKEquilibrePrototype.construire(T, add, WD, cfg); raccordsGeneriques(T, add, COLLECTE, WD, re.ancrages, WD.w + .1, 'paint'); return re; }
    const { V, place, boite: B, tube, cyl, panneau: P, livree, ailePleine, aileDessinee, joncAile, AILE_AVANT } = root.WKEquilibrePrototype.outillage(T, add);
    const fz = AVANT[body], wide = LARGEUR[body] || 0, rw = .92 + wide + WD.w / 2 - .12;
    // #34 G0 — points d'assemblage nommés (mètres, repère du kart : +z avant, +y haut, x latéral), relevés pendant la construction.
    const anc = { version: 1, roues: { avant: fz, arriere: -1, voie: rw, rayon: WD.r, largeur: WD.w }, siege: { x: 0, y: .68, z: -.39 }, dossier: { y: 1.01, z: -.74 },
      volant: { x: 0, y: 1.2, z: .23, inclinaison: .55 }, colonne: [[0, .38, .78], [0, .99, .56], [0, 1.17, .27]], ailes: [], phares: [], parechocs: [], aileron: null, moteur: null };
    const E = (k, rx, ry, rz, x, y, z) => { const g = new T.SphereGeometry(1, 20, 12); g.scale(rx, ry, rz); g.translate(x, y, z); add(k, g); };
    const anneau = (k, r, ep, x, y, z, rx = 0, ry = 0, rz = 0, arc = Math.PI * 2) => add(k, place(new T.TorusGeometry(r, ep, 8, 24, arc), x, y, z, rx, ry, rz));
    const ailette = (k, points, x, ep = .065) => { const s = new T.Shape();points.forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]));s.closePath();const g = new T.ExtrudeGeometry(s, { depth: ep, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 2, curveSegments: 6 });g.rotateY(-Math.PI / 2);g.translate(x + ep / 2, 0, 0);add(k, g); };
    function ailes(front = false, rear = true, k = 'paint', length = .63) {
      anc.ailes.push({ avant: front, arriere: rear, arc: length, rayon: WD.r + .14, matiere: k }); PIECE = 'aile';
      for (const side of [-1, 1]) for (const z of [front ? fz : null, rear ? -1 : null].filter(v => v !== null)) {
        // Retour du 5 nov. : aile pleine (secteur annulaire de 5 cm extrudé, arêtes arrondies), extrémités fermées, plus de tôle
        // ouverte aux bouts coupés net. Rayon intérieur et largeur inchangés : mêmes dégagements de roue.
        const arc = Math.PI * length, r = WD.r + .14, ep = .05, wf = WD.w + .14, bev = .022;
        if (!AILE_AVANT) { /* #36.D7 : aile dessinée (bombée, bords roulés, bouts effilés et fermés) + jonc continu sombre au bord extérieur */
          add(k, aileDessinee(r, ep, wf, arc, side * rw, WD.r, z)); add('plast', joncAile(r, ep, wf, arc, side * rw, WD.r, z, side, ep * .42)); continue; }
        add(k, ailePleine(r, ep, wf, arc, side * rw, WD.r, z));   // aile pleine légère, indexée (coût du 5 nov.)
        // Fiche V4 : lèvre de passage de roue en plastique sombre, désormais un jonc qui borde l'arête extérieure (posée à 6 cm du bord,
        // la bande coupait visuellement l'aile en deux et faisait croire à un rabat séparé).
        anneau('plast', r + ep / 2, ep * .62, side * (rw + wf / 2 - bev * .6), WD.r, z, 0, Math.PI / 2, Math.PI / 2 - arc / 2, arc);
        anneau(k, r + ep / 2, ep * .7, side * (rw - wf / 2 + bev * .6), WD.r, z, 0, Math.PI / 2, Math.PI / 2 - arc / 2, arc);   // boudin arrondi du bord intérieur (conservé)
      }
      PIECE = null;
    }
    // Fiche V2 : phare en quatre pièces (boîtier sombre, lunette chromée, réflecteur lumineux, lentille bombée transparente).
    function lamps(z, y, x = .4, r = .1) { anc.phares.push({ z, y, x, r });for (const side of [-1, 1]) { cyl('dark', r * 1.38, .06, side * x, y, z - .02, Math.PI / 2);anneau('chrome', r * 1.12, r * .17, side * x, y, z + .03);cyl('lampe', r * .95, .06, side * x, y, z + .01, Math.PI / 2);E('chrome', r * .28, r * .28, r * .18, side * x, y, z + .045);E('lentille', r, r, r * .45, side * x, y, z + .04); } }
    // Fiche V3 : calandre alvéolée (texture) en retrait au-dessus du pare-chocs avant.
    // Calandre : plan à UV en mètres (alvéoles régulières de ~3 cm quelle que soit la taille), cadre sombre derrière.
    function grille(w, h, x, y, z, rx = 0) { const g = new T.PlaneGeometry(w, h);const p = g.attributes.position, uv = g.attributes.uv;for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / .25, p.getY(i) / .25);
      add('grille', place(g, x, y, z, rx));B('dark', w + .05, h + .04, .04, .015, x, y, z - .025, rx); }
    // Pare-chocs lisse (gélule) : plus de facettes visibles ; supports conservés.
    function bumper(z, y, width = 1.45, k = 'plast') { anc.parechocs.push({ z, y, largeur: width, cote: z > 0 ? 'avant' : 'arriere' });const c = new T.CapsuleGeometry(.085, Math.max(.05, width - .17), 8, 24);c.rotateZ(Math.PI / 2);c.scale(1, .95, 1.05);add(k, place(c, 0, y, z));if (z > 0) grille(width * .55, .12, 0, y + .13, z + .035);for (const side of [-1, 1]) tube('metal', [[side * .4, .35, z > 0 ? z - .3 : z + .3], [side * .4, y, z]], .035); }
    function wing(z = -1.5, y = 1.2, width = 1.8) { anc.aileron = { z, y, largeur: width };P('accent', [[z - .24, width / 2, y + .06, y], [z, width / 2, y + .11, y], [z + .24, width / 2, y + .03, y]], 0);for (const side of [-1, 1]) { B('plast', .065, .22, .52, .02, side * width / 2, y + .03, z);tube('metal', [[side * .36, .57, z], [side * .36, y, z]], .035); } }
    // Hauteur du dessus d'une monocoque (même interpolation et même superellipse que panneau()) en (x, z) ; null hors du volume.
    function sectionA(SG, z) { let a = 0; while (a < SG.length - 2 && SG[a + 1][0] < z) a++; const A = SG[a], B = SG[a + 1], t0 = Math.min(1, Math.max(0, (z - A[0]) / (B[0] - A[0]))), t = t0 * t0 * (3 - 2 * t0);
      return { w: A[1] + (B[1] - A[1]) * t, top: A[2] + (B[2] - A[2]) * t, bot: A[3] + (B[3] - A[3]) * t }; }
    function dessus(SG, x, z) { const S = sectionA(SG, z), sx = Math.min(1, Math.abs(x) / S.w), mid = (S.top + S.bot) / 2, h = (S.top - S.bot) / 2; return mid + h * Math.pow(Math.max(0, 1 - Math.pow(sx, 2.5)), .4); }
    // Distance elliptique normalisée au centre de l'ouverture du cockpit (1 = bord).
    const rCk = (CK, x, z) => Math.hypot(x / CK.a, (z - CK.zc) / CK.R);
    // Profondeur relative : 1 au fond, 0 au bord ; paroi courbe sur les 22 % extérieurs de l'ouverture.
    const fCk = (r) => r <= .78 ? 1 : r >= 1 ? 0 : (t => 1 - t * t * (3 - 2 * t))((r - .78) / .22);
    function creuser(pos, SG, CK) { for (let i = 0; i < pos.length; i += 3) { const x = pos[i], y = pos[i + 1], z = pos[i + 2], S = sectionA(SG, z); if (y <= (S.top + S.bot) / 2) continue; const f = fCk(rCk(CK, x, z)); if (f > 0) pos[i + 1] = y - (y - CK.sol) * f; } }
    // Cuve sombre : épouse la paroi creusée à 1,5 cm à l'intérieur, déborde sous le rebord ; grille polaire sans couture.
    function cuve(SG, CK) { const nr = 18, nt = 48, pos = [], ids = [];
      for (let i = 0; i <= nr; i++) { const r = i / nr * 1.04; for (let j = 0; j < nt; j++) { const t = j / nt * Math.PI * 2, x = Math.sin(t) * CK.a * r, z = CK.zc + Math.cos(t) * CK.R * r, y0 = dessus(SG, x, z), f = fCk(r); pos.push(x, y0 - (y0 - CK.sol) * f + .02, z); } }
      for (let i = 0; i < nr; i++) for (let j = 0; j < nt; j++) { const a = i * nt + j, b = i * nt + (j + 1) % nt, c = a + nt, d = b + nt; ids.push(a, c, b, b, c, d); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(ids); g.computeVertexNormals(); add('dark', g); }
    // Raccord aile/caisse (retour du 5 nov. : fente ouverte entre le capot et l'aile avant) : joue épaisse et arrondie qui part de la
    // caisse, sous sa surface, et rejoint le dessous de l'aile sur toute la longueur de l'arc. Les sommets qui entreraient dans la roue
    // braquée sont repoussés par la règle des passages de roue ci-dessus.
    function raccordAiles(SG, front = true, rear = true, length = .74) {
      // Voile arrondi (fuseau à section superellipse) sous le bord intérieur de l'aile : son dessus suit le dessous de l'aile, son
      // dessous plonge dans la caisse. Aux bouts de l'arc, l'aile passe sous l'épaule de la caisse : le voile s'y enfonce et disparaît,
      // sans tranche visible. Les sommets qui entreraient dans la roue braquée sont repoussés par la règle des passages de roue.
      const r = WD.r + .14, wf = WD.w + .14, arc = Math.PI * length, xi = rw - wf / 2;
      for (const side of [-1, 1]) for (const zc of [front ? fz : null, rear ? -1 : null].filter(v => v !== null)) {
        const secs = [], xs0 = Math.min(sectionA(SG, zc).w - .06, xi - .1), xc = (xs0 + xi + .04) / 2, hw = (xi + .04 - xs0) / 2;
        for (let i = 0; i <= 12; i++) { const ph = -arc / 2 + arc * i / 12, z = zc + Math.sin(ph) * r, top = WD.r + Math.cos(ph) * r - .005, bas = Math.min(dessus(SG, xs0, z) - .06, top - .05), bout = i === 0 || i === 12;
          secs.push([z, bout ? hw * .3 : hw, bout ? (top + bas) / 2 + .01 : top, bout ? (top + bas) / 2 - .01 : bas]); }
        if (secs[0][0] > secs[12][0]) secs.reverse();
        P('paint', secs, side * xc, { n: 32, m: 16, brut: true });
        anc.raccords = (anc.raccords || []).concat([{ type: 'voile', cote: side, z: zc, xCaisse: xs0, xAile: xi }]);
      }
    }
    let deco = null;
    // #36 (demande du propriétaire : « des karts un peu comme dans Mario Kart ») : derrière chaque capot, une caisse sculptée d'un seul
    // volume relie le nez à l'arrière (cockpit bas, bosse moteur, bas de caisse sombre), au lieu d'un capot isolé posé sur un cadre.
    const SANS_CAISSE = new Set(['galet', 'baignoire', 'bolide', 'sport', 'comete', 'torpille', 'fusee', 'requin', 'buggy', 'monstre', 'tracteur', 'fourgon', 'limousine', 'mini', 'libellule', 'scarabee', 'lutin', 'herisson']);
    function caisse(s0) { const w = Math.max(.66, Math.min(.84, s0[1] + .1)), z0 = s0[0] + .06, wr = Math.min(.72, .62 + wide);
      P('paint', [[-1.66, .3, .6, .4], [-1.42, wr - .04, .84, .3], [-1.0, wr, .87, .27], [-.62, w, .78, .26], [-.1, w + .02, .71, .26], [z0, Math.max(w - .04, s0[1]), Math.min(.8, s0[2] - .03), .27]]);
      P('plast', [[-.66, w + .07, .42, .26], [-.1, w + .1, .4, .25], [Math.min(.45, z0), w + .06, .41, .26]]); }
    function hood(sections, stripe = true, material = 'paint') { P(material, sections);deco = livree(sections, cfg);if (!SANS_CAISSE.has(body)) caisse(sections[0]); }
    function sills(top = .73, k = 'paint', x = .66, w = .18, front = .48) {
      for (const side of [-1, 1]) { P(k, [[-1.35, .035, top, .42], [-1.02, w, top + .08, .4], [-.15, w, top, .46], [front, .03, top - .08, .48]], side * x);tube('ivory', [[side * (x + w), .44, -1.02], [side * (x + w), .43, -.1], [side * (x + .04), .49, front]], .016, 6); }
    }
    function vents(x = .82, y = .55, z = -.2, count = 4) { for (const side of [-1, 1]) { B('dark', .035, .2, .48, .02, side * x, y, z);for (let i = 0; i < count; i++) B('metal', .045, .15, .025, .008, side * (x + .015), y, z - .16 + i * .11, .2); } }
    function moteur(z = -1.35, y = .88, single = true) {
      anc.moteur = { z, y, double: !single };
      B('metal', .58, .34, .42, .05, 0, y, z);for (let i = 0; i < 4; i++) B('metal', .68, .024, .46, .008, 0, y - .12 + i * .08, z);
      B('plast', .34, .1, .3, .025, 0, y + .22, z);
      const sorties = single ? [1] : [-1, 1];
      flames = sorties.map(side => ({ x: side * .48, y, z: z - .66, s: .8 }));
      for (const side of sorties) { tube('metal', [[side * .24, y - .05, z], [side * .5, y - .02, z - .15], [side * .48, y, z - .48]], .06);cyl('metal', .1, .27, side * .48, y, z - .5, Math.PI / 2);cyl('dark', .07, .008, side * .48, y, z - .64, Math.PI / 2); }
    }
    // Châssis distinct de l'habillage, avec attaches vers les centres de roues du jeu.
    // Retour du 5 nov. : les bras s'arrêtaient à 1,7–4,5 cm du moyeu (cache de largeur 0,74·w) sur les roues étroites : ils y entrent désormais.
    const moyeu = Math.min(.18, WD.w * .36);
    for (const side of [-1, 1]) {
      tube('plast', [[side * .6, .34, -1.48], [side * .7, .32, -.45], [side * .57, .34, fz + .36]], .055);
      for (const z of [-1, fz]) { tube('metal', [[side * .3, .36, z - .15], [side * (rw - moyeu), WD.r, z]], .032);tube('metal', [[side * .3, .46, z + .15], [side * (rw - moyeu), WD.r, z]], .023); }
    }
    // Assise commune : les panneaux sont construits AUTOUR de ce volume ouvert.
    B('plast', .64, .13, .55, .05, 0, .68, -.39, -.08);B('plast', .64, .66, .15, .055, 0, 1.01, -.74, -.15);
    // Cockpit creusé (Galet) : les bords de cockpit tubulaires communs traverseraient la paroi creusée ; la coque fait ce rôle.
    const CREUSE = body === 'galet';
    for (const side of [-1, 1]) { tube('dark', [[side * .29, .7, -.12], [side * .31, .86, -.55], [side * .27, 1.3, -.79]], .04);if (!CREUSE) tube('paint', [[side * .45, .7, .45], [side * .47, .76, -.22], [side * .43, .91, -.8]], .04); }
    tube('metal', [[0, .38, .78], [0, .99, .56], [0, 1.17, .27]], .026);   // colonne dans l'axe du volant (inclinaison .55 rad)
    let flames = [];
    switch (body) {
      case 'bolide': {
        // Flèche de course : nez long et pointu, pontons latéraux à prises d'air, boîte à air derrière le pilote, grand aileron.
        P('paint', [[.15, .5, .76, .3], [.7, .36, .72, .3], [1.3, .24, .62, .32], [1.9, .12, .51, .34], [2.25, .04, .44, .37]]);
        for (const side of [-1, 1]) { P('paint', [[-1.35, .05, .6, .3], [-1.02, .27, .72, .28], [-.1, .29, .7, .28], [.42, .17, .63, .3], [.6, .03, .56, .32]], side * .62);grille(.26, .14, side * .62, .49, .6); }
        P('paint2', [[-1.5, .1, 1.22, .82], [-1.12, .2, 1.32, .8], [-.8, .15, 1.22, .84]]);grille(.18, .12, 0, 1.2, -.72);
        P('accent', [[1.94, .98, .37, .32], [2.12, 1.02, .4, .32], [2.3, .94, .34, .3]]);P('plast', [[-1.2, .78, .36, .27], [.3, .78, .35, .27], [.55, .5, .36, .29]]);
        vents(.92, .54, -.35, 3);wing(-1.62, 1.36, 2.05);moteur(-1.3, .78, false);break;
      }
      case 'libellule': {
        // Libellule : thorax fin, grands yeux à facettes à l'avant, abdomen en segments qui s'effilent, quatre ailes nervurées.
        P('paint', [[-.62, .6, .8, .36], [.2, .66, .8, .34], [.9, .58, .84, .38], [1.5, .42, .76, .42], [1.76, .16, .66, .48]]);
        for (const side of [-1, 1]) { E('canopy', .2, .19, .2, side * .3, .86, 1.58);E('dark', .12, .12, .12, side * .3, .86, 1.6); }
        [[-1.0, .42, .34], [-1.38, .34, .28], [-1.72, .26, .22], [-2.02, .17, .16]].forEach(([z, w, h], i) => E(i % 2 ? 'paint2' : 'paint', w, h, .24, 0, .74 + i * .04, z));
        for (const side of [-1, 1]) for (const [dz, sc] of [[0, 1], [-.32, .85]]) { const g = new T.SphereGeometry(1, 20, 10);g.scale(.66 * sc, .024, .22 * sc);add('canopy', place(g, side * .74, 1.17 + dz * .2, -.9 + dz, 0, side * .35, side * .2));tube('chrome', [[side * .2, .9, -.95 + dz], [side * .7, 1.17 + dz * .2, -.9 + dz], [side * 1.3, 1.28 + dz * .2, -.98 + dz]], .016); }
        ailes(true, true, 'paint', .6);lamps(1.7, .6, .2, .06);bumper(1.84, .44, 1.2);break;
      }
      case 'buggy': {
        // Buggy des dunes : caisse courte et haute, roues dégagées, arceau, plaque de protection, rampe de phares.
        P('paint', [[-1.55, .45, .84, .42], [-1.1, .62, .92, .38], [-.5, .72, .8, .36], [.3, .72, .82, .38], [.9, .6, .88, .4], [1.5, .5, .8, .42], [1.85, .3, .68, .46]]);
        P('metal', [[.9, .5, .44, .34], [1.6, .44, .46, .36], [1.95, .26, .5, .4]]);ailes(true, true, 'paint', .48);
        for (const side of [-1, 1]) { tube('plast', [[side * .58, .7, -.93], [side * .59, 1.72, -.77], [side * .5, 1.78, -.3], [side * .51, .74, .45]], .048);tube('metal', [[side * .6, 1.58, -.8], [side * .48, .6, -1.48]], .035); }
        tube('plast', [[-.59, 1.72, -.77], [0, 1.85, -.77], [.59, 1.72, -.77]], .05);for (const x of [-.3, 0, .3]) { cyl('lampe', .07, .07, x, 1.86, -.7, Math.PI / 2);anneau('chrome', .075, .014, x, 1.86, -.66); }
        bumper(2.0, .54, 1.55, 'metal');lamps(1.82, .7, .34, .09);moteur(-1.4, .8);break;
      }
      case 'fusee': {
        // Fusée : fuselage rond et gras, hublots latéraux, trois empennages, tuyère.
        P('paint', [[-1.78, .4, 1.08, .42], [-1.2, .56, 1.14, .36], [-.6, .68, .9, .32], [0, .7, .82, .32], [.6, .62, .98, .34], [1.2, .56, 1.02, .36], [1.7, .4, .92, .44], [2.15, .04, .7, .64]]);
        for (const side of [-1, 1]) { ailette('accent', [[1.3, .45], [1.58, .92], [1.87, .43]], side * .6);anneau('chrome', .13, .025, side * .57, .72, 1.0, 0, Math.PI / 2);cyl('verre', .11, .025, side * .58, .72, 1.0, 0, 0, Math.PI / 2);ailette('accent', [[-1.75, .4], [-1.55, .95], [-1.1, .5]], side * .62); }
        cyl('metal', .34, .25, 0, .75, -1.8, Math.PI / 2);cyl('plast', .26, .27, 0, .75, -2.0, Math.PI / 2);cyl('dark', .2, .008, 0, .75, -2.14, Math.PI / 2);ailette('accent', [[-1.6, 1.05], [-1.45, 1.65], [-1.05, 1.05]], 0);
        flames = [{ x: 0, y: .75, z: -2.16, s: 1.7 }];break;
      }
      case 'sport': {
        // Coupé GT : long capot plat, ailes larges intégrées, hayon fuyant, pare-brise enveloppant, aileron sur mâts.
        P('paint', [[-1.82, .5, .72, .36], [-1.45, .72, .88, .3], [-1.0, .74, .9, .28], [-.55, .9, .8, .27], [0, .92, .72, .27], [.55, .9, .78, .28], [1.0, .76, .8, .29], [1.5, .74, .74, .3], [1.95, .62, .62, .32], [2.22, .3, .5, .36]]);
        P('plast', [[-.62, .97, .4, .26], [0, .99, .39, .25], [.6, .97, .4, .26]]);B('verre', 1.05, .3, .03, .03, 0, .93, .48, -.62);
        P('paint2', [[1.2, .16, .82, .76], [1.7, .2, .78, .7], [2.0, .12, .68, .62]]);
        ailes(true, true, 'paint', .62);lamps(2.1, .5, .46, .075);bumper(2.24, .32, 1.55);vents(.93, .56, -.2);wing(-1.66, 1.16, 1.9);moteur(-1.42, .73, false);break;   // hauteur d'échappement validée (tests/echappements-karts.cjs)
      }
      case 'monstre': {
        // Monster 4×4 : caisse haute perchée, très large, arceau, phares de toit, gros pare-chocs tubulaire, cheminées chromées.
        P('paint', [[-1.72, .6, 1.05, .6], [-1.3, .86, 1.15, .55], [-.75, .94, .9, .52], [-.25, .94, .84, .52], [.35, .94, .88, .52], [.9, .9, 1.12, .54], [1.6, .84, 1.08, .56], [1.95, .6, .98, .6]]);   // cockpit abaissé (≤ 0,9) : le pilote n'est plus noyé
        P('plast', [[-1.4, .97, .64, .5], [1.7, .97, .64, .5]]);ailes(true, true, 'paint', .55);bumper(2.02, .62, 1.9, 'metal');lamps(1.95, .86, .5, .12);
        for (const side of [-1, 1]) { tube('plast', [[side * .58, 1.0, -.87], [side * .58, 1.76, -.89], [side * .5, 1.9, -.6]], .055);cyl('chrome', .06, .6, side * .78, 1.25, -.95);cyl('dark', .045, .01, side * .78, 1.56, -.95); }
        tube('plast', [[-.5, 1.9, -.6], [0, 1.94, -.6], [.5, 1.9, -.6]], .05);for (const x of [-.33, 0, .33]) cyl('lampe', .08, .08, x, 1.92, -.53, Math.PI / 2);moteur(-1.5, 1.12, false);break;
      }
      case 'baignoire': {
        deco = livree([[1.32, .4, 1.115, 1.11], [1.43, .4, 1.115, 1.11]], cfg);
        // Cuve ouverte : quatre parois, jamais un volume plein sous un disque d'eau.
        for (const side of [-1, 1]) { P('email', [[-1.5, .06, 1.04, .52], [-1.1, .15, 1.09, .44], [.92, .16, 1.08, .44], [1.5, .04, 1.03, .55]], side * .74);tube('email', [[side * .74, 1.08, -1.2], [side * .84, 1.1, -.3], [side * .78, 1.08, 1.2]], .065); }
        for (const z of [-1.35, 1.38]) { B('email', 1.4, .5, .12, .05, 0, .78, z);tube('email', [[-.72, 1.05, z], [0, 1.11, z + (z < 0 ? -.09 : .09)], [.72, 1.05, z]], .065); }
        for (const side of [-1, 1]) for (const z of [-1.05, 1.06]) { cyl('gold', .07, .22, side * .6, .38, z);E('gold', .12, .065, .16, side * .62, .27, z + .05); }
        tube('chrome', [[-.55, .6, -1.25], [-.55, 1.9, -1.25], [-.55, 1.93, -.85]], .045);cyl('chrome', .11, .08, -.55, 1.9, -.83, Math.PI / 2);{ const eau = new T.PlaneGeometry(1.36, 2.6);add('water', place(eau, 0, .86, .02, -Math.PI / 2)); }   // eau du bain, sous le pilote
        for (const [x, z, r] of [[.5, .9, .1], [.58, .7, .07], [-.52, .95, .09], [-.45, -.9, .1], [.5, -1.0, .08], [-.6, -.6, .07], [.1, 1.15, .08]]) E('ivory', r, r * .7, r, x, .87, z);   // mousse
        E('duck', .13, .11, .17, .43, 1.18, 1.05);E('duck', .08, .08, .08, .43, 1.32, 1.13);B('beak', .08, .035, .09, .012, .43, 1.3, 1.22);ailes(false, true, 'email', .45);moteur(-1.57, .54);break;
      }
      case 'scarabee': {
        // Scarabée : grande carapace bombée (élytres et ligne médiane) sur l'arrière, tête à corne et antennes, taches.
        P('paint', [[-1.78, .3, .82, .5], [-1.4, .72, 1.12, .4], [-.9, .86, 1.16, .36], [-.52, .86, .98, .34]]);tube('dark', [[0, .84, -1.76], [0, 1.15, -1.3], [0, 1.16, -.9], [0, .98, -.66]], .022);
        P('paint', [[-.4, .84, .8, .34], [.4, .84, .84, .36], [1.0, .72, .94, .4], [1.5, .56, .86, .42], [1.86, .2, .7, .48]]);
        for (const [x, y, z] of [[.42, 1.04, -1.25], [-.42, 1.04, -1.25], [.5, .9, -.75], [-.5, .9, -.75], [0, .92, -1.6]]) E('dark', .11, .05, .11, x, y, z);
        for (const side of [-1, 1]) { tube('plast', [[side * .24, .86, 1.5], [side * .32, 1.16, 1.75], [side * .42, 1.3, 1.85]], .018);E('gold', .045, .045, .045, side * .42, 1.3, 1.85);for (const z of [-.6, .1]) tube('metal', [[side * .82, .47, z], [side * .98, .43, z + .12]], .035); }
        add('gold', place(new T.ConeGeometry(.08, .32, 10), 0, .86, 1.95, 1.2));lamps(1.8, .66, .3, .1);ailes(true, true, 'paint', .6);moteur(-1.55, .57);break;
      }
      case 'lutin': {
        // Lutin : petite caisse ronde, nez recourbé en pointe à grelot, bonnet pointu à pompon sur l'arrière, galons ivoire.
        P('paint', [[-1.55, .5, .9, .42], [-1.2, .66, .98, .38], [-.6, .8, .82, .34], [.2, .8, .78, .36], [.8, .66, .8, .38], [1.3, .5, .84, .44], [1.6, .3, .94, .62], [1.82, .07, 1.06, .96]]);
        for (const side of [-1, 1]) { tube('ivory', [[side * .8, .42, -1.2], [side * .86, .4, .2], [side * .55, .46, 1.32], [side * .2, .74, 1.66]], .035);for (let i = 0; i < 4; i++) B('ivory', .035, .07, .018, .005, side * .82, .62, -.7 + i * .22); }
        E('gold', .085, .085, .085, 0, 1.1, 1.86);add('accent', place(new T.ConeGeometry(.36, 1.0, 18), 0, 1.25, -1.45, -.55));E('ivory', .12, .12, .12, 0, 1.6, -1.78);
        const bord = new T.TorusGeometry(.36, .06, 8, 24);add('ivory', place(bord, 0, .85, -1.22, Math.PI / 2 - .55));ailes(true, true, 'paint', .6);moteur(-1.55, .62);break;
      }
      case 'requin': {
        // Requin : museau effilé à ventre blanc, yeux, ouïes, nageoires pectorales, aileron dorsal et caudale.
        P('paint', [[-1.95, .1, .86, .62], [-1.6, .4, 1.0, .44], [-1.1, .62, 1.02, .32], [-.5, .84, .84, .28], [.2, .86, .84, .28], [.8, .72, .92, .3], [1.3, .66, .9, .32], [1.8, .46, .78, .36], [2.15, .1, .62, .46]]);
        P('ivory', [[.55, .62, .5, .29], [1.3, .7, .5, .3], [1.85, .5, .5, .34], [2.14, .1, .52, .45]]);vents(.88, .66, -.1, 3);
        for (const side of [-1, 1]) { E('dark', .05, .07, .07, side * .56, .8, 1.55);E('ivory', .02, .025, .025, side * .6, .83, 1.6);ailette('paint', [[-.28, .5], [.18, .77], [.58, .47]], side * .9); }
        ailette('paint', [[-1.62, .95], [-1.38, 1.62], [-.95, .98]], 0);ailette('paint', [[-2.05, .4], [-1.82, .76], [-2.05, 1.18]], 0);ailes(true, false, 'paint', .6);moteur(-1.48, .6);break;
      }
      case 'tracteur': {
        // Tracteur : long capot moteur haut et étroit à calandre, cheminée, grandes ailes arrière, gros phares ronds.
        P('paint', [[.25, .4, 1.0, .48], [.8, .48, 1.16, .46], [1.4, .5, 1.18, .46], [1.95, .46, 1.08, .5]]);P('paint', [[-1.62, .5, .8, .4], [-1.2, .62, .86, .36], [-.5, .62, .74, .34], [.3, .42, .74, .4]]);
        ailes(false, true, 'paint', .86);grille(.66, .48, 0, .8, 1.99);for (let k = 0; k < 7; k++) B('chrome', .03, .46, .03, .01, -.27 + k * .09, .8, 2.0);lamps(1.98, 1.02, .38, .11);
        cyl('plast', .06, .8, .3, 1.56, 1.2);cyl('metal', .085, .08, .3, 1.98, 1.2);E('gold', .05, .05, .05, 0, 1.2, 1.96);for (const side of [-1, 1]) B('metal', .38, .06, .45, .02, side * .8, .45, -.1);moteur(-1.45, .72);break;
      }
      case 'comete': {
        // Comète : grosse goutte arrondie à l'avant, effilée en pointe à l'arrière, étoile de proue, traînée lumineuse.
        P('paint', [[-2.0, .06, .8, .66], [-1.6, .36, .96, .48], [-1.0, .62, 1.0, .32], [-.4, .84, .82, .28], [.3, .86, .8, .28], [.9, .72, .84, .3], [1.4, .66, .78, .32], [1.9, .44, .66, .36], [2.14, .12, .56, .42]]);
        for (const side of [-1, 1]) { tube('led', [[side * .8, .64, -.93], [side * .88, .64, -.2], [side * .78, .62, .5]], .02);ailette('accent', [[-1.7, .7], [-2.05, 1.1], [-1.0, .82]], side * .42); }
        const star = new T.OctahedronGeometry(.16);star.scale(1, .55, 1);star.translate(0, .62, 2.08);add('gold', star);ailes(true, true, 'paint', .66);bumper(2.2, .32, 1.0);
        cyl('metal', .16, .22, 0, .73, -2.0, Math.PI / 2);cyl('led', .11, .03, 0, .73, -2.12, Math.PI / 2);flames = [{ x: 0, y: .73, z: -2.16, s: 1.3 }];break;
      }
      case 'galet': {
        // Témoin #36 (fiches V1–V7) : monocoque sculptée d'un seul volume, du nez au becquet, au lieu d'un capot posé sur un cadre.
        // Sections [z, demi-largeur, dessus, dessous] : étroite au droit des roues, large et basse au cockpit, bosse moteur à l'arrière.
        const SG = [[-1.72, .34, .72, .42], [-1.45, .68, .98, .3], [-1.0, .72, 1.0, .27], [-.62, .84, .86, .26], [-.1, .86, .78, .26], [.45, .82, .86, .27], [.95, .7, .88, .28], [1.45, .66, .84, .29], [1.85, .5, .72, .31], [2.08, .2, .56, .36]];
        // Cockpit réellement creusé (retour du 5 nov. : l'ancien fond sombre au ras du rebord fermait l'ouverture et coupait le pilote).
        // Ouverture elliptique ; la coque plonge jusqu'au plancher, une cuve sombre double l'intérieur, le siège et les jambes sont visibles.
        const CK = { zc: -.33, R: .56, a: .5, sol: .5 };
        P('paint', SG, 0, { n: 80, m: 48, deformer: (pos) => creuser(pos, SG, CK) });
        cuve(SG, CK);
        { const pts = []; for (let i = 0; i < 48; i++) { const t = i / 48 * Math.PI * 2, x = Math.sin(t) * CK.a, z = CK.zc + Math.cos(t) * CK.R; pts.push([x, dessus(SG, x, z) + .012, z]); } tube('satin', pts, .04, 8, true); }
        P('paint2', [[.55, .2, .92, .84], [1.0, .25, .93, .84], [1.5, .16, .87, .8]]);grille(.3, .06, 0, .885, .56, -.5);   // prise d'air de capot en relief, bouche alvéolée
        P('plast', [[-.7, .9, .42, .26], [-.1, .93, .4, .25], [.45, .88, .41, .26]]);    // bas de caisse sombre entre les roues
        ailes(true, true, 'paint', .74);raccordAiles(SG, true, true);lamps(1.9, .62, .34, .1);bumper(2.1, .36, 1.25);wing(-1.52, 1.28, 1.7);vents(.87, .58, -.2, 4);moteur(-1.45, 1.0, false);
        for (const side of [-1, 1]) { cyl('feu', .08, .05, side * .42, .76, -1.68, Math.PI / 2);anneau('chrome', .09, .016, side * .42, .76, -1.66); }   // feux arrière
        anc.cockpit = { centre: CK.zc, demiLongueur: CK.R, demiLargeur: CK.a, plancher: CK.sol };
        break;
      }
      case 'mini': {
        // Mini : petite caisse cubique aux angles ronds, gros yeux-phares ronds, toit-pare-brise chromé, becquet bicolore.
        P('paint', [[-1.45, .62, 1.0, .4], [-1.2, .74, 1.06, .36], [-.8, .78, .92, .34], [-.2, .82, .82, .34], [.4, .8, .88, .36], [.9, .74, .9, .38], [1.3, .66, .84, .4], [1.52, .5, .74, .42]]);
        P('plast', [[-.75, .86, .44, .33], [.35, .86, .44, .35]]);lamps(1.5, .72, .38, .15);bumper(1.6, .42, 1.4);ailes(true, true, 'paint', .56);
        for (const side of [-1, 1]) tube('chrome', [[side * .42, .86, .43], [side * .42, 1.22, .47], [side * .2, 1.26, .49]], .02);B('verre', .8, .3, .025, .03, 0, 1.08, .48, -.25);
        B('accent', .9, .16, .3, .06, 0, 1.1, -1.18);moteur(-1.5, .66);break;
      }
      case 'fourgon': {
        // Fourgonnette : capot court, poste conducteur ouvert, grand volume arrière vitré à galerie de toit.
        P('paint', [[-.92, .74, .88, .4], [-.2, .78, .8, .38], [.5, .76, .86, .4], [1.1, .74, .88, .42], [1.7, .62, .74, .44], [1.92, .42, .6, .46]]);
        P('paint', [[-1.72, .7, 1.58, .42], [-1.4, .76, 1.68, .4], [-.98, .74, 1.62, .42]]);P('plast', [[-1.6, .8, .5, .4], [1.0, .8, .5, .4]]);
        for (const side of [-1, 1]) { B('verre', .03, .3, .44, .04, side * .76, 1.3, -1.32);tube('chrome', [[side * .6, .84, .48], [side * .6, 1.43, .48]], .025);tube('metal', [[side * .58, 1.72, -1.62], [side * .58, 1.72, -1.0]], .025); }
        B('verre', .9, .28, .03, .04, 0, 1.3, -1.74);B('accent', .72, .22, .4, .08, 0, 1.82, -1.3);ailes(false, true);lamps(1.86, .64, .47, .1);bumper(1.98, .42, 1.65);moteur(-1.62, .56);break;
      }
      case 'limousine': {
        // Limousine : très longue caisse basse, capot interminable, calandre chromée, ailerons de coffre, enjoliveurs chromés.
        P('paint', [[-2.12, .5, .72, .36], [-1.7, .72, .84, .32], [-1.0, .74, .86, .3], [-.5, .86, .76, .3], [.3, .88, .74, .3], [.9, .86, .8, .31], [1.42, .76, .82, .32], [2.0, .7, .72, .33], [2.4, .52, .62, .36]]);
        P('plast', [[-1.6, .9, .4, .29], [.9, .92, .4, .29]]);lamps(2.32, .57, .48, .085);bumper(2.46, .38, 1.5, 'chrome');ailes(true, true, 'paint', .55);
        for (const side of [-1, 1]) { tube('chrome', [[side * .92, .5, -1.63], [side * .94, .5, -.15], [side * .9, .5, 1.0]], .024);ailette('paint', [[-2.05, .62], [-1.85, 1.12], [-1.38, .7]], side * .62); }
        for (let i = 0; i < 5; i++) B('chrome', .7, .024, .035, .008, 0, .45 + i * .05, 2.42);E('chrome', .04, .07, .08, 0, .8, 2.2);moteur(-1.78, .6);break;
      }
      case 'herisson': {
        // Hérisson : dos rond comme une pelote couvert de piquants, museau ivoire à truffe, oreilles rondes.
        P('paint', [[-1.72, .2, .8, .5], [-1.4, .64, 1.06, .38], [-.9, .8, 1.08, .34], [-.45, .84, .92, .32], [.3, .82, .8, .34], [.7, .66, .84, .38]]);
        P('ivory', [[.53, .54, .88, .4], [.94, .51, .75, .39], [1.48, .27, .56, .4], [1.8, .05, .5, .44]]);
        // Piquants posés sur la surface du dos et orientés selon sa normale, jamais dans le cockpit.
        for (const [z, hw, top, bot] of [[-1.62, .42, .9, .48], [-1.38, .64, 1.06, .38], [-1.12, .74, 1.08, .36], [-.86, .8, 1.06, .34], [-.62, .82, .98, .33]]) for (let a = -1.25; a <= 1.26; a += .3125) { if (Math.abs(a) < .45 && z > -.9) continue;const mid = (top + bot) / 2, x = Math.sin(a) * hw, y = mid + Math.cos(a) * (top - mid);add('paint2', place(new T.ConeGeometry(.07, .3, 7), x + Math.sin(a) * .1, y + Math.cos(a) * .1, z, -.25, 0, -a)); }
        E('dark', .09, .065, .07, 0, .51, 1.8);for (const side of [-1, 1]) { E('dark', .04, .06, .04, side * .37, .74, 1.1);E('paint', .1, .12, .05, side * .5, .98, .56); }ailes(true, true, 'paint', .5);moteur(-1.55, .55);break;
      }
      case 'torpille': {
        // Torpille : fuselage cylindrique étroit sur balanciers, hublots, périscope, hélice tripale à l'arrière.
        P('paint', [[-1.98, .12, .84, .6], [-1.6, .42, 1.02, .42], [-1.0, .5, 1.06, .36], [-.45, .52, .88, .34], [.4, .52, .9, .34], [1.1, .5, .96, .33], [1.7, .36, .86, .38], [2.16, .06, .66, .55]]);
        for (const side of [-1, 1]) { P('paint2', [[-1.35, .04, .6, .42], [-1.05, .15, .66, .36], [.5, .15, .66, .36], [.8, .04, .6, .42]], side * .68);anneau('chrome', .1, .022, side * .5, .72, 1.1, 0, Math.PI / 2);cyl('verre', .085, .03, side * .5, .72, 1.1, 0, 0, Math.PI / 2);ailette('accent', [[.65, .45], [1.04, .64], [1.38, .45]], side * .52); }
        tube('plast', [[.33, .86, -.93], [.33, 1.5, -.93], [.33, 1.5, -.7]], .04);cyl('verre', .065, .025, .33, 1.5, -.65, Math.PI / 2);
        cyl('metal', .1, .26, 0, .72, -2.02, Math.PI / 2);for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3;B('metal', .075, .52, .07, .025, Math.sin(a) * .13, .72 + Math.cos(a) * .13, -2.16, 0, 0, -a); }flames = [];break;
      }
    }
    for (const side of [-1, 1]) B('feu', .18, .06, .035, .018, side * .43, .58, -1.7);
    anc.echappements = flames.map((f) => ({ x: f.x, y: f.y, z: f.z }));
    if (body !== 'galet') raccordsGeneriques(T, add, COLLECTE, WD, anc, WD.w + .14, null);   // Galet : voile sculpté sur sa monocoque
    return { flames, deco, echappementIntegre: true, ancrages: anc };
  }
  root.WKCarrosseriesPrototype = { construire, noms: NOMS, avant: AVANT, largeur: LARGEUR, version: 'lot-19-01' };
})(typeof window !== 'undefined' ? window : globalThis);
