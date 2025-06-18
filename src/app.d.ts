// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }

  // Global variables defined in vite.config.ts
  const __APP_VERSION__: string
  const __BUILD_DATE__: string
}

export {}
