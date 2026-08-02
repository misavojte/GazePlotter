/**
 * Registers every recipe and category. Imported for side effects by each
 * entry point into the metrics API, so registration always fires first. Vite
 * expands `import.meta.glob` into static imports at bundle time, so this works
 * in all build targets, Web Workers included.
 *
 * A new metric is a file in `definitions/<category>/` calling `defineMetric`
 * at module scope. No edit here.
 */
import './categories'
void import.meta.glob('./definitions/**/*.ts', { eager: true })
