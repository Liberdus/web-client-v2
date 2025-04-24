const SW_VERSION = '2025.03.27.10.41';

// Cache names with proper versioning
/* const CACHE_VERSION = '1.0.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`; */

// Resources to precache
/* const PRECACHE_URLS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './offline.html',
  './media/liberdus_logo_50.png',
  './media/liberdus_logo_250.png'
];
 */
// Simplified state management
const state = {
    pollInterval: null,
    timestamp: null,
    account: null,
    lastPollTime: 0,
    notifiedChats: new Set()
};

// Install event 
self.addEventListener('install', (event) => {
  /* console.log('[Service Worker] Installing, version:', CACHE_VERSION);
  
  event.waitUntil(
    (async () => {
      try {
        // Open cache
        const cache = await caches.open(STATIC_CACHE);
        console.log('[Service Worker] Cache opened');

        // Try to precache resources
        try {
          await cache.addAll(PRECACHE_URLS);
          console.log('[Service Worker] Precaching complete');
        } catch (precacheError) {
          console.warn('[Service Worker] Precaching failed, will try individual resources:', precacheError);
          
          // If bulk precaching fails, try individual resources
          const precachePromises = PRECACHE_URLS.map(async (url) => {
            try {
              const response = await fetch(url);
              await cache.put(url, response);
              console.log(`[Service Worker] Cached: ${url}`);
            } catch (err) {
              console.warn(`[Service Worker] Failed to cache: ${url}`, err);
              // Don't throw - continue with other resources
            }
          });

          await Promise.allSettled(precachePromises);
        }

        // Check what we managed to cache
        const cachedKeys = await cache.keys();
        console.log('[Service Worker] Cached resources:', cachedKeys.map(req => req.url));

      } catch (error) {
        console.error('[Service Worker] Cache initialization failed:', error);
        // Don't throw - allow installation even if caching fails
      }
    })()
  ); */

  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating new service worker');
  // Take control of all clients immediately
  event.waitUntil(
    (async () => {
      await self.clients.claim();
    })()
  );
/*   event.waitUntil(
    (async () => {
      try {
        // Clean up old caches
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames
            .filter(cacheName => {
              return cacheName.startsWith('static-') && cacheName !== STATIC_CACHE ||
                     cacheName.startsWith('dynamic-') && cacheName !== DYNAMIC_CACHE;
            })
            .map(cacheName => {
              console.log('[Service Worker] Removing old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );


        
        // Verify cache contents after activation
        const cache = await caches.open(STATIC_CACHE);
        const cachedKeys = await cache.keys();
        console.log('[Service Worker] Available cached resources:', 
          cachedKeys.map(req => req.url));
          
        // Clean up old dynamic cache entries
        await cleanupOldCacheEntries();
        
        // Set up periodic cache cleanup
        setupPeriodicCacheCleanup();

      } catch (error) {
        console.error('[Service Worker] Activation tasks failed:', error);
        // Don't throw - allow activation even if cleanup fails
      }
    })()
  ); */
});

// Function to clean up old cache entries
/* async function cleanupOldCacheEntries() {
  try {
    const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    const now = Date.now();
    
    // Clean up dynamic cache
    const dynamicCache = await caches.open(DYNAMIC_CACHE);
    const dynamicRequests = await dynamicCache.keys();
    
    const oldEntries = await Promise.all(
      dynamicRequests.map(async (request) => {
        const response = await dynamicCache.match(request);
        const responseDate = response.headers.get('date');
        
        if (responseDate) {
          const date = new Date(responseDate).getTime();
          if (now - date > MAX_AGE) {
            return request;
          }
        }
        
        return null;
      })
    );
    
    // Filter out null entries and delete old ones
    const entriesToDelete = oldEntries.filter(entry => entry !== null);
    await Promise.all(
      entriesToDelete.map(request => {
        console.log('[Service Worker] Removing old cached response:', request.url);
        return dynamicCache.delete(request);
      })
    );
    
    console.log(`[Service Worker] Cleaned up ${entriesToDelete.length} old cache entries`);
  } catch (error) {
    console.error('[Service Worker] Cache cleanup failed:', error);
  }
} */

// Helper function to determine caching strategy based on request
/* function getCacheStrategy(request) {
  const url = new URL(request.url);
  
  // Static assets - Cache First
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    PRECACHE_URLS.includes(url.pathname)
  ) {
    return 'cache-first';
  }
  
  // API endpoints that should not be cached - Network Only
  if (shouldNotCache(request)) {
    return 'network-only';
  }
  
  // API endpoints - Network First
  if (url.pathname.startsWith('/api/')) {
    return 'network-first';
  }
  
  // HTML navigation - Cache First for offline support
  if (request.mode === 'navigate') {
    return 'cache-first';
  }
  
  // Default to network first
  return 'network-first';
} */

// Fetch event - handle caching strategies
/* self.addEventListener('fetch', (event) => {
  const strategy = getCacheStrategy(event.request);
  
  switch (strategy) {
    case 'cache-first':
      event.respondWith(cacheFirst(event.request));
      break;
    case 'network-first':
      event.respondWith(networkFirst(event.request));
      break;
    case 'network-only':
      event.respondWith(networkOnly(event.request));
      break;
    default:
      event.respondWith(networkFirst(event.request));
  }
}); */

// Cache-First Strategy
/* async function cacheFirst(request) {
  try {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request);
    
    if (cached) {
      console.log('[Service Worker] Serving from cache:', request.url);
      return cached;
    }
    
    // If not in cache, try network
    try {
      const response = await fetch(request);
      // Cache the new response
      cache.put(request, response.clone());
      return response;
    } catch (error) {
      console.warn('[Service Worker] Network fetch failed:', error);
      // If offline and resource not in cache, return offline fallback
      if (request.mode === 'navigate') {
        const offlinePage = await cache.match('./offline.html');
        if (offlinePage) {
          return offlinePage;
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('[Service Worker] Cache-first strategy failed:', error);
    throw error;
  }
} */

// Network-First Strategy
/* async function networkFirst(request) {
  try {
    const response = await fetch(request);
    
    // Only cache GET requests that should be cached
    if (request.method === 'GET' && !shouldNotCache(request)) {
      try {
        const cache = await caches.open(DYNAMIC_CACHE);
        await cache.put(request, response.clone());
      } catch (cacheError) {
        console.warn('[Service Worker] Failed to cache response:', cacheError);
        // Continue even if caching fails
      }
    }
    
    return response;
  } catch (error) {
    console.warn('[Service Worker] Network request failed:', error);
    
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    // If offline and no cache, return offline fallback for navigation
    if (request.mode === 'navigate') {
      const offlineFallback = await caches.match('./offline.html');
      if (offlineFallback) {
        return offlineFallback;
      }
    }
    
    throw error;
  }
} */

// Network-Only Strategy - No Caching
/* async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch (error) {
    console.warn('[Service Worker] Network request failed:', error);
    
    // If offline and navigation request, return offline fallback
    if (request.mode === 'navigate') {
      const cache = await caches.open(STATIC_CACHE);
      const offlineFallback = await cache.match('./offline.html');
      if (offlineFallback) {
        return offlineFallback;
      }
    }
    
    throw error;
  }
} */

// Helper function to determine if a request should not be cached
/* function shouldNotCache(request) {
  const url = new URL(request.url);
  
  // Don't cache API endpoints that contain sensitive/frequently changing data
  
  // Don't cache authentication endpoints
  if (url.pathname.includes('/address/') || url.pathname.includes('/account/')) {
    return true;
  }
  
  // Don't cache message data
  if (url.pathname.includes('/messages/') || url.pathname.includes('/chats/')) {
    return true;
  }
  
  // Don't cache transaction data
  if (url.pathname.includes('/inject') || url.pathname.includes('/balance')) {
    return true;
  }
  
  // Don't cache large responses
  const contentLength = request.headers?.get('content-length');
  if (contentLength && parseInt(contentLength) > 1024 * 1024) { // > 1MB
    return true;
  }
  
  return false;
} */

// Background sync event
/* self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  } else if (event.tag === 'sync-transactions') {
    event.waitUntil(syncTransactions());
  }
}); */

// Handle messages from the client
self.addEventListener('message', (event) => {
  const { type, timestamp, account } = event.data;
  
  switch (type) {
/*     case 'start_polling':
      state.timestamp = timestamp;
      state.account = account;
      startPolling();
      break;
    case 'stop_polling':
      stopPolling();
      break; */
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
  }
});

// Error handling and logging
self.addEventListener('error', (event) => {
  console.error('[Service Worker] Error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[Service Worker] Unhandled rejection:', event.reason);
});
/* 
function startPolling() {
    if (state.pollInterval) return;
    
    console.log('Starting message polling');
    state.pollInterval = setInterval(checkForNewMessages, 60000);
    checkForNewMessages();
}

function stopPolling() {
    if (state.pollInterval) {
        clearInterval(state.pollInterval);
        Object.assign(state, {
            pollInterval: null,
            timestamp: null,
            account: null,
            lastPollTime: 0,
            notifiedChats: new Set()
        });
        console.log('[Service Worker] Stopped message polling');
    }
} */
/**
 * Gets the appropriate gateway for a request based on configuration
 * @returns {Object} The selected gateway object
 */
/* function getGatewayForRequest() {
  // Safety check for state and account
  if (!state?.account?.network?.gateways?.length) {
    // Fall back to global network if available
    if (typeof network !== 'undefined' && network?.gateways?.length) {
      return network.gateways[Math.floor(Math.random() * network.gateways.length)];
    }
    console.error('No gateways available');
    return null;
  }
  
  const { network } = state.account;
  
  // If a default gateway is set and valid, use it
  if (network.defaultGatewayIndex !== undefined && 
      network.defaultGatewayIndex >= 0 && 
      network.defaultGatewayIndex < network.gateways.length) {
    return network.gateways[network.defaultGatewayIndex];
  }
  
  // Otherwise use random selection
  return network.gateways[Math.floor(Math.random() * network.gateways.length)];
} */

/* async function checkForNewMessages() {
    try {
        if (!state.timestamp || !state.account) {
            console.log('❌ No poll timestamp or account data');
            return;
        }

        const { address, network } = state.account;
        if (!address || !network?.gateways?.length) {
            console.log('❌ Invalid account configuration');
            return;
        }

        // Get gateway using the selection function
        const gateway = getGatewayForRequest();
        if (!gateway) {
            console.log('❌ No gateway available');
            return;
        }
        const paddedAddress = address.padEnd(64, '0');
        
        // Query for new messages
        const url = `${gateway.protocol}://${gateway.host}:${gateway.port}/account/${paddedAddress}/chats/${state.lastPollTime || state.timestamp}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Network response failed: ${response.status}`);

        const { chats } = await response.json();
        if (!chats) return;

        // Track new chats
        const newChats = new Set(
            Object.values(chats).filter(chatId => !state.notifiedChats.has(chatId))
        );

        if (newChats.size > 0) {
            await showNotification(newChats.size);
            newChats.forEach(chatId => state.notifiedChats.add(chatId));
            state.lastPollTime = parseInt(state.timestamp);
        }

    } catch (error) {
        console.error('❌ Error checking messages:', error);
    }
} */

/* async function showNotification(chatCount) {
    if (self.Notification?.permission !== 'granted') {
        return;
    }

    try {
        const notificationText = chatCount === 1 
            ? 'You have new messages in a conversation'
            : `You have new messages in ${chatCount} conversations`;

        await self.registration.showNotification('New Messages', {
            body: notificationText,
            icon: './media/liberdus_logo_250.png',
            badge: './media/liberdus_logo_250.png',
            tag: 'new-messages',
            renotify: true
        });
        console.log('✅ Notification sent successfully');
    } catch (error) {
        console.error('❌ Error showing notification:', error);
    }
} */

// Handle notification clicks
/* self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    // Get the scope of the service worker
    const swScope = self.registration.scope;
    
    // Focus existing window or open new one
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(clientList => {
            // Try to find a client that matches our scope
            for (const client of clientList) {
                if (client.url.startsWith(swScope) && 'focus' in client) {
                    return client.focus();
                }
            }
            // If no matching client found, open a new window with the scope URL
            if (clients.openWindow) {
                return clients.openWindow(swScope);
            }
        })
    );
});

self.addEventListener('terminate', event => {
}); */

// Set up periodic cache cleanup
/* function setupPeriodicCacheCleanup() {
  // Clean up cache every 24 hours
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  
  // Use setInterval for periodic cleanup
  setInterval(() => {
    console.log('[Service Worker] Running periodic cache cleanup');
    cleanupOldCacheEntries()
      .then(() => console.log('[Service Worker] Periodic cleanup complete'))
      .catch(error => console.error('[Service Worker] Periodic cleanup failed:', error));
  }, CLEANUP_INTERVAL);
  
  console.log('[Service Worker] Periodic cache cleanup scheduled');
} */
