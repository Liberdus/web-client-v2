export function resolveSecureBridgeUrl(configuredUrl, {
  baseUrl = globalThis.location?.href,
  allowedOrigins = [globalThis.location?.origin].filter(Boolean),
} = {}) {
  if (typeof configuredUrl !== 'string' || configuredUrl.trim() === '') {
    throw new Error('A bridge URL is not configured');
  }

  let bridgeUrl;
  try {
    bridgeUrl = new URL(configuredUrl, baseUrl);
  } catch (_) {
    throw new Error('The bridge URL is invalid');
  }

  if (bridgeUrl.protocol !== 'https:') {
    throw new Error('The bridge URL must use HTTPS');
  }
  if (bridgeUrl.username || bridgeUrl.password) {
    throw new Error('The bridge URL must not contain credentials');
  }
  if (!allowedOrigins.includes(bridgeUrl.origin)) {
    throw new Error('The bridge URL is not an approved origin');
  }

  return bridgeUrl.href;
}

export function openSecureBridge(configuredUrl, {
  windowObject = globalThis.window,
  allowedOrigins = [globalThis.location?.origin].filter(Boolean),
} = {}) {
  const bridgeUrl = resolveSecureBridgeUrl(configuredUrl, {
    baseUrl: windowObject.location.href,
    allowedOrigins,
  });
  const openedWindow = windowObject.open(bridgeUrl, '_blank', 'noopener,noreferrer');
  if (openedWindow) openedWindow.opener = null;
  return bridgeUrl;
}
