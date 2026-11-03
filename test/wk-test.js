/* Wild Kart TEST (test-1a17f51) : isolation de la version officielle (même domaine). */
(function () {
  window.WK_TEST = 'test-1a17f51'; var P = 'wktest:';
  // stockage local : écrit sous « wktest: » ; lecture de repli sur la valeur officielle (code d'accès, profil), jamais modifiée.
  try { var S = Storage.prototype, g = S.getItem, s = S.setItem, r = S.removeItem;
    S.getItem = function (k) { var v = g.call(this, P + k); return v !== null ? v : (this === window.localStorage ? g.call(this, k) : null); };
    S.setItem = function (k, v) { return s.call(this, P + k, v); };
    S.removeItem = function (k) { return r.call(this, P + k); }; } catch (e) { /* rien */ }
  // mise à jour du jeu : ne vide que les caches et le service worker de la version test
  try { var ck = caches.keys.bind(caches); caches.keys = function () { return ck().then(function (ks) { return ks.filter(function (k) { return k.indexOf('wktest-') === 0; }); }); }; } catch (e) { /* rien */ }
  try { var sw = navigator.serviceWorker, gr = sw.getRegistrations.bind(sw); sw.getRegistrations = function () { return gr().then(function (rs) { return rs.filter(function (x) { return /\/test\/$/.test(x.scope); }); }); }; } catch (e) { /* rien */ }
  // bandeau discret
  addEventListener('DOMContentLoaded', function () { var b = document.createElement('div'); b.textContent = 'TEST ' + '1a17f51';
    b.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:99999;font:700 11px sans-serif;color:#fff;background:#d6247a;padding:2px 6px;border-radius:6px;opacity:.85;pointer-events:none';
    document.body.appendChild(b); });
})();
