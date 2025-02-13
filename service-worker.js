const SW_VERSION = '1.0.3';

// Simplified state management
const state = {
    pollInterval: null,
    timestamp: null,
    account: null,
    lastPollTime: 0,
    notifiedChats: new Set()
};

// Add periodic sync support
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'check-messages') {
        // Use event.waitUntil to keep the service worker alive
        event.waitUntil(
            (async () => {
                try {
                    console.log('📱 Periodic sync triggered for check-messages');
                    await checkForNewMessages();
                } catch (error) {
                    console.error('📱 Error in periodic sync:', error);
                }
            })()
        );
    }
});

// Add background sync support as fallback
self.addEventListener('sync', (event) => {
    if (event.tag === 'check-messages') {
        console.log('📱 Background sync triggered for check-messages');
        event.waitUntil(checkForNewMessages());
    }
});

// Install event - set up any caching needed
self.addEventListener('install', (event) => {
    console.log('Service Worker installing, version:', SW_VERSION);
    
    // Skip waiting to become active immediately
    self.skipWaiting();
});

// Activate event - clean up old caches and take control
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating, version:', SW_VERSION);

    // Ensure service worker takes control immediately
    event.waitUntil(
        Promise.all([
            clients.claim(),
            // Enable navigation preload for better performance
            self.registration.navigationPreload?.enable()
        ])
    );
});

// Message event - handle messages from the main thread
self.addEventListener('message', (event) => {
    const { type, timestamp, account } = event.data;
    
    switch (type) {
        case 'start_polling':
            state.timestamp = timestamp;
            state.account = account;
            startPolling();
            break;
        case 'stop_polling':
            stopPolling();
            break;
    }
});

// Request periodic sync permission and register
async function registerPeriodicSync() {
    try {
        // First check if periodic sync is supported
        if (!('periodicSync' in self.registration)) {
            console.log('📱 Periodic sync not supported');
            return false;
        }

        // Check permission status first
        const status = await navigator.permissions.query({
            name: 'periodic-background-sync',
        });
        
        console.log('📱 Initial periodic sync status:', status.state);
        
        // Only proceed if permission is granted
        if (status.state === 'granted') {
            // Get existing tags to avoid duplicate registration
            const tags = await self.registration.periodicSync.getTags();
            
            // Only register if not already registered
            if (!tags.includes('check-messages')) {
                await self.registration.periodicSync.register('check-messages', {
                    minInterval: 60 * 1000 // Browser may enforce longer intervals
                });
                console.log('📱 Periodic sync registered successfully');
            } else {
                console.log('📱 Periodic sync already registered');
            }
            return true;
        }
        
        console.log('📱 Periodic sync permission not granted');
        return false;
    } catch (error) {
        console.log('📱 Periodic sync registration failed:', error);
        return false;
    }
}

function startPolling() {
    if (state.pollInterval) return;
    
    // Try to register periodic sync first
    registerPeriodicSync().then(registered => {
        if (!registered) {
            // Fall back to interval only if periodic sync isn't available/permitted
            console.log('Falling back to interval polling');
            state.pollInterval = setInterval(checkForNewMessages, 60000);
        }
    });
    
    // Initial check
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
}

// Utility function to ensure address is 64 characters
function longAddress(addr) {
    return addr.padEnd(64, '0');
}

async function checkForNewMessages() {
    try {
        // Simplified state check with detailed logging
        if (!state.account || !state.timestamp) {
            console.log('❌ State check failed:', {
                hasAccount: !!state.account,
                hasTimestamp: !!state.timestamp,
                state: JSON.stringify(state)
            });
            return;
        }

        const { address, network } = state.account;
        if (!address || !network?.gateways?.length) {
            console.log('❌ Account configuration invalid:', {
                hasAddress: !!address,
                hasGateways: !!network?.gateways?.length,
                account: JSON.stringify(state.account)
            });
            return;
        }

        // Get random gateway and query for messages
        const gateway = network.gateways[Math.floor(Math.random() * network.gateways.length)];
        
        // Log the gateway being used
        console.log('📱 Selected gateway:', {
            gateway: JSON.stringify(gateway),
            allGateways: JSON.stringify(network.gateways)
        });

        // Ensure protocol, host and port are all present
        if (!gateway.protocol || !gateway.host || !gateway.port) {
            console.error('❌ Invalid gateway configuration:', gateway);
            return;
        }

        const url = `${gateway.protocol}://${gateway.host}:${gateway.port}/account/${longAddress(address)}/chats/${state.lastPollTime || state.timestamp}`;
        
        console.log('📱 Attempting fetch:', {
            url,
            timestamp: state.lastPollTime || state.timestamp,
            address: longAddress(address)
        });

        // Add fetch options with CORS and cache settings
        const fetchOptions = {
            method: 'GET',
            mode: 'cors',
            cache: 'no-cache',
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json'
            }
        };

        try {
            const response = await fetch(url, fetchOptions);
            console.log('📱 Fetch response:', {
                ok: response.ok,
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
            });

            if (!response.ok) {
                throw new Error(`Network response failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log('📱 Response data:', {
                hasChats: !!data.chats,
                chatCount: data.chats ? Object.keys(data.chats).length : 0,
                responseData: JSON.stringify(data)
            });

            const { chats } = data;
            if (!chats) return;

            // Track new chats with logging
            const existingChats = Array.from(state.notifiedChats);
            const newChats = new Set(
                Object.values(chats).filter(chatId => !state.notifiedChats.has(chatId))
            );

            console.log('📱 Chat tracking:', {
                existingChatsCount: existingChats.length,
                newChatsCount: newChats.size,
                existingChats,
                newChatIds: Array.from(newChats)
            });

            if (newChats.size > 0) {
                await showNotification(newChats.size);
                newChats.forEach(chatId => state.notifiedChats.add(chatId));
                state.lastPollTime = parseInt(state.timestamp);
                console.log('📱 Updated state after new chats:', {
                    notifiedChatsCount: state.notifiedChats.size,
                    lastPollTime: state.lastPollTime
                });
            }

        } catch (fetchError) {
            // Enhanced fetch error logging
            console.error('❌ Fetch operation failed:', {
                error: fetchError.message,
                type: fetchError.name,
                url,
                stack: fetchError.stack,
                gateway: JSON.stringify(gateway),
                networkState: {
                    online: navigator.onLine,
                    connection: navigator.connection ? {
                        type: navigator.connection.type,
                        effectiveType: navigator.connection.effectiveType,
                        downlink: navigator.connection.downlink
                    } : 'Not available'
                }
            });
            throw fetchError;
        }

    } catch (error) {
        // Main error handler with enhanced context
        console.error('❌ Message check failed:', {
            error: error.message,
            type: error.name,
            state: {
                hasAccount: !!state.account,
                hasTimestamp: !!state.timestamp,
                hasInterval: !!state.pollInterval,
                notifiedChatsCount: state.notifiedChats.size,
                networkConfig: state.account?.network ? JSON.stringify(state.account.network) : 'No network config'
            },
            stack: error.stack,
            serviceWorkerScope: self.registration.scope
        });
    }
}

async function showNotification(chatCount) {
    if (self.Notification?.permission !== 'granted') return;

    try {
        // Direct platform detection using navigator.userAgent
        const userAgent = navigator.userAgent;
        console.log('📱 UserAgent:', userAgent);
        
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
        console.log('📱 Platform detection:', { isMobile, userAgent });

        // Only show system notification on mobile
        if (isMobile) {
            console.log('📱 Showing mobile notification');
            const notificationText = chatCount === 1 
                ? 'You have new messages in a conversation'
                : `You have new messages in ${chatCount} conversations`;

            await self.registration.showNotification('New Messages', {
                body: notificationText,
                icon: './liberdus_logo_250.png',
                badge: './liberdus_logo_250.png',
                tag: 'new-messages',
                renotify: true,
                silent: false,
                vibrate: [200, 100, 200],
                sound: './noti.wav'
            });
        } else {
            // Only notify clients if we're on desktop
            console.log('🖥️ Delegating notification to desktop client');
            const clients = await self.clients.matchAll();
            clients.forEach(client => {
                client.postMessage({
                    type: 'new_notification',
                    chatCount,
                    timestamp: Date.now()
                });
            });
        }

    } catch (error) {
        console.error('❌ Error showing notification:', error);
    }
}

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    // Focus or open window based on context
    event.waitUntil(
        (async () => {
            try {
                const windowClient = await clients.matchAll({
                    type: 'window',
                    includeUncontrolled: true
                });

                // Check if we're running as PWA
                const isPWA = windowClient.some(client => 
                    client.url.includes(self.registration.scope) && 
                    client.frameType === 'top-level' &&
                    client.focused === false
                );

                // Try to focus existing window first
                for (const client of windowClient) {
                    if (client.url.includes(self.registration.scope)) {
                        await client.focus();
                        return;
                    }
                }

                // If no existing window, open new one
                // For PWA, use root path; for browser, use full URL
                const urlToOpen = isPWA ? '/dev' : self.registration.scope;
                await clients.openWindow(urlToOpen);

            } catch (error) {
                console.error('❌ Error handling notification click:', error);
                // Fallback to simple window open
                await clients.openWindow('/dev');
            }
        })()
    );
});
