import { svelte } from '@sveltejs/vite-plugin-svelte'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import pkg from './package.json'

// The `gazeplotter` command. svelte-package leaves runes to the consumer's
// bundler; Node has none, so the CLI is built here with runes compiled.
export default defineConfig({
  plugins: [svelte({ configFile: false })],
  resolve: { alias: { $lib: fileURLToPath(new URL('./src/lib', import.meta.url)) } },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'node20',
    minify: false,
    lib: {
      entry: { cli: 'src/cli/bin.ts' },
      formats: ['es'],
      fileName: (_, name) => `${name}.js`,
    },
    rollupOptions: {
      external: [/^svelte/, /^node:/, 'jszip'],
      output: { chunkFileNames: 'node/[name]-[hash].js' },
    },
  },
})
