/* Lot de carrosseries original Wild Kart — prototypes du 4 novembre 2026.
   Chaque thème a ses panneaux et ses assemblages ; roues, appuis et statistiques conservés. */
(function (root) {
  'use strict';
  const NOMS = Object.freeze({ equilibre: 'Équilibré', bolide: 'Bolide', libellule: 'Libellule', buggy: 'Buggy', fusee: 'Fusée', sport: 'Sportive', monstre: 'Monster 4x4', baignoire: 'Baignoire', scarabee: 'Scarabée', lutin: 'Lutin', requin: 'Requin', tracteur: 'Tracteur', comete: 'Comète', galet: 'Galet', mini: 'Mini', fourgon: 'Fourgonnette', limousine: 'Limousine', herisson: 'Hérisson', torpille: 'Torpille' });
  // Même implantation que BODY_FZ/BODY_WIDE de la base. Les tests contrôlent cette correspondance.
  const AVANT = Object.freeze({ equilibre: 1.05, bolide: 1.22, libellule: 1.05, buggy: 1.12, fusee: 1.25, sport: 1.28, monstre: 1.15, baignoire: 1.05, scarabee: 1.05, lutin: 1, requin: 1.25, tracteur: 1.12, comete: 1.25, galet: 1.05, mini: .95, fourgon: 1.1, limousine: 1.42, herisson: 1.1, torpille: 1.3 });
  const LARGEUR = Object.freeze({ buggy: .06, monstre: .2, baignoire: .04, tracteur: .14, herisson: .1, fourgon: .06, scarabee: .04, limousine: .02 });
  function construire(T, add, WD, cfg) {
    const body = cfg.body || 'equilibre';
    if (!Object.hasOwn(NOMS, body)) throw new Error('Carrosserie inconnue : ' + body);
    if (body === 'equilibre') return root.WKEquilibrePrototype.construire(T, add, WD, cfg);
    const { V, place, boite: B, tube, cyl, panneau: P, livree } = root.WKEquilibrePrototype.outillage(T, add);
    const fz = AVANT[body], wide = LARGEUR[body] || 0, rw = .92 + wide + WD.w / 2 - .12;
    const E = (k, rx, ry, rz, x, y, z) => { const g = new T.SphereGeometry(1, 20, 12); g.scale(rx, ry, rz); g.translate(x, y, z); add(k, g); };
    const anneau = (k, r, ep, x, y, z, rx = 0, ry = 0, rz = 0, arc = Math.PI * 2) => add(k, place(new T.TorusGeometry(r, ep, 8, 24, arc), x, y, z, rx, ry, rz));
    const ailette = (k, points, x, ep = .065) => { const s = new T.Shape();points.forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]));s.closePath();const g = new T.ExtrudeGeometry(s, { depth: ep, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 2, curveSegments: 6 });g.rotateY(-Math.PI / 2);g.translate(x + ep / 2, 0, 0);add(k, g); };
    function ailes(front = false, rear = true, k = 'paint', length = .63) {
      for (const side of [-1, 1]) for (const z of [front ? fz : null, rear ? -1 : null].filter(v => v !== null)) {
        const arc = Math.PI * length, r = WD.r + .14, g = new T.CylinderGeometry(r, r, WD.w + .14, 24, 1, true, Math.PI / 2 - arc / 2, arc);
        g.rotateZ(Math.PI / 2);g.translate(side * rw, WD.r, z);add(k, g);
      }
    }
    function lamps(z, y, x = .4, r = .1) { for (const side of [-1, 1]) { cyl('chrome', r * 1.22, .07, side * x, y, z, Math.PI / 2);cyl('lampe', r, .075, side * x, y, z + .02, Math.PI / 2); } }
    function bumper(z, y, width = 1.45, k = 'plast') { B(k, width, .16, .18, .055, 0, y, z);for (const side of [-1, 1]) tube('metal', [[side * .4, .35, z > 0 ? z - .3 : z + .3], [side * .4, y, z]], .035); }
    function wing(z = -1.5, y = 1.2, width = 1.8) { P('accent', [[z - .24, width / 2, y + .06, y], [z, width / 2, y + .11, y], [z + .24, width / 2, y + .03, y]], 0);for (const side of [-1, 1]) { B('plast', .065, .22, .52, .02, side * width / 2, y + .03, z);tube('metal', [[side * .36, .57, z], [side * .36, y, z]], .035); } }
    let deco = null;
    function hood(sections, stripe = true, material = 'paint') { P(material, sections);deco = livree(sections, cfg); }
    function sills(top = .73, k = 'paint', x = .66, w = .18, front = .48) {
      for (const side of [-1, 1]) { P(k, [[-1.35, .035, top, .42], [-1.02, w, top + .08, .4], [-.15, w, top, .46], [front, .03, top - .08, .48]], side * x);tube('ivory', [[side * (x + w), .44, -1.02], [side * (x + w), .43, -.1], [side * (x + .04), .49, front]], .016, 6); }
    }
    function vents(x = .82, y = .55, z = -.2, count = 4) { for (const side of [-1, 1]) { B('dark', .035, .2, .48, .02, side * x, y, z);for (let i = 0; i < count; i++) B('metal', .045, .15, .025, .008, side * (x + .015), y, z - .16 + i * .11, .2); } }
    function moteur(z = -1.35, y = .88, single = true) {
      B('metal', .58, .34, .42, .05, 0, y, z);for (let i = 0; i < 4; i++) B('metal', .68, .024, .46, .008, 0, y - .12 + i * .08, z);
      B('plast', .34, .1, .3, .025, 0, y + .22, z);
      for (const side of single ? [1] : [-1, 1]) { tube('metal', [[side * .24, y - .05, z], [side * .5, y - .02, z - .15], [side * .48, y, z - .48]], .06);cyl('metal', .1, .27, side * .48, y, z - .5, Math.PI / 2);cyl('dark', .07, .008, side * .48, y, z - .64, Math.PI / 2); }
    }
    // Châssis distinct de l'habillage, avec attaches vers les centres de roues du jeu.
    for (const side of [-1, 1]) {
      tube('plast', [[side * .6, .34, -1.48], [side * .7, .32, -.45], [side * .57, .34, fz + .36]], .055);
      for (const z of [-1, fz]) { tube('metal', [[side * .3, .36, z - .15], [side * (rw - .18), WD.r, z]], .032);tube('metal', [[side * .3, .46, z + .15], [side * (rw - .18), WD.r, z]], .023); }
    }
    // Assise commune : les panneaux sont construits AUTOUR de ce volume ouvert.
    B('plast', .64, .13, .55, .05, 0, .68, -.39, -.08);B('plast', .64, .66, .15, .055, 0, 1.01, -.74, -.15);
    for (const side of [-1, 1]) { tube('dark', [[side * .29, .7, -.12], [side * .31, .86, -.55], [side * .27, 1.3, -.79]], .04);tube('paint', [[side * .45, .7, .45], [side * .47, .76, -.22], [side * .43, .91, -.8]], .04); }
    tube('metal', [[0, .38, .65], [0, .76, .46], [0, 1.17, .25]], .026);
    let flames = [{ x: .48, y: .88, z: -1.99, s: .8 }];
    switch (body) {
      case 'bolide': {
        hood([[.52, .32, .77, .4], [1.05, .26, .64, .32], [1.65, .16, .5, .34], [2.16, .06, .43, .37]]);
        sills(.65, 'paint', .68, .22, .55);vents(.91, .54, -.25);wing(-1.55, 1.29, 2.05);
        P('accent', [[1.94, .98, .37, .32], [2.12, 1.02, .4, .32], [2.3, .94, .34, .3]]);moteur(-1.28, .8, false);flames = [{ x: -.48, y: .8, z: -1.92, s: .8 }, { x: .48, y: .8, z: -1.92, s: .8 }];break;
      }
      case 'libellule': {
        hood([[.53, .46, .83, .45], [.95, .66, .83, .4], [1.43, .5, .67, .4], [1.72, .16, .59, .46]], false);sills(.78, 'paint', .7, .22);ailes(true, true, 'paint', .72);lamps(1.66, .66, .32, .1);
        // Deux ailes nervurées originales, ancrées derrière le cockpit.
        for (const side of [-1, 1]) { const g = new T.SphereGeometry(1, 20, 10);g.scale(.62, .024, .24);add('canopy', place(g, side * .71, 1.17, -1.11, 0, side * .4, side * .2));tube('chrome', [[side * .2, .85, -1.25], [side * .68, 1.17, -1.11], [side * 1.23, 1.26, -1.2]], .018); }
        bumper(1.8, .44);moteur(-1.4, .74);break;
      }
      case 'buggy': {
        hood([[.54, .54, .77, .42], [1.03, .6, .71, .36], [1.56, .43, .62, .38], [1.74, .2, .54, .4]], false);sills(.68);ailes(true, true, 'paint', .48);
        for (const side of [-1, 1]) { tube('plast', [[side * .58, .65, -.93], [side * .59, 1.72, -.77], [side * .5, 1.78, -.3], [side * .51, .7, .45]], .048);tube('metal', [[side * .6, 1.58, -.8], [side * .48, .55, -1.48]], .035); }
        tube('plast', [[-.59, 1.72, -.77], [0, 1.85, -.77], [.59, 1.72, -.77]], .05);bumper(1.99, .54, 1.55, 'metal');lamps(1.76, .69);moteur(-1.38, .76);break;
      }
      case 'fusee': {
        hood([[.52, .46, .98, .4], [1.04, .46, .98, .4], [1.65, .31, .89, .48], [2.15, .02, .69, .64]], false);sills(.83, 'paint', .65, .19);
        for (const side of [-1, 1]) { ailette('accent', [[1.3, .45], [1.58, .92], [1.87, .43]], side * .66);anneau('chrome', .14, .025, side * .46, .79, 1.05, 0, Math.PI / 2);cyl('verre', .115, .025, side * .47, .79, 1.05, 0, 0, Math.PI / 2); }
        P('paint', [[-1.75, .35, 1.02, .43], [-1.42, .43, 1.1, .4], [-1.02, .3, .96, .47]]);
        cyl('metal', .34, .25, 0, .75, -1.78, Math.PI / 2);cyl('plast', .26, .27, 0, .75, -1.98, Math.PI / 2);cyl('dark', .2, .008, 0, .75, -2.12, Math.PI / 2);ailette('accent', [[-1.6, 1.0], [-1.45, 1.62], [-1.05, 1.0]], 0);
        flames = [{ x: 0, y: .75, z: -2.14, s: 1.7 }];break;
      }
      case 'sport': {
        hood([[.53, .55, .76, .35], [1.0, .69, .69, .31], [1.66, .58, .53, .32], [2.17, .31, .46, .35]]);sills(.72, 'paint', .74, .18);vents(.94, .58, -.45);ailes(true, true, 'paint', .6);lamps(2.08, .48, .43, .07);bumper(2.2, .32, 1.55);wing(-1.6, 1.17, 1.9);moteur(-1.36, .73, false);break;
      }
      case 'monstre': {
        hood([[.53, .58, .92, .45], [1.12, .74, .93, .44], [1.65, .68, .87, .48], [1.87, .42, .75, .5]], false);sills(.9, 'paint', .79, .22);ailes(true, true, 'paint', .55);bumper(1.95, .52, 1.9, 'metal');lamps(1.86, .83, .5, .12);
        for (const side of [-1, 1]) { tube('plast', [[side * .58, .65, -.87], [side * .58, 1.76, -.89], [side * .5, 1.9, -.6]], .055);B('metal', .45, .065, .62, .02, side * .83, .45, -.15);cyl('chrome', .052, .45, side * .76, .59, .79, 0, 0, side * .32); }
        tube('plast', [[-.5, 1.9, -.6], [0, 1.94, -.6], [.5, 1.9, -.6]], .05);for (const x of [-.33, 0, .33]) cyl('lampe', .08, .08, x, 1.92, -.53, Math.PI / 2);moteur(-1.43, .94, false);break;
      }
      case 'baignoire': {
        deco = livree([[1.32, .4, 1.115, 1.11], [1.43, .4, 1.115, 1.11]], cfg);
        // Cuve ouverte : quatre parois, jamais un volume plein sous un disque d'eau.
        for (const side of [-1, 1]) { P('email', [[-1.5, .06, 1.04, .52], [-1.1, .15, 1.09, .44], [.92, .16, 1.08, .44], [1.5, .04, 1.03, .55]], side * .74);tube('email', [[side * .74, 1.08, -1.2], [side * .84, 1.1, -.3], [side * .78, 1.08, 1.2]], .065); }
        for (const z of [-1.35, 1.38]) { B('email', 1.4, .5, .12, .05, 0, .78, z);tube('email', [[-.72, 1.05, z], [0, 1.11, z + (z < 0 ? -.09 : .09)], [.72, 1.05, z]], .065); }
        for (const side of [-1, 1]) for (const z of [-1.05, 1.06]) { cyl('gold', .07, .22, side * .6, .38, z);E('gold', .12, .065, .16, side * .62, .27, z + .05); }
        tube('chrome', [[-.55, .6, -1.25], [-.55, 1.9, -1.25], [-.55, 1.93, -.85]], .045);cyl('chrome', .11, .08, -.55, 1.9, -.83, Math.PI / 2);E('duck', .13, .11, .17, .43, 1.18, 1.05);E('duck', .08, .08, .08, .43, 1.32, 1.13);B('beak', .08, .035, .09, .012, .43, 1.3, 1.22);ailes(false, true, 'email', .45);moteur(-1.57, .54);break;
      }
      case 'scarabee': {
        hood([[.53, .57, .92, .42], [.98, .64, .87, .4], [1.48, .45, .7, .42], [1.83, .08, .6, .48]], false);sills(.89, 'paint', .67, .25);
        for (const side of [-1, 1]) { P('paint', [[-1.65, .04, .84, .5], [-1.3, .31, 1.12, .44], [-.87, .27, 1.02, .5]], side * .35);tube('plast', [[side * .24, .83, 1.34], [side * .32, 1.13, 1.64], [side * .4, 1.25, 1.75]], .018);E('gold', .045, .045, .045, side * .4, 1.25, 1.75);for (const z of [-.6, .1]) tube('metal', [[side * .75, .47, z], [side * .94, .43, z + .12]], .035); }
        lamps(1.73, .69, .3, .12);ailes(false, true, 'paint', .6);moteur(-1.5, .57);break;
      }
      case 'lutin': {
        hood([[.53, .51, .77, .41], [1.03, .57, .7, .39], [1.52, .31, .81, .52], [1.8, .02, 1.03, .94]], false);sills(.77, 'paint', .7, .22);
        for (const side of [-1, 1]) { tube('ivory', [[side * .76, .39, -1.2], [side * .84, .37, .2], [side * .5, .45, 1.42], [side * .15, .72, 1.7]], .035);for (let i = 0; i < 4; i++) B('ivory', .035, .07, .018, .005, side * .78, .62, -.7 + i * .22); }
        E('gold', .07, .07, .07, 0, 1.07, 1.8);P('accent', [[-1.55, .22, .92, .55], [-1.38, .35, 1.17, .52], [-1.0, .22, .96, .53]]);tube('ivory', [[-.38, .95, -1.34], [0, .98, -1.57], [.38, .95, -1.34]], .035);ailes(false, true);moteur(-1.55, .6);break;
      }
      case 'requin': {
        hood([[.53, .5, .94, .37], [1.1, .61, .9, .34], [1.7, .43, .73, .38], [2.1, .07, .61, .46]], false);P('ivory', [[1.05, .4, .43, .36], [1.62, .35, .49, .38], [2.04, .05, .53, .47]]);sills(.9, 'paint', .64, .22);vents(.87, .66, -.12, 3);
        for (const side of [-1, 1]) { E('dark', .035, .065, .065, side * .49, .81, 1.5);ailette('paint', [[-.28, .5], [.18, .77], [.58, .47]], side * .89); }
        ailette('paint', [[-1.68, .78], [-1.42, 1.48], [-1.0, .81]], 0);for (const z of [-1.7, -1.83]) B('plast', .05, .07, .12, .01, 0, .75, z);ailette('paint', [[-1.9, .4], [-1.68, .76], [-1.89, 1.14]], 0);moteur(-1.43, .57);break;
      }
      case 'tracteur': {
        hood([[.54, .48, 1.0, .48], [1.03, .58, 1.11, .47], [1.6, .53, 1.06, .5], [1.9, .4, .94, .55]], false);sills(.7, 'paint', .69, .18);ailes(false, true, 'paint', .86);
        B('dark', .65, .44, .06, .025, 0, .78, 1.91);for (let k = 0; k < 7; k++) B('metal', .035, .39, .07, .012, -.27 + k * .09, .78, 1.95);lamps(1.96, 1.02, .38, .1);
        cyl('plast', .055, .78, .34, 1.45, 1.13);cyl('metal', .08, .07, .34, 1.88, 1.13);for (const side of [-1, 1]) B('metal', .38, .06, .45, .02, side * .78, .45, -.1);moteur(-1.41, .68);break;
      }
      case 'comete': {
        hood([[.53, .47, .8, .36], [1.04, .59, .72, .33], [1.7, .28, .56, .36], [2.17, .02, .45, .4]], false);sills(.76, 'paint', .68, .17);
        for (const side of [-1, 1]) { tube('led', [[side * .72, .64, -.93], [side * .83, .65, -.35], [side * .73, .61, .31]], .018);ailette('accent', [[-1.55, .65], [-1.8, .99], [-.87, .76]], side * .6); }
        const star = new T.OctahedronGeometry(.14);star.scale(1, .55, 1);star.translate(0, .58, 1.9);add('gold', star);bumper(2.05, .34, 1.12);cyl('metal', .15, .25, 0, .73, -1.68, Math.PI / 2);cyl('led', .1, .03, 0, .73, -1.83, Math.PI / 2);flames = [{ x: 0, y: .73, z: -1.86, s: 1.25 }];break;
      }
      case 'galet': {
        hood([[.52, .5, .84, .4], [.94, .68, .8, .35], [1.5, .53, .61, .38], [1.88, .15, .49, .4]]);sills(.79, 'paint', .73, .22);ailes(true, true, 'paint', .68);lamps(1.8, .6, .4, .09);bumper(1.94, .4);wing(-1.48, 1.18, 1.7);moteur(-1.35, .82, false);break;
      }
      case 'mini': {
        hood([[.53, .51, .87, .4], [.84, .62, .83, .38], [1.21, .55, .7, .4], [1.43, .34, .62, .43]], false);sills(.81, 'paint', .68, .22, .39);lamps(1.45, .7, .36, .14);bumper(1.54, .42);ailes(true, true, 'paint', .56);
        for (const side of [-1, 1]) tube('chrome', [[side * .38, .77, .43], [side * .38, 1.18, .47], [side * .2, 1.22, .49]], .018);
        B('accent', .85, .18, .28, .06, 0, .9, -1.11);for (let i = 0; i < 3; i++) tube('dark', [[-.4, .95 + i * .025, -1.03 - i * .08], [0, .98 + i * .025, -1.03 - i * .08], [.4, .95 + i * .025, -1.03 - i * .08]], .018);moteur(-1.43, .61);break;
      }
      case 'fourgon': {
        // Fourgonnette ouverte : poste conducteur visible, toit arrière indépendant.
        hood([[.53, .67, .83, .42], [1.12, .72, .81, .4], [1.67, .61, .65, .44], [1.86, .4, .56, .46]], false);sills(.91, 'paint', .76, .2);ailes(false, true);lamps(1.8, .63, .47, .1);bumper(1.93, .42, 1.65);
        for (const side of [-1, 1]) { B('paint', .12, .75, .6, .04, side * .72, 1.05, -1.27);B('verre', .035, .26, .4, .03, side * .8, 1.18, -1.28);tube('chrome', [[side * .59, .8, .48], [side * .6, 1.43, .48]], .025); }
        B('paint', 1.45, .13, .6, .06, 0, 1.47, -1.29);B('paint', 1.42, .8, .1, .035, 0, 1.04, -1.6);B('verre', .8, .24, .025, .03, 0, 1.22, -1.67);
        tube('metal', [[-.58, 1.61, -1.55], [-.58, 1.61, -1.0]], .025);tube('metal', [[.58, 1.61, -1.55], [.58, 1.61, -1.0]], .025);B('accent', .7, .23, .36, .07, 0, 1.68, -1.3);moteur(-1.56, .54);break;
      }
      case 'limousine': {
        hood([[.53, .58, .82, .37], [1.1, .72, .76, .34], [1.8, .61, .63, .36], [2.34, .4, .56, .4]], false);sills(.8, 'paint', .77, .18);lamps(2.29, .57, .45, .085);bumper(2.4, .38, 1.5, 'chrome');ailes(true, true, 'paint', .55);
        for (const side of [-1, 1]) { tube('chrome', [[side * .9, .46, -1.63], [side * .95, .45, -.15], [side * .64, .47, 1.8]], .024);ailette('paint', [[-2.0, .56], [-1.83, 1.1], [-1.34, .65]], side * .65);cyl('metal', .012, .34, side * .48, 1.02, 1.93);B('accent', .02, .12, .19, .008, side * .54, 1.15, 1.94); }
        P('paint', [[-2.05, .24, .68, .42], [-1.72, .62, .79, .37], [-1.03, .48, .81, .39]]);for (let i = 0; i < 5; i++) B('chrome', .65, .024, .035, .008, 0, .49 + i * .047, 2.37);moteur(-1.73, .58);break;
      }
      case 'herisson': {
        hood([[.53, .54, .88, .4], [.94, .51, .75, .39], [1.48, .27, .56, .4], [1.8, .05, .5, .44]], false, 'ivory');sills(.83, 'paint', .68, .24);
        P('paint', [[-1.66, .08, .7, .45], [-1.3, .64, 1.01, .4], [-.92, .43, .95, .44]]);
        // Piquants disposés sur les épaules/arrière, jamais dans le cockpit.
        for (let i = 0; i < 28; i++) { const side = i % 2 ? 1 : -1, z = -1.25 + Math.floor(i / 2) % 7 * .17, x = side * (.62 + .11 * (Math.floor(i / 14))), y = .84 + .07 * (i % 3);const g = new T.ConeGeometry(.085, .3, 7);add('paint2', place(g, x, y + .13, z, -.3, 0, -side * .4)); }
        E('dark', .09, .065, .07, 0, .51, 1.78);for (const side of [-1, 1]) { E('dark', .035, .055, .035, side * .37, .72, 1.08);E('paint', .095, .12, .045, side * .49, .96, .55); }ailes(false, true, 'paint', .45);moteur(-1.51, .53);break;
      }
      case 'torpille': {
        hood([[.53, .42, .94, .37], [1.1, .47, .96, .33], [1.7, .34, .85, .39], [2.14, .045, .64, .54]], false);sills(.83, 'paint', .59, .19);
        for (const side of [-1, 1]) { cyl('chrome', .11, .028, side * .46, .75, 1.1, 0, 0, Math.PI / 2);cyl('verre', .085, .03, side * .48, .75, 1.1, 0, 0, Math.PI / 2);ailette('accent', [[.65, .45], [1.04, .64], [1.38, .45]], side * .7); }
        P('paint', [[-1.89, .12, .84, .55], [-1.45, .45, 1.0, .35], [-.98, .3, .94, .4]]);tube('plast', [[.33, .83, -.93], [.33, 1.48, -.93], [.33, 1.48, -.7]], .04);cyl('verre', .065, .025, .33, 1.48, -.65, Math.PI / 2);
        cyl('metal', .1, .26, 0, .72, -1.98, Math.PI / 2);for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3;B('metal', .075, .52, .07, .025, Math.sin(a) * .13, .72 + Math.cos(a) * .13, -2.12, 0, 0, -a); }flames = [];break;
      }
    }
    for (const side of [-1, 1]) B('feu', .18, .06, .035, .018, side * .43, .58, -1.7);
    return { flames, deco };
  }
  root.WKCarrosseriesPrototype = { construire, noms: NOMS, avant: AVANT, largeur: LARGEUR, version: 'lot-19-01' };
})(typeof window !== 'undefined' ? window : globalThis);
