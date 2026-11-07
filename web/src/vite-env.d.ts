/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** '1' in the demo build (`pnpm build:demo`). */
  readonly VITE_DEMO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
