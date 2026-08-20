// svelte-package rewrites `$lib` import specifiers to relative paths but not
// strings inside `new URL()`, so the packaged ingest worker pointer must be
// repointed at its emitted .js neighbour. Runs in the `package` script.
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
