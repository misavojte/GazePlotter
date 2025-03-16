<script lang="ts">
  interface Props {
    legend: string;
    children?: import('svelte').Snippet;
  }

  let { legend, children }: Props = $props();
</script>

<fieldset>
  <legend>{legend}</legend>
  {@render children?.()}
</fieldset>

<style>
  fieldset {
    border: 1px solid var(--c-darkgrey);
    border-radius: var(--rounded);
    padding: 10px;
    margin-bottom: 20px;
  }
  legend {
    padding: 0 10px;
  }
</style>
