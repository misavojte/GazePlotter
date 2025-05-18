<script module lang="ts">
  // TypeScript declaration for the global variables
  // from vite.config.ts
  declare global {
    const __APP_VERSION__: string
    const __BUILD_DATE__: string
  }
</script>

<script>
  import '../app.css'
  /** @type {{children?: import('svelte').Snippet}} */
  let { children } = $props()
</script>

{@render children?.()}
