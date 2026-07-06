/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_RUNTIME_MODE?: 'offline_single_user' | string;
  readonly VITE_OFFLINE_DATASET_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
