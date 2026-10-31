/* Wild Kart : démarrage (fichier séparé pour la politique de sécurité) */
window.TK_BUILD = 'pwa';
window.TK_VER = '810e1cf9';
// ouvert depuis l'appli Android / iPhone (elle charge le site pour avoir les mises à jour)
try { localStorage.removeItem('wk-app'); if (/[?&]app=1/.test(location.search)) sessionStorage.setItem('wk-app', '1'); if (sessionStorage.getItem('wk-app') || /; wv\)/.test(navigator.userAgent)) { window.TK_APP = true; document.documentElement.classList.add('app'); } } catch (e) { /* rien */ }
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}
// Animation de démarrage officielle (demarrage.html, fin classique) au-dessus de l'écran « Chargement… », qui reste en repli.
// game.js appelle WK_LOADER.done(fin) quand le jeu est prêt : fin de l'animation, puis fondu vers le menu. Jamais bloquant :
// délai maximal de 7 s, toucher l'écran passe l'animation, et rien du tout dans un navigateur automatisé (tests).
window.WK_LOADER = (function () {
  var el = document.getElementById('loading'), frame = null, api = null, onDone = null, closed = false;
  function close() {
    if (closed) return; closed = true;
    if (el) el.classList.add('fini');
    setTimeout(function () { if (frame && frame.parentNode) frame.parentNode.removeChild(frame); if (onDone) onDone(); }, frame ? 450 : 0);
  }
  function finish() { if (!api) return; api.onReady = close; api.finish(); }
  if (el && !navigator.webdriver) {
    frame = document.createElement('iframe');
    frame.src = 'demarrage.html?production'; frame.title = 'Chargement de Wild Kart'; frame.setAttribute('aria-hidden', 'true');
    frame.addEventListener('load', function () {
      try { api = frame.contentWindow.WildKartLoader; api.setEndingMode('classic'); api.setProductionMode(true); api.set(.1); } catch (e) { api = null; }
      // Progression estimée pendant le chargement (jusqu'à 90 %) ; les 100 % arrivent quand le jeu est réellement prêt.
      var p = .1, tick = setInterval(function () { if (!api || onDone) return clearInterval(tick); p = Math.min(.9, p + .1); api.set(p); }, 450);
      if (onDone) { if (api) finish(); else close(); }
    });
    el.appendChild(frame);
    document.body.appendChild(el); // hors du conteneur du jeu : devant les fenêtres (compte, accès) pendant l'animation
    el.addEventListener('click', function () { if (onDone) close(); });
  }
  return {
    done: function (cb) {
      onDone = cb;
      if (!frame) return close();
      setTimeout(close, 7000);
      if (api) finish();
    }
  };
})();
