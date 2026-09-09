import { builtinEnvironments } from 'vitest/runtime'

/**
 * The built-in `node` environment (Node globals, no DOM) with modules
 * compiled by Vite's CLIENT environment instead of SSR. GazePlotter runs in
 * the browser, so this is the code the app actually executes: under the SSR
 * compile a `.svelte.ts` `$derived` evaluates once and `$state` is a plain
 * object, which made runes-module tests pass or fail for the wrong reasons.
 * Referenced from vite.config.ts (`test.environment`).
 */
export default {
  ...builtinEnvironments.node,
  name: 'node-client',
  viteEnvironment: 'client',
}
