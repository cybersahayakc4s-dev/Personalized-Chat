import { io, Socket } from 'socket.io-client';
import { getServerBaseUrl, refreshAccessToken } from './api';

let socket: Socket | null = null;
let currentToken: string | null = null;
let isRefreshing = false;
let heartbeatInterval: any = null;

async function handleSilentRefresh() {
  if (isRefreshing) return;
  isRefreshing = true;
  try {
    const newToken = await refreshAccessToken();
    if (newToken && socket) {
      currentToken = newToken;
      socket.auth = { token: newToken };
      if ((socket.io.opts as any).query) {
        (socket.io.opts as any).query = { token: newToken };
      }
      if (!socket.connected) {
        socket.connect();
      } else {
        socket.emit('auth_update', { token: newToken });
      }
    }
  } catch (err) {
    console.error('Failed to silently refresh socket token:', err);
  } finally {
    isRefreshing = false;
  }
}

// Global listener when REST client refreshes the access token
if (typeof window !== 'undefined') {
  window.addEventListener('auth:refreshed', (e: any) => {
    const newToken = e.detail?.access_token;
    if (newToken && socket) {
      currentToken = newToken;
      socket.auth = { token: newToken };
      if ((socket.io.opts as any).query) {
        (socket.io.opts as any).query = { token: newToken };
      }
      if (!socket.connected) {
        socket.connect();
      } else {
        socket.emit('auth_update', { token: newToken });
      }
    }
  });
}

export function getSocket(token?: string | null): Socket | null {
  // If a new token is passed and differs from currentToken, disconnect previous session
  if (token && token !== currentToken) {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    currentToken = token;
  }

  const activeToken = token || currentToken;
  if (!activeToken) {
    return socket;
  }

  if (!socket) {
    currentToken = activeToken;
    const customServer = getServerBaseUrl();
    const socketUrl = customServer || window.location.origin;

    socket = io(socketUrl, {
      path: '/socket.io',
      auth: { token: activeToken },
      query: { token: activeToken },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });

    // Handle token expired event emitted by server while socket is connected
    socket.on('auth:token_expired', async () => {
      await handleSilentRefresh();
    });

    // Handle connect_error when reconnecting with an expired token
    socket.on('connect_error', async (err: any) => {
      const errMsg = typeof err === 'string' ? err : err?.message || err?.data?.code || '';
      if (errMsg.includes('TOKEN_EXPIRED') || errMsg.includes('AUTH_FAILED')) {
        await handleSilentRefresh();
      }
    });

    // Periodic heartbeat to validate token lifecycle
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
      if (socket && socket.connected) {
        socket.emit('heartbeat');
      }
    }, 45000);
  }
  return socket;
}

export function disconnectSocket() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  currentToken = null;
}
