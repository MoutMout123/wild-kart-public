/* Version TEST : portée …/test/ uniquement. */
/* Wild Kart : cache hors-ligne. Toutes les adresses de scripts portent la version (?v=) : une nouvelle page ne peut pas recevoir
   d'anciens fichiers du cache (au premier lancement après une mise à jour, l'ancien service worker sert encore son cache). */
const CACHE = 'wktest-test-b023102';
const CORE = ['./', 'index.html', 'wk-test.js?v=test-b023102', 'boot.js?v=test-b023102', 'game.js?v=test-b023102', 'graphics.js?v=test-b023102', 'tracks.generated.js?v=test-b023102', 'production.js?v=test-b023102', 'surfaces.js?v=test-b023102', 'scenery.js?v=test-b023102', 'nature.js?v=test-b023102', 'vivant.js?v=test-b023102', 'bac-a-sable.js?v=test-b023102', 'three.min.js', 'peerjs.min.js', 'nacl.min.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
for(const profile of ['pc','mobile'])for(const material of ['clean_asphalt','sandstone_cracks'])for(const role of ['albedo','normal','roughness'])CORE.push('assets/materials/'+profile+'/'+material+'-'+role+'.webp');
// « reload » : on prend les fichiers tout frais (le site peut garder une ancienne copie 10 minutes)
const OPTIONAL = ['demarrage.html', 'demarrage.js?v=test-b023102', 'studio-core.js?v=test-b023102', 'studio3d.js?v=test-b023102', 'studio.js?v=test-b023102', 'diag.js?v=test-b023102', 'assets/logo/lettrage-wild-kart.webp', 'assets/logo/lettrage-wild-kart.png']; // animation de démarrage, Wild Kart Studio et relevé ?diag=1 : facultatifs (le jeu démarre sans eux)
self.addEventListener('install', (e) => {
  const optional = (c) => Promise.all(OPTIONAL.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' }))).then(() => optional(c))).then(() => self.skipWaiting()));
});
// nouvelle version installée : on efface les anciennes copies et on recharge les pages ouvertes (même les très vieilles versions du jeu)
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => { const old = ks.filter((k) => k !== CACHE && k.startsWith('wktest-')); return Promise.all(old.map((k) => caches.delete(k))).then(() => old.length); })
  .then((hadOld) => self.clients.claim().then(() => (hadOld ? self.clients.matchAll({ type: 'window' }) : [])))
  .then((cs) => Promise.all(cs.map((c) => { try { const u = new URL(c.url); return c.navigate(c.url); } catch (x) { return null; } })))); });
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.pathname.endsWith('version.json')) return;   // la version de test a sa propre vie
  // la page elle-même : toujours la dernière version si internet marche, sinon celle gardée (hors ligne)
  if (url.origin === location.origin && req.mode === 'navigate') { e.respondWith(fetch(req.url, { cache: 'no-cache' }).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('index.html', copy)); return res; }).catch(() => caches.match('index.html').then((h) => h || caches.match('./')))); return; }
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req, { ignoreSearch: url.pathname.endsWith('/') }).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; }).catch(() => caches.match('index.html'))));
  } else if (url.hostname.includes('fonts.g')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })));
  }
});
