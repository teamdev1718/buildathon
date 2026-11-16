const base = '/api/v1';
let accessToken: string | undefined;
let refreshing: Promise<boolean> | undefined;

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function setAccess(token?: string) {
  accessToken = token;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', 'Bearer ' + accessToken);
  const result = await fetch(base + path, { ...init, headers, credentials: 'same-origin' });
  const data = await result.json().catch(() => null);
  if (!result.ok || data === null) {
    throw new ApiError(result.status, data?.error?.code ?? 'CONNECTION', data?.error?.message ?? 'The API is unavailable.');
  }
  return data as T;
}

const json = (method: string, body: object = {}): RequestInit => ({ method, body: JSON.stringify(body) });
async function rotate() {
  try {
    const result = await request<{ accessToken: string }>('/auth/refresh', json('POST'));
    setAccess(result.accessToken);
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      setAccess();
      return false;
    }
    throw error;
  }
}

function withSessionLock<T>(action: () => Promise<T>) {
  return navigator.locks ? navigator.locks.request('buildathon-session', action) as Promise<T> : action();
}

export function refreshAccess() {
  refreshing ??= withSessionLock(async () => {
    try {
      return await rotate();
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'ROTATION_CONFLICT') throw error;
      await new Promise(resolve => setTimeout(resolve, 250));
      return rotate();
    }
  }).finally(() => { refreshing = undefined; });
  return refreshing;
}

export async function api<T>(path: string, method = 'GET', body?: object, authenticated = false): Promise<T> {
  const previous = accessToken;
  const init = method === 'GET' ? {} : json(method, body);
  try {
    return await request<T>(path, init);
  } catch (error) {
    if (!authenticated || !(error instanceof ApiError) || error.status !== 401 ||
        !(accessToken && accessToken !== previous) && !await refreshAccess()) throw error;
    return request<T>(path, init);
  }
}

export function logout() {
  return withSessionLock(async () => {
    await request('/auth/logout', json('POST'));
    setAccess();
  });
}

