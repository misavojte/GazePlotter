import { Console } from 'node:console'

/**
 * The built-in `node` environment (Node globals, no DOM) with modules
 * compiled by Vite's CLIENT environment instead of SSR. GazePlotter runs in
 * the browser, so this is the code the app actually executes: under the SSR
 * compile a `.svelte.ts` `$derived` evaluates once and `$state` is a plain
 * object, which made runes-module tests pass or fail for the wrong reasons.
 * Referenced from vite.config.ts (`test.environment`).
 *
 * Self-contained on purpose: Vitest loads this file through Vite's module
 * runner, which rewrites a bare `vitest/runtime` import to a cache-busted
 * `runtime.js?v=<hash>` URL that Node cannot resolve, so the worker never
 * starts. `setup` mirrors the built-in node environment's (the default forks
 * pool needs nothing else; `setupVM` exists only for the vm pools).
 */
export default {
  name: 'node-client',
  viteEnvironment: 'client',
  async setup(global) {
    global.console.Console = Console
    return {
      teardown(global) {
        delete global.console.Console
      },
    }
  },
}
