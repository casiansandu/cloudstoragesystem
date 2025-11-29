/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKENDURL: string;
  // add more VITE_ variables
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
