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

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await this.fetcher(joinUrl(this.baseUrl, path), init);
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

  if ('message' in payload && typeof payload.message === 'string') {
    return payload as ApiErrorPayload;
  }

  if ('detail' in payload) {
    const detail = payload.detail;
    return {
      code: 'backend_error',
      message: typeof detail === 'string' ? detail : JSON.stringify(detail),
      details: payload as Record<string, unknown>,
    };
  }

  return undefined;
};
