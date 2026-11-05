/* Équilibré — témoin de carrosserie approuvé, prototype isolé du 4 novembre 2026.
   Les roues et le rig restent ceux de game.js ; seuls les panneaux de ce corps changent. */
(function (root) {
  'use strict';
  function outillage(T, add) {
    const V = (x, y, z) => new T.Vector3(x, y, z), tau = Math.PI * 2;
    const place = (g, x, y, z, rx = 0, ry = 0, rz = 0) => {
      g.applyMatrix4(new T.Matrix4().compose(V(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), V(1, 1, 1))); return g;
    };
    function boite(k, w, h, d, r, x, y, z, rx = 0, ry = 0, rz = 0) {
      r = Math.max(.001, Math.min(r, w / 2 - .001, h / 2 - .001, d / 2 - .001));
      const sw = w - 2 * r, sh = h - 2 * r, s = new T.Shape(), a = -sw / 2, b = -sh / 2;
      const cr = Math.min(r * .8, sw / 2, sh / 2);
      s.moveTo(a + cr, b); s.lineTo(a + sw - cr, b); s.quadraticCurveTo(a + sw, b, a + sw, b + cr);
      s.lineTo(a + sw, b + sh - cr); s.quadraticCurveTo(a + sw, b + sh, a + sw - cr, b + sh);
      s.lineTo(a + cr, b + sh); s.quadraticCurveTo(a, b + sh, a, b + sh - cr);
      s.lineTo(a, b + cr); s.quadraticCurveTo(a, b, a + cr, b);
      const g = new T.ExtrudeGeometry(s, { depth: Math.max(.001, d - 2 * r), bevelEnabled: true, bevelSize: r, bevelThickness: r, bevelSegments: 3, curveSegments: 4, steps: 1 });
      g.translate(0, 0, -d / 2 + r); add(k, place(g, x, y, z, rx, ry, rz));
    }
    // ferme = true : boucle continue (courbe fermée), sans jointure ni bouts ouverts (rebord du cockpit creusé).
    function tube(k, pts, r, radial = 8, ferme = false) {
      const c = new T.CatmullRomCurve3(pts.map(p => V(...p)), ferme);
      add(k, new T.TubeGeometry(c, Math.max(4, pts.length * 4), r, radial, ferme));
    }
    function cyl(k, r, h, x, y, z, rx = 0, ry = 0, rz = 0, r2 = r) {
      add(k, place(new T.CylinderGeometry(r, r2, h, 18, 1), x, y, z, rx, ry, rz));
    }
    // Panneau fermé à section variable ; aucun panneau ne traverse le volume du cockpit.
    // Options (#36, cockpit creusé du Galet) : { n, m } résolution ; deformer(pos) modifie les sommets avant le calcul des normales.
    function panneau(k, sections, x = 0, opts = null) {
      const pos = [], uv = [], ids = [], n = (opts && opts.n) || 30, m = (opts && opts.m) || 24;
      for (let i = 0; i <= n; i++) {
        const z = sections[0][0] + (sections[sections.length - 1][0] - sections[0][0]) * i / n;
        // Interpolation monotone locale : évite les dépassements de largeur près des extrémités.
        let a = 0; while (a < sections.length - 2 && sections[a + 1][0] < z) a++;
        const A = sections[a], B = sections[a + 1], t0 = (z - A[0]) / (B[0] - A[0]), t = t0 * t0 * (3 - 2 * t0);
        const w = A[1] + (B[1] - A[1]) * t, top = A[2] + (B[2] - A[2]) * t, bottom = A[3] + (B[3] - A[3]) * t;
        for (let j = 0; j <= m; j++) {
          const th = j / m * tau, sx = Math.sign(Math.sin(th)) * Math.pow(Math.abs(Math.sin(th)), .8), sy = -Math.sign(Math.cos(th)) * Math.pow(Math.abs(Math.cos(th)), .8);
          pos.push(x + w * sx, (top + bottom) / 2 + (top - bottom) / 2 * sy, z); uv.push(j / m, i / n);
        }
      }
      for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const a = i * (m + 1) + j, b = a + m + 1; ids.push(a, a + 1, b, a + 1, b + 1, b); }
      for (const ring of [0, n]) {
        const s = sections[ring ? sections.length - 1 : 0], c = pos.length / 3;
        pos.push(x, (s[2] + s[3]) / 2, s[0]); uv.push(.5, ring ? 1 : 0);
        for (let j = 0; j < m; j++) { const a = ring * (m + 1) + j; if (ring) ids.push(c, a, a + 1); else ids.push(c, a + 1, a); }
      }
      if (opts && opts.deformer) opts.deformer(pos);
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(ids); g.computeVertexNormals(); add(k === 'paint' && !(opts && opts.brut) ? 'coque' : k, g);   // panneau peint (opts.brut : peinture unie, sans livrée) : livrée (dégradé, joints, bande, numéro) dans ses UV
    }
    function livree(sections, cfg) {
      // Fiche V7 (#36) : bandes et damier sont désormais peints dans la livrée des panneaux, plus de plan collé par-dessus.
      if (cfg.deco === 'aucune' || cfg.livreePeinte !== false) return null;
      let geo;
      const draw = outillage(T, (_k, g) => { geo = g; });
      draw.panneau('deco', sections.map(s => [s[0], s[1] * (cfg.deco === 'damier' ? .38 : .16), s[2] + .01, s[2] + .006]));
      return geo;
    }
    // Aile pleine légère (retour coût du 5 nov.) : section rectangulaire à coins arrondis (largeur wf, épaisseur ep, rayon intérieur
    // rIn) balayée sur un arc centré sur le dessus de la roue, bouts fermés ; géométrie indexée (~450 sommets au lieu de 5 460).
    function ailePleine(rIn, ep, wf, arc, cx, cy, cz, nArc = 24) {
      const prof = [], hw = wf / 2, ht = ep / 2, rr = Math.min(.018, ht * .9), q = 3;
      for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) for (let i = 0; i <= q; i++) { const a = (sx > 0 && sy > 0 ? 0 : sx < 0 && sy > 0 ? 1 : sx < 0 ? 2 : 3) * Math.PI / 2 + i / q * Math.PI / 2; prof.push([sx * (hw - rr) + Math.cos(a) * rr, sy * (ht - rr) + Math.sin(a) * rr]); }
      const m = prof.length, pos = [], ids = [], rc = rIn + ht;
      for (let i = 0; i <= nArc; i++) { const th = -arc / 2 + arc * i / nArc; for (const [lx, lr] of prof) pos.push(cx + lx, cy + (rc + lr) * Math.cos(th), cz + (rc + lr) * Math.sin(th)); }
      for (let i = 0; i < nArc; i++) for (let j = 0; j < m; j++) { const a = i * m + j, b = i * m + (j + 1) % m, c2 = a + m, d = b + m; ids.push(a, c2, b, b, c2, d); }
      for (const [ring, sgn] of [[0, 1], [nArc, -1]]) { const c0 = pos.length / 3, th = -arc / 2 + arc * ring / nArc; pos.push(cx, cy + rc * Math.cos(th), cz + rc * Math.sin(th)); for (let j = 0; j < m; j++) { const a = ring * m + j, b = ring * m + (j + 1) % m; if (sgn > 0) ids.push(c0, b, a); else ids.push(c0, a, b); } }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(ids); g.computeVertexNormals(); return g;
    }
    return { V, place, boite, tube, cyl, panneau, livree, ailePleine };
  }
  function construire(T, add, WD, cfg) {
    const { boite, tube, cyl, panneau, livree, ailePleine } = outillage(T, add);
    const rw = .92 + WD.w / 2 - .12;
    // Châssis visible, appuis de pare-chocs et liaisons aux roues existantes.
    for (const s of [-1, 1]) {
      tube('plast', [[s * .65, .36, -1.48], [s * .7, .32, -.6], [s * .65, .32, .6], [s * .48, .4, 1.55]], .065);
      for (const z of [1.05, -1]) {
        tube('metal', [[s * .34, .38, z - .16], [s * (rw - Math.min(.2, WD.w * .36)), WD.r, z]], .035);
        tube('metal', [[s * .34, .48, z + .16], [s * (rw - Math.min(.2, WD.w * .36)), WD.r, z]], .025);
      }
      tube('metal', [[s * .5, .34, 1.48], [s * .52, .43, 1.88]], .055);
    }
    // Capot avant : il s'arrête devant les genoux et laisse l'habitacle ouvert.
    const hood = [[.52, .48, .79, .38], [.85, .65, .78, .34], [1.38, .57, .65, .35], [1.78, .43, .52, .37], [1.9, .24, .45, .38]];
    panneau('paint', hood);
    // Bande ivoire sur le sommet (géométrie mince indépendante, sans changer le pneu).
    const deco = livree(hood, cfg);
    { const c = new T.CapsuleGeometry(.11, 1.3, 8, 24); c.rotateZ(Math.PI / 2); c.translate(0, .39, 1.92); add('plast', c); }   // pare-chocs lisse (gélule)
    for (const s of [-1, 1]) {
      boite('chrome', .13, .18, .06, .025, s * .48, .48, 1.82, -.2);
      cyl('metal', .032, .02, s * .48, .5, 1.86, Math.PI / 2);
      boite('lampe', .25, .065, .04, .02, s * .43, .4, 2.04);
      // Pontons : lèvres épaisses autour d'une ouverture latérale réelle.
      panneau('paint', [[-1.28, .06, .76, .5], [-.96, .2, .91, .52], [-.32, .2, .77, .59], [.27, .16, .78, .53], [.53, .04, .73, .56]], s * .64);
      panneau('plast', [[-1.34, .03, .42, .34], [-.95, .21, .43, .31], [.18, .21, .44, .31], [.58, .03, .43, .35]], s * .66);
      // Retrait noir entre les lèvres : fond intérieur et deux ailettes, pas un motif peint.
      boite('plast', .06, .15, .62, .025, s * .69, .51, -.28);
      for (const z of [-.48, -.22, .04]) boite('metal', .06, .115, .025, .01, s * .77, .51, z, .15);
      tube('ivory', [[s * .84, .46, -.89], [s * .84, .45, -.2], [s * .78, .46, .26]], .018, 6);
      // Rebord intérieur du cockpit, ancré au plancher et ouvert au centre.
      tube('paint', [[s * .48, .7, .45], [s * .48, .76, -.25], [s * .43, .91, -.77], [s * .32, .93, -.94]], .045);
      boite('plast', .06, .3, .7, .025, s * .43, .51, -.24);
    }
    // Assise et flancs du baquet autour du rig inchangé.
    boite('plast', .64, .13, .55, .055, 0, .68, -.39, -.08);
    boite('plast', .64, .68, .16, .065, 0, 1.02, -.74, -.15);
    for (const s of [-1, 1]) {
      tube('dark', [[s * .29, .7, -.15], [s * .31, .85, -.55], [s * .28, 1.3, -.79]], .045);
      tube('metal', [[s * .24, .34, -.55], [s * .24, .62, -.56]], .035);
    }
    tube('metal', [[0, .38, .78], [0, .99, .56], [0, 1.17, .27]], .026);   // colonne dans l'axe du volant (inclinaison .55 rad)
    // Garde-boue arrière uniquement : arc ouvert et compatible avec chaque dimension de roue.
    for (const s of [-1, 1]) {
      const a = Math.PI * .7, rad = WD.r + .115;
      // Retour du 5 nov. : garde-boue pleins (secteur de 4 cm extrudé, bouts fermés) au lieu de tôles ouvertes ; boudins conservés.
      const plein = (z) => { const e = ailePleine(rad, .04, WD.w + .1, a, s * rw, WD.r, z); e.userData.piece = 'aile'; return e; };
      add('paint', plein(-1));
      // #36 : ailes avant et boudins de tranche (silhouette plus pleine, inspirée des karts de dessin animé, dessin original).
      add('paint', plein(1.05));
      for (const z of [-1, 1.05]) for (const e of [-1, 1]) { const t = new T.TorusGeometry(rad + .02, .045, 8, 24, a); t.rotateZ(Math.PI / 2 - a / 2); t.rotateY(Math.PI / 2); t.translate(s * rw + e * (WD.w + .1) / 2, WD.r, z); t.userData.piece = 'aile'; add('paint', t); }
    }
    // Moteur compact nervuré et échappement unique : visibles depuis la caméra de course.
    boite('metal', .64, .38, .48, .055, 0, .91, -1.23);
    for (let k = 0; k < 5; k++) boite('metal', .72, .025, .51, .009, 0, .79 + k * .07, -1.23);
    boite('plast', .36, .12, .36, .035, 0, 1.17, -1.23);
    cyl('chrome', .085, .035, 0, 1.25, -1.23);
    tube('metal', [[.28, .86, -1.35], [.52, .85, -1.46], [.5, .9, -1.77]], .07);
    cyl('metal', .12, .34, .5, .9, -1.75, Math.PI / 2);
    cyl('dark', .085, .008, .5, .9, -1.925, Math.PI / 2);
    for (const s of [-1, 1]) {
      tube('plast', [[s * .48, .35, -1.28], [s * .5, .48, -1.7]], .05);
      boite('feu', .22, .07, .05, .02, s * .4, .67, -1.73);
    }
    boite('ivory', 1.3, .21, .18, .06, 0, .48, -1.73);
    // #34 G0 — mêmes points d'assemblage nommés que les autres carrosseries.
    const ancrages = { version: 1, roues: { avant: 1.05, arriere: -1, voie: rw, rayon: WD.r, largeur: WD.w }, siege: { x: 0, y: .68, z: -.39 }, dossier: { y: 1.02, z: -.74 }, volant: { x: 0, y: 1.2, z: .23, inclinaison: .55 },
      colonne: [[0, .38, .78], [0, .99, .56], [0, 1.17, .27]], ailes: [{ avant: true, arriere: true, arc: .7, rayon: WD.r + .115 }], phares: [{ z: 2.04, y: .4, x: .43, r: .06 }], parechocs: [{ z: 1.92, y: .39, largeur: 1.52, cote: 'avant' }], aileron: null, moteur: { z: -1.23, y: .91, double: false }, echappements: [{ x: .5, y: .9, z: -1.96 }] };
    return { flames: [{ x: .5, y: .9, z: -1.96, s: .8 }], deco, echappementIntegre: true, ancrages };
  }
  root.WKEquilibrePrototype = { construire, outillage, version: 'equilibre-temoin-01' };
})(typeof window !== 'undefined' ? window : globalThis);
