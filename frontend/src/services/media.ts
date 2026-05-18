import { apiBaseUrl } from './config';

const localAbsolutePathPattern = /^(?:file:|[a-zA-Z]:[\\/]|\/(?:Users|home|mnt|var|tmp|Volumes|opt|data)\/)/;

export const isBrowserSafeMediaUrl = (value: string | undefined): value is string => {
  if (!value) {
    return false;
  }

  return !localAbsolutePathPattern.test(value);
};

export const toBrowserMediaUrl = (value: string | undefined, baseUrl = apiBaseUrl) => {
  if (!isBrowserSafeMediaUrl(value)) {
    return undefined;
  }

  if (baseUrl.startsWith('/')) {
    return value.startsWith('/') ? value : `${baseUrl.replace(/\/+$/, '')}/${value.replace(/^\/+/, '')}`;
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return undefined;
  }
};
