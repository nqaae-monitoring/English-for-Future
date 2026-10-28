/* English for Future — service worker: network-first with an offline cache fallback for the app shell. */
var CACHE = "efuture-v2";
var SHELL = ["./", "./index.html", "./css/app.css", "./config.js", "./js/data.js", "./js/content.js", "./js/app.js", "./js/qualdata.js", "./js/qual.js", "./js/placement.js", "./js/leaderboard.js", "./js/admin.js", "./js/sync.js", "./js/auth.js", "./assets/icon.svg"];
self.addEventListener("install", function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL).catch(function () { }); })); self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })); self.clients.claim(); });
self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // never touch Supabase / CDN requests
  e.respondWith(fetch(e.request).then(function (res) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); return res; }).catch(function () { return caches.match(e.request); }));
});
