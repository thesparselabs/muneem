// Values electron-vite bakes into the main bundle at build time (MAIN_VITE_*); release.yml sets them (ADR-0056).
interface ImportMetaEnv {
  readonly MAIN_VITE_CRASH_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
