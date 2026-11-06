/* Wild Kart : démarrage (fichier séparé pour la politique de sécurité) */
window.TK_BUILD = 'pwa';
window.TK_VER = 'test-dfd9c6a';
// ouvert depuis l'appli Android / iPhone (elle charge le site pour avoir les mises à jour)
try { localStorage.removeItem('wk-app'); if (/[?&]app=1/.test(location.search)) sessionStorage.setItem('wk-app', '1'); if (sessionStorage.getItem('wk-app') || /; wv\)/.test(navigator.userAgent)) { window.TK_APP = true; document.documentElement.classList.add('app'); } } catch (e) { /* rien */ }
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}
// Animation de démarrage officielle (demarrage.html, fin classique) au-dessus de l'écran « Chargement… », qui reste en repli.
// game.js appelle WK_LOADER.done(fin) quand le jeu est prêt : fin de l'animation, puis fondu vers le menu. Jamais bloquant :
// délai maximal de 7 s, toucher l'écran passe l'animation, et rien du tout dans un navigateur automatisé (tests).
window.WK_LOADER = (function () {
  var el = document.getElementById('loading'), frame = null, api = null, onDone = null, closed = false, real = -1;
  function close() {
    if (closed) return; closed = true;
    if (el) el.classList.add('fini');
    setTimeout(function () { if (frame && frame.parentNode) frame.parentNode.removeChild(frame); if (onDone) onDone(); }, frame ? 450 : 0);
  }
  function finish() { if (!api) return; api.onReady = close; api.finish(); }
  if (el && !navigator.webdriver) {
    frame = document.createElement('iframe');
    frame.src = 'demarrage.html?production' + (/[?&]video=1/.test(location.search) ? '&video=1' : ''); /* ?video=1 : prototype C2-2 (intro en vidéo) */ frame.title = 'Chargement de Wild Kart'; frame.setAttribute('aria-hidden', 'true');
    frame.addEventListener('load', function () {
      try { api = frame.contentWindow.WildKartLoader; api.setEndingMode('classic'); api.setProductionMode(true); api.set(.1); } catch (e) { api = null; }
      // Avancement réel transmis par le jeu (WK_LOADER.progress) ; en attendant la première valeur, estimation lente plafonnée à 20 %.
      if (real >= 0) api.set(real);
      var p = .1, tick = setInterval(function () { if (!api || onDone || real >= 0) return clearInterval(tick); p = Math.min(.2, p + .02); api.set(p); }, 250);
      if (onDone) { if (api) finish(); else close(); }
    });
    el.appendChild(frame);
    document.body.appendChild(el); // hors du conteneur du jeu : devant les fenêtres (compte, accès) pendant l'animation
    el.addEventListener('click', function () { if (onDone) close(); });
  }
  return {
    // Avancement réel du démarrage (0 à 1), envoyé par game.js à chaque étape.
    progress: function (v) { real = Math.max(real, v); if (api) try { api.set(Math.min(.97, real)); } catch (e) { /* rien */ } },
    // Vrai tant que l'animation couvre l'écran : le jeu ne rend pas le menu derrière elle.
    couvre: function () { return !!frame && !closed; },
    done: function (cb) {
      onDone = cb;
      if (!frame) return close();
      setTimeout(close, 7000);
      if (api) finish();
    }
  };
})();
