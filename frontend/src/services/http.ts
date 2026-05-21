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

export interface UploadProgress {
  loadedBytes: number;
  totalBytes?: number;
  percent?: number;
}

export interface UploadRequestInit extends RequestInit {
  onUploadProgress?: (progress: UploadProgress) => void;
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

  async postRaw<T>(path: string, body: BodyInit, init?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      ...init,
      method: 'POST',
      body,
    });
  }

  async postRawWithProgress<T>(path: string, body: BodyInit, init: UploadRequestInit = {}): Promise<T> {
    if (!init.onUploadProgress || typeof XMLHttpRequest === 'undefined') {
      return this.postRaw<T>(path, body, init);
    }
    return this.xhrRequest<T>(path, {
      ...init,
      method: 'POST',
      body,
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

  async put<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      ...init,
      method: 'PUT',
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

  private async xhrRequest<T>(path: string, init: UploadRequestInit & { body?: BodyInit }): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const abortHandler = () => {
        xhr.abort();
        reject(new ApiClientError(0, 'Request aborted'));
      };

      xhr.open(init.method ?? 'GET', this.url(path), true);
      xhr.withCredentials = (init.credentials ?? 'include') !== 'omit';
      for (const [name, value] of Object.entries(
        mergeHeaders(sessionAuthHeaders(), devUserHeaders(), init.headers),
      )) {
        xhr.setRequestHeader(name, value);
      }

      xhr.upload.onprogress = (event) => {
        const totalBytes = event.lengthComputable ? event.total : bodySize(init.body);
        init.onUploadProgress?.({
          loadedBytes: event.loaded,
          totalBytes,
          percent: totalBytes ? Math.min(100, Math.round((event.loaded / totalBytes) * 100)) : undefined,
        });
      };
      xhr.upload.onload = () => {
        const totalBytes = bodySize(init.body);
        if (totalBytes) {
          init.onUploadProgress?.({
            loadedBytes: totalBytes,
            totalBytes,
            percent: 100,
          });
        }
      };

      const cleanup = () => {
        init.signal?.removeEventListener('abort', abortHandler);
      };

      xhr.onload = () => {
        cleanup();
        const contentType = xhr.getResponseHeader('content-type') ?? '';
        const hasJson = contentType.includes('application/json');
        const payload = parseTextBody(xhr.responseText, hasJson);
        if (xhr.status < 200 || xhr.status >= 300) {
          const errorPayload = toApiErrorPayload(payload, hasJson);
          reject(
            new ApiClientError(
              xhr.status,
              errorPayload?.message ?? (xhr.statusText || 'Request failed'),
              errorPayload,
            ),
          );
          return;
        }
        resolve(payload as T);
      };
      xhr.onerror = () => {
        cleanup();
        reject(new ApiClientError(xhr.status || 0, xhr.statusText || 'Network request failed'));
      };
      xhr.ontimeout = () => {
        cleanup();
        reject(new ApiClientError(0, 'Request timed out'));
      };
      xhr.onabort = () => {
        cleanup();
      };

      if (init.signal?.aborted) {
        abortHandler();
        return;
      }
      init.signal?.addEventListener('abort', abortHandler, { once: true });
      xhr.send(toXhrBody(init.body));
    });
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

const parseTextBody = (responseText: string, hasJson: boolean) => {
  if (hasJson) {
    try {
      return JSON.parse(responseText);
    } catch {
      return undefined;
    }
  }
  return responseText;
};

const mergeHeaders = (...headersList: Array<HeadersInit | undefined>): Record<string, string> => {
  return Object.assign({}, ...headersList.map(headersToRecord));
};

const headersToRecord = (headers?: HeadersInit): Record<string, string> => {
  if (!headers) {
    return {};
  }
  if (headers instanceof Headers) {
    const record: Record<string, string> = {};
    headers.forEach((value, key) => {
      record[key] = value;
    });
    return record;
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers.map(([key, value]) => [key, value]));
  }
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, String(value)]));
};

const bodySize = (body?: BodyInit): number | undefined => {
  if (body instanceof Blob) {
    return body.size;
  }
  if (body instanceof ArrayBuffer) {
    return body.byteLength;
  }
  if (ArrayBuffer.isView(body)) {
    return body.byteLength;
  }
  if (typeof body === 'string') {
    return new Blob([body]).size;
  }
  return undefined;
};

const toXhrBody = (body?: BodyInit): XMLHttpRequestBodyInit | Document | null => {
  if (body === undefined || body === null) {
    return null;
  }
  if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) {
    throw new ApiClientError(0, 'ReadableStream upload progress is not supported');
  }
  return body as XMLHttpRequestBodyInit | Document;
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
