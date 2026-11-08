/* Wild Kart TEST (test-comptes-9ca3e27) : isolation de la version officielle (même domaine). */
(function () {
  window.WK_TEST = 'test-comptes-9ca3e27'; var P = 'wkessai:';
  window.TK_API = "https://wild-kart-serveur-test.uncreeper5431.workers.dev/api/compte";   // essai des comptes : Worker TEST, base distincte
  // stockage local : écrit sous « wkessai: » ; aucun repli sur les données officielles (essai des comptes : profil vierge).
  try { var S = Storage.prototype, g = S.getItem, s = S.setItem, r = S.removeItem;
    S.getItem = function (k) { var v = g.call(this, P + k); return v !== null ? v : null; };
    S.setItem = function (k, v) { return s.call(this, P + k, v); };
    S.removeItem = function (k) { return r.call(this, P + k); }; } catch (e) { /* rien */ }
  // mise à jour du jeu : ne vide que les caches et le service worker de la version test
  try { var ck = caches.keys.bind(caches); caches.keys = function () { return ck().then(function (ks) { return ks.filter(function (k) { return k.indexOf('wkessai-') === 0; }); }); }; } catch (e) { /* rien */ }
  try { var sw = navigator.serviceWorker, gr = sw.getRegistrations.bind(sw); sw.getRegistrations = function () { return gr().then(function (rs) { return rs.filter(function (x) { return /\/test-comptes\/test\/$/.test(x.scope); }); }); }; } catch (e) { /* rien */ }
  // bandeau discret
  addEventListener('DOMContentLoaded', function () { var b = document.createElement('div'); b.textContent = 'ESSAI COMPTES ' + '9ca3e27';
    b.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:99999;font:700 11px sans-serif;color:#fff;background:#d6247a;padding:2px 6px;border-radius:6px;opacity:.85;pointer-events:none';
    document.body.appendChild(b); });
})();
