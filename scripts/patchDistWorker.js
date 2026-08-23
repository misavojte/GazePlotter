// svelte-package rewrites `$lib` imports but not `new URL()` strings; repoint
// the packaged ingest worker at its emitted .js neighbour.
import { readFileSync, writeFileSync } from 'node:fs'

const FILE = 'dist/data/ingest/service.svelte.js'
const FROM = "new URL('$lib/data/ingest/worker.ts'"
const TO = "new URL('./worker.js'"

const source = readFileSync(FILE, 'utf8')
if (!source.includes(FROM)) {
  throw new Error(
    `patchDistWorker: pattern not found in ${FILE}; the worker URL in ` +
      'src/lib/data/ingest/service.svelte.ts changed, update this script.'
  )
}
writeFileSync(FILE, source.replace(FROM, TO))
console.log(`patchDistWorker: worker URL repointed in ${FILE}`)
