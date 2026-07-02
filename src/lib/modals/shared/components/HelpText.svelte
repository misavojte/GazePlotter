<script lang="ts">
  import type { Snippet } from 'svelte'

  /** Small explanatory paragraph used across modals. `muted` for descriptions
   *  and column previews, `alert` for warnings/notices, `error` for
   *  validation messages. */
  interface Props {
    tone?: 'muted' | 'alert' | 'error'
    children: Snippet
  }

  let { tone = 'muted', children }: Props = $props()
</script>

<p class={`help-text ${tone}`}>
  {@render children()}
</p>

<style>
  .help-text {
    margin: 0;
    font-size: 0.85rem;
    line-height: 1.4;
  }

  .help-text.muted {
    color: var(--c-darkgrey);
  }

  .help-text.alert {
    color: var(--c-brand);
    font-weight: 500;
  }

  .help-text.error {
    color: var(--c-error);
  }
</style>
