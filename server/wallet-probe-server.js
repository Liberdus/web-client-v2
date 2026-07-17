import http from 'node:http';
import { pathToFileURL } from 'node:url';

import { AnkrPortfolioProvider, EvmRpcPool } from '../evm/index.js';
import { DEFAULT_EVM_NETWORKS } from '../evm/networks.js';
import {
  createPortfolioJson,
  createWalletProbe,
  formatPortfolioText,
} from './wallet-probe.js';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8787;

function getAnkrEndpoint(environment = process.env) {
  if (environment.ANKR_MULTICHAIN_ENDPOINT?.trim()) {
    return environment.ANKR_MULTICHAIN_ENDPOINT.trim();
  }
  if (environment.ANKR_API_TOKEN?.trim()) {
    return `https://rpc.ankr.com/multichain/${encodeURIComponent(environment.ANKR_API_TOKEN.trim())}`;
  }
  return null;
}

function sendResponse(response, status, body, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(status, {
    'content-type': contentType,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(body);
}

function parseNetworks(url, networks) {
  const requested = url.searchParams.get('chains');
  if (!requested) {
    return networks.map((network) => network.id);
  }
  return requested.split(',').map((value) => value.trim()).filter(Boolean);
}

export function createWalletProbeServer({
  networks = DEFAULT_EVM_NETWORKS,
  rpcPool = new EvmRpcPool({ networks }),
  tokenProvider,
  environment = process.env,
} = {}) {
  const configuredTokenProvider = tokenProvider === undefined
    ? (() => {
      const endpoint = getAnkrEndpoint(environment);
      return endpoint
        ? new AnkrPortfolioProvider({
          endpoint,
          networks,
          onlyWhitelisted: environment.ANKR_ONLY_WHITELISTED === 'true',
        })
        : null;
    })()
    : tokenProvider;
  const probeWallet = createWalletProbe({ rpcPool, tokenProvider: configuredTokenProvider, networks });

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');

      if (request.method === 'GET' && url.pathname === '/health') {
        sendResponse(response, 200, JSON.stringify({
          status: 'ok',
          indexedTokenDiscovery: Boolean(configuredTokenProvider),
          monitoredChains: networks.map((network) => network.id),
        }), 'application/json; charset=utf-8');
        return;
      }

      const route = url.pathname.match(/^\/api\/wallets\/(0x[0-9a-fA-F]{40})\/portfolio$/);
      const isSimpleWalletRoute = url.pathname === '/';
      const walletAddress = route?.[1]
        || (isSimpleWalletRoute ? url.searchParams.get('wallet') : null);
      if (request.method !== 'GET' || !walletAddress) {
        if (request.method === 'GET' && url.pathname === '/') {
          sendResponse(
            response,
            400,
            'Usage: curl "http://127.0.0.1:8788/?wallet=0x..."\n',
          );
          return;
        }
        sendResponse(response, 404, 'Not found\n');
        return;
      }

      const networkIds = isSimpleWalletRoute
        ? networks.map((network) => network.id)
        : parseNetworks(url, networks);
      const portfolio = await probeWallet(walletAddress, networkIds);
      const wantsText = url.searchParams.get('format') === 'text';

      if (!wantsText) {
        sendResponse(
          response,
          200,
          `${JSON.stringify(createPortfolioJson(portfolio), null, 2)}\n`,
          'application/json; charset=utf-8',
        );
      } else {
        sendResponse(response, 200, formatPortfolioText(portfolio));
      }
    } catch (error) {
      const clientError = error instanceof TypeError;
      sendResponse(
        response,
        clientError ? 400 : 502,
        `${clientError ? 'Invalid request' : 'Wallet probe failed'}: ${error.message}\n`,
      );
    }
  });

  server.indexedTokenDiscovery = Boolean(configuredTokenProvider);
  return server;
}

async function startServer() {
  const host = process.env.WALLET_PROBE_HOST || DEFAULT_HOST;
  const port = Number(process.env.WALLET_PROBE_PORT || DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new TypeError('WALLET_PROBE_PORT must be a valid TCP port');
  }

  const server = createWalletProbeServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  const actualPort = typeof address === 'object' ? address.port : port;
  console.log(`Wallet probe server listening on http://${host}:${actualPort}`);
  console.log(`Indexed token discovery: ${server.indexedTokenDiscovery ? 'enabled' : 'disabled (native balances only)'}`);
  console.log(`Demo: curl "http://${host}:${actualPort}/?wallet=0x0000000000000000000000000000000000000000"`);

  const shutdown = () => server.close(() => process.exit(0));
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
