// ═══════════════════════════════════════════════════════════════
// Service Worker - Poder Local PWA
// Estratégia: Network-first com cache de fallback para app shell
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME = 'poder-local-v1';

// Recursos estáticos essenciais para o app shell
const APP_SHELL = [
  '/',
  '/manifest.json',
];

// ─── Install: pré-cachear app shell ──────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate: limpar caches antigos ─────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch: network-first para tudo ──────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Ignorar requests que não são GET
  if (request.method !== 'GET') return;
  
  // Ignorar requests para APIs externas (Supabase, Z-API, etc.)
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  
  // Ignorar requests para extensões de arquivo de dados
  if (url.pathname.startsWith('/rest/') || url.pathname.startsWith('/auth/')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cachear assets estáticos (JS, CSS, imagens, fontes)
        if (
          response.ok &&
          (request.url.includes('/assets/') ||
           request.url.endsWith('.js') ||
           request.url.endsWith('.css') ||
           request.url.endsWith('.png') ||
           request.url.endsWith('.svg') ||
           request.url.endsWith('.woff2'))
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline: tentar do cache
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // Se for uma navegação (HTML), servir a página principal do cache
          if (request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
  );
});
