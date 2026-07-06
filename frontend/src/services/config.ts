export const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000/api';

const cleanEnv = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const apiBaseUrl = cleanEnv(import.meta.env.VITE_API_BASE_URL) ?? DEFAULT_API_BASE_URL;

export const isOfflineSingleUserMode = () => true;

export const offlineDatasetId = () => cleanEnv(import.meta.env.VITE_OFFLINE_DATASET_ID) ?? 'urban_violation';
