// Central API client with error mapping and server wake detection

export class ApiError extends Error {
  code: string;
  fieldErrors?: Record<string, string>;
  status: number;
  details?: any;

  constructor(message: string, code = 'ERROR', status = 500, fieldErrors?: Record<string, string>, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.details = details;
  }
}

// Global wake-up listener
type WakeListener = (isWaking: boolean) => void;
const wakeListeners = new Set<WakeListener>();

export function subscribeToWakingState(listener: WakeListener) {
  wakeListeners.add(listener);
  return () => {
    wakeListeners.delete(listener);
  };
}

const slowRequests = new Set<string>();
const pendingRequests = new Set<string>();

function updateWakingNotification() {
  const isWaking = slowRequests.size > 0;
  wakeListeners.forEach((fn) => fn(isWaking));
}

let requestCounter = 0;

export async function fetchApi<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? '' : '/'}${path}`;
  const reqId = `req_${++requestCounter}_${Date.now()}`;
  pendingRequests.add(reqId);

  // Trigger wake indicator only if request takes longer than 3 seconds (e.g. Render cold start)
  const slowTimer = setTimeout(() => {
    if (pendingRequests.has(reqId)) {
      slowRequests.add(reqId);
      updateWakingNotification();
    }
  }, 3000);

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      credentials: 'include',
    });

    const contentType = res.headers.get('content-type') || '';
    let data: any = null;
    if (contentType.includes('application/json')) {
      data = await res.json().catch(() => ({}));
    } else if (contentType.includes('text/')) {
      data = await res.text();
    }

    if (!res.ok) {
      const errObj = data?.error || data;
      const message =
        errObj?.message ||
        data?.message ||
        (typeof data === 'string' ? data : `Request failed with status ${res.status}`);
      const code = errObj?.code || 'HTTP_ERROR';
      const fieldErrors = errObj?.fieldErrors;
      const details = errObj?.details;

      throw new ApiError(message, code, res.status, fieldErrors, details);
    }

    return data as T;
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(err.message || 'Network request failed', 'NETWORK_ERROR', 0);
  } finally {
    clearTimeout(slowTimer);
    pendingRequests.delete(reqId);
    if (slowRequests.has(reqId)) {
      slowRequests.delete(reqId);
      updateWakingNotification();
    }
  }
}
