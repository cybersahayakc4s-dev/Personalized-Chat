import { isElectron, getElectronApi } from '../utils/electron';

// REST client for Personalize Chat API
export function getServerBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  // 1. Runtime override via localStorage/sessionStorage
  const stored = localStorage.getItem('chat_server_base_url') ||
                 localStorage.getItem('personalize_server_url') ||
                 sessionStorage.getItem('personalize_server_url');
  if (stored && stored.trim()) {
    return stored.trim().replace(/\/$/, '');
  }

  // 2. Build-time environment variable VITE_CHAT_SERVER_BASE_URL
  const envUrl = import.meta.env.VITE_CHAT_SERVER_BASE_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/$/, '');
  }

  // 3. Fallback: If running inside Electron or via file:// protocol, default to http://localhost:8000
  if (window.location.protocol === 'file:' || window.location.origin === 'null' || isElectron()) {
    return 'http://localhost:8000';
  }

  return '';
}

export function setServerBaseUrl(url: string) {
  if (typeof window === 'undefined') return;
  const clean = (url || '').trim().replace(/\/$/, '');
  if (clean) {
    localStorage.setItem('chat_server_base_url', clean);
    localStorage.setItem('personalize_server_url', clean);
  } else {
    localStorage.removeItem('chat_server_base_url');
    localStorage.removeItem('personalize_server_url');
  }
}

export function getApiBase(): string {
  const base = getServerBaseUrl();
  return base ? `${base}/api` : '/api';
}

export function getStoredToken(): string | null {
  if (isElectron()) {
    return sessionStorage.getItem('chat_token');
  }
  return sessionStorage.getItem('chat_token') || localStorage.getItem('chat_token');
}

export function getStoredRefreshToken(): string | null {
  if (isElectron()) {
    // In Electron, refresh token is securely stored in safeStorage via IPC
    return null;
  }
  return sessionStorage.getItem('chat_refresh_token') || localStorage.getItem('chat_refresh_token');
}

export function setStoredToken(token: string, remember: boolean = true) {
  sessionStorage.setItem('chat_token', token);
  if (!isElectron() && remember) {
    localStorage.setItem('chat_token', token);
  }
}

export function setStoredTokens(accessToken: string, refreshToken?: string, remember: boolean = true) {
  sessionStorage.setItem('chat_token', accessToken);
  if (!isElectron() && remember) {
    localStorage.setItem('chat_token', accessToken);
  }
  if (refreshToken) {
    if (isElectron()) {
      // In Electron: store refresh token strictly in safeStorage (DPAPI)
      const electronApi = getElectronApi();
      if (electronApi) {
        electronApi.setRefreshToken(refreshToken).catch(err => {
          console.error('[api] Failed to save refresh token in safeStorage:', err);
        });
      }
    } else {
      // Outside Electron: normal web browser behavior
      sessionStorage.setItem('chat_refresh_token', refreshToken);
      if (remember) {
        localStorage.setItem('chat_refresh_token', refreshToken);
      }
    }
  }
}

export function clearStoredAuth() {
  localStorage.removeItem('chat_token');
  localStorage.removeItem('chat_refresh_token');
  localStorage.removeItem('chat_user');
  sessionStorage.removeItem('chat_token');
  sessionStorage.removeItem('chat_refresh_token');
  sessionStorage.removeItem('chat_user');

  if (isElectron()) {
    const electronApi = getElectronApi();
    if (electronApi) {
      electronApi.clearRefreshToken().catch(err => {
        console.error('[api] Failed to clear refresh token in safeStorage:', err);
      });
    }
  }
}

let refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  let refreshToken: string | null = null;
  if (isElectron()) {
    const electronApi = getElectronApi();
    if (electronApi) {
      refreshToken = await electronApi.getRefreshToken();
    }
  } else {
    refreshToken = getStoredRefreshToken();
  }

  if (!refreshToken) {
    return null;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) {
        clearStoredAuth();
        window.dispatchEvent(new Event('auth:unauthorized'));
        return null;
      }

      const data = await res.json();
      if (data && data.access_token) {
        setStoredTokens(data.access_token, data.refresh_token);
        window.dispatchEvent(new CustomEvent('auth:refreshed', { detail: data }));
        return data.access_token;
      }
      return null;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function request<T = any>(endpoint: string, options: RequestInit = {}, isRetry: boolean = false): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  let res: Response;
  try {
    res = await fetch(`${getApiBase()}${endpoint}`, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (netErr: any) {
    clearTimeout(timeoutId);
    if (netErr.name === 'AbortError') {
      if (options.signal && options.signal.aborted) {
        const abortErr = new Error('Request aborted');
        abortErr.name = 'AbortError';
        throw abortErr;
      }
      throw new Error('Server connection timed out (10s). Please verify the backend is running.');
    }
    throw new Error(netErr.message || 'Cannot reach server. Please check your network connection.');
  }

  if (!res.ok) {
    // 401 Interceptor: attempt silent refresh and single retry before showing login
    if (res.status === 401 && !endpoint.startsWith('/auth/login') && !endpoint.startsWith('/auth/refresh') && !isRetry) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        const retryHeaders = {
          ...headers,
          'Authorization': `Bearer ${newToken}`,
        };
        return request<T>(endpoint, { ...options, headers: retryHeaders }, true);
      }
      clearStoredAuth();
      window.dispatchEvent(new Event('auth:unauthorized'));
    }

    let errDetail = `Error ${res.status}: ${res.statusText || 'An error occurred'}`;
    try {
      const rawText = await res.text();
      let parsed = false;
      try {
        const errJson = JSON.parse(rawText);
        if (typeof errJson.detail === 'string') {
          errDetail = errJson.detail;
          parsed = true;
        } else if (Array.isArray(errJson.detail)) {
          errDetail = errJson.detail.map((e: any) => {
            const field = e.loc ? e.loc[e.loc.length - 1] : '';
            return field ? `${field}: ${e.msg}` : e.msg;
          }).join('; ');
          parsed = true;
        } else if (errJson.detail) {
          errDetail = JSON.stringify(errJson.detail);
          parsed = true;
        } else if (errJson.message) {
          errDetail = errJson.message;
          parsed = true;
        }
      } catch {
        parsed = false;
      }

      if (!parsed) {
        if (
          rawText.includes('ECONNREFUSED') ||
          rawText.includes('Could not proxy request') ||
          res.status === 502 ||
          res.status === 503 ||
          res.status === 504 ||
          (res.status === 500 && (!rawText.trim() || rawText.includes('Internal Server Error') || rawText.includes('<html')))
        ) {
          errDetail = 'Backend server is not running or unreachable on port 8000. Please start the backend.';
        } else if (rawText && rawText.trim()) {
          errDetail = rawText.length > 200 ? rawText.slice(0, 200) + '...' : rawText;
        }
      }
    } catch {
      // Body stream could not be read
    }

    throw new Error(errDetail);
  }

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  return (await res.text()) as unknown as T;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ access_token: string; refresh_token?: string; token_type: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  refresh: (refreshToken: string) =>
    request<{ access_token: string; refresh_token?: string; token_type: string; user: any }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),

  logout: (refreshToken?: string | null) =>
    request<{ status: string; message: string }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken || getStoredRefreshToken() }),
    }),
  getMe: () => request('/auth/me'),

  // Users & Colleagues
  getUsers: () => request<any[]>('/users'),

  // Teams
  getTeams: () => request<any[]>('/teams'),

  // Messages & Conversations
  getDMHistory: (userId: string, limit: number = 50, beforeId?: number) => {
    let url = `/messages/dm/${userId}?limit=${limit}`;
    if (beforeId !== undefined && beforeId !== null) {
      url += `&before_id=${beforeId}`;
    }
    return request<any[]>(url);
  },
  getTeamHistory: (team: string, limit: number = 50, beforeId?: number) => {
    let url = `/messages/team/${team}?limit=${limit}`;
    if (beforeId !== undefined && beforeId !== null) {
      url += `&before_id=${beforeId}`;
    }
    return request<any[]>(url);
  },
  getChannelHistory: (format: string, limit: number = 50, beforeId?: number) => {
    let url = `/messages?format=${encodeURIComponent(format)}&limit=${limit}`;
    if (beforeId !== undefined && beforeId !== null) {
      url += `&before_id=${beforeId}`;
    }
    return request<any[]>(url);
  },
  sendMessage: (data: {
    receiver_id?: number | string;
    recipient_id?: number | string;
    team?: string;
    content: string;
    format?: string;
    reply_to_id?: number | string;
    attachment_ids?: string[];
  }) => {
    const targetNum = data.receiver_id !== undefined && data.receiver_id !== null
      ? Number(data.receiver_id)
      : (data.recipient_id !== undefined && data.recipient_id !== null ? Number(data.recipient_id) : undefined);

    return request<any>('/messages', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        receiver_id: targetNum,
        recipient_id: targetNum,
      }),
    });
  },
  editMessage: (id: string, content: string) =>
    request<any>(`/messages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    }),
  deleteMessage: (id: string) =>
    request<any>(`/messages/${id}`, {
      method: 'DELETE',
    }),
  toggleReaction: (id: string, emoji: string) =>
    request<any>(`/messages/${id}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }),
  togglePin: (id: string) =>
    request<any>(`/messages/${id}/pin`, {
      method: 'POST',
    }),
  getThread: (id: string) =>
    request<{ parent: any; replies: any[] }>(`/messages/${id}/thread`),
  getPinnedMessages: (team?: string, recipientId?: string) => {
    let url = '/messages/pinned';
    const params = new URLSearchParams();
    if (team) params.append('team', team);
    if (recipientId) params.append('recipient_id', recipientId);
    const qs = params.toString();
    return request<any[]>(qs ? `${url}?${qs}` : url);
  },
  search: (q: string, signal?: AbortSignal) =>
    request<{ messages: any[]; files: any[] }>(`/messages/search?q=${encodeURIComponent(q)}`, { signal }),

  // Attachments
  uploadAttachment: (formData: FormData, onProgress?: (percent: number) => void): Promise<any> => {
    return new Promise((resolve, reject) => {
      const token = getStoredToken();
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${getApiBase()}/attachments/upload`);
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            resolve(xhr.responseText);
          }
        } else {
          let err = 'Upload failed';
          try {
            const errJson = JSON.parse(xhr.responseText);
            err = errJson.detail || err;
          } catch {}
          reject(new Error(err));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during file upload'));
      xhr.send(formData);
    });
  },

  // Admin
  adminListUsers: () => request<any[]>('/main-admin/users'),
  getMainAdmins: () => request<any[]>('/main-admin/admins'),
  adminCreateUser: (userData: {
    email: string;
    full_name?: string;
    name?: string;
    password?: string;
    role?: string;
    team?: string;
    is_team_leader?: boolean;
    is_main_admin?: boolean;
    current_admin_password?: string;
  }) =>
    request<any>('/main-admin/users', {
      method: 'POST',
      body: JSON.stringify({
        name: userData.name || userData.full_name,
        email: userData.email,
        password: userData.password,
        team: userData.team,
        is_team_leader: Boolean(userData.is_team_leader),
        is_main_admin: Boolean(userData.is_main_admin),
        current_admin_password: userData.current_admin_password || undefined,
      }),
    }),
  adminUpdateUser: (userId: string, updateData: any) =>
    request<any>(`/main-admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    }),
  adminDeleteUser: (userId: string) =>
    request<any>(`/main-admin/users/${userId}`, {
      method: 'DELETE',
    }),
  adminResetPassword: (userId: string, password: string, currentAdminPassword?: string) =>
    request<any>(`/main-admin/users/${userId}/password`, {
      method: 'PATCH',
      body: JSON.stringify({
        new_password: password,
        current_admin_password: currentAdminPassword || undefined,
      }),
    }),
  getAuditLogs: () => request<any[]>('/main-admin/audit-logs'),
  getWorkspaceSettings: () => request<any>('/main-admin/settings'),
  updateWorkspaceSettings: (data: any) =>
    request<any>('/main-admin/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  adminResetData: () =>
    request<{ status: string; message: string }>('/main-admin/reset-data', {
      method: 'POST',
    }),
};
