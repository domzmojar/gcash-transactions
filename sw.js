// CashHub PH — Service Worker
// Served as a real static file at /sw.js so it can claim scope:'/'
// (The old blob: URL approach scoped the SW to blob: origin, breaking
//  offline caching on stricter Android/Chrome versions.)

// Cache version matches _BUILD_VER in the HTML — update both together when deploying.
var CACHE = 'cashhub-b1db4a93';

self.addEventListener('install', function(e){
  // Skip waiting immediately so new SW activates without needing a second open
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return c.addAll([location.href]).catch(function(){});
    })
  );
});

self.addEventListener('activate', function(e){
  // Delete ALL old caches that don't match current version
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE; })
            .map(function(k){ return caches.delete(k); })
      );
    }).then(function(){
      // Take control of all open tabs immediately
      return self.clients.claim();
    }).then(function(){
      // Notify all open tabs that a new version is available
      return self.clients.matchAll({type:'window'}).then(function(clients){
        clients.forEach(function(c){
          c.postMessage({type:'SW_UPDATED', version: CACHE});
        });
      });
    })
  );
});

self.addEventListener('fetch', function(e){
  if(e.request.method !== 'GET') return;
  if(e.request.mode === 'navigate'){
    // Network-first for navigation: always try to get fresh HTML
    // Falls back to cache if offline
    e.respondWith(
      fetch(e.request).then(function(r){
        var cl = r.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, cl); });
        return r;
      }).catch(function(){
        return caches.match(e.request).then(function(r){
          return r || new Response(
            '<h2 style="font-family:sans-serif;text-align:center;margin-top:40px">You are offline.<br><small>Open CashHub when connected to get the latest version.</small></h2>',
            {status:503, headers:{'Content-Type':'text/html'}}
          );
        });
      })
    );
  } else {
    // Cache-first for assets
    e.respondWith(
      caches.match(e.request).then(function(r){
        return r || fetch(e.request).catch(function(){
          return new Response('', {status:408});
        });
      })
    );
  }
});
