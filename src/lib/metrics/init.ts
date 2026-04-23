/**
 * Registers all metric recipes and categories with the shared registry.
 * Imported (as a side-effect) by `index.ts`, `instances.ts`, and `query.ts`
 * so any entry point into the metrics API fires registration first. Vite
 * expands `import.meta.glob` into static imports at bundle time, so the
 * loader works in all build targets — including Web Workers.
 *
 * Adding a new metric: drop a file into `definitions/<category>/<metric>.ts`
 * that calls `defineMetric(...)` at module scope. No edit required here.
 */
import './categories'
void import.meta.glob('./definitions/**/*.ts', { eager: true })
