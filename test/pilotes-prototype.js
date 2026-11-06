/* Habillage des cinq pilotes : les pivots et heroAnimate restent ceux du jeu. */
(function (root) {
  'use strict';
  function habiller(T, cfg, mats, R) {
    const { root: base, torso, head, spin } = R;
    const groups = new Map();
    const add = (parent, material, geo) => { let byMat = groups.get(parent);if (!byMat) groups.set(parent, byMat = new Map());let gs = byMat.get(material);if (!gs) byMat.set(material, gs = []);gs.push(geo); };
    const move = (g, x, y, z, rx = 0, ry = 0, rz = 0) => {g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(1, 1, 1)));return g;};
    function ball(parent, mat, rx, ry, rz, x, y, z) {const g = new T.SphereGeometry(1, 16, 10);g.scale(rx, ry, rz);add(parent, mat, move(g, x, y, z));}
    function segment(parent, mat, a, b, r) {const A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A), g = new T.CapsuleGeometry(r, Math.max(.005, d.length() - 2 * r), 3, 8);g.applyMatrix4(new T.Matrix4().compose(A.add(B).multiplyScalar(.5), new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()), new T.Vector3(1, 1, 1)));add(parent, mat, g);}
    function panel(parent, mat, w, h, d, x, y, z, rx = 0) {const g = new T.BoxGeometry(w, h, d, 1, 1, 1);add(parent, mat, move(g, x, y, z, rx));}
    const robot = cfg.pilot === 'robot';
    // Réduire la tête et élargir légèrement le buste donne une assise plus naturelle.
    head.scale.setScalar(robot ? .96 : .91);torso.scale.set(1.08, 1.04, 1.02);
    const contrast = mats.glove, textile = mats.suit, trim = mats.helm;
    if (robot) {
      // Panneaux de carter et petits indicateurs : pas une simple combinaison humaine repeinte.
      panel(torso, mats.metal, .41, .25, .035, 0, .05, .24);
      for (const s of [-1, 1]) {ball(torso, mats.metal, .13, .12, .13, s * .3, .18, 0);ball(head, mats.metal, .07, .07, .045, s * .25, -.18, .2);segment(torso, mats.dark, [s * .2, -.13, .22], [s * .2, .17, .24], .015);}
      for (let i = 0; i < 3; i++) panel(torso, mats.led, .045, .025, .02, -.09 + i * .09, .08, .265);
      for (let i = 0; i < 4; i++) panel(head, mats.dark, .045, .012, .012, -.09 + i * .06, -.18, .25);
    } else {
      // Bas du visage, oreilles et contours de paupières distincts de la coiffe.
      ball(head, mats.skin, .18, .095, .16, 0, -.2, .06);
      for (const s of [-1, 1]) {
        ball(head, mats.skin, .055, .075, .035, s * .285, -.04, .015);
        segment(head, mats.skin, [s * .18, .07, .24], [s * .075, .07, .28], .014);
        ball(torso, textile, .11, .13, .13, s * .25, .13, 0);
      }
      // Veste/combinaison : col, fermeture, coutures, ceinture et poche réellement assemblés.
      const collar = new T.TorusGeometry(.19, .028, 6, 24);add(torso, contrast, move(collar, 0, .22, .015, Math.PI / 2));
      segment(torso, contrast, [0, -.17, .24], [0, .17, .25], .009);
      ball(torso, mats.metal, .018, .025, .01, .01, .12, .27);
      for (const s of [-1, 1]) {segment(torso, trim, [s * .19, -.13, .18], [s * .22, .11, .21], .012);segment(torso, contrast, [s * .21, .14, .15], [s * .13, .19, .2], .009);}
      panel(torso, trim, .1, .08, .016, -.105, .065, .25);panel(torso, contrast, .055, .018, .019, -.105, .075, .263);
      const belt = new T.TorusGeometry(.27, .025, 6, 24);belt.scale(1, .78, 1);add(torso, mats.dark, move(belt, 0, -.16, 0, Math.PI / 2));
      panel(torso, mats.metal, .075, .045, .02, 0, -.16, .235);
    }
    // Bassin, jambes fléchies et chaussures dans le volume libre du cockpit.
    ball(base, textile, .25, .12, .2, 0, .79, -.4);
    for (const s of [-1, 1]) {
      segment(base, robot ? mats.metal : textile, [s * .13, .79, -.3], [s * .18, .66, .08], .095);
      segment(base, robot ? mats.metal : textile, [s * .18, .66, .08], [s * .17, .49, .38], .078);
      ball(base, mats.dark, .105, .08, .18, s * .17, .46, .43);
      panel(base, contrast, .17, .024, .27, s * .17, .405, .44);
      if (robot) ball(base, mats.metal, .09, .09, .09, s * .18, .66, .08);
      else {segment(base, trim, [s * .2, .73, -.17], [s * .22, .65, .12], .009);panel(base, trim, .13, .04, .03, s * .17, .49, .57);}
    }
    if (cfg.pilot === 'heros') {
      // Lunettes de pilote et écharpe, attachées au bon pivot animé.
      for (const s of [-1, 1]) segment(head, mats.dark, [s * .18, .28, .27], [s * .31, .24, 0], .017);
      segment(torso, trim, [.1, .23, -.03], [.27, .1, -.21], .045);
    } else if (cfg.pilot === 'casquette') {
      // Cheveux à volumes distincts et surpiqûres de la casquette.
      for (let i = -2; i <= 2; i++) ball(head, mats.dark, .045, .065, .035, i * .08, .05, -.27);
      for (const s of [-1, 1]) segment(head, contrast, [s * .12, .26, .1], [s * .15, .12, .27], .008);
      panel(head, contrast, .09, .055, .012, 0, .11, .3);
    } else if (cfg.pilot === 'capuche') {
      for (const s of [-1, 1]) {segment(torso, contrast, [s * .12, .21, .21], [s * .14, -.02, .26], .01);ball(torso, mats.metal, .014, .022, .014, s * .14, -.04, .26);}
      panel(torso, textile, .29, .09, .03, 0, -.055, .25);
    } else if (cfg.pilot === 'casque') {
      for (const s of [-1, 1]) {ball(head, mats.metal, .025, .04, .04, s * .345, 0, .07);segment(head, contrast, [s * .26, -.12, .11], [s * .18, -.22, .21], .015);}
      panel(head, mats.dark, .16, .025, .025, 0, .22, .3);
    }
    // Inserts du volant, toujours enfants du pivot tournant existant.
    ball(spin, mats.helm, .042, .042, .02, 0, 0, -.032);   // côté pilote (l'axe +z du volant pointe vers la colonne)
    // Fusion par parent et matériau : les détails suivent le rig sans maillage par couture.
    for (const [parent, byMat] of groups) for (const [material, gs] of byMat) {
      const raw = gs.map(g => g.index ? g.toNonIndexed() : g), count = raw.reduce((n, g) => n + g.attributes.position.count, 0);
      const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uv = new Float32Array(count * 2);let at = 0;
      for (const g of raw) {pos.set(g.attributes.position.array, at * 3);nor.set(g.attributes.normal.array, at * 3);if (g.attributes.uv) uv.set(g.attributes.uv.array, at * 2);at += g.attributes.position.count;}
      const geo = new T.BufferGeometry();geo.setAttribute('position', new T.BufferAttribute(pos, 3));geo.setAttribute('normal', new T.BufferAttribute(nor, 3));geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
      const mesh = new T.Mesh(geo, material);mesh.castShadow = true;parent.add(mesh);R.detail.push(mesh);
      for (const g of new Set([...gs, ...raw])) g.dispose();
    }
    R.versionVisuelle = 'pilotes-lot-01';
  }
  root.WKPilotesPrototype = { habiller, version: 'pilotes-lot-01' };
})(typeof window !== 'undefined' ? window : globalThis);
