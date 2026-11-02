import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vitest/config'
import pkg from './package.json'

export default defineConfig({
  plugins: [sveltekit()],
  worker: {
    // ES-format worker so the ingest worker can code-split: workspace parsing
    // (whose migration chain materializes metric instances through the metric
    // registry) loads as a lazy chunk instead of sitting in the stream-parsing
    // worker's startup bundle. The app already requires module-worker-capable
    // browsers (`new Worker(..., { type: 'module' })`).
    format: 'es',
  },
  server: {
    fs: {
      allow: ['docs'],
    },
  },
  test: {
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    // Node globals, but modules compiled for the CLIENT (the code the app
    // runs) instead of SSR — see tests/env/nodeClient.js.
    environment: './tests/env/nodeClient.js',
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    // Versions the demo URL by content, so a stored copy never goes stale.
    __DEMO_HASH__: JSON.stringify(
      createHash('sha256')
        .update(readFileSync(new URL('./static/data/demo.gazeplotter', import.meta.url)))
        .digest('hex')
        .slice(0, 12)
    ),
  },
})
