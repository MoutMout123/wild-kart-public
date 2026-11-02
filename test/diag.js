/* Wild Kart — relevé de fluidité sur appareil réel (signalements C2-1, C2-2, C2-3).
   Actif seulement avec « ?diag=1 » dans l'adresse (sinon ce fichier ne fait rien). Chargé en « async » : il ne retarde jamais
   le démarrage. Il mesure, sans rien changer au jeu :
   - le démarrage : moments « prêt » et « fin de l'animation », intervalles entre images de l'animation, gels ;
   - chaque lancement de circuit : phases de préparation (game.js, G.prepT), plus long gel pendant le chargement et dans les
     5 s qui suivent l'affichage de la course ;
   - la course : images par seconde, gels ;
   - l'appareil : navigateur, écran, carte graphique (si le navigateur la donne), compilation parallèle des shaders.
   Un bouton « Relevé » (en bas à gauche) affiche un résumé texte à copier et à envoyer. */
(function () {
  'use strict';
  if (!/[?&]diag=1(&|$)/.test(location.search)) return;
  const now = () => performance.now(), R = Math.round;
  const D = window.WK_DIAG = { v: 2, selections: [], memMax: 0, debut: R(now()), marks: {}, boot: [], longues: [], lancements: [], course: [] };
  let gapsCible = null; // tableau qui reçoit les intervalles d'images en cours (démarrage, chargement, course)
  // Intervalles entre images (fenêtre principale ; l'animation de démarrage partage ce fil sur Chrome et Safari).
  const extra = new Set(); // collectes supplémentaires (toucher d'une carte de circuit)
  let lastF = 0; const loop = (t) => { if (lastF) { const g = R(t - lastF); if (gapsCible) gapsCible.push(g); for (const a of extra) a.push(g); } lastF = t; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  // Tâches longues (Chrome, Edge, Samsung Internet ; Safari ne les donne pas).
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (D.longues.length < 400) D.longues.push([R(e.startTime), R(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch (e) { D.longuesIndispo = true; }
  // Démarrage : intervalles jusqu'à la fin de l'animation, moments « prêt » et « fin ».
  gapsCible = D.boot;
  const hookLoader = setInterval(() => { const L = window.WK_LOADER; if (!L) return; clearInterval(hookLoader); if (L.__diag) return; L.__diag = 1;
    const d = L.done; L.done = function (cb) { D.marks.pret = R(now()); return d.call(this, function () { D.marks.fin = R(now()); gapsCible = null; if (cb) return cb.apply(this, arguments); }); }; }, 5);
  // Lancements de circuits : on suit G.prep (préparation par tranches de game.js).
  let lanc = null, raceGaps = null, raceT = 0, acc = null;
  // Chaque image de course (game.js, frame) : logique, rendu côté processeur, appels de rendu, triangles.
  D.image = (lo, re, ap, tr, racing) => { if (!acc || !racing || acc.lo.length > 2000) return; acc.lo.push(lo); acc.re.push(re); acc.ap.push(ap); acc.tr.push(tr); };
  // Toucher d'une carte de circuit dans le menu (C2-1) : retour de la main, plus long gel des 6 s suivantes, temps jusqu'au nouveau décor.
  document.addEventListener('click', (e) => { const c = e.target && e.target.closest && e.target.closest('#track-cards .card'); if (!c) return; const K = window.__TK, G = K && K.G; if (!G || D.selections.length > 20) return;
    const t0 = now(), sel = { gaps: [], ti: +c.dataset.ti }; extra.add(sel.gaps); setTimeout(() => { sel.main = R(now() - t0); }, 0);
    const iv = setInterval(() => { if (sel.decor == null && G.W && G.W.ti === sel.ti && G.race && G.race.state === 'attract') sel.decor = R(now() - t0); }, 50);
    setTimeout(() => { clearInterval(iv); extra.delete(sel.gaps); D.selections.push(sel); }, 6000); }, true);
  setInterval(() => { const K = window.__TK, G = K && K.G; if (!G) return;
    if (G.prep && (!lanc || lanc.fin)) { lanc = { debut: R(now()), pendant: [], apres: [] }; gapsCible = lanc.pendant; }
    else if (!G.prep && lanc && !lanc.fin) { lanc.fin = R(now()); lanc.phases = G.prepT ? Object.assign({}, G.prepT) : null; lanc.circuit = G.W && G.W.def ? G.W.def.name || G.W.def.id : '?'; gapsCible = lanc.apres; D.lancements.push(lanc);
      const l = lanc; setTimeout(() => { if (gapsCible === l.apres) gapsCible = null; if (lanc === l) lanc = null; }, 5000); }
    // Course : par tranches de 10 s, hors préparation et hors 5 s qui suivent.
    if (performance.memory) D.memMax = Math.max(D.memMax, performance.memory.usedJSHeapSize);
    const enCourse = G.race && G.race.player && G.race.state === 'race' && !G.paused && !G.prep && !lanc;
    if (enCourse && !raceGaps) { raceGaps = []; raceT = now(); if (!gapsCible) gapsCible = raceGaps; acc = { lo: [], re: [], ap: [], tr: [], audioOff: 0, musOff: 0, live: 0, circuit: G.W && G.W.def ? (G.W.def.studio ? 'Studio · ' : '') + (G.W.def.name || G.W.def.id) : '?' }; }
    if (enCourse && acc) { const A = K.AudioSys, S = K.SAVE || {}; if (A && A.ctx && A.ctx.state !== 'running') acc.audioOff += 100; if (A && A.ctx && S.music !== false && !A.musSrc && !A.liveBus) acc.musOff += 100; if (A && A.liveBus) acc.live += 100; }
    if (raceGaps && (!enCourse || now() - raceT > 10000)) { if (gapsCible === raceGaps) gapsCible = null;
      if (raceGaps.length >= 3 && D.course.length < 60) { const st = stats(raceGaps), r = K.renderer, moy = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0), p95 = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length * .95)] : 0);
        Object.assign(st, { circuit: acc.circuit, logique: +moy(acc.lo).toFixed(1), logique95: +p95(acc.lo).toFixed(1), rendu: +moy(acc.re).toFixed(1), rendu95: +p95(acc.re).toFixed(1), appels: R(moy(acc.ap)), triangles: R(moy(acc.tr) / 1000),
          qualite: (K.SAVE || {}).quality, pr: r ? +r.getPixelRatio().toFixed(2) : null, geometries: r ? r.info.memory.geometries : null, textures: r ? r.info.memory.textures : null, audioOff: acc.audioOff, musOff: acc.musOff, live: acc.live });
        st.reste = Math.max(0, +(st.mediane - st.logique - st.rendu).toFixed(1)); D.course.push(st); }
      raceGaps = null; acc = null; }
  }, 100);
  function stats(g) { const s = [...g].sort((a, b) => a - b), q = (x) => s.length ? s[Math.floor(x * (s.length - 1))] : 0, tot = g.reduce((a, b) => a + b, 0);
    return { images: g.length, fps: tot ? +(g.length * 1000 / tot).toFixed(g.length * 1000 / tot < 10 ? 1 : 0) : 0, mediane: q(.5), p95: q(.95), max: s.length ? s[s.length - 1] : 0, gels100: g.filter((x) => x > 100).length, gels250: g.filter((x) => x > 250).length, gels1000: g.filter((x) => x > 1000).length }; }
  function gpu() { try { const K = window.__TK, gl = K && K.renderer ? K.renderer.getContext() : document.createElement('canvas').getContext('webgl2');
    const ext = gl.getExtension('WEBGL_debug_renderer_info'); return { carte: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), parallele: !!gl.getExtension('KHR_parallel_shader_compile'), webgl2: typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext }; } catch (e) { return { carte: '?' }; } }
  function resume() {
    const K = window.__TK, g = gpu(), S = (K && K.SAVE) || {}, b = stats(D.boot), L = [];
    L.push('WILD KART — relevé ?diag=1 (v' + D.v + ') — version ' + (window.WK_TEST || window.TK_VER || '?') + ' — ' + new Date().toISOString().slice(0, 16));
    L.push('Appareil : ' + navigator.userAgent);
    L.push('Écran : ' + innerWidth + '×' + innerHeight + ' ×' + (window.devicePixelRatio || 1) + ' ; cœurs ' + (navigator.hardwareConcurrency || '?') + ' ; mémoire ' + (navigator.deviceMemory || '?') + ' Go ; qualité ' + (S.quality || '?'));
    L.push('Carte graphique : ' + g.carte + ' ; WebGL2 ' + (g.webgl2 ? 'oui' : 'non') + ' ; compilation parallèle ' + (g.parallele ? 'oui' : 'non'));
    if (K && K.renderer) { const r = K.renderer; L.push('Rendu : ' + r.domElement.width + '×' + r.domElement.height + ' px ; pixelRatio ' + (+r.getPixelRatio().toFixed(2)) + ' ; programmes ' + r.info.programs.length + ' ; géométries ' + r.info.memory.geometries + ' ; textures ' + r.info.memory.textures); }
    L.push('');
    L.push('DÉMARRAGE : prêt ' + (D.marks.pret != null ? D.marks.pret + ' ms' : '—') + ', fin de l\'animation ' + (D.marks.fin != null ? D.marks.fin + ' ms' : '—'));
    L.push('  animation : ' + b.images + ' images, médiane ' + b.mediane + ' ms, p95 ' + b.p95 + ' ms, max ' + b.max + ' ms ; gels >100 ms ' + b.gels100 + ', >250 ms ' + b.gels250 + ', >1 s ' + b.gels1000);
    const lgB = D.longues.filter((t) => D.marks.fin == null || t[0] < D.marks.fin).sort((a, b) => b[1] - a[1]).slice(0, 6);
    L.push('  tâches longues : ' + (D.longuesIndispo ? 'indisponible sur ce navigateur' : lgB.map((t) => t[1] + ' ms à ' + t[0]).join(', ') || 'aucune'));
    L.push('');
    L.push('LANCEMENTS DE CIRCUIT : ' + D.lancements.length);
    for (const l of D.lancements.slice(-6)) { const p = stats(l.pendant), a = stats(l.apres), P = l.phases || {};
      L.push('  ' + l.circuit + ' : chargement ' + (l.fin - l.debut) + ' ms (monde ' + (P.monde || '?') + ', shaders ' + (P.shaders || '?') + ', textures ' + (P.textures || '?') + ', 1er rendu ' + (P.rendu0 || '?') + ' ms, tranche max ' + (P.maxSlice || '?') + ' ms)');
      L.push('     pendant le chargement : gel max ' + p.max + ' ms, >250 ms ' + p.gels250 + ' ; 5 s après l\'affichage : ' + a.fps + ' i/s, gel max ' + a.max + ' ms, >100 ms ' + a.gels100 + ', >250 ms ' + a.gels250); }
    L.push('');
    const c = D.course.slice(-12); L.push('COURSE (tranches de 10 s) : ' + (c.length ? '' : 'aucune mesure (fais une course)'));
    for (const s of c) { L.push('  ' + (s.circuit || '?') + ' : ' + s.fps + ' i/s, médiane ' + s.mediane + ' ms, p95 ' + s.p95 + ' ms, max ' + s.max + ' ms, gels >100 ms ' + s.gels100 + ', >250 ms ' + s.gels250);
      if (s.logique != null) L.push('     image : logique ' + s.logique + ' ms (p95 ' + s.logique95 + '), rendu processeur ' + s.rendu + ' ms (p95 ' + s.rendu95 + '), reste ' + s.reste + ' ms (carte graphique ou navigateur) ; ' + s.appels + ' appels, ' + s.triangles + ' k triangles ; qualité ' + s.qualite + ', pixelRatio ' + s.pr + ' ; géométries ' + s.geometries + ', textures ' + s.textures + (s.audioOff ? ' ; AUDIO SUSPENDU ' + s.audioOff + ' ms' : '') + (s.musOff ? ' ; MUSIQUE ABSENTE ' + s.musOff + ' ms' : '') + (s.live ? ' ; musique calculée en direct ' + s.live + ' ms' : '')); }
    L.push('  (lecture : « reste » grand devant logique + rendu = limite de la carte graphique ; logique ou rendu grands = limite du processeur)');
    L.push('');
    L.push('SÉLECTION D\'UN CIRCUIT DANS LE MENU : ' + (D.selections.length ? '' : 'aucune (touche une carte dans Entraînement)'));
    for (const x of D.selections.slice(-6)) { const g = stats(x.gaps); L.push('  ' + (((window.__TK || {}).TRACKS || [])[x.ti] || {}).name + ' : main rendue en ' + (x.main != null ? x.main + ' ms' : '?') + ', décor du menu prêt en ' + (x.decor != null ? x.decor + ' ms' : '> 6 s') + ', plus long gel ' + g.max + ' ms, gels >250 ms ' + g.gels250); }
    if (D.memMax) L.push('MÉMOIRE JS : pic ' + Math.round(D.memMax / 1048576) + ' Mo');
    return L.join('\n');
  }
  D.resume = resume;
  // Bouton et panneau du relevé.
  const ui = () => { if (!document.body) { setTimeout(ui, 50); return; }
    const b = document.createElement('button'); b.textContent = '📋 Relevé'; b.setAttribute('aria-label', 'Afficher le relevé de fluidité');
    b.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:2000;font:700 12px system-ui,sans-serif;padding:6px 9px;border-radius:9px;border:2px solid #fff;background:#17143a;color:#fff;opacity:.85';
    const p = document.createElement('div'); p.hidden = true;
    p.style.cssText = 'position:fixed;inset:8px;z-index:2001;background:#0d0b26;border:2px solid #ffc531;border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px;color:#fff;font:13px system-ui,sans-serif';
    p.innerHTML = '<b>Relevé de fluidité — copie ce texte et envoie-le</b><textarea readonly style="flex:1;width:100%;font:11px ui-monospace,monospace;background:#000;color:#cfe;border:1px solid #446;border-radius:8px;padding:6px;user-select:text;-webkit-user-select:text"></textarea><div style="display:flex;gap:8px"><button data-a="copier">Copier</button><button data-a="fermer">Fermer</button></div>';
    for (const x of p.querySelectorAll('button')) x.style.cssText = 'flex:1;padding:10px;border-radius:9px;border:2px solid #fff;background:#2a2560;color:#fff;font:700 14px system-ui,sans-serif';
    const ta = p.querySelector('textarea');
    b.onclick = (e) => { e.stopPropagation(); ta.value = resume(); p.hidden = false; p.style.display = 'flex'; };
    p.querySelector('[data-a="fermer"]').onclick = (e) => { e.stopPropagation(); p.hidden = true; p.style.display = 'none'; };
    p.querySelector('[data-a="copier"]').onclick = (e) => { e.stopPropagation(); ta.select(); const fin = () => { e.target.textContent = 'Copié ✓'; setTimeout(() => (e.target.textContent = 'Copier'), 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(fin, () => { try { document.execCommand('copy'); fin(); } catch (x) { /* sélection manuelle */ } });
      else { try { document.execCommand('copy'); fin(); } catch (x) { /* sélection manuelle */ } } };
    for (const el of [b, p]) for (const ev of ['touchstart', 'touchend', 'pointerdown']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    document.body.appendChild(b); document.body.appendChild(p); p.style.display = 'none'; };
  ui();
})();
