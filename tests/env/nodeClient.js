/**
 * The built-in `node` environment (Node globals, no DOM) with modules
 * compiled by Vite's CLIENT environment instead of SSR. GazePlotter runs in
 * the browser, so this is the code the app actually executes: under the SSR
 * compile a `.svelte.ts` `$derived` evaluates once and `$state` is a plain
 * object, which made runes-module tests pass or fail for the wrong reasons.
 * Referenced from vite.config.ts (`test.environment`).
 *
 * Self-contained on purpose: Vitest loads this file through Vite's module
 * runner, which rewrites a bare `vitest/*` import to a cache-busted
 * `runtime.js?v=<hash>` URL that Node cannot resolve, so the worker never
 * starts. The JSDoc type import below is erased and never reaches the runner.
 * `setup` has nothing to do: the default forks pool runs tests in Node's own
 * global, which already carries every Node global (the built-in env's only
 * extra, `console.Console`, included). `setupVM` exists only for vm pools.
 *
 * @type {import('vitest/environments').Environment}
 */
export default {
  name: 'node-client',
  viteEnvironment: 'client',
  setup() {
    return { teardown() {} }
  },
}
