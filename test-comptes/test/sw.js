/* Version TEST : portée …/test/ uniquement. */
/* Wild Kart : cache hors-ligne. Toutes les adresses de scripts portent la version (?v=) : une nouvelle page ne peut pas recevoir
   d'anciens fichiers du cache (au premier lancement après une mise à jour, l'ancien service worker sert encore son cache). */
const CACHE = 'wkessai-test-comptes-473817c';
const CORE = ['./', 'index.html', 'wk-test.js?v=test-comptes-473817c', 'prototypes-test.js?v=test-comptes-473817c', 'boot.js?v=test-comptes-473817c', 'game.js?v=test-comptes-473817c', 'atelier.js?v=test-comptes-473817c', 'equilibre-prototype.js?v=test-comptes-473817c', 'carrosseries-prototype.js?v=test-comptes-473817c', 'pilotes-prototype.js?v=test-comptes-473817c', 'graphics.js?v=test-comptes-473817c', 'tracks.generated.js?v=test-comptes-473817c', 'production.js?v=test-comptes-473817c', 'surfaces.js?v=test-comptes-473817c', 'scenery.js?v=test-comptes-473817c', 'nature.js?v=test-comptes-473817c', 'vivant.js?v=test-comptes-473817c', 'bac-a-sable.js?v=test-comptes-473817c', 'three.min.js', 'peerjs.min.js', 'nacl.min.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
for(const profile of ['pc','mobile'])for(const material of ['clean_asphalt','sandstone_cracks'])for(const role of ['albedo','normal','roughness'])CORE.push('assets/materials/'+profile+'/'+material+'-'+role+'.webp');
// « reload » : on prend les fichiers tout frais (le site peut garder une ancienne copie 10 minutes)
const OPTIONAL = ['atelier-graphique.html?v=test-comptes-473817c', 'demarrage.html', 'demarrage.js?v=test-comptes-473817c', 'studio-core.js?v=test-comptes-473817c', 'studio3d.js?v=test-comptes-473817c', 'studio.js?v=test-comptes-473817c', 'diag.js?v=test-comptes-473817c', 'assets/logo/lettrage-wild-kart.webp', 'assets/logo/lettrage-wild-kart.png']; // animation de démarrage, Wild Kart Studio et relevé ?diag=1 : facultatifs (le jeu démarre sans eux)
self.addEventListener('install', (e) => {
  const optional = (c) => Promise.all(OPTIONAL.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' }))).then(() => optional(c))).then(() => self.skipWaiting()));
});
// nouvelle version installée : on efface les anciennes copies et on recharge les pages ouvertes (même les très vieilles versions du jeu)
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => { const old = ks.filter((k) => k !== CACHE && k.startsWith('wkessai-')); return Promise.all(old.map((k) => caches.delete(k))).then(() => old.length); })
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
