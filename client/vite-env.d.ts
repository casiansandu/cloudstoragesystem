/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKENDURL: string;
  // add more VITE_ variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
