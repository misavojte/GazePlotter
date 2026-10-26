#!/usr/bin/env node
import { main } from './gazeplotter'

// exitCode, not exit(): a piped stdout flushes asynchronously, and exit()
// would truncate a large table.
main(process.argv.slice(2), {
  stdout: text => process.stdout.write(text),
  stderr: text => process.stderr.write(text),
}).then(code => {
  process.exitCode = code
})
