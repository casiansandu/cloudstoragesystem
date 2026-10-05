/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKENDURL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
