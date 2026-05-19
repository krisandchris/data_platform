import type { ApiErrorPayload } from '../shared/types/contract';
import { apiBaseUrl } from './config';

export class ApiClientError extends Error {
  readonly status: number;
  readonly payload?: ApiErrorPayload;

  constructor(status: number, message: string, payload?: ApiErrorPayload) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.payload = payload;
  }
}

export interface HttpClientOptions {
  baseUrl?: string;
  fetcher?: typeof fetch;
}

const SESSION_TOKEN_STORAGE_KEY = 'uvp.sessionToken';

export function saveSessionToken(token: string) {
  try {
    globalThis.localStorage?.setItem(SESSION_TOKEN_STORAGE_KEY, token);
  } catch {
    // localStorage may be unavailable in tests or restricted browser contexts.
  }
}

export function clearSessionToken() {
  try {
    globalThis.localStorage?.removeItem(SESSION_TOKEN_STORAGE_KEY);
  } catch {
    // localStorage may be unavailable in tests or restricted browser contexts.
  }
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;

  constructor(options: HttpClientOptions = {}) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? apiBaseUrl);
    this.fetcher = options.fetcher ?? ((input, init) => globalThis.fetch(input, init));
  }

  async get<T>(path: string, init?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...init, method: 'GET' });
  }

  async post<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      ...init,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...init?.headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async patch<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      ...init,
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        ...init?.headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async delete<T>(path: string, init?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...init, method: 'DELETE' });
  }

  url(path: string): string {
    return joinUrl(this.baseUrl, path);
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await this.fetcher(this.url(path), {
      ...init,
      credentials: init.credentials ?? 'include',
      headers: {
        ...sessionAuthHeaders(),
        ...devUserHeaders(),
        ...init.headers,
      },
    });
    const contentType = response.headers.get('content-type') ?? '';
    const hasJson = contentType.includes('application/json');
    const payload = await parseResponseBody(response, hasJson);

    if (!response.ok) {
      const errorPayload = toApiErrorPayload(payload, hasJson);
      throw new ApiClientError(
        response.status,
        errorPayload?.message ?? (response.statusText || 'Request failed'),
        errorPayload,
      );
    }

    return payload as T;
  }
}

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/+$/, '');

const joinUrl = (baseUrl: string, path: string) => {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
};

const parseResponseBody = async (response: Response, hasJson: boolean) => {
  if (response.status === 204) {
    return undefined;
  }

  if (hasJson) {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }

  return response.text();
};

const toApiErrorPayload = (payload: unknown, hasJson: boolean): ApiErrorPayload | undefined => {
  if (!hasJson || payload === null || typeof payload !== 'object') {
    return undefined;
  }

  if ('code' in payload && typeof payload.code === 'string') {
    return {
      code: payload.code,
      message:
        'message' in payload && typeof payload.message === 'string'
          ? payload.message
          : payload.code,
      details:
        'details' in payload && payload.details && typeof payload.details === 'object'
          ? (payload.details as Record<string, unknown>)
          : undefined,
    };
  }

  if ('message' in payload && typeof payload.message === 'string') {
    return payload as ApiErrorPayload;
  }

  if ('detail' in payload) {
    const detail = payload.detail;
    if (detail && typeof detail === 'object' && 'code' in detail && typeof detail.code === 'string') {
      return {
        code: detail.code,
        message:
          'message' in detail && typeof detail.message === 'string'
            ? detail.message
            : detail.code,
        details:
          'details' in detail && detail.details && typeof detail.details === 'object'
            ? (detail.details as Record<string, unknown>)
            : (detail as Record<string, unknown>),
      };
    }
    return {
      code: 'backend_error',
      message: typeof detail === 'string' ? detail : JSON.stringify(detail),
      details: payload as Record<string, unknown>,
    };
  }

  return undefined;
};

const sessionAuthHeaders = (): HeadersInit => {
  try {
    const token = globalThis.localStorage?.getItem(SESSION_TOKEN_STORAGE_KEY);
    return token ? { 'X-Session-Token': token } : {};
  } catch {
    return {};
  }
};

const devUserHeaders = (): HeadersInit => {
  if (!import.meta.env.DEV) {
    return {};
  }

  try {
    const userId = globalThis.localStorage?.getItem('uvp.devUserId');
    return userId ? { 'x-user-id': userId } : {};
  } catch {
    return {};
  }
};
