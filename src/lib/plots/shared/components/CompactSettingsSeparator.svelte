<script lang="ts">
  const { tone = 'default', margin = 4 } = $props<{
    tone?: 'default' | 'light'
    margin?: number
  }>()
</script>

<div
  class:light={tone === 'light'}
  class="separator"
  style:margin={`${margin}px 0`}
></div>

<style>
  .separator {
    height: 1px;
    background: var(--c-grey);
  }

  .separator.light {
    background: var(--c-lightgrey);
  }
</style>
